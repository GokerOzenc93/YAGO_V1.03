import * as THREE from 'three';
import { Shape } from '../types/shapes';

export interface VolumeEditState {
  isActive: boolean;
  selectedVertexIndex: number | null;
  isDragging: boolean;
  dragStartPosition: THREE.Vector3 | null;
}

export interface VertexHit {
  vertexIndex: number;
  worldPosition: THREE.Vector3;
  distance: number;
}

/**
 * Vertex selection için raycasting
 */
export const detectVertexAtMouse = (
  event: MouseEvent,
  camera: THREE.Camera,
  mesh: THREE.Mesh,
  canvas: HTMLCanvasElement,
  tolerance: number = 20 // pixel tolerance
): VertexHit | null => {
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2();
  
  // Mouse koordinatlarını normalize et
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const position = geometry.attributes.position;
  
  if (!position) {
    console.warn('Geometry has no position attribute');
    return null;
  }
  
  const worldMatrix = mesh.matrixWorld;
  const vertices: VertexHit[] = [];
  
  // Tüm vertex'leri kontrol et
  for (let i = 0; i < position.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
    const worldVertex = vertex.clone().applyMatrix4(worldMatrix);
    
    // World space'den screen space'e dönüştür
    const screenVertex = worldVertex.clone().project(camera);
    
    // Screen koordinatlarını pixel'e çevir
    const screenX = (screenVertex.x * 0.5 + 0.5) * canvas.clientWidth;
    const screenY = (-screenVertex.y * 0.5 + 0.5) * canvas.clientHeight;
    
    // Mouse ile vertex arasındaki mesafeyi hesapla
    const mouseX = event.clientX - rect.left;
    const mouseY = event.clientY - rect.top;
    
    const distance = Math.sqrt(
      Math.pow(screenX - mouseX, 2) + Math.pow(screenY - mouseY, 2)
    );
    
    if (distance <= tolerance) {
      vertices.push({
        vertexIndex: i,
        worldPosition: worldVertex,
        distance
      });
    }
  }
  
  // En yakın vertex'i döndür
  if (vertices.length > 0) {
    vertices.sort((a, b) => a.distance - b.distance);
    const closest = vertices[0];
    
    console.log('🎯 Vertex detected:', {
      index: closest.vertexIndex,
      worldPosition: closest.worldPosition.toArray().map(v => v.toFixed(1)),
      screenDistance: closest.distance.toFixed(1)
    });
    
    return closest;
  }
  
  return null;
};

/**
 * Vertex pozisyonunu güncelle
 */
export const updateVertexPosition = (
  mesh: THREE.Mesh,
  vertexIndex: number,
  newWorldPosition: THREE.Vector3
): void => {
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const position = geometry.attributes.position;
  
  if (!position) {
    console.warn('Geometry has no position attribute');
    return;
  }
  
  // World space'den local space'e dönüştür
  const inverseMatrix = mesh.matrixWorld.clone().invert();
  const localPosition = newWorldPosition.clone().applyMatrix4(inverseMatrix);
  
  // Vertex pozisyonunu güncelle
  position.setXYZ(vertexIndex, localPosition.x, localPosition.y, localPosition.z);
  position.needsUpdate = true;
  
  // Geometry'yi yeniden hesapla
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  
  console.log(`🎯 Vertex ${vertexIndex} updated:`, {
    worldPosition: newWorldPosition.toArray().map(v => v.toFixed(1)),
    localPosition: localPosition.toArray().map(v => v.toFixed(1))
  });
};

/**
 * Vertex highlight mesh'i oluştur
 */
export const createVertexHighlight = (
  worldPosition: THREE.Vector3,
  color: number = 0x000000,
  size: number = 5
): THREE.Mesh => {
  const geometry = new THREE.SphereGeometry(size, 8, 6);
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 1.0,
    depthTest: false
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.copy(worldPosition);
  mesh.renderOrder = 1000;
  
  return mesh;
};

/**
 * Mouse pozisyonundan 3D pozisyon hesapla (plane intersection)
 */
