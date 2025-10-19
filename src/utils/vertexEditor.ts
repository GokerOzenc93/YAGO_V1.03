import * as THREE from 'three';
import { VertexModification } from '../types/vertex';

export function getBoxVertices(width: number, height: number, depth: number): THREE.Vector3[] {
  const w2 = width / 2;
  const h2 = height / 2;
  const d2 = depth / 2;

  return [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(width, 0, 0),
    new THREE.Vector3(width, height, 0),
    new THREE.Vector3(0, height, 0),
    new THREE.Vector3(0, 0, depth),
    new THREE.Vector3(width, 0, depth),
    new THREE.Vector3(width, height, depth),
    new THREE.Vector3(0, height, depth),
  ];
}

export function applyVertexModifications(
  geometry: THREE.BufferGeometry,
  modifications: VertexModification[]
): THREE.BufferGeometry {
  const positionAttribute = geometry.getAttribute('position');
  const positions = positionAttribute.array as Float32Array;

  modifications.forEach(mod => {
    const idx = mod.vertexIndex * 3;
    positions[idx] += mod.offset[0];
    positions[idx + 1] += mod.offset[1];
    positions[idx + 2] += mod.offset[2];
  });

  positionAttribute.needsUpdate = true;
  geometry.computeVertexNormals();

  return geometry;
}

export function getVertexWorldPosition(
  vertex: THREE.Vector3,
  objectMatrix: THREE.Matrix4
): THREE.Vector3 {
  return vertex.clone().applyMatrix4(objectMatrix);
}

export function getDirectionVector(direction: 'x' | 'y' | 'z'): THREE.Vector3 {
  switch (direction) {
    case 'x':
      return new THREE.Vector3(1, 0, 0);
    case 'y':
      return new THREE.Vector3(0, 1, 0);
    case 'z':
      return new THREE.Vector3(0, 0, 1);
  }
}

export function cycleDirection(current: 'x' | 'y' | 'z'): 'x' | 'y' | 'z' {
  switch (current) {
    case 'x':
      return 'y';
    case 'y':
      return 'z';
    case 'z':
      return 'x';
  }
}
