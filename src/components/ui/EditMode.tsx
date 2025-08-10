import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Pin,
  PinOff,
  ChevronLeft,
  ChevronRight,
  Puzzle,
  MousePointer,
  Edit3,
} from 'lucide-react';
import { Shape } from '../../types/shapes';
import Module from './Module';

interface EditModeProps {
  editedShape: Shape;
  onExit: () => void;
  hoveredFace: number | null;
  hoveredEdge: number | null;
  showEdges: boolean;
  setShowEdges: (show: boolean) => void;
  showFaces: boolean;
  setShowFaces: (show: boolean) => void;
  isFaceEditMode: boolean;
  setIsFaceEditMode: (mode: boolean) => void;
  isVolumeEditMode?: boolean;
  setIsVolumeEditMode?: (mode: boolean) => void;
}

const EditMode: React.FC<EditModeProps> = ({
  editedShape,
  onExit,
  hoveredFace,
  hoveredEdge,
  showEdges,
  setShowEdges,
  showFaces,
  setShowFaces,
  isFaceEditMode,
  setIsFaceEditMode,
  isVolumeEditMode = false,
  setIsVolumeEditMode,
}) => {
  const [panelHeight, setPanelHeight] = useState('calc(100vh - 108px)');
  const [panelTop, setPanelTop] = useState('88px');
  const [activeComponent, setActiveComponent] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Varsayılan olarak sabitlenmiş (pinned) gelsin
  const [isLocked, setIsLocked] = useState(true); 
  
  const MIN_WIDTH_PX = 170;
  const MAX_WIDTH_PX = 453;
  const [panelWidth, setPanelWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
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
      const toolbarElement = document.querySelector('.flex.flex-col.font-inter');
      const topOffset = toolbarElement ? toolbarElement.clientHeight : 88;

      const terminalElement = document.querySelector('.fixed.bottom-0.left-0.right-0.z-30');
      const statusBarElement = document.querySelector('.flex.items-center.justify-between.h-5.px-2.text-xs.bg-gray-800\\/80');

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
    setIsFaceEditMode(false);
    onExit();
  };

  const handleComponentClick = (componentType: string) => {
    if (activeComponent === componentType) {
      setActiveComponent(null);
    } else {
      setActiveComponent(componentType);
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
    e.preventDefault();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = panelRef.current?.clientWidth || 250;
  };

  const getIconButtonColorClasses = (color: string, isActive: boolean) => {
    const baseClasses = 'relative flex items-center rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]';

    if (isActive) {
      return `${baseClasses} bg-violet-600/90 text-white shadow-lg shadow-violet-500/25 border border-violet-400/30`;
    } else {
      return `${baseClasses} bg-gray-800/50 text-gray-300 hover:bg-gray-600/50 border border-gray-500/30 hover:border-gray-400/50`;
    }
  };

  const toggleFaceEditMode = () => {
    const newMode = !isFaceEditMode;
    setIsFaceEditMode(newMode);
    
    // Volume edit modunu kapat
    if (newMode && setIsVolumeEditMode) {
      setIsVolumeEditMode(false);
    }
    
    if (newMode) {
      console.log('🎯 Face Edit Mode ACTIVATED - Click on faces to select them');
    } else {
      console.log('🎯 Face Edit Mode DEACTIVATED');
    }
  };

  const toggleVolumeEditMode = () => {
    if (!setIsVolumeEditMode) return;
    
    const newMode = !isVolumeEditMode;
    setIsVolumeEditMode(newMode);
    
    // Face edit modunu kapat
    if (newMode) {
      setIsFaceEditMode(false);
    }
    
    if (newMode) {
      console.log('🎯 Volume Edit Mode ACTIVATED - Drag vertices to reshape geometry');
    } else {
      console.log('🎯 Volume Edit Mode DEACTIVATED');
    }
  };

  const renderComponentContent = () => {
    switch (activeComponent) {
      case 'module':
        return <Module editedShape={editedShape} onClose={() => setActiveComponent(null)} />;
      default:
        return (
          <div className="flex flex-col w-full bg-gray-700/50 flex-shrink-0 py-2">
            {(editedShape.type === 'box' || 
              editedShape.type === 'cylinder' || 
              editedShape.type === 'polyline2d' || 
              editedShape.type === 'polygon2d' || 
              editedShape.type === 'polyline3d' || 
              editedShape.type === 'polygon3d' || 
              editedShape.type === 'rectangle2d' || 
              editedShape.type === 'circle2d') && (
              <div className="flex flex-col gap-1 px-2">
                <button
                  onClick={() => handleComponentClick('module')}
                  className={`${getIconButtonColorClasses('violet', activeComponent === 'module')} w-full justify-start gap-2 px-2 py-1.5 text-left`}
                  title="Module"
                >
                  <div className="flex-shrink-0">
                    <Puzzle size={12} />
                  </div>
                  <span className="text-xs font-medium truncate">Module</span>
                  {activeComponent === 'module' && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    </div>
                  )}
                </button>
                
                <button
                  onClick={toggleFaceEditMode}
                  className={`${getIconButtonColorClasses('orange', isFaceEditMode)} w-full justify-start gap-2 px-2 py-1.5 text-left`}
                  title="Face Select"
                >
                  <div className="flex-shrink-0">
                    <MousePointer size={12} />
                  </div>
                  <span className="text-xs font-medium truncate">Face Select</span>
                  {isFaceEditMode && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-orange-500 rounded-full"></div>
                    </div>
                  )}
                </button>
                
                <button
                  onClick={toggleVolumeEditMode}
                  className={`${getIconButtonColorClasses('blue', isVolumeEditMode)} w-full justify-start gap-2 px-2 py-1.5 text-left`}
                  title="Volume Edit"
                >
                  <div className="flex-shrink-0">
                    <Edit3 size={12} />
                  </div>
                  <span className="text-xs font-medium truncate">Volume Edit</span>
                  {isVolumeEditMode && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-blue-500 rounded-full"></div>
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
        );
    }
  };

  return (
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
      onSelectStart={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
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
            {/* Panel genişliği 200px'ten büyükse düğmeleri göster*/}
            {panelWidth > 200 && (
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
            )}
          </div>
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {renderComponentContent()}
          </div>
        </div>
      )}
      
      <div
        className={`absolute top-0 right-0 w-3 h-full cursor-ew-resize bg-transparent transition-colors ${isResizing ? 'bg-blue-500/30' : 'hover:bg-blue-500/30'}`}
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
};

export default EditMode;
