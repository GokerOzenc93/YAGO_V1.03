import React, { useRef, useEffect, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { getBoxVertices, getDirectionVector, cycleDirection } from '../utils/vertexEditor';
import { VertexState } from '../types/vertex';

interface VertexEditorProps {
  shape: any;
  isActive: boolean;
  onVertexSelect: (index: number | null) => void;
  onDirectionChange: (direction: 'x' | 'y' | 'z') => void;
  onOffsetConfirm: (vertexIndex: number, direction: 'x' | 'y' | 'z', offset: number) => void;
}

const VertexPoint: React.FC<{
  position: THREE.Vector3;
  index: number;
  isHovered: boolean;
  isSelected: boolean;
  onClick: () => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}> = ({ position, index, isHovered, isSelected, onClick, onPointerOver, onPointerOut }) => {
  return (
    <mesh
      position={position}
      onClick={(e) => {
        e.stopPropagation();
        onClick();
      }}
      onPointerOver={(e) => {
        e.stopPropagation();
        onPointerOver();
      }}
      onPointerOut={(e) => {
        e.stopPropagation();
        onPointerOut();
      }}
    >
      <sphereGeometry args={[isSelected ? 8 : 6, 16, 16]} />
      <meshBasicMaterial color={isHovered ? '#ef4444' : isSelected ? '#f97316' : '#1f2937'} />
    </mesh>
  );
};

const DirectionArrow: React.FC<{
  position: THREE.Vector3;
  direction: 'x' | 'y' | 'z';
  isActive: boolean;
}> = ({ position, direction, isActive }) => {
  const dirVector = getDirectionVector(direction);
  const arrowLength = 50;
  const endPosition = position.clone().add(dirVector.clone().multiplyScalar(arrowLength));

  const color = direction === 'x' ? '#ef4444' : direction === 'y' ? '#22c55e' : '#3b82f6';

  return (
    <group>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              position.x, position.y, position.z,
              endPosition.x, endPosition.y, endPosition.z
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={color} linewidth={isActive ? 3 : 2} />
      </line>
      <mesh position={endPosition}>
        <coneGeometry args={[4, 10, 8]} rotation={
          direction === 'x' ? [0, 0, -Math.PI / 2] :
          direction === 'y' ? [0, 0, 0] :
          [Math.PI / 2, 0, 0]
        } />
        <meshBasicMaterial color={color} />
      </mesh>
    </group>
  );
};

export const VertexEditor: React.FC<VertexEditorProps> = ({
  shape,
  isActive,
  onVertexSelect,
  onDirectionChange,
  onOffsetConfirm
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [currentDirection, setCurrentDirection] = useState<'x' | 'y' | 'z'>('x');
  const [showArrows, setShowArrows] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setHoveredIndex(null);
      setSelectedIndex(null);
      setShowArrows(false);
    }
  }, [isActive]);

  if (!isActive || !shape.parameters) return null;

  const vertices = getBoxVertices(
    shape.parameters.width,
    shape.parameters.height,
    shape.parameters.depth
  );

  const handleVertexClick = (index: number) => {
    if (selectedIndex === index) {
      const nextDir = cycleDirection(currentDirection);
      setCurrentDirection(nextDir);
      onDirectionChange(nextDir);
      setShowArrows(true);
    } else {
      setSelectedIndex(index);
      setCurrentDirection('x');
      onVertexSelect(index);
      setShowArrows(true);
      onDirectionChange('x');
    }
  };

  const handleVertexRightClick = (index: number, e: any) => {
    e.stopPropagation();
    if (selectedIndex === index) {
      setShowArrows(false);
    }
  };

  return (
    <group
      position={[shape.position[0], shape.position[1], shape.position[2]]}
      rotation={[shape.rotation[0], shape.rotation[1], shape.rotation[2]]}
      scale={[shape.scale[0], shape.scale[1], shape.scale[2]]}
    >
      {vertices.map((vertex, index) => (
        <VertexPoint
          key={index}
          position={vertex}
          index={index}
          isHovered={hoveredIndex === index}
          isSelected={selectedIndex === index}
          onClick={() => handleVertexClick(index)}
          onPointerOver={() => setHoveredIndex(index)}
          onPointerOut={() => setHoveredIndex(null)}
        />
      ))}
      {showArrows && selectedIndex !== null && (
        <>
          <DirectionArrow
            position={vertices[selectedIndex]}
            direction="x"
            isActive={currentDirection === 'x'}
          />
          <DirectionArrow
            position={vertices[selectedIndex]}
            direction="y"
            isActive={currentDirection === 'y'}
          />
          <DirectionArrow
            position={vertices[selectedIndex]}
            direction="z"
            isActive={currentDirection === 'z'}
          />
        </>
      )}
    </group>
  );
};
