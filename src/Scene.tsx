import React, { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, PerspectiveCamera, OrthographicCamera, TransformControls } from '@react-three/drei';
import { useAppStore, CameraType, Tool } from './store';
import * as THREE from 'three';

const ShapeWithTransform: React.FC<{ shape: any; isSelected: boolean; orbitControlsRef: any }> = ({
  shape,
  isSelected,
  orbitControlsRef
}) => {
  const { selectShape, updateShape, activeTool } = useAppStore();
  const transformRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    if (transformRef.current && isSelected) {
      const controls = transformRef.current;

      const onDraggingChanged = (event: any) => {
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = !event.value;
        }
      };

      const onChange = () => {
        if (meshRef.current) {
          updateShape(shape.id, {
            position: meshRef.current.position.toArray() as [number, number, number],
            rotation: meshRef.current.rotation.toArray().slice(0, 3) as [number, number, number],
            scale: meshRef.current.scale.toArray() as [number, number, number]
          });
        }
      };

      controls.addEventListener('dragging-changed', onDraggingChanged);
      controls.addEventListener('change', onChange);

      return () => {
        controls.removeEventListener('dragging-changed', onDraggingChanged);
        controls.removeEventListener('change', onChange);
      };
    }
  }, [isSelected, shape.id, updateShape, orbitControlsRef]);

  const getTransformMode = () => {
    switch (activeTool) {
      case Tool.MOVE:
        return 'translate';
      case Tool.ROTATE:
        return 'rotate';
      case Tool.SCALE:
        return 'scale';
      default:
        return 'translate';
    }
  };

  return (
    <group>
      <mesh
        ref={meshRef}
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

      {isSelected && activeTool !== Tool.SELECT && (
        <TransformControls
          ref={transformRef}
          object={meshRef.current!}
          mode={getTransformMode()}
          size={0.8}
        />
      )}
    </group>
  );
};

const Scene: React.FC = () => {
  const controlsRef = useRef<any>(null);
  const { shapes, cameraType, selectedShapeId, selectShape, deleteShape } = useAppStore();

  useEffect(() => {
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
          <ShapeWithTransform
            key={shape.id}
            shape={shape}
            isSelected={isSelected}
            orbitControlsRef={controlsRef}
          />
        );
      })}

      <mesh
        onClick={() => selectShape(null)}
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
