import React from 'react';
import { X } from 'lucide-react';

interface EditModeProps {
  editedShape: any;
  onExit: () => void;
  hoveredFace: any;
  hoveredEdge: any;
  showEdges: boolean;
  setShowEdges: (show: boolean) => void;
  showFaces: boolean;
  setShowFaces: (show: boolean) => void;
  isFaceEditMode: boolean;
  setIsFaceEditMode: (mode: boolean) => void;
}

const EditMode: React.FC<EditModeProps> = ({
  editedShape,
  onExit,
  hoveredFace,
  hoveredEdge,
  showEdges,
  setShowEdges,
  showFaces,
  setShowFaces,
  isFaceEditMode,
  setIsFaceEditMode,
}) => {
  return (
    <div className="absolute top-4 left-4 bg-gray-800/95 rounded-lg shadow-xl border border-gray-700 p-4 z-50 min-w-80">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Edit Mode</h3>
        <button
          onClick={onExit}
          className="p-1 hover:bg-gray-700 rounded transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-3">
        <div>
          <span className="text-sm text-gray-400">Shape Type:</span>
          <span className="ml-2 text-white">{editedShape.type}</span>
        </div>

        <div>
          <span className="text-sm text-gray-400">Shape ID:</span>
          <span className="ml-2 text-white text-xs">{editedShape.id.slice(0, 8)}</span>
        </div>

        <div className="border-t border-gray-700 pt-3">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showEdges}
              onChange={(e) => setShowEdges(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Show Edges</span>
          </label>
        </div>

        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={showFaces}
              onChange={(e) => setShowFaces(e.target.checked)}
              className="w-4 h-4"
            />
            <span className="text-sm">Show Faces</span>
          </label>
        </div>

        <div className="border-t border-gray-700 pt-3">
          <button
            onClick={() => setIsFaceEditMode(!isFaceEditMode)}
            className={`w-full py-2 px-4 rounded transition-colors ${
              isFaceEditMode
                ? 'bg-blue-600 hover:bg-blue-700'
                : 'bg-gray-700 hover:bg-gray-600'
            }`}
          >
            {isFaceEditMode ? 'Exit Face Edit' : 'Face Edit Mode'}
          </button>
        </div>

        {hoveredFace && (
          <div className="border-t border-gray-700 pt-3">
            <span className="text-sm text-gray-400">Hovered Face:</span>
            <span className="ml-2 text-white">{hoveredFace}</span>
          </div>
        )}

        {hoveredEdge && (
          <div>
            <span className="text-sm text-gray-400">Hovered Edge:</span>
            <span className="ml-2 text-white">{hoveredEdge}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default EditMode;
