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
      <div className="flex items-center justify-between px-3 py-2 bg-violet-600/20 border-b border-violet-500/30">
        <div className="flex items-center gap-2">
          <div className="flex items-center justify-center w-6 h-6 bg-violet-600/30 rounded">
            <Puzzle size={12} className="text-violet-300" />
          </div>
          <span className="text-white font-medium text-sm">Modül</span>
        </div>
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-white p-1 rounded transition-colors"
          title="Geri"
        >
          <X size={12} />
        </button>
      </div>

      <div className="flex-1 p-3 space-y-3">
        <div className="h-px bg-gradient-to-r from-transparent via-violet-400/60 to-transparent mb-3"></div>

        <div className="space-y-2">
          {/* Genişlik */}
          {canEditWidth && (
            <div className="flex items-center gap-2">
              <span className="text-gray-300 text-xs w-4">G:</span>
              <input
                type="text" // Metin girişi olarak ayarlandı
                value={inputWidth}
                onChange={(e) => handleInputChange(setInputWidth, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyDimensionChange('width', inputWidth);
                  }
                }}
                className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => applyDimensionChange('width', inputWidth)}
                className="p-1 bg-violet-700/50 hover:bg-violet-600/70 text-white rounded transition-colors"
                title="Genişliği Onayla"
              >
                <Check size={12} />
              </button>
            </div>
          )}

          {/* Yükseklik */}
          {canEditHeight && (
            <div className="flex items-center gap-2">
              <span className="text-gray-300 text-xs w-4">Y:</span>
              <input
                type="text" // Metin girişi olarak ayarlandı
                value={inputHeight}
                onChange={(e) => handleInputChange(setInputHeight, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyDimensionChange('height', inputHeight);
                  }
                }}
                className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => applyDimensionChange('height', inputHeight)}
                className="p-1 bg-violet-700/50 hover:bg-violet-600/70 text-white rounded transition-colors"
                title="Yüksekliği Onayla"
              >
                <Check size={12} />
              </button>
            </div>
          )}

          {/* Derinlik */}
          {canEditDepth && (
            <div className="flex items-center gap-2">
              <span className="text-gray-300 text-xs w-4">D:</span>
              <input
                type="text" // Metin girişi olarak ayarlandı
                value={inputDepth}
                onChange={(e) => handleInputChange(setInputDepth, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyDimensionChange('depth', inputDepth);
                  }
                }}
                className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                onClick={() => applyDimensionChange('depth', inputDepth)}
                className="p-1 bg-violet-700/50 hover:bg-violet-600/70 text-white rounded transition-colors"
                title="Derinliği Onayla"
              >
                <Check size={12} />
              </button>
            </div>
          )}

          {/* Bilgi mesajı - sadece cylinder için */}
          {editedShape.type === 'cylinder' && (
            <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-800/30 rounded">
              Silindir: Sadece yükseklik düzenlenebilir
            </div>
          )}

          {/* Bilgi mesajı - circle2d için */}
          {editedShape.type === 'circle2d' && (
            <div className="text-xs text-gray-400 mt-2 p-2 bg-gray-800/30 rounded">
              Daire: Sadece yükseklik düzenlenebilir
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default Module;
            <span className="text-gray-300 text-xs w-4">G:</span>
            <input
              type="text" // Metin girişi olarak ayarlandı
              value={inputWidth}
              onChange={(e) => handleInputChange(setInputWidth, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyDimensionChange('width', inputWidth);
                }
              }}
              className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
            />
            <button
              onClick={() => applyDimensionChange('width', inputWidth)}
              className="p-1 bg-violet-700/50 hover:bg-violet-600/70 text-white rounded transition-colors"
              title="Genişliği Onayla"
            >
              <Check size={12} />
            </button>
          </div>

          {/* Yükseklik */}
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-4">Y:</span>
            <input
              type="text" // Metin girişi olarak ayarlandı
              value={inputHeight}
              onChange={(e) => handleInputChange(setInputHeight, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyDimensionChange('height', inputHeight);
                }
              }}
              className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
            />
            <button
              onClick={() => applyDimensionChange('height', inputHeight)}
              className="p-1 bg-violet-700/50 hover:bg-violet-600/70 text-white rounded transition-colors"
              title="Yüksekliği Onayla"
            >
              <Check size={12} />
            </button>
          </div>

          {/* Derinlik */}
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-4">D:</span>
            <input
              type="text" // Metin girişi olarak ayarlandı
              value={inputDepth}
              onChange={(e) => handleInputChange(setInputDepth, e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  applyDimensionChange('depth', inputDepth);
                }
              }}
              className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
            />
            <button
              onClick={() => applyDimensionChange('depth', inputDepth)}
              className="p-1 bg-violet-700/50 hover:bg-violet-600/70 text-white rounded transition-colors"
              title="Derinliği Onayla"
            >
              <Check size={12} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
};

export default Module;
