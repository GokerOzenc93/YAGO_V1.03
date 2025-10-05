import * as THREE from 'three';
import { CompletedShape, DrawingState } from './types';
import { Tool } from '../../store/appStore';
import { createRectanglePoints, createCirclePoints, calculateDimensions, snapToGrid } from './utils';
import { convertTo3DShape, extrudeShape } from './shapeConverter';
import { Shape } from '../../types/shapes';

interface EventHandlerProps {
  activeTool: Tool;
  gridSize: number;
  drawingState: DrawingState;
  setDrawingState: (state: Partial<DrawingState>) => void;
  completedShapes: CompletedShape[];
  setCompletedShapes: React.Dispatch<React.SetStateAction<CompletedShape[]>>;
  addShape: (shape: Shape) => void;
  selectShape: (id: string) => void;
  setActiveTool: (tool: Tool) => void;
  editingPolylineId: string | null;
  setEditingPolylineId: (id: string | null) => void;
  setDraggedNodeIndex: React.Dispatch<React.SetStateAction<number | null>>;
  setIsDragging: React.Dispatch<React.SetStateAction<boolean>>;
  updatePolylinePoint: (shapeId: string, pointIndex: number, newPosition: THREE.Vector3) => void;
  getIntersectionPoint: (event: PointerEvent) => THREE.Vector3 | null;
}

export const createPointerDownHandler = (props: EventHandlerProps) => {
  return (event: THREE.Event<PointerEvent>) => {
    const {
      activeTool,
      gridSize,
      drawingState,
      setDrawingState,
      completedShapes,
      setCompletedShapes,
      addShape,
      selectShape,
      setActiveTool,
      editingPolylineId,
      setEditingPolylineId,
      setDraggedNodeIndex,
      setIsDragging,
      getIntersectionPoint
    } = props;

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

    if (![Tool.POLYLINE, Tool.RECTANGLE, Tool.CIRCLE].includes(activeTool)) return;
    if (event.nativeEvent.button !== 0) return;
    
    event.stopPropagation();

    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;

    console.log(`Drawing ${activeTool.toLowerCase()}: Point clicked at [${point.x.toFixed(1)}, ${point.z.toFixed(1)}]`);

    if (activeTool === Tool.POLYLINE) {
      if (!drawingState.isDrawing) {
        setDrawingState({
          isDrawing: true,
          points: [point],
          currentPoint: point,
          previewPoint: point,
          waitingForMeasurement: false,
          measurementApplied: false
        });
        console.log('Started drawing polyline');
      } else {
        const firstPoint = drawingState.points[0];
        const isClosing = firstPoint && point.distanceTo(firstPoint) < gridSize;
        
        if (isClosing && drawingState.points.length >= 3) {
          const shapeId = Math.random().toString(36).substr(2, 9);
          const allPoints = [...drawingState.points, firstPoint];
          const newShape: CompletedShape = {
            id: shapeId,
            type: 'polyline',
            points: allPoints,
            dimensions: {},
            isClosed: true
          };
          
          setCompletedShapes(prev => [...prev, newShape]);
          console.log(`Polyline closed with ${allPoints.length} points`);
          
          setTimeout(() => convertTo3DShape(newShape, addShape, selectShape, gridSize), 100);
          finishDrawing();
        } else {
          setDrawingState({
            points: [...drawingState.points, point],
            currentPoint: point,
            waitingForMeasurement: false,
            measurementApplied: false
          });
          console.log(`Polyline point added: ${drawingState.points.length + 1} points total`);
        }
      }
    } else {
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
            const dimensions = calculateDimensions({ type: 'rectangle', points: rectPoints, id: shapeId, dimensions: {}, isClosed: true });
            newShape = {
              id: shapeId,
              type: 'rectangle',
              points: rectPoints,
              dimensions,
              isClosed: true
            };
            console.log(`Rectangle completed: ${dimensions.width?.toFixed(1)}x${dimensions.height?.toFixed(1)}mm`);
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
        
        setTimeout(() => convertTo3DShape(newShape, addShape, selectShape, gridSize), 100);
        finishDrawing();
      }
    }

    function finishDrawing() {
      setDrawingState({
        points: [],
        currentPoint: null,
        previewPoint: null,
        isDrawing: false,
        currentDirection: null,
        waitingForMeasurement: false,
        measurementApplied: false,
        snapPoint: null
      });
      setActiveTool(Tool.SELECT);
      console.log('Drawing completed, switched to Select tool');
    }
  };
};

export const createPointerMoveHandler = (props: EventHandlerProps) => {
  return (event: THREE.Event<PointerEvent>) => {
    const {
      activeTool,
      drawingState,
      setDrawingState,
      editingPolylineId,
      draggedNodeIndex,
      isDragging,
      updatePolylinePoint,
      getIntersectionPoint
    } = props;

    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;

    // Handle polyline editing mode
    if (activeTool === Tool.POLYLINE_EDIT && isDragging && draggedNodeIndex !== null && editingPolylineId) {
      updatePolylinePoint(editingPolylineId, draggedNodeIndex, point);
      return;
    }

    if (!drawingState.isDrawing || ![Tool.POLYLINE, Tool.RECTANGLE, Tool.CIRCLE].includes(activeTool)) return;

    setDrawingState({ previewPoint: point });
    
    if (activeTool === Tool.POLYLINE && drawingState.currentPoint) {
      const direction = point.clone().sub(drawingState.currentPoint).normalize();
      setDrawingState({ currentDirection: direction });
      
      if (!drawingState.waitingForMeasurement && !drawingState.measurementApplied && direction.length() > 0) {
        setDrawingState({ waitingForMeasurement: true });
        console.log('Ready for measurement input - move mouse to set direction, then type distance in terminal');
      }
    }
  };
};

export const createPointerUpHandler = (props: EventHandlerProps) => {
  return () => {
    const { activeTool, setIsDragging, setDraggedNodeIndex } = props;
    
    if (activeTool === Tool.POLYLINE_EDIT) {
      setIsDragging(false);
      setDraggedNodeIndex(null);
      console.log('Finished dragging polyline node');
    }
  };
};