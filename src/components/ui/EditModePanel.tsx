// src/components/ui/EditModePanel.tsx
import React, { useState, useRef, useEffect, useCallback } from 'react';
import { PanelEditor } from './PanelEditor';
import { DraggableWindow } from './DraggableWindow'; // DraggableWindow'ı içe aktar
import { useAppStore } from '../../store/appStore'; // useAppStore'u içe aktar

interface EditModePanelProps {
  onClose: () => void;
}

export const EditModePanel: React.FC<EditModePanelProps> = ({ onClose }) => {
  const {
    selectedShapeId,
    shapes,
    updateShape,
    isEditMode,
    toggleEditMode,
    setPanelVisibility,
    isPanelVisible,
  } = useAppStore();
  const selectedShape = selectedShapeId ? shapes[selectedShapeId] : null;

  const [panelSize, setPanelSize] = useState({ width: 400, height: 300 });
  const [panelPosition, setPanelPosition] = useState({ x: 50, y: 50 });
  const [isCollapsed, setIsCollapsed] = useState(false); // Yeni durum değişkeni

  const panelRef = useRef<HTMLDivElement>(null);

  // Panelin boyutlarını ve konumunu yerel depolamadan yükle
  useEffect(() => {
    const savedWidth = localStorage.getItem('editModePanelWidth');
    const savedHeight = localStorage.getItem('editModePanelHeight');
    const savedX = localStorage.getItem('editModePanelX');
    const savedY = localStorage.getItem('editModePanelY');
    const savedCollapsed = localStorage.getItem('editModePanelCollapsed');

    if (savedWidth && savedHeight) {
      setPanelSize({ width: parseInt(savedWidth), height: parseInt(savedHeight) });
    }
    if (savedX && savedY) {
      setPanelPosition({ x: parseInt(savedX), y: parseInt(savedY) });
    }
    if (savedCollapsed === 'true') {
      setIsCollapsed(true);
    }
  }, []);

  // Panelin boyutları veya konumu değiştiğinde yerel depolamaya kaydet
  useEffect(() => {
    localStorage.setItem('editModePanelWidth', panelSize.width.toString());
    localStorage.setItem('editModePanelHeight', panelSize.height.toString());
    localStorage.setItem('editModePanelX', panelPosition.x.toString());
    localStorage.setItem('editModePanelY', panelPosition.y.toString());
  }, [panelSize, panelPosition]);

  // isCollapsed durumu değiştiğinde yerel depolamaya kaydet
  useEffect(() => {
    localStorage.setItem('editModePanelCollapsed', isCollapsed.toString());
  }, [isCollapsed]);

  const handleResize = useCallback((newWidth: number, newHeight: number) => {
    setPanelSize({ width: newWidth, height: newHeight });
  }, []);

  const handleDrag = useCallback((newX: number, newY: number) => {
    setPanelPosition({ x: newX, y: newY });
  }, []);

  const handleClose = () => {
    toggleEditMode(); // Düzenleme modunu kapat
    setPanelVisibility(false); // Paneli gizle
    onClose();
  };

  // Boyutları daralt/genişlet düğmesi işlevi
  const toggleCollapse = () => {
    setIsCollapsed(!isCollapsed);
  };

  if (!isEditMode || !isPanelVisible) {
    return null;
  }

  return (
    <DraggableWindow
      title="Düzenleme Modu"
      initialX={panelPosition.x}
      initialY={panelPosition.y}
      initialWidth={panelSize.width}
      initialHeight={panelSize.height}
      onDrag={handleDrag}
      onResize={handleResize}
      onClose={handleClose}
      minWidth={300}
      minHeight={200}
      className={`bg-gray-800 border border-gray-700 shadow-lg rounded-lg flex flex-col ${isCollapsed ? 'w-[50px] h-[50px]' : ''}`} // Daraltılmış durumda boyutları küçült
      style={{
        width: isCollapsed ? '50px' : `${panelSize.width}px`,
        height: isCollapsed ? '50px' : `${panelSize.height}px`,
        overflow: 'hidden', // İçeriğin daraltıldığında taşmasını engelle
      }}
    >
      <div className="relative flex-grow p-4 overflow-auto">
        {/* Boyutları daralt/genişlet düğmesi */}
        <button
          onClick={toggleCollapse}
          className="absolute right-0 top-1/2 transform -translate-y-1/2 bg-blue-600 hover:bg-blue-700 text-white p-2 rounded-full shadow-md z-10"
          title={isCollapsed ? 'Genişlet' : 'Daralt'}
        >
          {isCollapsed ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M6 5l7 7-7 7" />
            </svg>
          )}
        </button>

        {!isCollapsed && ( // Daraltıldığında içeriği gizle
          <>
            <h3 className="text-xl font-semibold text-white mb-4">Şekil Düzenle</h3>
            {selectedShape ? (
              <PanelEditor shape={selectedShape} onUpdate={updateShape} />
            ) : (
              <p className="text-gray-400">Düzenlemek için bir şekil seçin.</p>
            )}
          </>
        )}
      </div>
    </DraggableWindow>
  );
};
