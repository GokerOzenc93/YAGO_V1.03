import React, { useMemo, useState, useEffect } from 'react';
import { X, Puzzle, Check } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import * as THREE from 'three';

interface ModuleProps {
  editedShape: Shape;
  onClose: () => void;
}

const Module: React.FC<ModuleProps> = ({ editedShape, onClose }) => {
  const { convertToDisplayUnit, convertToBaseUnit, updateShape } = useAppStore();

  // Şeklin mevcut geometrisinin ve ölçeğinin en dış sınırlarını hesaplar.
  // Bu, nesne bir kutu olmasa bile (örneğin bir polylinedan oluşsa bile) doğru boyutları verir.
  const { currentWidth, currentHeight, currentDepth } = useMemo(() => {
    if (!editedShape.geometry) {
      return { currentWidth: 0, currentHeight: 0, currentDepth: 0 };
    }

    // Bounding box'ı hesapla (eğer henüz hesaplanmadıysa)
    // Bu metod, herhangi bir THREE.BufferGeometry için en dış sınırları verir.
    editedShape.geometry.computeBoundingBox();
    const bbox = editedShape.geometry.boundingBox;

    if (!bbox) {
      console.warn('Geometry bounding box hesaplanamadı, varsayılan değerler kullanılıyor');
      return { currentWidth: 500, currentHeight: 500, currentDepth: 500 };
    }

    // Bounding box boyutlarını mevcut ölçekle çarpılarak gerçek dünya boyutları elde edilir
    const width = (bbox.max.x - bbox.min.x) * editedShape.scale[0];
    const height = (bbox.max.y - bbox.min.y) * editedShape.scale[1];
    const depth = (bbox.max.z - bbox.min.z) * editedShape.scale[2];

    console.log(`🎯 Module boyutları hesaplandı:`, {
      shapeType: editedShape.type,
      shapeId: editedShape.id,
      boundingBox: {
        min: [bbox.min.x.toFixed(1), bbox.min.y.toFixed(1), bbox.min.z.toFixed(1)],
        max: [bbox.max.x.toFixed(1), bbox.max.y.toFixed(1), bbox.max.z.toFixed(1)]
      },
      scale: editedShape.scale,
      calculatedDimensions: {
        width: width.toFixed(1),
        height: height.toFixed(1), 
        depth: depth.toFixed(1)
      }
    });

    return {
      currentWidth: width,
      currentHeight: height,
      currentDepth: depth,
    };
  }, [editedShape.geometry, editedShape.scale]);

  // Giriş alanları için yerel durumlar (state) tanımlandı.
  // Başlangıçta ve güncellendiğinde küsuratsız gösterilir (toFixed(0)).
  const [inputWidth, setInputWidth] = useState(convertToDisplayUnit(currentWidth).toFixed(0));
  const [inputHeight, setInputHeight] = useState(convertToDisplayUnit(currentHeight).toFixed(0));
  const [inputDepth, setInputDepth] = useState(convertToDisplayUnit(currentDepth).toFixed(0));

  // Shape tipine göre hangi boyutların düzenlenebilir olduğunu belirle
  const canEditWidth = ['box', 'rectangle2d', 'polyline2d', 'polygon2d', 'polyline3d', 'polygon3d'].includes(editedShape.type);
  const canEditHeight = true; // Tüm şekillerde yükseklik düzenlenebilir
  const canEditDepth = ['box', 'rectangle2d', 'polyline2d', 'polygon2d', 'polyline3d', 'polygon3d'].includes(editedShape.type);

  useEffect(() => {
    // editedShape veya boyutları dışarıdan değiştiğinde yerel durumu güncelle
    // Yine küsuratsız gösterilir (toFixed(0)).
    setInputWidth(convertToDisplayUnit(currentWidth).toFixed(0));
    setInputHeight(convertToDisplayUnit(currentHeight).toFixed(0));
    setInputDepth(convertToDisplayUnit(currentDepth).toFixed(0));
  }, [currentWidth, currentHeight, currentDepth, convertToDisplayUnit]);

  // Sayısal, ondalık, +, -, *, /, ( ) girişlere izin veren doğrulama fonksiyonu
  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    // Sayıları, ondalık noktayı, +, -, *, /, parantezleri ve boşlukları kabul eden regex.
    // Bu sayede kullanıcı hem tam sayı, hem ondalık sayı, hem de matematiksel ifadeler girebilir.
    const regex = /^[0-9+\-*/().\s]*$/;
    if (regex.test(value) || value === '') {
      setter(value);
    }
  };

  // Matematiksel ifadeyi değerlendirip sonucu döndüren yardımcı fonksiyon
  const evaluateExpression = (expression: string): number | null => {
    try {
      // Güvenlik uyarısı: eval() kullanmak güvenlik açıkları oluşturabilir.
      // Güvenli bir uygulama için daha robust bir matematiksel ifade ayrıştırıcı kütüphane kullanılması önerilir.
      // Bu uygulama yerel olduğundan ve kullanıcı girdisi kısıtlı olduğundan şimdilik kullanılmıştır.
      const result = eval(expression);
      if (typeof result === 'number' && isFinite(result)) {
        return result;
      }
      return null;
    } catch (e) {
      console.error("Matematiksel ifade değerlendirilirken hata oluştu:", e);
      return null;
    }
  };

  const applyDimensionChange = (
    dimension: 'width' | 'height' | 'depth',
    value: string
  ) => {
    // Girilen değeri (matematiksel ifade de olabilir) değerlendir.
    const evaluatedValue = evaluateExpression(value);

    // Değerlendirme sonucu geçersizse veya pozitif bir sayı değilse uyarı ver ve işlemi durdur.
    if (evaluatedValue === null || isNaN(evaluatedValue) || evaluatedValue <= 0) {
      console.warn(`Geçersiz değer veya matematiksel ifade ${dimension} için: ${value}. Pozitif bir sayı olmalı.`);
      // Giriş alanını son geçerli değere sıfırla (küsuratsız olarak).
      if (dimension === 'width') setInputWidth(convertToDisplayUnit(currentWidth).toFixed(0));
      if (dimension === 'height') setInputHeight(convertToDisplayUnit(currentHeight).toFixed(0));
      if (dimension === 'depth') setInputDepth(convertToDisplayUnit(currentDepth).toFixed(0));
      return;
    }

    const newValue = convertToBaseUnit(evaluatedValue);

    editedShape.geometry.computeBoundingBox();
    const bbox = editedShape.geometry.boundingBox;

    const currentScale = [...editedShape.scale];
    const newScale = [...currentScale];

    let originalDimension = 0;

    if (dimension === 'width') {
      originalDimension = (bbox.max.x - bbox.min.x) * currentScale[0];
      if (originalDimension === 0) originalDimension = 1;
      newScale[0] = (newValue / originalDimension) * currentScale[0];
    } else if (dimension === 'height') {
      originalDimension = (bbox.max.y - bbox.min.y) * currentScale[1];
      if (originalDimension === 0) originalDimension = 1;
      newScale[1] = (newValue / originalDimension) * currentScale[1];
    } else if (dimension === 'depth') {
      originalDimension = (bbox.max.z - bbox.min.z) * currentScale[2];
      if (originalDimension === 0) originalDimension = 1;
      newScale[2] = (newValue / originalDimension) * currentScale[2];
    }

    updateShape(editedShape.id, {
      scale: newScale as [number, number, number],
    });
  };

  return (
    <>
      <div className="flex items-center justify-between h-10 px-3 bg-orange-50 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <Puzzle size={11} className="text-orange-600" />
          <span className="text-xs font-medium text-orange-800">Volume Parameters</span>
        </div>
        <button
          onClick={onClose}
          className="text-stone-600 hover:text-orange-600 p-1.5 rounded-sm transition-colors"
          title="Back"
        >
          <X size={11} />
        </button>
      </div>

      <div className="flex-1 p-4 space-y-2">
        <div className="space-y-2">
          {canEditWidth && (
            <div className="flex items-center gap-2 h-10">
              <span className="text-slate-700 text-xs font-medium w-4">W:</span>
              <input
                type="text"
                value={inputWidth}
                onChange={(e) => handleInputChange(setInputWidth, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyDimensionChange('width', inputWidth);
                  }
                }}
                className="flex-1 h-6 bg-white text-slate-800 text-xs font-medium px-2 rounded-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => applyDimensionChange('width', inputWidth)}
                className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-sm transition-colors"
                title="Apply Width"
              >
                <Check size={11} />
              </button>
            </div>
          )}

          {canEditHeight && (
            <div className="flex items-center gap-2 h-10">
              <span className="text-slate-700 text-xs font-medium w-4">H:</span>
              <input
                type="text"
                value={inputHeight}
                onChange={(e) => handleInputChange(setInputHeight, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyDimensionChange('height', inputHeight);
                  }
                }}
                className="flex-1 h-6 bg-white text-slate-800 text-xs font-medium px-2 rounded-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => applyDimensionChange('height', inputHeight)}
                className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-sm transition-colors"
                title="Apply Height"
              >
                <Check size={11} />
              </button>
            </div>
          )}

          {canEditDepth && (
            <div className="flex items-center gap-2 h-10">
              <span className="text-slate-700 text-xs font-medium w-4">D:</span>
              <input
                type="text"
                value={inputDepth}
                onChange={(e) => handleInputChange(setInputDepth, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyDimensionChange('depth', inputDepth);
                  }
                }}
                className="flex-1 h-6 bg-white text-slate-800 text-xs font-medium px-2 rounded-sm border border-gray-300 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => applyDimensionChange('depth', inputDepth)}
                className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-sm transition-colors"
                title="Apply Depth"
              >
                <Check size={11} />
              </button>
            </div>
          )}

          {editedShape.type === 'cylinder' && (
            <div className="text-xs text-slate-600 mt-2 p-2 bg-orange-50 rounded-sm">
              Cylinder: Only height can be edited
            </div>
          )}

          {editedShape.type === 'circle2d' && (
            <div className="text-xs text-slate-600 mt-2 p-2 bg-orange-50 rounded-sm">
              Circle: Only height can be edited
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Module;
