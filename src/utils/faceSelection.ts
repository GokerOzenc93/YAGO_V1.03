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
    faceListIndex?: number; // YENİ: Arayüzdeki liste indeksiyle bağlantı kurmak için
}

let currentHighlights: FaceHighlight[] = [];
let isMultiSelectMode = false;

// ... getFaceVertices, getFaceNormal, getFaceCenter, getFaceArea, verticesEqual, getNeighborFaces, getFullSurfaceVertices, createFaceHighlight fonksiyonları burada değişmeden kalıyor ...
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
    const NORMAL_TOLERANCE = THREE.MathUtils.degToRad(8); // 8° tolerans (önceki: 5)
    const DISTANCE_TOLERANCE = 5e-2; // 0.05mm düzlem mesafesi toleransı (önceki: 3.0)


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

// YENİ FONKSİYON: Liste index'ine göre highlight'ı sil
export const removeFaceHighlightByListIndex = (scene: THREE.Scene, faceListIndex: number) => {
    const indicesToRemove: number[] = [];
    currentHighlights.forEach((highlight, index) => {
        if (highlight.faceListIndex === faceListIndex) {
            indicesToRemove.push(index);
        }
    });

    indicesToRemove.reverse().forEach(index => {
        const highlight = currentHighlights[index];
        if ((highlight.mesh as any).textMesh) {
            scene.remove((highlight.mesh as any).textMesh);
            (highlight.mesh as any).textMesh.geometry.dispose();
            (highlight.mesh as any).textMesh.material.dispose();
        }
        scene.remove(highlight.mesh);
        highlight.mesh.geometry.dispose();
        (highlight.mesh.material as THREE.Material).dispose();
        currentHighlights.splice(index, 1);
    });

    if (indicesToRemove.length > 0) {
        console.log(`🗑️ Highlight for list index ${faceListIndex} removed.`);
    }
};

// ... (dosyanın geri kalanı)
/** ===== Robust Planar Region Selection (welded + triangulated) ===== **/

type RegionResult = {
    triangles: number[];
    normal: THREE.Vector3;
    plane: THREE.Plane;
    boundaryLoops: number[][]; // loops of welded vertex ids
    weldedToWorld: Map<number, THREE.Vector3>;
};

