import React, { useState, useEffect } from 'react';
import { X, Grid3X3, Save, RotateCcw, Move, Maximize, Ruler, MapPin, Box, Edit3, Check, AlertCircle } from 'lucide-react';
import { useAppStore, MeasurementUnit } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import * as THREE from 'three';

interface PanelData {
  faceIndex: number;
  position: THREE.Vector3;
  size: THREE.Vector3;
  panelOrder: number;
}

interface PanelProps {
  editedShape: Shape;
  onClose: () => void;
}

const Panel: React.FC<PanelProps> = ({ editedShape, onClose }) => {
  const { 
    convertToDisplayUnit, 
    convertToBaseUnit, 
    measurementUnit,
    updateShape,
    isAddPanelMode,
    setIsAddPanelMode,
    isPanelEditMode,
    setIsPanelEditMode
  } = useAppStore();

  // Panel editor state
  const [selectedPanel, setSelectedPanel] = useState<PanelData | null>(null);
  const [isPanelEditorOpen, setIsPanelEditorOpen] = useState(false);
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

  // Panel mode controls
  const [selectedFaces, setSelectedFaces] = useState<number[]>([]);
  const [hoveredFace, setHoveredFace] = useState<number | null>(null);
  const [showEdges, setShowEdges] = useState(true);
  const [showFaces, setShowFaces] = useState(true);

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

    // Update panel logic would go here
    console.log(`Panel ${selectedPanel.faceIndex} updated:`, {
      size: newSize.toArray().map(v => v.toFixed(1)),
      position: newPosition.toArray().map(v => v.toFixed(1))
    });

    setHasUnsavedChanges(false);
    setIsEditing(false);
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
        className="flex-1 bg-gray-700/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-blue-500/50"
        step="0.1"
        min="0.1"
        disabled={!isEditing}
      />
      <span className="text-xs text-gray-400 w-8">{unit}</span>
    </div>
  );

  const handlePanelSelect = (panelData: PanelData) => {
    setSelectedPanel(panelData);
    setIsPanelEditorOpen(true);
    console.log(`Panel selected for editing:`, {
      faceIndex: panelData.faceIndex,
      position: panelData.position.toArray().map(v => v.toFixed(1)),
      size: panelData.size.toArray().map(v => v.toFixed(1)),
      panelOrder: panelData.panelOrder
    });
  };

  const toggleAddPanelMode = () => {
    setIsAddPanelMode(!isAddPanelMode);
    console.log(`Panel add mode: ${!isAddPanelMode ? 'ON' : 'OFF'}`);
  };

  const togglePanelEditMode = () => {
    setIsPanelEditMode(!isPanelEditMode);
    console.log(`Panel edit mode: ${!isPanelEditMode ? 'ON' : 'OFF'}`);
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 bg-blue-600/20 border-b border-blue-500/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 bg-blue-600/30 rounded">
            <Grid3X3 size={12} className="text-blue-300" />
          </div>
          <span className="text-white font-medium text-sm">Panel</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded transition-colors"
          title="Geri"
        >
          <X size={12} />
        </button>
      </div>
      
      <div className="flex-1 p-3 space-y-3 overflow-y-auto">
        <div className="h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent mb-3"></div>
        
        {/* Panel Mode Controls */}
        <div className="space-y-2">
          <div className="text-xs text-gray-300 mb-2">Panel Modları</div>
          
          <button
            onClick={toggleAddPanelMode}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${
              isAddPanelMode 
                ? 'bg-green-600/90 text-white' 
                : 'bg-gray-600/50 text-gray-300 hover:bg-gray-600/70'
            }`}
          >
            <Box size={12} />
            {isAddPanelMode ? 'Panel Ekleme Modu: AÇIK' : 'Panel Ekleme Modu'}
          </button>

          <button
            onClick={togglePanelEditMode}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${
              isPanelEditMode 
                ? 'bg-red-600/90 text-white' 
                : 'bg-gray-600/50 text-gray-300 hover:bg-gray-600/70'
            }`}
          >
            <Edit3 size={12} />
            {isPanelEditMode ? 'Panel Düzenleme Modu: AÇIK' : 'Panel Düzenleme Modu'}
          </button>
        </div>

        {/* Panel Settings */}
        <div className="space-y-2">
          <div className="text-xs text-gray-300 mb-2">Panel Ayarları</div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-16">Kalınlık:</span>
            <input
              type="number"
              defaultValue="18"
              className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-blue-500/50"
              step="0.1"
              min="1"
            />
            <span className="text-xs text-gray-400 w-8">{measurementUnit}</span>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-16">Malzeme:</span>
            <select className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-blue-500/50">
              <option value="mdf">MDF</option>
              <option value="chipboard">Yonga Levha</option>
              <option value="plywood">Kontrplak</option>
            </select>
          </div>
          
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-16">Renk:</span>
            <select className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-blue-500/50">
              <option value="white">Beyaz</option>
              <option value="oak">Meşe</option>
              <option value="walnut">Ceviz</option>
              <option value="black">Siyah</option>
            </select>
          </div>
        </div>

        {/* Panel Editor Section */}
        {isPanelEditorOpen && selectedPanel && (
          <div className="border-t border-gray-600/30 pt-3 mt-3">
            <div className="bg-gray-700/30 rounded-lg p-3 border border-gray-600/30">
              <div className="flex items-center gap-2 mb-2">
                <Box size={14} className="text-blue-400" />
                <span className="text-white font-medium">Panel Bilgileri</span>
                <button
                  onClick={() => {
                    setIsPanelEditorOpen(false);
                    setSelectedPanel(null);
                  }}
                  className="ml-auto text-gray-400 hover:text-white p-1 rounded transition-colors"
                  title="Panel Editörünü Kapat"
                >
                  <X size={12} />
                </button>
              </div>
              
              <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                <div>
                  <span className="text-gray-400">Yüz:</span>
                  <span className="text-white ml-1 font-medium">{getFaceName(selectedPanel.faceIndex)}</span>
                </div>
                <div>
                  <span className="text-gray-400">İndeks:</span>
                  <span className="text-blue-400 ml-1 font-mono">{selectedPanel.faceIndex}</span>
                </div>
                <div>
                  <span className="text-gray-400">Sıra:</span>
                  <span className="text-green-400 ml-1 font-mono">{selectedPanel.panelOrder + 1}</span>
                </div>
                <div>
                  <span className="text-gray-400">Şekil:</span>
                  <span className="text-yellow-400 ml-1 font-mono">{editedShape.id.substring(0, 6)}...</span>
                </div>
              </div>

              {/* Edit Mode Toggle */}
              <div className="flex items-center justify-between mb-3">
                <span className="text-gray-300 text-sm font-medium">Düzenleme Modu</span>
                <button
                  onClick={() => setIsEditing(!isEditing)}
                  className={`px-3 py-1 rounded text-xs font-medium transition-colors ${
                    isEditing 
                      ? 'bg-blue-600/90 text-white' 
                      : 'bg-gray-600/50 text-gray-300 hover:bg-gray-600/70'
                  }`}
                >
                  {isEditing ? 'Düzenleniyor' : 'Sadece Görüntüle'}
                </button>
              </div>

              {/* Dimensions Section */}
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <Ruler size={14} className="text-blue-400" />
                  <span className="text-white font-medium text-sm">Boyutlar</span>
                </div>
                
                <div className="space-y-2 pl-4">
                  {renderInputField('G', dimensions.width, (v) => handleDimensionChange('width', v), <Box size={10} />)}
                  {renderInputField('Y', dimensions.height, (v) => handleDimensionChange('height', v), <Box size={10} />)}
                  {renderInputField('K', dimensions.thickness, (v) => handleDimensionChange('thickness', v), <Box size={10} />)}
                </div>
              </div>

              {/* Position Section */}
              <div className="space-y-3 mt-3">
                <div className="flex items-center gap-2">
                  <MapPin size={14} className="text-green-400" />
                  <span className="text-white font-medium text-sm">Konum</span>
                </div>
                
                <div className="space-y-2 pl-4">
                  {renderInputField('X', position.x, (v) => handlePositionChange('x', v), <Move size={10} />)}
                  {renderInputField('Y', position.y, (v) => handlePositionChange('y', v), <Move size={10} />)}
                  {renderInputField('Z', position.z, (v) => handlePositionChange('z', v), <Move size={10} />)}
                </div>
              </div>

              {/* Actions */}
              {isEditing && (
                <div className="flex gap-2 pt-3 border-t border-gray-600/30 mt-3">
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
                    Değişiklikleri Uygula
                  </button>
                  
                  <button
                    onClick={handleReset}
                    className="flex-1 flex items-center justify-center gap-1 py-2 rounded text-xs font-medium bg-yellow-600/90 text-white hover:bg-yellow-500 transition-colors"
                  >
                    <RotateCw size={12} />
                    Sıfırla
                  </button>
                </div>
              )}

              {/* Footer */}
              <div className="pt-2 border-t border-gray-600/30 mt-3">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                  <AlertCircle size={10} />
                  <span>3D görünümde panellere tıklayarak seçin</span>
                </div>
                {hasUnsavedChanges && (
                  <div className="text-xs text-orange-400 mt-1">
                    Kaydedilmemiş değişiklikleriniz var
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="text-xs text-gray-400 bg-gray-800/30 rounded p-2">
          <div className="font-medium mb-1">Kullanım:</div>
          <div>1. Panel Ekleme Modu: Yüzlere tıklayarak panel ekleyin</div>
          <div>2. Panel Düzenleme Modu: Mevcut panelleri düzenleyin</div>
          <div>3. Panellere tıklayarak boyut ve konum ayarlarını değiştirin</div>
        </div>
      </div>
    </>
  );
};

export default Panel;