import * as THREE from 'three';

export const snapToGrid = (value: number, gridSize: number): number => {
  return Math.round(value / gridSize) * gridSize;
};

export const snapPointToGrid = (point: THREE.Vector3, gridSize: number): THREE.Vector3 => {
  return new THREE.Vector3(
    snapToGrid(point.x, gridSize),
    snapToGrid(point.y, gridSize),
    snapToGrid(point.z, gridSize)
  );
};

export const createRectanglePoints = (
  start: THREE.Vector3,
  end: THREE.Vector3
): THREE.Vector3[] => {
  return [
    start.clone(),
    new THREE.Vector3(end.x, start.y, start.z),
    end.clone(),
    new THREE.Vector3(start.x, end.y, start.z),
  ];
};

export const createCirclePoints = (
  center: THREE.Vector3,
  radius: number,
  segments: number = 32
): THREE.Vector3[] => {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    points.push(
      new THREE.Vector3(
        center.x + Math.cos(angle) * radius,
        center.y,
        center.z + Math.sin(angle) * radius
      )
    );
  }
  return points;
};

export const calculateDistance = (p1: THREE.Vector3, p2: THREE.Vector3): number => {
  return p1.distanceTo(p2);
};

export const getLineAngle = (start: THREE.Vector3, end: THREE.Vector3): number => {
  const dx = end.x - start.x;
  const dz = end.z - start.z;
  return Math.atan2(dz, dx);
};
