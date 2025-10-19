import React from 'react';
import { useAppStore } from '../store';

const StatusBar: React.FC = () => {
  const { shapes, selectedShapeId, opencascadeInstance, opencascadeLoading, vertexEditMode, selectedVertexIndex } = useAppStore();

  const selectedShape = shapes.find(s => s.id === selectedShapeId);
  const vertexModCount = selectedShape?.vertexModifications?.length || 0;

  return (
    <div className="absolute bottom-4 left-0 right-0 flex items-center h-6 px-4 bg-stone-800 text-stone-300 text-xs border-t border-stone-700 z-20">
      <div className="flex items-center gap-3">
        <span className="font-semibold">
          {opencascadeLoading ? '⏳ Loading OpenCascade...' : opencascadeInstance ? '✓ OpenCascade Ready' : '✗ OpenCascade Failed'}
        </span>
        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
          opencascadeInstance ? 'bg-green-600 text-white' :
          opencascadeLoading ? 'bg-yellow-600 text-white' :
          'bg-red-600 text-white'
        }`}>
          {opencascadeInstance ? 'LOADED' : opencascadeLoading ? 'LOADING' : 'ERROR'}
        </span>
      </div>
      <div className="ml-auto flex items-center gap-4">
        <span className="text-stone-400">Objects: {shapes.length}</span>
        <span className="text-stone-400">
          Selected: {selectedShape ? `${selectedShape.type} (${selectedShape.id.slice(0, 8)})` : 'None'}
        </span>
        {selectedShape && (
          <span className="text-stone-400">
            Pos: [{selectedShape.position.map(v => v.toFixed(0)).join(', ')}]
          </span>
        )}
        {vertexEditMode && (
          <span className="text-blue-400">
            Vertex Edit {selectedVertexIndex !== null ? `(V${selectedVertexIndex})` : ''}
          </span>
        )}
        {vertexModCount > 0 && (
          <span className="text-purple-400">
            Vertex Mods: {vertexModCount}
          </span>
        )}
      </div>
    </div>
  );
};

export default StatusBar;