const QUANT_EPS = 1e-4;  // weld tolerance in world units
const ANGLE_DEG = 8;     // dihedral angle tolerance
const PLANE_EPS = 5e-2;  // increased plane epsilon for better coplanar detection (5mm tolerance)

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
        mesh, QUANT_EPS * (() => { const s = new THREE.Vector3(); const p = new THREE.Vector3(); const q = new THREE.Quaternion(); mesh.matrixWorld.decompose(p,q,s); return (Math.abs(s.x)+Math.abs(s.y)+Math.abs(s.z))/3; })()
    );

    const svec = new THREE.Vector3(), pvec = new THREE.Vector3(), q = new THREE.Quaternion();
    mesh.matrixWorld.decompose(pvec, q, svec);
    const scaleMag = (Math.abs(svec.x)+Math.abs(svec.y)+Math.abs(svec.z))/3;
    const planeEps = PLANE_EPS * Math.max(1, scaleMag * 2); // increased scale factor for better tolerance
    const angleCos = Math.cos(THREE.MathUtils.degToRad(ANGLE_DEG * 2)); // increased angle tolerance to 8 degrees

    let avgNormal = triNormalWorld(mesh, seedTri, index, posAttr);
    const seedW = triToWelded[seedTri];
    const seedPoint = weldedIdToWorld.get(seedW[0])!.clone();
    let plane = new THREE.Plane().setFromNormalAndCoplanarPoint(avgNormal, seedPoint);

    const visited = new Set<number>();
    const region: number[] = [];
    const queue: number[] = [seedTri];
    visited.add(seedTri);

    // Enhanced coplanar detection with vertex analysis
    const analyzeCoplanarVertices = (triangleIndices: number[]): boolean => {
        // Get all unique vertices from the triangle
        const vertices = triangleIndices.map(idx => weldedIdToWorld.get(triToWelded[idx][0])!);

        // Check if all vertices lie on the same plane within tolerance
        let coplanarCount = 0;
        for (const vertex of vertices) {
            const distanceToPlane = Math.abs(plane.distanceToPoint(vertex));
            if (distanceToPlane <= planeEps * 1.5) { // increased tolerance for vertex coplanarity
                coplanarCount++;
            }
        }

        // If majority of vertices are coplanar, consider the triangle coplanar
        return coplanarCount >= vertices.length * 0.7; // 70% threshold
    };
    while (queue.length) {
        const t = queue.shift()!;
        region.push(t);
        const neighs = neighbors.get(t) || [];
        for (const nt of neighs) {
            if (visited.has(nt)) continue;
            const n = triNormalWorld(mesh, nt, index, posAttr);

            // Enhanced normal check with bidirectional tolerance
            const normalDot = Math.max(n.dot(avgNormal), n.dot(avgNormal.clone().negate()));
            if (normalDot < angleCos) continue;

            const wids = triToWelded[nt];
            const pa = weldedIdToWorld.get(wids[0])!;
            const pb = weldedIdToWorld.get(wids[1])!;
            const pc = weldedIdToWorld.get(wids[2])!;

            // Enhanced coplanarity check with adaptive tolerance
            const distA = Math.abs(plane.distanceToPoint(pa));
            const distB = Math.abs(plane.distanceToPoint(pb));
            const distC = Math.abs(plane.distanceToPoint(pc));

            // Use adaptive tolerance based on triangle size
            const triangleSize = Math.max(
                pa.distanceTo(pb),
                pb.distanceTo(pc),
                pc.distanceTo(pa)
            );
            const adaptiveTolerance = Math.max(planeEps, triangleSize * 0.01); // 1% of triangle size

            if (distA > adaptiveTolerance || distB > adaptiveTolerance || distC > adaptiveTolerance) {
                // Additional check: analyze coplanar vertices in the region
                if (!analyzeCoplanarVertices([t, nt])) {
                    continue;
                }
            }

            visited.add(nt);
            queue.push(nt);

            // Weighted normal averaging for better plane estimation
            const weight = 1.0 / (1.0 + Math.min(distA, distB, distC)); // weight by coplanarity
            avgNormal.add(n.multiplyScalar(weight)).normalize();
            plane = new THREE.Plane().setFromNormalAndCoplanarPoint(avgNormal, seedPoint);
        }
    }

    // boundary edges (welded) with count==1
    const edgeCount = new Map<string, number>();
    for (const t of region) {
        const [a,b,c] = triToWelded[t];
        const edges: [number,number][] = [[a,b],[b,c],[c,a]];
        for (const [u0,v0] of edges) {
            const u = Math.min(u0, v0), v = Math.max(u0, v0);
            const ekey = `${u}_${v}`;
            edgeCount.set(ekey, (edgeCount.get(ekey)||0)+1);
        }
    }
    const boundaryEdges: [number,number][] = [];
    for (const [ekey, cnt] of edgeCount.entries()) {
        if (cnt === 1) {
            const [u,v] = ekey.split('_').map(Number);
            boundaryEdges.push([u,v]);
        }
    }

    // order boundary into loops
    const adjacency = new Map<number, number[]>();
    for (const [u,v] of boundaryEdges) {
        if (!adjacency.has(u)) adjacency.set(u, []);
        if (!adjacency.has(v)) adjacency.set(v, []);
        adjacency.get(u)!.push(v);
        adjacency.get(v)!.push(u);
    }

    const boundaryLoops: number[][] = [];
    const used = new Set<string>();
    const edgeKey = (u:number,v:number)=> u<=v?`${u}_${v}`:`${v}_${u}`;

    for (const [start] of adjacency) {
        const nbrs = adjacency.get(start)!;
        let hasUnused = false;
        for (const nx of nbrs) if (!used.has(edgeKey(start,nx))) { hasUnused = true; break; }
        if (!hasUnused) continue;

        const loop: number[] = [start];
        let prev = -1, curr = start;
        while (true) {
            const ns = adjacency.get(curr) || [];
            let next = -1;
            for (const n of ns) {
                const e = edgeKey(curr, n);
                if (used.has(e)) continue;
                if (n === prev) continue;
                next = n; used.add(e); break;
            }
            if (next === -1) break;
            if (next === start) { loop.push(next); break; }
            loop.push(next);
            prev = curr; curr = next;
        }
        if (loop.length > 2) boundaryLoops.push(loop);
    }

    return { triangles: region, normal: avgNormal.clone(), plane, boundaryLoops, weldedToWorld: weldedIdToWorld };
};

