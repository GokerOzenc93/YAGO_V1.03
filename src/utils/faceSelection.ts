import * as THREE from 'three';
import { Shape } from '../types/shapes';

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
 * Yüzey highlight mesh'i oluştur
 */
export const createFaceHighlight = (
  vertices: THREE.Vector3[],
  worldMatrix: THREE.Matrix4,
  color: number = 0xff6b35,
  opacity: number = 0.6
): THREE.Mesh => {
  // Çokgen geometri oluştur (birden fazla üçgen için)
  const geometry = new THREE.BufferGeometry();
  const worldVertices = vertices.map(v => v.clone().applyMatrix4(worldMatrix));
  
  // Vertex pozisyonları
  const positions = new Float32Array(worldVertices.length * 3);
  worldVertices.forEach((vertex, i) => {
    positions[i * 3] = vertex.x;
    positions[i * 3 + 1] = vertex.y;
    positions[i * 3 + 2] = vertex.z;
  });
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  // Üçgenleme (triangulation) - convex hull için
  const indices = [];
  for (let i = 1; i < worldVertices.length - 1; i++) {
    indices.push(0, i, i + 1);
  }
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  // Highlight material
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false
  });
  
  return new THREE.Mesh(geometry, material);
};

/**
 * Aynı yüzeydeki komşu üçgenleri bul
 */
export const findConnectedTriangles = (
  geometry: THREE.BufferGeometry,
  startFaceIndex: number,
  normalTolerance: number = 0.95
): number[] => {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  
  if (!pos || !index) return [startFaceIndex];
  
  // Başlangıç üçgeninin normal'ını hesapla
  const startVertices = getFaceVertices(geometry, startFaceIndex);
  const startNormal = getFaceNormal(startVertices);
  
  const connectedFaces = new Set<number>([startFaceIndex]);
  const toCheck = [startFaceIndex];
  const totalFaces = Math.floor(index.count / 3);
  
  console.log(`🔍 Yüzey taraması başlatıldı - Toplam ${totalFaces} üçgen kontrol edilecek`);
  
  while (toCheck.length > 0) {
    const currentFace = toCheck.pop()!;
    const currentVertices = getFaceVertices(geometry, currentFace);
    
    // Tüm diğer üçgenleri kontrol et
    for (let faceIndex = 0; faceIndex < totalFaces; faceIndex++) {
      if (connectedFaces.has(faceIndex)) continue;
      
      const vertices = getFaceVertices(geometry, faceIndex);
      if (vertices.length === 0) continue;
      
      const normal = getFaceNormal(vertices);
      
      // Normal benzerliği kontrolü
      const similarity = startNormal.dot(normal);
      
      if (similarity > normalTolerance) {
        // Komşuluk kontrolü - ortak vertex var mı?
        const hasSharedVertex = currentVertices.some(cv => 
          vertices.some(v => cv.distanceTo(v) < 0.01)
        );
        
        if (hasSharedVertex) {
          connectedFaces.add(faceIndex);
          toCheck.push(faceIndex);
        }
      }
    }
  }
  
  console.log(`✅ Yüzey taraması tamamlandı - ${connectedFaces.size} üçgen bulundu`);
  return Array.from(connectedFaces);
};

/**
 * Birden fazla üçgenden tek bir yüzey oluştur
 */
export const createUnifiedFaceGeometry = (
  geometry: THREE.BufferGeometry,
  faceIndices: number[],
  worldMatrix: THREE.Matrix4
): THREE.Vector3[] => {
  const allVertices: THREE.Vector3[] = [];
  const vertexMap = new Map<string, THREE.Vector3>();
  
  // Tüm üçgenlerin vertex'lerini topla
  faceIndices.forEach(faceIndex => {
    const vertices = getFaceVertices(geometry, faceIndex);
    vertices.forEach(vertex => {
      const key = `${vertex.x.toFixed(3)},${vertex.y.toFixed(3)},${vertex.z.toFixed(3)}`;
      if (!vertexMap.has(key)) {
        vertexMap.set(key, vertex.clone());
      }
    });
  });
  
  // Unique vertex'leri al
  const uniqueVertices = Array.from(vertexMap.values());
  
  // Yüzey merkezini hesapla
  const center = new THREE.Vector3();
  uniqueVertices.forEach(v => center.add(v));
  center.divideScalar(uniqueVertices.length);
  
  // Vertex'leri merkeze göre sırala (convex hull için)
  const sortedVertices = uniqueVertices.sort((a, b) => {
    const angleA = Math.atan2(a.z - center.z, a.x - center.x);
    const angleB = Math.atan2(b.z - center.z, b.x - center.x);
    return angleA - angleB;
  });
  
  console.log(`🔧 Birleşik yüzey oluşturuldu - ${uniqueVertices.length} unique vertex, ${faceIndices.length} üçgen`);
  
  return sortedVertices;
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
 * Yüzey highlight'ı ekle
 */
export const highlightFace = (
  scene: THREE.Scene,
  hit: THREE.Intersection,
  shape: Shape,
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
  
  console.log(`🎯 Yüzey seçimi başlatıldı - Face index: ${hit.faceIndex}`);
  
  // Tıklanan yüzeyle bağlantılı tüm üçgenleri bul
  const connectedFaces = findConnectedTriangles(geometry, hit.faceIndex, 0.95);
  
  if (connectedFaces.length === 0) {
    console.warn('No connected faces found');
    return null;
  }
  
  // World matrix'i al
  const worldMatrix = mesh.matrixWorld.clone();
  
  // Birleşik yüzey geometrisi oluştur
  const unifiedVertices = createUnifiedFaceGeometry(geometry, connectedFaces, worldMatrix);
  
  // Highlight mesh'i oluştur (tam yüzey için)
  const highlightMesh = createFaceHighlight(unifiedVertices, new THREE.Matrix4(), color, opacity);
  
  // Sahneye ekle
  scene.add(highlightMesh);
  
  // Yüzey bilgilerini logla
  const firstFaceVertices = getFaceVertices(geometry, hit.faceIndex);
  const faceNormal = getFaceNormal(firstFaceVertices);
  const faceCenter = getFaceCenter(unifiedVertices);
  const totalArea = connectedFaces.reduce((sum, faceIndex) => {
    const vertices = getFaceVertices(geometry, faceIndex);
    return sum + getFaceArea(vertices);
  }, 0);
  
  console.log('🎯 Tam yüzey vurgulandı:', {
    shapeId: shape.id,
    shapeType: shape.type,
    startFaceIndex: hit.faceIndex,
    connectedFaces: connectedFaces.length,
    totalTriangles: connectedFaces.length,
    faceCenter: faceCenter.toArray().map(v => v.toFixed(1)),
    faceNormal: faceNormal.toArray().map(v => v.toFixed(2)),
    totalArea: totalArea.toFixed(1),
    vertexCount: unifiedVertices.length
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