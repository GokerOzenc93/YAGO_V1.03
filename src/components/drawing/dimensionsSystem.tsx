import React from 'react';
import * as THREE from 'three';
import { Text, Billboard } from '@react-three/drei';
import { useAppStore, MeasurementUnit } from '../../store/appStore';

export interface DimensionLine {
  id: string;
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  distance: number;
  position: THREE.Vector3; // Text position
  visible: boolean;
}

interface DimensionsState {
  isActive: boolean;
  firstPoint: THREE.Vector3 | null;
  previewPoint: THREE.Vector3 | null;
  dimensions: DimensionLine[];
}

export const INITIAL_DIMENSIONS_STATE: DimensionsState = {
  isActive: false,
  firstPoint: null,
  previewPoint: null,
  dimensions: [],
};

interface DimensionDisplayProps {
  dimensions: DimensionLine[];
  measurementUnit: MeasurementUnit;
  convertToDisplayUnit: (value: number) => number;
}

export const DimensionDisplay: React.FC<DimensionDisplayProps> = ({
  dimensions,
  measurementUnit,
  convertToDisplayUnit,
}) => {
  return (
    <>
      {dimensions.map((dimension) => (
        <group key={dimension.id}>
          {/* Dimension line */}
          <line>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={2}
                array={new Float32Array([
                  dimension.startPoint.x, dimension.startPoint.y, dimension.startPoint.z,
                  dimension.endPoint.x, dimension.endPoint.y, dimension.endPoint.z,
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial color="#10b981" linewidth={2} />
          </line>

          {/* Start point marker */}
          <mesh position={dimension.startPoint}>
            <sphereGeometry args={[8]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>

          {/* End point marker */}
          <mesh position={dimension.endPoint}>
            <sphereGeometry args={[8]} />
            <meshBasicMaterial color="#10b981" />
          </mesh>

          {/* Dimension text */}
          <Billboard position={dimension.position}>
            <mesh>
              <planeGeometry args={[120, 30]} />
              <meshBasicMaterial color="#000000" transparent opacity={0.8} />
            </mesh>
            <Text
              position={[0, 0, 0.1]}
              fontSize={12}
              color="#10b981"
              anchorX="center"
              anchorY="middle"
              font="/fonts/inter-medium.woff"
            >
              {`${convertToDisplayUnit(dimension.distance).toFixed(1)} ${measurementUnit}`}
            </Text>
          </Billboard>
        </group>
      ))}
    </>
  );
};

interface DimensionPreviewProps {
  firstPoint: THREE.Vector3;
  previewPoint: THREE.Vector3;
  measurementUnit: MeasurementUnit;
  convertToDisplayUnit: (value: number) => number;
}

export const DimensionPreview: React.FC<DimensionPreviewProps> = ({
  firstPoint,
  previewPoint,
  measurementUnit,
  convertToDisplayUnit,
}) => {
  const distance = firstPoint.distanceTo(previewPoint);
  const midPoint = new THREE.Vector3()
    .addVectors(firstPoint, previewPoint)
    .multiplyScalar(0.5)
    .add(new THREE.Vector3(0, 50, 0)); // Slightly above

  return (
    <group>
      {/* Preview line */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              firstPoint.x, firstPoint.y, firstPoint.z,
              previewPoint.x, previewPoint.y, previewPoint.z,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#10b981" opacity={0.7} transparent linewidth={2} />
      </line>

      {/* Preview points */}
      <mesh position={firstPoint}>
        <sphereGeometry args={[8]} />
        <meshBasicMaterial color="#10b981" opacity={0.7} transparent />
      </mesh>

      <mesh position={previewPoint}>
        <sphereGeometry args={[8]} />
        <meshBasicMaterial color="#10b981" opacity={0.7} transparent />
      </mesh>

      {/* Preview text */}
      <Billboard position={midPoint}>
        <mesh>
          <planeGeometry args={[120, 30]} />
          <meshBasicMaterial color="#000000" transparent opacity={0.6} />
        </mesh>
        <Text
          position={[0, 0, 0.1]}
          fontSize={12}
          color="#10b981"
          anchorX="center"
          anchorY="middle"
        >
          {`${convertToDisplayUnit(distance).toFixed(1)} ${measurementUnit}`}
        </Text>
      </Billboard>
    </group>
  );
};

export const createDimension = (
  startPoint: THREE.Vector3,
  endPoint: THREE.Vector3
): DimensionLine => {
  const distance = startPoint.distanceTo(endPoint);
  const midPoint = new THREE.Vector3()
    .addVectors(startPoint, endPoint)
    .multiplyScalar(0.5)
    .add(new THREE.Vector3(0, 50, 0)); // Text position slightly above

  return {
    id: Math.random().toString(36).substr(2, 9),
    startPoint: startPoint.clone(),
    endPoint: endPoint.clone(),
    distance,
    position: midPoint,
    visible: true,
  };
};