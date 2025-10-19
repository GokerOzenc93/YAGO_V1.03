import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, GizmoHelper, GizmoViewport, PerspectiveCamera, OrthographicCamera, TransformControls } from '@react-three/drei';
import { useAppStore, CameraType, Tool, ViewMode } from './store';
import ContextMenu from './ui/ContextMenu';
import SaveDialog from './ui/SaveDialog';
import { catalogService } from './lib/supabase';
import { createBoxGeometry, applyVertexModificationsToGeometry } from './utils/geometry';
import { VertexEditor } from './ui/VertexEditor';
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
  const isUpdatingRef = useRef(false);
  const [localGeometry, setLocalGeometry] = useState(shape.geometry);
  const [geometryKey, setGeometryKey] = useState(0);

  useEffect(() => {
    if (shape.parameters?.width && shape.parameters?.height && shape.parameters?.depth) {
      let newGeometry = createBoxGeometry(
        shape.parameters.width,
        shape.parameters.height,
        shape.parameters.depth
      );

      if (shape.vertexModifications && shape.vertexModifications.length > 0) {
        newGeometry = applyVertexModificationsToGeometry(
          newGeometry,
          shape.vertexModifications,
          shape.parameters
        );
        console.log(`✨ Applied ${shape.vertexModifications.length} vertex modifications to shape ${shape.id}`);
      }

      setLocalGeometry(newGeometry);
      setGeometryKey(prev => prev + 1);

      return () => {
        newGeometry.dispose();
      };
    }
  }, [shape.parameters?.width, shape.parameters?.height, shape.parameters?.depth, shape.vertexModifications]);

  useEffect(() => {
    if (!groupRef.current || isUpdatingRef.current) return;

    groupRef.current.position.set(
      shape.position[0],
      shape.position[1],
      shape.position[2]
    );
    groupRef.current.rotation.set(
      shape.rotation[0],
      shape.rotation[1],
      shape.rotation[2]
    );
    groupRef.current.scale.set(
      shape.scale[0],
      shape.scale[1],
      shape.scale[2]
    );
  }, [shape.position, shape.rotation, shape.scale]);

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
          isUpdatingRef.current = true;
          updateShape(shape.id, {
            position: groupRef.current.position.toArray() as [number, number, number],
            rotation: groupRef.current.rotation.toArray().slice(0, 3) as [number, number, number],
            scale: groupRef.current.scale.toArray() as [number, number, number]
          });
          setTimeout(() => {
            isUpdatingRef.current = false;
          }, 0);
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
        onClick={(e) => {
          e.stopPropagation();
          selectShape(shape.id);
        }}
        onContextMenu={(e) => {
          e.stopPropagation();
          onContextMenu(e, shape.id);
        }}
      >
        {!isWireframe && (
          <mesh
            ref={meshRef}
            geometry={localGeometry}
            castShadow
            receiveShadow
          >
            <meshStandardMaterial
              color={isSelected ? '#60a5fa' : shape.color || '#2563eb'}
              metalness={0.3}
              roughness={0.4}
            />
            <lineSegments>
              <edgesGeometry args={[localGeometry]} />
              <lineBasicMaterial
                color={isSelected ? '#3b82f6' : '#1a1a1a'}
                linewidth={1}
                opacity={0.3}
                transparent
              />
            </lineSegments>
          </mesh>
        )}
        {isWireframe && (
          <>
            <mesh
              ref={meshRef}
              geometry={localGeometry}
              visible={false}
            />
            <lineSegments>
              <edgesGeometry args={[localGeometry]} />
              <lineBasicMaterial
                color={isSelected ? '#60a5fa' : '#1a1a1a'}
                linewidth={isSelected ? 2 : 1}
              />
            </lineSegments>
          </>
        )}
      </group>

      {isSelected && activeTool !== Tool.SELECT && groupRef.current && (
        <TransformControls
          key={geometryKey}
          ref={transformRef}
          object={groupRef.current}
          mode={getTransformMode()}
          size={0.8}
        />
      )}
    </>
  );
};