const buildFaceOverlayFromHit = (
    scene: THREE.Scene,
    mesh: THREE.Mesh,
    seedTri: number,
    color: number,
    opacity: number,
    faceNumber?: number
): THREE.Mesh | null => {
    const res = growRegion(mesh, seedTri);
    if (res.boundaryLoops.length === 0) return null;

    const n = res.normal.clone().normalize();
    const up = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
    const tangent = new THREE.Vector3().crossVectors(up, n).normalize();
    const bitangent = new THREE.Vector3().crossVectors(n, tangent).normalize();

    // Yüzeyin gerçek merkezini hesapla (world space'de)
    const surfaceCenter = new THREE.Vector3();
    let totalVertices = 0;
    for (const wid of res.boundaryLoops[0]) {
        const p = res.weldedToWorld.get(wid)!;
        surfaceCenter.add(p);
        totalVertices++;
    }
    surfaceCenter.divideScalar(totalVertices);

    const loops2D: THREE.Vector2[][] = res.boundaryLoops.map(loop => {
        const arr: THREE.Vector2[] = [];
        for (const wid of loop) {
            const p = res.weldedToWorld.get(wid)!;
            // Yüzey merkezine göre relative koordinatlar
            const relative = p.clone().sub(surfaceCenter);
            const x = relative.dot(tangent);
            const y = relative.dot(bitangent);
            arr.push(new THREE.Vector2(x, y));
        }
        return arr;
    });

    const outer = loops2D[0];
    const holes = loops2D.slice(1);
    const triangles = THREE.ShapeUtils.triangulateShape(outer, holes);

    // 3D reconstruction: yüzey merkezini origin olarak kullan
    const to3D = (v: THREE.Vector2) => surfaceCenter.clone()
    .addScaledVector(tangent, v.x)
    .addScaledVector(bitangent, v.y);

    const verts: number[] = [];
    const all2D = outer.concat(...holes);
    for (const v2 of all2D) {
        // Yüzeyin hemen üstünde konumlandır (daha belirgin offset)
        const p3 = to3D(v2).addScaledVector(n, 0.5);
        verts.push(p3.x, p3.y, p3.z);
    }

    const indices: number[] = [];
    for (const tri of triangles) for (const i of tri) indices.push(i);

    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(indices);
    g.computeVertexNormals();

    const mat = new THREE.MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false, side: THREE.DoubleSide });
    const overlay = new THREE.Mesh(g, mat);
    overlay.renderOrder = 999;

    // Add face number text if provided
    if (faceNumber !== undefined) {
        // Use lighter orange for confirmed faces
        const lightOrange = 0xffb366; // Light orange color
        mat.color.setHex(lightOrange);

        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
            canvas.width = 128;
            canvas.height = 64;

            // Clear canvas
            context.clearRect(0, 0, canvas.width, canvas.height);

            // Draw red circular background
            context.beginPath();
            context.arc(canvas.width / 2, canvas.height / 2, 28, 0, 2 * Math.PI);
            context.fillStyle = '#dc2626'; // Red background
            context.fill();

            // Add white border
            context.strokeStyle = '#ffffff';
            context.lineWidth = 3;
            context.stroke();

            // Set text properties
            context.font = 'bold 24px Arial';
            context.fillStyle = '#ffffff';
            context.textAlign = 'center';
            context.textBaseline = 'middle';

            // Remove shadow for cleaner look
            context.shadowColor = 'transparent';
            context.shadowBlur = 0;
            context.shadowOffsetX = 0;
            context.shadowOffsetY = 0;

            // Draw face number
            context.fillText(faceNumber.toString(), canvas.width / 2, canvas.height / 2);

            // Create texture from canvas
            const texture = new THREE.CanvasTexture(canvas);
            texture.needsUpdate = true;

            // Create text material
            const textMaterial = new THREE.MeshBasicMaterial({
                map: texture,
                transparent: true,
                depthWrite: false,
                depthTest: false
            });

            // Create text plane geometry
            const textGeometry = new THREE.PlaneGeometry(100, 50);
            const textMesh = new THREE.Mesh(textGeometry, textMaterial);

            // Position text at surface center, slightly above
            textMesh.position.copy(surfaceCenter).addScaledVector(n, 2);
            textMesh.lookAt(surfaceCenter.clone().addScaledVector(n, 100));
            textMesh.renderOrder = 1000;

            scene.add(textMesh);

            // Store text mesh reference for cleanup
            (overlay as any).textMesh = textMesh;
        }
    }

    scene.add(overlay);
    return overlay;
};

