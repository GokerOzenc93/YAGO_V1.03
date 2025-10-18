import * as THREE from 'three';
import { Shape } from '../types/shapes';

export interface EdgePoint {
  position: THREE.Vector3;
  shapeId: string;
  edgeIndex: number;
}

export const getEdgesFromShape = (shape: Shape): THREE.Vector3[][] => {
  if (!shape.geometry) return [];

  const geometry = shape.geometry;
  const positionAttribute = geometry.getAttribute('position');
  const indexAttribute = geometry.getIndex();

  if (!positionAttribute) return [];

  const edges: THREE.Vector3[][] = [];
  const edgeSet = new Set<string>();

  const addEdge = (v1: THREE.Vector3, v2: THREE.Vector3) => {
    const key1 = `${v1.x.toFixed(3)},${v1.y.toFixed(3)},${v1.z.toFixed(3)}-${v2.x.toFixed(3)},${v2.y.toFixed(3)},${v2.z.toFixed(3)}`;
    const key2 = `${v2.x.toFixed(3)},${v2.y.toFixed(3)},${v2.z.toFixed(3)}-${v1.x.toFixed(3)},${v1.y.toFixed(3)},${v1.z.toFixed(3)}`;

    if (!edgeSet.has(key1) && !edgeSet.has(key2)) {
      edgeSet.add(key1);

      const worldV1 = v1.clone().multiply(new THREE.Vector3(...shape.scale)).add(new THREE.Vector3(...shape.position));
      const worldV2 = v2.clone().multiply(new THREE.Vector3(...shape.scale)).add(new THREE.Vector3(...shape.position));

      edges.push([worldV1, worldV2]);
    }
  };

  if (indexAttribute) {
    const indices = indexAttribute.array;
    for (let i = 0; i < indices.length; i += 3) {
      const i1 = indices[i];
      const i2 = indices[i + 1];
      const i3 = indices[i + 2];

      const v1 = new THREE.Vector3(
        positionAttribute.getX(i1),
        positionAttribute.getY(i1),
        positionAttribute.getZ(i1)
      );
      const v2 = new THREE.Vector3(
        positionAttribute.getX(i2),
        positionAttribute.getY(i2),
        positionAttribute.getZ(i2)
      );
      const v3 = new THREE.Vector3(
        positionAttribute.getX(i3),
        positionAttribute.getY(i3),
        positionAttribute.getZ(i3)
      );

      addEdge(v1, v2);
      addEdge(v2, v3);
      addEdge(v3, v1);
    }
  } else {
    for (let i = 0; i < positionAttribute.count; i += 3) {
      const v1 = new THREE.Vector3(
        positionAttribute.getX(i),
        positionAttribute.getY(i),
        positionAttribute.getZ(i)
      );
      const v2 = new THREE.Vector3(
        positionAttribute.getX(i + 1),
        positionAttribute.getY(i + 1),
        positionAttribute.getZ(i + 1)
      );
      const v3 = new THREE.Vector3(
        positionAttribute.getX(i + 2),
        positionAttribute.getY(i + 2),
        positionAttribute.getZ(i + 2)
      );

      addEdge(v1, v2);
      addEdge(v2, v3);
      addEdge(v3, v1);
    }
  }

  return edges;
};

export const findClosestEdgePoint = (
  clickPoint: THREE.Vector3,
  edges: THREE.Vector3[][],
  threshold: number = 50
): { point: THREE.Vector3; edgeIndex: number } | null => {
  let closestPoint: THREE.Vector3 | null = null;
  let closestDistance = Infinity;
  let closestEdgeIndex = -1;

  edges.forEach((edge, index) => {
    const [start, end] = edge;
    const line = new THREE.Line3(start, end);
    const point = new THREE.Vector3();
    line.closestPointToPoint(clickPoint, true, point);

    const distance = clickPoint.distanceTo(point);

    if (distance < closestDistance && distance < threshold) {
      closestDistance = distance;
      closestPoint = point;
      closestEdgeIndex = index;
    }
  });

  if (closestPoint && closestEdgeIndex !== -1) {
    return { point: closestPoint, edgeIndex: closestEdgeIndex };
  }

  return null;
};

export const determineDimensionType = (
  point1: THREE.Vector3,
  point2: THREE.Vector3,
  shape: Shape
): 'width' | 'height' | 'depth' | 'custom' => {
  const delta = point2.clone().sub(point1);
  const absDelta = new THREE.Vector3(
    Math.abs(delta.x),
    Math.abs(delta.y),
    Math.abs(delta.z)
  );

  if (absDelta.x > absDelta.y && absDelta.x > absDelta.z) {
    return 'width';
  } else if (absDelta.y > absDelta.x && absDelta.y > absDelta.z) {
    return 'height';
  } else if (absDelta.z > absDelta.x && absDelta.z > absDelta.y) {
    return 'depth';
  }

  return 'custom';
};
