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

  // HATA DÜZELTMESİ: Gelen geometriyi EdgesGeometry için güvenli hale getiriyoruz.
  // Bu, OCC'den gelen geometrinin iç yapısındaki uyumsuzlukları giderir.
  const sanitizedGeometry = useMemo(() => {
    if (shapeGeometry && shapeGeometry.attributes.position) {
      const newGeom = new THREE.BufferGeometry();
      newGeom.setAttribute('position', shapeGeometry.attributes.position);
      if (shapeGeometry.index) {
        newGeom.setIndex(shapeGeometry.index);
      }
      return newGeom;
    }
    return new THREE.BufferGeometry(); // Fallback olarak boş bir geometri döndür
  }, [shapeGeometry]);

  const edgesGeometry = useMemo(
    () => new THREE.EdgesGeometry(sanitizedGeometry),
    [sanitizedGeometry]
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
        position: position as [number, number, number],
        rotation: rotation as [number, number, number],
        scale: scale as [number, number, number],
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
    if (isFaceEditMode && e.nativeEvent.button === 0) {
      e.stopPropagation();
      
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
      
      const highlight = highlightFace(scene, hit, shape, 0xff6b35, 0.6);
      
      if (highlight && onFaceSelect) {
        onFaceSelect(hit.faceIndex);
        console.log(`🎯 Face ${hit.faceIndex} selected and highlighted`);
      }
      return;
    }
    
    if (isVolumeEditMode && e.nativeEvent.button === 0) {
      e.stopPropagation();
      console.log('🎯 Volume Edit Mode - Vertex selection not yet implemented');
      return;
    }
    
    if (e.nativeEvent.button === 0) {
      e.stopPropagation();
      useAppStore.getState().selectShape(shape.id);
      console.log(`Shape clicked: ${shape.type} (ID: ${shape.id})`);
    }
  };

  const handleContextMenu = (e: any) => {
    if (isFaceEditMode || isVolumeEditMode) {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      return;
    }
    
    if (isSelected && onContextMenuRequest) {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      onContextMenuRequest(e, shape);
      console.log(
        `Context menu requested for shape: ${shape.type} (ID: ${shape.id})`
      );
    }
  };

  useEffect(() => {
    if (!isFaceEditMode && !isVolumeEditMode) {
      clearFaceHighlight(scene);
    }
  }, [isFaceEditMode, isVolumeEditMode, scene]);

  const getShapeColor = () => {
    if (isBeingEdited) return '#ff6b35';
    if (isSelected) return '#60a5fa';
    if (isEditMode && !isBeingEdited) return '#6b7280';
    return SHAPE_COLORS[shape.type as keyof typeof SHAPE_COLORS] || '#94a3b8';
  };

  const getOpacity = () => {
    if (shape.type === 'REFERENCE_CUBE' || (shape as any).isReference) return 0.2;
    return 0;
  };

  const shouldShowEdges = () => {
    return true;
  };

  const getEdgeOpacity = () => {
    return 1.0;
  };

  const getEdgeColor = () => {
    if (viewMode === ViewMode.SOLID) {
      return '#000000';
    } else {
      return '#000000';
    }
  };

  const getEdgeLineWidth = () => {
    const screenWidth = window.innerWidth;
    if (screenWidth < 768) return 0.4;
    if (screenWidth < 1024) return 0.7;
    return 1.0;
  };

  const getMaterialProps = () => {
    const opacityValue = 0.05;
    return {
      color: getShapeColor(),
      transparent: true,
      opacity: opacityValue,
      visible: false,
    };
  };

  return (
    <group>
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
        visible={viewMode === ViewMode.SOLID}
      >
        <meshPhysicalMaterial {...getMaterialProps()} />
      </mesh>

      {shouldShowEdges() && (
        <lineSegments
          geometry={edgesGeometry}
          position={shape.position}
          rotation={shape.rotation}
          scale={shape.scale}
          visible={true}
        >
          <lineBasicMaterial
            color={getEdgeColor()}
            transparent
            opacity={getEdgeOpacity()}
            depthTest={viewMode === ViewMode.SOLID}
            linewidth={getEdgeLineWidth()}
          />
        </lineSegments>
      )}

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