export const getWorldPositionFromMouse = (
  event: MouseEvent,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  constraintPlane?: THREE.Plane
): THREE.Vector3 | null => {
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2();
  
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  if (constraintPlane) {
    // Belirli bir düzlemle kesişim
    const intersection = new THREE.Vector3();
    const intersected = raycaster.ray.intersectPlane(constraintPlane, intersection);
    return intersected;
  } else {
    // XZ düzlemi ile kesişim (Y=0)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersection = new THREE.Vector3();
    const intersected = raycaster.ray.intersectPlane(plane, intersection);
    return intersected;
  }
};

/**
 * Vertex'leri görselleştir (debug amaçlı)
 */
export const visualizeVertices = (
  scene: THREE.Scene,
  mesh: THREE.Mesh,
  color: number = 0x00ff00,
  size: number = 8
): THREE.Group => {
  const group = new THREE.Group();
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const position = geometry.attributes.position;
  
  if (!position) return group;
  
  const worldMatrix = mesh.matrixWorld;
  
  for (let i = 0; i < position.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(position, i);
    const worldVertex = vertex.clone().applyMatrix4(worldMatrix);
    
    const highlight = createVertexHighlight(worldVertex, color, size);
    group.add(highlight);
  }
  
  scene.add(group);
  return group;
};

/**
 * Seçilen face'in vertex'lerini görselleştir
 */
export const visualizeFaceVertices = (
  scene: THREE.Scene,
  mesh: THREE.Mesh,
  faceIndex: number,
  color: number = 0x000000,
  size: number = 10
): THREE.Group => {
  const group = new THREE.Group();
  const geometry = mesh.geometry as THREE.BufferGeometry;
  const position = geometry.attributes.position;
  const index = geometry.index;
  
  if (!position) return group;
  
  const worldMatrix = mesh.matrixWorld;
  
  // Face'in vertex'lerini al
  const faceVertices: number[] = [];
  if (index) {
    // Indexed geometry
    const a = faceIndex * 3;
    faceVertices.push(
      index.getX(a),
      index.getX(a + 1), 
      index.getX(a + 2)
    );
  } else {
    // Non-indexed geometry
    const a = faceIndex * 3;
    faceVertices.push(a, a + 1, a + 2);
  }
  
  console.log(`🎯 Face ${faceIndex} vertices: ${faceVertices.join(', ')}`);
  
  // Her vertex için highlight oluştur
  faceVertices.forEach((vertexIndex, i) => {
    const vertex = new THREE.Vector3().fromBufferAttribute(position, vertexIndex);
    const worldVertex = vertex.clone().applyMatrix4(worldMatrix);
    
    const highlight = createVertexHighlight(worldVertex, color, size);
    
    // Vertex numarasını göster
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'red';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.fillText((i + 1).toString(), 32, 40);
    
    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(worldVertex);
    sprite.position.y += size * 3;
    sprite.scale.set(size * 4, size * 4, 1);
    
    group.add(highlight);
    group.add(sprite);
    
    console.log(`🎯 Vertex ${i + 1} at world position: [${worldVertex.x.toFixed(1)}, ${worldVertex.y.toFixed(1)}, ${worldVertex.z.toFixed(1)}]`);
  });
  
  scene.add(group);
  console.log(`🎯 Face ${faceIndex} vertices visualized: ${faceVertices.length} vertices`);
  return group;
};

/**
 * Vertex görselleştirmesini temizle
 */
export const clearVertexVisualization = (scene: THREE.Scene, group: THREE.Group) => {
  scene.remove(group);
  
  // Tüm geometri ve materyalleri temizle
  group.traverse((child) => {
    if (child instanceof THREE.Mesh) {
      child.geometry.dispose();
      (child.material as THREE.Material).dispose();
    } else if (child instanceof THREE.Sprite) {
      (child.material as THREE.SpriteMaterial).map?.dispose();
      (child.material as THREE.Material).dispose();
    }
  });
  
  group.clear();
  console.log('🎯 Vertex visualization cleared');
};