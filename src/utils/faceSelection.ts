import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
(THREE.Mesh as any).prototype.raycast = acceleratedRaycast;

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
    faceListIndex?: number;
    rowIndex?: number; // Hangi satıra ait olduğunu belirtir
}

let currentHighlights: FaceHighlight[] = [];
let isMultiSelectMode = false;

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
 * Clear only temporary highlights, keep persistent ones
 */
export const clearTemporaryHighlights = (scene: THREE.Scene) => {
    const temporaryHighlights = currentHighlights.filter(highlight => 
        !(highlight.mesh as any).isPersistent
    );
    
    temporaryHighlights.forEach(highlight => {
        // Remove text mesh if exists
        if ((highlight.mesh as any).textMesh) {
            scene.remove((highlight.mesh as any).textMesh);
            (highlight.mesh as any).textMesh.geometry.dispose();
            (highlight.mesh as any).textMesh.material.dispose();
        }
        scene.remove(highlight.mesh);
        highlight.mesh.geometry.dispose();
        (highlight.mesh.material as THREE.Material).dispose();
    });
    
    // Keep only persistent highlights
    currentHighlights = currentHighlights.filter(highlight => 
        (highlight.mesh as any).isPersistent
    );
    
    console.log(`🎯 Cleared ${temporaryHighlights.length} temporary highlights, kept ${currentHighlights.length} persistent`);
};

/**
 * Mevcut highlight'ı temizle
 */
export const clearFaceHighlight = (scene: THREE.Scene) => {
    // Clear ALL highlights (both persistent and temporary)
    const highlightsToRemove = [...currentHighlights];
    
    highlightsToRemove.forEach(highlight => {
        // Remove text mesh if exists
        if ((highlight.mesh as any).textMesh) {
            scene.remove((highlight.mesh as any).textMesh);
            (highlight.mesh as any).textMesh.geometry.dispose();
            (highlight.mesh as any).textMesh.material.dispose();
        }
        scene.remove(highlight.mesh);
        highlight.mesh.geometry.dispose();
        (highlight.mesh.material as THREE.Material).dispose();
    });
    
    // Keep only persistent highlights
    currentHighlights = currentHighlights.filter(highlight => 
        (highlight.mesh as any).isPersistent
    );
    
    isMultiSelectMode = false;
    console.log(`🎯 Cleared ALL ${highlightsToRemove.length} highlights`);
};

/**
 * Belirli bir highlight'ı kaldır
 */
export const removeFaceHighlight = (scene: THREE.Scene, faceIndex: number, shapeId: string) => {
    const index = currentHighlights.findIndex(h => h.faceIndex === faceIndex && h.shapeId === shapeId);
    if (index !== -1) {
        const highlight = currentHighlights[index];
        // Remove text mesh if exists
        if ((highlight.mesh as any).textMesh) {
            scene.remove((highlight.mesh as any).textMesh);
            (highlight.mesh as any).textMesh.geometry.dispose();
            (highlight.mesh as any).textMesh.material.dispose();
        }
        scene.remove(highlight.mesh);
        highlight.mesh.geometry.dispose();
        (highlight.mesh.material as THREE.Material).dispose();
        currentHighlights.splice(index, 1);
        console.log(`🎯 Face highlight removed: face ${faceIndex} of shape ${shapeId}`);
    }
};

/**
 * Remove face highlight by row index - satır indeksine göre highlight sil
 */
