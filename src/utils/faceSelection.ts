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
    
    // İlk olarak tüm face'leri tara ve aynı yüzeyde olanları bul
    const totalFaces = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
    const candidateFaces: number[] = [];
    
    // Çok gevşek toleranslar - karmaşık şekiller için
    const NORMAL_TOLERANCE = THREE.MathUtils.degToRad(15); // 15° tolerans
    const DISTANCE_TOLERANCE = 10.0; // 10mm düzlem mesafesi toleransı

    console.log(`🎯 Relaxed Tolerances: Normal=${(NORMAL_TOLERANCE * 180 / Math.PI).toFixed(1)}°, Distance=${DISTANCE_TOLERANCE}mm`);

    // Başlangıç düzlemini hesapla (point-normal form)
    const planeNormal = startNormal.clone();
    const planePoint = startCenter.clone();
    const planeD = -planeNormal.dot(planePoint);

    // 1. AŞAMA: Tüm face'leri tara ve aynı düzlemde olanları bul
    console.log(`🎯 Phase 1: Scanning all ${totalFaces} faces for coplanar candidates`);
    
    for (let i = 0; i < totalFaces; i++) {
        if (i === startFaceIndex) {
            candidateFaces.push(i);
            continue;
        }
        
        const faceVertices = getFaceVertices(geometry, i);
        if (faceVertices.length === 0) continue;
        
        const faceNormal = getFaceNormal(faceVertices).normalize();
        const faceCenter = getFaceCenter(faceVertices);
        
        // Normal kontrolü - iki yönü de kabul et
        const normalAngle = Math.min(
            faceNormal.angleTo(startNormal),
            faceNormal.angleTo(startNormal.clone().negate())
        );
        
        // Düzlem mesafesi kontrolü
        const distanceToPlane = Math.abs(planeNormal.dot(faceCenter) + planeD);
        
        if (normalAngle < NORMAL_TOLERANCE && distanceToPlane < DISTANCE_TOLERANCE) {
            candidateFaces.push(i);
        }
    }
    
    console.log(`🎯 Phase 1 complete: Found ${candidateFaces.length} coplanar faces`);
    
    // 2. AŞAMA: Flood-fill ile bağlı olanları seç
    const queue = [startFaceIndex];
    
    while (queue.length > 0) {
        const faceIndex = queue.shift()!;
        if (visited.has(faceIndex)) continue;
        visited.add(faceIndex);
        surfaceFaces.push(faceIndex);

        // Bu face'in komşularını bul
        const neighbors = getNeighborFaces(geometry, faceIndex);
        
        for (const neighborIndex of neighbors) {
            if (visited.has(neighborIndex) || !candidateFaces.includes(neighborIndex)) continue;
            
            // Komşu aynı düzlemde ise queue'ya ekle
            queue.push(neighborIndex);
        }
    }
    
    console.log(`🎯 Phase 2 complete: Connected ${surfaceFaces.length} faces via flood-fill`);
    
    // 3. AŞAMA: Kalan coplanar face'leri de ekle (izole alanlar için)
    let isolatedCount = 0;
    for (const candidateIndex of candidateFaces) {
        if (!surfaceFaces.includes(candidateIndex)) {
            surfaceFaces.push(candidateIndex);
            isolatedCount++;
        }
    }
    
    if (isolatedCount > 0) {
        console.log(`🎯 Phase 3: Added ${isolatedCount} isolated coplanar faces`);
    }
    
    // 4. AŞAMA: Yakın komşu face'leri de kontrol et (gap'ler için)
    const nearbyFaces: number[] = [];
    const NEARBY_TOLERANCE = DISTANCE_TOLERANCE * 2; // 2x mesafe toleransı
    
    for (let i = 0; i < totalFaces; i++) {
        if (surfaceFaces.includes(i)) continue;
        
        const faceVertices = getFaceVertices(geometry, i);
        if (faceVertices.length === 0) continue;
        
        const faceCenter = getFaceCenter(faceVertices);
        
        // En yakın surface face'e mesafeyi kontrol et
        let minDistance = Infinity;
        for (const surfaceFaceIndex of surfaceFaces) {
            const surfaceVertices = getFaceVertices(geometry, surfaceFaceIndex);
            const surfaceCenter = getFaceCenter(surfaceVertices);
            const distance = faceCenter.distanceTo(surfaceCenter);
            minDistance = Math.min(minDistance, distance);
        }
        
        if (minDistance < NEARBY_TOLERANCE) {
            const faceNormal = getFaceNormal(faceVertices).normalize();
            const normalAngle = Math.min(
                faceNormal.angleTo(startNormal),
                faceNormal.angleTo(startNormal.clone().negate())
            );
            
            if (normalAngle < NORMAL_TOLERANCE * 1.5) { // Biraz daha gevşek normal toleransı
                nearbyFaces.push(i);
            }
        }
    }
    
    if (nearbyFaces.length > 0) {
        surfaceFaces.push(...nearbyFaces);
        console.log(`🎯 Phase 4: Added ${nearbyFaces.length} nearby faces to fill gaps`);
    }
    
    // 5. AŞAMA: Vertex tabanlı genişletme (son çare)
    const expandedFaces: number[] = [];
    const surfaceVertexSet = new Set<string>();
    
    // Mevcut surface'deki tüm vertex'leri topla
    surfaceFaces.forEach(faceIndex => {
        const vertices = getFaceVertices(geometry, faceIndex);
        vertices.forEach(vertex => {
            const key = `${vertex.x.toFixed(2)},${vertex.y.toFixed(2)},${vertex.z.toFixed(2)}`;
            surfaceVertexSet.add(key);
        });
    });
    
    // Diğer face'lerde bu vertex'leri paylaşanları bul
    for (let i = 0; i < totalFaces; i++) {
        if (surfaceFaces.includes(i)) continue;
        
        const faceVertices = getFaceVertices(geometry, i);
        if (faceVertices.length === 0) continue;
        
        let sharedVertexCount = 0;
        for (const vertex of faceVertices) {
            const key = `${vertex.x.toFixed(2)},${vertex.y.toFixed(2)},${vertex.z.toFixed(2)}`;
            if (surfaceVertexSet.has(key)) {
                sharedVertexCount++;
            }
        }
        
        // En az 2 vertex paylaşıyorsa ve normal uygunsa ekle
        if (sharedVertexCount >= 2) {
            const faceNormal = getFaceNormal(faceVertices).normalize();
            const normalAngle = Math.min(
                faceNormal.angleTo(startNormal),
                faceNormal.angleTo(startNormal.clone().negate())
            );
            
            if (normalAngle < NORMAL_TOLERANCE * 2) { // Çok gevşek tolerans
                expandedFaces.push(i);
            }
        }
    }
    
    if (expandedFaces.length > 0) {
        surfaceFaces.push(...expandedFaces);
        console.log(`🎯 Phase 5: Added ${expandedFaces.length} vertex-shared faces`);
    }
    
    console.log(`🎯 Multi-phase surface detection complete: ${surfaceFaces.length} total faces found`);
    
    // Tüm surface face'lerinin benzersiz vertex'lerini topla
    const allVertices: THREE.Vector3[] = [];
    const uniqueVerticesMap = new Map<string, THREE.Vector3>();
    
    surfaceFaces.forEach(faceIndex => {
        const vertices = getFaceVertices(geometry, faceIndex);
        vertices.forEach(vertex => {
            // Daha gevşek vertex precision - karmaşık şekiller için
            const key = `${vertex.x.toFixed(1)},${vertex.y.toFixed(1)},${vertex.z.toFixed(1)}`;
            if (!uniqueVerticesMap.has(key)) {
                uniqueVerticesMap.set(key, vertex);
                allVertices.push(vertex);
            }
        });
    });
    
    console.log(`📊 Final result: ${surfaceFaces.length} triangles, ${allVertices.length} unique vertices`);
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