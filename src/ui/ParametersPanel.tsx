import { useState, useEffect } from 'react';
import { X, GripVertical } from 'lucide-react';
import { useAppStore } from '../store';
import * as THREE from 'three';

interface ParametersPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

export function ParametersPanel({ isOpen, onClose }: ParametersPanelProps) {
  const { selectedShapeId, shapes, updateShape } = useAppStore();
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  const selectedShape = shapes.find((s) => s.id === selectedShapeId);

  const [width, setWidth] = useState(0);
  const [height, setHeight] = useState(0);
  const [depth, setDepth] = useState(0);

  useEffect(() => {
    if (selectedShape && selectedShape.parameters) {
      setWidth(selectedShape.parameters.width || 0);
      setHeight(selectedShape.parameters.height || 0);
      setDepth(selectedShape.parameters.depth || 0);
    }
  }, [selectedShape]);

  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({
      x: e.clientX - position.x,
      y: e.clientY - position.y,
    });
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) {
      setPosition({
        x: e.clientX - dragOffset.x,
        y: e.clientY - dragOffset.y,
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  const handleDimensionChange = (dimension: 'width' | 'height' | 'depth', value: number) => {
    if (!selectedShape) return;

    const newWidth = dimension === 'width' ? value : width;
    const newHeight = dimension === 'height' ? value : height;
    const newDepth = dimension === 'depth' ? value : depth;

    setWidth(newWidth);
    setHeight(newHeight);
    setDepth(newDepth);

    const newGeometry = new THREE.BoxGeometry(newWidth, newHeight, newDepth);

    updateShape(selectedShape.id, {
      geometry: newGeometry,
      parameters: {
        ...selectedShape.parameters,
        width: newWidth,
        height: newHeight,
        depth: newDepth,
      },
    });
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed bg-white rounded-lg shadow-2xl border border-stone-300 z-50"
      style={{
        left: `${position.x}px`,
        top: `${position.y}px`,
        width: '220px',
      }}
    >
      <div
        className="flex items-center justify-between px-3 py-2 bg-stone-100 border-b border-stone-300 rounded-t-lg cursor-move"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-stone-400" />
          <span className="text-sm font-semibold text-slate-800">Parameters</span>
        </div>
        <button
          onClick={onClose}
          className="p-0.5 hover:bg-stone-200 rounded transition-colors"
        >
          <X size={14} className="text-stone-600" />
        </button>
      </div>

      <div className="p-3">
        {selectedShape ? (
          <div className="space-y-2">
            <div className="text-xs text-stone-600 mb-2">
              <span className="font-medium">Object:</span> {selectedShape.type}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-stone-700">W:</label>
                <input
                  type="number"
                  value={width}
                  onChange={(e) => handleDimensionChange('width', Number(e.target.value))}
                  className="w-28 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-stone-700">H:</label>
                <input
                  type="number"
                  value={height}
                  onChange={(e) => handleDimensionChange('height', Number(e.target.value))}
                  className="w-28 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                />
              </div>

              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-stone-700">D:</label>
                <input
                  type="number"
                  value={depth}
                  onChange={(e) => handleDimensionChange('depth', Number(e.target.value))}
                  className="w-28 px-2 py-1 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                />
              </div>
            </div>
          </div>
        ) : (
          <div className="text-xs text-stone-500 text-center py-3">
            No object selected
          </div>
        )}
      </div>
    </div>
  );
}
