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
  
  // Face'in vertex'lerini al - TÜM VERTEX'LERİ BUL
  const faceVertices = new Set<number>(); // Benzersiz vertex'ler için Set kullan
  
  if (index) {
    // Indexed geometry
    const triangleStart = faceIndex * 3;
    for (let i = 0; i < 3; i++) {
      faceVertices.add(index.getX(triangleStart + i));
    }
    
    // Aynı pozisyondaki diğer vertex'leri de bul (quad face için)
    const currentVertices = Array.from(faceVertices);
    const currentPositions = currentVertices.map(vi => {
      const vertex = new THREE.Vector3().fromBufferAttribute(position, vi);
      return vertex.applyMatrix4(worldMatrix);
    });
    
    // Tüm vertex'leri kontrol et ve aynı pozisyondakileri ekle
    for (let vi = 0; vi < position.count; vi++) {
      if (faceVertices.has(vi)) continue;
      
      const vertex = new THREE.Vector3().fromBufferAttribute(position, vi);
      const worldVertex = vertex.applyMatrix4(worldMatrix);
      
      // Bu vertex mevcut face vertex'lerinden birine çok yakın mı?
      for (const currentPos of currentPositions) {
        if (worldVertex.distanceTo(currentPos) < 0.1) { // 0.1mm tolerans
          faceVertices.add(vi);
          break;
        }
      }
    }
  } else {
    // Non-indexed geometry
    const triangleStart = faceIndex * 3;
    for (let i = 0; i < 3; i++) {
      faceVertices.add(triangleStart + i);
    }
  }
  
  const vertexArray = Array.from(faceVertices);
  console.log(`🎯 Face ${faceIndex} vertices: ${vertexArray.join(', ')} (${vertexArray.length} total)`);
  
  // Her vertex için highlight oluştur
  vertexArray.forEach((vertexIndex, i) => {
    const vertex = new THREE.Vector3().fromBufferAttribute(position, vertexIndex);
    const worldVertex = vertex.clone().applyMatrix4(worldMatrix);
    
    // Vertex highlight sphere oluştur
    const highlight = createVertexHighlight(worldVertex, color, size);
    
    // Hover detection için userData ekle
    highlight.userData = {
      isVertexHighlight: true,
      vertexIndex: vertexIndex,
      originalColor: color,
      worldPosition: worldVertex.clone()
    };
    
    // Vertex numarasını göster (kırmızı renk)
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    context.fillStyle = 'white';
    context.fillRect(0, 0, 64, 64);
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
  console.log(`🎯 Face ${faceIndex} vertices visualized: ${vertexArray.length} vertices`);
  return group;
};

/**
 * Vertex hover detection
 */
export const detectVertexHover = (
  event: MouseEvent,
  camera: THREE.Camera,
  scene: THREE.Scene,
  canvas: HTMLCanvasElement
): THREE.Object3D | null => {
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2();
  
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  // Sadece vertex highlight'ları kontrol et
  const vertexHighlights: THREE.Object3D[] = [];
  scene.traverse((child) => {
    if (child.userData.isVertexHighlight) {
      vertexHighlights.push(child);
    }
  });
  
  const intersects = raycaster.intersectObjects(vertexHighlights);
  
  if (intersects.length > 0) {
    return intersects[0].object;
  }
  
  return null;
};

/**
 * Vertex hover state'ini güncelle
 */
export const updateVertexHoverState = (
  scene: THREE.Scene,
  hoveredVertex: THREE.Object3D | null
): void => {
  // Tüm vertex'leri normal renge çevir
  scene.traverse((child) => {
    if (child.userData.isVertexHighlight && child instanceof THREE.Mesh) {
      const material = child.material as THREE.MeshBasicMaterial;
      material.color.setHex(child.userData.originalColor);
    }
  });
  
  // Hover edilen vertex'i mavi yap
  if (hoveredVertex && hoveredVertex instanceof THREE.Mesh) {
    const material = hoveredVertex.material as THREE.MeshBasicMaterial;
    material.color.setHex(0x0066ff); // Mavi renk
  }
};

/**
 * Transform controls oluştur
 */
export const createVertexTransformControls = (
  scene: THREE.Scene,
  position: THREE.Vector3,
  camera: THREE.Camera,
  domElement: HTMLElement
): THREE.Group => {
  const group = new THREE.Group();
  group.position.copy(position);
  
  // X ekseni (kırmızı)
  const xGeometry = new THREE.CylinderGeometry(0.5, 0.5, 20, 8);
  const xMaterial = new THREE.MeshBasicMaterial({ color: 0xff0000 });
  const xArrow = new THREE.Mesh(xGeometry, xMaterial);
  xArrow.rotation.z = -Math.PI / 2;
  xArrow.position.x = 10;
  
  // X ok başı
  const xHeadGeometry = new THREE.ConeGeometry(2, 6, 8);
  const xHead = new THREE.Mesh(xHeadGeometry, xMaterial);
  xHead.rotation.z = -Math.PI / 2;
  xHead.position.x = 23;
  
  // Y ekseni (yeşil)
  const yGeometry = new THREE.CylinderGeometry(0.5, 0.5, 20, 8);
  const yMaterial = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const yArrow = new THREE.Mesh(yGeometry, yMaterial);
  yArrow.position.y = 10;
  
  // Y ok başı
  const yHeadGeometry = new THREE.ConeGeometry(2, 6, 8);
  const yHead = new THREE.Mesh(yHeadGeometry, yMaterial);
  yHead.position.y = 23;
  
  // Z ekseni (mavi)
  const zGeometry = new THREE.CylinderGeometry(0.5, 0.5, 20, 8);
  const zMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff });
  const zArrow = new THREE.Mesh(zGeometry, zMaterial);
  zArrow.rotation.x = Math.PI / 2;
  zArrow.position.z = 10;
  
  // Z ok başı
  const zHeadGeometry = new THREE.ConeGeometry(2, 6, 8);
  const zHead = new THREE.Mesh(zHeadGeometry, zMaterial);
  zHead.rotation.x = Math.PI / 2;
  zHead.position.z = 23;
  
  group.add(xArrow, xHead, yArrow, yHead, zArrow, zHead);
  
  // Transform controls için userData
  group.userData = {
    isTransformControls: true,
    vertexPosition: position.clone()
  };
  
  scene.add(group);
  return group;
};

/**
 * Transform controls'u temizle
 */
export const clearVertexTransformControls = (scene: THREE.Scene) => {
  const toRemove: THREE.Object3D[] = [];
  scene.traverse((child) => {
    if (child.userData.isTransformControls) {
      toRemove.push(child);
    }
  });
  
  toRemove.forEach(obj => {
    scene.remove(obj);
    if (obj instanceof THREE.Group) {
      obj.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          (child.material as THREE.Material).dispose();
        }
      });
    }
  });
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