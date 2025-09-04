import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Environment,
  Stats,
  PerspectiveCamera,
  OrthographicCamera,
} from '@react-three/drei';
import {
  useAppStore,
  CameraType,
  Tool,
  MeasurementUnit,
  ViewMode,
} from './store/appStore';
import OpenCascadeShape from './OpenCascadeShape';
import DrawingPlane from './DrawingPlane';
import ContextMenu from './ContextMenu';
import EditMode from './EditMode';
import { DimensionsManager } from './DimensionsSystem';
import { createPortal } from 'react-dom';
import { Shape } from './types/shapes';
import { fitCameraToShapes, fitCameraToShape } from './utils/cameraUtils';
import { clearFaceHighlight } from './utils/faceSelection';
import * as THREE from 'three';

function CameraController() {
  const { camera } = useThree();
  const {
    cameraType,
    shapes,
    selectedShapeId,
    orthoMode,
    viewMode,
    measurementUnit,
    gridSize,
    snapToGrid: snapEnabled,
  } = useAppStore();

  useEffect(() => {
    if (shapes.length > 0) {
      if (selectedShapeId) {
        const selectedShape = shapes.find(s => s.id === selectedShapeId);
        if (selectedShape) {
          fitCameraToShape(camera, selectedShape);
        }
      } else {
        fitCameraToShapes(camera, shapes);
      }
    }
  }, [camera, shapes, selectedShapeId]);

  return null;
}

export default function Scene() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    visible: boolean;
  }>({ x: 0, y: 0, visible: false });

  const {
    shapes,
    selectedShapeId,
    cameraType,
    tool,
    viewMode,
    orthoMode,
    gridSize,
    snapToGrid: snapEnabled,
    measurementUnit,
    showStats,
    showGrid,
    showGizmo,
    setSelectedShapeId,
    clearSelection,
  } = useAppStore();

  const handleContextMenu = (event: React.MouseEvent) => {
    event.preventDefault();
    setContextMenu({
      x: event.clientX,
      y: event.clientY,
      visible: true,
    });
  };

  const handleCanvasClick = (event: React.MouseEvent) => {
    if (contextMenu.visible) {
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
    
    // Clear selection when clicking on empty space
    const target = event.target as HTMLElement;
    if (target.tagName === 'CANVAS') {
      clearSelection();
      clearFaceHighlight();
    }
  };

  const gridProps = {
    args: [gridSize * 20, gridSize * 20] as [number, number],
    cellSize: gridSize,
    cellThickness: 0.5,
    cellColor: '#6f6f6f',
    sectionSize: gridSize * 5,
    sectionThickness: 1,
    sectionColor: '#9d4b4b',
    fadeDistance: 100,
    fadeStrength: 1,
    followCamera: false,
    infiniteGrid: true,
  };

  return (
    <div className="flex-1 relative">
      <Canvas
        ref={canvasRef}
        camera={{ position: [10, 10, 10], fov: 50 }}
        onContextMenu={handleContextMenu}
        onClick={handleCanvasClick}
        className="w-full h-full"
      >
        <CameraController />
        
        {cameraType === CameraType.PERSPECTIVE ? (
          <PerspectiveCamera makeDefault position={[10, 10, 10]} fov={50} />
        ) : (
          <OrthographicCamera
            makeDefault
            position={[10, 10, 10]}
            zoom={50}
            near={0.1}
            far={1000}
          />
        )}

        <ambientLight intensity={0.6} />
        <directionalLight position={[10, 10, 5]} intensity={0.8} />
        <pointLight position={[-10, -10, -5]} intensity={0.4} />

        <OrbitControls
          enablePan={true}
          enableZoom={true}
          enableRotate={viewMode !== ViewMode.TOP}
          maxPolarAngle={viewMode === ViewMode.TOP ? 0 : Math.PI}
          minPolarAngle={viewMode === ViewMode.TOP ? 0 : 0}
        />

        {showGrid && <Grid {...gridProps} />}

        <Environment preset="city" />

        {shapes.map((shape) => (
          <OpenCascadeShape
            key={shape.id}
            shape={shape}
            isSelected={selectedShapeId === shape.id}
            onSelect={() => setSelectedShapeId(shape.id)}
          />
        ))}

        <DrawingPlane />
        <DimensionsManager />

        {showGizmo && (
          <GizmoHelper alignment="bottom-right" margin={[80, 80]}>
            <GizmoViewport
              axisColors={['#9d4b4b', '#2f7f4f', '#3b82f6']}
              labelColor="white"
            />
          </GizmoHelper>
        )}

        {showStats && <Stats />}
      </Canvas>

      <EditMode />

      {contextMenu.visible &&
        createPortal(
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            onClose={() => setContextMenu(prev => ({ ...prev, visible: false }))}
          />,
          document.body
        )}
    </div>
  );
}