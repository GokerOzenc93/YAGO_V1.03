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

/** ---------- Robust Coplanar Face Region Utilities (added) ---------- **/

/**
 * Ensure geometry is indexed; returns the same geometry (possibly converted).
 */
const ensureIndexedGeometry = (geom: THREE.BufferGeometry): THREE.BufferGeometry => {
    if (!geom.index) {
        geom = geom.toNonIndexed(); // ensure predictable indexing first
        geom = geom.toNonIndexed(); // stay non-indexed, we'll create an index below
        // Build an explicit index so we can get triangle adjacency
        const pos = geom.getAttribute('position') as THREE.BufferAttribute;
        const indices = [];
        for (let i = 0; i < pos.count; i++) indices.push(i);
        geom.setIndex(indices);
    }
    return geom;
};

/**
 * Build adjacency: for each triangle, find neighboring triangles that share an edge.
 */
const buildTriangleNeighbors = (geom: THREE.BufferGeometry): Map<number, number[]> => {
    const index = geom.index!;
    const neighbors = new Map<number, number[]>();
    const edgeMap = new Map<string, number>(); // key = "min_max", value = triIndex

    const idxArray = index.array as ArrayLike<number>;
    const triCount = Math.floor(idxArray.length / 3);
    for (let t = 0; t < triCount; t++) {
        const a = idxArray[t*3], b = idxArray[t*3+1], c = idxArray[t*3+2];
        const edges: [number,number][] = [[a,b],[b,c],[c,a]];
        for (const [u,v] of edges) {
            const key = u < v ? `${u}_${v}` : `${v}_${u}`;
            if (edgeMap.has(key)) {
                const other = edgeMap.get(key)!;
                if (!neighbors.has(t)) neighbors.set(t, []);
                if (!neighbors.has(other)) neighbors.set(other, []);
                neighbors.get(t)!.push(other);
                neighbors.get(other)!.push(t);
            } else {
                edgeMap.set(key, t);
            }
        }
    }
    return neighbors;
};

/**
 * Get triangle vertices in WORLD space
 */
const getTriangleVerticesWorld = (mesh: THREE.Mesh, triIndex: number): [THREE.Vector3, THREE.Vector3, THREE.Vector3] => {
    const geom = mesh.geometry as THREE.BufferGeometry;
    const index = geom.index!;
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const ia = index.getX(triIndex*3), ib = index.getX(triIndex*3+1), ic = index.getX(triIndex*3+2);
    const a = new THREE.Vector3().fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld);
    const b = new THREE.Vector3().fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld);
    const c = new THREE.Vector3().fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld);
    return [a,b,c];
};

/**
 * Compute normalized face normal in WORLD space for a given triangle.
 */
const getTriangleNormalWorld = (mesh: THREE.Mesh, triIndex: number): THREE.Vector3 => {
    const [a,b,c] = getTriangleVerticesWorld(mesh, triIndex);
    const n = new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
    return n;
};

/**
 * BFS to collect all coplanar triangles connected to the seed triangle the user clicked.
 * Uses angle tolerance (degrees) and plane distance epsilon (in world units).
 */
const collectCoplanarRegion = (
    mesh: THREE.Mesh,
    seedTri: number,
    angleToleranceDeg: number = 2,
    planeEpsilon: number = 1e-4
) => {
    let geom = mesh.geometry as THREE.BufferGeometry;
    geom = ensureIndexedGeometry(geom);
    const neighbors = buildTriangleNeighbors(geom);

    // Seed plane (world)
    const [sa,sb,sc] = getTriangleVerticesWorld(mesh, seedTri);
    const seedNormal = new THREE.Vector3().subVectors(sb,sa).cross(new THREE.Vector3().subVectors(sc,sa)).normalize();
    const seedPlane = new THREE.Plane().setFromNormalAndCoplanarPoint(seedNormal, sa);

    // Adjust epsilon based on object scale magnitude (avoid too strict on big meshes)
    const scale = new THREE.Vector3();
    const posQ = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    mesh.matrixWorld.decompose(posQ, quat, scale);
    const scaleMag = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3;
    const eps = planeEpsilon * Math.max(1, scaleMag);

    const cosThresh = Math.cos(THREE.MathUtils.degToRad(angleToleranceDeg));

    const visited = new Set<number>();
    const region: number[] = [];
    const queue: number[] = [seedTri];
    visited.add(seedTri);

    while (queue.length) {
        const tri = queue.shift()!;
        region.push(tri);

        const neighs = neighbors.get(tri) || [];
        for (const nt of neighs) {
            if (visited.has(nt)) continue;

            const nNormal = getTriangleNormalWorld(mesh, nt);
            // Normal similarity check
            if (nNormal.dot(seedNormal) < cosThresh) continue;

            // Coplanarity check: all vertices close to seed plane
            const [na,nb,nc] = getTriangleVerticesWorld(mesh, nt);
            const d1 = Math.abs(seedPlane.distanceToPoint(na));
            const d2 = Math.abs(seedPlane.distanceToPoint(nb));
            const d3 = Math.abs(seedPlane.distanceToPoint(nc));
            if (d1 <= eps && d2 <= eps && d3 <= eps) {
                visited.add(nt);
                queue.push(nt);
            }
        }
    }

    // Collect unique vertex indices & create overlay geometry
    const idx = geom.index!.array as ArrayLike<number>;
    const posAttr = geom.getAttribute('position') as THREE.BufferAttribute;
    const triIndices: number[] = [];
    for (const t of region) {
        triIndices.push(idx[t*3], idx[t*3+1], idx[t*3+2]);
    }

    // Build a separate BufferGeometry for the region, in WORLD space, to avoid z-fighting issues we offset slightly along normal
    const worldPositions: number[] = [];
    for (let i = 0; i < triIndices.length; i++) {
        const vi = triIndices[i];
        const v = new THREE.Vector3().fromBufferAttribute(posAttr, vi).applyMatrix4(mesh.matrixWorld);
        // small offset along normal
        const vOff = v.clone().addScaledVector(seedNormal, 1e-4 * Math.max(1, scaleMag));
        worldPositions.push(vOff.x, vOff.y, vOff.z);
    }
    const regionGeom = new THREE.BufferGeometry();
    regionGeom.setAttribute('position', new THREE.Float32BufferAttribute(worldPositions, 3));
    // Non-indexed triangles are okay for a highlight overlay

    return {
        triangles: region,
        geometryWorld: regionGeom,
        seedNormal
    };
};


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
    if (!(mesh.geometry as THREE.BufferGeometry).attributes.position) {
        console.warn('Mesh has no position attribute');
        return null;
    }

    // Collect full planar region from the clicked triangle
    const region = collectCoplanarRegion(mesh, hit.faceIndex, 2, 1e-4);

    // Build highlight mesh in world space
    const mat = new THREE.MeshBasicMaterial({
        color,
        opacity,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide
    });
    const overlay = new THREE.Mesh(region.geometryWorld, mat);
    overlay.renderOrder = 999; // draw on top
    scene.add(overlay);

    currentHighlight = {
        mesh: overlay,
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