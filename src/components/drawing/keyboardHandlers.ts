import { Tool } from '../../store/appStore';
import { CompletedShape, DrawingState, INITIAL_DRAWING_STATE } from './types';
import { convertTo3DShape } from './shapeConverter';

interface KeyboardHandlersParams {
  activeTool: Tool;
  drawingState: DrawingState;
  pendingExtrudeShape: CompletedShape | null;
  hoveredShapeId: string | null;
  completedShapes: CompletedShape[];
  setDrawingState: (state: DrawingState) => void;
  setEditingPolylineId: (id: string | null) => void;
  setDraggedNodeIndex: (index: number | null) => void;
  setIsDragging: (isDragging: boolean) => void;
  resetPointToPointMove: () => void;
  setHoveredShapeId: (id: string | null) => void;
  setCompletedShapes: React.Dispatch<React.SetStateAction<CompletedShape[]>>;
  handleConvertTo2D: () => void;
  setActiveTool: (tool: Tool) => void;
  addShape: (shape: any) => void;
  selectShape: (id: string) => void;
  gridSize: number;
}

export const createKeyboardHandler = (params: KeyboardHandlersParams) => {
  return async (event: KeyboardEvent) => {
    const {
      activeTool,
      drawingState,
      pendingExtrudeShape,
      hoveredShapeId,
      completedShapes,
      setDrawingState,
      setEditingPolylineId,
      setDraggedNodeIndex,
      setIsDragging,
      resetPointToPointMove,
      setHoveredShapeId,
      setCompletedShapes,
      handleConvertTo2D,
      setActiveTool,
      addShape,
      selectShape,
      gridSize,
    } = params;

    if (event.key === 'Escape') {
      setDrawingState(INITIAL_DRAWING_STATE);
      setEditingPolylineId(null);
      setDraggedNodeIndex(null);
      setIsDragging(false);
      resetPointToPointMove();
      setHoveredShapeId(null);
      console.log('Drawing cancelled');
    }

    if (event.key === ' ' && hoveredShapeId && !drawingState.isDrawing && !pendingExtrudeShape) {
      event.preventDefault();
      const hoveredShape = completedShapes.find(s => s.id === hoveredShapeId);
      if (hoveredShape) {
        console.log(`✓ Space pressed - Converting hovered shape ${hoveredShapeId} to 3D`);
        await convertTo3DShape(hoveredShape, addShape, selectShape, gridSize);
        setCompletedShapes(prev => prev.filter(s => s.id !== hoveredShapeId));
        setHoveredShapeId(null);
      }
    }

    if (event.key === 'Enter' && (activeTool === Tool.POLYLINE || activeTool === Tool.POLYGON) && drawingState.isDrawing && drawingState.points.length >= 2 && !drawingState.waitingForMeasurement) {
    }

    if (event.key === 'Enter' && pendingExtrudeShape && !drawingState.isDrawing) {
      handleConvertTo2D();
    }

    if (event.key === 'Enter' && activeTool === Tool.POLYLINE_EDIT) {
      setEditingPolylineId(null);
      setDraggedNodeIndex(null);
      setIsDragging(false);
      setActiveTool(Tool.SELECT);
      console.log('Exited polyline edit mode with Enter');
    }
  };
};
