import React from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';

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
  return (
    <group>
      {edges.map((edge, index) => {
        const isHovered = hoveredEdgeIndex === index;
        const isSelected = selectedEdgeIndices.includes(index);

        if (!isHovered && !isSelected) return null;

        const [start, end] = edge;

        return (
          <Line
            key={`highlight-${index}`}
            points={[start, end]}
            color="#ff0000"
            lineWidth={4}
            depthTest={false}
            depthWrite={false}
            renderOrder={999}
          />
        );
      })}
    </group>
  );
};
