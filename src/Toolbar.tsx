import React from 'react';
import {
  Square,
  Circle,
  Triangle,
  Move,
  RotateCw,
  Copy,
  Trash2,
  MousePointer,
  Ruler,
  Grid3X3,
  Eye,
  Camera,
  Settings,
  Save,
  FolderOpen,
  Download,
} from 'lucide-react';
import { useAppStore, Tool, CameraType, ViewMode } from './store/appStore';

export default function Toolbar() {
  const {
    tool,
    cameraType,
    viewMode,
    showGrid,
    showGizmo,
    showStats,
    snapToGrid,
    setTool,
    setCameraType,
    setViewMode,
    toggleGrid,
    toggleGizmo,
    toggleStats,
    toggleSnapToGrid,
    clearAllShapes,
  } = useAppStore();

  const toolButtons = [
    { tool: Tool.SELECT, icon: MousePointer, label: 'Select' },
    { tool: Tool.RECTANGLE, icon: Square, label: 'Rectangle' },
    { tool: Tool.CIRCLE, icon: Circle, label: 'Circle' },
    { tool: Tool.LINE, icon: Ruler, label: 'Line' },
    { tool: Tool.MOVE, icon: Move, label: 'Move' },
    { tool: Tool.ROTATE, icon: RotateCw, label: 'Rotate' },
    { tool: Tool.COPY, icon: Copy, label: 'Copy' },
    { tool: Tool.DELETE, icon: Trash2, label: 'Delete' },
    { tool: Tool.DIMENSION, icon: Ruler, label: 'Dimension' },
  ];

  const viewModes = [
    { mode: ViewMode.PERSPECTIVE, label: '3D' },
    { mode: ViewMode.TOP, label: 'Top' },
    { mode: ViewMode.FRONT, label: 'Front' },
    { mode: ViewMode.RIGHT, label: 'Right' },
  ];

  return (
    <div className="bg-gray-800 border-b border-gray-700 p-2">
      <div className="flex items-center space-x-1">
        {/* File Operations */}
        <div className="flex items-center space-x-1 mr-4 border-r border-gray-600 pr-4">
          <button
            className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
            title="New"
          >
            <Square className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
            title="Open"
          >
            <FolderOpen className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
            title="Save"
          >
            <Save className="w-4 h-4" />
          </button>
          <button
            className="p-2 rounded hover:bg-gray-700 text-gray-300 hover:text-white transition-colors"
            title="Export"
          >
            <Download className="w-4 h-4" />
          </button>
        </div>

        {/* Drawing Tools */}
        <div className="flex items-center space-x-1 mr-4 border-r border-gray-600 pr-4">
          {toolButtons.map(({ tool: toolType, icon: Icon, label }) => (
            <button
              key={toolType}
              onClick={() => setTool(toolType)}
              className={`p-2 rounded transition-colors ${
                tool === toolType
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
              title={label}
            >
              <Icon className="w-4 h-4" />
            </button>
          ))}
        </div>

        {/* View Controls */}
        <div className="flex items-center space-x-1 mr-4 border-r border-gray-600 pr-4">
          {viewModes.map(({ mode, label }) => (
            <button
              key={mode}
              onClick={() => setViewMode(mode)}
              className={`px-3 py-1 rounded text-sm transition-colors ${
                viewMode === mode
                  ? 'bg-blue-600 text-white'
                  : 'text-gray-300 hover:bg-gray-700 hover:text-white'
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Camera Type */}
        <div className="flex items-center space-x-1 mr-4 border-r border-gray-600 pr-4">
          <button
            onClick={() => setCameraType(
              cameraType === CameraType.PERSPECTIVE 
                ? CameraType.ORTHOGRAPHIC 
                : CameraType.PERSPECTIVE
            )}
            className={`p-2 rounded transition-colors ${
              cameraType === CameraType.PERSPECTIVE
                ? 'bg-green-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            title={`Camera: ${cameraType === CameraType.PERSPECTIVE ? 'Perspective' : 'Orthographic'}`}
          >
            <Camera className="w-4 h-4" />
          </button>
        </div>

        {/* Display Options */}
        <div className="flex items-center space-x-1 mr-4 border-r border-gray-600 pr-4">
          <button
            onClick={toggleGrid}
            className={`p-2 rounded transition-colors ${
              showGrid
                ? 'bg-green-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            title="Toggle Grid"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
          <button
            onClick={toggleGizmo}
            className={`p-2 rounded transition-colors ${
              showGizmo
                ? 'bg-green-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            title="Toggle Gizmo"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={toggleStats}
            className={`p-2 rounded transition-colors ${
              showStats
                ? 'bg-green-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            title="Toggle Stats"
          >
            <Settings className="w-4 h-4" />
          </button>
          <button
            onClick={toggleSnapToGrid}
            className={`p-2 rounded transition-colors ${
              snapToGrid
                ? 'bg-green-600 text-white'
                : 'text-gray-300 hover:bg-gray-700 hover:text-white'
            }`}
            title="Snap to Grid"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>
        </div>

        {/* Clear All */}
        <div className="flex items-center space-x-1">
          <button
            onClick={clearAllShapes}
            className="p-2 rounded hover:bg-red-600 text-gray-300 hover:text-white transition-colors"
            title="Clear All"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
}