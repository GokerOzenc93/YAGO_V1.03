// Gerekli kütüphaneleri ve bileşenleri import ediyoruz
import { useState, useEffect, useMemo } from 'react';
import { X, GripVertical, Plus, Trash2 } from 'lucide-react';
import { useAppStore } from '../store';
import * as THREE from 'three';
// YENİ: Gelişmiş ve güvenli matematiksel ifade değerlendirmesi için math.js kütüphanesi
// Projenize eklemek için: npm install mathjs
import { evaluate } from 'mathjs';

// ---- Arayüz Tipleri (Interfaces) ----
interface CustomParameter {
  id: string;
  name: string;
  expression: string;
  result: number;
  description: string;
  error?: string; // Hata takibi için yeni alan
}

interface AllParameters {
  width: number;
  height: number;
  depth: number;
  customParameters: CustomParameter[];
}

interface ParametersPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

// ---- YENİ: Yeniden Kullanılabilir Satır Bileşeni ----
// Bu bileşen, kod tekrarını önler ve arayüzü standartlaştırır.
function ParameterRow({ label, value, onChange, placeholder, error, type = 'text', readOnly = false }) {
  // Hata durumunda input kenarlığını kırmızı yapar
  const errorClasses = error ? 'border-red-500 focus:border-red-500 focus:ring-red-500' : 'border-stone-300 focus:border-orange-400 focus:ring-orange-400';
  
  return (
    <div className="flex items-center gap-2">
      <label className="w-20 flex-shrink-0 text-xs font-medium text-stone-700">{label}</label>
      <input
        type={type}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
        className={`flex-1 w-full px-2 py-1 text-xs border rounded transition-colors focus:outline-none focus:ring-1 ${errorClasses} ${readOnly ? 'bg-stone-50 text-stone-600 cursor-not-allowed' : ''}`}
        placeholder={placeholder}
      />
    </div>
  );
}

