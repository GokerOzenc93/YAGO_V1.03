import * as THREE from 'three';
import { CompletedShape } from './types';

export const convertTo3DShape = (
  shape: CompletedShape,
  height: number = 100
): THREE.BufferGeometry => {
  if (shape.type === 'circle' && shape.center && shape.radius) {
    return new THREE.CylinderGeometry(shape.radius, shape.radius, height, 32);
  }

  const shape2D = new THREE.Shape();
  if (shape.points.length > 0) {
    shape2D.moveTo(shape.points[0].x, shape.points[0].z);
    for (let i = 1; i < shape.points.length; i++) {
      shape2D.lineTo(shape.points[i].x, shape.points[i].z);
    }
    shape2D.closePath();
  }

  const geometry = new THREE.ExtrudeGeometry(shape2D, {
    depth: height,
    bevelEnabled: false,
  });

  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, height / 2, 0);

  return geometry;
};

export const extrudeShape = (
  points: THREE.Vector3[],
  height: number = 100
): THREE.BufferGeometry => {
  const shape = new THREE.Shape();

  if (points.length > 0) {
    shape.moveTo(points[0].x, points[0].z);
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].z);
    }
    shape.closePath();
  }

  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: false,
  });

  geometry.rotateX(-Math.PI / 2);
  geometry.translate(0, height / 2, 0);

  return geometry;
};
