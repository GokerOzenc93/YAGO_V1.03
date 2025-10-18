import React, { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';

interface EdgeHighlightProps {
  edges: THREE.Vector3[][];
  hoveredEdgeIndex: number | null;
  selectedEdgeIndices: number[];
}

export const EdgeHighlight: React.FC<EdgeHighlightProps> = ({
  edges,
  hoveredEdgeIndex,
  selectedEdgeIndices,
}) => {
  const groupRef = useRef<THREE.Group>(null);

  return (
    <group ref={groupRef}>
      {edges.map((edge, index) => {
        const isHovered = hoveredEdgeIndex === index;
        const isSelected = selectedEdgeIndices.includes(index);

        if (!isHovered && !isSelected) return null;

        const [start, end] = edge;
        const points = [start, end];

        return (
          <line key={`highlight-${index}`}>
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={points.length}
                array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
                itemSize={3}
              />
            </bufferGeometry>
            <lineBasicMaterial
              color="#ff0000"
              linewidth={4}
              transparent={false}
              depthTest={false}
              depthWrite={false}
            />
          </line>
        );
      })}
    </group>
  );
};
