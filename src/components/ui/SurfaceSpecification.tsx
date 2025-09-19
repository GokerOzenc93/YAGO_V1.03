import React from 'react';
import { ChevronLeft, MousePointer, Plus, Target, Check, X } from 'lucide-react';

interface Face {
  index: number;
  role: string;
  confirmed?: boolean;
}

interface SurfaceSpecificationProps {
  onBack: () => void;
  selectedFaces: Face[];
  onAddNewFace: () => void;
  onUpdateFaceRole: (faceListIndex: number, role: string) => void;
  onRemoveFaceFromList: (faceListIndex: number) => void;
  onFaceSelectionMode: (faceIndex: number) => void;
  onConfirmFaceSelection: (faceIndex: number) => void;
  onClearAllFaceSelections: () => void;
  pendingFaceSelection: number | null;
}

const SurfaceSpecification: React.FC<SurfaceSpecificationProps> = ({
  onBack,
  selectedFaces,
  onAddNewFace,
  onUpdateFaceRole,
  onRemoveFaceFromList,
  onFaceSelectionMode,
  onConfirmFaceSelection,
  onClearAllFaceSelections,
  pendingFaceSelection
}) => {
  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-orange-50 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 hover:bg-orange-200 rounded transition-colors"
          >
            <ChevronLeft size={16} className="text-orange-600" />
          </button>
          <MousePointer size={16} className="text-orange-600" />
          <span className="font-semibold text-orange-800">Surface Specification</span>
        </div>
      </div>

      {/* Surface Content */}
      <div className="flex-1 p-4 space-y-4">
        <h4 className="font-medium text-slate-800 mb-3">Face Index Management</h4>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Add new face row:</span>
          <button
            onClick={onAddNewFace}
            className="px-3 py-1.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors flex items-center gap-1"
            title="Add New Face Row"
          >
            <Plus size={14} />
            <span className="text-sm font-medium">Add Row</span>
          </button>
        </div>

        {/* Face Index List with Roles */}
        {selectedFaces.length > 0 && (
          <div className="bg-white rounded-lg border border-stone-200 p-4">
            <h4 className="font-medium text-slate-800 mb-3">Selected Faces</h4>
            <div className="space-y-2">
              {selectedFaces.map((face, index) => (
                <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                  <div className="flex items-center gap-2">
                    {/* Status indicator */}
                    <div className={`w-2 h-2 rounded-full ${face.confirmed ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="text-sm font-mono text-slate-600">
                      {face.confirmed ? '✓' : ''} Face {index + 1}
                    </span>
                  </div>
                  <select
                    value={face.role}
                    onChange={(e) => onUpdateFaceRole(index, e.target.value)}
                    className="flex-1 text-xs bg-white border border-gray-300 rounded px-2 py-1"
                  >
                    <option value="">Select Role</option>
                    <option value="left">Left Face</option>
                    <option value="right">Right Face</option>
                    <option value="top">Top Face</option>
                    <option value="bottom">Bottom Face</option>
                    <option value="front">Front Face</option>
                    <option value="back">Back Face</option>
                    <option value="door">Door Face</option>
                  </select>
                  <button
                    onClick={() => onFaceSelectionMode(index + 1)}
                    className={`p-1 rounded transition-colors ${
                      pendingFaceSelection === (index + 1)
                        ? 'bg-orange-600 text-white'
                        : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                    }`}
                    title="Select Face on Surface"
                  >
                    <Target size={12} />
                  </button>
                  {pendingFaceSelection === (index + 1) && (
                    <button
                      onClick={() => onConfirmFaceSelection(index)}
                      className="p-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      title="Confirm Selection"
                    >
                      <Check size={12} />
                    </button>
                  )}
                  <button
                    onClick={() => onRemoveFaceFromList(index)}
                    className="text-red-500 hover:text-red-700 p-1"
                    title="Remove Face"
                  >
                    <X size={12} />
                  </button>
                </div>
              ))}
            </div>
            <button
              onClick={onClearAllFaceSelections}
              className="mt-3 text-xs text-orange-600 hover:text-orange-800"
            >
              Clear All Faces
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurfaceSpecification;