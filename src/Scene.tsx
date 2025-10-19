import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport } from '@react-three/drei';
import { useAppStore } from './store';
import * as THREE from 'three';

const Scene: React.FC = () => {
  const controlsRef = useRef<any>(null);
  const { shapes, selectedShapeId, selectShape, deleteShape } = useAppStore();

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedShapeId) {
        deleteShape(selectedShapeId);
      } else if (e.key === 'Escape') {
        selectShape(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, deleteShape, selectShape]);

  return (
    <Canvas
      shadows
      gl={{
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true
      }}
      dpr={[1, 2]}
    >
      <color attach="background" args={['#f5f5f4']} />

      <perspectiveCamera
        position={[2000, 2000, 2000]}
        fov={45}
        near={1}
        far={50000}
      />

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[2000, 3000, 2000]}
        intensity={1.5}
        castShadow
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        target={[0, 0, 0]}
        enableDamping
        dampingFactor={0.05}
      />

      <group position={[-2500, -0.001, -2500]}>
        <Grid
          args={[50000, 50000]}
          cellSize={50}
          cellThickness={2}
          cellColor="#d4d4d8"
          sectionSize={250}
          sectionThickness={3}
          sectionColor="#a1a1aa"
          fadeDistance={Infinity}
          fadeStrength={0}
          followCamera={false}
          infiniteGrid
        />
      </group>

      {shapes.map((shape) => {
        const isSelected = selectedShapeId === shape.id;
        return (
          <mesh
            key={shape.id}
            geometry={shape.geometry}
            position={shape.position}
            rotation={shape.rotation}
            scale={shape.scale}
            onClick={(e) => {
              e.stopPropagation();
              selectShape(shape.id);
            }}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={isSelected ? '#60a5fa' : shape.color || '#2563eb'}
              metalness={0.3}
              roughness={0.4}
            />
            <lineSegments>
              <edgesGeometry args={[shape.geometry]} />
              <lineBasicMaterial
                color={isSelected ? '#3b82f6' : '#1a1a1a'}
                linewidth={1}
                opacity={0.3}
                transparent
              />
            </lineSegments>
          </mesh>
        );
      })}

      <mesh
        position={[0, -1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        receiveShadow
      >
        <planeGeometry args={[100000, 100000]} />
        <meshStandardMaterial transparent opacity={0} />
      </mesh>

      <GizmoHelper alignment="bottom-right" margin={[80, 100]}>
        <GizmoViewport
          axisColors={['#f87171', '#4ade80', '#60a5fa']}
          labelColor="white"
        />
      </GizmoHelper>
    </Canvas>
  );
};

export default Scene;
