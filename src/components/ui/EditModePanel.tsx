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

        {/* Modül Bilgileri - Panelin altında genişletilir */}
        {activeComponent === 'module' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <ModuleExpandedSection editedShape={editedShape} />
          </div>
        )}

        {/* Paneller Bölümü */}
        {activeComponent === 'panels' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <PanelsExpandedSection selectedFaces={selectedFaces} />
          </div>
        )}

        {/* Panel Düzenleme Bölümü */}
        {activeComponent === 'panel-edit' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <PanelEditExpandedSection selectedFaces={selectedFaces} />
          </div>
        )}

        {/* Raflar Bölümü */}
        {activeComponent === 'shelves' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <ShelvesExpandedSection />
          </div>
        )}

        {/* Arkalıklar Bölümü */}
        {activeComponent === 'backs' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <BacksExpandedSection />
          </div>
        )}

        {/* Kapılar Bölümü */}
        {activeComponent === 'doors' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <DoorsExpandedSection />
          </div>
        )}

        {/* Kenar Bandı Bölümü */}
        {activeComponent === 'edgeband' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <EdgebandExpandedSection />
          </div>
        )}

        {/* Çekmece Bölümü */}
        {activeComponent === 'drawer' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <DrawerExpandedSection />
          </div>
        )}

        {/* Menteşe Bölümü */}
        {activeComponent === 'hinge' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <HingeExpandedSection />
          </div>
        )}

        {/* Bölücü Bölümü */}
        {activeComponent === 'divider' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <DividerExpandedSection />
          </div>
        )}

        {/* Çentik Bölümü */}
        {activeComponent === 'notch' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <NotchExpandedSection />
          </div>
        )}

        {/* Aksesuarlar Bölümü */}
        {activeComponent === 'accessories' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <AccessoriesExpandedSection />
          </div>
        )}

        {/* Yerel Parametreler Bölümü */}
        {activeComponent === 'local-params' && (
          <div className="border-t border-gray-600/30 bg-gray-700/30">
            <LocalParamsExpandedSection />
          </div>
        )}
        {/* Alt Bilgi - Her zaman altta */}
        <div className={`flex-shrink-0 px-2 py-1 border-t border-gray-600/30 bg-gray-700/30 ${isCollapsed ? 'hidden' : ''}`}>
          {/* Collapse düğmesi */}
          <div className="flex justify-between items-center">
            {/* Kapat butonu */}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors"
              title="Düzenleme Modundan Çık"
            >
              <X size={10} />
            </button>
            
            {/* Collapse düğmesi */}
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors"
              title="Arayüzü Küçült"
            >
              <ChevronLeft size={10} />
            </button>
          </div>
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

    </>
  );
};

