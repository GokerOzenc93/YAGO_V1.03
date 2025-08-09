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
 * Komşu yüzleri bulma (ortak vertex kontrolü ile)
 */
const getNeighborFaces = (geometry: THREE.BufferGeometry, faceIndex: number): number[] => {
  const indexAttr = geometry.index;
  const neighbors: number[] = [];
  if (!indexAttr) return neighbors;

  // Mevcut face'in vertex indekslerini al
  const currentFaceVertices = [
    indexAttr.getX(faceIndex * 3 + 0),
    indexAttr.getX(faceIndex * 3 + 1),
    indexAttr.getX(faceIndex * 3 + 2)
  ];

  const totalFaces = indexAttr.count / 3;

  console.log(`🔍 Face ${faceIndex} vertices: [${currentFaceVertices.join(', ')}]`);

  for (let i = 0; i < totalFaces; i++) {
    if (i === faceIndex) continue;
    
    const otherFaceVertices = [
      indexAttr.getX(i * 3 + 0),
      indexAttr.getX(i * 3 + 1),
      indexAttr.getX(i * 3 + 2)
    ];
    
    // Ortak vertex sayısını hesapla
    const sharedVerts = otherFaceVertices.filter(v => currentFaceVertices.includes(v));
    
    // Tam 2 ortak vertex = ortak kenar = komşu
    if (sharedVerts.length === 2) {
      neighbors.push(i);
    }
  }

  console.log(`👥 Face ${faceIndex} has ${neighbors.length} neighbors: [${neighbors.join(', ')}]`);
  return neighbors;
};

/**
 * GARANTILI TÜM YÜZEY BULMA - Tıklanan noktadan bağımsız
 * 1. Tüm face'leri tara
 * 2. Aynı normale sahip olanları bul
 * 3. Hepsini birleştir
 */
export const getFullSurfaceVertices = (geometry: THREE.BufferGeometry, startFaceIndex: number): THREE.Vector3[] => {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  if (!pos) return [];

  console.log(`🎯 GARANTILI YÜZEYİ BULMA - Face ${startFaceIndex}'den başlıyor`);
  
  // 1. Hedef normalı hesapla
  const startVertices = getFaceVertices(geometry, startFaceIndex);
  const targetNormal = getFaceNormal(startVertices);
  
  console.log(`🎯 Target normal: [${targetNormal.x.toFixed(3)}, ${targetNormal.y.toFixed(3)}, ${targetNormal.z.toFixed(3)}]`);

  // 2. TÜM FACE'LERİ TARA - komşuluk aramadan
  const totalFaces = index ? index.count / 3 : pos.count / 9;
  const surfaceFaces: number[] = [];
  
  console.log(`📊 Toplam ${totalFaces} face taranacak`);

  for (let faceIndex = 0; faceIndex < totalFaces; faceIndex++) {
    const faceVerts = getFaceVertices(geometry, faceIndex);
    if (faceVerts.length === 0) continue;
    
    const normal = getFaceNormal(faceVerts);
    const angle = normal.angleTo(targetNormal);
    
    // Çok geniş tolerans - 60 derece
    if (angle < 1.047) { // 1.047 radyan = 60 derece
      surfaceFaces.push(faceIndex);
      
      if (faceIndex % 50 === 0 || angle < 0.1) {
        console.log(`✅ Face ${faceIndex} eklendi - açı: ${(angle * 180 / Math.PI).toFixed(1)}°`);
      }
    }
  }

  console.log(`🎯 SONUÇ: ${surfaceFaces.length} face bulundu (toplam ${totalFaces}'den)`);
  
  // 3. Eğer çok az face bulunduysa, toleransı artır
  if (surfaceFaces.length < 5) {
    console.log(`⚠️ Az face bulundu, tolerans artırılıyor...`);
    
    for (let faceIndex = 0; faceIndex < totalFaces; faceIndex++) {
      const faceVerts = getFaceVertices(geometry, faceIndex);
      if (faceVerts.length === 0) continue;
      
      const normal = getFaceNormal(faceVerts);
      const angle = normal.angleTo(targetNormal);
      
      // Çok çok geniş tolerans - 90 derece
      if (angle < 1.571 && !surfaceFaces.includes(faceIndex)) { // 1.571 radyan = 90 derece
        surfaceFaces.push(faceIndex);
        console.log(`🔄 TOLERANS ARTIŞI: Face ${faceIndex} eklendi - açı: ${(angle * 180 / Math.PI).toFixed(1)}°`);
      }
    }
  }

  // 4. Tüm face'lerin vertex'lerini topla
  const allVertices: THREE.Vector3[] = [];
  const uniqueVertices = new Map<string, THREE.Vector3>();
  
  surfaceFaces.forEach(faceIndex => {
    const vertices = getFaceVertices(geometry, faceIndex);
    vertices.forEach(vertex => {
      const key = `${vertex.x.toFixed(2)},${vertex.y.toFixed(2)},${vertex.z.toFixed(2)}`;
      if (!uniqueVertices.has(key)) {
        uniqueVertices.set(key, vertex);
        allVertices.push(vertex);
      }
    });
  });
  
  console.log(`🎯 FİNAL SONUÇ: ${surfaceFaces.length} üçgen, ${allVertices.length} benzersiz vertex`);
  console.log(`📊 Yüzey kapsamı: %${((surfaceFaces.length / totalFaces) * 100).toFixed(1)}`);
  
  return allVertices;
};

/**
 * Yüzey highlight mesh'i oluştur
 * Gelişmiş triangulation ile daha iyi görsellik
 */
