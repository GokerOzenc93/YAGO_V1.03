import React from 'react';
import { ChevronLeft, MousePointer, Plus, Target, Check, X } from 'lucide-react';
import { 
  initializeSurfaceSelection, 
  setSurfaceSelectionMode, 
  clearAllSelections,
  getActiveSelections,
  SurfaceSelection 
} from '../../utils/surfaceSelection';

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
  const [surfaceSelections, setSurfaceSelections] = React.useState<SurfaceSelection[]>([]);
  const [isSelectionActive, setIsSelectionActive] = React.useState(false);
  const cleanupRef = React.useRef<(() => void) | null>(null);

  // Initialize surface selection system
  React.useEffect(() => {
    const canvas = document.querySelector('canvas');
    const scene = (window as any).currentScene;
    const camera = (window as any).currentCamera;
    
    if (canvas && scene && camera) {
      const cleanup = initializeSurfaceSelection(scene, camera, canvas, {
        onSurfaceSelected: (selection) => {
          console.log('🎯 Surface selected:', selection.id);
        },
        onSurfacePersisted: (selection) => {
          console.log('🎯 Surface persisted:', selection.id);
          setSurfaceSelections(getActiveSelections());
        },
        defaultColor: 0xff6b35, // Orange color
        enableLabels: true
      });
      
      cleanupRef.current = cleanup;
    }
    
    return () => {
      if (cleanupRef.current) {
        cleanupRef.current();
      }
    };
  }, []);

  const handleToggleSelection = () => {
    const newState = !isSelectionActive;
    setIsSelectionActive(newState);
    setSurfaceSelectionMode(newState);
    
    if (newState) {
      console.log('🎯 Surface selection mode ACTIVATED');
      console.log('📋 Instructions:');
      console.log('   • Left-click: Highlight orange surface');
      console.log('   • Right-click: Persist highlighted surface');
    } else {
      console.log('🎯 Surface selection mode DEACTIVATED');
    }
  };

  const handleClearAllSurfaces = () => {
    const scene = (window as any).currentScene;
    if (scene) {
      clearAllSelections(scene);
      setSurfaceSelections([]);
      console.log('🎯 All surface selections cleared');
    }
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
      <div className="flex-1 p-4 space-y-4">
        {/* Surface Selection Controls */}
        <div className="bg-white rounded-lg border border-stone-200 p-4">
          <h4 className="font-medium text-slate-800 mb-3">Surface Selection System</h4>
          
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-slate-600">Primary surface selection:</span>
            <button
              onClick={handleToggleSelection}
              className={`px-4 py-2 rounded font-medium transition-colors ${
                isSelectionActive
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              {isSelectionActive ? 'Selection Active' : 'Activate Selection'}
            </button>
          </div>
          
          {isSelectionActive && (
            <div className="bg-orange-50 border border-orange-200 rounded p-3 mb-3">
              <p className="text-sm text-orange-800 font-medium mb-2">Selection Mode Active:</p>
              <ul className="text-xs text-orange-700 space-y-1">
                <li>• <strong>Left-click</strong> on orange surface to highlight</li>
                <li>• <strong>Right-click</strong> on highlighted surface to persist</li>
                <li>• Selected surfaces remain visible with labels</li>
              </ul>
            </div>
          )}
          
          {surfaceSelections.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium text-slate-700">
                  Active Selections ({surfaceSelections.length})
                </span>
                <button
                  onClick={handleClearAllSurfaces}
                  className="text-xs text-red-600 hover:text-red-800"
                >
                  Clear All
                </button>
              </div>
              
              <div className="max-h-32 overflow-y-auto space-y-1">
                {surfaceSelections.map((selection, index) => (
                  <div key={selection.id} className="flex items-center justify-between p-2 bg-gray-50 rounded text-xs">
                    <span className="font-mono">Surface {index + 1}</span>
                    <span className="text-gray-500">{selection.surfaceVertices.length} vertices</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

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