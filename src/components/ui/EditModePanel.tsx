import React, { useState, useEffect } from 'react';
import {
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
} from 'lucide-react';
import { useAppStore, MeasurementUnit } from '../../store/appStore.ts';
import { Shape } from '../../types/shapes';
import DraggableWindow from './DraggableWindow';

interface EditModePanelProps {
  editedShape: Shape;
  onExit: () => void;
  // Panel manager state
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
  // 🔴 NEW: Panel Edit Mode
  isPanelEditMode: boolean;
  setIsPanelEditMode: (mode: boolean) => void;
}

interface OpenWindow {
  id: string;
  title: string;
  component: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
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
  // 🔴 NEW: Panel Edit Mode props
  isPanelEditMode,
  setIsPanelEditMode,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dimensionValues, setDimensionValues] = useState<{
    [key: string]: string;
  }>({});
  const [panelHeight, setPanelHeight] = useState('calc(100vh - 108px)'); // Default height
  const [panelTop, setPanelTop] = useState('88px'); // Default top position
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeComponent, setActiveComponent] = useState<string | null>(null);
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
  const [buttonDisplayMode, setButtonDisplayMode] = useState<'text' | 'icon'>('text');

  const {
    measurementUnit,
    convertToDisplayUnit,
    convertToBaseUnit,
    updateShape,
  } = useAppStore();

  // Calculate panel height dynamically - responsive to terminal and status bar
  useEffect(() => {
    const calculatePanelPositionAndHeight = () => {
      // Get Toolbar height dynamically
      const toolbarElement =
        document.querySelector('.flex.flex-col.font-inter'); // Main toolbar container
      const topOffset = toolbarElement ? toolbarElement.clientHeight : 88; // Default to 88px if not found

      // Get Terminal and Status Bar height dynamically
      const terminalElement =
        document.querySelector('.fixed.bottom-0.left-0.right-0.z-30'); // Main terminal container
      const statusBarElement =
        document.querySelector('.flex.items-center.justify-between.h-5.px-2.text-xs.bg-gray-800\\/80'); // Status bar specific class

      let bottomOffset = 0;

      if (terminalElement) {
        bottomOffset = terminalElement.clientHeight;
        console.log('Terminal height detected:', terminalElement.clientHeight);
      } else if (statusBarElement) {
        // Fallback if terminal is not found but status bar is
        bottomOffset = statusBarElement.clientHeight;
        console.log('Status bar height detected:', statusBarElement.clientHeight);
      } else {
        bottomOffset = 20; // Default status bar height if nothing found
      }

      const availableHeight = window.innerHeight - topOffset - bottomOffset;
      const newHeight = `${Math.max(availableHeight, 200)}px`; // Minimum 200px
      const newTop = `${topOffset}px`;

      setPanelHeight(newHeight);
      setPanelTop(newTop);

      console.log('Panel position and height calculated:', {
        windowHeight: window.innerHeight,
        topOffset,
        bottomOffset,
        availableHeight,
        newHeight,
        newTop,
      });
    };

    // Initial calculation
    calculatePanelPositionAndHeight();

    // Debounced calculation function for resize events
    let resizeTimeoutId: NodeJS.Timeout;
    const debouncedCalculate = () => {
      clearTimeout(resizeTimeoutId);
      resizeTimeoutId = setTimeout(calculatePanelPositionAndHeight, 50);
    };

    // Window resize event listener
    window.addEventListener('resize', debouncedCalculate);

    // MutationObserver to watch for DOM changes (like terminal expansion/collapse)
    const observer = new MutationObserver(debouncedCalculate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'], // Watch for class and style changes
    });

    // Clean up
    return () => {
      clearTimeout(resizeTimeoutId);
      window.removeEventListener('resize', debouncedCalculate);
      observer.disconnect();
    };
  }, []); // Empty dependency array means this runs once on mount and cleans up on unmount


  // Initialize dimension values
  useEffect(() => {
    const initialValues: { [key: string]: string } = {};
    if (editedShape.parameters.width)
      initialValues.width = convertToDisplayUnit(
        editedShape.parameters.width
      ).toFixed(1);
    if (editedShape.parameters.height)
      initialValues.height = convertToDisplayUnit(
        editedShape.parameters.height
      ).toFixed(1);
    if (editedShape.parameters.depth)
      initialValues.depth = convertToDisplayUnit(
        editedShape.parameters.depth
      ).toFixed(1);
    if (editedShape.parameters.radius)
      initialValues.radius = convertToDisplayUnit(
        editedShape.parameters.radius
      ).toFixed(1);
    setDimensionValues(initialValues);
    setHasUnsavedChanges(false);
  }, [editedShape, convertToDisplayUnit]);

  const handleDimensionChange = (dimensionType: string, value: string) => {
    setDimensionValues((prev) => ({
      ...prev,
      [dimensionType]: value,
    }));
    setHasUnsavedChanges(true);
  };

  const handleDimensionSubmit = async (dimensionType: string) => {
    const value = parseFloat(dimensionValues[dimensionType]);
    if (isNaN(value) || value <= 0) {
      console.log('Invalid dimension value');
      return;
    }

    const valueInMm = convertToBaseUnit(value);
    const newParameters = { ...editedShape.parameters };
    newParameters[dimensionType] = valueInMm;

    let newGeometry;
    if (editedShape.type === 'box') {
      const THREE = await import('three');
      newGeometry = new THREE.BoxGeometry(
        newParameters.width || 500,
        newParameters.height || 500,
        newParameters.depth || 500
      );
    } else if (editedShape.type === 'cylinder') {
      const THREE = await import('three');
      newGeometry = new THREE.CylinderGeometry(
        newParameters.radius || 250,
        newParameters.radius || 250,
        newParameters.height || 500,
        32
      );
    } else {
      console.log('Dimension editing not supported for this shape type');
      return;
    }

    updateShape(editedShape.id, {
      parameters: newParameters,
      geometry: newGeometry,
    });

    setHasUnsavedChanges(false);
    console.log(
      `Updated ${dimensionType} to ${value} ${measurementUnit} (${valueInMm}mm)`
    );
  };

  const handleSaveAll = async () => {
    // Apply all pending changes
    for (const [dimensionType, value] of Object.entries(dimensionValues)) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue > 0) {
        await handleDimensionSubmit(dimensionType);
      }
    }
    setHasUnsavedChanges(false);
    console.log('All changes saved');
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      // NOTE: Using a custom modal or confirmation UI is recommended instead of window.confirm in production.
      const confirmClose = window.confirm(
        'You have unsaved changes. Are you sure you want to exit edit mode?'
      );
      if (!confirmClose) return;
    }
    setActiveComponent(null);
    setIsAddPanelMode(false);
    setIsPanelEditMode(false); // 🔴 NEW: Reset panel edit mode
    onExit();
  };

  const handleComponentClick = (componentType: string) => {
    // Toggle component mode
    if (activeComponent === componentType) {
      setActiveComponent(null);
      setIsAddPanelMode(false);
      setIsPanelEditMode(false); // 🔴 NEW: Reset panel edit mode
      console.log(`${componentType} mode deactivated`);
    } else {
      setActiveComponent(componentType);

      // Special handling for different component types
      if (componentType === 'panels') {
        setIsAddPanelMode(true);
        setIsPanelEditMode(false);
        console.log('Panel mode activated - Click on faces to add panels');
      } else if (componentType === 'panel-edit') {
        // 🔴 NEW: Panel Edit Mode
        setIsAddPanelMode(false);
        setIsPanelEditMode(true);
        console.log('Panel Edit mode activated - Click on panels to edit them');
      } else {
        setIsAddPanelMode(false);
        setIsPanelEditMode(false);
        console.log(`${componentType} mode activated`);
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

  const renderDimensionField = (label: string, dimensionType: string) => {
    const value =
      dimensionValues[dimensionType] ||
      convertToDisplayUnit(editedShape.parameters[dimensionType] || 0).toFixed(
        1
      );

    return (
      <div className="flex items-center gap-1.5 h-5">
        <span className="text-gray-300 text-xs font-medium w-10 flex-shrink-0">
          {label}:
        </span>
        <input
          type="number"
          value={value}
          onChange={(e) => handleDimensionChange(dimensionType, e.target.value)}
          className="flex-1 bg-gray-700/50 text-white text-xs px-1.5 py-0.5 rounded border border-gray-600/50 focus:outline-none focus:border-blue-500/50 min-w-0"
          step="0.1"
          min="0.1"
        />
        <span className="text-gray-400 text-xs w-6 flex-shrink-0 text-center">
          {measurementUnit}
        </span>
        <button
          onClick={() => handleDimensionSubmit(dimensionType)}
          className="p-0.5 bg-blue-600/90 hover:bg-blue-500 text-white rounded transition-colors flex-shrink-0"
          title="Apply"
        >
          <Check size={10} />
        </button>
      </div>
    );
  };

  // 🎯 ICON-ONLY furniture component buttons configuration
  const furnitureComponents = [
    {
      id: 'panels',
      icon: <Layers size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'blue',
      description: 'Add Panels - Click faces to add panels',
    },
    {
      id: 'panel-edit',
      icon: <Edit3 size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'red',
      description: 'Panel Edit - Click panels to edit dimensions',
    },
    {
      id: 'shelves',
      icon: <Shelf size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'green',
      description: 'Add Shelves - Add horizontal shelves',
    },
    {
      id: 'backs',
      icon: <Package size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'purple',
      description: 'Add Backs - Add back panels',
    },
    {
      id: 'doors',
      icon: <DoorOpen size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'orange',
      description: 'Add Doors - Add cabinet doors',
    },
    {
      id: 'edgeband',
      icon: <RectangleHorizontal size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'amber',
      description: 'Add Edgeband - Add edge banding',
    },
    {
      id: 'drawer',
      icon: <Minus size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'indigo',
      description: 'Add Drawer - Add drawers',
    },
    {
      id: 'hinge',
      icon: <Zap size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'cyan',
      description: 'Add Hinge - Add hinges',
    },
    {
      id: 'divider',
      icon: <Grid3X3 size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'pink',
      description: 'Add Divider - Add dividers',
    },
    {
      id: 'notch',
      icon: <Scissors size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'teal',
      description: 'Add Notch - Add notches',
    },
    {
      id: 'accessories',
      icon: <Settings size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'slate',
      description: 'Add Accessories - Add hardware & accessories',
    },
    {
      id: 'local-params',
      icon: <Sliders size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'emerald',
      description: 'Local Parameters - Edit local parameters',
    },
  ];

  const getIconButtonColorClasses = (color: string, isActive: boolean) => {
    // Updated for horizontal layout with text
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
        default:
          return `${baseClasses} bg-gray-600/90 text-white shadow-lg shadow-gray-500/25 border border-gray-400/30`;
      }
    } else {
      // Pasif durum için genel gri renk teması
      return `${baseClasses} bg-gray-800/50 text-gray-300 hover:bg-gray-600/50 border border-gray-500/30 hover:border-gray-400/50`;
    }
  };

  const closeWindow = (windowId: string) => {
    setOpenWindows(prev => prev.filter(window => window.id !== windowId));
  };

  const updateWindowPosition = (windowId: string, position: { x: number; y: number }) => {
    setOpenWindows(prev => prev.map(window => 
      window.id === windowId ? { ...window, position } : window
    ));
  };

  const renderWindowContent = (componentType: string) => {
    // Placeholder for window content rendering
    return <div>Content for {componentType}</div>;
  };

  // Collapsed state - thin strip on the left
  if (isCollapsed) {
    return (
      <div
        className="fixed left-0 z-50 w-6 bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50 shadow-lg flex flex-col"
        style={{
          top: panelTop,
          height: panelHeight,
        }}
      >
        {/* Expand button */}
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex-1 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
          title="Expand Edit Panel"
        >
          <ChevronRight size={14} />
        </button>

        {/* Vertical text indicator */}
        <div className="flex-1 flex items-center justify-center">
          <div className="transform -rotate-90 text-xs text-gray-500 font-medium whitespace-nowrap">
            EDIT
          </div>
        </div>
      </div>
    );
  }

  return (
    <>
      {/* Main Edit Panel - Made narrower */}
      <div
        className="fixed left-0 z-50 w-92 bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50 shadow-lg flex flex-col"
        style={{
          top: panelTop,
          height: panelHeight,
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-3 py-2 bg-gray-700/50 border-b border-gray-600/50 flex-shrink-0">
          <div className="flex items-center gap-2">
            {getShapeIcon()}
            <span className="text-white text-sm font-medium">
              {editedShape.type.charAt(0).toUpperCase() +
                editedShape.type.slice(1)}
            </span>
            {hasUnsavedChanges && (
              <div
                className="w-2 h-2 bg-orange-500 rounded-full"
                title="Unsaved changes"
              />
            )}
          </div>

          {/* Header buttons */}
          <div className="flex items-center gap-1">
            {/* Save button */}
            <button
              onClick={handleSaveAll}
              disabled={!hasUnsavedChanges}
              className={`p-1 rounded transition-colors ${
                hasUnsavedChanges
                  ? 'text-green-400 hover:text-green-300 hover:bg-gray-600/50'
                  : 'text-gray-600 cursor-not-allowed'
              }`}
              title="Save All Changes"
            >
              <Save size={14} />
            </button>

            {/* Display Mode Toggle */}
            <button
              onClick={() => setButtonDisplayMode(prev => prev === 'text' ? 'icon' : 'text')}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              title={buttonDisplayMode === 'text' ? 'Switch to Icon Mode' : 'Switch to Text Mode'}
            >
              {buttonDisplayMode === 'text' ? <Hash size={14} /> : <Sliders size={14} />}
            </button>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors"
              title="Exit Edit Mode"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content - Split into left (buttons) and right (dimensions/other) */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* New Component Menu Bar (Left Side) - Expanded with descriptions */}
          <div className={`flex flex-col ${buttonDisplayMode === 'icon' ? 'w-14' : 'w-40'} bg-gray-700/50 border-r border-gray-600/50 flex-shrink-0 py-2 overflow-y-auto transition-all duration-300`} style={{ scrollbarWidth: 'thin' }}>
            {editedShape.type === 'box' && (
              <div className={`flex flex-col gap-1 ${buttonDisplayMode === 'icon' ? 'px-1' : 'px-2'}`}>
                {furnitureComponents.map((component) => {
                  const isActive = activeComponent === component.id;
                  return (
                    <button
                      key={component.id}
                      onClick={() => handleComponentClick(component.id)}
                      className={`${getIconButtonColorClasses(component.color, isActive)} w-full ${
                        buttonDisplayMode === 'icon' 
                          ? 'justify-center p-2' 
                          : 'justify-start gap-2 px-2 py-1.5 text-left'
                      }`}
                      title={component.description}
                    >
                      <div className={buttonDisplayMode === 'icon' ? '' : 'flex-shrink-0'}>
                        {component.icon}
                      </div>
                      {buttonDisplayMode === 'text' && (
                        <span className="text-xs font-medium truncate">
                          {component.id === 'panels' && 'Panels'}
                          {component.id === 'panel-edit' && 'Edit Panel'}
                          {component.id === 'shelves' && 'Shelves'}
                          {component.id === 'backs' && 'Backs'}
                          {component.id === 'doors' && 'Doors'}
                          {component.id === 'edgeband' && 'Edgeband'}
                          {component.id === 'drawer' && 'Drawer'}
                          {component.id === 'hinge' && 'Hinge'}
                          {component.id === 'divider' && 'Divider'}
                          {component.id === 'notch' && 'Notch'}
                          {component.id === 'accessories' && 'Accessories'}
                          {component.id === 'local-params' && 'Parameters'}
                          {component.id === 'module' && 'Modül'}
                        </span>
                      )}
                      {isActive && (
                        <div className={`absolute ${buttonDisplayMode === 'icon' ? 'top-1 right-1' : 'top-0 right-0'} w-3 h-3 bg-white rounded-full flex items-center justify-center`}>
                          <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Right Content Area (Dimensions and other sections) */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* 🎯 COMPACT Dimensions Section */}
            <div className="p-2 flex-shrink-0">
              <h3 className="text-gray-300 text-xs font-medium mb-2 border-b border-gray-600/30 pb-1">
                Dimensions
              </h3>
              <div className="space-y-2">
                {editedShape.type === 'box' && (
                  <>
                    {renderDimensionField('W', 'width')}
                    {renderDimensionField('H', 'height')}
                    {renderDimensionField('D', 'depth')}
                  </>
                )}

                {editedShape.type === 'cylinder' && (
                  <>
                    {renderDimensionField('R', 'radius')}
                    {renderDimensionField('H', 'height')}
                  </>
                )}
              </div>
            </div>

            {/* Placeholder for other content if needed, fills remaining vertical space */}
            <div className="flex-1"></div>
          </div>
        </div>

        {/* Footer - Always at bottom */}
        <div className="flex-shrink-0 p-2 border-t border-gray-600/30 bg-gray-700/30">
          <div className="text-xs text-gray-400 text-center">
            Edit mode - Other objects are hidden
          </div>
          {hasUnsavedChanges && (
            <div className="text-xs text-orange-400 text-center mt-1">
              You have unsaved changes
            </div>
          )}
          {activeComponent === 'panels' && (
            <div className="text-xs text-green-400 text-center mt-1">
              Click on faces to add panels
            </div>
          )}
          {activeComponent === 'panel-edit' && (
            <div className="text-xs text-red-400 text-center mt-1">
              🔴 Click on panels to edit them
            </div>
          )}
          {activeComponent === 'module' && (
            <div className="text-xs text-violet-400 text-center mt-1">
              Module information window opened
            </div>
          )}
          {activeComponent &&
            !['panels', 'panel-edit', 'module'].includes(activeComponent) && (
              <div className="text-xs text-blue-400 text-center mt-1">
                {activeComponent.charAt(0).toUpperCase()}
                {activeComponent.slice(1)} mode active
              </div>
            )}
        </div>
      </div>

      {/* Draggable Windows */}
      {openWindows.map((window) => (
        <DraggableWindow
          key={window.id}
          id={window.id}
          title={window.title}
          position={window.position}
          size={window.size}
          onClose={() => closeWindow(window.id)}
          onPositionChange={(position) => updateWindowPosition(window.id, position)}
        >
          {renderWindowContent(window.component)}
        </DraggableWindow>
      ))}
    </>
  );
};

export default EditModePanel;
