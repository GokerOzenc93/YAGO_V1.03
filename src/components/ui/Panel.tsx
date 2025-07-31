import React from 'react';
import { X, Grid3X3, Box, Edit3 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Shape } from '../../types/shapes';

interface PanelProps {
  editedShape: Shape;
  onClose: () => void;
}

const Panel: React.FC<PanelProps> = ({ editedShape, onClose }) => {
  const { 
    isAddPanelMode,
    setIsAddPanelMode,
    isPanelEditMode,
    setIsPanelEditMode
  } = useAppStore();

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
      
      <div className="flex-1 p-3 space-y-3">
        <div className="h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent mb-3"></div>
        
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
            {isAddPanelMode ? 'Panel Ekleme Modu: AÇIK' : 'Panel Ekle'}
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
            {isPanelEditMode ? 'Panel Düzenleme Modu: AÇIK' : 'Panel Düzenle'}
          </button>
        </div>
      </div>
    </>
  );
};

export default Panel;