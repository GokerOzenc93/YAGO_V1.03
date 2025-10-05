import React from 'react';
import {
  Box,
  Circle,
  Minus,
  MousePointer2,
  Move,
  RotateCw,
  Grid3x3,
  Maximize2,
  Spline,
  Type,
  Image as ImageIcon,
  Save,
  FolderOpen,
  Undo,
  Redo,
  Camera,
  Settings
} from 'lucide-react';
import { Tool, useAppStore } from '../core/appStore';

const Toolbar: React.FC = () => {
  const { activeTool, setActiveTool, gridSize, setGridSize, cameraType, setCameraType } = useAppStore();

  const tools = [
    { id: Tool.SELECT, icon: MousePointer2, label: 'Select' },
    { id: Tool.MOVE, icon: Move, label: 'Move' },
    { id: Tool.ROTATE, icon: RotateCw, label: 'Rotate' },
    { id: Tool.POLYLINE, icon: Spline, label: 'Polyline' },
    { id: Tool.BOX, icon: Box, label: 'Box' },
    { id: Tool.CYLINDER, icon: Circle, label: 'Cylinder' },
    { id: Tool.TEXT, icon: Type, label: 'Text' },
  ];

  return (
    <div className="bg-gray-800 border-b border-gray-700 px-4 py-2">
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-gray-700 rounded">
            <FolderOpen size={20} />
          </button>
          <button className="p-2 hover:bg-gray-700 rounded">
            <Save size={20} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        <div className="flex items-center gap-1">
          <button className="p-2 hover:bg-gray-700 rounded">
            <Undo size={20} />
          </button>
          <button className="p-2 hover:bg-gray-700 rounded">
            <Redo size={20} />
          </button>
        </div>

        <div className="w-px h-6 bg-gray-700" />

        <div className="flex items-center gap-1">
          {tools.map((tool) => {
            const Icon = tool.icon;
            return (
              <button
                key={tool.id}
                onClick={() => setActiveTool(tool.id)}
                className={`p-2 rounded transition-colors ${
                  activeTool === tool.id
                    ? 'bg-blue-600 text-white'
                    : 'hover:bg-gray-700'
                }`}
                title={tool.label}
              >
                <Icon size={20} />
              </button>
            );
          })}
        </div>

        <div className="w-px h-6 bg-gray-700" />

        <div className="flex items-center gap-2">
          <button className="p-2 hover:bg-gray-700 rounded">
            <Camera size={20} />
          </button>
          <button className="p-2 hover:bg-gray-700 rounded">
            <Settings size={20} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
