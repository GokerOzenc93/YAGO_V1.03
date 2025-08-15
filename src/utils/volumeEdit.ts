import * as THREE from 'three';
import { TransformControls } from 'three/examples/jsm/controls/TransformControls.js';
import { useAppStore } from '../store/appStore';

let transformControls: TransformControls | null = null;

/**
 * Verilen pozisyonda bir düzenleme düğümü (küre) oluşturur ve sahneye ekler.
 * @param position Düğümün dünya koordinatlarındaki pozisyonu.
 * @param scene Düğümün ekleneceği Three.js sahnesi.
 * @returns Oluşturulan Mesh nesnesi.
 */
function createHandle(position: THREE.Vector3, scene: THREE.Scene): THREE.Mesh {
  const handleGeometry = new THREE.SphereGeometry(0.075); // Boyut ayarlandı
  const handleMaterial = new THREE.MeshBasicMaterial({
    color: 0xff0000, // Kırmızı renk
    depthTest: false, // Diğer nesnelerin arkasında kalsa bile görünür olmasını sağlar
  });
  const handle = new THREE.Mesh(handleGeometry, handleMaterial);
  handle.position.copy(position);
  handle.userData.isVolumeHandle = true; // Bu nesnenin bir düğüm olduğunu belirtir
  handle.renderOrder = 999; // En son (en üstte) render edilmesini sağlar
  scene.add(handle);
  return handle;
}

/**
 * Seçili yüzeye göre düzenleme düğümlerini günceller (eskileri siler, yenileri oluşturur).
 * @param scene Three.js sahnesi.
 */
export function updateVolumeEditHandles(scene: THREE.Scene) {
  const { selectedShape, selectedFaceIndex } = useAppStore.getState();

  // Sahnedeki mevcut tüm düzenleme düğümlerini temizle
  const handles = scene.children.filter((child) => child.userData.isVolumeHandle);
  handles.forEach((handle) => scene.remove(handle));

  if (selectedShape && selectedFaceIndex !== null && selectedShape.geometry) {
    const geometry = selectedShape.geometry;
    const positionAttribute = geometry.getAttribute('position');

    if (!positionAttribute) {
      console.error('Seçili nesnenin geometrisinde pozisyon verisi bulunamadı.');
      return;
    }

    const indexAttribute = geometry.getIndex();
    const verticesToDraw: THREE.Vector3[] = [];

    if (indexAttribute) {
      // Indexed Geometri (köşe noktaları tekrar kullanılır)
      const i1 = indexAttribute.getX(selectedFaceIndex * 3);
      const i2 = indexAttribute.getY(selectedFaceIndex * 3);
      const i3 = indexAttribute.getZ(selectedFaceIndex * 3);

      const uniqueVertexIndices = [...new Set([i1, i2, i3])];

      uniqueVertexIndices.forEach((vertexIndex) => {
        const vertex = new THREE.Vector3().fromBufferAttribute(
          positionAttribute,
          vertexIndex,
        );
        verticesToDraw.push(vertex);
      });
    } else {
      // Non-indexed Geometri (her yüzeyin kendi köşe noktaları vardır)
      const baseIndex = selectedFaceIndex * 3;
      const v1 = new THREE.Vector3().fromBufferAttribute(positionAttribute, baseIndex + 0);
      const v2 = new THREE.Vector3().fromBufferAttribute(positionAttribute, baseIndex + 1);
      const v3 = new THREE.Vector3().fromBufferAttribute(positionAttribute, baseIndex + 2);
      verticesToDraw.push(v1, v2, v3);
    }

    // Nesnenin dünya matrisinin güncel olduğundan emin ol
    selectedShape.updateWorldMatrix(true, false);

    // Lokal köşe noktası pozisyonlarını dünya koordinatlarına çevir ve düğümleri oluştur
    verticesToDraw.forEach((vertex) => {
      vertex.applyMatrix4(selectedShape.matrixWorld);
      createHandle(vertex, scene);
    });
  }
}

export function createVolumeEditControls(
  camera: THREE.PerspectiveCamera,
  domElement: HTMLElement,
  scene: THREE.Scene,
) {
  transformControls = new TransformControls(camera, domElement);
  scene.add(transformControls);
  return transformControls;
}

export function disposeVolumeEditControls() {
  if (transformControls) {
    transformControls.dispose();
    transformControls.removeFromParent();
    transformControls = null;
  }
}
