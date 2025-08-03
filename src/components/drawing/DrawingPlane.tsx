import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import { useAppStore, Tool, CameraType, SnapType } from '../../store/appStore';
import * as THREE from 'three';

// Import modular components
import { CompletedShape, DrawingState, INITIAL_DRAWING_STATE } from './types';
import { snapToGrid } from './utils';
import { findSnapPoints } from './snapSystem';
import { convertTo3DShape, extrudeShape } from './shapeConverter';
import { createRectanglePoints, createCirclePoints } from './utils';

interface DrawingPlaneProps {
  onShowMeasurement?: (data: any) => void;
  onHideMeasurement?: () => void;
}

const DrawingPlane: React.FC<DrawingPlaneProps> = ({ onShowMeasurement, onHideMeasurement }) => {
  const { 
    activeTool, 
    gridSize, 
    measurementUnit, 
    convertToDisplayUnit, 
    convertToBaseUnit, 
    addShape, 
    setActiveTool, 
    selectShape, 
    cameraType, 
    setCameraType,
    snapSettings,
    snapTolerance,
    shapes,
    editingPolylineId,
    setEditingPolylineId
  } = useAppStore();
  
  // Drawing state
  const [drawingState, setDrawingState] = useState<DrawingState>(INITIAL_DRAWING_STATE);
  const [completedShapes, setCompletedShapes] = useState<CompletedShape[]>([]);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [draggedNodeIndex, setDraggedNodeIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previousCameraType, setPreviousCameraType] = useState<CameraType | null>(null);
  const [showExtrudeInput, setShowExtrudeInput] = useState(false);
  const [extrudeHeight, setExtrudeHeight] = useState('');
  const [pendingShape, setPendingShape] = useState<CompletedShape | null>(null);
  
  const planeRef = useRef<THREE.Mesh>(null);
  const { camera, raycaster, gl } = useThree();

  // Helper function to update drawing state
  const updateDrawingState = (updates: Partial<DrawingState>) => {
    setDrawingState(prev => ({ ...prev, ...updates }));
  };

  // Auto-switch to top view and orthographic camera when starting drawing tools
  useEffect(() => {
    const drawingTools = [Tool.POLYLINE, Tool.POLYGON, Tool.RECTANGLE, Tool.CIRCLE];
    
    if (drawingTools.includes(activeTool) && !drawingState.isDrawing) {
      if (previousCameraType === null) {
        setPreviousCameraType(cameraType);
      }
      
      if (cameraType !== CameraType.ORTHOGRAPHIC) {
        setCameraType(CameraType.ORTHOGRAPHIC);
        console.log(`Switched to Orthographic camera for ${activeTool} drawing`);
      }
      
      // IMMEDIATE top view switch for all drawing tools
      setTimeout(() => {
        const event = new KeyboardEvent('keydown', { key: 't' });
        window.dispatchEvent(event);
        console.log(`Auto-switched to TOP VIEW for ${activeTool} drawing`);
      }, 50);
    }
    
    if (![Tool.POLYLINE, Tool.POLYGON, Tool.RECTANGLE, Tool.CIRCLE, Tool.POLYLINE_EDIT].includes(activeTool) && previousCameraType !== null) {
      setCameraType(previousCameraType);
      setPreviousCameraType(null);
      console.log(`Restored camera type to: ${previousCameraType}`);
    }
  }, [activeTool, drawingState.isDrawing, cameraType, setCameraType, previousCameraType]);

  // Reset drawing state when tool changes
  useEffect(() => {
    if (![Tool.POLYLINE, Tool.POLYGON, Tool.RECTANGLE, Tool.CIRCLE, Tool.POLYLINE_EDIT].includes(activeTool)) {
      setDrawingState(INITIAL_DRAWING_STATE);
      
      if (activeTool !== Tool.POLYLINE_EDIT) {
        setEditingPolylineId(null);
        setDraggedNodeIndex(null);
        setIsDragging(false);
      }
    }
  }, [activeTool, setEditingPolylineId]);

  const getIntersectionPoint = (event: PointerEvent): THREE.Vector3 | null => {
    if (!planeRef.current) return null;

    const rect = gl.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera({ x, y }, camera);
    const intersects = raycaster.intersectObject(planeRef.current);

    if (intersects.length > 0) {
      let point = intersects[0].point;
      
      const snapPoints = findSnapPoints(
        point, 
        completedShapes, 
        shapes, 
        snapSettings, 
        snapTolerance,
        drawingState.currentPoint,
        drawingState.currentDirection
      );
      
      if (snapPoints.length > 0) {
        const closestSnap = snapPoints[0];
        updateDrawingState({ snapPoint: closestSnap });
        point = closestSnap.point;
        console.log(`Snapped to ${closestSnap.type} at [${point.x.toFixed(1)}, ${point.z.toFixed(1)}]`);
      } else {
        updateDrawingState({ snapPoint: null });
        point = new THREE.Vector3(
          snapToGrid(point.x, gridSize),
          0,
          snapToGrid(point.z, gridSize)
        );
      }
      
      return point;
    }

    return null;
  };

  const updatePolylinePoint = (shapeId: string, pointIndex: number, newPosition: THREE.Vector3) => {
    setCompletedShapes(prev => prev.map(shape => {
      if (shape.id === shapeId && shape.type === 'polyline') {
        const newPoints = [...shape.points];
        newPoints[pointIndex] = newPosition;
        
        if (shape.isClosed && pointIndex === 0) {
          newPoints[newPoints.length - 1] = newPosition;
        } else if (shape.isClosed && pointIndex === newPoints.length - 1) {
          newPoints[0] = newPosition;
        }
        
        return { ...shape, points: newPoints };
      }
      return shape;
    }));
  };

  // Handle measurement input from terminal
  const handleMeasurementInput = (distance: number) => {
    if (!drawingState.currentPoint || !drawingState.currentDirection || !drawingState.isDrawing || ![Tool.POLYLINE, Tool.POLYGON].includes(activeTool)) {
      console.log('Cannot apply measurement: missing context');
      return;
    }

    const newPoint = drawingState.currentPoint.clone().add(drawingState.currentDirection.clone().multiplyScalar(distance));
    
    newPoint.x = snapToGrid(newPoint.x, gridSize);
    newPoint.z = snapToGrid(newPoint.z, gridSize);

    updateDrawingState({
      points: [...drawingState.points, newPoint],
      currentPoint: newPoint,
      waitingForMeasurement: false,
      measurementApplied: true
    });
    
    console.log(`${activeTool} segment added: ${distance.toFixed(1)}mm`);
  };

  // Expose measurement input handler globally
  useEffect(() => {
    (window as any).handlePolylineMeasurement = handleMeasurementInput;
    
    // Expose extrude height handler globally
    (window as any).handleExtrudeHeight = (height: number) => {
      setExtrudeHeight(height.toString());
      handleExtrudeSubmit();
    };
    
    return () => {
      delete (window as any).handlePolylineMeasurement;
      delete (window as any).handleExtrudeHeight;
    };
  }, [drawingState.currentPoint, drawingState.currentDirection, drawingState.isDrawing, activeTool, extrudeHeight, pendingShape]);

  // Auto-focus terminal input when extrude dialog shows
  useEffect(() => {
    if (pendingShape) {
      // Focus terminal input after a short delay
      setTimeout(() => {
        const terminalInput = document.querySelector('input[placeholder*="extrude height"]') as HTMLInputElement;
        if (terminalInput) {
          terminalInput.focus();
          terminalInput.select();
          console.log('Terminal input auto-focused for extrude height');
        }
      }, 100);
    }
  }, [pendingShape]);

  // Handle keyboard input for extrude height
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (pendingShape) {
        if (event.key === 'Enter' && extrudeHeight) {
          handleExtrudeSubmit();
        } else if (event.key === 'Escape') {
          handleExtrudeCancel();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);

  // UNIFIED: Convert to 3D and cleanup function
  const convertAndCleanup = (shape: CompletedShape) => {
    // Show extrude input dialog instead of immediate conversion
    setPendingShape(shape);
    console.log(`${shape.type} completed, waiting for extrude height in terminal`);
  };

  // UNIFIED: Finish drawing function
  const finishDrawing = () => {
    setDrawingState(INITIAL_DRAWING_STATE);
    setActiveTool(Tool.SELECT);
    console.log('Drawing completed, switched to Select tool');
  };

  // UNIFIED: Handle polyline/polygon drawing
  const handlePolylinePolygonDrawing = (point: THREE.Vector3) => {
    if (!drawingState.isDrawing) {
      setDrawingState({
        isDrawing: true,
        points: [point],
        currentPoint: point,
        previewPoint: point,
        waitingForMeasurement: false,
        measurementApplied: false
      });
      console.log(`Started drawing ${activeTool.toLowerCase()}`);
    } else {
      const firstPoint = drawingState.points[0];
      const isClosing = firstPoint && point.distanceTo(firstPoint) < gridSize;
      
      if (isClosing && drawingState.points.length >= 3) {
        const shapeId = Math.random().toString(36).substr(2, 9);
        const allPoints = [...drawingState.points, firstPoint];
        const newShape: CompletedShape = {
          id: shapeId,
          type: activeTool === Tool.POLYGON ? 'polygon' : 'polyline',
          points: allPoints,
          dimensions: {},
          isClosed: true
        };
        
        setCompletedShapes(prev => [...prev, newShape]);
        console.log(`${activeTool} closed with ${allPoints.length} points`);
        
        convertAndCleanup(newShape);
        finishDrawing();
      } else {
        setDrawingState(prev => ({
          ...prev,
          points: [...prev.points, point],
          currentPoint: point,
          waitingForMeasurement: false,
          measurementApplied: false
        }));
        console.log(`${activeTool} point added: ${drawingState.points.length + 1} points total`);
      }
    }
  };

  // UNIFIED: Handle rectangle/circle drawing
  const handleShapeDrawing = (point: THREE.Vector3) => {
    if (!drawingState.isDrawing) {
      setDrawingState({
        isDrawing: true,
        points: [point],
        currentPoint: point,
        previewPoint: point
      });
      console.log(`Started drawing ${activeTool.toLowerCase()}`);
    } else {
      const shapeId = Math.random().toString(36).substr(2, 9);
      let newShape: CompletedShape;

      switch (activeTool) {
        case Tool.RECTANGLE: {
          const rectPoints = createRectanglePoints(drawingState.points[0], point);
          const width = Math.abs(point.x - drawingState.points[0].x);
          const height = Math.abs(point.z - drawingState.points[0].z);
          newShape = {
            id: shapeId,
            type: 'rectangle',
            points: rectPoints,
            dimensions: { width, height },
            isClosed: true
          };
          console.log(`Rectangle completed: ${width.toFixed(1)}x${height.toFixed(1)}mm`);
          break;
        }
        case Tool.CIRCLE: {
          const radius = drawingState.points[0].distanceTo(point);
          const circlePoints = createCirclePoints(drawingState.points[0], radius);
          newShape = {
            id: shapeId,
            type: 'circle',
            points: circlePoints,
            dimensions: { radius },
            isClosed: true
          };
          console.log(`Circle completed: radius ${radius.toFixed(1)}mm`);
          break;
        }
        default:
          return;
      }

      setCompletedShapes(prev => [...prev, newShape]);
      console.log(`Shape completed with ID: ${shapeId}`);
      
      convertAndCleanup(newShape);
      finishDrawing();
    }
  };

  const handlePointerDown = (event: THREE.Event<PointerEvent>) => {
    // Handle polyline editing mode
    if (activeTool === Tool.POLYLINE_EDIT) {
      if (event.nativeEvent.button !== 0) return;
      
      const point = getIntersectionPoint(event.nativeEvent);
      if (!point) return;

      let foundNode = false;
      completedShapes.forEach((shape) => {
        if (shape.type === 'polyline') {
          shape.points.forEach((shapePoint, pointIndex) => {
            const distance = point.distanceTo(shapePoint);
            if (distance < gridSize) {
              setEditingPolylineId(shape.id);
              setDraggedNodeIndex(pointIndex);
              setIsDragging(true);
              foundNode = true;
              console.log(`Started dragging node ${pointIndex} of polyline ${shape.id}`);
            }
          });
        }
      });

      if (!foundNode) {
        setEditingPolylineId(null);
        setActiveTool(Tool.SELECT);
        console.log('Exited polyline edit mode');
      }
      return;
    }

    if (![Tool.POLYLINE, Tool.POLYGON, Tool.RECTANGLE, Tool.CIRCLE].includes(activeTool)) return;
    if (event.nativeEvent.button !== 0) return;
    
    event.stopPropagation();

    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;

    console.log(`Drawing ${activeTool.toLowerCase()}: Point clicked at [${point.x.toFixed(1)}, ${point.z.toFixed(1)}]`);

    // Handle different drawing tools
    if (activeTool === Tool.POLYLINE || activeTool === Tool.POLYGON) {
      handlePolylinePolygonDrawing(point);
    } else {
      handleShapeDrawing(point);
    }
  };

  const handlePointerMove = (event: THREE.Event<PointerEvent>) => {
    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;

    // Handle polyline editing mode
    if (activeTool === Tool.POLYLINE_EDIT && isDragging && draggedNodeIndex !== null && editingPolylineId) {
      updatePolylinePoint(editingPolylineId, draggedNodeIndex, point);
      return;
    }

    if (!drawingState.isDrawing || ![Tool.POLYLINE, Tool.POLYGON, Tool.RECTANGLE, Tool.CIRCLE].includes(activeTool)) return;

    setDrawingState(prev => ({ ...prev, previewPoint: point }));
    
    // Handle direction and measurement for POLYLINE and POLYGON
    if ((activeTool === Tool.POLYLINE || activeTool === Tool.POLYGON) && drawingState.currentPoint) {
      const direction = point.clone().sub(drawingState.currentPoint).normalize();
      setDrawingState(prev => ({ ...prev, currentDirection: direction }));
      
      if (!drawingState.waitingForMeasurement && !drawingState.measurementApplied && direction.length() > 0) {
        setDrawingState(prev => ({ ...prev, waitingForMeasurement: true }));
        console.log('Ready for measurement input - move mouse to set direction, then type distance in terminal');
      }
    }
  };

  const handlePointerUp = () => {
    if (activeTool === Tool.POLYLINE_EDIT && isDragging) {
      setIsDragging(false);
      setDraggedNodeIndex(null);
      console.log('Finished dragging polyline node');
    }
  };

  // Create preview geometry
  const previewGeometry = useMemo(() => {
    if (!drawingState.isDrawing || !drawingState.currentPoint || !drawingState.previewPoint) return null;

    switch (activeTool) {
      case Tool.RECTANGLE: {
        const rectPoints = createRectanglePoints(drawingState.currentPoint, drawingState.previewPoint);
        return new THREE.BufferGeometry().setFromPoints(rectPoints);
      }
      case Tool.CIRCLE: {
        const radius = drawingState.currentPoint.distanceTo(drawingState.previewPoint);
        const circlePoints = createCirclePoints(drawingState.currentPoint, radius);
        return new THREE.BufferGeometry().setFromPoints(circlePoints);
      }
      case Tool.POLYLINE:
      case Tool.POLYGON: {
        const polylinePoints = [...drawingState.points, drawingState.previewPoint];
        return new THREE.BufferGeometry().setFromPoints(polylinePoints);
      }
      default:
        return null;
    }
  }, [activeTool, drawingState.isDrawing, drawingState.currentPoint, drawingState.previewPoint, drawingState.points]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawingState(INITIAL_DRAWING_STATE);
        setEditingPolylineId(null);
        setDraggedNodeIndex(null);
        setIsDragging(false);
        console.log('Drawing cancelled');
      }
      
      // Handle Enter key for POLYLINE and POLYGON
      if (event.key === 'Enter' && (activeTool === Tool.POLYLINE || activeTool === Tool.POLYGON) && drawingState.isDrawing && drawingState.points.length >= 2 && !drawingState.waitingForMeasurement) {
        const shapeId = Math.random().toString(36).substr(2, 9);
        const newShape: CompletedShape = {
          id: shapeId,
          type: activeTool === Tool.POLYGON ? 'polygon' : 'polyline',
          points: [...drawingState.points],
          dimensions: {},
          isClosed: false
        };
        
        setCompletedShapes(prev => [...prev, newShape]);
        console.log(`${activeTool} finished with Enter: ${drawingState.points.length} points`);
        
        convertAndCleanup(newShape);
        setDrawingState(INITIAL_DRAWING_STATE);
        setActiveTool(Tool.SELECT);
      }
      
      if (event.key === 'Enter' && activeTool === Tool.POLYLINE_EDIT) {
        setEditingPolylineId(null);
        setDraggedNodeIndex(null);
        setIsDragging(false);
        setActiveTool(Tool.SELECT);
        console.log('Exited polyline edit mode with Enter');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, drawingState.isDrawing, drawingState.points, setActiveTool, drawingState.waitingForMeasurement, addShape, selectShape, gridSize, setEditingPolylineId]);

  // Handle extrude height input
  const handleExtrudeSubmit = () => {
    if (!pendingShape || !extrudeHeight) return;
    
    const height = convertToBaseUnit(parseFloat(extrudeHeight));
    if (isNaN(height) || height <= 0) {
      console.log('Invalid extrude height');
      return;
    }
    
    // Create extruded 3D shape
    extrudeShape(pendingShape, addShape, height, gridSize);
    
    // Cleanup
    setCompletedShapes(prev => prev.filter(s => s.id !== pendingShape.id));
    setPendingShape(null);
    setExtrudeHeight('');
    setShowExtrudeInput(false);
    
    console.log(`${pendingShape.type} extruded with height: ${height}mm`);
  };
  
  const handleExtrudeCancel = () => {
    setPendingShape(null);
    setExtrudeHeight('');
    setShowExtrudeInput(false);
    console.log('Extrude cancelled');
  };

  return (
    <>
      <mesh
        ref={planeRef}
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[100000, 100000]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Completed Shapes - These will be automatically removed when converted to 3D */}
      {completedShapes.map(shape => (
        <group key={shape.id}>
          <line geometry={new THREE.BufferGeometry().setFromPoints(shape.points)}>
            <lineBasicMaterial 
              color={
                editingPolylineId === shape.id ? "#f59e0b" : 
                hoveredShapeId === shape.id ? "#60a5fa" : "#2563eb"
              } 
            />
          </line>
          
          {/* Polyline Edit Nodes */}
          {activeTool === Tool.POLYLINE_EDIT && (shape.type === 'polyline' || shape.type === 'polygon') && (
            <>
              {shape.points.map((point, index) => (
                <mesh 
                  key={index} 
                  position={point}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPolylineId(shape.id);
                    setActiveTool(Tool.POLYLINE_EDIT);
                  }}
                >
                  <sphereGeometry args={[gridSize / 8]} />
                  <meshBasicMaterial 
                    color={editingPolylineId === shape.id ? "#f59e0b" : "#2563eb"} 
                  />
                </mesh>
              ))}
              
              {hoveredShapeId === shape.id && (shape.type === 'polyline' || shape.type === 'polygon') && (
                <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
                  <mesh
                    position={[shape.points[0].x, 1, shape.points[0].z]}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPolylineId(shape.id);
                      setActiveTool(Tool.POLYLINE_EDIT);
                    }}
                  >
                    <planeGeometry args={[gridSize * 2, gridSize]} />
                    <meshBasicMaterial color="#f59e0b" />
                    <Text
                      position={[0, 0, 0.1]}
                      fontSize={gridSize / 2}
                      color="white"
                      anchorX="center"
                      anchorY="middle"
                    >
                      Edit
                    </Text>
                  </mesh>
                </Billboard>
              )}
            </>
          )}
          
          {/* Convert to 3D Button for Closed Shapes */}
          {shape.isClosed && hoveredShapeId === shape.id && activeTool !== Tool.POLYLINE_EDIT && (
            <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
              <mesh
                position={[shape.points[0].x, 1, shape.points[0].z]}
                onClick={(e) => {
                  e.stopPropagation();
                  convertTo3DShape(shape, addShape, selectShape, gridSize);
                  setCompletedShapes(prev => prev.filter(s => s.id !== shape.id));
                }}
              >
                <planeGeometry args={[gridSize * 3, gridSize]} />
                <meshBasicMaterial color="#10b981" />
                <Text
                  position={[0, 0, 0.1]}
                  fontSize={gridSize / 2}
                  color="white"
                  anchorX="center"
                  anchorY="middle"
                >
                  Select
                </Text>
              </mesh>
            </Billboard>
          )}
          
          {/* Extrude Button for Closed Shapes */}
          {shape.isClosed && hoveredShapeId === shape.id && activeTool !== Tool.POLYLINE_EDIT && (
            <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
              <mesh
                position={[shape.points[0].x + gridSize * 3.5, 1, shape.points[0].z]}
                onClick={(e) => {
                  e.stopPropagation();
                  extrudeShape(shape, addShape, 500, gridSize);
                  setCompletedShapes(prev => prev.filter(s => s.id !== shape.id));
                }}
              >
                <planeGeometry args={[gridSize * 2, gridSize]} />
                <meshBasicMaterial color="#2563eb" />
                <Text
                  position={[0, 0, 0.1]}
                  fontSize={gridSize / 2}
                  color="white"
                  anchorX="center"
                  anchorY="middle"
                >
                  Extrude
                </Text>
              </mesh>
            </Billboard>
          )}
        </group>
      ))}

      {/* Preview Shape */}
      {previewGeometry && (
        <line geometry={previewGeometry}>
          <lineBasicMaterial color="#2563eb" opacity={0.5} transparent />
        </line>
      )}

      {/* Points */}
      {drawingState.points.map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[gridSize / 15]} />
          <meshBasicMaterial color="#2563eb" />
        </mesh>
      ))}

      {drawingState.previewPoint && (
        <mesh position={drawingState.previewPoint}>
          <sphereGeometry args={[gridSize / 15]} />
          <meshBasicMaterial color="#2563eb" opacity={0.5} transparent />
        </mesh>
      )}

      {/* Snap Point Indicator */}
      {drawingState.snapPoint && (
        <group>
          <mesh position={drawingState.snapPoint.point}>
            <sphereGeometry args={[gridSize / 8]} />
            <meshBasicMaterial 
              color={
                drawingState.snapPoint.type === SnapType.ENDPOINT ? "#ff6b6b" :
                drawingState.snapPoint.type === SnapType.MIDPOINT ? "#4ecdc4" :
                drawingState.snapPoint.type === SnapType.CENTER ? "#45b7d1" :
                drawingState.snapPoint.type === SnapType.QUADRANT ? "#f9ca24" :
                drawingState.snapPoint.type === SnapType.PERPENDICULAR ? "#6c5ce7" :
                drawingState.snapPoint.type === SnapType.INTERSECTION ? "#fd79a8" :
                "#00b894"
              }
            />
          </mesh>
          <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
            <mesh position={[drawingState.snapPoint.point.x, drawingState.snapPoint.point.y + gridSize, drawingState.snapPoint.point.z]}>
              <planeGeometry args={[gridSize * 2, gridSize * 0.6]} />
              <meshBasicMaterial color="#000000" opacity={0.8} transparent />
              <Text
                position={[0, 0, 0.1]}
                fontSize={gridSize / 4}
                color="white"
                anchorX="center"
                anchorY="middle"
              >
                {drawingState.snapPoint.type.toUpperCase()}
              </Text>
            </mesh>
          </Billboard>
        </group>
      )}

      {/* Measurement waiting indicator */}
      {drawingState.waitingForMeasurement && drawingState.currentPoint && (
        <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
          <mesh position={[drawingState.currentPoint.x, gridSize * 2, drawingState.currentPoint.z]}>
            <planeGeometry args={[gridSize * 4, gridSize * 0.8]} />
            <meshBasicMaterial color="#f59e0b" opacity={0.9} transparent />
            <Text
              position={[0, 0, 0.1]}
              fontSize={gridSize / 3}
              color="white"
              anchorX="center"
              anchorY="middle"
            >
              Type distance in terminal
            </Text>
          </mesh>
        </Billboard>
      )}

      {/* Extrude Height Input Dialog */}
    </>
  );
};

export default DrawingPlane;