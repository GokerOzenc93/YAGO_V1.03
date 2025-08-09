<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Three.js Yüzey Vurgulama</title>
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
                            // Aynı vertex'i birden fazla kez saymamak için break
                            // Ancak, bir üçgenin iki vertex'i diğer üçgenin aynı vertex'i olabilir.
                            // Bu yüzden, daha doğru bir kontrol için, her v1 için v2'yi bulduktan sonra
                            // o v2'yi diğer v1'ler için tekrar kontrol etmemek gerekir.
                            // Basitçe, sharedCount'ı artırıp devam edebiliriz.
                            // Eğer sharedCount 2'ye ulaşırsa, ortak bir kenar bulmuşuz demektir.
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

                // console.log(`✅ Processing face ${faceIndex}`); // Çok fazla log olabilir

                // Bu face'in komşularını bul ve kontrol et
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
                        neighborNormal.angleTo(startNormal.clone().negate()) // Ters normali de kontrol et
                    );
                    
                    // 2. Düzlem mesafesi kontrolü
                    const distanceToPlane = Math.abs(planeNormal.dot(neighborCenter) + planeD);
                    
                    // console.log(`🔍 Neighbor ${neighborIndex}: angle=${(normalAngle * 180 / Math.PI).toFixed(1)}°, distance=${distanceToPlane.toFixed(1)}mm`); // Çok fazla log olabilir
                    
                    // Hem normal hem düzlem mesafesi uygunsa ekle
                    if (normalAngle < NORMAL_TOLERANCE && distanceToPlane < DISTANCE_TOLERANCE) {
                        queue.push(neighborIndex);
                        // console.log(`➕ Added neighbor ${neighborIndex} to queue (angle: ${(normalAngle * 180 / Math.PI).toFixed(1)}°, dist: ${distanceToPlane.toFixed(1)}mm)`); // Çok fazla log olabilir
                    } else {
                        // const reason = normalAngle >= NORMAL_TOLERANCE ? `normal (${(normalAngle * 180 / Math.PI).toFixed(1)}° > ${(NORMAL_TOLERANCE * 180 / Math.PI).toFixed(1)}°)` : `distance (${distanceToPlane.toFixed(1)}mm > ${DISTANCE_TOLERANCE}mm)`;
                        // console.log(`❌ Rejected neighbor ${neighborIndex}: ${reason}`); // Çok fazla log olabilir
                    }
                }
            }
            console.log(`🎯 Flood-fill complete: ${surfaceFaces.length} connected faces found`);
            
            // Tüm surface face'lerinin benzersiz vertex'lerini topla
            const allVertices: THREE.Vector3[] = [];
            // Vertex'leri string anahtarlarla saklayarak benzersizliği sağla
            const uniqueVerticesMap = new Map<string, THREE.Vector3>(); 
            
            surfaceFaces.forEach(faceIndex => {
                const vertices = getFaceVertices(geometry, faceIndex);
                vertices.forEach(vertex => {
                    // Vertex koordinatlarını hassas bir string anahtara dönüştür
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
                // Basit bir triangulation yöntemi: İlk vertex'i pivot alarak diğerlerini üçgenle
                // Bu, dışbükey (convex) poligonlar için iyi çalışır.
                for (let i = 1; i < worldVertices.length - 1; i++) {
                    indices.push(0, i, i + 1);
                }
                // Daha karmaşık (içbükey/concave) poligonlar için bu basit yöntem yetersiz kalabilir.
                // Gerçek bir Delaunay veya Ear Clipping algoritması gerekebilir.
                // Ancak çoğu düzlemsel yüzey (kutu yüzeyi, silindir kapağı) için bu yeterli olacaktır.
            }
            
            geometry.setIndex(indices);
            geometry.computeVertexNormals();
            
            // Daha belirgin highlight material
            const material = new THREE.MeshBasicMaterial({
                color: color,
                transparent: true,
                opacity: Math.min(opacity + 0.2, 0.9), // Daha görünür
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
            shape: Shape, // Shape objesi artık id içerecek
            color: number = 0xff6b35,
            opacity: number = 0.6
        ): FaceHighlight | null => {
            // Önce eski highlight'ı temizle
            clearFaceHighlight(scene);
            
            if (!hit.face || hit.faceIndex === undefined) {
                console.warn('No face data in intersection');
                return null;
            }
            
            const mesh = hit.object as THREE.Mesh;
            const geometry = mesh.geometry as THREE.BufferGeometry;
            
            console.log(`🎯 Highlighting face ${hit.faceIndex} on ${shape.type} (${shape.id})`);
            
            // Tüm yüzeyi bul (komşu üçgenleri dahil et)
            const fullSurfaceVertices = getFullSurfaceVertices(geometry, hit.faceIndex);
            
            console.log(`📊 Full surface vertices: ${fullSurfaceVertices.length}`);
            
            // Eğer tam yüzey bulunamadıysa (örneğin sadece tek bir üçgen varsa)
            // veya flood-fill başarısız olursa, yine de bir şey göstermek için 
            // başlangıç üçgeninin vertexlerini kullanabiliriz.
            const surfaceVertices = fullSurfaceVertices.length >= 3 ? fullSurfaceVertices : getFaceVertices(geometry, hit.faceIndex);
            
            if (surfaceVertices.length < 3) {
                console.warn('Not enough vertices to create a highlight mesh.');
                return null;
            }

            console.log(`✅ Using ${surfaceVertices.length} vertices for highlight`);
            
            // World matrix'i al
            const worldMatrix = mesh.matrixWorld.clone();
            
            // Highlight mesh'i oluştur
            const highlightMesh = createFaceHighlight(surfaceVertices, worldMatrix, color, opacity);
            
            // Sahneye ekle
            scene.add(highlightMesh);
            
            // Face bilgilerini logla
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
            
            // Mouse koordinatlarını normalize et
            mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
            mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
            
            // Raycaster oluştur
            const raycaster = new THREE.Raycaster();
            raycaster.setFromCamera(mouse, camera);
            
            // Intersection test
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
        let scene, camera, renderer, raycaster, mouse;
        let shapes: Shape[] = []; 
        let highlightMesh: THREE.Mesh | null = null;
        let controlsDiv, infoDiv;

        function init() {
            // Sahneyi oluştur
            scene = new THREE.Scene();
            scene.background = new THREE.Color(0x333333); 

            // Kamerayı oluştur
            camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 5000);
            camera.position.set(0, 500, 1000);
            camera.lookAt(0, 0, 0);

            // Renderer'ı oluştur
            renderer = new THREE.WebGLRenderer({ antialias: true });
            renderer.setSize(window.innerWidth, window.innerHeight);
            document.body.appendChild(renderer.domElement);

            // Işık ekle
            const ambientLight = new THREE.AmbientLight(0x404040, 2); 
            scene.add(ambientLight);
            const directionalLight = new THREE.DirectionalLight(0xffffff, 1); 
            directionalLight.position.set(200, 500, 300);
            scene.add(directionalLight);

            // Raycaster ve Mouse vektörünü oluştur
            raycaster = new THREE.Raycaster();
            mouse = new THREE.Vector2();

            // Bilgi ve kontrol div'lerini al
            infoDiv = document.getElementById('info');
            controlsDiv = document.querySelector('.controls');

            // İlk şekilleri ekle
            addBox();
            addCylinder();
            addPolygon();

            // Pencere boyutu değiştiğinde
            window.addEventListener('resize', onWindowResize, false);
            // Fare tıklama olayını dinle
            window.addEventListener('click', onDocumentMouseDown, false);

            // Buton olay dinleyicileri
            document.getElementById('addBox').addEventListener('click', addBox);
            document.getElementById('addCylinder').addEventListener('click', addCylinder);
            document.getElementById('addPolygon').addEventListener('click', addPolygon);
        }

        // --- Shape Creation Functions ---

        function addBox() {
            const width = 200, height = 200, depth = 200;
            const geometry = new THREE.BoxGeometry(width, height, depth);
            const material = new THREE.MeshPhongMaterial({ color: Math.random() * 0xffffff });
            const mesh = new THREE.Mesh(geometry, material);
            
            // Rastgele bir konum ver
            mesh.position.set(
                Math.random() * 800 - 400,
                Math.random() * 200, 
                Math.random() * 800 - 400
            );
            // Rastgele rotasyon
            mesh.rotation.set(
                Math.random() * Math.PI,
                Math.random() * Math.PI,
                Math.random() * Math.PI
            );

            scene.add(mesh);

            // Shape verisini oluştur ve sakla
            const shape: Shape = {
                type: 'box',
                parameters: { width, height, depth },
                scale: [1, 1, 1],
                position: [mesh.position.x, mesh.position.y, mesh.position.z],
                rotation: [mesh.rotation.x, mesh.rotation.y, mesh.rotation.z],
                quaternion: mesh.quaternion.clone(), 
                geometry: mesh.geometry,
                mesh: mesh,
                id: `box-${Math.random().toString(36).substr(2, 9)}` // Benzersiz ID ekle
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
                id: `cylinder-${Math.random().toString(36).substr(2, 9)}` // Benzersiz ID ekle
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
                id: `polygon-${Math.random().toString(36).substr(2, 9)}` // Benzersiz ID ekle
            };
            shapes.push(shape);
            console.log("Poligon eklendi:", shape);
        }

        // --- Event Handlers ---

        function onWindowResize() {
            camera.aspect = window.innerWidth / window.innerHeight;
            camera.updateProjectionMatrix();
            renderer.setSize(window.innerWidth, window.innerHeight);
        }

        function onDocumentMouseDown(event: MouseEvent) {
            mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
            mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

            raycaster.setFromCamera(mouse, camera);

            const intersects = raycaster.intersectObjects(scene.children.filter(obj => obj instanceof THREE.Mesh));

            if (intersects.length > 0) {
                const firstIntersection = intersects[0];
                const intersectedMesh = firstIntersection.object as THREE.Mesh; 
                
                const targetShape = shapes.find(s => s.mesh === intersectedMesh);

                if (targetShape) {
                    targetShape.quaternion = intersectedMesh.quaternion.clone();

                    // highlightFace fonksiyonunu doğrudan çağırıyoruz,
                    // çünkü flood-fill mantığı artık bu fonksiyonun içinde.
                    const highlightResult = highlightFace(
                        scene,
                        firstIntersection, // Raycast intersection objesini doğrudan gönder
                        targetShape,
                        0xFFA500, // Turuncu renk
                        0.6       // Opaklık
                    );

                    if (highlightResult) {
                        console.log(`✅ Yüzey vurgulandı: ${targetShape.type}, Yüzey Index: ${highlightResult.faceIndex}`);
                        updateInfoDiv(highlightResult.faceIndex, firstIntersection.point, targetShape.type);
                    } else {
                        console.log('Yüzey vurgulanamadı.');
                        removeHighlight();
                    }
                } else {
                    console.warn('Tıklanan mesh, bilinen bir Shape objesine ait değil.');
                    removeHighlight();
                }
            } else {
                console.log('Hiçbir nesneye tıklanmadı, vurgulama kaldırılıyor.');
                removeHighlight();
            }
        }

        function removeHighlight() {
            if (currentHighlight) {
                scene.remove(currentHighlight.mesh);
                currentHighlight.mesh.geometry.dispose();
                (currentHighlight.mesh.material as THREE.Material).dispose();
                currentHighlight = null;
            }
            updateInfoDiv(null, null, null);
        }

        function updateInfoDiv(faceIndex: number | null, point: THREE.Vector3 | null, shapeType: string | null) {
            if (infoDiv) {
                if (faceIndex !== null && point !== null && shapeType !== null) {
                    infoDiv.innerHTML = `
                        Tıklanan Şekil Tipi: <b>${shapeType}</b><br>
                        Tıklanan Yüzey Index: <b>${faceIndex}</b><br>
                        Tıklanan Nokta (Dünya): <b>(${point.x.toFixed(2)}, ${point.y.toFixed(2)}, ${point.z.toFixed(2)})</b>
                    `;
                } else {
                    infoDiv.innerHTML = `
                        Tıklanan Yüzey: Yok<br>
                        Tıklanan Nokta (Dünya): Yok
                    `;
                }
            }
        }

        // --- Animation Loop ---
        function animate() {
            requestAnimationFrame(animate);
            // Sahnedeki her mesh'i hafifçe döndürerek hareketi simüle et
            shapes.forEach(shape => {
                if (shape.mesh) {
                    shape.mesh.rotation.y += 0.005;
                    shape.mesh.rotation.x += 0.002;
                    // Döndürme sonrası quaternion'ı güncel tut
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
    </script>
</body>
</html>
