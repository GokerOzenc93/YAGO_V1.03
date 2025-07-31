import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { SHAPE_COLORS } from '../types/shapes';
import PanelManager from './PanelManager';
import { ViewMode } from '../store/appStore';

interface Props {
  shape: Shape;
  onContextMenuRequest?: (event: any, shape: Shape) => void;
  isEditMode?: boolean;
  isBeingEdited?: boolean;
  // Panel manager props
  isAddPanelMode?: boolean;
  selectedFaces?: number[];
  onFaceSelect?: (faceIndex: number) => void;
  onFaceHover?: (faceIndex: number | null) => void;
  hoveredFace?: number | null;
  showEdges?: boolean;
  showFaces?: boolean;
  // Face cycle indicator props
  onFaceCycleUpdate?: (cycleState: {
    selectedFace: number | null;
    currentIndex: number;
    availableFaces: number[];
    mousePosition: { x: number; y: number } | null;
  }) => void;
  // 🔴 NEW: Panel Edit Mode props
  isPanelEditMode?: boolean;
  onPanelSelect?: (panelData: {
    faceIndex: number;
    position: THREE.Vector3;
    size: THREE.Vector3;
    panelOrder: number;
  }) => void;
}

const OpenCascadeShape: React.FC<Props> = ({
  shape,
  onContextMenuRequest,
  isEditMode = false,
  isBeingEdited = false,
  isAddPanelMode = false,
  selectedFaces = [],
  onFaceSelect,
  onFaceHover,
  hoveredFace = null,
  showEdges = true,
  showFaces = true,
  onFaceCycleUpdate,
  // 🔴 NEW: Panel Edit Mode props
  isPanelEditMode = false,
  onPanelSelect,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const transformRef = useRef<any>(null);
  const {
    activeTool,
    selectedShapeId,
    gridSize,
    setSelectedObjectPosition,
    viewMode, // 🎯 NEW: Get current view mode
  } = useAppStore();
  const isSelected = selectedShapeId === shape.id;

  // Face cycling state for panel placement
  const [faceCycleState, setFaceCycleState] = useState<{
    availableFaces: number[];
    currentIndex: number;
    selectedFace: number | null;
    mousePosition: { x: number; y: number } | null;
  }>({
    availableFaces: [],
    currentIndex: 0,
    selectedFace: null,
    mousePosition: null,
  });

  // Add selectedFaceCenters state
  const [selectedFaceCenters, setSelectedFaceCenters] = useState<THREE.Vector3[]>([]);

  const shapeGeometry = useMemo(() => shape.geometry, [shape.geometry]);
  const edgesGeometry = useMemo(
    () => new THREE.EdgesGeometry(shapeGeometry),
    [shapeGeometry]
  );

  useEffect(() => {
    const controls = transformRef.current;
    if (!controls) return;

    controls.translationSnap = gridSize;
    controls.rotationSnap = Math.PI / 12;
    controls.scaleSnap = 0.25;

    const handleObjectChange = () => {
      const mesh = meshRef.current;
      if (!mesh) return;

      const position = mesh.position.toArray();
      const rotation = mesh.rotation.toArray().slice(0, 3);
      const scale = mesh.scale.toArray();

      console.log(`Shape ${shape.id} transformed:`, {
        position: position.map((p) => p.toFixed(1)),
        rotation: rotation.map((r) => ((r * 180) / Math.PI).toFixed(1)),
        scale: scale.map((s) => s.toFixed(2)),
      });

      useAppStore.getState().updateShape(shape.id, {
        position: position,
        rotation: rotation,
        scale: scale,
      });

      if (isSelected) {
        setSelectedObjectPosition(position as [number, number, number]);
      }
    };

    controls.addEventListener('objectChange', handleObjectChange);
    return () =>
      controls.removeEventListener('objectChange', handleObjectChange);
  }, [shape.id, gridSize, isSelected, setSelectedObjectPosition]);

  useEffect(() => {
    if (isSelected && meshRef.current) {
      setSelectedObjectPosition(
        meshRef.current.position.toArray() as [number, number, number]
      );
      console.log(
        `Shape ${shape.id} selected at position:`,
        meshRef.current.position.toArray().map((p) => p.toFixed(1))
      );
    }
  }, [isSelected, setSelectedObjectPosition, shape.id]);

  // Reset face cycle state when panel mode is disabled
  useEffect(() => {
    if (!isAddPanelMode) {
      setFaceCycleState({
        availableFaces: [],
        currentIndex: 0,
        selectedFace: null,
        mousePosition: null,
      });
    }
  }, [isAddPanelMode]);

  // Update parent component with face cycle state changes
  useEffect(() => {
    if (onFaceCycleUpdate) {
      onFaceCycleUpdate(faceCycleState);
    }
  }, [faceCycleState, onFaceCycleUpdate]);

  const handleClick = (e: any) => {
    // Panel mode is handled by PanelManager component
    if (isAddPanelMode || isPanelEditMode) {
      return; // Let PanelManager handle this
    }

    // Normal selection mode - only left click
    if (e.nativeEvent.button === 0) {
      e.stopPropagation();
      useAppStore.getState().selectShape(shape.id);
      console.log(`Shape clicked: ${shape.type} (ID: ${shape.id})`);
    }
  };

  const handleContextMenu = (e: any) => {
    // Panel mode context menu is handled by PanelManager
    if (isAddPanelMode || isPanelEditMode) {
      return; // Let PanelManager handle this
    }

    // Normal context menu - only show for selected shapes
    if (isSelected && onContextMenuRequest) {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      onContextMenuRequest(e, shape);
      console.log(
        `Context menu requested for shape: ${shape.type} (ID: ${shape.id})`
      );
    }
  };

  // 🎯 NEW: Get appropriate color based on view mode
  const getShapeColor = () => {
    if (isBeingEdited) return '#ff6b35'; // Orange for being edited
    if (isSelected) return '#60a5fa'; // Blue for selected
    if (isEditMode && !isBeingEdited) return '#6b7280'; // Gray for other objects in edit mode
    return SHAPE_COLORS[shape.type as keyof typeof SHAPE_COLORS] || '#94a3b8';
  };

  // 🎯 NEW: Get opacity based on view mode
  const getOpacity = () => {
    if (shape.type === 'REFERENCE_CUBE' || shape.isReference) return 0.2;

    if (selectedFaces.length > 0) return 0;

    // Always hide mesh, only show edges
    return 0;
  };

  // 🎯 NEW: Get edge visibility based on view mode
  const shouldShowEdges = () => {
    if (viewMode === ViewMode.SOLID) {
      // Solid mode: Only show outline edges
      return true;
    } else {
      // Wireframe mode: Show all edges
      return true;
    }
  };

  // 🎯 NEW: Get edge opacity based on view mode
  const getEdgeOpacity = () => {
    // Always full opacity
    return 1.0;
  };

  // 🎯 NEW: Get edge color based on view mode
  const getEdgeColor = () => {
    if (viewMode === ViewMode.SOLID) {
      // Solid mode: Black outline edges
      return '#000000';
    } else {
      // Wireframe mode: Black edges
      return '#000000';
    }
  };

  // 🎯 RESPONSIVE LINE WIDTH - Tablet ve küçük ekranlar için optimize edildi
  const getEdgeLineWidth = () => {
    const screenWidth = window.innerWidth;

    if (screenWidth < 768) {
      // Mobile/Tablet
      return 0.4; // Çok ince çizgiler
    } else if (screenWidth < 1024) {
      // Small desktop
      return 0.7; // Orta kalınlık
    } else {
      // Large desktop
      return 1.0; // Normal kalınlık
    }
  };

  // 🎯 NEW: Get material properties based on view mode
  const getMaterialProps = () => {
    const opacityValue = 0.05; // 👈 Solid modda bile şeffaf görünüm

    return {
      color: getShapeColor(),
      transparent: true, // 👈 Şeffaflık aktif
      opacity: opacityValue,
      visible: false, // Solid modda şekil görünür
    };
  };

  return (
    <group>
      {/* Main shape mesh */}
      <mesh
        ref={meshRef}
        geometry={shapeGeometry}
        position={shape.position}
        rotation={shape.rotation}
        scale={shape.scale}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        castShadow
        receiveShadow
        visible={viewMode === ViewMode.SOLID} // Show mesh in solid mode
      >
        <meshPhysicalMaterial {...getMaterialProps()} />
      </mesh>

      {/* 🎯 ALWAYS SHOW PANELS - Panel Manager renders panels regardless of mode */}
      <PanelManager
        shape={shape}
        isAddPanelMode={isAddPanelMode && isBeingEdited}
        selectedFaces={selectedFaces}
        hoveredFace={hoveredFace}
        showEdges={showEdges}
        showFaces={showFaces}
        onFaceSelect={onFaceSelect || (() => {})}
        onFaceHover={onFaceHover || (() => {})}
        onFaceCycleUpdate={onFaceCycleUpdate}
        faceCycleState={faceCycleState}
        setFaceCycleState={setFaceCycleState}
        alwaysShowPanels={true} // 🎯 NEW PROP - Always show panels
        selectedFaceCenters={selectedFaceCenters}
        setSelectedFaceCenters={setSelectedFaceCenters}
        // 🔴 NEW: Panel Edit Mode props
        isPanelEditMode={isPanelEditMode}
        onPanelSelect={onPanelSelect}
      />

      {/* 🎯 VIEW MODE BASED EDGES - Görünüm moduna göre çizgiler */}
      {shouldShowEdges() && (
        <lineSegments
          geometry={edgesGeometry}
          position={shape.position}
          rotation={shape.rotation}
          scale={shape.scale}
        >
          <lineBasicMaterial
            color={getEdgeColor()}
            transparent
            opacity={getEdgeOpacity()}
            depthTest={viewMode === ViewMode.SOLID} // 🎯 Her yerden görünür
            linewidth={getEdgeLineWidth()}
          />
        </lineSegments>
      )}

      {/* Transform controls - DISABLED in edit mode and panel mode */}
      {isSelected &&
        meshRef.current &&
        !isEditMode &&
        !isAddPanelMode &&
        !isPanelEditMode && (
          <TransformControls
            ref={transformRef}
            object={meshRef.current}
            mode={
              activeTool === 'Move'
                ? 'translate'
                : activeTool === 'Rotate'
                ? 'rotate'
                : activeTool === 'Scale'
                ? 'scale'
                : 'translate'
            }
            size={0.38}
          />
        )}
    </group>
  );
};

export default React.memo(OpenCascadeShape);