/** ===== End Robust Planar Region Selection ===== **/
// ... (dosyanın geri kalanı, highlightFace, detectFaceAtMouse vb.)
export const highlightFace = (
    scene: THREE.Scene,
    hit: THREE.Intersection,
    shape: Shape,
    isMultiSelect: boolean = false,
    color: number = 0xff6b35,
    opacity: number = 0.6,
    faceNumber?: number,
    faceListIndex?: number // YENİ: Arayüzdeki liste indeksi
): FaceHighlight | null => {
    // Sadece geçici highlight'ları temizle, kalıcı olanlar kalsın
    clearTemporaryHighlights(scene);

    if (!hit.face || hit.faceIndex === undefined) return null;
    const mesh = hit.object as THREE.Mesh;
    if (!(mesh.geometry as THREE.BufferGeometry).attributes.position) return null;

    if (isMultiSelect) {
      // ...
    }

    const overlay = buildFaceOverlayFromHit(scene, mesh, hit.faceIndex, color, opacity, faceNumber);
    if (!overlay) return null;

    const newHighlight: FaceHighlight = {
        mesh: overlay,
        faceIndex: hit.faceIndex,
        shapeId: shape.id,
        faceListIndex: faceListIndex // YENİ: Liste indeksini highlight objesine ekle
    };
    currentHighlights.push(newHighlight);

    // YENİ: Highlight'ın kalıcı olup olmadığını işaretle
    if (faceNumber !== undefined) {
        (overlay as any).isPersistent = true;
    } else {
        (overlay as any).isPersistent = false;
    }

    isMultiSelectMode = isMultiSelect;
    return newHighlight;
};
// ... (dosyanın geri kalanı)

export const clearTemporaryHighlights = (scene: THREE.Scene) => {
    const temporaryHighlights = currentHighlights.filter(highlight =>
        !(highlight.mesh as any).isPersistent
    );

    temporaryHighlights.forEach(highlight => {
        if ((highlight.mesh as any).textMesh) {
            scene.remove((highlight.mesh as any).textMesh);
            (highlight.mesh as any).textMesh.geometry.dispose();
            (highlight.mesh as any).textMesh.material.dispose();
        }
        scene.remove(highlight.mesh);
        highlight.mesh.geometry.dispose();
        (highlight.mesh.material as THREE.Material).dispose();
    });

    currentHighlights = currentHighlights.filter(highlight =>
        (highlight.mesh as any).isPersistent
    );
};

export const clearAllPersistentHighlights = (scene: THREE.Scene) => {
    currentHighlights.forEach(highlight => {
        if ((highlight.mesh as any).textMesh) {
            scene.remove((highlight.mesh as any).textMesh);
        }
        scene.remove(highlight.mesh);
        highlight.mesh.geometry.dispose();
        (highlight.mesh.material as THREE.Material).dispose();
    });
    currentHighlights = [];
};

export const clearFaceHighlight = (scene: THREE.Scene) => {
    clearAllPersistentHighlights(scene);
    isMultiSelectMode = false;
};
