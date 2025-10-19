import React, { useEffect, useState } from 'react';
import * as THREE from 'three';
import { getBoxVertices } from '../utils/vertexEditor';

interface VertexEditorProps {
  shape: any;
  isActive: boolean;
  onVertexSelect: (index: number | null) => void;
  onDirectionChange: (direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-') => void;
  onOffsetConfirm: (vertexIndex: number, direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-', offset: number) => void;
}

const VertexPoint: React.FC<{
  position: THREE.Vector3;
  index: number;
  isHovered: boolean;
  isSelected: boolean;
  onClick: (e: any) => void;
  onContextMenu: (e: any) => void;
  onPointerOver: () => void;
  onPointerOut: () => void;
}> = ({ position, index, isHovered, isSelected, onClick, onContextMenu, onPointerOver, onPointerOut }) => {
  return (
    <mesh
      position={position}
      onClick={onClick}
      onContextMenu={onContextMenu}
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
  direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';
}> = ({ position, direction }) => {
  const getDirectionVector = (): THREE.Vector3 => {
    switch (direction) {
      case 'x+': return new THREE.Vector3(1, 0, 0);
      case 'x-': return new THREE.Vector3(-1, 0, 0);
      case 'y+': return new THREE.Vector3(0, 1, 0);
      case 'y-': return new THREE.Vector3(0, -1, 0);
      case 'z+': return new THREE.Vector3(0, 0, 1);
      case 'z-': return new THREE.Vector3(0, 0, -1);
    }
  };

  const dirVector = getDirectionVector();
  const arrowLength = 50;
  const endPosition = position.clone().add(dirVector.clone().multiplyScalar(arrowLength));

  const getRotation = (): [number, number, number] => {
    switch (direction) {
      case 'x+': return [0, 0, -Math.PI / 2];
      case 'x-': return [0, 0, Math.PI / 2];
      case 'y+': return [0, 0, 0];
      case 'y-': return [Math.PI, 0, 0];
      case 'z+': return [Math.PI / 2, 0, 0];
      case 'z-': return [-Math.PI / 2, 0, 0];
    }
  };

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
        <lineBasicMaterial color="#ef4444" linewidth={3} />
      </line>
      <mesh position={endPosition} rotation={getRotation()}>
        <coneGeometry args={[4, 10, 8]} />
        <meshBasicMaterial color="#ef4444" />
      </mesh>
    </group>
  );
};

const DirectionSelector: React.FC<{
  position: THREE.Vector3;
  onDirectionSelect: (direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-') => void;
}> = ({ position, onDirectionSelect }) => {
  const directions: Array<'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-'> = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-'];

  const getDirectionVector = (dir: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-'): THREE.Vector3 => {
    switch (dir) {
      case 'x+': return new THREE.Vector3(1, 0, 0);
      case 'x-': return new THREE.Vector3(-1, 0, 0);
      case 'y+': return new THREE.Vector3(0, 1, 0);
      case 'y-': return new THREE.Vector3(0, -1, 0);
      case 'z+': return new THREE.Vector3(0, 0, 1);
      case 'z-': return new THREE.Vector3(0, 0, -1);
    }
  };

  const getColor = (dir: string): string => {
    if (dir.startsWith('x')) return '#ef4444';
    if (dir.startsWith('y')) return '#22c55e';
    return '#3b82f6';
  };

  const getRotation = (dir: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-'): [number, number, number] => {
    switch (dir) {
      case 'x+': return [0, 0, -Math.PI / 2];
      case 'x-': return [0, 0, Math.PI / 2];
      case 'y+': return [0, 0, 0];
      case 'y-': return [Math.PI, 0, 0];
      case 'z+': return [Math.PI / 2, 0, 0];
      case 'z-': return [-Math.PI / 2, 0, 0];
    }
  };

  return (
    <group>
      {directions.map((dir) => {
        const dirVector = getDirectionVector(dir);
        const arrowLength = 60;
        const endPosition = position.clone().add(dirVector.clone().multiplyScalar(arrowLength));
        const color = getColor(dir);

        return (
          <group key={dir}>
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
              <lineBasicMaterial color={color} linewidth={3} transparent opacity={0.8} />
            </line>
            <mesh
              position={endPosition}
              rotation={getRotation(dir)}
              onClick={(e) => {
                e.stopPropagation();
                onDirectionSelect(dir);
              }}
            >
              <coneGeometry args={[8, 16, 8]} />
              <meshBasicMaterial color={color} />
            </mesh>
          </group>
        );
      })}
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
  const [currentDirection, setCurrentDirection] = useState<'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-' | null>(null);
  const [showDirectionSelector, setShowDirectionSelector] = useState(false);

  useEffect(() => {
    if (!isActive) {
      setHoveredIndex(null);
      setSelectedIndex(null);
      setCurrentDirection(null);
      setShowDirectionSelector(false);
    }
  }, [isActive]);

  if (!isActive || !shape.parameters) return null;

  const vertices = getBoxVertices(
    shape.parameters.width,
    shape.parameters.height,
    shape.parameters.depth
  );

  const modifiedVertices = vertices.map((vertex, index) => {
    if (shape.vertexModifications) {
      const mod = shape.vertexModifications.find((m: any) => m.vertexIndex === index);
      if (mod) {
        return new THREE.Vector3(mod.newPosition[0], mod.newPosition[1], mod.newPosition[2]);
      }
    }
    return vertex;
  });

  const handleVertexClick = (index: number, e: any) => {
    e.stopPropagation();

    if (selectedIndex === index && currentDirection) {
      setShowDirectionSelector(true);
      console.log(`🔄 Change direction for vertex ${index}`);
    } else {
      setSelectedIndex(index);
      setCurrentDirection(null);
      setShowDirectionSelector(true);
      onVertexSelect(index);
      console.log(`✓ Vertex ${index} selected - Choose direction`);
    }
  };

  const handleDirectionSelect = (direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-') => {
    setCurrentDirection(direction);
    setShowDirectionSelector(false);
    onDirectionChange(direction);
    console.log(`✓ Direction ${direction} selected - Right-click to confirm`);
  };

  const handleVertexRightClick = (index: number, e: any) => {
    e.stopPropagation();
    if (selectedIndex === index && currentDirection) {
      console.log(`✓ Confirmed - Waiting for terminal input for vertex ${index} (${currentDirection})`);
      (window as any).pendingVertexEdit = true;
    }
  };

  const handleVertexDoubleClick = (index: number, e: any) => {
    e.stopPropagation();
    if (selectedIndex === index && currentDirection) {
      setShowDirectionSelector(true);
      setCurrentDirection(null);
      console.log(`🔄 Change direction for vertex ${index}`);
    }
  };

  return (
    <group
      position={[shape.position[0], shape.position[1], shape.position[2]]}
      rotation={[shape.rotation[0], shape.rotation[1], shape.rotation[2]]}
      scale={[shape.scale[0], shape.scale[1], shape.scale[2]]}
    >
      {modifiedVertices.map((vertex, index) => (
        <VertexPoint
          key={index}
          position={vertex}
          index={index}
          isHovered={hoveredIndex === index}
          isSelected={selectedIndex === index}
          onClick={(e) => handleVertexClick(index, e)}
          onContextMenu={(e) => handleVertexRightClick(index, e)}
          onPointerOver={() => setHoveredIndex(index)}
          onPointerOut={() => setHoveredIndex(null)}
        />
      ))}
      {showDirectionSelector && selectedIndex !== null && (
        <DirectionSelector
          position={modifiedVertices[selectedIndex]}
          onDirectionSelect={handleDirectionSelect}
        />
      )}
      {currentDirection && selectedIndex !== null && !showDirectionSelector && (
        <DirectionArrow
          position={modifiedVertices[selectedIndex]}
          direction={currentDirection}
        />
      )}
    </group>
  );
};
