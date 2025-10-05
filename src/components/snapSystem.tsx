import React from 'react';
import * as THREE from 'three';
import { CompletedShape } from './types';

export interface SnapPoint {
  position: THREE.Vector3;
  type: 'endpoint' | 'midpoint' | 'center' | 'intersection' | 'grid';
  shape?: CompletedShape;
}

export const findSnapPoints = (
  point: THREE.Vector3,
  completedShapes: CompletedShape[],
  tolerance: number,
  snapSettings: any
): SnapPoint | null => {
  if (!snapSettings?.enabled) return null;

  let closestSnap: SnapPoint | null = null;
  let minDistance = tolerance;

  completedShapes.forEach(shape => {
    if (!shape.points || shape.points.length === 0) return;

    if (snapSettings.endpoint) {
      shape.points.forEach(p => {
        const dist = point.distanceTo(p);
        if (dist < minDistance) {
          minDistance = dist;
          closestSnap = {
            position: p.clone(),
            type: 'endpoint',
            shape
          };
        }
      });
    }

    if (snapSettings.midpoint && shape.points.length >= 2) {
      for (let i = 0; i < shape.points.length - 1; i++) {
        const mid = new THREE.Vector3()
          .addVectors(shape.points[i], shape.points[i + 1])
          .multiplyScalar(0.5);
        const dist = point.distanceTo(mid);
        if (dist < minDistance) {
          minDistance = dist;
          closestSnap = {
            position: mid,
            type: 'midpoint',
            shape
          };
        }
      }
    }

    if (snapSettings.center && shape.type === 'circle' && shape.center) {
      const dist = point.distanceTo(shape.center);
      if (dist < minDistance) {
        minDistance = dist;
        closestSnap = {
          position: shape.center.clone(),
          type: 'center',
          shape
        };
      }
    }
  });

  return closestSnap;
};

interface SnapPointIndicatorsProps {
  snapPoint: SnapPoint | null;
}

export const SnapPointIndicators: React.FC<SnapPointIndicatorsProps> = ({ snapPoint }) => {
  if (!snapPoint) return null;

  const getColor = () => {
    switch (snapPoint.type) {
      case 'endpoint': return '#00ff00';
      case 'midpoint': return '#00ffff';
      case 'center': return '#ff00ff';
      case 'intersection': return '#ffff00';
      case 'grid': return '#ffffff';
      default: return '#ffffff';
    }
  };

  return (
    <group position={snapPoint.position}>
      <mesh>
        <sphereGeometry args={[5, 8, 8]} />
        <meshBasicMaterial color={getColor()} transparent opacity={0.8} />
      </mesh>
      <mesh>
        <ringGeometry args={[8, 12, 16]} />
        <meshBasicMaterial color={getColor()} transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
    </group>
  );
};
