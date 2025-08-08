import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { TransformControls } from '@react-three/drei';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { SHAPE_COLORS } from '../types/shapes';
import { ViewMode } from '../store/appStore';

interface Props {
  shape: Shape;
  onContextMenuRequest?: (event: any, shape: Shape) => void;
  isEditMode?: boolean;
  isBeingEdited?: boolean;
  // Face Edit Mode props
  isFaceEditMode?: boolean;
  selectedFaceIndex?: number | null;
  onFaceSelect?: (faceIndex: number) => void;
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
      
      // Get intersection point from raycaster
      const intersectionPoint = e.point;
      if (!intersectionPoint) return;
      
      console.log(`🎯 Face Edit Click: World position [${intersectionPoint.x.toFixed(1)}, ${intersectionPoint.y.toFixed(1)}, ${intersectionPoint.z.toFixed(1)}]`);
      
      // Find closest face using geometric detection
      const closestFace = (window as any).findClosestFaceToPoint?.(intersectionPoint, shape);
      if (closestFace !== null && onFaceSelect) {
        onFaceSelect(closestFace);
        console.log(`🎯 Face ${closestFace} selected in Face Edit mode`);
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
    if (isFaceEditMode) {
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

      {/* Face Selection Overlay - Only for Face Edit Mode */}
      {isFaceEditMode && isBeingEdited && ['box', 'cylinder', 'polyline2d', 'polygon2d', 'polyline3d', 'polygon3d', 'rectangle2d', 'circle2d'].includes(shape.type) && (
        <group>
          {/* Face overlays for selection */}
          {[0, 1, 2, 3, 4, 5].map((faceIndex) => {
            // Calculate face dimensions and position based on shape type
            let width = 500, height = 500, depth = 500;
            
            if (shape.type === 'box' || shape.type === 'rectangle2d') {
              width = (shape.parameters.width || 500) * shape.scale[0];
              height = (shape.parameters.height || 500) * shape.scale[1];
              depth = (shape.parameters.depth || 500) * shape.scale[2];
            } else if (shape.type === 'cylinder' || shape.type === 'circle2d') {
              const radius = shape.parameters.radius || 250;
              width = radius * 2 * shape.scale[0];
              height = (shape.parameters.height || 500) * shape.scale[1];
              depth = radius * 2 * shape.scale[2];
            } else if (['polyline2d', 'polygon2d', 'polyline3d', 'polygon3d'].includes(shape.type)) {
              const geometry = shape.geometry;
              geometry.computeBoundingBox();
              if (geometry.boundingBox) {
                const size = geometry.boundingBox.getSize(new THREE.Vector3());
                width = (Math.abs(size.x) || 500) * shape.scale[0];
                height = (shape.parameters.height || 500) * shape.scale[1];
                depth = (Math.abs(size.z) || 500) * shape.scale[2];
              }
            }
            
            const hw = width / 2;
            const hh = height / 2;
            const hd = depth / 2;
            
            // Face transforms
            const faceTransforms = [
              { position: [0, 0, hd], rotation: [0, 0, 0] }, // Front
              { position: [0, 0, -hd], rotation: [0, Math.PI, 0] }, // Back
              { position: [0, hh, 0], rotation: [-Math.PI / 2, 0, 0] }, // Top
              { position: [0, -hh, 0], rotation: [Math.PI / 2, 0, 0] }, // Bottom
              { position: [hw, 0, 0], rotation: [0, Math.PI / 2, 0] }, // Right
              { position: [-hw, 0, 0], rotation: [0, -Math.PI / 2, 0] }, // Left
            ];
            
            const transform = faceTransforms[faceIndex];
            const isSelected = selectedFaceIndex === faceIndex;
            
            return (
              <mesh
                key={`face-${faceIndex}`}
                geometry={new THREE.PlaneGeometry(
                  faceIndex === 2 || faceIndex === 3 ? width : 
                  (faceIndex === 4 || faceIndex === 5 ? depth : width),
                  faceIndex === 2 || faceIndex === 3 ? depth : height
                )}
                position={[
                  shape.position[0] + transform.position[0],
                  shape.position[1] + transform.position[1],
                  shape.position[2] + transform.position[2],
                ]}
                rotation={[
                  shape.rotation[0] + transform.rotation[0],
                  shape.rotation[1] + transform.rotation[1],
                  shape.rotation[2] + transform.rotation[2],
                ]}
                onClick={handleClick}
                userData={{ faceIndex }}
              >
                <meshBasicMaterial
                  color={isSelected ? '#f97316' : '#3b82f6'} // Orange for selected, blue for others
                  transparent
                  opacity={isSelected ? 0.3 : 0.001} // Only show selected face
                  side={THREE.DoubleSide}
                  depthTest={false}
                />
              </mesh>
            );
          })}
        </group>
      )}

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