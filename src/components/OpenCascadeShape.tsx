import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { SHAPE_COLORS } from '../types/shapes';
import { ViewMode } from '../store/appStore';
import { 
  detectFaceAtMouse, 
  highlightFace, 
  clearFaceHighlight,
  getCurrentHighlight 
} from '../utils/faceSelection';
import { 
  detectVertexAtMouse, 
  updateVertexPosition, 
  getWorldPositionFromMouse,
  VolumeEditState,
  visualizeFaceVertices,
  clearVertexVisualization
} from '../utils/volumeEdit';

interface Props {
  shape: Shape;
  onContextMenuRequest?: (event: any, shape: Shape) => void;
  isEditMode?: boolean;
  isBeingEdited?: boolean;
  // Face Edit Mode props
  isFaceEditMode?: boolean;
  selectedFaceIndex?: number | null;
  onFaceSelect?: (faceIndex: number) => void;
  // Volume Edit Mode props
  isVolumeEditMode?: boolean;
}

const OpenCascadeShape: React.FC<Props> = ({
  shape,
  onContextMenuRequest,
  isEditMode = false,
  isBeingEdited = false,
  // Face Edit Mode props
  isFaceEditMode = false,
  selectedFaceIndex,
  onFaceSelect,
  // Volume Edit Mode props
  isVolumeEditMode = false,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const transformRef = useRef<any>(null);
  const { scene, camera, gl } = useThree();
  const {
    activeTool,
    selectedShapeId,
    gridSize,
    setSelectedObjectPosition,
    viewMode, // 🎯 NEW: Get current view mode
  } = useAppStore();
  const isSelected = selectedShapeId === shape.id;

  // Volume Edit State
  const [volumeEditState, setVolumeEditState] = useState<VolumeEditState>({
    isActive: false,
    selectedVertices: [],
    selectedFaceIndex: null,
    isDragging: false,
    dragStartPosition: null,
    selectedVertexIndex: null,
    draggedVertexIndex: null
  });
  
  // Volume Edit Vertex Visualization
  const [vertexVisualizationGroup, setVertexVisualizationGroup] = useState<THREE.Group | null>(null);
  const [currentVertexPositions, setCurrentVertexPositions] = useState<THREE.Vector3[]>([]);

  // Debug: Log shape information when selected
  useEffect(() => {
    if (isSelected && meshRef.current) {
      const worldPos = meshRef.current.getWorldPosition(new THREE.Vector3());
      const localPos = meshRef.current.position;
      
      console.log('🎯 GIZMO DEBUG - Selected shape:', {
        id: shape.id,
        type: shape.type,
        shapePosition: shape.position,
        meshLocalPosition: localPos.toArray().map(v => v.toFixed(1)),
        meshWorldPosition: worldPos.toArray().map(v => v.toFixed(1)),
        geometryBoundingBox: shape.geometry.boundingBox,
        is2DShape: shape.is2DShape,
        positionMatch: localPos.toArray().map((v, i) => Math.abs(v - shape.position[i]) < 0.1)
      });
      
      // Check if mesh position matches shape position
      const positionDiff = localPos.toArray().map((v, i) => Math.abs(v - shape.position[i]));
      if (positionDiff.some(diff => diff > 0.1)) {
        console.warn('🚨 POSITION MISMATCH - Mesh position does not match shape position!', {
          shapePosision: shape.position,
          meshPosition: localPos.toArray(),
          difference: positionDiff
        });
      }
    }
  }, [isSelected, shape]);

  const shapeGeometry = useMemo(() => shape.geometry, [shape.geometry]);
  const edgesGeometry = useMemo(
    () => new THREE.EdgesGeometry(shapeGeometry),
    [shapeGeometry]
  );

  useEffect(() => {
    const controls = transformRef.current;
    if (!controls) return;

    console.log('🎯 GIZMO SETUP - Transform controls initialized for shape:', shape.id);

    controls.translationSnap = gridSize;
    controls.rotationSnap = Math.PI / 12;
    controls.scaleSnap = 0.25;

    const handleObjectChange = () => {
      const mesh = meshRef.current;
      if (!mesh) return;

      const position = mesh.position.toArray();
      const rotation = mesh.rotation.toArray().slice(0, 3);
      const scale = mesh.scale.toArray();

      console.log(`🎯 GIZMO TRANSFORM - Shape ${shape.id} transformed:`, {
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
        `🎯 GIZMO SELECTION - Shape ${shape.id} selected:`,
        {
          meshPosition: meshRef.current.position.toArray().map((p) => p.toFixed(1)),
          worldPosition: meshRef.current.getWorldPosition(new THREE.Vector3()).toArray().map((p) => p.toFixed(1)),
          shapePosition: shape.position.map((p) => p.toFixed(1))
        }
      );
    }
  }, [isSelected, setSelectedObjectPosition, shape.id]);

  const handleClick = (e: any) => {
    // Face Edit mode - handle face selection
    if (isFaceEditMode && e.nativeEvent.button === 0) {
      e.stopPropagation();
      
      // Three.js tabanlı face detection
      const hit = detectFaceAtMouse(
        e.nativeEvent, 
        camera, 
        meshRef.current!, 
        gl.domElement
      );
      
      if (!hit || hit.faceIndex === undefined) {
        console.warn('🎯 No face detected');
        return;
      }
      
      // Face highlight ekle
      const highlight = highlightFace(scene, hit, shape, 0xff6b35, 0.6);
      
      if (highlight && onFaceSelect) {
        onFaceSelect(hit.faceIndex);
        console.log(`🎯 Face ${hit.faceIndex} selected and highlighted`);
      }
      return;
    }
    
    // Volume Edit mode - handle vertex selection and dragging
    if (isVolumeEditMode && e.nativeEvent.button === 0) {
      e.stopPropagation();
      
      // İlk önce face seçimi yap
      const hit = detectFaceAtMouse(
        e.nativeEvent,
        camera,
        meshRef.current!,
        gl.domElement
      );
      
      if (hit && hit.faceIndex !== undefined && meshRef.current) {
        // Seçilen face'i highlight et (açık gri renk)
        const faceHighlight = highlightFace(scene, hit, shape, 0xcccccc, 0.4);
        
        // Önceki vertex görselleştirmesini temizle
        if (vertexVisualizationGroup) {
          clearVertexVisualization(scene, vertexVisualizationGroup);
        }
        
        // Seçilen face'in vertex'lerini görselleştir
        const newGroup = visualizeFaceVertices(
          scene,
          meshRef.current,
          hit.faceIndex,
          0x000000, // Siyah renk
          12 // Vertex boyutu (daha büyük)
        );
        
        setVertexVisualizationGroup(newGroup);
        console.log(`🎯 Volume Edit: Face ${hit.faceIndex} vertices visualized`);
      } else {
        console.log('🎯 Volume Edit: No face found at mouse position');
      }
      return;
    }
    
    // Normal selection mode - only left click
    if (e.nativeEvent.button === 0) {
      e.stopPropagation();
      useAppStore.getState().selectShape(shape.id);
      console.log(`Shape clicked: ${shape.type} (ID: ${shape.id})`);
    }
  };

  const handleContextMenu = (e: any) => {
    // Face Edit mode - prevent context menu
    if (isFaceEditMode || isVolumeEditMode) {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      return;
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

  // Handle mouse move for volume edit dragging
  const handleMouseMove = useCallback((event: MouseEvent) => {
    if (!isVolumeEditMode || !volumeEditState.isDragging || volumeEditState.selectedVertexIndex === null) {
      return;
    }

    const newPosition = getWorldPositionFromMouse(event, camera, gl.domElement);
    if (newPosition && meshRef.current) {
      updateVertexPosition(meshRef.current, volumeEditState.selectedVertexIndex, newPosition);
    }
  }, [isVolumeEditMode, volumeEditState.isDragging, volumeEditState.selectedVertexIndex, camera, gl.domElement]);

  // Handle mouse up for volume edit
  const handleMouseUp = useCallback(() => {
    if (volumeEditState.isDragging) {
      setVolumeEditState(prev => ({
        ...prev,
        isDragging: false,
        dragStartPosition: null
      }));
      console.log('🎯 Volume Edit: Dragging finished');
    }
  }, [volumeEditState.isDragging]);

  // Add/remove mouse event listeners for volume edit
  useEffect(() => {
    if (isVolumeEditMode && volumeEditState.isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isVolumeEditMode, volumeEditState.isDragging, handleMouseMove, handleMouseUp]);

  // Face Edit mode'dan çıkıldığında highlight'ı temizle
  useEffect(() => {
    if (!isFaceEditMode) {
      clearFaceHighlight(scene);
    }
    
    // Volume Edit mode'dan çıkıldığında state'i temizle
    if (!isVolumeEditMode) {
      // Vertex görselleştirmesini temizle
      if (vertexVisualizationGroup) {
        clearVertexVisualization(scene, vertexVisualizationGroup);
        setVertexVisualizationGroup(null);
      }
      
      setVolumeEditState({
        isActive: false,
        selectedVertexIndex: null,
        isDragging: false,
        dragStartPosition: null
      });
    }
  }, [isFaceEditMode, isVolumeEditMode, scene, vertexVisualizationGroup]);

  // Calculate shape center for transform controls positioning
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

      {/* 🎯 VIEW MODE BASED EDGES - Görünüm moduna göre çizgiler */}
      {shouldShowEdges() && (
        <lineSegments
          geometry={edgesGeometry}
          position={shape.position}
          rotation={shape.rotation}
          scale={shape.scale}
          visible={true} // Always show edges
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
        !isFaceEditMode && (
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
            size={0.8}
            onObjectChange={() => {
              console.log('🎯 GIZMO CHANGE - Transform controls object changed');
            }}
          />
        )}
    </group>
  );
};

export default React.memo(OpenCascadeShape);