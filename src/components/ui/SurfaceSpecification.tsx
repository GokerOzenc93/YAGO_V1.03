import React from 'react';
import { ChevronLeft, MousePointer, Plus, Target, X } from 'lucide-react';

interface Face {
  index: number;
  role: string;
  confirmed?: boolean;
  actualFaceIndex?: number; // The actual 3D face index
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
  activeFaceSelectionMode?: boolean;
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
  pendingFaceSelection,
  activeFaceSelectionMode = false
}) => {
  const handleClearAllFaceSelections = () => {
    // Dispatch event to clear all highlights from 3D scene
    const event = new CustomEvent('clearAllFaceHighlights');
    window.dispatchEvent(event);
    
    onClearAllFaceSelections();
  };

  const handleRemoveFace = (faceListIndex: number) => {
    console.log(`🗑️ Removing face row ${faceListIndex} from UI and 3D scene`);
    
    // 3D sahneden ilgili satırın highlight'ını temizle
    const event = new CustomEvent('removeFaceHighlightByRow', {
      detail: {
        rowIndex: faceListIndex,
        displayNumber: faceListIndex + 1,
        action: 'removeRow'
      }
    });
    window.dispatchEvent(event);
    
    // Arayüzden satırı sil
    onRemoveFaceFromList(faceListIndex);
    
    console.log(`✅ Row ${faceListIndex + 1} removed from both UI and 3D scene`);
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
                    <span className="text-xs font-mono text-slate-600">
                      Face {index + 1}
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
                      pendingFaceSelection === (index + 1) && activeFaceSelectionMode
                        ? 'bg-orange-600 text-white'
                        : 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                    }`}
                    title="Select Face on Surface"
                  >
                    <Target size={10} />
                  </button>
                  <button
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
        
        {/* Face Selection Status */}
        {activeFaceSelectionMode && pendingFaceSelection && (
          <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded text-xs">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-pulse"></div>
              <span className="text-orange-700 font-medium">
                Face selection active for Face {pendingFaceSelection}
              </span>
            </div>
            <p className="text-orange-600 mt-1">
              Click on 3D surface, then right-click to confirm
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurfaceSpecification;