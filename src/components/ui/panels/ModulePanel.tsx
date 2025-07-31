import React from 'react';
import { X, Puzzle } from 'lucide-react';
import { useAppStore } from '../../../store/appStore';
import { Shape } from '../../../types/shapes';
import * as THREE from 'three';

interface ModulePanelProps {
  editedShape: Shape;
  onClose: () => void;
}

const ModulePanel: React.FC<ModulePanelProps> = ({ editedShape, onClose }) => {
  const { convertToDisplayUnit, convertToBaseUnit, updateShape } = useAppStore();

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 bg-violet-600/20 border-b border-violet-500/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 bg-violet-600/30 rounded">
            <Puzzle size={12} className="text-violet-300" />
          </div>
          <span className="text-white font-medium text-sm">Module</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded transition-colors"
          title="Geri"
        >
          <X size={12} />
        </button>
      </div>
      
      <div className="flex-1 p-3 space-y-3">
        <div className="h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent mb-3"></div>
        
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-4">W:</span>
            <input
              type="number"
              value={convertToDisplayUnit(editedShape.parameters.width || 500).toFixed(1)}
              onChange={(e) => {
                const newWidth = convertToBaseUnit(parseFloat(e.target.value) || 0);
                const newGeometry = new THREE.BoxGeometry(
                  newWidth,
                  editedShape.parameters.height || 500,
                  editedShape.parameters.depth || 500
                );
                updateShape(editedShape.id, {
                  parameters: { ...editedShape.parameters, width: newWidth },
                  geometry: newGeometry
                });
              }}
              className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
              step="0.1"
              min="1"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-4">H:</span>
            <input
              type="number"
              value={convertToDisplayUnit(editedShape.parameters.height || 500).toFixed(1)}
              onChange={(e) => {
                const newHeight = convertToBaseUnit(parseFloat(e.target.value) || 0);
                const newGeometry = new THREE.BoxGeometry(
                  editedShape.parameters.width || 500,
                  newHeight,
                  editedShape.parameters.depth || 500
                );
                updateShape(editedShape.id, {
                  parameters: { ...editedShape.parameters, height: newHeight },
                  geometry: newGeometry
                });
              }}
              className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
              step="0.1"
              min="1"
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-4">D:</span>
            <input
              type="number"
              value={convertToDisplayUnit(editedShape.parameters.depth || 500).toFixed(1)}
              onChange={(e) => {
                const newDepth = convertToBaseUnit(parseFloat(e.target.value) || 0);
                const newGeometry = new THREE.BoxGeometry(
                  editedShape.parameters.width || 500,
                  editedShape.parameters.height || 500,
                  newDepth
                );
                updateShape(editedShape.id, {
                  parameters: { ...editedShape.parameters, depth: newDepth },
                  geometry: newGeometry
                });
              }}
              className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
              step="0.1"
              min="1"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default ModulePanel;