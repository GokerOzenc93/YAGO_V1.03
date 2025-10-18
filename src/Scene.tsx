import React, { useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { useAppStore, CameraType } from './store';
import * as THREE from 'three';

const Scene: React.FC = () => {
  const controlsRef = useRef<any>(null);
  const { shapes, cameraType, selectedShapeId, selectShape } = useAppStore();

  return (
    <Canvas
      shadows
      gl={{
        antialias: true,
        alpha: false,
        preserveDrawingBuffer: true
      }}
      dpr={[1, 2]}
      style={{ background: '#1a1a1a' }}
    >
      {cameraType === CameraType.PERSPECTIVE ? (
        <PerspectiveCamera
          makeDefault
          position={[1000, 1600, 1800]}
          fov={45}
          near={1}
          far={50000}
        />
      ) : (
        <OrthographicCamera
          makeDefault
          position={[1000, 1600, 1800]}
          zoom={0.25}
          near={-50000}
          far={50000}
        />
      )}

      <ambientLight intensity={0.5} />
      <directionalLight
        position={[2000, 3000, 2000]}
        intensity={1.2}
        castShadow
      />

      <OrbitControls
        ref={controlsRef}
        makeDefault
        enableDamping
        dampingFactor={0.05}
      />

      <group position={[0, -0.001, 0]}>
        <Grid
          args={[50000, 50000]}
          cellSize={50}
          cellThickness={2}
          cellColor="#666"
          sectionSize={250}
          sectionThickness={3}
          sectionColor="#444"
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
          >
            <meshStandardMaterial
              color={isSelected ? '#60a5fa' : shape.color || '#2563eb'}
              transparent
              opacity={0}
              depthWrite={true}
            />
            <lineSegments>
              <edgesGeometry args={[shape.geometry]} />
              <lineBasicMaterial
                color={isSelected ? '#60a5fa' : '#ffffff'}
                linewidth={isSelected ? 2 : 1}
              />
            </lineSegments>
          </mesh>
        );
      })}

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