export const removeFaceHighlightByRowIndex = (scene: THREE.Scene, rowIndex: number, specificFaceIndex?: number) => {
    console.log(`🎯 Attempting to remove highlights for row ${rowIndex}`);
    console.log(`🎯 Current highlights count: ${currentHighlights.length}`);
    console.log(`🎯 All highlights:`, currentHighlights.map(h => ({
        rowIndex: h.rowIndex,
        faceIndex: h.faceIndex,
        shapeId: h.shapeId
    })));
    
    // 🎯 DUAL REMOVAL SYSTEM - Remove from both currentHighlights array AND scene objects
    const highlightsToRemove: FaceHighlight[] = [];
    const sceneObjectsToRemove: THREE.Object3D[] = [];
    
    // Find highlights to remove from currentHighlights array
    currentHighlights.forEach((highlight, index) => {
        if (highlight.rowIndex === rowIndex) {
            highlightsToRemove.push(highlight);
            console.log(`🎯 Found highlight to remove: rowIndex ${highlight.rowIndex}, faceIndex ${highlight.faceIndex}`);
        }
    });
    
    // Also scan scene objects with userData
    scene.traverse((object) => {
        if (object.userData && object.userData.rowIndex === rowIndex) {
            sceneObjectsToRemove.push(object);
            console.log(`🎯 Found scene object to remove: rowIndex ${object.userData.rowIndex}, faceIndex ${object.userData.faceIndex}, isTextMesh: ${object.userData.isTextMesh || false}`);
        }
    });
    
    console.log(`🎯 Found ${highlightsToRemove.length} highlights and ${sceneObjectsToRemove.length} scene objects to remove`);
    
    // Remove from currentHighlights array
    highlightsToRemove.forEach(highlight => {
        const index = currentHighlights.indexOf(highlight);
        if (index !== -1) {
            // Remove text mesh if exists
            if ((highlight.mesh as any).textMesh) {
                scene.remove((highlight.mesh as any).textMesh);
                (highlight.mesh as any).textMesh.geometry.dispose();
                (highlight.mesh as any).textMesh.material.dispose();
            }
            
            // Remove main mesh
            scene.remove(highlight.mesh);
            highlight.mesh.geometry.dispose();
            (highlight.mesh.material as THREE.Material).dispose();
            
            // Remove from array
            currentHighlights.splice(index, 1);
            console.log(`🗑️ Removed highlight from array: rowIndex ${highlight.rowIndex}, faceIndex ${highlight.faceIndex}`);
        }
    });
    
    // Remove scene objects that might not be in currentHighlights
    sceneObjectsToRemove.forEach(object => {
        scene.remove(object);
        
        // Dispose geometry and material if it's a mesh
        if (object instanceof THREE.Mesh) {
            if (object.geometry) object.geometry.dispose();
            if (object.material) {
                if (Array.isArray(object.material)) {
                    object.material.forEach(mat => mat.dispose());
                } else {
                    object.material.dispose();
                }
            }
        }
        
        console.log(`🗑️ Removed scene object: rowIndex ${object.userData.rowIndex}, faceIndex ${object.userData.faceIndex}`);
    });
    
    const totalRemoved = highlightsToRemove.length + sceneObjectsToRemove.length;
    if (totalRemoved > 0) {
        console.log(`✅ ${totalRemoved} highlight objects removed for row: ${rowIndex}`);
        console.log(`🎯 Remaining highlights count: ${currentHighlights.length}`);
    } else {
        console.warn(`⚠️ No highlights found for row: ${rowIndex}`);
    }
};

/**
 * Clear all persistent highlights
 */
export const clearAllPersistentHighlights = (scene: THREE.Scene) => {
    const persistentHighlights = currentHighlights.filter(highlight => 
        (highlight.mesh as any).isPersistent
    );
    
    persistentHighlights.forEach(highlight => {
        // Remove text mesh if exists
        if ((highlight.mesh as any).textMesh) {
            scene.remove((highlight.mesh as any).textMesh);
            (highlight.mesh as any).textMesh.geometry.dispose();
            (highlight.mesh as any).textMesh.material.dispose();
        }
        scene.remove(highlight.mesh);
        highlight.mesh.geometry.dispose();
        (highlight.mesh.material as THREE.Material).dispose();
    });
    
    // Clear all highlights
    currentHighlights = [];
    
    console.log(`🎯 Cleared ${persistentHighlights.length} persistent highlights`);
};

/**
 * Yüzey highlight'ı ekle (Flood-Fill tabanlı)
 */

/** ===== Robust Planar Region Selection (welded + triangulated) ===== **/

type RegionResult = {
    triangles: number[];
    normal: THREE.Vector3;
    plane: THREE.Plane;
    boundaryLoops: number[][]; // loops of welded vertex ids
    weldedToWorld: Map<number, THREE.Vector3>;
};

