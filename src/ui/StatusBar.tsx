import React from 'react';
import { useAppStore } from '../core/appStore';

const StatusBar: React.FC = () => {
  const {
    cameraPosition,
    selectedShapeId,
    shapes,
    measurementUnit,
    geometryMode
  } = useAppStore();

  const selectedShape = shapes.find(s => s.id === selectedShapeId);

  return (
    <div className="bg-gray-800 border-t border-gray-700 px-4 py-2 text-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-6">
          <span className="text-gray-400">
            Camera: X:{cameraPosition[0].toFixed(0)} Y:{cameraPosition[1].toFixed(0)} Z:{cameraPosition[2].toFixed(0)}
          </span>
          {selectedShape && (
            <span className="text-gray-400">
              Selected: {selectedShape.type}
            </span>
          )}
          <span className="text-gray-400">
            Unit: {measurementUnit}
          </span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-gray-400">
            Engine: {geometryMode || 'Three.js'}
          </span>
          <span className="text-gray-400" id="fps-value">
            FPS: --
          </span>
          <span className="text-green-400">Ready</span>
        </div>
      </div>
    </div>
  );
};

export default StatusBar;
