import * as THREE from 'three';

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
 * Komşu face'leri bul (epsilon-based vertex karşılaştırması)
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

        // Kaç ortak vertex var? (epsilon-based)
        let sharedCount = 0;
        for (const v1 of thisVerts) {
            for (const v2 of otherVerts) {
                if (verticesEqual(v1, v2)) {
                    sharedCount++;
                    break; // Aynı vertex'i birden fazla kez saymamak için
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
    
    // Gevşetilmiş toleranslar
    const NORMAL_TOLERANCE = THREE.MathUtils.degToRad(5); // 5° tolerans
    const DISTANCE_TOLERANCE = 3.0; // 3mm düzlem mesafesi toleransı

    console.log(`🎯 Tolerances: Normal=${(NORMAL_TOLERANCE * 180 / Math.PI).toFixed(1)}°, Distance=${DISTANCE_TOLERANCE}mm`);

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
            
            // Hem normal hem düzlem mesafesi uygunsa ekle
            if (normalAngle < NORMAL_TOLERANCE && distanceToPlane < DISTANCE_TOLERANCE) {
                queue.push(neighborIndex);
            } else {
                const reason = normalAngle >= NORMAL_TOLERANCE ? 
                    `normal (${(normalAngle * 180 / Math.PI).toFixed(1)}° > ${(NORMAL_TOLERANCE * 180 / Math.PI).toFixed(1)}°)` : 
                    `distance (${distanceToPlane.toFixed(1)}mm > ${DISTANCE_TOLERANCE}mm)`;
                console.log(`❌ Rejected neighbor ${neighborIndex}: ${reason}`);
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
        for (let i = 1; i < worldVertices.length - 1; i++) {
            indices.push(0, i, i + 1);
        }
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

/**
 * 🎯 ENHANCED: Aynı konumda sıralı yüzey döngüsü - Her tıklamada arkadaki yüzeyi göster
 */
export const cycleFaceUnderMouse = (
    event: MouseEvent,
    camera: THREE.Camera,
    mesh: THREE.Mesh,
    canvas: HTMLCanvasElement,
    scene: THREE.Scene,
    shape: Shape,
    color: number = 0xff6b35,
    opacity: number = 0.6
): FaceHighlight | null => {
    console.log('🎯 Face cycling started');

    const mouseNDC = _mouseToNDC(event, canvas);
    const raycaster = new THREE.Raycaster();
    raycaster.params.Points!.threshold = 0.1;
    raycaster.params.Line!.threshold = 0.1;
    raycaster.setFromCamera(mouseNDC, camera);

    // Mouse hareket etmiş mi veya mesh değişmiş mi kontrol et
    const moved = !_lastMouseNDC || mouseNDC.distanceTo(_lastMouseNDC) > 1e-4;
    const meshId = (mesh as any).id ?? 0;
    const meshChanged = _lastMeshId !== null && _lastMeshId !== meshId;

    // Yeni konum veya mesh değişikliği varsa hit stack'i yenile
    if (moved || meshChanged || _hitStack.length === 0) {
        console.log('🎯 Rebuilding hit stack - mouse moved or mesh changed');
        
        // Tüm intersectionları al (recursive = false, sadece bu mesh)
        const allHits = raycaster.intersectObject(mesh, false);
        
        // Sadece face index'i olan ve benzersiz face'leri tut
        const seen = new Set<number>();
        _hitStack = allHits.filter(h => {
            if (h.faceIndex === undefined) return false;
            if (seen.has(h.faceIndex)) return false;
            seen.add(h.faceIndex);
            return true;
        });
        
        // Mesafeye göre sırala (yakından uzağa)
        _hitStack.sort((a, b) => a.distance - b.distance);
        
        _hitIndex = -1;
        _lastMouseNDC = mouseNDC.clone();
        _lastMeshId = meshId;
        
        console.log(`🎯 Hit stack rebuilt: ${_hitStack.length} unique faces found`);
    }

    if (_hitStack.length === 0) {
        console.log('🎯 No faces under cursor');
        return null;
    }

    // Index'i ilerlet (döngü şeklinde)
    _hitIndex = (_hitIndex + 1) % _hitStack.length;
    const hit = _hitStack[_hitIndex];
}

