import * as THREE from 'three';

export interface VolumeEditState {
  isActive: boolean;
  selectedVertices: THREE.Vector3[];
  selectedFaceIndex: number | null;
  isDragging: boolean;
  dragStartPosition: THREE.Vector3 | null;
}

export interface FaceHighlight {
  mesh: THREE.Mesh;
  faceIndex: number;
  shapeId: string;
}

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
 * Düzlem üzerindeki tüm vertex'leri bul
 */
export const getAllVerticesOnPlane = (geometry: THREE.BufferGeometry, faceIndex: number): THREE.Vector3[] => {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  
  if (!pos) {
    console.warn('Geometry has no position attribute');
    return [];
  }

  // Seçilen face'in bilgilerini al
  const faceVertices = getFaceVertices(geometry, faceIndex);
  if (faceVertices.length < 3) return faceVertices;

  const faceNormal = getFaceNormal(faceVertices).normalize();
  const faceCenter = getFaceCenter(faceVertices);
  
  console.log(`🎯 Face ${faceIndex} normal:`, faceNormal.toArray().map(v => v.toFixed(3)));
  console.log(`🎯 Face ${faceIndex} center:`, faceCenter.toArray().map(v => v.toFixed(1)));

  // Düzlem denklemi: ax + by + cz + d = 0
  const planeD = -faceNormal.dot(faceCenter);
  const tolerance = 0.1; // 0.1mm tolerans

  // Tüm face'leri tara ve aynı düzlemde olanları bul
  const totalFaces = index ? index.count / 3 : pos.count / 3;
  const uniqueVertices = new Set<string>();
  const allVertices: THREE.Vector3[] = [];

  for (let i = 0; i < totalFaces; i++) {
    const vertices = getFaceVertices(geometry, i);
    if (vertices.length < 3) continue;

    // Bu face'in tüm vertex'leri aynı düzlemde mi kontrol et
    let allOnPlane = true;
    for (const vertex of vertices) {
      const distance = Math.abs(faceNormal.dot(vertex) + planeD);
      if (distance > tolerance) {
        allOnPlane = false;
        break;
      }
    }

    // Eğer tüm vertex'ler aynı düzlemdeyse, bunları ekle
    if (allOnPlane) {
      vertices.forEach(vertex => {
        const key = `${vertex.x.toFixed(4)},${vertex.y.toFixed(4)},${vertex.z.toFixed(4)}`;
        if (!uniqueVertices.has(key)) {
          uniqueVertices.add(key);
          allVertices.push(vertex.clone());
        }
      });
    }
  }

  console.log(`📊 Found ${allVertices.length} unique vertices on the same plane`);
  return allVertices;
};

/**
 * Vertex görselleştirme mesh'leri oluştur
 */
export const createVertexVisualization = (
  vertices: THREE.Vector3[],
  worldMatrix: THREE.Matrix4,
  scene: THREE.Scene
): THREE.Object3D[] => {
  const visualObjects: THREE.Object3D[] = [];

  vertices.forEach((vertex, index) => {
    // World space'e dönüştür
    const worldVertex = vertex.clone().applyMatrix4(worldMatrix);

    // Siyah küre oluştur
    const sphereGeometry = new THREE.SphereGeometry(12, 16, 16);
    const sphereMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x000000,
      transparent: false,
      opacity: 1.0
    });
    const sphereMesh = new THREE.Mesh(sphereGeometry, sphereMaterial);
    sphereMesh.position.copy(worldVertex);
    
    scene.add(sphereMesh);
    visualObjects.push(sphereMesh);

    // Kırmızı numara etiketi oluştur
    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d')!;
    
    context.fillStyle = 'red';
    context.font = 'bold 24px Arial';
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.fillText((index + 1).toString(), 32, 32);

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(worldVertex);
    sprite.position.y += 20; // Kürenin üstüne yerleştir
    sprite.scale.set(30, 30, 1);

    scene.add(sprite);
    visualObjects.push(sprite);

    console.log(`📍 Vertex ${index + 1} at world position:`, worldVertex.toArray().map(v => v.toFixed(1)));
  });

  return visualObjects;
};

/**
 * Face highlight mesh'i oluştur
 */
export const createFaceHighlight = (
  vertices: THREE.Vector3[],
  worldMatrix: THREE.Matrix4,
  color: number = 0xcccccc,
  opacity: number = 0.4
): THREE.Mesh => {
  console.log(`🎨 Creating face highlight with ${vertices.length} vertices`);
  
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
    for (let i = 1; i < worldVertices.length - 1; i++) {
      indices.push(0, i, i + 1);
    }
  }
  
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: opacity,
    side: THREE.DoubleSide,
    depthTest: true,
    depthWrite: false,
    wireframe: false
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  console.log(`✅ Face highlight created with ${indices.length / 3} triangles`);
  
  return mesh;
};

/**
 * Volume edit görselleştirmesini temizle
 */
export const clearVolumeEditVisualization = (scene: THREE.Scene, objects: THREE.Object3D[]) => {
  objects.forEach(obj => {
    scene.remove(obj);
    if (obj instanceof THREE.Mesh) {
      obj.geometry.dispose();
      if (obj.material instanceof THREE.Material) {
        obj.material.dispose();
      }
    } else if (obj instanceof THREE.Sprite) {
      if (obj.material instanceof THREE.SpriteMaterial && obj.material.map) {
        obj.material.map.dispose();
      }
      obj.material.dispose();
    }
  });
  console.log(`🧹 Cleared ${objects.length} volume edit visualization objects`);
};