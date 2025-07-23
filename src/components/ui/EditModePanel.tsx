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
import { PanelEditor } from './PanelEditor'; // PanelEditor'ı içe aktardık

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

  const {
    measurementUnit,
    convertToDisplayUnit,
    convertToBaseUnit,
    updateShape,
  } = useAppStore();

  // Helper function to generate a unique ID for windows
  const generateUniqueId = () => `window-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

  // Function to close a draggable window
  const closeWindow = (idToClose: string) => {
    setOpenWindows(prevWindows => prevWindows.filter(win => win.id !== idToClose));
  };

  // Function to update the position of a draggable window
  const updateWindowPosition = (idToUpdate: string, newPosition: { x: number; y: number }) => {
    setOpenWindows(prevWindows =>
      prevWindows.map(win =>
        win.id === idToUpdate ? { ...win, position: newPosition } : win
      )
    );
  };

  // Function to render content inside a draggable window
  const renderWindowContent = (componentType: string) => {
    switch (componentType) {
      case 'panel-editor':
        // PanelEditor, düzenlenmekte olan şekli ve updateShape fonksiyonunu almalı
        return <PanelEditor shape={editedShape} onUpdate={updateShape} />;
      // Gelecekte başka bileşenler eklenirse buraya case'ler eklenebilir
      default:
        return (
          <div className="p-4 text-gray-300">
            <p>İçerik ({componentType}) henüz uygulanmadı.</p>
          </div>
        );
    }
  };

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
      // window.confirm yerine console.warn kullandık
      console.warn('Kaydedilmemiş değişiklikleriniz var. Kaydetmeden düzenleme modundan çıkılıyor.');
      // Eğer özel bir modal isteniyorsa, buraya implemente edilmelidir.
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
      // Bileşen modu devre dışı bırakıldığında tüm açık pencereleri kapat
      setOpenWindows([]);
    } else {
      setActiveComponent(componentType);

      // Special handling for different component types
      if (componentType === 'panels') {
        setIsAddPanelMode(true);
        setIsPanelEditMode(false);
        console.log('Panel mode activated - Click on faces to add panels');
        setOpenWindows([]); // Panel ekleme moduna girerken diğer pencereleri kapat
      } else if (componentType === 'panel-edit') {
        // 🔴 NEW: Panel Edit Mode - PanelEditor için yeni bir DraggableWindow aç
        setIsAddPanelMode(false);
        setIsPanelEditMode(true);
        console.log('Panel Edit mode activated - Click on panels to edit them');
        // Mevcut düzenlenmekte olan şekil için bir PanelEditor penceresi zaten var mı kontrol et
        const existingPanelEditorWindow = openWindows.find(
          (win) => win.component === 'panel-editor' && win.id.includes(editedShape.id)
        );

        if (!existingPanelEditorWindow) {
          // PanelEditor için yeni bir pencere aç
          setOpenWindows(prevWindows => [
            ...prevWindows,
            {
              id: generateUniqueId() + '-' + editedShape.id, // Bu belirli şeklin düzenleyicisi için benzersiz kimlik
              title: `Paneli Düzenle: ${editedShape.id}`,
              component: 'panel-editor',
              position: { x: window.innerWidth / 2 - 200, y: window.innerHeight / 2 - 150 }, // Ekranın ortası
              size: { width: 400, height: 300 },
            },
          ]);
        }
      } else {
        setIsAddPanelMode(false);
        setIsPanelEditMode(false);
        console.log(`${componentType} mode activated`);
        setOpenWindows([]); // Diğer modlar için diğer pencereleri kapat
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
          title="Uygula"
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
      description: 'Paneller Ekle - Panel eklemek için yüzeylere tıklayın',
    },
    {
      id: 'panel-edit',
      icon: <Edit3 size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'red',
      description: 'Panel Düzenle - Boyutları düzenlemek için panellere tıklayın',
    },
    {
      id: 'shelves',
      icon: <Shelf size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'green',
      description: 'Raflar Ekle - Yatay raflar ekleyin',
    },
    {
      id: 'backs',
      icon: <Package size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'purple',
      description: 'Arka Paneller Ekle - Arka paneller ekleyin',
    },
    {
      id: 'doors',
      icon: <DoorOpen size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'orange',
      description: 'Kapılar Ekle - Dolap kapıları ekleyin',
    },
    {
      id: 'edgeband',
      icon: <RectangleHorizontal size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'amber',
      description: 'Kenar Bandı Ekle - Kenar bandı ekleyin',
    },
    {
      id: 'drawer',
      icon: <Minus size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'indigo',
      description: 'Çekmece Ekle - Çekmeceler ekleyin',
    },
    {
      id: 'hinge',
      icon: <Zap size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'cyan',
      description: 'Menteşe Ekle - Menteşeler ekleyin',
    },
    {
      id: 'divider',
      icon: <Grid3X3 size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'pink',
      description: 'Bölücü Ekle - Bölücüler ekleyin',
    },
    {
      id: 'notch',
      icon: <Scissors size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'teal',
      description: 'Çentik Ekle - Çentikler ekleyin',
    },
    {
      id: 'accessories',
      icon: <Settings size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'slate',
      description: 'Aksesuarlar Ekle - Donanım ve aksesuarlar ekleyin',
    },
    {
      id: 'local-params',
      icon: <Sliders size={12} />, // İkon boyutu 12 olarak ayarlandı
      color: 'emerald',
      description: 'Yerel Parametreler - Yerel parametreleri düzenleyin',
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
          title="Paneli Genişlet"
        >
          <ChevronRight size={14} />
        </button>

        {/* Vertical text indicator */}
        <div className="flex-1 flex items-center justify-center">
          <div className="transform -rotate-90 text-xs text-gray-500 font-medium whitespace-nowrap">
            DÜZENLE
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
                title="Kaydedilmemiş değişiklikler var"
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
              title="Tüm Değişiklikleri Kaydet"
            >
              <Save size={14} />
            </button>

            {/* Collapse button */}
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              title="Paneli Daralt"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Close button */}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors"
              title="Düzenleme Modundan Çık"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* Content - Split into left (buttons) and right (dimensions/other) */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* New Component Menu Bar (Left Side) - Expanded with descriptions */}
          <div className="flex flex-col w-70 bg-gray-700/50 border-r border-gray-600/50 flex-shrink-0 py-2 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {editedShape.type === 'box' && (
              <div className="flex flex-col gap-1 px-2">
                {furnitureComponents.map((component) => {
                  const isActive = activeComponent === component.id;
                  return (
                    <button
                      key={component.id}
                      onClick={() => handleComponentClick(component.id)}
                      className={`${getIconButtonColorClasses(component.color, isActive)} w-full justify-start gap-2 px-2 py-1.5 text-left`}
                      title={component.description}
                    >
                      <div className="flex-shrink-0">
                        {component.icon}
                      </div>
                      <span className="text-xs font-medium truncate">
                        {component.id === 'panels' && 'Paneller'}
                        {component.id === 'panel-edit' && 'Paneli Düzenle'}
                        {component.id === 'shelves' && 'Raflar'}
                        {component.id === 'backs' && 'Arka Paneller'}
                        {component.id === 'doors' && 'Kapılar'}
                        {component.id === 'edgeband' && 'Kenar Bandı'}
                        {component.id === 'drawer' && 'Çekmece'}
                        {component.id === 'hinge' && 'Menteşe'}
                        {component.id === 'divider' && 'Bölücü'}
                        {component.id === 'notch' && 'Çentik'}
                        {component.id === 'accessories' && 'Aksesuarlar'}
                        {component.id === 'local-params' && 'Parametreler'}
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
            )}
          </div>

          {/* Right Content Area (Dimensions and other sections) */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* 🎯 COMPACT Dimensions Section */}
            <div className="p-2 flex-shrink-0">
              <h3 className="text-gray-300 text-xs font-medium mb-2 border-b border-gray-600/30 pb-1">
                Boyutlar
              </h3>
              <div className="space-y-2">
                {editedShape.type === 'box' && (
                  <>
                    {renderDimensionField('G', 'width')}
                    {renderDimensionField('Y', 'height')}
                    {renderDimensionField('D', 'depth')}
                  </>
                )}

                {editedShape.type === 'cylinder' && (
                  <>
                    {renderDimensionField('R', 'radius')}
                    {renderDimensionField('Y', 'height')}
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
            Düzenleme modu - Diğer nesneler gizli
          </div>
          {hasUnsavedChanges && (
            <div className="text-xs text-orange-400 text-center mt-1">
              Kaydedilmemiş değişiklikleriniz var
            </div>
          )}
          {activeComponent === 'panels' && (
            <div className="text-xs text-green-400 text-center mt-1">
              Panel eklemek için yüzeylere tıklayın
            </div>
          )}
          {activeComponent === 'panel-edit' && (
            <div className="text-xs text-red-400 text-center mt-1">
              🔴 Panelleri düzenlemek için panellere tıklayın
            </div>
          )}
          {activeComponent === 'module' && (
            <div className="text-xs text-violet-400 text-center mt-1">
              Modül bilgi penceresi açıldı
            </div>
          )}
          {activeComponent &&
            !['panels', 'panel-edit', 'module'].includes(activeComponent) && (
              <div className="text-xs text-blue-400 text-center mt-1">
                {activeComponent.charAt(0).toUpperCase()}
                {activeComponent.slice(1)} modu aktif
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
          initialX={window.position.x} // initialX olarak position.x kullan
          initialY={window.position.y} // initialY olarak position.y kullan
          initialWidth={window.size.width} // initialWidth olarak size.width kullan
          initialHeight={window.size.height} // initialHeight olarak size.height kullan
          onClose={() => closeWindow(window.id)}
          onDrag={(x, y) => updateWindowPosition(window.id, { x, y })} // onDrag'i güncelle
          onResize={(width, height) => { /* Boyutları da güncelleyebilirsiniz */ }}
          minWidth={300}
          minHeight={200}
          className="bg-gray-800 border border-gray-700 shadow-lg rounded-lg flex flex-col"
        >
          {renderWindowContent(window.component)}
        </DraggableWindow>
      ))}
    </>
  );
};

export default EditModePanel;
