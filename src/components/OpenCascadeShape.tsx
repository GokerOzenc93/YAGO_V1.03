 import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
 import React, { useRef, useEffect, useMemo } from 'react';
 import { useAppStore } from '../store/appStore';
 import { TransformControls } from '@react-three/drei';
 import { useThree } from '@react-three/fiber';
 import * as THREE from 'three';
 import { Shape } from '../types/shapes';
 import { SHAPE_COLORS } from '../types/shapes';
 import { ViewMode } from '../store/appStore';
-import { 
-  detectFaceAtMouse, 
-  highlightFace, 
-  clearFaceHighlight,
-  getCurrentHighlight 
+import {
+  detectFacesAtMouse,
+  highlightFace,
+  clearFaceHighlight
 } from '../utils/faceSelection';
 
 interface Props {
   shape: Shape;
   onContextMenuRequest?: (event: any, shape: Shape) => void;
   isEditMode?: boolean;
   isBeingEdited?: boolean;
   // Face Edit Mode props
   isFaceEditMode?: boolean;
-  selectedFaceIndex?: number | null;
   onFaceSelect?: (faceIndex: number) => void;
 }
 
 const OpenCascadeShape: React.FC<Props> = ({
   shape,
   onContextMenuRequest,
   isEditMode = false,
   isBeingEdited = false,
   // Face Edit Mode props
   isFaceEditMode = false,
-  selectedFaceIndex,
   onFaceSelect,
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
+  const faceCycleRef = useRef<{
+    mouse: { x: number; y: number };
+    hits: THREE.Intersection[];
+    index: number;
+  } | null>(null);
 
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
diff --git a/src/components/OpenCascadeShape.tsx b/src/components/OpenCascadeShape.tsx
index 24433e4d1fd4666e3735d47242f56b1b2949cbf5..902ec0a5205c9b6c69f8d8a853ee4bd6a6c37448 100644
--- a/src/components/OpenCascadeShape.tsx
+++ b/src/components/OpenCascadeShape.tsx
@@ -119,67 +121,85 @@ const OpenCascadeShape: React.FC<Props> = ({
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
-      
-      // Three.js tabanlı face detection
-      const hit = detectFaceAtMouse(
-        e.nativeEvent, 
-        camera, 
-        meshRef.current!, 
+      const hits = detectFacesAtMouse(
+        e.nativeEvent,
+        camera,
+        meshRef.current!,
         gl.domElement
       );
-      
-      if (!hit || hit.faceIndex === undefined) {
+
+      if (hits.length === 0) {
         console.warn('🎯 No face detected');
         return;
       }
-      
-      // Face highlight ekle
+
+      const { clientX, clientY } = e.nativeEvent;
+      let cycle = faceCycleRef.current;
+
+      if (
+        !cycle ||
+        Math.abs(cycle.mouse.x - clientX) > 2 ||
+        Math.abs(cycle.mouse.y - clientY) > 2
+      ) {
+        cycle = { mouse: { x: clientX, y: clientY }, hits, index: 0 };
+      } else {
+        cycle.hits = hits;
+        cycle.index = (cycle.index + 1) % hits.length;
+      }
+
+      faceCycleRef.current = cycle;
+
+      const hit = cycle.hits[cycle.index];
+      if (hit.faceIndex === undefined) {
+        console.warn('🎯 No face index');
+        return;
+      }
+
       const highlight = highlightFace(scene, hit, shape, 0xff6b35, 0.6);
-      
       if (highlight && onFaceSelect) {
         onFaceSelect(hit.faceIndex);
         console.log(`🎯 Face ${hit.faceIndex} selected and highlighted`);
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
     if (isSelected && onContextMenuRequest) 

      e.stopPropagation();
      e.nativeEvent.preventDefault();
      onContextMenuRequest(e, shape);
      console.log(
        `Context menu requested for shape: ${shape.type} (ID: ${shape.id})`
      );
    }
  };

  // Face Edit mode'dan çıkıldığında highlight'ı temizle
  useEffect(() => {
    if (!isFaceEditMode) {
      clearFaceHighlight(scene);
    }
  }, [isFaceEditMode, scene]);

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