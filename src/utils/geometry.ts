import * as THREE from 'three';
import { VertexModification } from '../types/vertex';

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

export function applyVertexModificationsToGeometry(
  geometry: THREE.BufferGeometry,
  modifications: VertexModification[],
  currentParams: BoxParameters
): THREE.BufferGeometry {
  if (!modifications || modifications.length === 0) {
    return geometry;
  }

  const positionAttribute = geometry.getAttribute('position');
  const positions = positionAttribute.array as Float32Array;

  modifications.forEach((mod) => {
    const currentBaseVertices = [
      [0, 0, 0],
      [currentParams.width, 0, 0],
      [currentParams.width, currentParams.height, 0],
      [0, currentParams.height, 0],
      [0, 0, currentParams.depth],
      [currentParams.width, 0, currentParams.depth],
      [currentParams.width, currentParams.height, currentParams.depth],
      [0, currentParams.height, currentParams.depth],
    ];

    const currentBasePos = currentBaseVertices[mod.vertexIndex];
    const vertexIndices = findAllVertexOccurrences(positions, currentBasePos as [number, number, number]);

    vertexIndices.forEach((idx) => {
      positions[idx] = mod.newPosition[0];
      positions[idx + 1] = mod.newPosition[1];
      positions[idx + 2] = mod.newPosition[2];
    });
  });

  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
}

function findAllVertexOccurrences(
  positions: Float32Array,
  targetPosition: [number, number, number]
): number[] {
  const indices: number[] = [];
  const epsilon = 0.001;

  for (let i = 0; i < positions.length; i += 3) {
    if (
      Math.abs(positions[i] - targetPosition[0]) < epsilon &&
      Math.abs(positions[i + 1] - targetPosition[1]) < epsilon &&
      Math.abs(positions[i + 2] - targetPosition[2]) < epsilon
    ) {
      indices.push(i);
    }
  }

  return indices;
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
