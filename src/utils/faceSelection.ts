import * as THREE from 'three';
import { Shape } from '../types/shapes';

export interface FaceHighlight {
  mesh: THREE.Mesh;
  faceIndex: number;
  shapeId: string;
  triangles: number[];
  mergedGeometry?: THREE.BufferGeometry;
}

let currentHighlight: FaceHighlight | null = null;
let selectedTriangles: Set<number> = new Set();
let currentShapeId: string | null = null;

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
 * İki üçgenin aynı yüzeyde olup olmadığını kontrol et
 */
export const areTrianglesOnSameSurface = (
  geometry: THREE.BufferGeometry,
  triangle1Index: number,
  triangle2Index: number,
  normalThreshold: number = 0.95,
  distanceThreshold: number = 10
): boolean => {
  const vertices1 = getFaceVertices(geometry, triangle1Index);
  const vertices2 = getFaceVertices(geometry, triangle2Index);
  
  if (vertices1.length < 3 || vertices2.length < 3) return false;
  
  const normal1 = getFaceNormal(vertices1);
  const normal2 = getFaceNormal(vertices2);
  const center1 = getFaceCenter(vertices1);
  const center2 = getFaceCenter(vertices2);
  
  // Normal benzerliği kontrolü
  const normalSimilarity = Math.abs(normal1.dot(normal2));
  
  // Mesafe kontrolü
  const distance = center1.distanceTo(center2);
  
  return normalSimilarity > normalThreshold && distance < distanceThreshold;
};

/**
 * Verilen üçgenle aynı yüzeydeki tüm üçgenleri bul
 */
export const findConnectedTriangles = (
  geometry: THREE.BufferGeometry,
  startTriangleIndex: number,
  normalThreshold: number = 0.95,
  distanceThreshold: number = 50
): number[] => {
  const connectedTriangles = new Set<number>();
  const toCheck = [startTriangleIndex];
  const checked = new Set<number>();
  
  // Toplam üçgen sayısını hesapla
  const totalTriangles = geometry.index 
    ? geometry.index.count / 3 
    : geometry.attributes.position.count / 3;
  
  while (toCheck.length > 0) {
    const currentIndex = toCheck.pop()!;
    
    if (checked.has(currentIndex)) continue;
    checked.add(currentIndex);
    connectedTriangles.add(currentIndex);
    
    // Diğer tüm üçgenlerle karşılaştır
    for (let i = 0; i < totalTriangles; i++) {
      if (i === currentIndex || checked.has(i)) continue;
      
      if (areTrianglesOnSameSurface(geometry, currentIndex, i, normalThreshold, distanceThreshold)) {
        toCheck.push(i);
      }
    }
  }
  
  return Array.from(connectedTriangles);
};

/**
 * Birden fazla üçgenden birleşik geometri oluştur
 */
export const createMergedGeometry = (
  geometry: THREE.BufferGeometry,
  triangleIndices: number[],
  worldMatrix: THREE.Matrix4
): THREE.BufferGeometry => {
  const allVertices: THREE.Vector3[] = [];
  const allIndices: number[] = [];
  
  triangleIndices.forEach((triangleIndex, i) => {
    const vertices = getFaceVertices(geometry, triangleIndex);
    
    // World space'e dönüştür
    const worldVertices = vertices.map(v => v.clone().applyMatrix4(worldMatrix));
    
    // Vertices'leri ekle
    allVertices.push(...worldVertices);
    
    // İndeksleri ekle
    const baseIndex = i * 3;
    allIndices.push(baseIndex, baseIndex + 1, baseIndex + 2);
  });
  
  // Yeni geometri oluştur
  const mergedGeometry = new THREE.BufferGeometry();
  const positions = new Float32Array(allVertices.length * 3);
  
  allVertices.forEach((vertex, i) => {
    positions[i * 3] = vertex.x;
    positions[i * 3 + 1] = vertex.y;
    positions[i * 3 + 2] = vertex.z;
  });
  
  mergedGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  mergedGeometry.setIndex(allIndices);
  mergedGeometry.computeVertexNormals();
  
  return mergedGeometry;
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
  // World space'e dönüştür
  const worldVertices = vertices.map(v => v.clone().applyMatrix4(worldMatrix));
  
  // Üçgen geometri oluştur
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(worldVertices.length * 3);
  
  worldVertices.forEach((vertex, i) => {
    positions[i * 3] = vertex.x;
    positions[i * 3 + 1] = vertex.y;
    positions[i * 3 + 2] = vertex.z;
  });
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex([0, 1, 2]);
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
 * Mevcut highlight'ı temizle
 */
export const clearFaceHighlight = (scene: THREE.Scene) => {
  if (currentHighlight) {
    scene.remove(currentHighlight.mesh);
    currentHighlight.mesh.geometry.dispose();
    (currentHighlight.mesh.material as THREE.Material).dispose();
    
    if (currentHighlight.mergedGeometry) {
      currentHighlight.mergedGeometry.dispose();
    }
    
    currentHighlight = null;
    console.log('🎯 Face highlight cleared');
  }
  
  // Seçimleri temizle
  selectedTriangles.clear();
  currentShapeId = null;
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
  const mesh = hit.object as THREE.Mesh;
  const geometry = mesh.geometry as THREE.BufferGeometry;
  
  if (!hit.face || hit.faceIndex === undefined) {
    console.warn('No face data in intersection');
    return null;
  }
  
  // Yeni shape'e geçildiyse seçimleri sıfırla
  if (currentShapeId !== shape.id) {
    clearFaceHighlight(scene);
    selectedTriangles.clear();
    currentShapeId = shape.id;
  }
  
  // Bu üçgenle bağlantılı tüm üçgenleri bul
  const connectedTriangles = findConnectedTriangles(geometry, hit.faceIndex);
  
  console.log(`🎯 Found ${connectedTriangles.length} connected triangles for face ${hit.faceIndex}`);
  
  // Yeni üçgenleri seçime ekle
  connectedTriangles.forEach(triangleIndex => {
    selectedTriangles.add(triangleIndex);
  });
  
  // Önce eski highlight'ı temizle
  clearFaceHighlight(scene);
  
  // Tüm seçili üçgenlerden birleşik geometri oluştur
  const worldMatrix = mesh.matrixWorld.clone();
  const mergedGeometry = createMergedGeometry(geometry, Array.from(selectedTriangles), worldMatrix);
  
  // Highlight material
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false
  });
  
  // Highlight mesh'i oluştur
  const highlightMesh = new THREE.Mesh(mergedGeometry, material);
  
  // Sahneye ekle
  scene.add(highlightMesh);
  
  // Seçim bilgilerini logla
  console.log('🎯 Surface highlighted:', {
    shapeId: shape.id,
    shapeType: shape.type,
    selectedTriangles: selectedTriangles.size,
    newTriangles: connectedTriangles.length,
    totalArea: Array.from(selectedTriangles).reduce((total, triangleIndex) => {
      const vertices = getFaceVertices(geometry, triangleIndex);
      return total + getFaceArea(vertices);
    }, 0).toFixed(1)
  });
  
  currentHighlight = {
    mesh: highlightMesh,
    faceIndex: hit.faceIndex,
    shapeId: shape.id,
    triangles: Array.from(selectedTriangles),
    mergedGeometry: mergedGeometry
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