import React, { useState, useEffect } from 'react';
import { X, Save, RotateCcw, Move, Maximize, Ruler, MapPin, Box, Edit3, Check, AlertCircle } from 'lucide-react';
import { useAppStore, MeasurementUnit } from '../../store/appStore';
import * as THREE from 'three';

interface PanelData {
  faceIndex: number;
  position: THREE.Vector3;
  size: THREE.Vector3;
  panelOrder: number;
}

interface PanelEditorProps {
  isOpen: boolean;
  onClose: () => void;
  selectedPanel: PanelData | null;
  onPanelUpdate: (faceIndex: number, updates: Partial<PanelData>) => void;
  editingShapeId: string | null;
}

const PanelEditor: React.FC<PanelEditorProps> = ({
  isOpen,
  onClose,
  selectedPanel,
  onPanelUpdate,
  editingShapeId
}) => {
  const [dimensions, setDimensions] = useState({
    width: '',
    height: '',
    thickness: ''
  });
  
  const [position, setPosition] = useState({
    x: '',
    y: '',
    z: ''
  });
  
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  
  const { 
    measurementUnit, 
    convertToDisplayUnit, 
    convertToBaseUnit 
  } = useAppStore();

  // Initialize values when panel is selected
  useEffect(() => {
    if (selectedPanel) {
      setDimensions({
        width: convertToDisplayUnit(selectedPanel.size.x).toFixed(1),
        height: convertToDisplayUnit(selectedPanel.size.y).toFixed(1),
        thickness: convertToDisplayUnit(selectedPanel.size.z).toFixed(1)
      });
      
      setPosition({
        x: convertToDisplayUnit(selectedPanel.position.x).toFixed(1),
        y: convertToDisplayUnit(selectedPanel.position.y).toFixed(1),
        z: convertToDisplayUnit(selectedPanel.position.z).toFixed(1)
      });
      
      setHasUnsavedChanges(false);
      setIsEditing(false);
    }
  }, [selectedPanel, convertToDisplayUnit]);

  const handleDimensionChange = (field: string, value: string) => {
    setDimensions(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handlePositionChange = (field: string, value: string) => {
    setPosition(prev => ({ ...prev, [field]: value }));
    setHasUnsavedChanges(true);
  };

  const handleSave = () => {
    if (!selectedPanel) return;

    const newSize = new THREE.Vector3(
      convertToBaseUnit(parseFloat(dimensions.width) || 0),
      convertToBaseUnit(parseFloat(dimensions.height) || 0),
      convertToBaseUnit(parseFloat(dimensions.thickness) || 0)
    );

    const newPosition = new THREE.Vector3(
      convertToBaseUnit(parseFloat(position.x) || 0),
      convertToBaseUnit(parseFloat(position.y) || 0),
      convertToBaseUnit(parseFloat(position.z) || 0)
    );

    onPanelUpdate(selectedPanel.faceIndex, {
      size: newSize,
      position: newPosition
    });

    setHasUnsavedChanges(false);
    setIsEditing(false);
    
    console.log(`Panel ${selectedPanel.faceIndex} updated:`, {
      size: newSize.toArray().map(v => v.toFixed(1)),
      position: newPosition.toArray().map(v => v.toFixed(1))
    });
  };

  const handleReset = () => {
    if (selectedPanel) {
      setDimensions({
        width: convertToDisplayUnit(selectedPanel.size.x).toFixed(1),
        height: convertToDisplayUnit(selectedPanel.size.y).toFixed(1),
        thickness: convertToDisplayUnit(selectedPanel.size.z).toFixed(1)
      });
      
      setPosition({
        x: convertToDisplayUnit(selectedPanel.position.x).toFixed(1),
        y: convertToDisplayUnit(selectedPanel.position.y).toFixed(1),
        z: convertToDisplayUnit(selectedPanel.position.z).toFixed(1)
      });
      
      setHasUnsavedChanges(false);
    }
  };

  const getFaceName = (faceIndex: number) => {
    const faceNames = ['Front', 'Back', 'Top', 'Bottom', 'Right', 'Left'];
    return faceNames[faceIndex] || `Face ${faceIndex}`;
  };

  const renderInputField = (
    label: string,
    value: string,
    onChange: (value: string) => void,
    icon: React.ReactNode,
    unit: string = measurementUnit
  ) => (
    <div className="flex items-center gap-2">
      <div className="flex items-center gap-1 w-16">
        {icon}
        <span className="text-xs font-medium text-gray-300">{label}:</span>
      </div>
      <input
        type="number"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="flex-1 bg-gray-700/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-red-500/50"
        step="0.1"
        min="0.1"
        disabled={!isEditing}
      />
      <span className="text-xs text-gray-400 w-8">{unit}</span>
    </div>
  );

  if (!isOpen || !selectedPanel) return null;

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-60 flex items-center justify-center">
      <div className="bg-gray-800/95 backdrop-blur-sm rounded-lg border border-gray-600/50 shadow-2xl w-96 max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 bg-red-600/90 border-b border-red-500/50">
          <div className="flex items-center gap-2">
            <Edit3 size={16} className="text-white" />
            <span className="text-white font-medium">Panel Editor</span>
            {hasUnsavedChanges && (
              <div className="w-2 h-2 bg-orange-400 rounded-full" title="Unsaved changes" />
            )}
          </div>
          
          <div className="flex items-center gap-1">
            {isEditing && (
              <>
                <button
                  onClick={handleSave}
                  disabled={!hasUnsavedChanges}
                  className={`p-1 rounded transition-colors ${
                    hasUnsavedChanges 
                      ? 'text-green-300 hover:text-green-200 hover:bg-white/10' 
                      : 'text-gray-500 cursor-not-allowed'
                  }`}
                  title="Save Changes"
                >
                  <Save size={14} />
                </button>
                
                <button
                  onClick={handleReset}
                  className="text-yellow-300 hover:text-yellow-200 p-1 rounded transition-colors hover:bg-white/10"
                  title="Reset Values"
                >
                  <RotateCcw size={14} />
                </button>
              </>
            )}
            
            <button
              onClick={onClose}
              className="text-white hover:text-red-200 p-1 rounded transition-colors hover:bg-white/10"
              title="Close Editor"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Panel Info */}
          <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/30">
            <div className="flex items-center gap-2 mb-2">
              <Box size={14} className="text-red-400" />
              <span className="text-white font-medium">Panel Information</span>
            </div>
            
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div>
                <span className="text-gray-400">Face:</span>
                <span className="text-white ml-1 font-medium">{getFaceName(selectedPanel.faceIndex)}</span>
              </div>
              <div>
                <span className="text-gray-400">Index:</span>
                <span className="text-red-400 ml-1 font-mono">{selectedPanel.faceIndex}</span>
              </div>
              <div>
                <span className="text-gray-400">Order:</span>
                <span className="text-blue-400 ml-1 font-mono">{selectedPanel.panelOrder + 1}</span>
              </div>
              <div>
                <span className="text-gray-400">Shape:</span>
                <span className="text-green-400 ml-1 font-mono">{editingShapeId?.substring(0, 6)}...</span>
              </div>
            </div>
          </div>

          {/* Edit Mode Toggle */}
          <div className="flex items-center justify-between">
            <span className="text-gray-300 text-sm font-medium">Edit Mode</span>
            <button
              onClick={() => setIsEditing(!isEditing)}
              className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                isEditing 
                  ? 'bg-red-600/90 text-white' 
                  : 'bg-gray-600/50 text-gray-300 hover:bg-gray-600/70'
              }`}
            >
              {isEditing ? 'Editing' : 'View Only'}
            </button>
          </div>

          {/* Dimensions Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Ruler size={14} className="text-blue-400" />
              <span className="text-white font-medium text-sm">Dimensions</span>
            </div>
            
            <div className="space-y-2 pl-4">
              {renderInputField('W', dimensions.width, (v) => handleDimensionChange('width', v), <Box size={10} />)}
              {renderInputField('H', dimensions.height, (v) => handleDimensionChange('height', v), <Box size={10} />)}
              {renderInputField('T', dimensions.thickness, (v) => handleDimensionChange('thickness', v), <Box size={10} />)}
            </div>
          </div>

          {/* Position Section */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <MapPin size={14} className="text-green-400" />
              <span className="text-white font-medium text-sm">Position</span>
            </div>
            
            <div className="space-y-2 pl-4">
              {renderInputField('X', position.x, (v) => handlePositionChange('x', v), <Move size={10} />)}
              {renderInputField('Y', position.y, (v) => handlePositionChange('y', v), <Move size={10} />)}
              {renderInputField('Z', position.z, (v) => handlePositionChange('z', v), <Move size={10} />)}
            </div>
          </div>

          {/* Actions */}
          {isEditing && (
            <div className="flex gap-2 pt-2 border-t border-gray-600/30">
              <button
                onClick={handleSave}
                disabled={!hasUnsavedChanges}
                className={`flex-1 flex items-center justify-center gap-1 py-2 rounded text-xs font-medium transition-colors ${
                  hasUnsavedChanges
                    ? 'bg-green-600/90 text-white hover:bg-green-500'
                    : 'bg-gray-600/50 text-gray-400 cursor-not-allowed'
                }`}
              >
                <Check size={12} />
                Apply Changes
              </button>
              
              <button
                onClick={handleReset}
                className="flex-1 flex items-center justify-center gap-1 py-2 rounded text-xs font-medium bg-yellow-600/90 text-white hover:bg-yellow-500 transition-colors"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-gray-700/30 border-t border-gray-600/30">
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <AlertCircle size={10} />
            <span>Click on panels in 3D view to select them</span>
          </div>
          {hasUnsavedChanges && (
            <div className="text-xs text-orange-400 mt-1">
              You have unsaved changes
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default PanelEditor;