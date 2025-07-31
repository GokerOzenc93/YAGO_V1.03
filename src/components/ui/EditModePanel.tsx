import React, { useState, useEffect, useRef } from 'react';
import {
  Minimize2,
  Maximize,
  ChevronUp,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Box,
  Cylinder,
  Check,
  X,
  Save,
  Layers,
  Shell as Shelf,
  DoorOpen,
  Package,
  Settings,
  Scissors,
  RectangleHorizontal,
  Minus,
  Grid3X3,
  Zap,
  Hash,
  Sliders,
  Edit3,
  Puzzle,
  Pin,
  PinOff
} from 'lucide-react';
import { useAppStore, MeasurementUnit } from '../../store/appStore.ts';
import { Shape } from '../../types/shapes';
import DraggableWindow from './DraggableWindow';
import PanelEditor from './PanelEditor';
import * as THREE from 'three';

interface PanelData {
  faceIndex: number;
  position: THREE.Vector3;
  size: THREE.Vector3;
  panelOrder: number;
}

interface EditModePanelProps {
  editedShape: Shape;
  onExit: () => void;
  isAddPanelMode: boolean;
  setIsAddPanelMode: (mode: boolean) => void;
  selectedFaces: number[];
  setSelectedFaces: (faces: number[] | ((prev: number[]) => number[])) => void;
  hoveredFace: number | null;
  hoveredEdge: number | null;
  showEdges: boolean;
  setShowEdges: (show: boolean) => void;
  showFaces: boolean;
  setShowFaces: (show: boolean) => void;
  isPanelEditMode: boolean;
  setIsPanelEditMode: (mode: boolean) => void;
}

