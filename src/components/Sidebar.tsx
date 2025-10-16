import React, { useState } from 'react';
import { Tool, useAppStore } from '../store/appStore';
import {
  Layers,
  Settings,
  Box,
  Ruler,
  PanelLeft,
  ChevronRight,
  ChevronLeft
} from 'lucide-react';

const Sidebar: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { activeTool, selectedShapeId, shapes } = useAppStore();
  const selectedShape = shapes.find(shape => shape.id === selectedShapeId);

  const renderToolProperties = () => {
    switch (activeTool) {
      case Tool.BOX:
        return (
          <div className="space-y-3">
            <h3 className="font-medium text-lg">Box Properties</h3>
            <div>
              <label className="block text-sm text-gray-400">Width</label>
              <input
                type="number"
                className="w-full px-2 py-1 bg-gray-700 rounded border border-gray-600"
                defaultValue={1}
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400">Height</label>
              <input
                type="number"
                className="w-full px-2 py-1 bg-gray-700 rounded border border-gray-600"
                defaultValue={1}
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400">Depth</label>
              <input
                type="number"
                className="w-full px-2 py-1 bg-gray-700 rounded border border-gray-600"
                defaultValue={1}
                step={0.1}
              />
            </div>
          </div>
        );
      case Tool.CYLINDER:
        return (
          <div className="space-y-3">
            <h3 className="font-medium text-lg">Cylinder Properties</h3>
            <div>
              <label className="block text-sm text-gray-400">Radius</label>
              <input
                type="number"
                className="w-full px-2 py-1 bg-gray-700 rounded border border-gray-600"
                defaultValue={0.5}
                step={0.1}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400">Height</label>
              <input
                type="number"
                className="w-full px-2 py-1 bg-gray-700 rounded border border-gray-600"
                defaultValue={1}
                step={0.1}
              />
            </div>
          </div>
        );
      default:
        if (selectedShape) {
          return (
            <div className="space-y-3">
              <h3 className="font-medium text-lg">Object Properties</h3>
              <div>
                <label className="block text-sm text-gray-400">Position X</label>
                <input
                  type="number"
                  className="w-full px-2 py-1 bg-gray-700 rounded border border-gray-600"
                  value={selectedShape.position[0]}
                  step={0.1}
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400">Position Y</label>
                <input
                  type="number"
                  className="w-full px-2 py-1 bg-gray-700 rounded border border-gray-600"
                  value={selectedShape.position[1]}
                  step={0.1}
                  readOnly
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400">Position Z</label>
                <input
                  type="number"
                  className="w-full px-2 py-1 bg-gray-700 rounded border border-gray-600"
                  value={selectedShape.position[2]}
                  step={0.1}
                  readOnly
                />
              </div>
            </div>
          );
        }
        return (
          <div className="flex flex-col items-center justify-center h-32 text-gray-500">
            <Box size={32} strokeWidth={1} />
            <p className="mt-2">Select a tool or object</p>
          </div>
        );
    }
  };

  if (collapsed) {
    return (
      <div className="h-full flex flex-col">
        <button
          className="self-end p-1 hover:bg-gray-700 rounded-l"
          onClick={() => setCollapsed(false)}
        >
          <ChevronRight size={20} />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between p-2 border-b border-gray-700">
        <h2 className="font-medium">Properties</h2>
        <button
          className="p-1 hover:bg-gray-700 rounded"
          onClick={() => setCollapsed(true)}
        >
          <ChevronLeft size={20} />
        </button>
      </div>
      
      <div className="flex border-b border-gray-700">
        <button className="flex-1 py-2 px-4 hover:bg-gray-700 border-b-2 border-blue-500">
          <Layers size={18} className="mx-auto" />
          <span className="text-xs block mt-1">Properties</span>
        </button>
        <button className="flex-1 py-2 px-4 hover:bg-gray-700">
          <Ruler size={18} className="mx-auto" />
          <span className="text-xs block mt-1">Measures</span>
        </button>
        <button className="flex-1 py-2 px-4 hover:bg-gray-700">
          <PanelLeft size={18} className="mx-auto" />
          <span className="text-xs block mt-1">Layers</span>
        </button>
        <button className="flex-1 py-2 px-4 hover:bg-gray-700">
          <Settings size={18} className="mx-auto" />
          <span className="text-xs block mt-1">Settings</span>
        </button>
      </div>
      
      <div className="p-4 overflow-y-auto flex-1">
        {renderToolProperties()}
      </div>
    </div>
  );
};

export default Sidebar;