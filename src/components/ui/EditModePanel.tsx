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
  Minimize2,
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
  const [isCollapsed, setIsCollapsed] = useState(false); // Sola kaydırarak gizlemeyi kontrol eder
  const [isCompactMode, setIsCompactMode] = useState(false); // Kompakt mod için state (boyutları gizler)
  const [dimensionValues, setDimensionValues] = useState<{
    [key: string]: string;
  }>({});
  const [panelHeight, setPanelHeight] = useState('calc(100vh - 108px)'); // Varsayılan yükseklik
  const [panelTop, setPanelTop] = useState('88px'); // Varsayılan üst pozisyon
  const [panelTopValue, setPanelTopValue] = useState(88); // Hesaplamalar için sayısal üst pozisyon
  const [panelHeightValue, setPanelHeightValue] = useState(0); // Hesaplamalar için sayısal yükseklik
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [activeComponent, setActiveComponent] = useState<string | null>(null);
  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
  const [buttonDisplayMode, setButtonDisplayMode] = useState<'text' | 'icon'>('text'); // Butonların metin mi ikon mu olacağını kontrol eder

  const {
    measurementUnit,
    convertToDisplayUnit,
    convertToBaseUnit,
    updateShape,
  } = useAppStore();

  // Panel yüksekliğini dinamik olarak hesaplar - terminal ve durum çubuğuna duyarlı
  useEffect(() => {
    const calculatePanelPositionAndHeight = () => {
      // Araç çubuğu yüksekliğini dinamik olarak alır
      const toolbarElement =
        document.querySelector('.flex.flex-col.font-inter'); // Ana araç çubuğu kapsayıcısı
      const topOffset = toolbarElement ? toolbarElement.clientHeight : 88; // Bulunamazsa varsayılan 88px

      // Terminal ve Durum Çubuğu yüksekliğini dinamik olarak alır
      const terminalElement =
        document.querySelector('.fixed.bottom-0.left-0.right-0.z-30'); // Ana terminal kapsayıcısı
      const statusBarElement =
        document.querySelector('.flex.items-center.justify-between.h-5.px-2.text-xs.bg-gray-800\\/80'); // Durum çubuğuna özgü sınıf

      let bottomOffset = 0;

      if (terminalElement) {
        bottomOffset = terminalElement.clientHeight;
        console.log('Terminal height detected:', terminalElement.clientHeight);
      } else if (statusBarElement) {
        // Terminal bulunamazsa durum çubuğu yedeği
        bottomOffset = statusBarElement.clientHeight;
        console.log('Status bar height detected:', statusBarElement.clientHeight);
      } else {
        bottomOffset = 20; // Hiçbir şey bulunamazsa varsayılan durum çubuğu yüksekliği
      }

      const availableHeight = window.innerHeight - topOffset - bottomOffset;
      const newHeight = Math.max(availableHeight, 200); // Minimum 200px
      const newTop = topOffset;

      setPanelHeight(`${newHeight}px`);
      setPanelTop(`${newTop}px`);
      setPanelHeightValue(newHeight); // Sayısal değeri günceller
      setPanelTopValue(newTop); // Sayısal değeri günceller

      console.log('Panel position and height calculated:', {
        windowHeight: window.innerHeight,
        topOffset,
        bottomOffset,
        availableHeight,
        newHeight,
        newTop,
      });
    };

    // İlk hesaplama
    calculatePanelPositionAndHeight();

    // Yeniden boyutlandırma olayları için gecikmeli hesaplama fonksiyonu
    let resizeTimeoutId: NodeJS.Timeout;
    const debouncedCalculate = () => {
      clearTimeout(resizeTimeoutId);
      resizeTimeoutId = setTimeout(calculatePanelPositionAndHeight, 50);
    };

    // Pencere yeniden boyutlandırma olay dinleyicisi
    window.addEventListener('resize', debouncedCalculate);

    // DOM değişikliklerini izlemek için MutationObserver (terminal genişletme/daraltma gibi)
    const observer = new MutationObserver(debouncedCalculate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'], // Sınıf ve stil değişikliklerini izler
    });

    // Temizleme
    return () => {
      clearTimeout(resizeTimeoutId);
      window.removeEventListener('resize', debouncedCalculate);
      observer.disconnect();
    };
  }, []); // Boş bağımlılık dizisi, bu fonksiyonun sadece bağlandığında bir kez çalışıp ayrıldığında temizleneceği anlamına gelir


  // Boyut değerlerini başlatır
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
      console.log('Bu şekil tipi için boyut düzenleme desteklenmiyor');
      return;
    }

    updateShape(editedShape.id, {
      parameters: newParameters,
      geometry: newGeometry,
    });

    setHasUnsavedChanges(false);
    console.log(
      `${dimensionType} değeri ${value} ${measurementUnit} (${valueInMm}mm) olarak güncellendi`
    );
  };

  const handleSaveAll = async () => {
    // Tüm bekleyen değişiklikleri uygula
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
      // NOT: Üretim ortamında window.confirm yerine özel bir modal veya onay UI'ı kullanılması önerilir.
      // Bu örnek için, olduğu gibi window.confirm kullanmaya devam edeceğiz.
      const confirmClose = window.confirm(
        'Kaydedilmemiş değişiklikleriniz var. Düzenleme modundan çıkmak istediğinizden emin misiniz?'
      );
      if (!confirmClose) return;
    }
    setActiveComponent(null);
    setIsAddPanelMode(false);
    setIsPanelEditMode(false); // Panel düzenleme modunu sıfırlar
    onExit();
  };

  const handleComponentClick = (componentType: string) => {
    // Bileşen modunu değiştir
    if (activeComponent === componentType) {
      setActiveComponent(null);
      setIsAddPanelMode(false);
      setIsPanelEditMode(false); // Panel düzenleme modunu sıfırlar
      console.log(`${componentType} modu devre dışı bırakıldı`);
    } else {
      setActiveComponent(componentType);

      // Farklı bileşen tipleri için özel işlem
      if (componentType === 'panels') {
        setIsAddPanelMode(true);
        setIsPanelEditMode(false);
        console.log('Panel modu etkinleştirildi - Panel eklemek için yüzeylere tıklayın');
      } else if (componentType === 'panel-edit') {
        // Panel Düzenleme Modu
        setIsAddPanelMode(false);
        setIsPanelEditMode(true);
        console.log('Panel Düzenleme modu etkinleştirildi - Boyutları düzenlemek için panellere tıklayın');
      } else {
        setIsAddPanelMode(false);
        setIsPanelEditMode(false);
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

  // Mobilya bileşen butonları yapılandırması
  const furnitureComponents = [
    {
      id: 'panels',
      icon: <Layers size={12} />,
      color: 'blue',
      description: 'Panel Ekle - Panel eklemek için yüzeylere tıklayın',
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
      description: 'Raf Ekle - Yatay raflar ekleyin',
    },
    {
      id: 'backs',
      icon: <Package size={12} />,
      color: 'purple',
      description: 'Arkalık Ekle - Arka paneller ekleyin',
    },
    {
      id: 'doors',
      icon: <DoorOpen size={12} />,
      color: 'orange',
      description: 'Kapı Ekle - Dolap kapakları ekleyin',
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
      description: 'Aksesuar Ekle - Donanım ve aksesuarlar ekleyin',
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
    // Pencere içeriği oluşturma için yer tutucu
    return <div>{componentType} İçeriği</div>;
  };

  // Panel genişliğini duruma göre belirler
  const getPanelWidthClass = () => {
    if (isCompactMode) {
      // Boyutlar bölümü gizli ise
      if (buttonDisplayMode === 'icon') {
        return 'w-20'; // Çok dar, sadece ikonlar için
      } else {
        return 'w-48'; // Metinler için yeterli, boyutlar gizli
      }
    } else {
      // Boyutlar bölümü görünür ise (standart genişlik)
      return 'w-92';
    }
  };

  return (
    <>
      {/* Ana Düzenleme Paneli */}
      <div
        className={`fixed left-0 z-50 ${getPanelWidthClass()} bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50 shadow-lg flex flex-col
          transition-all duration-300 ease-in-out
          ${isCollapsed ? '-translate-x-full opacity-0 pointer-events-none' : 'translate-x-0 opacity-100 pointer-events-auto'}`}
        style={{
          top: panelTop,
          height: panelHeight,
        }}
      >
        {/* Başlık */}
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
                title="Kaydedilmemiş değişiklikler"
              />
            )}
          </div>

          {/* Başlık butonları */}
          <div className="flex items-center gap-1">
            {/* Kaydet butonu */}
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

            {/* Görüntü Modu Değiştirme (Metin/İkon) */}
            <button
              onClick={() => setButtonDisplayMode(prev => prev === 'text' ? 'icon' : 'text')}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              title={buttonDisplayMode === 'text' ? 'İkon Moduna Geç' : 'Metin Moduna Geç'}
            >
              {buttonDisplayMode === 'text' ? <Hash size={14} /> : <Sliders size={14} />}
            </button>

            {/* Kompakt Mod Değiştirme */}
            <button
              onClick={() => setIsCompactMode(prev => !prev)}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              title={isCompactMode ? 'Kompakt Moddan Çık' : 'Kompakt Moda Gir (Boyutları Gizle)'}
            >
              <Minimize2 size={14} />
            </button>

            {/* Daralt butonu - Paneli sola doğru gizler */}
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              title="Paneli Daralt"
            >
              <ChevronLeft size={14} />
            </button>

            {/* Kapat butonu - Düzenleme modundan tamamen çıkar */}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors"
              title="Düzenleme Modundan Çık"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        {/* İçerik - Sol (butonlar) ve Sağ (boyutlar/diğer) olarak bölünmüş */}
        <div className="flex-1 flex flex-row overflow-hidden">
          {/* Yeni Bileşen Menü Çubuğu (Sol Taraf) - Açıklamalarla genişletilmiş */}
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
                          {component.id === 'panels' && 'Paneller'}
                          {component.id === 'panel-edit' && 'Panel Düzenle'}
                          {component.id === 'shelves' && 'Raflar'}
                          {component.id === 'backs' && 'Arkalıklar'}
                          {component.id === 'doors' && 'Kapılar'}
                          {component.id === 'edgeband' && 'Kenar Bandı'}
                          {component.id === 'drawer' && 'Çekmece'}
                          {component.id === 'hinge' && 'Menteşe'}
                          {component.id === 'divider' && 'Bölücü'}
                          {component.id === 'notch' && 'Çentik'}
                          {component.id === 'accessories' && 'Aksesuarlar'}
                          {component.id === 'local-params' && 'Parametreler'}
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

          {/* Sağ İçerik Alanı (Boyutlar ve diğer bölümler) */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Kompakt Boyutlar Bölümü - isCompactMode true ise tamamen gizlenir */}
            {!isCompactMode && (
              <div className="p-2 flex-shrink-0">
                <h3 className="text-gray-300 text-xs font-medium mb-2 border-b border-gray-600/30 pb-1">
                  Boyutlar
                </h3>
                <div className="space-y-2">
                  {editedShape.type === 'box' && (
                    <>
                      {renderDimensionField('G', 'width')} {/* Genişlik */}
                      {renderDimensionField('Y', 'height')} {/* Yükseklik */}
                      {renderDimensionField('D', 'depth')} {/* Derinlik */}
                    </>
                  )}

                  {editedShape.type === 'cylinder' && (
                    <>
                      {renderDimensionField('R', 'radius')} {/* Yarıçap */}
                      {renderDimensionField('Y', 'height')} {/* Yükseklik */}
                    </>
                  )}
                </div>
              </div>
            )}

            {/* Diğer içerikler için yer tutucu, kalan dikey alanı doldurur */}
            <div className="flex-1"></div>
          </div>
        </div>

        {/* Alt Bilgi - Her zaman altta */}
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

      {/* Daraltılmış panel için yeni düğme - sadece panel daraltıldığında görünür */}
      {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)} // Genişletmek için false yapar
          className="fixed left-0 z-50 w-6 h-12 flex items-center justify-center bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50 shadow-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors rounded-r"
          title="Düzenleme Panelini Genişlet"
          style={{ top: `${panelTopValue + panelHeightValue / 2 - 24}px` }} // Panelin alanına göre dikeyde ortalar
        >
          <ChevronRight size={14} />
        </button>
      )}

      {/* Sürüklenebilir Pencereler */}
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
