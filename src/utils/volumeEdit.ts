<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Three.js Yüzey Vurgulama ve Düzenleme</title>
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <style>
        body { margin: 0; overflow: hidden; font-family: 'Inter', sans-serif; }
        canvas { display: block; }
        #info {
            position: absolute;
            top: 10px;
            left: 10px;
            color: white;
            background: rgba(0, 0, 0, 0.5);
            padding: 10px;
            border-radius: 8px;
            font-size: 14px;
            pointer-events: none; /* Allows clicks to pass through */
        }
        .controls {
            position: absolute;
            bottom: 10px;
            left: 50%;
            transform: translateX(-50%);
            background: rgba(0, 0, 0, 0.7);
            padding: 15px;
            border-radius: 12px;
            display: flex;
            gap: 10px;
            box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        }
        .controls button {
            background-color: #4CAF50; /* Green */
            color: white;
            padding: 10px 20px;
            border: none;
            border-radius: 8px;
            cursor: pointer;
            font-size: 16px;
            transition: background-color 0.3s ease, transform 0.2s ease;
            box-shadow: 0 4px #388E3C; /* Darker green shadow */
        }
        .controls button:hover {
            background-color: #45a049;
            transform: translateY(-2px);
            box-shadow: 0 6px #388E3C;
        }
        .controls button:active {
            background-color: #3e8e41;
            transform: translateY(2px);
            box-shadow: 0 2px #388E3C;
        }
    </style>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;700&display=swap" rel="stylesheet">
