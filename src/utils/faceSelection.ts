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
 * Tüm yüzeyi bulma - aynı normale sahip komşu üçgenleri birleştirme
 */
export const getFullSurfaceVertices = (geometry: THREE.BufferGeometry, startFaceIndex: number): THREE.Vector3[] => {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  if (!pos) return [];

  console.log(`🎯 Starting surface detection from face ${startFaceIndex}`);
  
  // 1. Başlangıç face'inin normalini hesapla
  const startVertices = getFaceVertices(geometry, startFaceIndex);
  const targetNormal = getFaceNormal(startVertices);
  
  console.log(`🎯 Target normal: [${targetNormal.x.toFixed(3)}, ${targetNormal.y.toFixed(3)}, ${targetNormal.z.toFixed(3)}]`);

  const visited = new Set<number>();
  const surfaceFaces: number[] = [];

  const stack = [startFaceIndex];

  while (stack.length > 0) {
    const faceIndex = stack.pop()!;
    if (visited.has(faceIndex)) continue;
    visited.add(faceIndex);

    // Bu face'in normalini hesapla
    const faceVerts = getFaceVertices(geometry, faceIndex);
    const normal = getFaceNormal(faceVerts);

    // Normal benzerliğini kontrol et
    const angle = normal.angleTo(targetNormal);
    
    console.log(`📐 Face ${faceIndex} angle: ${(angle * 180 / Math.PI).toFixed(1)}°`);
    
    // Çok geniş tolerans - 45 derece
    if (angle < 0.785) { // 0.785 radyan = ~45 derece
      surfaceFaces.push(faceIndex);
      console.log(`✅ Face ${faceIndex} added to surface`);

      // Bu face'in komşularını bul
      const neighbors = getNeighborFaces(geometry, faceIndex);
      neighbors.forEach(n => {
        if (!visited.has(n)) stack.push(n);
      });
    } else {
      console.log(`❌ Face ${faceIndex} rejected - angle: ${(angle * 180 / Math.PI).toFixed(1)}°`);
    }
  }

  console.log(`🎯 Surface detection complete: ${surfaceFaces.length} faces found`);
  
  // 2. Tüm surface face'lerinin vertex'lerini topla
  const allVertices: THREE.Vector3[] = [];
  const uniqueVertices = new Map<string, THREE.Vector3>();
  
  surfaceFaces.forEach(faceIndex => {
    const vertices = getFaceVertices(geometry, faceIndex);
    vertices.forEach(vertex => {
      const key = `${vertex.x.toFixed(1)},${vertex.y.toFixed(1)},${vertex.z.toFixed(1)}`;
      if (!uniqueVertices.has(key)) {
        uniqueVertices.set(key, vertex);
        allVertices.push(vertex);
      }
    });
  });
  
  console.log(`📊 Final surface: ${surfaceFaces.length} triangles, ${allVertices.length} unique vertices`);
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
  
  // Convex hull veya basit triangulation
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(worldVertices.length * 3);
  
  worldVertices.forEach((vertex, i) => {
    positions[i * 3] = vertex.x;
    positions[i * 3 + 1] = vertex.y;
    positions[i * 3 + 2] = vertex.z;
  });
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  // Daha gelişmiş triangulation
  const indices: number[] = [];
  
  if (worldVertices.length >= 3) {
    // Convex hull yaklaşımı - tüm vertex'leri birleştir
    for (let i = 1; i < worldVertices.length - 1; i++) {
      indices.push(0, i, i + 1);
    }
    
    // Eğer çok fazla vertex varsa, daha akıllı triangulation
    if (worldVertices.length > 20) {
      // Delaunay triangulation benzeri basit yaklaşım
      const center = new THREE.Vector3();
      worldVertices.forEach(v => center.add(v));
      center.divideScalar(worldVertices.length);
      
      // Her vertex'i merkeze bağla
      for (let i = 0; i < worldVertices.length; i++) {
        const next = (i + 1) % worldVertices.length;
        indices.push(i, next, 0); // İlk vertex'i merkez olarak kullan
      }
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
  
  console.log(`🎯 Highlighting face ${hit.faceIndex} on ${shape.type} (${shape.id})`);
  
  // Face vertices'lerini al
  const vertices = getFaceVertices(geometry, hit.faceIndex);
  if (vertices.length === 0) {
    console.warn('Could not get face vertices');
    return null;
  }
  
  console.log(`📊 Single face vertices: ${vertices.length}`);
  
  // Tüm yüzeyi bul (komşu üçgenleri dahil et)
  const fullSurfaceVertices = getFullSurfaceVertices(geometry, hit.faceIndex);
  
  console.log(`📊 Full surface vertices: ${fullSurfaceVertices.length}`);
  
  // Eğer tam yüzey bulunamadıysa tek üçgeni kullan
  const surfaceVertices = fullSurfaceVertices.length >= 3 ? fullSurfaceVertices : vertices;
  
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