const QUANT_EPS = 1e-4;  // weld tolerance in world units
const ANGLE_DEG = 4;     // dihedral angle tolerance
const PLANE_EPS = 5e-3;  // increased plane epsilon for better coplanar detection (5mm tolerance)

const posKey = (v: THREE.Vector3, eps: number) => {
    const kx = Math.round(v.x / eps);
    const ky = Math.round(v.y / eps);
    const kz = Math.round(v.z / eps);
    return `${kx}_${ky}_${kz}`;
};

const buildNeighborsWithWeld = (mesh: THREE.Mesh, weldEps: number) => {
    const geom = mesh.geometry as THREE.BufferGeometry;
    let index: THREE.BufferAttribute;
    
    if (geom.index) {
        // Indexed geometry - use existing index
        index = geom.index;
    } else {
        // Non-indexed geometry - create virtual index
        const vertexCount = geom.attributes.position.count;
        const indexArray = new Uint32Array(vertexCount);
        for (let i = 0; i < vertexCount; i++) {
            indexArray[i] = i;
        }
        index = new THREE.BufferAttribute(indexArray, 1);
    }
    
    const pos = geom.getAttribute('position') as THREE.BufferAttribute;
    const idx = index.array as ArrayLike<number>;
    const triCount = Math.floor(idx.length / 3);

    const keyToId = new Map<string, number>();
    const weldedIdToWorld = new Map<number, THREE.Vector3>();
    const vertToWelded = new Map<number, number>();
    let nextId = 0;

    const tmp = new THREE.Vector3();
    const m = mesh.matrixWorld;
    for (let vi = 0; vi < pos.count; vi++) {
        tmp.fromBufferAttribute(pos, vi).applyMatrix4(m);
        const key = posKey(tmp, weldEps);
        if (!keyToId.has(key)) {
            keyToId.set(key, nextId);
            weldedIdToWorld.set(nextId, tmp.clone());
            nextId++;
        }
        vertToWelded.set(vi, keyToId.get(key)!);
    }

    const edgeMap = new Map<string, number>();
    const neighbors = new Map<number, number[]>();
    const triToWelded: [number, number, number][] = [];

    for (let t = 0; t < triCount; t++) {
        const a = (idx[t*3] as number) | 0;
        const b = (idx[t*3+1] as number) | 0;
        const c = (idx[t*3+2] as number) | 0;
        const wa = vertToWelded.get(a)!;
        const wb = vertToWelded.get(b)!;
        const wc = vertToWelded.get(c)!;
        triToWelded.push([wa, wb, wc]);

        const edges: [number, number][] = [[wa, wb], [wb, wc], [wc, wa]];
        for (const [u0, v0] of edges) {
            const u = Math.min(u0, v0);
            const v = Math.max(u0, v0);
            const ekey = `${u}_${v}`;
            if (edgeMap.has(ekey)) {
                const other = edgeMap.get(ekey)!;
                if (!neighbors.has(t)) neighbors.set(t, []);
                if (!neighbors.has(other)) neighbors.set(other, []);
                neighbors.get(t)!.push(other);
                neighbors.get(other)!.push(t);
            } else {
                edgeMap.set(ekey, t);
            }
        }
    }

    return { neighbors, triToWelded, weldedIdToWorld, index: index, posAttr: pos };
};

const triNormalWorld = (mesh: THREE.Mesh, triIndex: number, index: THREE.BufferAttribute, pos: THREE.BufferAttribute) => {
    const ia = index.getX(triIndex*3), ib = index.getX(triIndex*3+1), ic = index.getX(triIndex*3+2);
    const a = new THREE.Vector3().fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld);
    const b = new THREE.Vector3().fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld);
    const c = new THREE.Vector3().fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld);
    return new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
};

const growRegion = (mesh: THREE.Mesh, seedTri: number): RegionResult => {
    const { neighbors, triToWelded, weldedIdToWorld, index, posAttr } = buildNeighborsWithWeld(
        mesh, QUANT_EPS);

    // Implementation would continue here but is cut off in the original file
    // For now, return a minimal valid result to prevent compilation errors
    return {
        triangles: [seedTri],
        normal: new THREE.Vector3(0, 1, 0),
        plane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
        boundaryLoops: [],
        weldedToWorld: weldedIdToWorld
    };
};