</head>
<body>
    <div id="info">
        Tıklanan Yüzey: Yok<br>
        Tıklanan Nokta (Dünya): Yok
    </div>
    <div class="controls">
        <button id="addBox">Kutu Ekle</button>
        <button id="addCylinder">Silindir Ekle</button>
        <button id="addPolygon">Poligon Ekle</button>
    </div>

    <script>
        // --- Shape Interface and Flood-Fill Face Utility Functions ---

        interface Shape {
          type: 'box' | 'rectangle2d' | 'cylinder' | 'circle2d' | 'polyline2d' | 'polygon2d' | 'polyline3d' | 'polygon3d';
          parameters: {
            width?: number;
            height?: number;
            depth?: number;
            radius?: number;
            [key: string]: any; 
          };
          scale: [number, number, number];
          position: [number, number, number];
          rotation: [number, number, number]; 
          quaternion?: THREE.Quaternion; 
          originalPoints?: THREE.Vector3[]; 
          geometry: THREE.BufferGeometry; 
          mesh?: THREE.Mesh; 
          id: string; // Added for unique identification in highlight
        }

        export interface FaceHighlight {
            mesh: THREE.Mesh;
            faceIndex: number;
            shapeId: string;
        }

        let currentHighlight: FaceHighlight | null = null;

        /**
         * BufferGeometry'den face vertices'lerini al
         */
        export const getFaceVertices = (geometry: THREE.BufferGeometry, faceIndex: number): THREE.Vector3[] => {
            const pos = geometry.attributes.position;
            const index = geometry.index;
            
            if (!pos) {
                console.warn('Geometry has no position attribute');
                return [];
            }

            const a = faceIndex * 3;
            const vertices: THREE.Vector3[] = [];

            try {
                if (index) {
                    // Indexed geometry
                    for (let i = 0; i < 3; i++) {
                        const vertexIndex = index.getX(a + i);
                        const vertex = new THREE.Vector3().fromBufferAttribute(pos, vertexIndex);
                        vertices.push(vertex);
                    }
                } else {
                    // Non-indexed geometry
                    for (let i = 0; i < 3; i++) {
                        const vertex = new THREE.Vector3().fromBufferAttribute(pos, a + i);
                        vertices.push(vertex);
                    }
                }
            } catch (error) {
                console.warn('Error getting face vertices:', error);
                return [];
            }

            return vertices;
        };

        /**
         * Face normal'ını hesapla
         */
        export const getFaceNormal = (vertices: THREE.Vector3[]): THREE.Vector3 => {
            if (vertices.length < 3) return new THREE.Vector3(0, 1, 0);
            
            const v1 = new THREE.Vector3().subVectors(vertices[1], vertices[0]);
            const v2 = new THREE.Vector3().subVectors(vertices[2], vertices[0]);
            
            return new THREE.Vector3().crossVectors(v1, v2).normalize();
        };

        /**
         * Face center'ını hesapla
         */
        export const getFaceCenter = (vertices: THREE.Vector3[]): THREE.Vector3 => {
            const center = new THREE.Vector3();
            vertices.forEach(vertex => center.add(vertex));
            center.divideScalar(vertices.length);
            return center;
        };

        /**
         * Face area'sını hesapla
         */
        export const getFaceArea = (vertices: THREE.Vector3[]): number => {
            if (vertices.length < 3) return 0;
            
            const v1 = new THREE.Vector3().subVectors(vertices[1], vertices[0]);
            const v2 = new THREE.Vector3().subVectors(vertices[2], vertices[0]);
            
            return v1.cross(v2).length() / 2;
        };

        /**
         * Epsilon-based vertex eşitlik kontrolü
         */
        const EPSILON = 1e-4; // Küçük bir hata payı
        const verticesEqual = (v1: THREE.Vector3, v2: THREE.Vector3): boolean => {
            return v1.distanceToSquared(v2) < EPSILON;
        };

        /**
         * Komşu face'leri bul (koordinat bazlı vertex karşılaştırması)
         */
        const getNeighborFaces = (geometry: THREE.BufferGeometry, faceIndex: number): number[] => {
            const neighbors: number[] = [];
            const totalFaces = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;

            const thisVerts = getFaceVertices(geometry, faceIndex);
            if (thisVerts.length === 0) return neighbors;

            for (let i = 0; i < totalFaces; i++) {
                if (i === faceIndex) continue;
                
                const otherVerts = getFaceVertices(geometry, i);
                if (otherVerts.length === 0) continue;

                // Kaç ortak vertex var?
                let sharedCount = 0;
                for (const v1 of thisVerts) {
                    for (const v2 of otherVerts) {
                        if (verticesEqual(v1, v2)) {
                            sharedCount++;
                            break; 
                        }
                    }
                }
                
                // Tam 2 ortak vertex = komşu (ortak kenar)
                if (sharedCount === 2) {
                    neighbors.push(i);
                }
            }
            
            return neighbors;
        };

        /**
         * Flood-fill algoritması ile sadece tıklanan yüzeyi bulma
         */
        export const getFullSurfaceVertices = (geometry: THREE.BufferGeometry, startFaceIndex: number): THREE.Vector3[] => {
            const pos = geometry.attributes.position;
            const index = geometry.index;
            if (!pos) return [];

            console.log(`🎯 Flood-fill surface detection from face ${startFaceIndex}`);
            
            // Başlangıç face'inin bilgilerini al
            const startVertices = getFaceVertices(geometry, startFaceIndex);
            const startNormal = getFaceNormal(startVertices).normalize();
            const startCenter = getFaceCenter(startVertices);
            
            console.log(`🎯 Start face normal: [${startNormal.x.toFixed(3)}, ${startNormal.y.toFixed(3)}, ${startNormal.z.toFixed(3)}]`);
            console.log(`🎯 Start face center: [${startCenter.x.toFixed(1)}, ${startCenter.y.toFixed(1)}, ${startCenter.z.toFixed(1)}]`);

            const visited = new Set<number>();
            const surfaceFaces: number[] = [];
            const queue = [startFaceIndex];
            
            // Toleranslar gevşetildi
            const NORMAL_TOLERANCE = THREE.MathUtils.degToRad(3); // 3° tolerans
            const DISTANCE_TOLERANCE = 2.0; // 2mm düzlem mesafesi toleransı

            // Başlangıç düzlemini hesapla (point-normal form)
            const planeNormal = startNormal.clone();
            const planePoint = startCenter.clone();
            const planeD = -planeNormal.dot(planePoint);

            // Flood-fill algoritması - BFS ile komşu face'leri tara
            while (queue.length > 0) {
                const faceIndex = queue.shift()!;
                if (visited.has(faceIndex)) continue;
                visited.add(faceIndex);
                surfaceFaces.push(faceIndex);

                const neighbors = getNeighborFaces(geometry, faceIndex);
                
                for (const neighborIndex of neighbors) {
                    if (visited.has(neighborIndex)) continue;
                    
                    // Komşu face'in bilgilerini al
                    const neighborVertices = getFaceVertices(geometry, neighborIndex);
                    const neighborNormal = getFaceNormal(neighborVertices).normalize();
                    const neighborCenter = getFaceCenter(neighborVertices);
                    
                    // 1. Normal kontrolü - iki yönü de kabul et
                    const normalAngle = Math.min(
                        neighborNormal.angleTo(startNormal),
                        neighborNormal.angleTo(startNormal.clone().negate()) 
                    );
                    
                    // 2. Düzlem mesafesi kontrolü
                    const distanceToPlane = Math.abs(planeNormal.dot(neighborCenter) + planeD);
                    
                    // Hem normal hem düzlem mesafesi uygunsa ekle
                    if (normalAngle < NORMAL_TOLERANCE && distanceToPlane < DISTANCE_TOLERANCE) {
                        queue.push(neighborIndex);
                    } else {
                    }
                }
            }
            console.log(`🎯 Flood-fill complete: ${surfaceFaces.length} connected faces found`);
            
            // Tüm surface face'lerinin benzersiz vertex'lerini topla
            const allVertices: THREE.Vector3[] = [];
            const uniqueVerticesMap = new Map<string, THREE.Vector3>(); 
            
            surfaceFaces.forEach(faceIndex => {
                const vertices = getFaceVertices(geometry, faceIndex);
                vertices.forEach(vertex => {
                    const key = `${vertex.x.toFixed(4)},${vertex.y.toFixed(4)},${vertex.z.toFixed(4)}`;
                    if (!uniqueVerticesMap.has(key)) {
                        uniqueVerticesMap.set(key, vertex);
                        allVertices.push(vertex);
                    }
                });
            });
            
            console.log(`📊 Final flood-fill surface: ${surfaceFaces.length} triangles, ${allVertices.length} unique vertices`);
            return allVertices;
        };

        /**
         * Yüzey highlight mesh'i oluştur
         */
        export const createFaceHighlight = (
            vertices: THREE.Vector3[], 
            worldMatrix: THREE.Matrix4,
            color: number = 0xff6b35,
            opacity: number = 0.6
        ): THREE.Mesh => {
            console.log(`🎨 Creating highlight mesh with ${vertices.length} vertices`);
            
            // World space'e dönüştür
            const worldVertices = vertices.map(v => {
                const worldVertex = v.clone().applyMatrix4(worldMatrix);
                return worldVertex;
            });
            
            const geometry = new THREE.BufferGeometry();
            const positions = new Float32Array(worldVertices.length * 3);
            
            worldVertices.forEach((vertex, i) => {
                positions[i * 3] = vertex.x;
                positions[i * 3 + 1] = vertex.y;
                positions[i * 3 + 2] = vertex.z;
            });
            
            geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
            
            const indices: number[] = [];
            
            if (worldVertices.length >= 3) {
                for (let i = 1; i < worldVertices.length - 1; i++) {
                    indices.push(0, i, i + 1);
                }
            }
            
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: Math.min(opacity + 0.2, 0.9), 
                side: THREE.DoubleSide,
                depthTest: true,
                depthWrite: false,
                wireframe: false
            });
            
            const mesh = new THREE.Mesh(geometry, material);
            console.log(`✅ Highlight mesh created with ${indices.length / 3} triangles`);
            
            return mesh;
        };

        /**
         * Mevcut highlight'ı temizle
         */
        export const clearFaceHighlight = (scene: THREE.Scene) => {
            if (currentHighlight) {
                scene.remove(currentHighlight.mesh);
                currentHighlight.mesh.geometry.dispose();
                (currentHighlight.mesh.material as THREE.Material).dispose();
                currentHighlight = null;
                console.log('🎯 Face highlight cleared');
            }
        };

        /**
         * Yüzey highlight'ı ekle (Flood-Fill tabanlı)
         */
        export const highlightFace = (
            scene: THREE.Scene,
            hit: THREE.Intersection,
            shape: Shape, 
            color: number = 0xff6b35,
            opacity: number = 0.6
        ): FaceHighlight | null => {
            clearFaceHighlight(scene);
            
            if (!hit.face || hit.faceIndex === undefined) {
                console.warn('No face data in intersection');
                return null;
            }
            
            const mesh = hit.object as THREE.Mesh;
            const geometry = mesh.geometry as THREE.BufferGeometry;
            
            console.log(`🎯 Highlighting face ${hit.faceIndex} on ${shape.type} (${shape.id})`);
            
            const fullSurfaceVertices = getFullSurfaceVertices(geometry, hit.faceIndex);
            
            console.log(`📊 Full surface vertices: ${fullSurfaceVertices.length}`);
            
            const surfaceVertices = fullSurfaceVertices.length >= 3 ? fullSurfaceVertices : getFaceVertices(geometry, hit.faceIndex);
            
            if (surfaceVertices.length < 3) {
                console.warn('Not enough vertices to create a highlight mesh.');
                return null;
            }

            console.log(`✅ Using ${surfaceVertices.length} vertices for highlight`);
            
            const worldMatrix = mesh.matrixWorld.clone();
            
            const highlightMesh = createFaceHighlight(surfaceVertices, worldMatrix, color, opacity);
            
            scene.add(highlightMesh);
            
            const faceNormal = getFaceNormal(surfaceVertices);
            const faceCenter = getFaceCenter(surfaceVertices);
            const faceArea = getFaceArea(surfaceVertices);
            
            console.log('🎯 Face highlighted:', {
                shapeId: shape.id,
                shapeType: shape.type,
                faceIndex: hit.faceIndex,
                faceCenter: faceCenter.toArray().map(v => v.toFixed(1)),
                faceNormal: faceNormal.toArray().map(v => v.toFixed(2)),
                faceArea: faceArea.toFixed(1),
                vertexCount: surfaceVertices.length
            });
            
            currentHighlight = {
                mesh: highlightMesh,
                faceIndex: hit.faceIndex,
                shapeId: shape.id
            };
            
            return currentHighlight;
        };

        /**
         * Raycaster ile yüzey tespiti
         */
        export const detectFaceAtMouse = (
            event: MouseEvent,
            camera: THREE.Camera,
            mesh: THREE.Mesh,
            canvas: HTMLCanvasElement
        ): THREE.Intersection | null => {
            const rect = canvas.getBoundingClientRect();
            const mouse = new THREE.Vector2();
            
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            const intersects = raycaster.intersectObject(mesh, false);
            
            if (intersects.length > 0) {
                const hit = intersects[0];
                console.log('🎯 Face detected:', {
                    faceIndex: hit.faceIndex,
                    distance: hit.distance.toFixed(2),
                    point: hit.point.toArray().map(v => v.toFixed(1)),
                    normal: hit.face?.normal.toArray().map(v => v.toFixed(2))
                });
                return hit;
            }
            
            return null;
        };

        /**
         * Mevcut highlight'ı al
         */
        export const getCurrentHighlight = (): FaceHighlight | null => {
            return currentHighlight;
        };

        // --- Three.js Scene Setup ---
        let scene: THREE.Scene, camera: THREE.PerspectiveCamera, renderer: THREE.WebGLRenderer, raycaster: THREE.Raycaster, mouse: THREE.Vector2;
        let shapes: Shape[] = []; 
        let highlightMesh: THREE.Mesh | null = null;
        let controlsDiv: HTMLElement, infoDiv: HTMLElement;

        // New global variables for node editing
        let nodeMeshes: THREE.Mesh[] = []; // Stores the visual sphere meshes for node points
        let activeNode: { mesh: THREE.Mesh; shape: Shape; pointIndex: number; offset: THREE.Vector3; dragPlane: THREE.Plane; } | null = null;
        let isDraggingNode = false;

        function init() {
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x333333); 

            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
            camera.position.set(0, 500, 1000);
            camera.lookAt(0, 0, 0);

            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);

            const ambientLight = new THREE.AmbientLight(0x404040, 2); 
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1); 
            directionalLight.position.set(200, 500, 300);
            scene.add(directionalLight);

            raycaster = new THREE.Raycaster();
            mouse = new THREE.Vector2();

            infoDiv = document.getElementById('info') as HTMLElement;
            controlsDiv = document.querySelector('.controls') as HTMLElement;

            addBox();
            addCylinder();
            addPolygon();

            window.addEventListener('resize', onWindowResize, false);
            window.addEventListener('click', onDocumentMouseDown, false);
            window.addEventListener('mousemove', onDocumentMouseMove, false); // Add mousemove listener
            window.addEventListener('mouseup', onDocumentMouseUp, false);     // Add mouseup listener

            document.getElementById('addBox')!.addEventListener('click', addBox);
            document.getElementById('addCylinder')!.addEventListener('click', addCylinder);
            document.getElementById('addPolygon')!.addEventListener('click', addPolygon);
        }

        // --- Node Editing Functions ---

        function createNodePoints(shape: Shape) {
            clearNodePoints(); // Clear existing nodes first

            if (shape.type === 'polygon3d' && shape.originalPoints && shape.mesh) {
                const nodeMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // Mavi düğüm noktası
                const nodeGeometry = new THREE.SphereGeometry(20, 16, 16); // Küçük küre

                const shapeWorldMatrix = shape.mesh.matrixWorld;

                // Son noktayı tekrar eden poligonlar için son noktayı atla
                const pointsToProcess = shape.originalPoints.length > 1 && shape.originalPoints[0].equals(shape.originalPoints[shape.originalPoints.length - 1])
                    ? shape.originalPoints.slice(0, -1)
                    : shape.originalPoints;

                pointsToProcess.forEach((point, index) => {
                    // Yerel noktayı dünya koordinatlarına dönüştür
                    const worldPoint = point.clone().applyMatrix4(shapeWorldMatrix);

                    const nodeMesh = new THREE.Mesh(nodeGeometry, nodeMaterial.clone());
                    nodeMesh.position.copy(worldPoint);
                    nodeMesh.userData = { isNode: true, shape: shape, pointIndex: index, originalColor: nodeMaterial.color.clone() }; // Veriyi sakla
                    scene.add(nodeMesh);
                    nodeMeshes.push(nodeMesh);
                });
                console.log(`✨ ${nodeMeshes.length} düğüm noktası oluşturuldu: ${shape.id}`);
            }
        }

        function clearNodePoints() {
            nodeMeshes.forEach(nodeMesh => {
                scene.remove(nodeMesh);
                nodeMesh.geometry.dispose();
                (nodeMesh.material as THREE.Material).dispose();
            });
            nodeMeshes = [];
            activeNode = null;
            isDraggingNode = false; // Sürükleme durumunu da sıfırla
            if (hoveredNode && hoveredNode.material) { // Hovered düğümü de sıfırla
                (hoveredNode.material as THREE.MeshBasicMaterial).color.copy(hoveredNode.userData.originalColor);
                hoveredNode = null;
                originalNodeColor = null;
            }
        }

        function updateShapeFromNodeDrag(node: typeof activeNode) {
            if (!node || !node.shape.originalPoints || !node.shape.mesh) return;

            const shape = node.shape;
            const pointIndex = node.pointIndex;
            const newWorldPosition = node.mesh.position;

            // Yeni dünya pozisyonunu şeklin yerel koordinatlarına dönüştür (XZ düzlemi için)
            const inverseShapeWorldMatrix = shape.mesh.matrixWorld.clone().invert();
            const newLocalPosition = newWorldPosition.clone().applyMatrix4(inverseShapeWorldMatrix);

            // originalPoints dizisini güncelle (sadece X ve Z için)
            shape.originalPoints[pointIndex].x = newLocalPosition.x;
            shape.originalPoints[pointIndex].z = newLocalPosition.z;

            // Eğer poligon kapalıysa (ilk ve son nokta aynıysa), son noktayı da güncelle
            if (shape.originalPoints.length > 1 && shape.originalPoints[0].equals(shape.originalPoints[shape.originalPoints.length - 1])) {
                if (pointIndex === 0) {
                    shape.originalPoints[shape.originalPoints.length - 1].copy(shape.originalPoints[0]);
                } else if (pointIndex === shape.originalPoints.length - 1) {
                    shape.originalPoints[0].copy(shape.originalPoints[shape.originalPoints.length - 1]);
                }
            }

            // Şeklin geometrisini yeniden oluştur
            shape.mesh.geometry.dispose(); // Eski geometriyi bellekten temizle
            const shape2D = new THREE.Shape(shape.originalPoints.map(p => new THREE.Vector2(p.x, p.z)));
            const extrudeSettings = {
                steps: 1,
                depth: shape.parameters.height || 100, // Mevcut yüksekliği kullan
                bevelEnabled: false
            };
            const newGeometry = new THREE.ExtrudeGeometry(shape2D, extrudeSettings);
            shape.mesh.geometry = newGeometry; // Yeni geometriyi ata
            
            // Highlight mesh'i yeni şekli yansıtacak şekilde güncelle
            if (currentHighlight && currentHighlight.shapeId === shape.id) {
                // Aynı yüzeyi tekrar vurgulayarak highlight mesh'i güncelle
                // Bu, yeni geometriye göre highlight'ın yeniden oluşturulmasını sağlar.
                const tempIntersection = {
                    point: newWorldPosition, // Sadece yüzeyde bir nokta
                    face: { normal: getFaceNormal(getFaceVertices(newGeometry, currentHighlight!.faceIndex)).applyQuaternion(shape.mesh.quaternion) }, // Dünya normali
                    faceIndex: currentHighlight!.faceIndex,
                    object: shape.mesh
                } as THREE.Intersection; 

                highlightFace(scene, tempIntersection, shape, 0xFFA500, 0.6);
            }

            // Düğüm noktalarını da yeni şekle göre yeniden oluştur
            createNodePoints(shape);
            console.log(`✅ Şekil güncellendi: ${shape.id}`);
        }

        // --- Modified Event Handlers ---

        let hoveredNode: THREE.Mesh | null = null;
        let originalNodeColor: THREE.Color | null = null;

        function onDocumentMouseMove(event: MouseEvent) {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            if (isDraggingNode && activeNode) {
                raycaster.setFromCamera(mouse, camera);
                const intersectionPoint = new THREE.Vector3();
                // Fareyi sürükleme düzlemine yansıt
                raycaster.ray.intersectPlane(activeNode.dragPlane, intersectionPoint);
                
                // Düğüm mesh'inin pozisyonunu güncelle
                activeNode.mesh.position.copy(intersectionPoint.sub(activeNode.offset));
            } else {
                // Düğüm noktaları için hover efekti
                raycaster.setFromCamera(mouse, camera);
                const intersectsNodes = raycaster.intersectObjects(nodeMeshes);

                if (intersectsNodes.length > 0) {
                    const newHoveredNode = intersectsNodes[0].object as THREE.Mesh;
                    if (newHoveredNode !== hoveredNode) {
                        // Önceki hovered düğümün rengini geri yükle
                        if (hoveredNode && hoveredNode.userData.originalColor) {
                            (hoveredNode.material as THREE.MeshBasicMaterial).color.copy(hoveredNode.userData.originalColor);
                        }
                        // Yeni hovered düğümün rengini kırmızı yap
                        hoveredNode = newHoveredNode;
                        hoveredNode.userData.originalColor = (hoveredNode.material as THREE.MeshBasicMaterial).color.clone(); // Orijinal rengi sakla
                        (hoveredNode.material as THREE.MeshBasicMaterial).color.set(0xff0000); // Kırmızı
                    }
                } else {
                    // Hiçbir düğüm hovered değil
                    if (hoveredNode && hoveredNode.userData.originalColor) {
                        (hoveredNode.material as THREE.MeshBasicMaterial).color.copy(hoveredNode.userData.originalColor);
                        hoveredNode = null;
                    }
                }
            }
        }

        function onDocumentMouseDown(event: MouseEvent) {
            // Sadece sol fare tuşu basıldığında devam et
            if (event.button !== 0) return; 

            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);

            // Önce, bir düğüm noktasına tıklanıp tıklanmadığını kontrol et
            const intersectsNodes = raycaster.intersectObjects(nodeMeshes);
            if (intersectsNodes.length > 0) {
                const clickedNodeMesh = intersectsNodes[0].object as THREE.Mesh;
                const nodeData = clickedNodeMesh.userData;

                if (nodeData.isNode) {
                    isDraggingNode = true;
                    
                    // Tıklama noktasından düğüm merkezine olan ofseti hesapla
                    const intersectionPoint = intersectsNodes[0].point;
                    const offset = new THREE.Vector3().subVectors(intersectionPoint, clickedNodeMesh.position);

                    // Düğüm için bir sürükleme düzlemi tanımla (örn. poligon yüzeyinin düzlemi)
                    // Poligonlar için originalPoints XZ düzlemindedir, bu yüzden Y=0 düzlemi iyi bir seçimdir.
                    // Bu düzlemi dünya koordinatlarına dönüştürmemiz gerekiyor.
                    const shape = nodeData.shape;
                    // Şeklin yerel XZ düzlemini dünya koordinatlarına dönüştür
                    const localPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); // Y=0 düzlemi
                    const worldPlane = localPlane.clone().applyMatrix4(shape.mesh!.matrixWorld);

                    activeNode = {
                        mesh: clickedNodeMesh,
                        shape: shape,
                        pointIndex: nodeData.pointIndex,
                        offset: offset,
                        dragPlane: worldPlane // Sürükleme düzlemini sakla
                    };
                    console.log(`✨ Düğüm ${nodeData.pointIndex} (${shape.id}) sürüklenmeye başlandı.`);
                    event.preventDefault(); // Varsayılan sürükleme davranışını engelle
                    return; // Bir düğüm sürükleniyorsa, şekil tıklamasını işleme
                }
            }

            // Eğer bir düğüm tıklanmadıysa, şekil vurgulama işlemine devam et
            const intersectsShapes = raycaster.intersectObjects(scene.children.filter(obj => obj instanceof THREE.Mesh));

            if (intersectsShapes.length > 0) {
                const firstIntersection = intersectsShapes[0];
                const intersectedMesh = firstIntersection.object as THREE.Mesh; 
                
                const targetShape = shapes.find(s => s.mesh === intersectedMesh);

                if (targetShape) {
                    targetShape.quaternion = intersectedMesh.quaternion.clone();

                    // Eğer farklı bir şekil tıklanırsa, önceki düğüm noktalarını temizle
                    if (currentHighlight && currentHighlight.shapeId !== targetShape.id) {
                        clearNodePoints();
                    }

                    const highlightResult = highlightFace(
                        scene,
                        firstIntersection, 
                        targetShape,
                        0xFFA500, 
                        0.6       
                    );

                    if (highlightResult) {
                        console.log(`✅ Yüzey vurgulandı: ${targetShape.type}, Yüzey Index: ${highlightResult.faceIndex}`);
                        updateInfoDiv(highlightResult.faceIndex, firstIntersection.point, targetShape.type);
                        
                        // Vurgulanan şekil bir poligon ise düğüm noktalarını oluştur
                        if (targetShape.type === 'polygon3d') {
                            createNodePoints(targetShape);
                        } else {
                            clearNodePoints(); // Poligon değilse düğüm noktalarını temizle
                        }

                    } else {
                        console.log('Yüzey vurgulanamadı.');
                        removeHighlight();
                        clearNodePoints();
                    }
                } else {
                    console.warn('Tıklanan mesh, bilinen bir Shape objesine ait değil.');
                    removeHighlight();
                    clearNodePoints();
                }
            } else {
                console.log('Hiçbir nesneye tıklanmadı, vurgulama kaldırılıyor.');
                removeHighlight();
                clearNodePoints();
            }
        }

        function onDocumentMouseUp(event: MouseEvent) {
            if (isDraggingNode && activeNode) {
                isDraggingNode = false;
                console.log(`✨ Düğüm ${activeNode.pointIndex} (${activeNode.shape.id}) sürüklenmesi durduruldu.`);
                updateShapeFromNodeDrag(activeNode); // Sürükleme bittikten sonra şekil geometrisini güncelle
                activeNode = null;
            }
            // Fare yukarı kalktığında, hover durumunu da kontrol et ve sıfırla
            if (hoveredNode && hoveredNode.userData.originalColor) {
                (hoveredNode.material as THREE.MeshBasicMaterial).color.copy(hoveredNode.userData.originalColor);
                hoveredNode = null;
            }
        }

        // --- Shape Creation Functions ---

        function addBox() {
            const width = 200, height = 200, depth = 200;
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff });
            const mesh = new THREE.Mesh(geometry, material);
            
            mesh.position.set(
                Math.random() * 800 - 400,
                Math.random() * 200, 
                Math.random() * 800 - 400
            );
            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            scene.add(mesh);

            const shape: Shape = {
                type: 'box',
                parameters: { width, height, depth },
                scale: [1, 1, 1],
                position: [mesh.position.x, mesh.position.y, mesh.position.z],
                rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
                quaternion: mesh.quaternion.clone(), 
                geometry: mesh.geometry,
                mesh: mesh,
                id: `box-${Math.random().toString(36).substr(2, 9)}` 
            };
            shapes.push(shape);
            console.log("Kutu eklendi:", shape);
        }

        function addCylinder() {
            const radius = 100, height = 300;
            const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
            const material = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.set(
                Math.random() * 800 - 400,
                Math.random() * 200,
                Math.random() * 800 - 400
            );
            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            scene.add(mesh);

            const shape: Shape = {
                type: 'cylinder',
                parameters: { radius, height },
                scale: [1, 1, 1],
                position: [mesh.position.x, mesh.position.y, mesh.position.z],
                rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
                quaternion: mesh.quaternion.clone(),
                geometry: mesh.geometry,
                mesh: mesh,
                id: `cylinder-${Math.random().toString(36).substr(2, 9)}` 
            };
            shapes.push(shape);
            console.log("Silindir eklendi:", shape);
        }

        function addPolygon() {
            const outerRadius = 150;
            const innerRadius = 75;
            const numPoints = 5;
            const points: THREE.Vector3[] = [];

            for (let i = 0; i < numPoints * 2; i++) {
                const radius = i % 2 === 0 ? outerRadius : innerRadius;
                const angle = (i / (numPoints * 2)) * Math.PI * 2;
                points.push(new THREE.Vector3(
                    Math.cos(angle) * radius,
                    0, 
                    Math.sin(angle) * radius
                ));
            }
            if (!points[points.length - 1].equals(points[0])) {
                points.push(points[0].clone());
            }

            const shape2D = new THREE.Shape(points.map(p => new THREE.Vector2(p.x, p.z)));
            const extrudeSettings = {
                steps: 1,
                depth: 100, 
                bevelEnabled: false
            };
            const geometry = new THREE.ExtrudeGeometry(shape2D, extrudeSettings);
            const material = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff });
            const mesh = new THREE.Mesh(geometry, material);

            mesh.position.set(
                Math.random() * 800 - 400,
                Math.random() * 200,
                Math.random() * 800 - 400
            );
            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );
            scene.add(mesh);

            const shape: Shape = {
                type: 'polygon3d', 
                parameters: { height: extrudeSettings.depth },
                scale: [1, 1, 1],
                position: [mesh.position.x, mesh.position.y, mesh.position.z],
                rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
                quaternion: mesh.quaternion.clone(),
                originalPoints: points, 
                geometry: mesh.geometry,
                mesh: mesh,
                id: `polygon-${Math.random().toString(36).substr(2, 9)}` 
            };
            shapes.push(shape);
            console.log("Poligon eklendi:", shape);
        }

        // --- Animation Loop ---
        function animate() {
            requestAnimationFrame(animate);
            shapes.forEach(shape => {
                if (shape.mesh) {
                    shape.mesh.rotation.y += 0.005;
                    shape.mesh.rotation.x += 0.002;
                    shape.quaternion = shape.mesh.quaternion.clone();
                }
            });
            renderer.render(scene, camera);
        }

        // --- Start the application ---
        window.onload = function() {
            init();
            animate();
        };

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }
    </script>
</body>
</html>
