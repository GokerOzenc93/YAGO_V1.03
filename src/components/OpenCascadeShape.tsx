<<<<<<< HEAD
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

=======
import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { SHAPE_COLORS } from '../types/shapes';
import { ViewMode } from '../store/appStore';
import {
  createBox as createOcBox,
  createCylinder as createOcCylinder,
  ocShapeToThreeGeometry
} from '../lib/opencascadeUtils';

interface Props {
  shape: Shape;
  onContextMenuRequest?: (event: any, shape: Shape) => void;
  isEditMode?: boolean;
  isBeingEdited?: boolean;
  isFaceEditMode?: boolean;
  selectedFaceIndex?: number | null;
  onFaceSelect?: (faceIndex: number) => void;
  isVolumeEditMode?: boolean;
}

const OpenCascadeShape: React.FC<Props> = ({
  shape,
  onContextMenuRequest,
  isEditMode = false,
  isBeingEdited = false,
  isFaceEditMode = false,
  onFaceSelect,
  isVolumeEditMode = false,
}) => {
  // HATA DÜZELTMESİ: Bileşenin en başında, 'shape' prop'unun geçerli olup olmadığını kontrol et.
  // Bu, 'position' gibi özelliklere erişmeye çalışırken oluşan çökmeyi engeller.
  if (!shape) {
    return null;
  }

  const meshRef = useRef<THREE.Mesh>(null);
  const transformRef = useRef<any>(null);
  const {
    activeTool,
    selectedShapeId,
    gridSize,
    setSelectedObjectPosition,
    viewMode,
  } = useAppStore();
  const isSelected = selectedShapeId === shape.id;

  // Geometriyi bileşenin kendi içinde state olarak tutuyoruz.
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  // Bu effect, bileşen yüklendiğinde OCC ile geometriyi oluşturur.
  useEffect(() => {
    let isMounted = true;
    const generateGeometry = async () => {
      const ocInstance = (window as any).oc;
      if (!ocInstance) {
        console.warn("OCC instance'ı hazır değil, bekleniyor:", shape.id);
        return;
      }

      let ocShape;
      try {
        if (shape.type === 'box') {
          const { width, height, depth } = shape.parameters;
          ocShape = createOcBox(ocInstance, width, height, depth);
        } else if (shape.type === 'cylinder') {
          const { radius, height } = shape.parameters;
          ocShape = createOcCylinder(ocInstance, radius, height);
        } else {
          return;
        }

        if (ocShape) {
          const threeGeom = ocShapeToThreeGeometry(ocInstance, ocShape);
          if (threeGeom && isMounted) {
            setGeometry(threeGeom); // Oluşturulan geometriyi state'e kaydet
          }
        }
      } catch (error) {
        console.error(`'${shape.id}' ID'li şekil için geometri oluşturulurken hata:`, error);
      }
    };

    generateGeometry();

    return () => {
      isMounted = false;
    };
  }, [shape.id, shape.type, shape.parameters]);

  const edgesGeometry = useMemo(() => {
    if (!geometry) return null;
    const newGeom = new THREE.BufferGeometry();
    newGeom.setAttribute('position', geometry.attributes.position);
    if (geometry.index) {
      newGeom.setIndex(geometry.index);
    }
    return new THREE.EdgesGeometry(newGeom);
  }, [geometry]);

  useEffect(() => {
    const controls = transformRef.current;
    if (!controls) return;
    
    const handleObjectChange = () => {
      const mesh = meshRef.current;
      if (!mesh) return;
      const { position, rotation, scale } = mesh;
      useAppStore.getState().updateShape(shape.id, {
        position: position.toArray() as [number, number, number],
        rotation: rotation.toArray().slice(0, 3) as [number, number, number],
        scale: scale.toArray() as [number, number, number],
      });
      if (isSelected) {
        setSelectedObjectPosition(position.toArray() as [number, number, number]);
      }
    };

    controls.addEventListener('objectChange', handleObjectChange);
    return () => controls.removeEventListener('objectChange', handleObjectChange);
  }, [shape.id, isSelected, setSelectedObjectPosition]);

  // HATA DÜZELTMESİ: Geometri hazır olana kadar hiçbir şey render etme.
  if (!geometry || !edgesGeometry) {
    return null;
  }

  const handleClick = (e: any) => {
    if (e.nativeEvent.button === 0) {
      e.stopPropagation();
      useAppStore.getState().selectShape(shape.id);
    }
  };

  const handleContextMenu = (e: any) => {
    if (isSelected && onContextMenuRequest) {
>>>>>>> parent of 06cd4d0 (Updated App.tsx)
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      onContextMenuRequest(e, shape);
    }
  };
  
  const getShapeColor = () => {
    if (isBeingEdited) return '#ff6b35';
    if (isSelected) return '#60a5fa';
    if (isEditMode && !isBeingEdited) return '#6b7280';
    return SHAPE_COLORS[shape.type as keyof typeof SHAPE_COLORS] || '#94a3b8';
  };

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        position={shape.position}
        rotation={shape.rotation}
        scale={shape.scale}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        castShadow
        receiveShadow
        visible={viewMode === ViewMode.SOLID}
      >
        <meshPhysicalMaterial 
          color={getShapeColor()}
          transparent={true}
          opacity={0.9} // Görünürlüğü artır
          side={THREE.DoubleSide}
        />
      </mesh>

      <lineSegments
        geometry={edgesGeometry}
        position={shape.position}
        rotation={shape.rotation}
        scale={shape.scale}
        visible={true}
      >
        <lineBasicMaterial
          color={viewMode === ViewMode.SOLID ? '#000000' : getShapeColor()}
        />
      </lineSegments>

      {isSelected && meshRef.current && !isEditMode && !isFaceEditMode && (
          <TransformControls
            ref={transformRef}
            object={meshRef.current}
            mode={
              activeTool === 'Move' ? 'translate' :
              activeTool === 'Rotate' ? 'rotate' :
              'scale'
            }
          />
        )}
    </group>
  );
};

export default OpenCascadeShape;
