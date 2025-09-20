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
  const handleClearAllFaceSelections = () => {
    // Dispatch event to clear all highlights from 3D scene
    const event = new CustomEvent('clearAllFaceHighlights');
    window.dispatchEvent(event);
    
    onClearAllFaceSelections();
  };

  const handleRemoveFace = (faceListIndex: number) => {
    // Dispatch event to remove highlight from 3D scene
    const event = new CustomEvent('removeFaceHighlight', {
      detail: {
        faceListIndex: faceListIndex,
        displayNumber: faceListIndex + 1
      }
    });
    window.dispatchEvent(event);
    
    // Remove from list
    onRemoveFaceFromList(faceListIndex);
    
    console.log(`🎯 Face ${faceListIndex + 1} removed from both list and scene`);
  };
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
      <div className="flex-1 p-4">

        {/* Face Index List with Roles */}
        <div className="bg-white rounded-lg border border-stone-200 p-3">
          <div className="flex items-center justify-between mb-3">
            <h4 className="font-medium text-slate-800">Selected Faces</h4>
            <button
              onClick={onAddNewFace}
              className="p-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
              title="Add New Face Row"
            >
              <Plus size={12} />
            </button>
          </div>
          
          {selectedFaces.length > 0 ? (
            <div className="space-y-1">
              {selectedFaces.map((face, index) => (
                <div key={index} className="flex items-center gap-2 p-1.5 bg-gray-50 rounded text-sm">
                  <div className="flex items-center gap-2">
                    {/* Status indicator */}
                    <div className={`w-2 h-2 rounded-full ${face.confirmed ? 'bg-green-500' : 'bg-gray-400'}`}></div>
                    <span className="text-xs font-mono text-slate-600">
                      {face.confirmed ? '✓' : ''} Face {index + 1}
                    </span>
                  </div>
                  <select
                    value={face.role}
                    onChange={(e) => onUpdateFaceRole(index, e.target.value)}
                    className="flex-1 text-xs bg-white border border-gray-300 rounded px-1.5 py-0.5 text-slate-800"
                  >
                    <option value="" className="text-slate-600">Select Role</option>
                    <option value="left" className="text-slate-800">Left</option>
                    <option value="right" className="text-slate-800">Right</option>
                    <option value="top" className="text-slate-800">Top</option>
                    <option value="bottom" className="text-slate-800">Bottom</option>
                    <option value="front" className="text-slate-800">Front</option>
                    <option value="back" className="text-slate-800">Back</option>
                    <option value="door" className="text-slate-800">Door</option>
                  </select>
                  <button
                    onClick={() => onFaceSelectionMode(index + 1)}
                    className={`p-1 rounded transition-colors ${
                      pendingFaceSelection === (index + 1)
                        ? 'bg-orange-600 text-white'
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    }`}
                    title="Select Face on Surface"
                  >
                    <Target size={10} />
                  </button>
                  {pendingFaceSelection === (index + 1) && (
                    <button
                      onClick={() => onConfirmFaceSelection(index)}
                      className="p-0.5 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                      title="Confirm Selection"
                    >
                      <Check size={10} />
                    </button>
                  )}
                  <button
                    onClick={() => onRemoveFaceFromList(index)}
                    onClick={() => handleRemoveFace(index)}
                    className="text-red-500 hover:text-red-700 p-0.5"
                    title="Remove Face"
                  >
                    <X size={10} />
                  </button>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-4 text-slate-500 text-sm">
              <span>No faces selected</span>
            </div>
          )}
          
          {selectedFaces.length > 0 && (
            <button
              onClick={handleClearAllFaceSelections}
              className="mt-2 text-xs text-orange-600 hover:text-orange-800"
            >
              Clear All Faces
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default SurfaceSpecification;