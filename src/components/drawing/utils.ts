import * as THREE from 'three';
import { CompletedShape, SnapPoint } from './types';
import { SnapType, SnapSettings } from '../../store/appStore';
import { Shape } from '../../types/shapes';

export const snapToGrid = (value: number, gridSize: number): number => {
  return Math.round(value / gridSize) * gridSize;
};

export const isShapeClosed = (points: THREE.Vector3[], gridSize: number): boolean => {
  if (points.length < 3) return false;
  const firstPoint = points[0];
  const lastPoint = points[points.length - 1];
  return firstPoint.distanceTo(lastPoint) < gridSize / 2;
};

export const createRectanglePoints = (start: THREE.Vector3, end: THREE.Vector3): THREE.Vector3[] => {
  return [
    start,
    new THREE.Vector3(end.x, 0, start.z),
    end,
    new THREE.Vector3(start.x, 0, end.z),
    start
  ];
};

export const createCirclePoints = (center: THREE.Vector3, radius: number, segments: number = 32): THREE.Vector3[] => {
  const points: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2;
    const x = center.x + radius * Math.cos(theta);
    const z = center.z + radius * Math.sin(theta);
    points.push(new THREE.Vector3(x, 0, z));
  }
  return points;
};

export const calculateDimensions = (shape: CompletedShape) => {
  switch (shape.type) {
    case 'rectangle': {
      const width = Math.abs(shape.points[2].x - shape.points[0].x);
      const height = Math.abs(shape.points[2].z - shape.points[0].z);
      return { width, height };
    }
    case 'circle': {
      const radius = shape.points[0].distanceTo(shape.points[1]);
      return { radius };
    }
    default:
      return {};
  }
};

export const calculatePolylineCenter = (points: THREE.Vector3[]): THREE.Vector3 => {
  if (points.length === 0) return new THREE.Vector3(0, 0, 0);
  
  const center = new THREE.Vector3(0, 0, 0);
  let validPoints = 0;
  
  for (let i = 0; i < points.length - 1; i++) {
    center.add(points[i]);
    validPoints++;
  }
  
  if (validPoints > 0) {
    center.divideScalar(validPoints);
  }
  
  return center;
};

export const findLineIntersection = (
  p1: THREE.Vector3, p2: THREE.Vector3,
  p3: THREE.Vector3, p4: THREE.Vector3
): THREE.Vector3 | null => {
  const x1 = p1.x, y1 = p1.z;
  const x2 = p2.x, y2 = p2.z;
  const x3 = p3.x, y3 = p3.z;
  const x4 = p4.x, y4 = p4.z;

  const denom = (x1 - x2) * (y3 - y4) - (y1 - y2) * (x3 - x4);
  if (Math.abs(denom) < 1e-10) return null;

  const t = ((x1 - x3) * (y3 - y4) - (y1 - y3) * (x3 - x4)) / denom;
  const u = -((x1 - x2) * (y1 - y3) - (y1 - y2) * (x1 - x3)) / denom;

  if (t >= 0 && t <= 1 && u >= 0 && u <= 1) {
    const x = x1 + t * (x2 - x1);
    const z = y1 + t * (y2 - y1);
    return new THREE.Vector3(x, 0, z);
  }

  return null;
};