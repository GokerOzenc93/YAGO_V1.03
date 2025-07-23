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
import PanelEditor from './PanelEditor'; // Yeni PanelEditor'ı içe aktardık

// PanelData arayüzünü PanelEditor.tsx'ten kopyalıyoruz,
// çünkü bu bileşen de bu tip tanımına ihtiyaç duyabilir.
// Daha iyi bir yapı için bu tipin ortak bir yerde tanımlanması önerilir.
interface PanelData {
  faceIndex: number;
  position: THREE.Vector3;
  size: THREE.Vector3;
  panelOrder: number;
}


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
  // PanelEditor modalı için gerekli prop'lar
  selectedPanel: PanelData | null; // Dışarıdan seçili panel bilgisini alacak
  onPanelUpdate: (shapeId: string, faceIndex: number, updates: Partial<PanelData>) => void; // Panel güncelleme fonksiyonu
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
  selectedPanel, // Yeni prop
  onPanelUpdate, // Yeni prop
}) => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [dimensionValues, setDimensionValues] = useState<{
    [key: string]: string;
  }>({});
  const [panelHeight, setPanelHeight] = useState('calc(100vh - 108px)'); // Default height
  const [panelTop, setPanelTop] = useState('88px'); // Default top position
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeComponent, setActiveComponent] = useState<string | null>(null);

  // PanelEditor modalının görünürlüğünü kontrol eden state
  const [isPanelEditorModalOpen, setIsPanelEditorModalOpen] = useState(false);

  const {
    measurementUnit,
    convertToDisplayUnit,
    convertToBaseUnit,
    updateShape,
  } = useAppStore();

  // Calculate panel height dynamically - responsive to terminal and status bar
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
      const newHeight = `${Math.max(availableHeight, 200)}px`;
      const newTop = `${topOffset}px`;

      setPanelHeight(newHeight);
      setPanelTop(newTop);
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
      console.log('Geçersiz boyut değeri');
      return;
    }

    const valueInMm = convertToBaseUnit(value);
    const newParameters = { ...editedShape.parameters };
    newParameters[dimensionType] = valueInMm;

    let newGeometry;
    const THREE = await import('three'); // THREE'yi burada dinamik olarak içe aktarıyoruz

    if (editedShape.type === 'box') {
      newGeometry = new THREE.BoxGeometry(
        newParameters.width || 500,
        newParameters.height || 500,
        newParameters.depth || 500
      );
    } else if (editedShape.type === 'cylinder') {
      newGeometry = new THREE.CylinderGeometry(
        newParameters.radius || 250,
        newParameters.radius || 250,
        newParameters.height || 500,
        32
      );
    } else {
      console.log('Bu şekil tipi için boyut düzenleme desteklenmiyor');
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
    for (const [dimensionType, value] of Object.entries(dimensionValues)) {
      const numValue = parseFloat(value);
      if (!isNaN(numValue) && numValue > 0) {
        await handleDimensionSubmit(dimensionType);
      }
    }
    setHasUnsavedChanges(false);
    console.log('Tüm değişiklikler kaydedildi');
  };

  const handleClose = () => {
    if (hasUnsavedChanges) {
      console.warn('Kaydedilmemiş değişiklikleriniz var. Kaydetmeden düzenleme modundan çıkılıyor.');
    }
    setActiveComponent(null);
    setIsAddPanelMode(false);
    setIsPanelEditMode(false);
    setIsPanelEditorModalOpen(false); // Modal'ı da kapat
    onExit();
  };

  const handleComponentClick = (componentType: string) => {
    if (activeComponent === componentType) {
      setActiveComponent(null);
      setIsAddPanelMode(false);
      setIsPanelEditMode(false);
      setIsPanelEditorModalOpen(false); // Modu kapatırken modalı da kapat
      console.log(`${componentType} modu devre dışı bırakıldı`);
    } else {
      setActiveComponent(componentType);

      if (componentType === 'panels') {
        setIsAddPanelMode(true);
        setIsPanelEditMode(false);
        setIsPanelEditorModalOpen(false); // Panel ekleme moduna girerken modalı kapat
        console.log('Panel modu etkinleştirildi - Panel eklemek için yüzeylere tıklayın');
      } else if (componentType === 'panel-edit') {
        setIsAddPanelMode(false);
        setIsPanelEditMode(true);
        setIsPanelEditorModalOpen(true); // Panel düzenleme moduna girerken modalı aç
        console.log('Panel Düzenleme modu etkinleştirildi - Panelleri düzenlemek için panellere tıklayın');
      } else {
        setIsAddPanelMode(false);
        setIsPanelEditMode(false);
        setIsPanelEditorModalOpen(false); // Diğer modlar için modalı kapat
        console.log(`${componentType} modu etkinleştirildi`);
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

  const furnitureComponents = [
    {
      id: 'panels',
      icon: <Layers size={12} />,
      color: 'blue',
      description: 'Paneller Ekle - Panel eklemek için yüzeylere tıklayın',
    },
    {
      id: 'panel-edit',
      icon: <Edit3 size={12} />,
      color: 'red',
      description: 'Panel Düzenle - Boyutları düzenlemek için panellere tıklayın',
    },
    {
      id: 'shelves',
      icon: <Shelf size={12} />,
      color: 'green',
      description: 'Raflar Ekle - Yatay raflar ekleyin',
    },
    {
      id: 'backs',
      icon: <Package size={12} />,
      color: 'purple',
      description: 'Arka Paneller Ekle - Arka paneller ekleyin',
    },
    {
      id: 'doors',
      icon: <DoorOpen size={12} />,
      color: 'orange',
      description: 'Kapılar Ekle - Dolap kapıları ekleyin',
    },
    {
      id: 'edgeband',
      icon: <RectangleHorizontal size={12} />,
      color: 'amber',
      description: 'Kenar Bandı Ekle - Kenar bandı ekleyin',
    },
    {
      id: 'drawer',
      icon: <Minus size={12} />,
      color: 'indigo',
      description: 'Çekmece Ekle - Çekmeceler ekleyin',
    },
    {
      id: 'hinge',
      icon: <Zap size={12} />,
      color: 'cyan',
      description: 'Menteşe Ekle - Menteşeler ekleyin',
    },
    {
      id: 'divider',
      icon: <Grid3X3 size={12} />,
      color: 'pink',
      description: 'Bölücü Ekle - Bölücüler ekleyin',
    },
    {
      id: 'notch',
      icon: <Scissors size={12} />,
      color: 'teal',
      description: 'Çentik Ekle - Çentikler ekleyin',
    },
    {
      id: 'accessories',
      icon: <Settings size={12} />,
      color: 'slate',
      description: 'Aksesuarlar Ekle - Donanım ve aksesuarlar ekleyin',
    },
    {
      id: 'local-params',
      icon: <Sliders size={12} />,
      color: 'emerald',
      description: 'Yerel Parametreler - Yerel parametreleri düzenleyin',
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
        default:
          return `${baseClasses} bg-gray-600/90 text-white shadow-lg shadow-gray-500/25 border border-gray-400/30`;
      }
    } else {
      return `${baseClasses} bg-gray-800/50 text-gray-300 hover:bg-gray-600/50 border border-gray-500/30 hover:border-gray-400/50`;
    }
  };

  if (isCollapsed) {
    return (
      <div
        className="fixed left-0 z-50 w-6 bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50 shadow-lg flex flex-col"
        style={{
          top: panelTop,
          height: panelHeight,
        }}
      >
        <button
          onClick={() => setIsCollapsed(false)}
          className="flex-1 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors"
          title="Paneli Genişlet"
        >
          <ChevronRight size={14} />
        </button>

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
      <div
        className="fixed left-0 z-50 w-92 bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50 shadow-lg flex flex-col"
        style={{
          top: panelTop,
          height: panelHeight,
        }}
      >
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

          <div className="flex items-center gap-1">
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

            <button
              onClick={() => setIsCollapsed(true)}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              title="Paneli Daralt"
            >
              <ChevronLeft size={14} />
            </button>

            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors"
              title="Düzenleme Modundan Çık"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div className="flex-1 flex flex-row overflow-hidden">
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

          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
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

            <div className="flex-1"></div>
          </div>
        </div>

        <div className="px-4 py-2 bg-gray-700/30 border-t border-gray-600/30">
          <div className="text-xs text-gray-400 text-center">
            Düzenleme modu - Diğer nesneler gizli
          </div>
          {hasUnsavedChanges && (
            <div className="text-xs text-orange-400 mt-1">
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

      {/* Yeni PanelEditor modalı */}
      {isPanelEditorModalOpen && (
        <PanelEditor
          isOpen={isPanelEditorModalOpen}
          onClose={() => setIsPanelEditorModalOpen(false)}
          selectedPanel={selectedPanel} // Bu prop'un dışarıdan doğru bir panel ile beslenmesi gerekecek
          onPanelUpdate={onPanelUpdate} // Bu prop'un dışarıdan panel güncelleme mantığı ile beslenmesi gerekecek
          editingShapeId={editedShape.id}
        />
      )}
    </>
  );
};

export default EditModePanel;