const EditModePanel: React.FC<EditModePanelProps> = ({
  editedShape,
  onExit,
  isAddPanelMode,
  setIsAddPanelMode,
  selectedFaces,
  setSelectedFaces,
  hoveredFace,
  hoveredEdge,
  showEdges,
  setShowEdges,
  showFaces,
  setShowFaces,
  isPanelEditMode,
  setIsPanelEditMode,
}) => {
  const [panelHeight, setPanelHeight] = useState('calc(100vh - 108px)');
  const [panelTop, setPanelTop] = useState('88px');
  const [panelTopValue, setPanelTopValue] = useState(88);
  const [panelHeightValue, setPanelHeightValue] = useState(0);
  const [activeComponent, setActiveComponent] = useState<string | null>(null);

  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isLocked, setIsLocked] = useState(false);
  const MIN_WIDTH_PX = 170; // 45mm ≈ 170px
  const MAX_WIDTH_PX = 453; // 120mm ≈ 453px
  const [panelWidth, setPanelWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    // Farenin hareketini ve tıklamayı dinler
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;
      const newWidth = Math.max(MIN_WIDTH_PX, Math.min(startWidth.current + (e.clientX - startX.current), MAX_WIDTH_PX));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const calculatePanelPositionAndHeight = () => {
      const toolbarElement =
        document.querySelector('.flex.flex-col.font-inter');
      const topOffset = toolbarElement ? toolbarElement.clientHeight : 88;

      const terminalElement =
        document.querySelector('.fixed.bottom-0.left-0.right-0.z-30');
      const statusBarElement =
        document.querySelector('.flex.items-center.justify-between.h-5.px-2.text-xs.bg-gray-800\\/80');

      let bottomOffset = 0;

      if (terminalElement) {
        bottomOffset = terminalElement.clientHeight;
      } else if (statusBarElement) {
        bottomOffset = statusBarElement.clientHeight;
      } else {
        bottomOffset = 20;
      }

      const availableHeight = window.innerHeight - topOffset - bottomOffset;
      const newHeight = Math.max(availableHeight, 200);
      const newTop = topOffset;

      setPanelHeight(`${newHeight}px`);
      setPanelTop(`${newTop}px`);
      setPanelHeightValue(newHeight);
      setPanelTopValue(newTop);
    };

    calculatePanelPositionAndHeight();

    let resizeTimeoutId: NodeJS.Timeout;
    const debouncedCalculate = () => {
      clearTimeout(resizeTimeoutId);
      resizeTimeoutId = setTimeout(calculatePanelPositionAndHeight, 50);
    };

    window.addEventListener('resize', debouncedCalculate);
    const observer = new MutationObserver(debouncedCalculate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    return () => {
      clearTimeout(resizeTimeoutId);
      window.removeEventListener('resize', debouncedCalculate);
      observer.disconnect();
    };
  }, []);

  const handleClose = () => {
    setActiveComponent(null);
    setIsAddPanelMode(false);
    setIsPanelEditMode(false);
    onExit();
  };

  const handleComponentClick = (componentType: string) => {
    if (activeComponent === componentType) {
      setActiveComponent(null);
      setIsAddPanelMode(false);
      setIsPanelEditMode(false);
    } else {
      setActiveComponent(componentType);

      if (componentType === 'panels') {
        setIsAddPanelMode(true);
        setIsPanelEditMode(false);
      } else if (componentType === 'panel-edit') {
        setIsAddPanelMode(false);
        setIsPanelEditMode(true);
      } else {
        setIsAddPanelMode(false);
        setIsPanelEditMode(false);
      }
    }
  };

  const getShapeIcon = () => {
    switch (editedShape.type) {
      case 'box':
        return <Box size={14} className="text-blue-400" />;
      case 'cylinder':
        return <Cylinder size={14} className="text-teal-400" />;
      default:
        return <Box size={14} className="text-orange-400" />;
    }
  };

  const furnitureComponents = [
    {
      id: 'panels',
      icon: <Layers size={12} />,
      color: 'blue',
      label: 'Panels'
    },
    {
      id: 'module',
      icon: <Puzzle size={12} />,
      color: 'violet',
      label: 'Module'
    },
    {
      id: 'edgeband',
      icon: <RectangleHorizontal size={12} />,
      color: 'amber',
      label: 'Edgeband'
    },
    {
      id: 'parameter',
      icon: <Sliders size={12} />,
      color: 'cyan',
      label: 'Parameter'
    },
    {
      id: 'shelves',
      icon: <Shelf size={12} />,
      color: 'green',
      label: 'Shelves'
    },
    {
      id: 'doors',
      icon: <DoorOpen size={12} />,
      color: 'orange',
      label: 'Doors'
    },
  ];

  const getIconButtonColorClasses = (color: string, isActive: boolean) => {
    const baseClasses =
      'relative flex items-center rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]';

    if (isActive) {
      switch (color) {
        case 'blue':
          return `${baseClasses} bg-blue-600/90 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30`;
        case 'red':
          return `${baseClasses} bg-red-600/90 text-white shadow-lg shadow-red-500/25 border border-red-400/30`;
        case 'green':
          return `${baseClasses} bg-green-600/90 text-white shadow-lg shadow-green-500/25 border border-green-400/30`;
        case 'purple':
          return `${baseClasses} bg-purple-600/90 text-white shadow-lg shadow-purple-500/25 border border-purple-400/30`;
        case 'orange':
          return `${baseClasses} bg-orange-600/90 text-white shadow-lg shadow-orange-500/25 border border-orange-400/30`;
        case 'amber':
          return `${baseClasses} bg-amber-600/90 text-white shadow-lg shadow-amber-500/25 border border-amber-400/30`;
        case 'indigo':
          return `${baseClasses} bg-indigo-600/90 text-white shadow-lg shadow-indigo-500/25 border border-indigo-400/30`;
        case 'cyan':
          return `${baseClasses} bg-cyan-600/90 text-white shadow-lg shadow-cyan-500/25 border border-cyan-400/30`;
        case 'pink':
          return `${baseClasses} bg-pink-600/90 text-white shadow-lg shadow-pink-500/25 border border-pink-400/30`;
        case 'teal':
          return `${baseClasses} bg-teal-600/90 text-white shadow-lg shadow-teal-500/25 border border-teal-400/30`;
        case 'slate':
          return `${baseClasses} bg-slate-600/90 text-white shadow-lg shadow-slate-500/25 border border-slate-400/30`;
        case 'emerald':
          return `${baseClasses} bg-emerald-600/90 text-white shadow-lg shadow-emerald-500/25 border border-emerald-400/30`;
        case 'violet':
          return `${baseClasses} bg-violet-600/90 text-white shadow-lg shadow-violet-500/25 border border-violet-400/30`;
        default:
          return `${baseClasses} bg-gray-600/90 text-white shadow-lg shadow-gray-500/25 border border-gray-400/30`;
      }
    } else {
      return `${baseClasses} bg-gray-800/50 text-gray-300 hover:bg-gray-600/50 border border-gray-500/30 hover:border-gray-400/50`;
    }
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (!isLocked && !isResizing) {
      setIsCollapsed(false);
    }
  };

  const handleMouseLeave = () => {
    if (!isLocked && !isResizing) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsCollapsed(true);
      }, 300);
    }
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
    if (!isLocked) {
      setIsCollapsed(false);
    }
  };

  const handleCollapse = () => {
    setIsCollapsed(true);
  };
  
  const handleExpand = () => {
    setIsCollapsed(false);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault(); // Metin seçimini ve varsayılan sürükleme davranışını engelle
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = panelRef.current?.clientWidth || 250;
  };

  return (
    <>
      <div
        ref={panelRef}
        className={`fixed left-0 z-50 bg-gray-800/95 backdrop-blur-sm border-r border-blue-500/50 shadow-xl rounded-r-xl flex flex-col transition-all duration-300 ease-in-out group`}
        style={{
          top: panelTop,
          height: panelHeight,
          width: isCollapsed ? '4px' : `${panelWidth}px`,
        }}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        onSelectStart={(e) => e.preventDefault()} // Metin seçimini engeller
        onDragStart={(e) => e.preventDefault()} // Sürüklemeyi engeller
      >
        {isCollapsed && (
          <button
            onClick={handleExpand}
            className="absolute top-1/2 -translate-y-1/2 left-full -translate-x-1/2 bg-gray-700/80 p-2 rounded-full shadow-lg border border-blue-500/50 transition-all duration-300 group-hover:left-1/2 group-hover:-translate-x-1/2"
            title="Paneli Genişlet"
          >
            <ChevronRight size={16} className="text-white group-hover:text-blue-300" />
          </button>
        )}

        {!isCollapsed && (
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="flex items-center justify-between p-2 pt-4 border-b border-gray-700">
              <span className="text-white font-inter text-base font-bold opacity-90">
                AD06072
              </span>
              <div className="flex items-center gap-1">
                {isLocked && (
                  <button
                    onClick={handleCollapse}
                    className="text-gray-400 hover:text-white p-1 rounded transition-colors bg-gray-800/80 backdrop-blur-sm"
                    title="Arayüzü Küçült"
                  >
                    <ChevronLeft size={12} />
                  </button>
                )}
                
                <button
                  onClick={toggleLock}
                  className={`p-1 rounded transition-colors ${
                    isLocked ? 'bg-blue-600/90 text-white' : 'text-gray-400 hover:text-blue-400'
                  } bg-gray-800/80 backdrop-blur-sm`}
                  title={isLocked ? 'Paneli Çöz' : 'Paneli Sabitle'}
                >
                  {isLocked ? <Pin size={12} /> : <PinOff size={12} />}
                </button>
                
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors bg-gray-800/80 backdrop-blur-sm"
                  title="Düzenleme Modundan Çık"
                >
                  <X size={12} />
                </button>
              </div>
            </div>
            
            <div className="flex-1 flex flex-col overflow-hidden">
              {activeComponent === 'module' ? (
                <div className="w-full flex flex-col">
                  <div className="flex items-center justify-between px-3 py-2 bg-violet-600/20 border-b border-violet-500/30">
                    <div className="flex items-center gap-2">
                      <div className="flex items-center justify-center w-6 h-6 bg-violet-600/30 rounded">
                        <Puzzle size={12} className="text-violet-300" />
                      </div>
                      <span className="text-white font-medium text-sm">Module</span>
                    </div>
                    <button
                      onClick={() => setActiveComponent(null)}
                      className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                      title="Geri"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  <div className="flex-1 p-3 space-y-3">
                    <div className="h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent mb-3"></div>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 text-xs w-4">W:</span>
                        <input
                          type="number"
                          value={convertToDisplayUnit(editedShape.parameters.width || 500).toFixed(1)}
                          onChange={(e) => {
                            const newWidth = convertToBaseUnit(parseFloat(e.target.value) || 0);
                            const newGeometry = new THREE.BoxGeometry(
                              newWidth,
                              editedShape.parameters.height || 500,
                              editedShape.parameters.depth || 500
                            );
                            updateShape(editedShape.id, {
                              parameters: { ...editedShape.parameters, width: newWidth },
                              geometry: newGeometry
                            });
                          }}
                          className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
                          step="0.1"
                          min="1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 text-xs w-4">H:</span>
                        <input
                          type="number"
                          value={convertToDisplayUnit(editedShape.parameters.height || 500).toFixed(1)}
                          onChange={(e) => {
                            const newHeight = convertToBaseUnit(parseFloat(e.target.value) || 0);
                            const newGeometry = new THREE.BoxGeometry(
                              editedShape.parameters.width || 500,
                              newHeight,
                              editedShape.parameters.depth || 500
                            );
                            updateShape(editedShape.id, {
                              parameters: { ...editedShape.parameters, height: newHeight },
                              geometry: newGeometry
                            });
                          }}
                          className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
                          step="0.1"
                          min="1"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-gray-300 text-xs w-4">D:</span>
                        <input
                          type="number"
                          value={convertToDisplayUnit(editedShape.parameters.depth || 500).toFixed(1)}
                          onChange={(e) => {
                            const newDepth = convertToBaseUnit(parseFloat(e.target.value) || 0);
                            const newGeometry = new THREE.BoxGeometry(
                              editedShape.parameters.width || 500,
                              editedShape.parameters.height || 500,
                              newDepth
                            );
                            updateShape(editedShape.id, {
                              parameters: { ...editedShape.parameters, depth: newDepth },
                              geometry: newGeometry
                            });
                          }}
                          className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
                          step="0.1"
                          min="1"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
              <>
                <div className="flex flex-col w-full bg-gray-700/50 flex-shrink-0 py-2">
                  {editedShape.type === 'box' && (
                    <>
                      <div className="flex flex-col gap-1 px-2">
                        {furnitureComponents.map((component) => {
                          const isActive = activeComponent === component.id;
                          return (
                            <button
                              key={component.id}
                              onClick={() => handleComponentClick(component.id)}
                              className={`${getIconButtonColorClasses(component.color, isActive)} w-full justify-start gap-2 px-2 py-1.5 text-left`}
                              title={component.label}
                            >
                              <div className="flex-shrink-0">
                                {React.cloneElement(component.icon, { size: 12 })}
                              </div>
                              <span className="text-xs font-medium truncate">
                                {component.label}
                              </span>
                              {isActive && (
                                <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                                  <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </>
                  )}
                </div>
              </>
              )}
            </div>
          </div>
        )}
        <div
          className={`absolute top-0 right-0 w-3 h-full cursor-ew-resize bg-transparent transition-colors ${isResizing ? 'bg-blue-500/30' : 'hover:bg-blue-500/30'}`}
          onMouseDown={handleResizeMouseDown}
        />
      </div>

      {activeComponent === 'panels' && (
        <div 
          className="fixed left-0 z-40 w-48 bg-gray-700/30 backdrop-blur-sm border-r border-gray-600/30 flex flex-col overflow-hidden"
          style={{
            top: `${panelTopValue + 180}px`,
            height: `${panelHeightValue - 180}px`,
          }}
        >
          <div className="flex items-center px-3 py-2 border-b border-gray-600/30 bg-gray-800/50">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-blue-400" />
              <span className="text-white font-medium text-sm">Paneller</span>
            </div>
          </div>
          
          <div className="flex-1 p-3 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <div className="text-gray-400 text-xs text-center py-8">
              Panel detayları burada gösterilecek...
              <br /><br />
              Burada çok içerik olursa aşağıya kaydırılabilir olacak.
              <br /><br />
              Örnek içerik: Panel ekleme, düzenleme, ayarlar vs.
            </div>
          </div>
        </div>
      )}

      {activeComponent === 'edgeband' && (
        <div 
          className="fixed left-0 z-40 w-48 bg-gray-700/30 backdrop-blur-sm border-r border-gray-600/30 flex flex-col overflow-hidden"
          style={{
            top: `${panelTopValue + 180}px`,
            height: `${panelHeightValue - 180}px`,
          }}
        >
          <div className="flex items-center px-3 py-2 border-b border-gray-600/30 bg-gray-800/50">
            <div className="flex items-center gap-2">
              <RectangleHorizontal size={14} className="text-amber-400" />
              <span className="text-white font-medium text-sm">Edgeband</span>
            </div>
          </div>
          
          <div className="flex-1 p-3 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <div className="text-gray-400 text-xs text-center py-8">
              Edgeband details will be shown here...
              <br /><br />
              Edge thickness, material, color options etc.
            </div>
          </div>
        </div>
      )}

      {activeComponent === 'parameter' && (
        <div 
          className="fixed left-0 z-40 w-48 bg-gray-700/30 backdrop-blur-sm border-r border-gray-600/30 flex flex-col overflow-hidden"
          style={{
            top: `${panelTopValue + 180}px`,
            height: `${panelHeightValue - 180}px`,
          }}
        >
          <div className="flex items-center px-3 py-2 border-b border-gray-600/30 bg-gray-800/50">
            <div className="flex items-center gap-2">
              <Sliders size={14} className="text-cyan-400" />
              <span className="text-white font-medium text-sm">Parameter</span>
            </div>
          </div>
          
          <div className="flex-1 p-3 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <div className="text-gray-400 text-xs text-center py-8">
              Parameter details will be shown here...
              <br /><br />
              Custom parameters, variables, formulas etc.
            </div>
          </div>
        </div>
      )}

      {activeComponent === 'shelves' && (
        <div 
          className="fixed left-0 z-40 w-48 bg-gray-700/30 backdrop-blur-sm border-r border-gray-600/30 flex flex-col overflow-hidden"
          style={{
            top: `${panelTopValue + 180}px`,
            height: `${panelHeightValue - 180}px`,
          }}
        >
          <div className="flex items-center px-3 py-2 border-b border-gray-600/30 bg-gray-800/50">
            <div className="flex items-center gap-2">
              <Shelf size={14} className="text-green-400" />
              <span className="text-white font-medium text-sm">Raflar</span>
            </div>
          </div>
          
          <div className="flex-1 p-3 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <div className="text-gray-400 text-xs text-center py-8">
              Raf detayları burada gösterilecek...
              <br /><br />
              Sabit raf, ayarlanabilir raf, raf pozisyonları vs.
            </div>
          </div>
        </div>
      )}

      {activeComponent === 'doors' && (
        <div 
          className="fixed left-0 z-40 w-48 bg-gray-700/30 backdrop-blur-sm border-r border-gray-600/30 flex flex-col overflow-hidden"
          style={{
            top: `${panelTopValue + 180}px`,
            height: `${panelHeightValue - 180}px`,
          }}
        >
          <div className="flex items-center px-3 py-2 border-b border-gray-600/30 bg-gray-800/50">
            <div className="flex items-center gap-2">
              <DoorOpen size={14} className="text-orange-400" />
              <span className="text-white font-medium text-sm">Kapılar</span>
            </div>
          </div>
          
          <div className="flex-1 p-3 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            <div className="text-gray-400 text-xs text-center py-8">
              Kapı detayları burada gösterilecek...
              <br /><br />
              Tek kapı, çift kapı, menteşe ayarları, kulp seçimi vs.
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default EditModePanel;
