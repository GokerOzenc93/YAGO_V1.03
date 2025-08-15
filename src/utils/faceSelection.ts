import * as THREE from 'three';
import { useAppStore } from '../store/appStore';

let highlightedFace: THREE.Mesh | null = null;
const highlightMaterial = new THREE.MeshBasicMaterial({
  color: 0x00ff00,
  side: THREE.DoubleSide,
  transparent: true,
  opacity: 0.5,
});

function clearHighlight() {
  if (highlightedFace) {
    highlightedFace.parent?.remove(highlightedFace);
    highlightedFace.dispose();
    highlightedFace = null;
  }
}

function highlightFace(object: THREE.Mesh, faceIndex: number) {
  clearHighlight();

  const geometry = object.geometry;
  const positionAttribute = geometry.getAttribute('position');
  const indexAttribute = geometry.getIndex();

  if (!positionAttribute) return;

  const faceVertices: THREE.Vector3[] = [];

  if (indexAttribute) {
    const i1 = indexAttribute.getX(faceIndex * 3);
    const i2 = indexAttribute.getY(faceIndex * 3);
    const i3 = indexAttribute.getZ(faceIndex * 3);
    faceVertices.push(new THREE.Vector3().fromBufferAttribute(positionAttribute, i1));
    faceVertices.push(new THREE.Vector3().fromBufferAttribute(positionAttribute, i2));
    faceVertices.push(new THREE.Vector3().fromBufferAttribute(positionAttribute, i3));
  } else {
    const i1 = faceIndex * 3;
    const i2 = faceIndex * 3 + 1;
    const i3 = faceIndex * 3 + 2;
    faceVertices.push(new THREE.Vector3().fromBufferAttribute(positionAttribute, i1));
    faceVertices.push(new THREE.Vector3().fromBufferAttribute(positionAttribute, i2));
    faceVertices.push(new THREE.Vector3().fromBufferAttribute(positionAttribute, i3));
  }

  const highlightGeometry = new THREE.BufferGeometry().setFromPoints(faceVertices);
  highlightedFace = new THREE.Mesh(highlightGeometry, highlightMaterial);
  object.add(highlightedFace);
}

export function handleFaceSelection(
  event: MouseEvent,
  camera: THREE.PerspectiveCamera,
  scene: THREE.Scene,
  renderer: THREE.WebGLRenderer,
  setSelectedFace: (face: THREE.Face | null) => void,
  setSelectedObject: (object: THREE.Object3D | null) => void,
) {
  const mouse = new THREE.Vector2();
  mouse.x = (event.clientX / renderer.domElement.clientWidth) * 2 - 1;
  mouse.y = -(event.clientY / renderer.domElement.clientHeight) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);

  const intersects = raycaster.intersectObjects(scene.children, true);
  
  const resetSelection = () => {
    clearHighlight();
    setSelectedFace(null);
    setSelectedObject(null);
    useAppStore.getState().setSelectedFaceIndex(null);
    useAppStore.getState().setSelectedShape(null);
  };

  if (intersects.length > 0) {
    const intersection = intersects[0];
    const object = intersection.object;

    if (
      object instanceof THREE.Mesh &&
      object.geometry &&
      intersection.face &&
      intersection.faceIndex !== undefined
    ) {
      const face = intersection.face;
      // HATA DÜZELTME: Önceden burada köşe noktası indeksi olan `intersection.face.a` kullanılıyordu.
      // Bu, `intersection.faceIndex` olarak düzeltildi, bu sayede yüzeyin doğru indeksini alıyoruz.
      const faceIndex = intersection.faceIndex;

      setSelectedFace(face);
      setSelectedObject(object);
      useAppStore.getState().setSelectedFaceIndex(faceIndex);
      useAppStore.getState().setSelectedShape(object as THREE.Mesh);

      // "Volume edit" modunda değilsek yüzeyi vurgula
      if (useAppStore.getState().editMode !== 'volume') {
        highlightFace(object, faceIndex);
      } else {
        clearHighlight();
      }
    } else {
        resetSelection();
    }
  } else {
    resetSelection();
  }
}
