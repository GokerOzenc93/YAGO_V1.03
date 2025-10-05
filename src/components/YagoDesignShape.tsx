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
import {
  findClosestEdgePoint,
  createRulerPointMarker,
  clearRulerPointMarkers
} from '../utils/edgeSelection';

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
  } = useAppStore();
  const isSelected = selectedShapeId === shape.id;
  
  const [isFaceSelectionActive, setIsFaceSelectionActive] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);
  const [isRulerMode, setIsRulerMode] = useState(false);
  const [hoveredEdgeIndex, setHoveredEdgeIndex] = useState<number | null>(null);
  const [selectedEdges, setSelectedEdges] = useState<number[]>([]);
  const highlightedEdgesRef = useRef<THREE.LineSegments | null>(null);
  const selectedEdgesRef = useRef<THREE.LineSegments[]>([]);
  const selectedPointsRef = useRef<THREE.Vector3[]>([]);
  const dimensionLineRef = useRef<THREE.Group | null>(null);

  // Create geometry from shape
  const shapeGeometry = useMemo(() => {
    return shape.geometry;
  }, [shape.geometry]);

  // Create edges geometry
  const edgesGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(shapeGeometry);
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

    const handleActivateRulerMode = () => {
      setIsRulerMode(true);
      setSelectedEdges([]);
      selectedPointsRef.current = [];
      selectedEdgesRef.current.forEach(line => {
        scene.remove(line);
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });
      selectedEdgesRef.current = [];
      if (dimensionLineRef.current) {
        scene.remove(dimensionLineRef.current);
        dimensionLineRef.current = null;
      }
      console.log(`🎯 Ruler mode activated on shape ${shape.id}`);
    };

    const handleClearRulerPoints = () => {
      clearRulerPointMarkers(scene);
      setSelectedEdges([]);
      selectedPointsRef.current = [];
      selectedEdgesRef.current.forEach(line => {
        scene.remove(line);
        line.geometry.dispose();
        (line.material as THREE.Material).dispose();
      });
      selectedEdgesRef.current = [];
      if (dimensionLineRef.current) {
        scene.remove(dimensionLineRef.current);
        dimensionLineRef.current = null;
      }
      console.log('🎯 Ruler points cleared');
    };

    window.addEventListener('activateFaceSelection', handleActivateFaceSelection as EventListener);
    window.addEventListener('createSurfaceHighlight', handleCreateSurfaceHighlight as EventListener);
    window.addEventListener('updateSurfaceHighlight', handleUpdateSurfaceHighlight as EventListener);
    window.addEventListener('removeSurfaceHighlight', handleRemoveSurfaceHighlight as EventListener);
    window.addEventListener('clearAllSurfaceHighlights', handleClearAllSurfaceHighlights as EventListener);
    window.addEventListener('activateRulerMode', handleActivateRulerMode);
    window.addEventListener('clearRulerPoints', handleClearRulerPoints);

    return () => {
      window.removeEventListener('activateFaceSelection', handleActivateFaceSelection as EventListener);
      window.removeEventListener('createSurfaceHighlight', handleCreateSurfaceHighlight as EventListener);
      window.removeEventListener('updateSurfaceHighlight', handleUpdateSurfaceHighlight as EventListener);
      window.removeEventListener('removeSurfaceHighlight', handleRemoveSurfaceHighlight as EventListener);
      window.removeEventListener('clearAllSurfaceHighlights', handleClearAllSurfaceHighlights as EventListener);
      window.removeEventListener('activateRulerMode', handleActivateRulerMode);
      window.removeEventListener('clearRulerPoints', handleClearRulerPoints);
    };
  }, [scene, camera, gl.domElement, shape]);

  useEffect(() => {
    if (highlightedEdgesRef.current) {
      scene.remove(highlightedEdgesRef.current);
      highlightedEdgesRef.current.geometry.dispose();
      (highlightedEdgesRef.current.material as THREE.Material).dispose();
      highlightedEdgesRef.current = null;
    }

    if (hoveredEdgeIndex !== null && meshRef.current) {
      const edges = new THREE.EdgesGeometry(shapeGeometry);
      const edgePositions = edges.getAttribute('position');

      const startIdx = hoveredEdgeIndex * 2;
      const endIdx = startIdx + 1;

      if (startIdx < edgePositions.count && endIdx < edgePositions.count) {
        const start = new THREE.Vector3(
          edgePositions.getX(startIdx),
          edgePositions.getY(startIdx),
          edgePositions.getZ(startIdx)
        );
        const end = new THREE.Vector3(
          edgePositions.getX(endIdx),
          edgePositions.getY(endIdx),
          edgePositions.getZ(endIdx)
        );

        const highlightGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const highlightMaterial = new THREE.LineBasicMaterial({
          color: 0xff0000,
          linewidth: 3,
          depthTest: false
        });

        const highlightLine = new THREE.LineSegments(highlightGeometry, highlightMaterial);
        highlightLine.position.copy(meshRef.current.position);
        highlightLine.rotation.copy(meshRef.current.rotation);
        highlightLine.scale.copy(meshRef.current.scale);
        highlightLine.renderOrder = 1001;

        scene.add(highlightLine);
        highlightedEdgesRef.current = highlightLine;
      }
    }

    return () => {
      if (highlightedEdgesRef.current) {
        scene.remove(highlightedEdgesRef.current);
        highlightedEdgesRef.current.geometry.dispose();
        (highlightedEdgesRef.current.material as THREE.Material).dispose();
        highlightedEdgesRef.current = null;
      }
    };
  }, [hoveredEdgeIndex, scene, shapeGeometry, shape.position, shape.rotation, shape.scale]);

  const createDimensionLine = (point1: THREE.Vector3, point2: THREE.Vector3, distance: number) => {
    if (dimensionLineRef.current) {
      scene.remove(dimensionLineRef.current);
      dimensionLineRef.current.traverse((child) => {
        if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
          child.geometry.dispose();
          if (child.material) {
            if (Array.isArray(child.material)) {
              child.material.forEach(mat => mat.dispose());
            } else {
              child.material.dispose();
            }
          }
        }
      });
      dimensionLineRef.current = null;
    }

    const group = new THREE.Group();

    const direction = new THREE.Vector3().subVectors(point2, point1).normalize();
    const offset = new THREE.Vector3().crossVectors(direction, camera.position.clone().sub(point1).normalize()).normalize().multiplyScalar(0.3);

    const offsetPoint1 = point1.clone().add(offset);
    const offsetPoint2 = point2.clone().add(offset);

    const mainLineGeometry = new THREE.BufferGeometry().setFromPoints([offsetPoint1, offsetPoint2]);
    const mainLineMaterial = new THREE.LineBasicMaterial({ color: 0x000000, linewidth: 2, depthTest: false });
    const mainLine = new THREE.Line(mainLineGeometry, mainLineMaterial);
    mainLine.renderOrder = 1003;
    group.add(mainLine);

    const arrowLength = 0.15;
    const arrowGeometry = new THREE.ConeGeometry(0.03, arrowLength, 8);

    const arrow1 = new THREE.Mesh(arrowGeometry, new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false }));
    arrow1.position.copy(offsetPoint1);
    arrow1.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().negate());
    arrow1.renderOrder = 1003;
    group.add(arrow1);

    const arrow2 = new THREE.Mesh(arrowGeometry, new THREE.MeshBasicMaterial({ color: 0x000000, depthTest: false }));
    arrow2.position.copy(offsetPoint2);
    arrow2.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction);
    arrow2.renderOrder = 1003;
    group.add(arrow2);

    const midPoint = new THREE.Vector3().addVectors(offsetPoint1, offsetPoint2).multiplyScalar(0.5);

    const canvas = document.createElement('canvas');
    const context = canvas.getContext('2d');
    canvas.width = 256;
    canvas.height = 64;

    if (context) {
      context.fillStyle = 'white';
      context.fillRect(0, 0, canvas.width, canvas.height);
      context.font = 'bold 32px Arial';
      context.fillStyle = 'black';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText(`${distance.toFixed(1)} cm`, canvas.width / 2, canvas.height / 2);
    }

    const texture = new THREE.CanvasTexture(canvas);
    const spriteMaterial = new THREE.SpriteMaterial({ map: texture, depthTest: false });
    const sprite = new THREE.Sprite(spriteMaterial);
    sprite.position.copy(midPoint);
    sprite.scale.set(0.5, 0.125, 1);
    sprite.renderOrder = 1004;
    group.add(sprite);

    scene.add(group);
    dimensionLineRef.current = group;

    setTimeout(() => {
      if (dimensionLineRef.current) {
        scene.remove(dimensionLineRef.current);
        dimensionLineRef.current.traverse((child) => {
          if (child instanceof THREE.Mesh || child instanceof THREE.Line) {
            child.geometry.dispose();
            if (child.material) {
              if (Array.isArray(child.material)) {
                child.material.forEach(mat => mat.dispose());
              } else {
                child.material.dispose();
              }
            }
          }
        });
        dimensionLineRef.current = null;
      }
    }, 3000);
  };

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
    if (isRulerMode && e.nativeEvent.button === 0 && meshRef.current && hoveredEdgeIndex !== null) {
      e.stopPropagation();

      const edges = new THREE.EdgesGeometry(shapeGeometry);
      const edgePositions = edges.getAttribute('position');

      const startIdx = hoveredEdgeIndex * 2;
      const endIdx = startIdx + 1;

      if (startIdx < edgePositions.count && endIdx < edgePositions.count) {
        const start = new THREE.Vector3(
          edgePositions.getX(startIdx),
          edgePositions.getY(startIdx),
          edgePositions.getZ(startIdx)
        );
        const end = new THREE.Vector3(
          edgePositions.getX(endIdx),
          edgePositions.getY(endIdx),
          edgePositions.getZ(endIdx)
        );

        start.applyMatrix4(meshRef.current.matrixWorld);
        end.applyMatrix4(meshRef.current.matrixWorld);

        const midPoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

        selectedPointsRef.current.push(midPoint);
        setSelectedEdges(prev => [...prev, hoveredEdgeIndex]);

        const selectedGeometry = new THREE.BufferGeometry().setFromPoints([start, end]);
        const color = selectedEdges.length === 0 ? 0x3b82f6 : 0x10b981;
        const selectedMaterial = new THREE.LineBasicMaterial({
          color: color,
          linewidth: 4,
          depthTest: false
        });

        const selectedLine = new THREE.LineSegments(selectedGeometry, selectedMaterial);
        selectedLine.renderOrder = 1002;
        scene.add(selectedLine);
        selectedEdgesRef.current.push(selectedLine);

        const edgeSelectedEvent = new CustomEvent('edgePointSelected', {
          detail: {
            point: midPoint,
            shapeId: shape.id
          }
        });
        window.dispatchEvent(edgeSelectedEvent);

        console.log(`🎯 Edge selected (${selectedEdges.length + 1}/2):`, midPoint);

        if (selectedEdges.length === 1 && selectedPointsRef.current.length === 2) {
          const distance = selectedPointsRef.current[0].distanceTo(selectedPointsRef.current[1]);
          createDimensionLine(selectedPointsRef.current[0], selectedPointsRef.current[1], distance);
        }

        if (selectedEdges.length === 1) {
          setIsRulerMode(false);
          setSelectedEdges([]);
          setHoveredEdgeIndex(null);

          if (highlightedEdgesRef.current) {
            scene.remove(highlightedEdgesRef.current);
            highlightedEdgesRef.current.geometry.dispose();
            (highlightedEdgesRef.current.material as THREE.Material).dispose();
            highlightedEdgesRef.current = null;
          }

          setTimeout(() => {
            selectedEdgesRef.current.forEach(line => {
              scene.remove(line);
              line.geometry.dispose();
              (line.material as THREE.Material).dispose();
            });
            selectedEdgesRef.current = [];
            selectedPointsRef.current = [];
          }, 500);
        }
      }

      return;
    }

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

    if (e.nativeEvent.button === 0) {
      e.stopPropagation();
      useAppStore.getState().selectShape(shape.id);
      console.log(`Shape clicked: ${shape.type} (ID: ${shape.id})`);
    }
  };

  const handlePointerMove = (e: any) => {
    if (!isRulerMode || !meshRef.current) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouseX = ((e.nativeEvent.clientX - rect.left) / rect.width) * 2 - 1;
    const mouseY = -((e.nativeEvent.clientY - rect.top) / rect.height) * 2 + 1;
    const mousePosition = new THREE.Vector2(mouseX, mouseY);

    const worldMatrix = meshRef.current.matrixWorld;
    const edgePoint = findClosestEdgePoint(
      mousePosition,
      camera,
      shapeGeometry,
      worldMatrix,
      0.08
    );

    if (edgePoint) {
      setHoveredEdgeIndex(edgePoint.edgeIndex);
      gl.domElement.style.cursor = 'crosshair';
    } else {
      setHoveredEdgeIndex(null);
      gl.domElement.style.cursor = 'default';
    }
  };

  const handleContextMenu = (e: any) => {
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
        onPointerMove={handlePointerMove}
        onContextMenu={handleContextMenu}
        castShadow
        receiveShadow
        visible={true}
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
    </group>
  );
};

export default React.memo(YagoDesignShape);