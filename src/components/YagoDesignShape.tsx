import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { TransformControls, Html } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { SHAPE_COLORS } from '../types/shapes';
import { ViewMode, OrthoMode } from '../store/appStore';
import { applyOrthoConstraint } from '../utils/orthoUtils';
import { applyEdgeConstraints } from '../utils/geometryConstraints';

// New surface highlight management
const surfaceHighlights = new Map<string, THREE.Mesh>();
interface Props {
  shape: Shape;
  onContextMenuRequest?: (event: any, shape: Shape) => void;
  isEditMode?: boolean;
  isBeingEdited?: boolean;
  isFaceEditMode?: boolean;
  onFaceSelect?: (faceIndex: number) => void;
}

const YagoDesignShape: React.FC<Props> = ({
  shape,
  onContextMenuRequest,
  isEditMode = false,
  isBeingEdited = false,
  isFaceEditMode = false,
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
    viewMode,
    updateShape,
    orthoMode,
    isRulerMode,
    convertToDisplayUnit,
    convertToBaseUnit,
    geometryUpdateVersion,
    edgeMeasurements,
    setEdgeMeasurement,
    getEdgeMeasurement,
    evaluateFormula,
  } = useAppStore();
  const isSelected = selectedShapeId === shape.id;
  
  // New surface selection state
  const [isFaceSelectionActive, setIsFaceSelectionActive] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [hoveredEdgeId, setHoveredEdgeId] = useState<string | null>(null);
  const [selectedEdgeId, setSelectedEdgeId] = useState<string | null>(null);

  // Create geometry from shape - update when geometry or version changes
  const shapeGeometry = useMemo(() => {
    console.log(`🔄 Shape ${shape.id} geometry updated, version: ${geometryUpdateVersion}`);
    return shape.geometry;
  }, [shape.geometry, shape.id, geometryUpdateVersion]);

  // Create edges geometry - recreate when shape geometry changes
  const edgesGeometry = useMemo(() => {
    const edges = new THREE.EdgesGeometry(shapeGeometry);
    console.log(`🔄 Shape ${shape.id} edges geometry recreated, version: ${geometryUpdateVersion}`);
    return edges;
  }, [shapeGeometry, shape.id, geometryUpdateVersion]);

  // Generate stable edge ID based on vertex positions
  const getEdgeId = useCallback((start: THREE.Vector3, end: THREE.Vector3) => {
    // Sort coordinates to make ID direction-independent
    const [p1, p2] = start.x < end.x || (start.x === end.x && start.y < end.y) || (start.x === end.x && start.y === end.y && start.z < end.z)
      ? [start, end]
      : [end, start];

    return `${shape.id}-edge-${p1.x.toFixed(3)},${p1.y.toFixed(3)},${p1.z.toFixed(3)}-${p2.x.toFixed(3)},${p2.y.toFixed(3)},${p2.z.toFixed(3)}`;
  }, [shape.id]);

  // Create individual line segments for edge detection - update when edges change
  const lineSegments = useMemo(() => {
    const positions = edgesGeometry.attributes.position;
    const segments: Array<{ start: THREE.Vector3; end: THREE.Vector3; index: number; id: string }> = [];

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
      const edgeId = getEdgeId(start, end);
      segments.push({ start, end, index: i / 2, id: edgeId });
    }

    console.log(`🔄 Shape ${shape.id} line segments recreated: ${segments.length} segments`);
    return segments;
  }, [edgesGeometry, shape.id, geometryUpdateVersion, getEdgeId]);

  // Force mesh geometry update when geometry changes with proper cleanup
  useEffect(() => {
    if (meshRef.current && shape.geometry) {
      const oldGeometry = meshRef.current.geometry;

      if (oldGeometry !== shape.geometry) {
        meshRef.current.geometry = shape.geometry;
        console.log(`✅ Mesh geometry updated for shape ${shape.id}, version: ${geometryUpdateVersion}`);
      }
    }
  }, [shape.geometry, shape.id, geometryUpdateVersion]);

  // Cleanup edges geometry when component unmounts or geometry changes
  useEffect(() => {
    const currentEdges = edgesGeometry;
    return () => {
      if (currentEdges && currentEdges.dispose) {
        currentEdges.dispose();
        console.log(`🗑️ Cleaned up edges geometry for shape ${shape.id}`);
      }
    };
  }, [edgesGeometry, shape.id]);

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
      console.log('Surface highlight creation removed');
    };

    const handleUpdateSurfaceHighlight = (event: CustomEvent) => {
      console.log('Surface highlight update removed');
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
  
  // Handle edge hover for ruler mode with 3D raycasting
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

    let closestEdgeId: string | null = null;
    let minDistance = 2.0;

    lineSegments.forEach((segment) => {
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
      const distance = closestPointOnRay.distanceTo(closestPointOnLine);

      if (distance < minDistance) {
        minDistance = distance;
        closestEdgeId = segment.id;
      }
    });

    setHoveredEdgeId(closestEdgeId);
  };


  const handleEdgeClick = (e: any, edgeId: string) => {
    if (!isRulerMode || !meshRef.current) return;

    e.stopPropagation();

    console.log(`🎯 handleEdgeClick called with edgeId: ${edgeId}`);

    const segment = lineSegments.find(seg => seg.id === edgeId);
    if (!segment) {
      console.error(`❌ No segment found with ID ${edgeId}`);
      return;
    }

    console.log(`   Segment ${edgeId} - start:`, segment.start, 'end:', segment.end);

    const worldStart = segment.start.clone().applyMatrix4(meshRef.current.matrixWorld);
    const worldEnd = segment.end.clone().applyMatrix4(meshRef.current.matrixWorld);

    const length = worldStart.distanceTo(worldEnd);
    const displayLength = convertToDisplayUnit(length);

    const existingMeasurement = getEdgeMeasurement(edgeId);

    // If already confirmed, show the confirmed value
    if (existingMeasurement?.confirmed) {
      console.log(`Edge (${edgeId}) already has confirmed value: ${existingMeasurement.value}`);
      return;
    }

    // Set as selected and dispatch event for Terminal
    setSelectedEdgeId(edgeId);

    // Dispatch event to Terminal with edge info
    const event = new CustomEvent('edgeSelected', {
      detail: {
        shapeId: shape.id,
        edgeId,
        currentLength: displayLength
      }
    });
    window.dispatchEvent(event);

    console.log(`✅ Edge (${edgeId}) selected, current length: ${displayLength.toFixed(2)} mm`);
  };

  const handleMeasurementUpdate = useCallback((newValue: number, formula?: string, targetEdgeId?: string) => {
    const edgeId = targetEdgeId || selectedEdgeId;
    console.log(`🔧 handleMeasurementUpdate called:`, {
      newValue,
      formula,
      targetEdgeId,
      selectedEdgeId,
      finalEdgeId: edgeId
    });

    if (!edgeId || !meshRef.current) {
      console.error(`❌ Cannot update: edgeId is null`);
      return;
    }

    const segment = lineSegments.find(seg => seg.id === edgeId);
    if (!segment) {
      console.error(`❌ No segment found with ID ${edgeId}`);
      return;
    }
    console.log(`   Updating segment (${edgeId})`);
    console.log(`   Segment start:`, segment.start, 'end:', segment.end);

    // Store confirmed measurement
    setEdgeMeasurement(edgeId, newValue, true);

    // newValue is already in mm (display unit), so convert to base unit
    const newBaseLength = convertToBaseUnit(newValue);

    // Update or add edge formula
    const currentFormulas = shape.edgeFormulas || [];
    const existingIndex = currentFormulas.findIndex(f => f.edgeId === edgeId);

    const newFormula = {
      edgeId: edgeId,
      start: [segment.start.x, segment.start.y, segment.start.z] as [number, number, number],
      end: [segment.end.x, segment.end.y, segment.end.z] as [number, number, number],
      formula: formula || newValue.toString(),
      originalLength: newValue,
      currentValue: newValue
    };

    let updatedFormulas;
    if (existingIndex >= 0) {
      updatedFormulas = [...currentFormulas];
      updatedFormulas[existingIndex] = newFormula;
    } else {
      updatedFormulas = [...currentFormulas, newFormula];
    }

    console.log(`📝 Saved edge constraint: edge ${edgeId} = "${newFormula.formula}"`);

    // Convert to EdgeConstraint format
    const constraints = updatedFormulas.map(f => ({
      edgeId: f.edgeId,
      formula: f.formula,
      targetLength: evaluateFormula(f.formula) || 0
    }));

    // Apply all constraints to geometry
    const newGeometry = applyEdgeConstraints(
      shape.geometry,
      constraints,
      (formula) => {
        const result = evaluateFormula(formula);
        return result !== null ? convertToBaseUnit(result) : null;
      }
    );

    // Update shape with new geometry and constraints
    updateShape(shape.id, {
      geometry: newGeometry,
      edgeFormulas: updatedFormulas
    });

    console.log(`✅ Edge (${edgeId}) constrained to ${newValue.toFixed(2)} mm`);
  }, [selectedEdgeId, lineSegments, shape, updateShape, setEdgeMeasurement, convertToBaseUnit, convertToDisplayUnit]);

  // Listen for edge measurement updates from Terminal
  useEffect(() => {
    const handleUpdateEdgeMeasurement = (e: CustomEvent) => {
      const { shapeId, edgeId, newValue, formula } = e.detail;

      if (shapeId === shape.id) {
        console.log(`🔄 Received updateEdgeMeasurement for shape ${shapeId}, edge ${edgeId}, value: ${newValue}`);

        // Update with specific edge ID
        handleMeasurementUpdate(newValue, formula, edgeId);

        // Only clear selection if this was for the selected edge
        if (edgeId === selectedEdgeId) {
          setSelectedEdgeId(null);
        }
      }
    };

    window.addEventListener('updateEdgeMeasurement', handleUpdateEdgeMeasurement as EventListener);

    return () => {
      window.removeEventListener('updateEdgeMeasurement', handleUpdateEdgeMeasurement as EventListener);
    };
  }, [shape.id, selectedEdgeId, handleMeasurementUpdate]);


  const handleClick = (e: any) => {
    // Ruler mode - handle edge selection
    if (isRulerMode && hoveredEdgeId !== null) {
      console.log(`👆 Click detected on hoveredEdgeId: ${hoveredEdgeId}`);
      handleEdgeClick(e, hoveredEdgeId);
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

      {/* 🎯 RULER MODE - Individual edge rendering with hover effect */}
      {isRulerMode && (
        <>
          {lineSegments.map((segment) => {
            const edgeId = segment.id;
            const measurement = getEdgeMeasurement(edgeId);
            const isHovered = hoveredEdgeId === edgeId;
            const isSelected = selectedEdgeId === edgeId;
            const edgeFormula = shape.edgeFormulas?.find(f => getEdgeId(
              new THREE.Vector3(f.start[0], f.start[1], f.start[2]),
              new THREE.Vector3(f.end[0], f.end[1], f.end[2])
            ) === edgeId);
            const points = [segment.start, segment.end];
            const lineGeometry = new THREE.BufferGeometry().setFromPoints(points);

            // Orange for parametric, Red for hover, Blue for confirmed/selected, Black for normal
            const color = edgeFormula ? '#ff8800' : isSelected ? '#0000ff' : (isHovered ? '#ff0000' : (measurement?.confirmed ? '#0000ff' : '#000000'));
            const lineWidth = (isHovered || isSelected || measurement?.confirmed || edgeFormula) ? 5 : 2;

            return (
              <lineSegments
                key={edgeId}
                geometry={lineGeometry}
                position={shape.position}
                rotation={shape.rotation}
                scale={shape.scale}
              >
                <lineBasicMaterial
                  color={color}
                  transparent
                  opacity={1}
                  linewidth={lineWidth}
                  depthTest={false}
                />
              </lineSegments>
            );
          })}

          {/* Measurement labels on edges */}
          {lineSegments.map((segment) => {
            const edgeId = segment.id;
            const measurement = getEdgeMeasurement(edgeId);
            const isHovered = hoveredEdgeId === edgeId;
            const isSelected = selectedEdgeId === edgeId;
            const edgeFormula = shape.edgeFormulas?.find(f => getEdgeId(
              new THREE.Vector3(f.start[0], f.start[1], f.start[2]),
              new THREE.Vector3(f.end[0], f.end[1], f.end[2])
            ) === edgeId);

            if ((isHovered || isSelected || measurement?.confirmed || edgeFormula) && meshRef.current) {
              const worldStart = segment.start.clone().applyMatrix4(meshRef.current.matrixWorld);
              const worldEnd = segment.end.clone().applyMatrix4(meshRef.current.matrixWorld);
              const midPoint = new THREE.Vector3().lerpVectors(worldStart, worldEnd, 0.5);

              const length = worldStart.distanceTo(worldEnd);
              const displayValue = measurement?.confirmed ? measurement.value : convertToDisplayUnit(length);

              return (
                <Html
                  key={`label-${edgeId}`}
                  position={midPoint}
                  center
                  style={{
                    pointerEvents: 'none',
                    userSelect: 'none',
                  }}
                >
                  <div
                    style={{
                      backgroundColor: edgeFormula ? 'rgba(255, 165, 0, 0.9)' : isSelected ? 'rgba(0, 255, 0, 0.9)' : measurement?.confirmed ? 'rgba(0, 0, 255, 0.9)' : 'rgba(255, 0, 0, 0.9)',
                      color: 'white',
                      padding: '4px 8px',
                      borderRadius: '4px',
                      fontSize: '12px',
                      fontWeight: 'bold',
                      whiteSpace: 'nowrap',
                      boxShadow: '0 2px 4px rgba(0,0,0,0.3)',
                    }}
                  >
                    {edgeFormula ? (
                      <span>{edgeFormula.formula} = {displayValue.toFixed(2)} mm</span>
                    ) : (
                      <span>{displayValue.toFixed(2)} mm</span>
                    )}
                  </div>
                </Html>
              );
            }
            return null;
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
            onMouseUp={() => {
              console.log('🎯 TRANSFORM COMPLETE - Mouse released');

              // Re-apply constraints after transform to maintain edge measurements
              if (shape.edgeFormulas && shape.edgeFormulas.length > 0) {
                setTimeout(() => {
                  console.log('🔗 Re-applying constraints after transform');
                  const constraints = shape.edgeFormulas.map(f => ({
                    edgeId: f.edgeId,
                    formula: f.formula,
                    targetLength: evaluateFormula(f.formula) || 0
                  }));

                  const newGeometry = applyEdgeConstraints(
                    shape.geometry,
                    constraints,
                    (formula) => {
                      const result = evaluateFormula(formula);
                      return result !== null ? convertToBaseUnit(result) : null;
                    }
                  );

                  updateShape(shape.id, { geometry: newGeometry });
                  console.log(`✅ Re-applied ${constraints.length} constraints after transform`);
                }, 50);
              }
            }}
          />
        )}
    </group>
  );
};

export default React.memo(YagoDesignShape);