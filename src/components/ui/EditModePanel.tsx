import React, { useState, useEffect } from 'react';
import {
  Minimize2,
  Maximize,
  ChevronUp, // Boyut panelini daraltmak için
  ChevronDown, // Boyut panelini genişletmek için
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
import * as THREE from 'three'; // THREE'yi içe aktardık

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
  // const [isCollapsed, setIsCollapsed] = useState(false); // Kaldırıldı: Sola kaydırarak gizlemeyi kontrol eder
  const [panelHeight, setPanelHeight] = useState('calc(100vh - 108px)'); // Varsayılan yükseklik
  const [panelTop, setPanelTop] = useState('88px'); // Varsayılan üst pozisyon
  const [panelTopValue, setPanelTopValue] = useState(88); // Hesaplamalar için sayısal üst pozisyon
  const [panelHeightValue, setPanelHeightValue] = useState(0); // Hesaplamalar için sayısal yükseklik
  const [activeComponent, setActiveComponent] = useState<string | null>(null);

  // Window management
  interface OpenWindow {
    id: string;
    title: string;
    component: string;
    position: { x: number; y: number };
    size: { width: number; height: number };
  }

  const [openWindows, setOpenWindows] = useState<OpenWindow[]>([]);
  const [isCollapsed, setIsCollapsed] = useState(false); // Tek collapse kontrolü

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


  const handleClose = () => {
    setActiveComponent(null);
    setIsAddPanelMode(false);
    setIsPanelEditMode(false); // Panel düzenleme modunu sıfırlar
    setOpenWindows([]); // Tüm pencereleri kapat
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
      } else if (componentType === 'module') {
        // Modül penceresi aç
        const newWindow: OpenWindow = {
          id: 'module-window',
          title: 'Modül Bilgileri',
          component: 'module',
          position: { x: 400, y: 100 },
          size: { width: 350, height: 400 }
        };
        setOpenWindows(prev => {
          // Eğer zaten açıksa, kapat
          const existing = prev.find(w => w.id === 'module-window');
          if (existing) {
            return prev.filter(w => w.id !== 'module-window');
          }
          // Yoksa aç
          return [...prev, newWindow];
        });
        console.log('Modül bilgi penceresi açıldı');
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
      id: 'module',
      icon: <Puzzle size={12} />,
      color: 'violet',
      description: 'Modül Bilgileri - Boyutları ve özellikleri görüntüle',
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
        case 'violet':
          return `${baseClasses} bg-violet-600/90 text-white shadow-lg shadow-violet-500/25 border border-violet-400/30`;
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
    if (componentType === 'module') {
      return <ModuleWindow editedShape={editedShape} />;
    }
    return <div className="p-4 text-gray-300">{componentType} İçeriği</div>;
  };

  // Panel genişliğini duruma göre belirler
  const getPanelWidthClass = () => {
    // Collapsed mod kontrolü
    if (isCollapsed) {
      return 'w-8'; // Ultra dar - sadece collapse düğmesi
    }
    
    // Normal mod - sadece buton modu
    return 'w-48';
  };

  return (
    <>
      {/* Ana Düzenleme Paneli */}
      <div
        className={`fixed left-0 z-50 ${getPanelWidthClass()} bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50 shadow-lg flex flex-col
          transition-all duration-300 ease-in-out`}
        style={{
          top: panelTop,
          height: panelHeight,
        }}
      >
        {/* Başlık */}
        <div className={`flex items-center justify-between px-3 py-2 bg-gray-700/50 border-b border-gray-600/50 flex-shrink-0 ${isCollapsed ? 'hidden' : ''}`}>
          <div className="flex items-center gap-2">
            {getShapeIcon()}
            <span className="text-white text-sm font-medium">
              {editedShape.type.charAt(0).toUpperCase() +
                editedShape.type.slice(1)}
            </span>
          </div>

          {/* Başlık butonları */}
          <div className="flex items-center gap-1">
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

        {/* Collapse Düğmesi - Collapsed modda görünür */}
        {isCollapsed && (
          <div className="flex items-center justify-center p-2 h-full">
            <button
              onClick={() => setIsCollapsed(false)}
              className="text-gray-400 hover:text-white p-2 rounded transition-colors hover:bg-gray-700/50"
              title="Paneli Genişlet"
            >
              <ChevronRight size={16} />
            </button>
          </div>
        )}

        {/* İçerik - Sol (butonlar) ve Sağ (boyutlar/diğer) olarak bölünmüş */}
        <div className={`flex-1 flex flex-row overflow-hidden ${isCollapsed ? 'hidden' : ''}`}>
          {/* Bileşen Menü Çubuğu - Tam genişlik */}
          <div className="flex flex-col w-full bg-gray-700/50 flex-shrink-0 py-2 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
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
                        {React.cloneElement(component.icon, { size: 12 })}
                      </div>
                      <span className="text-xs font-medium truncate">
                        {component.id === 'panels' && 'Paneller'}
                        {component.id === 'panel-edit' && 'Panel Düzenle'}
                        {component.id === 'module' && 'Modül'}
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
        </div>

        {/* Alt Bilgi - Her zaman altta */}
        <div className={`flex-shrink-0 p-2 border-t border-gray-600/30 bg-gray-700/30 ${isCollapsed ? 'hidden' : ''}`}>
          {/* Collapse düğmesi */}
          <div className="flex justify-end mb-2">
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              title="Arayüzü Küçült"
            >
              <ChevronLeft size={12} />
            </button>
          </div>
          
          <div className="text-xs text-gray-400 text-center">
            Düzenleme modu - Diğer nesneler gizli
          </div>
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

      {/* Daraltılmış panel için yeni düğme - artık kullanılmıyor */}
      {/* {isCollapsed && (
        <button
          onClick={() => setIsCollapsed(false)} // Genişletmek için false yapar
          className="fixed left-0 z-50 w-6 h-12 flex items-center justify-center bg-gray-800/95 backdrop-blur-sm border-r border-gray-700/50 shadow-lg text-gray-400 hover:text-white hover:bg-gray-700/50 transition-colors rounded-r"
          title="Düzenleme Panelini Genişlet"
          style={{ top: `${panelTopValue + panelHeightValue / 2 - 24}px` }} // Panelin alanına göre dikeyde ortalar
        >
          <ChevronRight size={14} />
        </button>
      )} */}

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

      {/* Yeni PanelEditor modalı */}
    </>
  );
};

export default EditModePanel;
