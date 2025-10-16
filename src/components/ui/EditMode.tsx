import React from 'react';
import { X } from 'lucide-react';

interface EditModeProps {
  editedShape: any;
  onExit: () => void;
  hoveredFace: number | null;
  hoveredEdge: number | null;
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
  isFaceEditMode,
  setIsFaceEditMode,
}) => {
  return (
    <div className="absolute top-4 left-4 bg-white rounded-lg shadow-lg p-4 z-10">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold">Edit Mode</h3>
        <button
          onClick={onExit}
          className="p-1 hover:bg-gray-100 rounded"
          title="Exit Edit Mode (ESC)"
        >
          <X size={20} />
        </button>
      </div>

      <div className="space-y-2">
        <div className="text-sm text-gray-600">
          Editing: <span className="font-medium">{editedShape.type}</span>
        </div>

        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="faceEditMode"
            checked={isFaceEditMode}
            onChange={(e) => setIsFaceEditMode(e.target.checked)}
            className="rounded"
          />
          <label htmlFor="faceEditMode" className="text-sm">
            Face Selection Mode
          </label>
        </div>

        <div className="text-xs text-gray-500 mt-2">
          Press ESC to exit edit mode
        </div>
      </div>
    </div>
  );
};

export default EditMode;