export const createFaceHighlight = (
  vertices: THREE.Vector3[], 
  worldMatrix: THREE.Matrix4,
  color: number = 0xff6b35,
  opacity: number = 0.7
): THREE.Mesh => {
  console.log(`🎨 ${vertices.length} vertex ile highlight mesh oluşturuluyor`);
  
  // World space'e dönüştür
  const worldVertices = vertices.map(v => {
    const worldVertex = v.clone().applyMatrix4(worldMatrix);
    return worldVertex;
  });
  
  // Gelişmiş triangulation
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(worldVertices.length * 3);
  
  worldVertices.forEach((vertex, i) => {
    positions[i * 3] = vertex.x;
    positions[i * 3 + 1] = vertex.y;
    positions[i * 3 + 2] = vertex.z;
  });
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  // AKILLI TRİANGULATION
  const indices: number[] = [];
  
  if (worldVertices.length >= 3) {
    if (worldVertices.length <= 10) {
      // Az vertex - basit fan triangulation
      for (let i = 1; i < worldVertices.length - 1; i++) {
        indices.push(0, i, i + 1);
      }
    } else {
      // Çok vertex - merkez tabanlı triangulation
      const center = new THREE.Vector3();
      worldVertices.forEach(v => center.add(v));
      center.divideScalar(worldVertices.length);
      
      // Merkez vertex ekle
      const centerIndex = worldVertices.length;
      positions[centerIndex * 3] = center.x;
      positions[centerIndex * 3 + 1] = center.y;
      positions[centerIndex * 3 + 2] = center.z;
      
      // Yeni positions array oluştur
      const newPositions = new Float32Array((worldVertices.length + 1) * 3);
      newPositions.set(positions);
      newPositions[centerIndex * 3] = center.x;
      newPositions[centerIndex * 3 + 1] = center.y;
      newPositions[centerIndex * 3 + 2] = center.z;
      
      geometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
      
      // Her kenarı merkeze bağla
      for (let i = 0; i < worldVertices.length; i++) {
        const next = (i + 1) % worldVertices.length;
        indices.push(i, next, centerIndex);
      }
    }
  }
  
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  // Çok belirgin highlight material
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: Math.min(opacity + 0.3, 0.95), // Çok görünür
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    wireframe: false,
    fog: false // Fog etkisinden muaf
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  console.log(`✅ Highlight mesh: ${indices.length / 3} üçgen, opacity: ${material.opacity}`);
  
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
 * Yüzey highlight'ı ekle
 */
export const highlightFace = (
  scene: THREE.Scene,
  hit: THREE.Intersection,
  shape: Shape,
  color: number = 0xff6b35,
  opacity: number = 0.8
): FaceHighlight | null => {
  // Önce eski highlight'ı temizle
  clearFaceHighlight(scene);
  
  if (!hit.face || hit.faceIndex === undefined) {
    console.warn('No face data in intersection');
    return null;
  }
  
  const mesh = hit.object as THREE.Mesh;
  const geometry = mesh.geometry as THREE.BufferGeometry;
  
  console.log(`🎯 YÜZEYİ TARA: Face ${hit.faceIndex} - ${shape.type} (${shape.id})`);
  
  // GARANTİLİ TÜM YÜZEYİ BUL
  const fullSurfaceVertices = getFullSurfaceVertices(geometry, hit.faceIndex);
  
  if (fullSurfaceVertices.length < 3) {
    console.warn('Yüzey bulunamadı, fallback kullanılıyor');
    const fallbackVertices = getFaceVertices(geometry, hit.faceIndex);
    if (fallbackVertices.length === 0) return null;
    
    const worldMatrix = mesh.matrixWorld.clone();
    const highlightMesh = createFaceHighlight(fallbackVertices, worldMatrix, color, opacity);
    scene.add(highlightMesh);
    
    currentHighlight = {
      mesh: highlightMesh,
      faceIndex: hit.faceIndex,
      shapeId: shape.id
    };
    
    return currentHighlight;
  }
  
  console.log(`✅ TÜM YÜZEY BULUNDU: ${fullSurfaceVertices.length} vertex`);
  
  // World matrix'i al
  const worldMatrix = mesh.matrixWorld.clone();
  
  // Highlight mesh'i oluştur
  const highlightMesh = createFaceHighlight(fullSurfaceVertices, worldMatrix, color, opacity);
  
  // Sahneye ekle
  scene.add(highlightMesh);
  
  // Face bilgilerini logla
  const faceNormal = getFaceNormal(fullSurfaceVertices.slice(0, 3));
  const faceCenter = getFaceCenter(fullSurfaceVertices);
  const totalArea = fullSurfaceVertices.length > 3 ? 
    fullSurfaceVertices.reduce((sum, _, i) => {
      if (i < fullSurfaceVertices.length - 2) {
        return sum + getFaceArea([fullSurfaceVertices[0], fullSurfaceVertices[i + 1], fullSurfaceVertices[i + 2]]);
      }
      return sum;
    }, 0) : getFaceArea(fullSurfaceVertices);
  
  console.log('🎯 TÜM YÜZEY TARANDI:', {
    shapeId: shape.id,
    shapeType: shape.type,
    faceIndex: hit.faceIndex,
    faceCenter: faceCenter.toArray().map(v => v.toFixed(1)),
    faceNormal: faceNormal.toArray().map(v => v.toFixed(2)),
    totalArea: totalArea.toFixed(1),
    vertexCount: fullSurfaceVertices.length,
    coverage: 'FULL_SURFACE'
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