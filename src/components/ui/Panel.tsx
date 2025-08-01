import React from 'react';
import { X, Grid3X3, Box, Edit3, Ruler } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import * as THREE from 'three';

interface PanelProps {
  editedShape: Shape;
  onClose: () => void;
  isAddPanelMode: boolean;
  setIsAddPanelMode: (mode: boolean) => void;
  isPanelEditMode: boolean;
  setIsPanelEditMode: (mode: boolean) => void;
}

interface SelectedPanelData {
  faceIndex: number;
  position: THREE.Vector3;
  size: THREE.Vector3;
  panelOrder: number;
}

const Panel: React.FC<PanelProps> = ({ 
  editedShape, 
  onClose,
  isAddPanelMode,
  setIsAddPanelMode,
  isPanelEditMode,
  setIsPanelEditMode
}) => {
  const [selectedPanel, setSelectedPanel] = React.useState<SelectedPanelData | null>(null);
  const { convertToDisplayUnit, convertToBaseUnit, measurementUnit } = useAppStore();

  // Listen for panel selection events
  React.useEffect(() => {
    const handlePanelSelect = (event: CustomEvent<SelectedPanelData>) => {
      setSelectedPanel(event.detail);
      console.log('Panel selected for editing:', event.detail);
    };

    window.addEventListener('panelSelected', handlePanelSelect as EventListener);
    return () => window.removeEventListener('panelSelected', handlePanelSelect as EventListener);
  }, []);

  // Reset selected panel when exiting edit mode
  React.useEffect(() => {
    if (!isPanelEditMode) {
      setSelectedPanel(null);
    }
  }, [isPanelEditMode]);

  const toggleAddPanelMode = () => {
    const newMode = !isAddPanelMode;
    setIsAddPanelMode(newMode);
    setIsPanelEditMode(false);
    
    if (newMode) {
      console.log('🎯 Panel Add Mode ACTIVATED - Click on faces to add panels');
      console.log('Instructions: Left click to cycle through overlapping faces, Right click to confirm panel placement');
    } else {
      console.log('🎯 Panel Add Mode DEACTIVATED');
    }
  };

  const togglePanelEditMode = () => {
    setIsPanelEditMode(!isPanelEditMode);
    setIsAddPanelMode(false);
    console.log(`Panel edit mode: ${!isPanelEditMode ? 'ON' : 'OFF'}`);
  };

  const handleBackToMain = () => {
    setSelectedPanel(null);
    setIsPanelEditMode(false);
    setIsAddPanelMode(false);
  };

  const getFaceName = (faceIndex: number): string => {
    const names = ['Ön', 'Arka', 'Üst', 'Alt', 'Sağ', 'Sol'];
    return names[faceIndex] || `Yüzey ${faceIndex}`;
  };

  return (
    <>
      <div className="flex items-center justify-between px-3 py-2 bg-blue-600/20 border-b border-blue-500/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 bg-blue-600/30 rounded">
            <Grid3X3 size={12} className="text-blue-300" />
          </div>
          <span className="text-white font-medium text-sm">{selectedPanel ? 'Panel Düzenle' : 'Panel'}</span>
        </div>
        <button
          onClick={selectedPanel ? handleBackToMain : onClose}
          className="text-gray-400 hover:text-white p-1 rounded transition-colors"
          title={selectedPanel ? "Geri" : "Kapat"}
        >
          <X size={12} />
        </button>
      </div>
      
      <div className="flex-1 p-3 space-y-3">
        <div className="h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent mb-3"></div>
        
        {selectedPanel ? (
          // Panel editing interface
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-6 h-6 bg-blue-600/30 rounded">
                <Ruler size={12} className="text-blue-300" />
              </div>
              <span className="text-white font-medium text-sm">
                {getFaceName(selectedPanel.faceIndex)} Paneli
              </span>
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <span className="text-gray-300 text-xs w-4">G:</span>
                <input
                  type="number"
                  value={convertToDisplayUnit(selectedPanel.size.x).toFixed(1)}
                  onChange={(e) => {
                    const newWidth = convertToBaseUnit(parseFloat(e.target.value) || 0);
                    // TODO: Update panel width
                    console.log('Panel width changed to:', newWidth);
                  }}
                  className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-blue-500/50"
                  step="0.1"
                  min="1"
                />
                <span className="text-gray-400 text-xs">{measurementUnit}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-gray-300 text-xs w-4">Y:</span>
                <input
                  type="number"
                  value={convertToDisplayUnit(selectedPanel.size.y).toFixed(1)}
                  onChange={(e) => {
                    const newHeight = convertToBaseUnit(parseFloat(e.target.value) || 0);
                    // TODO: Update panel height
                    console.log('Panel height changed to:', newHeight);
                  }}
                  className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-blue-500/50"
                  step="0.1"
                  min="1"
                />
                <span className="text-gray-400 text-xs">{measurementUnit}</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-gray-300 text-xs w-4">K:</span>
                <input
                  type="number"
                  value={convertToDisplayUnit(selectedPanel.size.z).toFixed(1)}
                  onChange={(e) => {
                    const newDepth = convertToBaseUnit(parseFloat(e.target.value) || 0);
                    // TODO: Update panel depth
                    console.log('Panel depth changed to:', newDepth);
                  }}
                  className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-blue-500/50"
                  step="0.1"
                  min="1"
                />
                <span className="text-gray-400 text-xs">{measurementUnit}</span>
              </div>
            </div>

            <div className="mt-4 p-2 bg-gray-800/30 rounded border border-gray-600/30">
              <div className="text-xs text-gray-400 mb-1">Panel Bilgileri:</div>
              <div className="text-xs text-gray-300">
                <div>Yüzey: {getFaceName(selectedPanel.faceIndex)}</div>
                <div>Sıra: {selectedPanel.panelOrder + 1}</div>
                <div>Pozisyon: [{selectedPanel.position.x.toFixed(0)}, {selectedPanel.position.y.toFixed(0)}, {selectedPanel.position.z.toFixed(0)}]</div>
              </div>
            </div>
          </div>
        ) : (
          // Main panel interface
        <div className="space-y-2">
          <button
            onClick={toggleAddPanelMode}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded text-xs font-medium transition-colors ${
              isAddPanelMode
                ? 'bg-green-600/90 text-white'
                : 'bg-gray-600/50 text-gray-300 hover:bg-gray-600/70'
            }`}
          >
            <Box size={12} />
            Panel Ekle
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
            Panel Düzenle
          </button>
        </div>
        )}
      </div>
    </>
  );
};

export default Panel;
