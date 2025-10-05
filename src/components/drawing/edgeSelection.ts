import * as THREE from 'three';
import { CompletedShape, EdgeInfo } from './types';

export const detectEdgeHover = (
  mousePoint: THREE.Vector3,
  completedShapes: CompletedShape[],
  tolerance: number = 10
): EdgeInfo | null => {
  let closestEdge: EdgeInfo | null = null;
  let minDistance = tolerance;

  completedShapes.forEach((shape) => {
    if (!shape.points || shape.points.length < 2) return;

    for (let i = 0; i < shape.points.length - 1; i++) {
      const startPoint = shape.points[i];
      const endPoint = shape.points[i + 1];

      const line = new THREE.Line3(startPoint, endPoint);
      const closestPointOnLine = new THREE.Vector3();
      line.closestPointToPoint(mousePoint, true, closestPointOnLine);

      const distance = mousePoint.distanceTo(closestPointOnLine);

      if (distance < minDistance) {
        minDistance = distance;
        const midPoint = new THREE.Vector3().addVectors(startPoint, endPoint).multiplyScalar(0.5);
        const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
        const length = startPoint.distanceTo(endPoint);

        closestEdge = {
          startPoint: startPoint.clone(),
          endPoint: endPoint.clone(),
          midPoint,
          length,
          direction,
          edgeIndex: i,
          shapeId: shape.id,
        };
      }
    }
  });

  return closestEdge;
};

export const updateEdgeLength = (
  shape: CompletedShape,
  edgeIndex: number,
  newLength: number
): THREE.Vector3[] => {
  if (!shape.points || edgeIndex >= shape.points.length - 1) {
    return shape.points;
  }

  const newPoints = [...shape.points];
  const startPoint = newPoints[edgeIndex];
  const endPoint = newPoints[edgeIndex + 1];

  const currentDirection = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
  const newEndPoint = startPoint.clone().add(currentDirection.multiplyScalar(newLength));

  const delta = new THREE.Vector3().subVectors(newEndPoint, endPoint);

  for (let i = edgeIndex + 1; i < newPoints.length; i++) {
    newPoints[i] = newPoints[i].clone().add(delta);
  }

  if (shape.isClosed && edgeIndex + 1 === newPoints.length - 1) {
    newPoints[0] = newPoints[0].clone().add(delta);
  }

  return newPoints;
};
