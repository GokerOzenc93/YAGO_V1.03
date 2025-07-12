import * as THREE from 'three';
import { CompletedShape, SnapPoint } from './types';
import { SnapType, SnapSettings } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import { findLineIntersection } from './utils';

export const findSnapPoints = (
  mousePoint: THREE.Vector3,
  completedShapes: CompletedShape[],
  shapes: Shape[],
  snapSettings: SnapSettings,
  tolerance: number,
  currentPoint?: THREE.Vector3 | null,
  currentDirection?: THREE.Vector3 | null
): SnapPoint[] => {
  const snapPoints: SnapPoint[] = [];

  // Endpoint snapping
  if (snapSettings[SnapType.ENDPOINT]) {
    completedShapes.forEach(shape => {
      if (!shape.points || shape.points.length === 0) return;

      shape.points.forEach((point, index) => {
        if (shape.isClosed && index === shape.points.length - 1) return;
        
        const distance = mousePoint.distanceTo(point);
        if (distance <= tolerance) {
          snapPoints.push({
            point: point.clone(),
            type: SnapType.ENDPOINT,
            shapeId: shape.id,
            distance
          });
        }
      });
    });
  }

  // Midpoint snapping
  if (snapSettings[SnapType.MIDPOINT]) {
    completedShapes.forEach(shape => {
      for (let i = 0; i < shape.points.length - 1; i++) {
        if (shape.isClosed && i === shape.points.length - 2) continue;
        
        const start = shape.points[i];
        const end = shape.points[i + 1];
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        
        const distance = mousePoint.distanceTo(midpoint);
        if (distance <= tolerance) {
          snapPoints.push({
            point: midpoint,
            type: SnapType.MIDPOINT,
            shapeId: shape.id,
            distance
          });
        }
      }
    });
  }

  // Center snapping
  if (snapSettings[SnapType.CENTER]) {
    completedShapes.forEach(shape => {
      if (shape.type === 'circle' && shape.points.length >= 2) {
        const center = shape.points[0];
        const distance = mousePoint.distanceTo(center);
        if (distance <= tolerance) {
          snapPoints.push({
            point: center.clone(),
            type: SnapType.CENTER,
            shapeId: shape.id,
            distance
          });
        }
      } else if (shape.type === 'rectangle' && shape.points.length >= 4) {
        const center = new THREE.Vector3(
          (shape.points[0].x + shape.points[2].x) / 2,
          0,
          (shape.points[0].z + shape.points[2].z) / 2
        );
        const distance = mousePoint.distanceTo(center);
        if (distance <= tolerance) {
          snapPoints.push({
            point: center,
            type: SnapType.CENTER,
            shapeId: shape.id,
            distance
          });
        }
      }
    });

    // 3D shape centers
    shapes.forEach(shape => {
      const shapeCenter = new THREE.Vector3(...shape.position);
      shapeCenter.y = 0;
      const distance = mousePoint.distanceTo(shapeCenter);
      if (distance <= tolerance) {
        snapPoints.push({
          point: shapeCenter,
          type: SnapType.CENTER,
          shapeId: shape.id,
          distance
        });
      }
    });
  }

  // Quadrant snapping
  if (snapSettings[SnapType.QUADRANT]) {
    completedShapes.forEach(shape => {
      if (shape.type === 'circle' && shape.points.length >= 2) {
        const center = shape.points[0];
        const radius = center.distanceTo(shape.points[1]);
        
        const quadrants = [
          new THREE.Vector3(center.x + radius, 0, center.z),
          new THREE.Vector3(center.x - radius, 0, center.z),
          new THREE.Vector3(center.x, 0, center.z + radius),
          new THREE.Vector3(center.x, 0, center.z - radius),
        ];

        quadrants.forEach(quadPoint => {
          const distance = mousePoint.distanceTo(quadPoint);
          if (distance <= tolerance) {
            snapPoints.push({
              point: quadPoint,
              type: SnapType.QUADRANT,
              shapeId: shape.id,
              distance
            });
          }
        });
      }
    });
  }

  // Intersection snapping
  if (snapSettings[SnapType.INTERSECTION]) {
    for (let i = 0; i < completedShapes.length; i++) {
      for (let j = i + 1; j < completedShapes.length; j++) {
        const shape1 = completedShapes[i];
        const shape2 = completedShapes[j];
        
        for (let seg1 = 0; seg1 < shape1.points.length - 1; seg1++) {
          for (let seg2 = 0; seg2 < shape2.points.length - 1; seg2++) {
            const intersection = findLineIntersection(
              shape1.points[seg1], shape1.points[seg1 + 1],
              shape2.points[seg2], shape2.points[seg2 + 1]
            );
            
            if (intersection) {
              const distance = mousePoint.distanceTo(intersection);
              if (distance <= tolerance) {
                snapPoints.push({
                  point: intersection,
                  type: SnapType.INTERSECTION,
                  distance
                });
              }
            }
          }
        }
      }
    }
  }

  // Perpendicular snapping
  if (snapSettings[SnapType.PERPENDICULAR] && currentPoint && currentDirection) {
    completedShapes.forEach(shape => {
      for (let i = 0; i < shape.points.length - 1; i++) {
        const lineStart = shape.points[i];
        const lineEnd = shape.points[i + 1];
        const lineDir = new THREE.Vector3().subVectors(lineEnd, lineStart).normalize();
        
        const dot = Math.abs(currentDirection.dot(lineDir));
        if (dot < 0.1) {
          const line = new THREE.Line3(lineStart, lineEnd);
          const closestPoint = new THREE.Vector3();
          line.closestPointToPoint(mousePoint, true, closestPoint);
          
          const distance = mousePoint.distanceTo(closestPoint);
          if (distance <= tolerance) {
            snapPoints.push({
              point: closestPoint,
              type: SnapType.PERPENDICULAR,
              shapeId: shape.id,
              distance
            });
          }
        }
      }
    });
  }

  // Nearest point snapping
  if (snapSettings[SnapType.NEAREST]) {
    completedShapes.forEach(shape => {
      for (let i = 0; i < shape.points.length - 1; i++) {
        const lineStart = shape.points[i];
        const lineEnd = shape.points[i + 1];
        const line = new THREE.Line3(lineStart, lineEnd);
        const closestPoint = new THREE.Vector3();
        line.closestPointToPoint(mousePoint, true, closestPoint);
        
        const distance = mousePoint.distanceTo(closestPoint);
        if (distance <= tolerance) {
          snapPoints.push({
            point: closestPoint,
            type: SnapType.NEAREST,
            shapeId: shape.id,
            distance
          });
        }
      }
    });
  }

  return snapPoints.sort((a, b) => a.distance - b.distance);
};