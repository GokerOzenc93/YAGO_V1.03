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
  
  // Face vertices'lerini al
  const vertices = getFaceVertices(geometry, hit.faceIndex);
  if (vertices.length === 0) {
    console.warn('Could not get face vertices');
    return null;
  }
  
  // World matrix'i al
  const worldMatrix = mesh.matrixWorld.clone();
  
  // Highlight mesh'i oluştur
  const highlightMesh = createFaceHighlight(vertices, worldMatrix, color, opacity);
  
  // Sahneye ekle
  scene.add(highlightMesh);
  
  // Face bilgilerini logla
  const faceNormal = getFaceNormal(vertices);
  const faceCenter = getFaceCenter(vertices);
  const faceArea = getFaceArea(vertices);
  
  console.log('🎯 Face highlighted:', {
    shapeId: shape.id,
    shapeType: shape.type,
    faceIndex: hit.faceIndex,
    faceCenter: faceCenter.toArray().map(v => v.toFixed(1)),
    faceNormal: faceNormal.toArray().map(v => v.toFixed(2)),
    faceArea: faceArea.toFixed(1),
    vertexCount: vertices.length
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