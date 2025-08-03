import React from 'react';
import { X, Puzzle } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import * as THREE from 'three';

interface ModuleProps {
  editedShape: Shape;
  onClose: () => void;
}

const Module: React.FC<ModuleProps> = ({ editedShape, onClose }) => {
  const { convertToDisplayUnit, convertToBaseUnit, updateShape } = useAppStore();

  // Get dimensions based on shape type
  const getDimensions = () => {
    if (editedShape.type === 'box') {
      return {
        width: editedShape.parameters.width || 500,
        height: editedShape.parameters.height || 500,
        depth: editedShape.parameters.depth || 500
      };
    } else if (editedShape.type === 'polyline3d' || editedShape.type === 'polygon3d') {
      // For polyline/polygon, use bounding box dimensions
      const geometry = editedShape.geometry;
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        return {
          width: size.x,
          height: editedShape.parameters.height || 500,
          depth: size.z
        };
      }
    }
    return { width: 500, height: 500, depth: 500 };
  };

  const dimensions = getDimensions();

  const updateDimensions = (newDimensions: { width?: number; height?: number; depth?: number }) => {
    if (editedShape.type === 'box') {
      const newGeometry = new THREE.BoxGeometry(
        newDimensions.width || dimensions.width,
        newDimensions.height || dimensions.height,
        newDimensions.depth || dimensions.depth
      );
      updateShape(editedShape.id, {
        parameters: { ...editedShape.parameters, ...newDimensions },
        geometry: newGeometry
      });
    } else if (editedShape.type === 'polyline3d' || editedShape.type === 'polygon3d') {
      // For polyline/polygon, only height can be modified
      if (newDimensions.height) {
        // Recreate geometry with new height
        const { createPolylineGeometry } = require('../drawing/geometryCreator');
        const newGeometry = createPolylineGeometry(
          editedShape.originalPoints || [],
          newDimensions.height,
          50
        );
        updateShape(editedShape.id, {
          parameters: { ...editedShape.parameters, height: newDimensions.height },
          geometry: newGeometry,
          position: [editedShape.position[0], newDimensions.height / 2, editedShape.position[2]]
        });
      }
    }
  };

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
              value={convertToDisplayUnit(dimensions.width).toFixed(1)}
              onChange={(e) => {
                const newWidth = convertToBaseUnit(parseFloat(e.target.value) || 0);
                updateDimensions({ width: newWidth });
              }}
              className={`flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50 ${
                editedShape.type !== 'box' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              step="0.1"
              min="1"
              disabled={editedShape.type !== 'box'}
              title={editedShape.type !== 'box' ? 'Width cannot be modified for this shape type' : ''}
            />
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-4">H:</span>
            <input
              type="number"
              value={convertToDisplayUnit(dimensions.height).toFixed(1)}
              onChange={(e) => {
                const newHeight = convertToBaseUnit(parseFloat(e.target.value) || 0);
                updateDimensions({ height: newHeight });
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
              value={convertToDisplayUnit(dimensions.depth).toFixed(1)}
              onChange={(e) => {
                const newDepth = convertToBaseUnit(parseFloat(e.target.value) || 0);
                updateDimensions({ depth: newDepth });
              }}
              className={`flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50 ${
                editedShape.type !== 'box' ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              step="0.1"
              min="1"
              disabled={editedShape.type !== 'box'}
              title={editedShape.type !== 'box' ? 'Depth cannot be modified for this shape type' : ''}
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default Module;