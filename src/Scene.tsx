import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, PerspectiveCamera, OrthographicCamera, TransformControls } from '@react-three/drei';
import { useAppStore, CameraType, Tool, ViewMode } from './store';
import ContextMenu from './ui/ContextMenu';
import * as THREE from 'three';

const ShapeWithTransform: React.FC<{
  shape: any;
  isSelected: boolean;
  orbitControlsRef: any;
  onContextMenu: (e: any, shapeId: string) => void;
}> = ({
  shape,
  isSelected,
  orbitControlsRef,
  onContextMenu
}) => {
  const { selectShape, updateShape, activeTool, viewMode } = useAppStore();
  const transformRef = useRef<any>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const groupRef = useRef<THREE.Group>(null);
  const pivotRef = useRef<THREE.Object3D>(null);

  useEffect(() => {
    if (meshRef.current && groupRef.current) {
      const bbox = new THREE.Box3().setFromObject(meshRef.current);
      const minCorner = bbox.min;

      meshRef.current.position.set(
        -minCorner.x,
        -minCorner.y,
        -minCorner.z
      );

      groupRef.current.position.set(
        shape.position[0] + minCorner.x,
        shape.position[1] + minCorner.y,
        shape.position[2] + minCorner.z
      );
    }
  }, [shape.geometry]);

  useEffect(() => {
    if (transformRef.current && isSelected && groupRef.current) {
      const controls = transformRef.current;

      const onDraggingChanged = (event: any) => {
        if (orbitControlsRef.current) {
          orbitControlsRef.current.enabled = !event.value;
        }
      };

      const onChange = () => {
        if (groupRef.current) {
          updateShape(shape.id, {
            position: groupRef.current.position.toArray() as [number, number, number],
            rotation: groupRef.current.rotation.toArray().slice(0, 3) as [number, number, number],
            scale: groupRef.current.scale.toArray() as [number, number, number]
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

  const isWireframe = viewMode === ViewMode.WIREFRAME;

  if (shape.isolated === false) {
    return null;
  }

  return (
    <>
      <group
        ref={groupRef}
        position={shape.position}
        rotation={shape.rotation}
        scale={shape.scale}
        onClick={(e) => {
          e.stopPropagation();
          selectShape(shape.id);
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          onContextMenu(e, shape.id);
        }}
      >
        <mesh
          ref={meshRef}
          geometry={shape.geometry}
          castShadow
          receiveShadow
        >
          <meshStandardMaterial
            color={isSelected ? '#60a5fa' : shape.color || '#2563eb'}
            transparent={isWireframe}
            opacity={isWireframe ? 0 : 1}
            depthWrite={true}
            metalness={0.3}
            roughness={0.4}
          />
          {isWireframe ? (
            <lineSegments>
              <edgesGeometry args={[shape.geometry]} />
              <lineBasicMaterial
                color={isSelected ? '#60a5fa' : '#ffffff'}
                linewidth={isSelected ? 2 : 1}
              />
            </lineSegments>
          ) : (
            <lineSegments>
              <edgesGeometry args={[shape.geometry]} />
              <lineBasicMaterial
                color={isSelected ? '#3b82f6' : '#1a1a1a'}
                linewidth={1}
                opacity={0.3}
                transparent
              />
            </lineSegments>
          )}
        </mesh>
      </group>

      {isSelected && activeTool !== Tool.SELECT && (
        <TransformControls
          ref={transformRef}
          object={groupRef.current!}
          mode={getTransformMode()}
          size={0.8}
        />
      )}
    </>
  );
};

const Scene: React.FC = () => {
  const controlsRef = useRef<any>(null);
  const { shapes, cameraType, selectedShapeId, selectShape, deleteShape, copyShape, isolateShape, exitIsolation } = useAppStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; shapeId: string } | null>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedShapeId) {
        deleteShape(selectedShapeId);
      } else if (e.key === 'Escape') {
        selectShape(null);
        exitIsolation();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, deleteShape, selectShape, exitIsolation]);

  const handleContextMenu = (e: any, shapeId: string) => {
    e.nativeEvent.preventDefault();
    selectShape(shapeId);
    setContextMenu({
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
      shapeId
    });
  };

  return (
    <>
      <Canvas
        shadows
        gl={{
          antialias: true,
          alpha: false,
          preserveDrawingBuffer: true
        }}
        dpr={[1, 2]}
        onContextMenu={(e) => e.preventDefault()}
      >
        <color attach="background" args={['#f5f5f4']} />

      {cameraType === CameraType.PERSPECTIVE ? (
        <PerspectiveCamera
          makeDefault
          position={[2000, 2000, 2000]}
          fov={45}
          near={1}
          far={50000}
        />
      ) : (
        <OrthographicCamera
          makeDefault
          position={[2000, 2000, 2000]}
          zoom={0.25}
          near={-50000}
          far={50000}
        />
      )}

      <ambientLight intensity={0.6} />
      <directionalLight
        position={[2000, 3000, 2000]}
        intensity={1.5}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
      />
      <directionalLight
        position={[-1000, 1500, -1000]}
        intensity={0.4}
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
          <ShapeWithTransform
            key={shape.id}
            shape={shape}
            isSelected={isSelected}
            orbitControlsRef={controlsRef}
            onContextMenu={handleContextMenu}
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

    {contextMenu && (
      <ContextMenu
        x={contextMenu.x}
        y={contextMenu.y}
        onClose={() => setContextMenu(null)}
        onIsolate={() => isolateShape(contextMenu.shapeId)}
        onEdit={() => console.log('Edit:', contextMenu.shapeId)}
        onCopy={() => copyShape(contextMenu.shapeId)}
        onDelete={() => deleteShape(contextMenu.shapeId)}
        onCut={() => {
          copyShape(contextMenu.shapeId);
          deleteShape(contextMenu.shapeId);
        }}
      />
    )}
    </>
  );
};

export default Scene;
