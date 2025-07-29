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
  const [isModuleMode, setIsModuleMode] = useState(false); // Modül modu kontrolü

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
    // Modül moduna geçiş
    if (componentType === 'module') {
      setIsModuleMode(true);
      setActiveComponent('module');
      console.log('Module mode activated');
      return;
    }

    // Diğer bileşenler için normal işlem
    if (activeComponent === componentType) {
      setActiveComponent(null);
      setIsAddPanelMode(false);
      setIsPanelEditMode(false);
      console.log(`${componentType} mode disabled`);
    } else {
      setActiveComponent(componentType);

      if (componentType === 'panels') {
        setIsAddPanelMode(true);
        setIsPanelEditMode(false);
        console.log('Panel mode activated');
      } else if (componentType === 'panel-edit') {
        setIsAddPanelMode(false);
        setIsPanelEditMode(true);
        console.log('Panel Edit mode activated');
      } else {
        setIsAddPanelMode(false);
        setIsPanelEditMode(false);
        console.log(`${componentType} mode activated`);
      }
    }
  };

  const handleModuleBack = () => {
    setIsModuleMode(false);
    setActiveComponent(null);
    console.log('Returned from module mode');
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
              title="Expand Panel"
            >
              <ChevronRight size={16} />
            </button>
          </div>
          </>
        )}

        {/* İçerik - Sol (butonlar) ve Sağ (boyutlar/diğer) olarak bölünmüş */}
        <div className={`flex-1 flex flex-row overflow-hidden ${isCollapsed ? 'hidden' : ''}`}>
          {/* Modül Modu - Tam Ekran */}
          {isModuleMode ? (
            <div className="w-full flex flex-col">
              {/* Modül Başlığı */}
              <div className="flex items-center justify-between px-3 py-2 bg-violet-600/20 border-b border-violet-500/30">
                <div className="flex items-center gap-2">
                  <div className="flex items-center justify-center w-6 h-6 bg-violet-600/30 rounded">
                    <Puzzle size={12} className="text-violet-300" />
                  </div>
                  <span className="text-white font-medium text-sm">Module</span>
                </div>
                <button
                  onClick={handleModuleBack}
                  className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                  title="Back"
                >
                  <X size={12} />
                </button>
              </div>

              {/* Modül İçeriği */}
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
            {/* En Üst - Dolap Kodu Girişi */}
            <div className="absolute top-2 left-2 right-16 z-10">
            <input
              type="text"
              placeholder="Cabinet Code (e.g: CAB-001)"
              className="w-full bg-gray-700/80 backdrop-blur-sm text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-blue-500/50"
            />
          </div>

          {/* Üst Kısım - Sağ üst düğmeler */}
          <div className="absolute top-2 right-2 flex items-center gap-1 z-10">
            {/* Kapat butonu */}
            <button
              onClick={handleClose}
              className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors bg-gray-800/80 backdrop-blur-sm"
              title="Exit Edit Mode"
            >
              <X size={12} />
            </button>
            
            {/* Collapse düğmesi */}
            <button
              onClick={() => setIsCollapsed(true)}
              className="text-gray-400 hover:text-white p-1 rounded transition-colors bg-gray-800/80 backdrop-blur-sm"
              title="Minimize Interface"
            >
              <ChevronLeft size={12} />
            </button>
          </div>

          {/* Bileşen Menü Çubuğu - Kaydırılabilir */}
          <div className="flex flex-col w-full bg-gray-700/50 flex-shrink-0 py-2 pt-12">
            {editedShape.type === 'box' && (
              <>
                {/* İlk 4 düğme - Sabit görünür */}
                <div className="flex flex-col gap-1 px-2">
                  {furnitureComponents.slice(0, 4).map((component) => {
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
                
                {/* 5. düğmeden itibaren - Kaydırılabilir alan */}
                {furnitureComponents.length > 4 && (
                  <div className="flex flex-col gap-1 px-2 mt-2 pt-2 border-t border-gray-600/30 max-h-20 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
                    {furnitureComponents.slice(4).map((component) => {
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
                )}
              </>
            )}

            {/* Modül Detayları - Sol Panel İçinde */}
            {activeComponent === 'module' && (
              <div className="px-2 mt-4 border-t border-gray-600/30 pt-4 bg-gray-700/20 rounded-b-lg">
                <div className="flex items-center gap-2 mb-3">
                  <Puzzle size={12} className="text-violet-400" />
                  <span className="text-white font-medium text-sm">Module</span>
                </div>
                <div className="h-px bg-gradient-to-r from-transparent via-gray-400/60 to-transparent mb-3"></div>
                
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
            )}
          </div>
          )}
        </div>

      </div>

      {/* Detay Bölümleri - Ana panelin dışında, altında */}
      {activeComponent === 'panels' && (
        <div 
          className="fixed left-0 z-40 w-48 bg-gray-700/30 backdrop-blur-sm border-r border-gray-600/30 flex flex-col overflow-hidden"
          style={{
            top: `${panelTopValue + 180}px`, // Sabit pozisyon - 4 düğme + header
            height: `${panelHeightValue - 180}px`, // Kalan yüksekliği kullanır
          }}
        >
          {/* Başlık */}
          <div className="flex items-center px-3 py-2 border-b border-gray-600/30 bg-gray-800/50">
            <div className="flex items-center gap-2">
              <Layers size={14} className="text-blue-400" />
              <span className="text-white font-medium text-sm">Paneller</span>
            </div>
          </div>
          
          {/* İçerik Alanı - Kaydırılabilir */}
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

      {/* Modül Detay Bölümü */}
      {activeComponent === 'module' && (
        <div 
          className="fixed left-0 z-40 w-48 bg-gray-700/30 backdrop-blur-sm border-r border-gray-600/30 flex flex-col overflow-hidden"
          style={{
            top: `${panelTopValue + 180}px`, // Sabit pozisyon
            height: `${panelHeightValue - 180}px`,
          }}
        >
          <div className="flex items-center px-3 py-2 border-b border-gray-600/30 bg-gray-800/50">
            <div className="flex items-center gap-2">
              <Puzzle size={14} className="text-violet-400" />
              <span className="text-white font-medium text-sm">Modül</span>
            </div>
          </div>
          
          <div className="flex-1 p-3 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {/* Boyut Ayarları */}
            <div className="space-y-3">
              <div className="text-white font-medium text-sm mb-3">Boyutlar</div>
              
              {/* Genişlik */}
              <div className="space-y-1">
                <label className="text-gray-300 text-xs">Genişlik</label>
                <div className="flex items-center gap-1">
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
                  <span className="text-gray-400 text-xs w-6">{measurementUnit}</span>
                </div>
              </div>
              
              {/* Yükseklik */}
              <div className="space-y-1">
                <label className="text-gray-300 text-xs">Yükseklik</label>
                <div className="flex items-center gap-1">
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
                  <span className="text-gray-400 text-xs w-6">{measurementUnit}</span>
                </div>
              </div>
              
              {/* Derinlik */}
              <div className="space-y-1">
                <label className="text-gray-300 text-xs">Derinlik</label>
                <div className="flex items-center gap-1">
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
                  <span className="text-gray-400 text-xs w-6">{measurementUnit}</span>
                </div>
              </div>
              
              {/* Silindir için Radius */}
              {editedShape.type === 'cylinder' && (
                <div className="space-y-1">
                  <label className="text-gray-300 text-xs">Yarıçap</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={convertToDisplayUnit(editedShape.parameters.radius || 250).toFixed(1)}
                      onChange={(e) => {
                        const newRadius = convertToBaseUnit(parseFloat(e.target.value) || 0);
                        const newGeometry = new THREE.CylinderGeometry(
                          newRadius,
                          newRadius,
                          editedShape.parameters.height || 500,
                          32
                        );
                        updateShape(editedShape.id, {
                          parameters: { ...editedShape.parameters, radius: newRadius },
                          geometry: newGeometry
                        });
                      }}
                      className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
                      step="0.1"
                      min="1"
                    />
                    <span className="text-gray-400 text-xs w-6">{measurementUnit}</span>
                  </div>
                </div>
              )}
              
              {/* Hızlı Boyut Düğmeleri */}
              <div className="pt-2 border-t border-gray-600/30">
                <div className="text-gray-300 text-xs mb-2">Hızlı Boyutlar</div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => {
                      const newGeometry = new THREE.BoxGeometry(600, 800, 350);
                      updateShape(editedShape.id, {
                        parameters: { width: 600, height: 800, depth: 350 },
                        geometry: newGeometry
                      });
                    }}
                    className="bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-xs px-2 py-1 rounded transition-colors"
                  >
                    Dolap
                  </button>
                  <button
                    onClick={() => {
                      const newGeometry = new THREE.BoxGeometry(1200, 750, 400);
                      updateShape(editedShape.id, {
                        parameters: { width: 1200, height: 750, depth: 400 },
                        geometry: newGeometry
                      });
                    }}
                    className="bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-xs px-2 py-1 rounded transition-colors"
                  >
                    Masa
                  </button>
                  <button
                    onClick={() => {
                      const newGeometry = new THREE.BoxGeometry(400, 400, 400);
                      updateShape(editedShape.id, {
                        parameters: { width: 400, height: 400, depth: 400 },
                        geometry: newGeometry
                      });
                    }}
                    className="bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-xs px-2 py-1 rounded transition-colors"
                  >
                    Kare
                  </button>
                  <button
                    onClick={() => {
                      const newGeometry = new THREE.BoxGeometry(800, 200, 600);
                      updateShape(editedShape.id, {
                        parameters: { width: 800, height: 200, depth: 600 },
                        geometry: newGeometry
                      });
                    }}
                    className="bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-xs px-2 py-1 rounded transition-colors"
                  >
                    Raf
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modül Detay Bölümü */}
      {activeComponent === 'module' && (
        <div 
          className="fixed left-0 z-40 w-48 bg-gray-700/30 backdrop-blur-sm border-r border-gray-600/30 flex flex-col overflow-hidden"
          style={{
            top: `${panelTopValue + 180}px`, // Sabit pozisyon
            height: `${panelHeightValue - 180}px`,
          }}
        >
          <div className="flex items-center px-3 py-2 border-b border-gray-600/30 bg-gray-800/50">
            <div className="flex items-center gap-2">
              <Puzzle size={14} className="text-violet-400" />
              <span className="text-white font-medium text-sm">Modül</span>
            </div>
          </div>
          
          <div className="flex-1 p-3 overflow-y-auto" style={{ scrollbarWidth: 'thin' }}>
            {/* Boyut Ayarları */}
            <div className="space-y-3">
              <div className="text-white font-medium text-sm mb-3">Boyutlar</div>
              
              {/* Genişlik */}
              <div className="space-y-1">
                <label className="text-gray-300 text-xs">Genişlik</label>
                <div className="flex items-center gap-1">
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
                  <span className="text-gray-400 text-xs w-6">{measurementUnit}</span>
                </div>
              </div>
              
              {/* Yükseklik */}
              <div className="space-y-1">
                <label className="text-gray-300 text-xs">Yükseklik</label>
                <div className="flex items-center gap-1">
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
                  <span className="text-gray-400 text-xs w-6">{measurementUnit}</span>
                </div>
              </div>
              
              {/* Derinlik */}
              <div className="space-y-1">
                <label className="text-gray-300 text-xs">Derinlik</label>
                <div className="flex items-center gap-1">
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
                  <span className="text-gray-400 text-xs w-6">{measurementUnit}</span>
                </div>
              </div>
              
              {/* Silindir için Radius */}
              {editedShape.type === 'cylinder' && (
                <div className="space-y-1">
                  <label className="text-gray-300 text-xs">Yarıçap</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={convertToDisplayUnit(editedShape.parameters.radius || 250).toFixed(1)}
                      onChange={(e) => {
                        const newRadius = convertToBaseUnit(parseFloat(e.target.value) || 0);
                        const newGeometry = new THREE.CylinderGeometry(
                          newRadius,
                          newRadius,
                          editedShape.parameters.height || 500,
                          32
                        );
                        updateShape(editedShape.id, {
                          parameters: { ...editedShape.parameters, radius: newRadius },
                          geometry: newGeometry
                        });
                      }}
                      className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
                      step="0.1"
                      min="1"
                    />
                    <span className="text-gray-400 text-xs w-6">{measurementUnit}</span>
                  </div>
                </div>
              )}
              
              {/* Hızlı Boyut Düğmeleri */}
              <div className="pt-2 border-t border-gray-600/30">
                <div className="text-gray-300 text-xs mb-2">Hızlı Boyutlar</div>
                <div className="grid grid-cols-2 gap-1">
                  <button
                    onClick={() => {
                      const newGeometry = new THREE.BoxGeometry(600, 800, 350);
                      updateShape(editedShape.id, {
                        parameters: { width: 600, height: 800, depth: 350 },
                        geometry: newGeometry
                      });
                    }}
                    className="bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-xs px-2 py-1 rounded transition-colors"
                  >
                    Dolap
                  </button>
                  <button
                    onClick={() => {
                      const newGeometry = new THREE.BoxGeometry(1200, 750, 400);
                      updateShape(editedShape.id, {
                        parameters: { width: 1200, height: 750, depth: 400 },
                        geometry: newGeometry
                      });
                    }}
                    className="bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-xs px-2 py-1 rounded transition-colors"
                  >
                    Masa
                  </button>
                  <button
                    onClick={() => {
                      const newGeometry = new THREE.BoxGeometry(400, 400, 400);
                      updateShape(editedShape.id, {
                        parameters: { width: 400, height: 400, depth: 400 },
                        geometry: newGeometry
                      });
                    }}
                    className="bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-xs px-2 py-1 rounded transition-colors"
                  >
                    Kare
                  </button>
                  <button
                    onClick={() => {
                      const newGeometry = new THREE.BoxGeometry(800, 200, 600);
                      updateShape(editedShape.id, {
                        parameters: { width: 800, height: 200, depth: 600 },
                        geometry: newGeometry
                      });
                    }}
                    className="bg-violet-600/20 hover:bg-violet-600/40 text-violet-300 text-xs px-2 py-1 rounded transition-colors"
                  >
                    Raf
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeComponent === 'edgeband' && (
        <div 
          className="fixed left-0 z-40 w-48 bg-gray-700/30 backdrop-blur-sm border-r border-gray-600/30 flex flex-col overflow-hidden"
          style={{
            top: `${panelTopValue + 180}px`, // Sabit pozisyon
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

      {/* Parameter Detay Bölümü */}
      {activeComponent === 'parameter' && (
        <div 
          className="fixed left-0 z-40 w-48 bg-gray-700/30 backdrop-blur-sm border-r border-gray-600/30 flex flex-col overflow-hidden"
          style={{
            top: `${panelTopValue + 180}px`, // Sabit pozisyon
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

      {/* Raflar Detay Bölümü */}
      {activeComponent === 'shelves' && (
        <div 
          className="fixed left-0 z-40 w-48 bg-gray-700/30 backdrop-blur-sm border-r border-gray-600/30 flex flex-col overflow-hidden"
          style={{
            top: `${panelTopValue + 180}px`, // Sabit pozisyon
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

      {/* Kapılar Detay Bölümü */}
      {activeComponent === 'doors' && (
        <div 
          className="fixed left-0 z-40 w-48 bg-gray-700/30 backdrop-blur-sm border-r border-gray-600/30 flex flex-col overflow-hidden"
          style={{
            top: `${panelTopValue + 180}px`, // Sabit pozisyon
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


export default EditModePanel;