// ---- Ana Panel Bileşeni ----
export function ParametersPanel({ isOpen, onClose }: ParametersPanelProps) {
  const { selectedShapeId, shapes, updateShape } = useAppStore();
  
  // Panel pozisyonu ve sürükleme state'leri
  const [position, setPosition] = useState({ x: 100, y: 100 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });

  // Seçili şekli useMemo ile performanslı bir şekilde alıyoruz
  const selectedShape = useMemo(() => shapes.find((s) => s.id === selectedShapeId), [shapes, selectedShapeId]);

  // GÜNCELLENDİ: Tüm parametreleri tek bir state nesnesinde birleştirdik
  const [parameters, setParameters] = useState<AllParameters>({
    width: 0,
    height: 0,
    depth: 0,
    customParameters: [],
  });
  
  // Seçili şekil değiştiğinde, paneli o şeklin verileriyle doldurur
  useEffect(() => {
    if (selectedShape?.parameters) {
      setParameters({
        width: selectedShape.parameters.width || 0,
        height: selectedShape.parameters.height || 0,
        depth: selectedShape.parameters.depth || 0,
        customParameters: selectedShape.parameters.customParameters?.map(p => ({...p, error: undefined})) || [],
      });
    }
  }, [selectedShape]);

  // GÜNCELLENDİ: Parametrelerden herhangi biri değiştiğinde tüm ifadeleri yeniden hesaplar
  useEffect(() => {
    if (!selectedShape) return;

    // Hesaplama kapsamını (scope) oluşturur. İfadeler bu değişkenleri kullanabilir.
    const scope = {
      width: parameters.width,
      height: parameters.height,
      depth: parameters.depth,
    };
    parameters.customParameters.forEach(p => {
      // İsimlerdeki boşlukları kaldırarak değişken olarak kullanılabilir hale getirir
      const safeName = p.name.replace(/\s+/g, '');
      if (safeName) {
        scope[safeName] = p.result;
      }
    });

    // Tüm özel parametreleri yeni scope ile yeniden hesapla
    let needsUiUpdate = false;
    const evaluatedParams = parameters.customParameters.map(param => {
      try {
        const result = evaluate(param.expression, scope);
        const newResult = typeof result === 'number' && !isNaN(result) ? result : 0;
        // Eğer sonuç veya hata durumu değiştiyse, arayüz güncellemesi gerekir
        if (newResult !== param.result || param.error) {
          needsUiUpdate = true;
        }
        return { ...param, result: newResult, error: undefined };
      } catch (e) {
        if (!param.error) needsUiUpdate = true;
        return { ...param, result: 0, error: "Geçersiz ifade" };
      }
    });

    if (needsUiUpdate) {
       setParameters(prev => ({...prev, customParameters: evaluatedParams}));
    }
  }, [parameters.width, parameters.height, parameters.depth, parameters.customParameters, selectedShape]);

  // GÜNCELLENDİ: Geometriyi etkileyen parametreler değiştiğinde 3D sahneyi ve ana state'i günceller
  useEffect(() => {
      if(!selectedShape) return;
      
      const geometryNeedsUpdate = selectedShape.parameters?.width !== parameters.width ||
                                  selectedShape.parameters?.height !== parameters.height ||
                                  selectedShape.parameters?.depth !== parameters.depth;

      const newGeometry = geometryNeedsUpdate 
          ? new THREE.BoxGeometry(parameters.width, parameters.height, parameters.depth)
          : selectedShape.geometry;
      
      updateShape(selectedShape.id, {
          geometry: newGeometry,
          parameters: { ...parameters } // Tüm parametreleri kaydet
      });

  }, [parameters, selectedShape, updateShape]);


  // ---- Sürükleme Fonksiyonları (Değişiklik yok) ----
  const handleMouseDown = (e: React.MouseEvent) => {
    setIsDragging(true);
    setDragOffset({ x: e.clientX - position.x, y: e.clientY - position.y });
  };
  const handleMouseMove = (e: MouseEvent) => {
    if (isDragging) setPosition({ x: e.clientX - dragOffset.x, y: e.clientY - dragOffset.y });
  };
  const handleMouseUp = () => setIsDragging(false);

  useEffect(() => {
    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
      return () => {
        window.removeEventListener('mousemove', handleMouseMove);
        window.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isDragging, dragOffset]);

  // ---- Parametre Yönetim Fonksiyonları ----
  const handleParamChange = (field: keyof AllParameters, value: any) => {
     setParameters(prev => ({...prev, [field]: value}));
  };
  
  const addCustomParameter = () => {
    const newParam: CustomParameter = {
      id: `param-${Date.now()}`,
      name: `Param${parameters.customParameters.length + 1}`,
      expression: '10',
      result: 10,
      description: '',
    };
    handleParamChange('customParameters', [...parameters.customParameters, newParam]);
  };
  
  const removeCustomParameter = (id: string) => {
    handleParamChange('customParameters', parameters.customParameters.filter(p => p.id !== id));
  };
  
  const updateCustomParameterField = (id: string, field: keyof CustomParameter, value: string) => {
     const updatedParams = parameters.customParameters.map(p => p.id === id ? {...p, [field]: value} : p);
     handleParamChange('customParameters', updatedParams);
  };
  
  if (!isOpen) return null;

  // ---- JSX Arayüz Çıktısı ----
  return (
    <div
      className="fixed bg-white rounded-lg shadow-2xl border border-stone-300 z-50 flex flex-col"
      style={{ left: `${position.x}px`, top: `${position.y}px`, width: '280px', maxHeight: '70vh' }}
    >
      {/* Panel Başlığı */}
      <div
        className="flex items-center justify-between px-3 py-2 bg-stone-100 border-b border-stone-300 rounded-t-lg cursor-move flex-shrink-0"
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <GripVertical size={14} className="text-stone-400" />
          <span className="text-sm font-semibold text-slate-800">Parameters</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={addCustomParameter} className="p-1 hover:bg-stone-200 rounded transition-colors" title="Yeni Parametre Ekle">
            <Plus size={14} className="text-stone-600" />
          </button>
          <button onClick={onClose} className="p-1 hover:bg-stone-200 rounded transition-colors" title="Kapat">
            <X size={14} className="text-stone-600" />
          </button>
        </div>
      </div>

      {/* Panel İçeriği */}
      <div className="p-3 space-y-3 overflow-y-auto">
        {selectedShape ? (
          <>
            {/* Temel Boyut Parametreleri */}
            <div className="space-y-2">
              <ParameterRow label="Genişlik" type="number" value={parameters.width} onChange={(e) => handleParamChange('width', Number(e.target.value))} />
              <ParameterRow label="Yükseklik" type="number" value={parameters.height} onChange={(e) => handleParamChange('height', Number(e.target.value))} />
              <ParameterRow label="Derinlik" type="number" value={parameters.depth} onChange={(e) => handleParamChange('depth', Number(e.target.value))} />
            </div>

            {/* Özel Parametreler */}
            {parameters.customParameters.length > 0 && (
              <div className="pt-3 border-t border-stone-200 space-y-3">
                {parameters.customParameters.map((param) => (
                  <div key={param.id} className="p-2.5 border rounded border-stone-200 bg-stone-50/50 space-y-2">
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={param.name}
                        onChange={(e) => updateCustomParameterField(param.id, 'name', e.target.value)}
                        className="w-full px-2 py-1 text-xs font-medium border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400"
                        placeholder="Parametre Adı"
                      />
                       <button onClick={() => removeCustomParameter(param.id)} className="p-1.5 hover:bg-stone-200 rounded text-stone-500 hover:text-red-600 transition-colors" title="Parametreyi Sil">
                          <Trash2 size={14}/>
                       </button>
                    </div>
                    <ParameterRow label="İfade" value={param.expression} onChange={(e) => updateCustomParameterField(param.id, 'expression', e.target.value)} placeholder="örn: width / 2" error={param.error}/>
                    <ParameterRow label="Sonuç" value={param.result.toFixed(3)} readOnly={true} />
                  </div>
                ))}
              </div>
            )}
          </>
        ) : (
          <div className="text-xs text-stone-500 text-center py-4">İşlem yapmak için bir nesne seçin</div>
        )}
      </div>
    </div>
  );
}
