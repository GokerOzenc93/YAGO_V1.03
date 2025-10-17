import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { TransformControls, Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { SHAPE_COLORS } from '../types/shapes';
import { ViewMode, OrthoMode } from '../store/appStore';
import { applyOrthoConstraint } from '../utils/orthoUtils';
import {
  detectFaceAtMouse,
  addFaceHighlight,
  clearFaceHighlight,
  removeFaceHighlightByRowIndex,
  clearTemporaryHighlights,
  clearAllPersistentHighlights
} from '../utils/faceSelection';

// New surface highlight management
const surfaceHighlights = new Map<string, THREE.Mesh>();
interface Props {
  shape: Shape;
  onContextMenuRequest?: (event: any, shape: Shape) => void;
  isEditMode?: boolean;
  isBeingEdited?: boolean;
}

const YagoDesignShape: React.FC<Props> = ({
  shape,
  onContextMenuRequest,
  isEditMode = false,
  isBeingEdited = false,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const transformRef = useRef<any>(null);
  const { scene, camera, gl } = useThree();
  const {
    activeTool,
    selectedShapeId,
    gridSize,
    setSelectedObjectPosition,
    viewMode,
    updateShape,
    orthoMode, // 🎯 NEW: Get ortho mode
    showVertexPoints,
    vertexEditMode,
    setVertexEditMode,
    resetVertexEditMode,
    vertexParameterBindings,
    measurementUnit,
  } = useAppStore();
  const isSelected = selectedShapeId === shape.id;
  
  // New surface selection state
  const [isFaceSelectionActive, setIsFaceSelectionActive] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  // Create geometry from shape
  const shapeGeometry = useMemo(() => {
    return shape.geometry;
  }, [shape.geometry]);

  // Create edges geometry
  const edgesGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(shapeGeometry);
  }, [shapeGeometry]);

  // Extract vertex positions for vertex points
  const vertexPositions = useMemo(() => {
    if (!shapeGeometry.attributes.position) return [];

    const positions = shapeGeometry.attributes.position.array;
    const vertices: [number, number, number][] = [];

    // Extract unique vertices
    const vertexMap = new Map<string, [number, number, number]>();

    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i];
      const y = positions[i + 1];
      const z = positions[i + 2];
      const key = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;

      if (!vertexMap.has(key)) {
        vertexMap.set(key, [x, y, z]);
      }
    }

    return Array.from(vertexMap.values());
  }, [shapeGeometry]);


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

  // Handle transform controls
  useEffect(() => {
    if (!transformRef.current || !isSelected) return;

    const controls = transformRef.current;
    
    // 🎯 NEW: Ortho mode constraint function
    const applyOrthoConstraint = (position: THREE.Vector3, originalPosition: THREE.Vector3) => {
      if (orthoMode === OrthoMode.OFF) return position;
      
      // Calculate movement delta
      const delta = new THREE.Vector3().subVectors(position, originalPosition);
      
      // Find the axis with maximum movement
      const absX = Math.abs(delta.x);
      const absY = Math.abs(delta.y);
      const absZ = Math.abs(delta.z);
      
      // Constrain to the dominant axis
      if (absX >= absY && absX >= absZ) {
        // X axis dominant
        return new THREE.Vector3(position.x, originalPosition.y, originalPosition.z);
      } else if (absY >= absX && absY >= absZ) {
        // Y axis dominant
        return new THREE.Vector3(originalPosition.x, position.y, originalPosition.z);
      } else {
        // Z axis dominant
        return new THREE.Vector3(originalPosition.x, originalPosition.y, position.z);
      }
    };
    
    let originalPosition = new THREE.Vector3(...shape.position);
    let originalRotation = new THREE.Euler(...shape.rotation);
    let originalScale = new THREE.Vector3(...shape.scale);
    
    const handleObjectChange = () => {
      if (!meshRef.current) return;

      if (activeTool === 'Move') {
        let position = meshRef.current.position.clone();
        
        // 🎯 NEW: Apply ortho mode constraint
        position = applyOrthoConstraint(position, originalPosition, orthoMode);
        meshRef.current.position.copy(position);
        
        const snappedPosition = [
          Math.round(position.x / gridSize) * gridSize,
          Math.round(position.y / gridSize) * gridSize,
          Math.round(position.z / gridSize) * gridSize,
        ] as [number, number, number];

        meshRef.current.position.set(...snappedPosition);
        setSelectedObjectPosition(snappedPosition);
        
        // 🎯 UPDATE SHAPE POSITION IN STORE
        updateShape(shape.id, {
          position: snappedPosition
        });
        
        console.log(`🎯 Shape ${shape.id} position updated:`, snappedPosition);
      } else if (activeTool === 'Rotate') {
        const rotation = meshRef.current.rotation.toArray().slice(0, 3) as [number, number, number];
        
        // 🎯 UPDATE SHAPE ROTATION IN STORE
        updateShape(shape.id, {
          rotation: rotation
        });
        
        console.log(`🎯 Shape ${shape.id} rotation updated:`, rotation);
      } else if (activeTool === 'Scale') {
        const scale = meshRef.current.scale.toArray() as [number, number, number];

        // Check if there are vertex bindings
        const shapeBindings = Array.from(vertexParameterBindings.entries())
          .filter(([key]) => key.startsWith(`${shape.id}_`));

        if (shapeBindings.length > 0) {
          // Reapply vertex bindings during scaling
          const newGeometry = shape.geometry.clone();
          const positions = newGeometry.attributes.position;

          shapeBindings.forEach(([key, binding]) => {
            if (binding.displayValue === undefined) return;

            const targetLength = binding.displayValue;
            const axisChar = binding.axis.charAt(0);
            const direction = binding.axis.charAt(1) === '-' ? -1 : 1;
            const axisIndex = axisChar === 'x' ? 0 : axisChar === 'y' ? 1 : 2;

            const targetWorldValue = shape.position[axisIndex] + (targetLength * direction);
            const newLocalValue = (targetWorldValue - shape.position[axisIndex]) / scale[axisIndex];

            const vertexMap = new Map<string, number[]>();
            for (let i = 0; i < positions.count; i++) {
              const x = positions.getX(i);
              const y = positions.getY(i);
              const z = positions.getZ(i);
              const vkey = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
              if (!vertexMap.has(vkey)) {
                vertexMap.set(vkey, [x, y, z]);
              }
            }

            const uniqueVertices = Array.from(vertexMap.values());
            if (binding.vertexIndex >= uniqueVertices.length) return;

            const targetVertex = uniqueVertices[binding.vertexIndex];

            for (let i = 0; i < positions.count; i++) {
              const x = positions.getX(i);
              const y = positions.getY(i);
              const z = positions.getZ(i);

              if (
                Math.abs(x - targetVertex[0]) < 0.0001 &&
                Math.abs(y - targetVertex[1]) < 0.0001 &&
                Math.abs(z - targetVertex[2]) < 0.0001
              ) {
                positions.setComponent(i, axisIndex, newLocalValue);
              }
            }
          });

          positions.needsUpdate = true;
          newGeometry.computeVertexNormals();
          newGeometry.computeBoundingBox();

          updateShape(shape.id, {
            scale: scale,
            geometry: newGeometry
          });
        } else {
          updateShape(shape.id, {
            scale: scale
          });
        }

        console.log(`🎯 Shape ${shape.id} scale updated:`, scale);
      }
    };
    
    const handleMouseDown = () => {
      // Store original position when starting to drag
      originalPosition = new THREE.Vector3(...shape.position);
      originalRotation = new THREE.Euler(...shape.rotation);
      originalScale = new THREE.Vector3(...shape.scale);
    };

    const handleObjectChangeEnd = () => {
      if (!meshRef.current) return;

      // Final update based on active tool
      if (activeTool === 'Move') {
        const finalPosition = meshRef.current.position.toArray() as [number, number, number];
        updateShape(shape.id, {
          position: finalPosition
        });
        console.log(`🎯 Shape ${shape.id} final position:`, finalPosition);
      } else if (activeTool === 'Rotate') {
        const finalRotation = meshRef.current.rotation.toArray().slice(0, 3) as [number, number, number];
        updateShape(shape.id, {
          rotation: finalRotation
        });
        console.log(`🎯 Shape ${shape.id} final rotation:`, finalRotation);
      } else if (activeTool === 'Scale') {
        const finalScale = meshRef.current.scale.toArray() as [number, number, number];

        // Reapply vertex bindings to maintain absolute positions
        const shapeBindings = Array.from(vertexParameterBindings.entries())
          .filter(([key]) => key.startsWith(`${shape.id}_`));

        if (shapeBindings.length > 0) {
          console.log(`🎯 Scale changed, reapplying ${shapeBindings.length} vertex bindings`);

          const newGeometry = shape.geometry.clone();
          const positions = newGeometry.attributes.position;

          shapeBindings.forEach(([key, binding]) => {
            if (binding.displayValue === undefined) return;

            const targetLength = binding.displayValue;
            const axisChar = binding.axis.charAt(0);
            const direction = binding.axis.charAt(1) === '-' ? -1 : 1;
            const axisIndex = axisChar === 'x' ? 0 : axisChar === 'y' ? 1 : 2;

            // Calculate target world position
            const targetWorldValue = shape.position[axisIndex] + (targetLength * direction);

            // Calculate new local position based on NEW scale
            const newLocalValue = (targetWorldValue - shape.position[axisIndex]) / finalScale[axisIndex];

            // Find and update vertices
            const vertexMap = new Map<string, number[]>();
            for (let i = 0; i < positions.count; i++) {
              const x = positions.getX(i);
              const y = positions.getY(i);
              const z = positions.getZ(i);
              const vkey = `${x.toFixed(6)},${y.toFixed(6)},${z.toFixed(6)}`;
              if (!vertexMap.has(vkey)) {
                vertexMap.set(vkey, [x, y, z]);
              }
            }

            const uniqueVertices = Array.from(vertexMap.values());
            if (binding.vertexIndex >= uniqueVertices.length) return;

            const targetVertex = uniqueVertices[binding.vertexIndex];

            for (let i = 0; i < positions.count; i++) {
              const x = positions.getX(i);
              const y = positions.getY(i);
              const z = positions.getZ(i);

              if (
                Math.abs(x - targetVertex[0]) < 0.0001 &&
                Math.abs(y - targetVertex[1]) < 0.0001 &&
                Math.abs(z - targetVertex[2]) < 0.0001
              ) {
                positions.setComponent(i, axisIndex, newLocalValue);
              }
            }
          });

          positions.needsUpdate = true;
          newGeometry.computeVertexNormals();
          newGeometry.computeBoundingBox();

          // Update with both new scale and new geometry
          updateShape(shape.id, {
            scale: finalScale,
            geometry: newGeometry
          });
          console.log(`🎯 Shape ${shape.id} scale and vertex bindings updated`);
        } else {
          // No bindings, just update scale
          updateShape(shape.id, {
            scale: finalScale
          });
          console.log(`🎯 Shape ${shape.id} final scale:`, finalScale);
        }
      }
    };
    
    controls.addEventListener('mouseDown', handleMouseDown);
    controls.addEventListener('objectChange', handleObjectChange);
    controls.addEventListener('mouseUp', handleObjectChangeEnd);

    return () => {
      controls.removeEventListener('mouseDown', handleMouseDown);
      controls.removeEventListener('objectChange', handleObjectChange);
      controls.removeEventListener('mouseUp', handleObjectChangeEnd);
    };
  }, [shape.id, gridSize, isSelected, setSelectedObjectPosition, updateShape, orthoMode, shape.position, shape.rotation, shape.scale, activeTool, vertexParameterBindings, shape.geometry]);

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
  }, [isSelected, setSelectedObjectPosition, shape.id, shape.position]);

  // New surface selection event handlers
  useEffect(() => {
    const handleActivateFaceSelection = (event: CustomEvent) => {
      const { rowId } = event.detail;
      setIsFaceSelectionActive(true);
      setActiveRowId(rowId);
      console.log(`🎯 Face selection activated for row ${rowId} on shape ${shape.id}`);
    };

    const handleCreateSurfaceHighlight = (event: CustomEvent) => {
      const { shapeId, faceIndex, rowId, color, confirmed, faceNumber } = event.detail;
      
      if (shapeId === shape.id && meshRef.current) {
        // Create highlight mesh for the face
        const hits = detectFaceAtMouse(
          { clientX: 0, clientY: 0 } as any, // Dummy event
          camera,
          meshRef.current,
          gl.domElement
        );
        
        // Create a mock hit for the specific face
        const mockHit = {
          faceIndex: faceIndex,
          object: meshRef.current,
          face: { a: 0, b: 1, c: 2 },
          point: new THREE.Vector3()
        };
        
        const highlight = addFaceHighlight(scene, mockHit, shape, color, 0.7, false, faceNumber, rowId);
        
        if (highlight) {
          // Store highlight with rowId for later management
          surfaceHighlights.set(rowId, highlight.mesh);
          
          console.log(`✅ Surface highlight created for face ${faceIndex}, row ${rowId}`);
        }
      }
    };

    const handleUpdateSurfaceHighlight = (event: CustomEvent) => {
      const { rowId, faceIndex, role, color } = event.detail;
      
      // Remove old highlight
      const oldHighlight = surfaceHighlights.get(rowId);
      if (oldHighlight) {
        scene.remove(oldHighlight);
        if (oldHighlight.geometry) oldHighlight.geometry.dispose();
        if (oldHighlight.material) {
          if (Array.isArray(oldHighlight.material)) {
            oldHighlight.material.forEach(mat => mat.dispose());
          } else {
            oldHighlight.material.dispose();
          }
        }
      }
      
      // Create new highlight with updated color
      if (meshRef.current) {
        const mockHit = {
          faceIndex: faceIndex,
          object: meshRef.current,
          face: { a: 0, b: 1, c: 2 },
          point: new THREE.Vector3()
        };
        
        const highlight = addFaceHighlight(scene, mockHit, shape, color, 0.7, false, undefined, undefined);
        
        if (highlight) {
          surfaceHighlights.set(rowId, highlight.mesh);
          
          console.log(`✅ Surface highlight updated for row ${rowId}, role: ${role}`);
        }
      }
    };

    const handleRemoveSurfaceHighlight = (event: CustomEvent) => {
      const { rowId } = event.detail;
      
      const highlight = surfaceHighlights.get(rowId);
      if (highlight) {
        scene.remove(highlight);
        if (highlight.geometry) highlight.geometry.dispose();
        if (highlight.material) {
          if (Array.isArray(highlight.material)) {
            highlight.material.forEach(mat => mat.dispose());
          } else {
            highlight.material.dispose();
          }
        }
        surfaceHighlights.delete(rowId);
        
        // Remove face number text
        
        console.log(`✅ Surface highlight removed for row ${rowId}`);
      }
    };

    const handleClearAllSurfaceHighlights = () => {
      surfaceHighlights.forEach((highlight, rowId) => {
        scene.remove(highlight);
        if (highlight.geometry) highlight.geometry.dispose();
        if (highlight.material) {
          if (Array.isArray(highlight.material)) {
            highlight.material.forEach(mat => mat.dispose());
          } else {
            highlight.material.dispose();
          }
        }
        removeFaceNumberText(rowId);
      });
      surfaceHighlights.clear();
      console.log('✅ All surface highlights cleared');
    };

    const handleShapeDimensionsChanged = (event: CustomEvent) => {
      const { shapeId, dimension, newValue, newScale } = event.detail;

      if (shapeId === shape.id && surfaceHighlights.size > 0) {
        console.log(`🎯 Shape dimensions changed for shape ${shapeId}, updating ${surfaceHighlights.size} surface highlights`);

        surfaceHighlights.forEach((highlight, rowId) => {
          scene.remove(highlight);
          if (highlight.geometry) highlight.geometry.dispose();
          if (highlight.material) {
            if (Array.isArray(highlight.material)) {
              highlight.material.forEach(mat => mat.dispose());
            } else {
              highlight.material.dispose();
            }
          }

          const faceIndex = (highlight as any).userData?.faceIndex;
          const color = (highlight.material as THREE.MeshBasicMaterial).color.getHex();
          const opacity = (highlight.material as THREE.MeshBasicMaterial).opacity;

          if (faceIndex !== undefined && meshRef.current) {
            const mockHit = {
              faceIndex: faceIndex,
              object: meshRef.current,
              face: { a: 0, b: 1, c: 2 },
              point: new THREE.Vector3()
            };

            const newHighlight = addFaceHighlight(scene, mockHit, shape, color, opacity, false, undefined, rowId);

            if (newHighlight) {
              surfaceHighlights.set(rowId, newHighlight.mesh);
              console.log(`✅ Surface highlight recreated for row ${rowId} after dimension change`);
            }
          }
        });
      }
    };

    window.addEventListener('activateFaceSelection', handleActivateFaceSelection as EventListener);
    window.addEventListener('createSurfaceHighlight', handleCreateSurfaceHighlight as EventListener);
    window.addEventListener('updateSurfaceHighlight', handleUpdateSurfaceHighlight as EventListener);
    window.addEventListener('removeSurfaceHighlight', handleRemoveSurfaceHighlight as EventListener);
    window.addEventListener('clearAllSurfaceHighlights', handleClearAllSurfaceHighlights as EventListener);
    window.addEventListener('shapeDimensionsChanged', handleShapeDimensionsChanged as EventListener);

    return () => {
      window.removeEventListener('activateFaceSelection', handleActivateFaceSelection as EventListener);
      window.removeEventListener('createSurfaceHighlight', handleCreateSurfaceHighlight as EventListener);
      window.removeEventListener('updateSurfaceHighlight', handleUpdateSurfaceHighlight as EventListener);
      window.removeEventListener('removeSurfaceHighlight', handleRemoveSurfaceHighlight as EventListener);
      window.removeEventListener('clearAllSurfaceHighlights', handleClearAllSurfaceHighlights as EventListener);
      window.removeEventListener('shapeDimensionsChanged', handleShapeDimensionsChanged as EventListener);
    };
  }, [scene, camera, gl.domElement, shape]);

  const removeFaceNumberText = (rowId: string) => {
    const objectsToRemove: THREE.Object3D[] = [];
    scene.traverse((object) => {
      if (object.userData?.rowId === rowId && object.userData?.type === 'faceNumber') {
        objectsToRemove.push(object);
      }
    });
    
    objectsToRemove.forEach(object => {
      scene.remove(object);
      if (object instanceof THREE.Sprite && object.material.map) {
        object.material.map.dispose();
        object.material.dispose();
      }
    });
  };
  
  const handleClick = (e: any) => {
    // New surface selection mode
    if (isFaceSelectionActive && e.nativeEvent.button === 0) {
      e.stopPropagation();
      
      const hits = detectFaceAtMouse(
        e.nativeEvent,
        camera,
        meshRef.current!,
        gl.domElement
      );

      if (hits.length === 0) {
        console.warn('🎯 No face detected');
        return;
      }

      const hit = hits[0];
      if (hit.faceIndex === undefined) {
        console.warn('🎯 No face index');
        return;
      }

      // Send face selection event
      const faceSelectedEvent = new CustomEvent('faceSelected', {
        detail: {
          faceIndex: hit.faceIndex,
          shapeId: shape.id
        }
      });
      window.dispatchEvent(faceSelectedEvent);
      
      console.log(`🎯 Face ${hit.faceIndex} selected on shape ${shape.id}`);
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
    // Normal context menu - only show for selected shapes AND not in edit mode
    if (isSelected && onContextMenuRequest && !isEditMode) {
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
    
    // Extrude edilmiş şekiller için normal renkler
    if (shape.type === 'box') return '#2563eb'; // Mavi
    if (shape.type === 'cylinder') return '#0d9488'; // Teal
    
    return SHAPE_COLORS[shape.type as keyof typeof SHAPE_COLORS] || '#94a3b8';
  };

  // 🎯 NEW: Get opacity based on view mode
  const getOpacity = () => {
    // Edit modda referans volume her zaman wireframe (şeffaf)
    if (isEditMode && !isBeingEdited) return 0.0;

    // Referans cube her zaman wireframe
    if (shape.type === 'REFERENCE_CUBE' || shape.isReference) return 0.0;

    // 🎯 EDIT MODE: Normal sahnedeki gibi şeffaf
    return 0.0; // Tüm şekiller tamamen şeffaf (sadece çizgiler görünür)
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
    const opacityValue = getOpacity(); // 👈 Dinamik opacity

    return {
      color: getShapeColor(),
      transparent: true, // 👈 Şeffaflık aktif
      opacity: opacityValue,
      visible: true, // 👈 2D şekiller için görünür (gizmo etkileşimi için)
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
        visible={true} // 👈 2D şekiller için her zaman görünür (gizmo etkileşimi için)
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

      {/* 🎯 TRANSFORM CONTROLS - 2D ve 3D şekiller için aktif */}
      {isSelected &&
        meshRef.current &&
        !isEditMode &&
        !isFaceSelectionActive && (
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
            showX={true}
            showY={shape.is2DShape ? false : true} // 2D şekillerde Y ekseni gizli
            showZ={true}
            enabled={true}
            space="local"
            onObjectChange={() => {
              console.log('🎯 GIZMO CHANGE - Transform controls object changed');
            }}
          />
        )}

      {/* 🎯 VERTEX POINTS - Show all vertex points when enabled */}
      {showVertexPoints && isBeingEdited && vertexPositions.map((pos, index) => {
        const worldPos = [
          pos[0] * shape.scale[0] + shape.position[0],
          pos[1] * shape.scale[1] + shape.position[1],
          pos[2] * shape.scale[2] + shape.position[2]
        ] as [number, number, number];

        const isHovered = vertexEditMode.hoveredVertexIndex === index;
        const isSelectedVertex = vertexEditMode.selectedVertexIndex === index;

        return (
          <group key={`vertex-${index}`}>
            {/* Vertex Point */}
            <mesh
              position={worldPos}
              onPointerOver={(e) => {
                e.stopPropagation();
                setVertexEditMode({ hoveredVertexIndex: index });
              }}
              onPointerOut={(e) => {
                e.stopPropagation();
                if (vertexEditMode.hoveredVertexIndex === index) {
                  setVertexEditMode({ hoveredVertexIndex: null });
                }
              }}
              onClick={(e) => {
                e.stopPropagation();

                // If this vertex is already selected, cycle through axes
                if (isSelectedVertex) {
                  const axisOrder: Array<'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-' | null> = ['x+', 'x-', 'y+', 'y-', 'z+', 'z-', null];
                  const currentAxisIndex = vertexEditMode.activeAxis
                    ? axisOrder.indexOf(vertexEditMode.activeAxis)
                    : -1;
                  const nextAxis = axisOrder[(currentAxisIndex + 1) % axisOrder.length];

                  if (nextAxis === null) {
                    // Reset selection
                    resetVertexEditMode();
                  } else {
                    setVertexEditMode({ activeAxis: nextAxis });
                  }
                  console.log(`Vertex ${index} axis cycled to: ${nextAxis}`);
                } else {
                  // Select this vertex and start with X+ axis
                  setVertexEditMode({
                    selectedVertexIndex: index,
                    activeAxis: 'x+',
                    isActive: false,
                  });
                  console.log(`Vertex ${index} selected, starting with X+`);
                }
              }}
              onPointerDown={(e) => {
                // Right click (button 2) to confirm
                if (e.button === 2 && isSelectedVertex && vertexEditMode.activeAxis) {
                  e.stopPropagation();
                  console.log(`Vertex ${index} confirmed on axis ${vertexEditMode.activeAxis}`);
                  setVertexEditMode({ isActive: true });
                }
              }}
            >
              <sphereGeometry args={[15, 16, 16]} />
              <meshBasicMaterial
                color={isSelectedVertex ? '#ff0000' : isHovered ? '#ff6600' : '#000000'}
                depthTest={false}
              />
            </mesh>

            {/* Red Arrow for Active Axis (during selection) */}
            {isSelectedVertex && vertexEditMode.activeAxis && (() => {
              const axis = vertexEditMode.activeAxis;
              const direction = new THREE.Vector3(
                axis === 'x+' ? 1 : axis === 'x-' ? -1 : 0,
                axis === 'y+' ? 1 : axis === 'y-' ? -1 : 0,
                axis === 'z+' ? 1 : axis === 'z-' ? -1 : 0
              );
              return (
                <arrowHelper
                  args={[
                    direction,
                    new THREE.Vector3(...worldPos),
                    100,
                    0xff0000,
                    30,
                    20
                  ]}
                />
              );
            })()}

            {/* Display arrows and values for confirmed bindings */}
            {['x+', 'x-', 'y+', 'y-', 'z+', 'z-'].map((axis) => {
              const bindingKey = `${shape.id}_${index}_${axis}`;
              const binding = vertexParameterBindings.get(bindingKey);

              if (!binding) return null;

              const direction = new THREE.Vector3(
                axis === 'x+' ? 1 : axis === 'x-' ? -1 : 0,
                axis === 'y+' ? 1 : axis === 'y-' ? -1 : 0,
                axis === 'z+' ? 1 : axis === 'z-' ? -1 : 0
              );

              const arrowLength = 100;
              const arrowEndPos = new THREE.Vector3(...worldPos).add(
                direction.clone().multiplyScalar(arrowLength)
              );

              // Format display text
              let displayText = '';
              if (binding.parameterCode && binding.displayValue !== undefined) {
                // Show "a=200" format
                displayText = `${binding.parameterCode}=${binding.displayValue.toFixed(0)}`;
              } else if (binding.parameterCode) {
                // Show just parameter code (waiting for value)
                displayText = binding.parameterCode;
              } else if (binding.displayValue !== undefined) {
                // Show just the value
                displayText = `${binding.displayValue.toFixed(0)}`;
              }

              return (
                <group key={bindingKey}>
                  {/* Persistent Arrow */}
                  <arrowHelper
                    args={[
                      direction,
                      new THREE.Vector3(...worldPos),
                      arrowLength,
                      0xff0000,
                      30,
                      20
                    ]}
                  />

                  {/* Label at arrow tip */}
                  {displayText && (
                    <Html
                      position={[arrowEndPos.x, arrowEndPos.y, arrowEndPos.z]}
                      style={{
                        background: 'rgba(255, 0, 0, 0.9)',
                        color: 'white',
                        padding: '4px 8px',
                        borderRadius: '4px',
                        fontSize: '12px',
                        fontWeight: 'bold',
                        whiteSpace: 'nowrap',
                        pointerEvents: 'none',
                        userSelect: 'none',
                      }}
                    >
                      {displayText} {measurementUnit}
                    </Html>
                  )}
                </group>
              );
            })}
          </group>
        );
      })}
    </group>
  );
};

export default React.memo(YagoDesignShape);