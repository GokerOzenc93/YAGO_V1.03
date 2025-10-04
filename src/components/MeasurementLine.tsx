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
  parameterLabel: string;
}

const MeasurementLine: React.FC<MeasurementLineProps> = ({
  edge1,
  edge2,
  distance,
  measurementUnit,
  parameterLabel
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
        color="#9ca3af"
        lineWidth={1.5}
        dashed
        dashScale={1}
        dashSize={8}
        gapSize={4}
      />

      <Line
        points={[
          [lineStart.x, lineStart.y, lineStart.z],
          [lineStart.x, lineStart.y, lineStart.z]
        ]}
        color="#9ca3af"
        lineWidth={1}
        dashed
        dashScale={1}
        dashSize={8}
        gapSize={4}
      />

      <Line
        points={[
          [lineEnd.x, lineEnd.y, lineEnd.z],
          [lineEnd.x, lineEnd.y, lineEnd.z]
        ]}
        color="#9ca3af"
        lineWidth={1}
        dashed
        dashScale={1}
        dashSize={8}
        gapSize={4}
      />

      <Html
        position={[lineMidpoint.x, lineMidpoint.y + 20, lineMidpoint.z]}
        center
      >
        <div className="text-gray-800 text-sm font-semibold whitespace-nowrap bg-white px-1">
          {parameterLabel}: {distance} {measurementUnit}
        </div>
      </Html>
    </group>
  );
};

export default MeasurementLine;
