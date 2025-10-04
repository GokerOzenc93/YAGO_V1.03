import React from 'react';
import { Line, Html } from '@react-three/drei';
import * as THREE from 'three';

interface MeasurementLineProps {
  edge1: {
    start: THREE.Vector3;
    end: THREE.Vector3;
    midpoint: THREE.Vector3;
  };
  edge2: {
    start: THREE.Vector3;
    end: THREE.Vector3;
    midpoint: THREE.Vector3;
  };
  distance: string;
  measurementUnit: string;
}

const MeasurementLine: React.FC<MeasurementLineProps> = ({
  edge1,
  edge2,
  distance,
  measurementUnit
}) => {
  const lineStart = edge1.midpoint;
  const lineEnd = edge2.midpoint;
  const lineMidpoint = new THREE.Vector3().lerpVectors(lineStart, lineEnd, 0.5);

  return (
    <group>
      <Line
        points={[
          [lineStart.x, lineStart.y, lineStart.z],
          [lineEnd.x, lineEnd.y, lineEnd.z]
        ]}
        color="#3b82f6"
        lineWidth={2}
        dashed
        dashScale={1}
        dashSize={8}
        gapSize={4}
      />

      <mesh position={[lineStart.x, lineStart.y, lineStart.z]}>
        <sphereGeometry args={[3, 16, 16]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>

      <mesh position={[lineEnd.x, lineEnd.y, lineEnd.z]}>
        <sphereGeometry args={[3, 16, 16]} />
        <meshBasicMaterial color="#3b82f6" />
      </mesh>

      <Html
        position={[lineMidpoint.x, lineMidpoint.y + 20, lineMidpoint.z]}
        center
      >
        <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-bold shadow-lg">
          {distance} {measurementUnit}
        </div>
      </Html>
    </group>
  );
};

export default MeasurementLine;
