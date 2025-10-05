import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { TransformControls } from '@react-three/drei';
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
    orthoMode,
    isRulerMode,
    addSelectedLine,
    convertToDisplayUnit,
  } = useAppStore();
  const isSelected = selectedShapeId === shape.id;
  
  // New surface selection state
  const [isFaceSelectionActive, setIsFaceSelectionActive] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);

  // Create geometry from shape
  const shapeGeometry = useMemo(() => {
    return shape.geometry;
  }, [shape.geometry]);

  // Create edges geometry
  const edgesGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(shapeGeometry);
  }, [shapeGeometry]);

  // Create individual line segments for edge detection
  const lineSegments = useMemo(() => {
    const positions = edgesGeometry.attributes.position;
    const segments: Array<{ start: THREE.Vector3; end: THREE.Vector3; index: number }> = [];

    for (let i = 0; i < positions.count; i += 2) {
      const start = new THREE.Vector3(
        positions.getX(i),
        positions.getY(i),
        positions.getZ(i)
      );
      const end = new THREE.Vector3(
        positions.getX(i + 1),
        positions.getY(i + 1),
        positions.getZ(i + 1)
      );
      segments.push({ start, end, index: i / 2 });
    }

    return segments;
  }, [edgesGeometry]);

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

        // 🎯 CRITICAL FIX: Geometry is now positioned with min corner at origin (0,0,0)
        // This means when we scale with gizmo, it naturally grows in X+, Y+, Z+ directions!
        // We DON'T need to adjust position because the geometry's origin IS the min corner

        // 🎯 UPDATE SHAPE SCALE IN STORE (position stays the same)
        updateShape(shape.id, {
          scale: scale
        });

        console.log(`🎯 Gizmo Scale: Shape ${shape.id} scaled from origin (min corner):`, {
          scale,
          position: shape.position
        });
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

        updateShape(shape.id, {
          scale: finalScale
        });

        console.log(`🎯 Shape ${shape.id} final scale from origin:`, {
          scale: finalScale,
          position: shape.position
        });
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
  }, [shape.id, gridSize, isSelected, setSelectedObjectPosition, updateShape, orthoMode, shape.position, shape.rotation, shape.scale, activeTool]);

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

    window.addEventListener('activateFaceSelection', handleActivateFaceSelection as EventListener);
    window.addEventListener('createSurfaceHighlight', handleCreateSurfaceHighlight as EventListener);
    window.addEventListener('updateSurfaceHighlight', handleUpdateSurfaceHighlight as EventListener);
    window.addEventListener('removeSurfaceHighlight', handleRemoveSurfaceHighlight as EventListener);
    window.addEventListener('clearAllSurfaceHighlights', handleClearAllSurfaceHighlights as EventListener);

    return () => {
      window.removeEventListener('activateFaceSelection', handleActivateFaceSelection as EventListener);
      window.removeEventListener('createSurfaceHighlight', handleCreateSurfaceHighlight as EventListener);
      window.removeEventListener('updateSurfaceHighlight', handleUpdateSurfaceHighlight as EventListener);
      window.removeEventListener('removeSurfaceHighlight', handleRemoveSurfaceHighlight as EventListener);
      window.removeEventListener('clearAllSurfaceHighlights', handleClearAllSurfaceHighlights as EventListener);
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
  
  // Handle edge hover for ruler mode with hybrid 3D + 2D detection
  const handleEdgePointerMove = (e: any) => {
    if (!isRulerMode || !meshRef.current) {
      if (hoveredEdge !== null) setHoveredEdge(null);
      return;
    }

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);

    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    let closestEdge: number | null = null;
    let minScore = Infinity;

    lineSegments.forEach((segment, idx) => {
      const worldStart = segment.start.clone().applyMatrix4(meshRef.current!.matrixWorld);
      const worldEnd = segment.end.clone().applyMatrix4(meshRef.current!.matrixWorld);

      const lineDir = new THREE.Vector3().subVectors(worldEnd, worldStart);
      const lineLength = lineDir.length();
      lineDir.normalize();

      const ray = raycaster.ray;
      const rayDir = ray.direction;
      const rayOrigin = ray.origin;

      const w = new THREE.Vector3().subVectors(rayOrigin, worldStart);
      const a = rayDir.dot(rayDir);
      const b = rayDir.dot(lineDir);
      const c = lineDir.dot(lineDir);
      const d = rayDir.dot(w);
      const e = lineDir.dot(w);
      const denominator = a * c - b * b;

      if (Math.abs(denominator) < 0.0001) return;

      const sc = (b * e - c * d) / denominator;
      const tc = (a * e - b * d) / denominator;

      if (tc < 0 || tc > lineLength) return;

      const closestPointOnRay = rayOrigin.clone().addScaledVector(rayDir, sc);
      const closestPointOnLine = worldStart.clone().addScaledVector(lineDir, tc);
      const distance3D = closestPointOnRay.distanceTo(closestPointOnLine);

      const screenStart = worldStart.project(camera);
      const screenEnd = worldEnd.project(camera);

      const startX = (screenStart.x * 0.5 + 0.5) * rect.width;
      const startY = (-screenStart.y * 0.5 + 0.5) * rect.height;
      const endX = (screenEnd.x * 0.5 + 0.5) * rect.width;
      const endY = (-screenEnd.y * 0.5 + 0.5) * rect.height;

      const dx = endX - startX;
      const dy = endY - startY;
      const screenLineLength = Math.sqrt(dx * dx + dy * dy);

      if (screenLineLength < 1) return;

      const t = Math.max(0, Math.min(1, ((mouseX - startX) * dx + (mouseY - startY) * dy) / (screenLineLength * screenLineLength)));
      const closestX = startX + t * dx;
      const closestY = startY + t * dy;
      const distance2D = Math.sqrt(Math.pow(mouseX - closestX, 2) + Math.pow(mouseY - closestY, 2));

      const score = distance3D * 0.3 + distance2D * 0.7;

      if (distance3D < 5.0 && distance2D < 50 && score < minScore) {
        minScore = score;
        closestEdge = idx;
      }
    });

    setHoveredEdge(closestEdge);
  };

  const handleEdgeClick = (e: any) => {
    if (!isRulerMode || hoveredEdge === null || !meshRef.current) return;

    e.stopPropagation();

    const segment = lineSegments[hoveredEdge];
    const worldStart = segment.start.clone().applyMatrix4(meshRef.current.matrixWorld);
    const worldEnd = segment.end.clone().applyMatrix4(meshRef.current.matrixWorld);

    const length = worldStart.distanceTo(worldEnd);
    const displayLength = convertToDisplayUnit(length);

    addSelectedLine({
      id: `${shape.id}-edge-${hoveredEdge}-${Date.now()}`,
      value: displayLength,
      label: `Edge ${hoveredEdge + 1} (${shape.type})`,
      shapeId: shape.id,
      edgeIndex: hoveredEdge,
      startVertex: segment.start.toArray() as [number, number, number],
      endVertex: segment.end.toArray() as [number, number, number]
    });

    console.log(`✅ Line selected: ${displayLength.toFixed(2)} units`);
  };

  const handleClick = (e: any) => {
    // Ruler mode - handle edge selection
    if (isRulerMode && hoveredEdge !== null) {
      handleEdgeClick(e);
      return;
    }

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
        onPointerMove={isRulerMode ? handleEdgePointerMove : undefined}
        onContextMenu={handleContextMenu}
        castShadow
        receiveShadow
        visible={true}
      >
        <meshPhysicalMaterial {...getMaterialProps()} />
      </mesh>

      {/* 🎯 VIEW MODE BASED EDGES - Görünüm moduna göre çizgiler */}
      {shouldShowEdges() && !isRulerMode && (
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

      {/* 🎯 RULER MODE - Individual edge rendering with hover effect using mesh tubes */}
      {isRulerMode && (
        <>
          {lineSegments.map((segment, idx) => {
            const isHovered = hoveredEdge === idx;
            const direction = new THREE.Vector3().subVectors(segment.end, segment.start);
            const length = direction.length();
            const center = new THREE.Vector3().addVectors(segment.start, segment.end).multiplyScalar(0.5);

            const cylinderGeometry = new THREE.CylinderGeometry(
              isHovered ? 0.08 : 0.04,
              isHovered ? 0.08 : 0.04,
              length,
              8
            );

            const quaternion = new THREE.Quaternion();
            quaternion.setFromUnitVectors(
              new THREE.Vector3(0, 1, 0),
              direction.clone().normalize()
            );

            return (
              <mesh
                key={idx}
                geometry={cylinderGeometry}
                position={[
                  shape.position[0] + center.x * shape.scale[0],
                  shape.position[1] + center.y * shape.scale[1],
                  shape.position[2] + center.z * shape.scale[2]
                ]}
                quaternion={quaternion}
                renderOrder={999}
              >
                <meshBasicMaterial
                  color={isHovered ? '#ff0000' : '#1a1a1a'}
                  transparent
                  opacity={isHovered ? 1.0 : 0.8}
                  depthTest={true}
                  depthWrite={false}
                />
              </mesh>
            );
          })}
        </>
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
    </group>
  );
};

export default React.memo(YagoDesignShape);