const Scene: React.FC = () => {
  const controlsRef = useRef<any>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const {
    shapes,
    cameraType,
    selectedShapeId,
    selectShape,
    deleteShape,
    copyShape,
    isolateShape,
    exitIsolation,
    vertexEditMode,
    setVertexEditMode,
    selectedVertexIndex,
    setSelectedVertexIndex,
    vertexDirection,
    setVertexDirection,
    addVertexModification
  } = useAppStore();
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number; shapeId: string; shapeType: string } | null>(null);
  const [saveDialog, setSaveDialog] = useState<{ isOpen: boolean; shapeId: string | null }>({ isOpen: false, shapeId: null });

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Delete' && selectedShapeId) {
        deleteShape(selectedShapeId);
      } else if (e.key === 'Escape') {
        selectShape(null);
        exitIsolation();
        setVertexEditMode(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedShapeId, deleteShape, selectShape, exitIsolation, setVertexEditMode]);

  useEffect(() => {
    (window as any).handleVertexOffset = (newValue: number) => {
      if (selectedShapeId && selectedVertexIndex !== null && vertexDirection) {
        const shape = shapes.find(s => s.id === selectedShapeId);
        if (shape && shape.parameters) {
          const baseVertices = [
            [0, 0, 0],
            [shape.parameters.width, 0, 0],
            [shape.parameters.width, shape.parameters.height, 0],
            [0, shape.parameters.height, 0],
            [0, 0, shape.parameters.depth],
            [shape.parameters.width, 0, shape.parameters.depth],
            [shape.parameters.width, shape.parameters.height, shape.parameters.depth],
            [0, shape.parameters.height, shape.parameters.depth],
          ];

          const originalPos = baseVertices[selectedVertexIndex];

          const existingMod = shape.vertexModifications?.find(
            (m: any) => m.vertexIndex === selectedVertexIndex
          );
          const currentPos = existingMod ? existingMod.newPosition : originalPos;

          const newPosition: [number, number, number] = [...currentPos] as [number, number, number];

          if (vertexDirection === 'x+' || vertexDirection === 'x-') {
            newPosition[0] = newValue;
          } else if (vertexDirection === 'y+' || vertexDirection === 'y-') {
            newPosition[1] = newValue;
          } else if (vertexDirection === 'z+' || vertexDirection === 'z-') {
            newPosition[2] = newValue;
          }

          const axisName = vertexDirection[0].toUpperCase();
          const directionSymbol = vertexDirection[1] === '+' ? '+' : '-';

          addVertexModification(selectedShapeId, {
            vertexIndex: selectedVertexIndex,
            originalPosition: originalPos as [number, number, number],
            newPosition,
            direction: vertexDirection,
            expression: String(newValue),
            description: `Vertex ${selectedVertexIndex} ${axisName}${directionSymbol}`
          });

          console.log(`✅ Vertex ${selectedVertexIndex} moved to [${newPosition[0]}, ${newPosition[1]}, ${newPosition[2]}]`);
        }

        (window as any).pendingVertexEdit = false;
        setSelectedVertexIndex(null);
      }
    };

    (window as any).pendingVertexEdit = selectedVertexIndex !== null && vertexDirection !== null;

    return () => {
      delete (window as any).handleVertexOffset;
      delete (window as any).pendingVertexEdit;
    };
  }, [selectedShapeId, selectedVertexIndex, vertexDirection, shapes, addVertexModification, setSelectedVertexIndex]);

  const handleContextMenu = (e: any, shapeId: string) => {
    if (vertexEditMode) {
      return;
    }
    e.nativeEvent.preventDefault();
    selectShape(shapeId);
    const shape = shapes.find(s => s.id === shapeId);
    setContextMenu({
      x: e.nativeEvent.clientX,
      y: e.nativeEvent.clientY,
      shapeId,
      shapeType: shape?.type || 'unknown'
    });
  };

  const captureSnapshot = (): string => {
    const canvas = document.querySelector('canvas');
    if (!canvas) return '';
    return canvas.toDataURL('image/png');
  };

  const handleSave = async (data: { code: string; description: string; tags: string[]; previewImage?: string }) => {
    if (!saveDialog.shapeId) return;

    const shape = shapes.find(s => s.id === saveDialog.shapeId);
    if (!shape) return;

    try {
      const geometryData = {
        type: shape.type,
        position: shape.position,
        rotation: shape.rotation,
        scale: shape.scale,
        color: shape.color,
        parameters: shape.parameters,
        vertexModifications: shape.vertexModifications || []
      };

      console.log('💾 Saving geometry:', {
        code: data.code,
        type: shape.type,
        parameters: shape.parameters,
        position: shape.position,
        scale: shape.scale,
        vertexModifications: shape.vertexModifications?.length || 0
      });

      await catalogService.save({
        code: data.code,
        description: data.description,
        tags: data.tags,
        geometry_data: geometryData,
        preview_image: data.previewImage
      });

      console.log('✅ Geometry saved to catalog:', data.code);
      alert('Geometry saved successfully!');
      setSaveDialog({ isOpen: false, shapeId: null });
    } catch (error) {
      console.error('Failed to save geometry:', error);
      alert('Failed to save geometry. Please try again.');
    }
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
          <React.Fragment key={shape.id}>
            <ShapeWithTransform
              shape={shape}
              isSelected={isSelected}
              orbitControlsRef={controlsRef}
              onContextMenu={handleContextMenu}
            />
            {isSelected && vertexEditMode && (
              <VertexEditor
                shape={shape}
                isActive={true}
                onVertexSelect={(index) => setSelectedVertexIndex(index)}
                onDirectionChange={(dir) => setVertexDirection(dir)}
                onOffsetConfirm={(vertexIndex, direction, offset) => {
                  console.log('Offset confirmed:', { vertexIndex, direction, offset });
                }}
              />
            )}
          </React.Fragment>
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

    {contextMenu && (
      <ContextMenu
        position={{ x: contextMenu.x, y: contextMenu.y }}
        shapeId={contextMenu.shapeId}
        shapeType={contextMenu.shapeType}
        onClose={() => setContextMenu(null)}
        onEdit={() => {
          isolateShape(contextMenu.shapeId);
          setContextMenu(null);
        }}
        onCopy={() => {
          copyShape(contextMenu.shapeId);
          setContextMenu(null);
        }}
        onMove={() => {
          console.log('Move:', contextMenu.shapeId);
          setContextMenu(null);
        }}
        onRotate={() => {
          console.log('Rotate:', contextMenu.shapeId);
          setContextMenu(null);
        }}
        onDelete={() => {
          deleteShape(contextMenu.shapeId);
          setContextMenu(null);
        }}
        onToggleVisibility={() => {
          console.log('Toggle visibility:', contextMenu.shapeId);
          setContextMenu(null);
        }}
        onSave={() => {
          setSaveDialog({ isOpen: true, shapeId: contextMenu.shapeId });
          setContextMenu(null);
        }}
      />
    )}

    <SaveDialog
      isOpen={saveDialog.isOpen}
      onClose={() => setSaveDialog({ isOpen: false, shapeId: null })}
      onSave={handleSave}
      shapeId={saveDialog.shapeId || ''}
      captureSnapshot={captureSnapshot}
    />
    </>
  );
};

export default Scene;
