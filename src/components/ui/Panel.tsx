import React from 'react';
import { X, Grid3X3 } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Shape } from '../../types/shapes';

interface PanelProps {
  editedShape: Shape;
  onClose: () => void;
}

const Panel: React.FC<PanelProps> = ({ editedShape, onClose }) => {
  const { convertToDisplayUnit, measurementUnit } = useAppStore();

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
      </div>
    </>
  );
};

export default Panel;