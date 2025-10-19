import * as THREE from 'three';

export interface BoxParameters {
  width: number;
  height: number;
  depth: number;
}

export interface CylinderParameters {
  radiusTop: number;
  radiusBottom: number;
  height: number;
}

export interface SphereParameters {
  radius: number;
}

export interface ConeParameters {
  radius: number;
  height: number;
}

export type GeometryParameters = BoxParameters | CylinderParameters | SphereParameters | ConeParameters;

export function createBoxGeometry(width: number, height: number, depth: number): THREE.BoxGeometry {
  const geometry = new THREE.BoxGeometry(width, height, depth);
  geometry.translate(width / 2, height / 2, depth / 2);
  return geometry;
}

export function createCylinderGeometry(radiusTop: number, radiusBottom: number, height: number): THREE.CylinderGeometry {
  return new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 32);
}

export function createSphereGeometry(radius: number): THREE.SphereGeometry {
  return new THREE.SphereGeometry(radius, 32, 32);
}

export function createConeGeometry(radius: number, height: number): THREE.ConeGeometry {
  return new THREE.ConeGeometry(radius, height, 32);
}

export function createGeometryFromType(
  type: string,
  parameters: any
): THREE.BufferGeometry {
  const params = parameters || {};

  switch (type) {
    case 'box': {
      const w = params.width ?? 100;
      const h = params.height ?? 100;
      const d = params.depth ?? 100;
      return createBoxGeometry(w, h, d);
    }
    case 'cylinder': {
      const radiusTop = params.radiusTop ?? 50;
      const radiusBottom = params.radiusBottom ?? 50;
      const height = params.height ?? 100;
      return createCylinderGeometry(radiusTop, radiusBottom, height);
    }
    case 'sphere': {
      const radius = params.radius ?? 50;
      return createSphereGeometry(radius);
    }
    case 'cone': {
      const radius = params.radius ?? 40;
      const height = params.height ?? 100;
      return createConeGeometry(radius, height);
    }
    default: {
      return createBoxGeometry(100, 100, 100);
    }
  }
}