// Paneller genişletilmiş bölüm bileşeni
const PanelsExpandedSection: React.FC<{ selectedFaces: number[] }> = ({ selectedFaces }) => {
  const faceNames = ['Ön', 'Arka', 'Üst', 'Alt', 'Sağ', 'Sol'];
  
  return (
    <div className="p-2 space-y-2 text-gray-200">
      {/* Ana Aksiyon Butonları */}
      <div className="grid grid-cols-1 gap-1">
        <button className="w-full bg-blue-600/90 hover:bg-blue-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Panel Ekle
        </button>
        <button className="w-full bg-green-600/90 hover:bg-green-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Tüm Panelleri Ekle
        </button>
        <button className="w-full bg-red-600/90 hover:bg-red-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Panelleri Temizle
        </button>
      </div>
      
      {/* Seçili Paneller */}
      {selectedFaces.length > 0 && (
        <div className="space-y-1">
          <div className="text-xs text-gray-400 font-medium">Seçili ({selectedFaces.length})</div>
          {selectedFaces.map((faceIndex) => (
            <div key={faceIndex} className="flex justify-between items-center bg-green-600/20 rounded px-2 py-1 text-xs border border-green-500/30">
              <span className="text-green-300">{faceNames[faceIndex]}</span>
              <span className="text-green-400 font-mono">18mm</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// Panel Düzenleme genişletilmiş bölüm bileşeni
const PanelEditExpandedSection: React.FC<{ selectedFaces: number[] }> = ({ selectedFaces }) => {
  return (
    <div className="p-2 space-y-2 text-gray-200">
      {/* Ana Aksiyon Butonları */}
      <div className="grid grid-cols-1 gap-1">
        <button className="w-full bg-red-600/90 hover:bg-red-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Boyut Düzenle
        </button>
        <button className="w-full bg-orange-600/90 hover:bg-orange-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Pozisyon Düzenle
        </button>
        <button className="w-full bg-purple-600/90 hover:bg-purple-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Malzeme Değiştir
        </button>
      </div>
      
      {/* Düzenlenebilir Paneller */}
      {selectedFaces.length > 0 && (
        <div className="text-xs text-red-400 bg-red-600/10 rounded px-2 py-1 border border-red-500/30">
          {selectedFaces.length} panel düzenlenebilir
        </div>
      )}
    </div>
  );
};

// Raflar genişletilmiş bölüm bileşeni
const ShelvesExpandedSection: React.FC = () => {
  return (
    <div className="p-2 space-y-2 text-gray-200">
      {/* Ana Aksiyon Butonları */}
      <div className="grid grid-cols-1 gap-1">
        <button className="w-full bg-green-600/90 hover:bg-green-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Sabit Raf Ekle
        </button>
        <button className="w-full bg-blue-600/90 hover:bg-blue-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Ayarlanabilir Raf
        </button>
        <button className="w-full bg-cyan-600/90 hover:bg-cyan-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Raf Ayarları
        </button>
      </div>
    </div>
  );
};

// Arkalıklar genişletilmiş bölüm bileşeni
const BacksExpandedSection: React.FC = () => {
  return (
    <div className="p-2 space-y-2 text-gray-200">
      {/* Ana Aksiyon Butonları */}
      <div className="grid grid-cols-1 gap-1">
        <button className="w-full bg-purple-600/90 hover:bg-purple-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Sunta Arkalık (3mm)
        </button>
        <button className="w-full bg-indigo-600/90 hover:bg-indigo-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          MDF Arkalık (6mm)
        </button>
        <button className="w-full bg-violet-600/90 hover:bg-violet-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Arkalık Ayarları
        </button>
      </div>
    </div>
  );
};

// Kapılar genişletilmiş bölüm bileşeni
const DoorsExpandedSection: React.FC = () => {
  return (
    <div className="p-2 space-y-2 text-gray-200">
      {/* Ana Aksiyon Butonları */}
      <div className="grid grid-cols-1 gap-1">
        <button className="w-full bg-orange-600/90 hover:bg-orange-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Tek Kapı Ekle
        </button>
        <button className="w-full bg-red-600/90 hover:bg-red-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Çift Kapı Ekle
        </button>
        <button className="w-full bg-amber-600/90 hover:bg-amber-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Kapı Ayarları
        </button>
      </div>
    </div>
  );
};

// Kenar Bandı genişletilmiş bölüm bileşeni
const EdgebandExpandedSection: React.FC = () => {
  return (
    <div className="p-3 space-y-3 text-gray-200">
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Kenar Bandı Türü</div>
        <div className="space-y-1">
          <button className="w-full text-left bg-amber-600/20 rounded px-2 py-1 text-xs text-amber-300 hover:bg-amber-600/30 border border-amber-500/30">
            + PVC Kenar Bandı
          </button>
          <button className="w-full text-left bg-yellow-600/20 rounded px-2 py-1 text-xs text-yellow-300 hover:bg-yellow-600/30 border border-yellow-500/30">
            + ABS Kenar Bandı
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Kenar Seçimi</div>
        <div className="space-y-1">
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Kalınlık:</span>
            <span className="text-white font-mono">0.4 mm</span>
          </div>
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Renk:</span>
            <span className="text-white font-mono">Beyaz</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Çekmece genişletilmiş bölüm bileşeni
const DrawerExpandedSection: React.FC = () => {
  return (
    <div className="p-3 space-y-3 text-gray-200">
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Çekmece Türü</div>
        <div className="space-y-1">
          <button className="w-full text-left bg-indigo-600/20 rounded px-2 py-1 text-xs text-indigo-300 hover:bg-indigo-600/30 border border-indigo-500/30">
            + Standart Çekmece
          </button>
          <button className="w-full text-left bg-blue-600/20 rounded px-2 py-1 text-xs text-blue-300 hover:bg-blue-600/30 border border-blue-500/30">
            + Derin Çekmece
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Ray Sistemi</div>
        <div className="space-y-1">
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Tip:</span>
            <span className="text-white font-mono">Soft Close</span>
          </div>
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Uzunluk:</span>
            <span className="text-white font-mono">450 mm</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Menteşe genişletilmiş bölüm bileşeni
const HingeExpandedSection: React.FC = () => {
  return (
    <div className="p-3 space-y-3 text-gray-200">
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Menteşe Türü</div>
        <div className="space-y-1">
          <button className="w-full text-left bg-cyan-600/20 rounded px-2 py-1 text-xs text-cyan-300 hover:bg-cyan-600/30 border border-cyan-500/30">
            + Gizli Menteşe
          </button>
          <button className="w-full text-left bg-teal-600/20 rounded px-2 py-1 text-xs text-teal-300 hover:bg-teal-600/30 border border-teal-500/30">
            + Soft Close Menteşe
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Menteşe Ayarları</div>
        <div className="space-y-1">
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Açılış Açısı:</span>
            <span className="text-white font-mono">110°</span>
          </div>
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Adet:</span>
            <span className="text-white font-mono">2</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Bölücü genişletilmiş bölüm bileşeni
const DividerExpandedSection: React.FC = () => {
  return (
    <div className="p-3 space-y-3 text-gray-200">
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Bölücü Türü</div>
        <div className="space-y-1">
          <button className="w-full text-left bg-pink-600/20 rounded px-2 py-1 text-xs text-pink-300 hover:bg-pink-600/30 border border-pink-500/30">
            + Dikey Bölücü
          </button>
          <button className="w-full text-left bg-rose-600/20 rounded px-2 py-1 text-xs text-rose-300 hover:bg-rose-600/30 border border-rose-500/30">
            + Yatay Bölücü
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Bölücü Ayarları</div>
        <div className="space-y-1">
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Kalınlık:</span>
            <span className="text-white font-mono">18 mm</span>
          </div>
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Pozisyon:</span>
            <span className="text-white font-mono">Orta</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Çentik genişletilmiş bölüm bileşeni
const NotchExpandedSection: React.FC = () => {
  return (
    <div className="p-3 space-y-3 text-gray-200">
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Çentik Türü</div>
        <div className="space-y-1">
          <button className="w-full text-left bg-teal-600/20 rounded px-2 py-1 text-xs text-teal-300 hover:bg-teal-600/30 border border-teal-500/30">
            + Dikdörtgen Çentik
          </button>
          <button className="w-full text-left bg-emerald-600/20 rounded px-2 py-1 text-xs text-emerald-300 hover:bg-emerald-600/30 border border-emerald-500/30">
            + Yuvarlak Çentik
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Çentik Boyutları</div>
        <div className="space-y-1">
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">G:</span>
            <span className="text-white font-mono">35 mm</span>
          </div>
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">D:</span>
            <span className="text-white font-mono">18 mm</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Aksesuarlar genişletilmiş bölüm bileşeni
const AccessoriesExpandedSection: React.FC = () => {
  return (
    <div className="p-3 space-y-3 text-gray-200">
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Donanım</div>
        <div className="space-y-1">
          <button className="w-full text-left bg-slate-600/20 rounded px-2 py-1 text-xs text-slate-300 hover:bg-slate-600/30 border border-slate-500/30">
            + Kulp Ekle
          </button>
          <button className="w-full text-left bg-gray-600/20 rounded px-2 py-1 text-xs text-gray-300 hover:bg-gray-600/30 border border-gray-500/30">
            + Kilit Ekle
          </button>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">İç Aksesuarlar</div>
        <div className="space-y-1">
          <button className="w-full text-left bg-zinc-600/20 rounded px-2 py-1 text-xs text-zinc-300 hover:bg-zinc-600/30 border border-zinc-500/30">
            + Raf Desteği
          </button>
          <button className="w-full text-left bg-stone-600/20 rounded px-2 py-1 text-xs text-stone-300 hover:bg-stone-600/30 border border-stone-500/30">
            + Kablo Geçişi
          </button>
        </div>
      </div>
    </div>
  );
};

// Yerel Parametreler genişletilmiş bölüm bileşeni
const LocalParamsExpandedSection: React.FC = () => {
  return (
    <div className="p-3 space-y-3 text-gray-200">
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Özel Parametreler</div>
        <div className="space-y-1">
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Panel Kalınlığı:</span>
            <span className="text-white font-mono">18 mm</span>
          </div>
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Kenar Mesafesi:</span>
            <span className="text-white font-mono">32 mm</span>
          </div>
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Vida Çapı:</span>
            <span className="text-white font-mono">5 mm</span>
          </div>
        </div>
      </div>
      
      <div className="space-y-2">
        <div className="text-xs text-gray-400 font-medium">Malzeme Ayarları</div>
        <div className="space-y-1">
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Ana Malzeme:</span>
            <span className="text-white font-mono">Lam</span>
          </div>
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Kenar Bandı:</span>
            <span className="text-white font-mono">PVC</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// Modül genişletilmiş bölüm bileşeni
const ModuleExpandedSection: React.FC<{ editedShape: Shape }> = ({ editedShape }) => {
  const { measurementUnit, convertToDisplayUnit } = useAppStore();
  
  const getDimensionValue = (paramName: string) => {
    const value = editedShape.parameters[paramName];
    return value ? convertToDisplayUnit(value).toFixed(1) : '0.0';
  };

  return (
    <div className="p-2 space-y-2 text-gray-200">
      {/* Ana Aksiyon Butonları */}
      <div className="grid grid-cols-1 gap-1">
        <button className="w-full bg-violet-600/90 hover:bg-violet-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Boyut Düzenle
        </button>
        <button className="w-full bg-blue-600/90 hover:bg-blue-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Pozisyon Düzenle
        </button>
        <button className="w-full bg-green-600/90 hover:bg-green-500 text-white text-xs py-2 px-3 rounded transition-colors font-medium">
          Modül Kopyala
        </button>
      </div>

      {/* Boyutlar */}
      <div className="space-y-1">
        <div className="text-xs text-gray-400 font-medium">Mevcut Boyutlar</div>
        {editedShape.type === 'box' && (
          <div className="space-y-1">
            <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
              <span className="text-gray-300">G:</span>
              <span className="text-white font-mono">
                {getDimensionValue('width')} {measurementUnit}
              </span>
            </div>
            <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
              <span className="text-gray-300">Y:</span>
              <span className="text-white font-mono">
                {getDimensionValue('height')} {measurementUnit}
              </span>
            </div>
            <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
              <span className="text-gray-300">D:</span>
              <span className="text-white font-mono">
                {getDimensionValue('depth')} {measurementUnit}
              </span>
            </div>
          </div>
        )}

        {editedShape.type === 'cylinder' && (
          <div className="space-y-1">
            <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
              <span className="text-gray-300">R:</span>
              <span className="text-white font-mono">
                {getDimensionValue('radius')} {measurementUnit}
              </span>
            </div>
            <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
              <span className="text-gray-300">Y:</span>
              <span className="text-white font-mono">
                {getDimensionValue('height')} {measurementUnit}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Pozisyon */}
      <div className="space-y-1">
        <div className="text-xs text-gray-400 font-medium">Mevcut Pozisyon</div>
        <div className="space-y-1">
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">X:</span>
            <span className="text-white font-mono">
              {convertToDisplayUnit(editedShape.position[0]).toFixed(1)} {measurementUnit}
            </span>
          </div>
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Y:</span>
            <span className="text-white font-mono">
              {convertToDisplayUnit(editedShape.position[1]).toFixed(1)} {measurementUnit}
            </span>
          </div>
          <div className="flex justify-between items-center bg-gray-700/30 rounded px-2 py-1 text-xs">
            <span className="text-gray-300">Z:</span>
            <span className="text-white font-mono">
              {convertToDisplayUnit(editedShape.position[2]).toFixed(1)} {measurementUnit}
            </span>
          </div>
        </div>
      </div>

    </div>
  );
};

export default EditModePanel;