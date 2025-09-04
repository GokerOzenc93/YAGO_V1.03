import React from 'react';
import { useAppStore, Tool, CameraType, ViewMode, MeasurementUnit } from './store/appStore';
import { MousePointer, Square, Circle, Ruler, Move, RotateCw, Copy, Trash2 } from 'lucide-react';

export default function StatusDisplay() {
  const {
    tool,
    cameraType,
    viewMode,
    measurementUnit,
    shapes,
    selectedShapeId,
    gridSize,
    snapToGrid,
    mousePosition,
  } = useAppStore();

  const getToolIcon = (currentTool: Tool) => {
    switch (currentTool) {
      case Tool.SELECT: return MousePointer;
      case Tool.RECTANGLE: return Square;
      case Tool.CIRCLE: return Circle;
      case Tool.LINE: return Ruler;
      case Tool.MOVE: return Move;
      case Tool.ROTATE: return RotateCw;
      case Tool.COPY: return Copy;
      case Tool.DELETE: return Trash2;
      case Tool.DIMENSION: return Ruler;
      default: return MousePointer;
    }
  };

  const getToolName = (currentTool: Tool) => {
    switch (currentTool) {
      case Tool.SELECT: return 'Select';
      case Tool.RECTANGLE: return 'Rectangle';
      case Tool.CIRCLE: return 'Circle';
      case Tool.LINE: return 'Line';
      case Tool.MOVE: return 'Move';
      case Tool.ROTATE: return 'Rotate';
      case Tool.COPY: return 'Copy';
      case Tool.DELETE: return 'Delete';
      case Tool.DIMENSION: return 'Dimension';
      default: return 'Unknown';
    }
  };

  const ToolIcon = getToolIcon(tool);
  const selectedShape = shapes.find(s => s.id === selectedShapeId);

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-4 py-2">
      <div className="flex items-center justify-between text-sm text-gray-300">
        {/* Left side - Tool and selection info */}
        <div className="flex items-center space-x-6">
          <div className="flex items-center space-x-2">
            <ToolIcon className="w-4 h-4" />
            <span>Tool: {getToolName(tool)}</span>
          </div>
          
          {selectedShape && (
            <div className="flex items-center space-x-2">
              <span>Selected: {selectedShape.type}</span>
              <span className="text-gray-500">({selectedShape.id.slice(0, 8)})</span>
            </div>
          )}
          
          <div>
            Shapes: {shapes.length}
          </div>
        </div>

        {/* Center - Mouse position */}
        <div className="flex items-center space-x-4">
          {mousePosition && (
            <div>
              X: {mousePosition.x.toFixed(2)}, Y: {mousePosition.y.toFixed(2)}
            </div>
          )}
        </div>

        {/* Right side - View and settings info */}
        <div className="flex items-center space-x-6">
          <div>
            View: {viewMode}
          </div>
          
          <div>
            Camera: {cameraType === CameraType.PERSPECTIVE ? 'Perspective' : 'Orthographic'}
          </div>
          
          <div>
            Grid: {gridSize}{measurementUnit}
          </div>
          
          <div className="flex items-center space-x-2">
            <div className={`w-2 h-2 rounded-full ${snapToGrid ? 'bg-green-500' : 'bg-gray-500'}`} />
            <span>Snap</span>
          </div>
          
          <div>
            Units: {measurementUnit}
          </div>
        </div>
      </div>
    </div>
  );
}