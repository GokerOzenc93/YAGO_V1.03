import * as THREE from 'three';
import { Shape } from '../store';

export function checkCollision(shape1: Shape, shape2: Shape): boolean {
  const box1 = new THREE.Box3().setFromObject(createMeshFromShape(shape1));
  const box2 = new THREE.Box3().setFromObject(createMeshFromShape(shape2));

  return box1.intersectsBox(box2);
}

function createMeshFromShape(shape: Shape): THREE.Mesh {
  const geometry = shape.geometry;
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material);

  mesh.position.set(...shape.position);
  mesh.rotation.set(...shape.rotation);
  mesh.scale.set(...shape.scale);

  return mesh;
}

export function getIntersectionColor(isIntersecting: boolean, isReference: boolean): string {
  if (!isReference) return '#2563eb';
  return isIntersecting ? '#eab308' : '#ef4444';
}
