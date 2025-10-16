import React, { useMemo } from 'react';
import { Line, Text } from '@react-three/drei';
import * as THREE from 'three';
import { ActiveMeasurement } from '../store/appStore';
import { useAppStore } from '../store/appStore';

interface MeasurementLineProps {
  measurement: ActiveMeasurement;
}

export const MeasurementLine: React.FC<MeasurementLineProps> = ({ measurement }) => {
  const { convertToDisplayUnit, measurementUnit } = useAppStore();

  const points = useMemo(() => {
    if (!measurement.point2) return [];
    return [
      measurement.point1.position,
      measurement.point2.position
    ];
  }, [measurement]);

  const midpoint = useMemo(() => {
    if (!measurement.point2) return new THREE.Vector3();
    return new THREE.Vector3()
      .addVectors(measurement.point1.position, measurement.point2.position)
      .multiplyScalar(0.5);
  }, [measurement]);

  const displayDistance = useMemo(() => {
    const converted = convertToDisplayUnit(measurement.distance);
    return `${converted.toFixed(2)} ${measurementUnit}`;
  }, [measurement.distance, convertToDisplayUnit, measurementUnit]);

  if (!measurement.point2 || points.length === 0) return null;

  return (
    <group>
      <Line
        points={points}
        color="#ff6600"
        lineWidth={2}
        dashed={true}
        dashScale={2}
        dashSize={10}
        gapSize={5}
      />

      <mesh position={measurement.point1.position}>
        <sphereGeometry args={[5, 16, 16]} />
        <meshBasicMaterial color="#ff6600" />
      </mesh>

      <mesh position={measurement.point2.position}>
        <sphereGeometry args={[5, 16, 16]} />
        <meshBasicMaterial color="#ff6600" />
      </mesh>

      <Text
        position={[midpoint.x, midpoint.y + 30, midpoint.z]}
        fontSize={24}
        color="#ff6600"
        anchorX="center"
        anchorY="middle"
        outlineWidth={2}
        outlineColor="#ffffff"
      >
        {displayDistance}
      </Text>
    </group>
  );
};
