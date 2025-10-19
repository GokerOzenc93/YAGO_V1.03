import * as THREE from 'three';

export function createBoxGeometry(width: number, height: number, depth: number): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(width / 2, height / 2, depth / 2);
  return geometry;
}

export function createGeometryFromType(type: string, parameters: any): THREE.BufferGeometry {
  const params = parameters || {};

  switch (type) {
    case 'box': {
      const w = params.width ?? 100;
      const h = params.height ?? 100;
      const d = params.depth ?? 100;
      return createBoxGeometry(w, h, d);
    }
    default: {
      return createBoxGeometry(100, 100, 100);
    }
  }
}
