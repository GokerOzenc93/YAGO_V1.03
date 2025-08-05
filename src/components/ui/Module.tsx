import React, { useMemo } from 'react';
import { X, Puzzle } from 'lucide-react';
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
    editedShape.geometry.computeBoundingBox();
    const bbox = editedShape.geometry.boundingBox;

    // Bounding box boyutlarını mevcut ölçekle çarpılarak gerçek dünya boyutları elde edilir
    const width = (bbox.max.x - bbox.min.x) * editedShape.scale[0];
    const height = (bbox.max.y - bbox.min.y) * editedShape.scale[1];
    const depth = (bbox.max.z - bbox.min.z) * editedShape.scale[2];

    return {
      currentWidth: width,
      currentHeight: height,
      currentDepth: depth,
    };
  }, [editedShape.geometry, editedShape.scale]); // Geometri veya ölçek değiştiğinde yeniden hesapla

  // Boyut değişikliklerini işler.
  // Kullanıcı bir boyutu değiştirdiğinde, nesnenin mevcut geometrisini
  // yeni boyuta göre ölçekler.
  const handleDimensionChange = (
    dimension: 'width' | 'height' | 'depth',
    value: string
  ) => {
    const newValue = convertToBaseUnit(parseFloat(value) || 0);
    // Geçersiz veya sıfır/negatif değerleri yoksay
    if (isNaN(newValue) || newValue <= 0) return;

    // Ölçekleme yapmadan önce bounding box'ın hesaplandığından emin ol
    editedShape.geometry.computeBoundingBox();
    const bbox = editedShape.geometry.boundingBox;

    const currentScale = [...editedShape.scale];
    const newScale = [...currentScale];

    let originalDimension = 0; // Mevcut ölçeklenmiş boyut

    // Hangi boyutun değiştiğine bağlı olarak ölçek faktörünü hesapla
    if (dimension === 'width') {
      originalDimension = (bbox.max.x - bbox.min.x) * currentScale[0];
      if (originalDimension === 0) originalDimension = 1; // Sıfıra bölmeyi önle
      newScale[0] = (newValue / originalDimension) * currentScale[0];
    } else if (dimension === 'height') {
      originalDimension = (bbox.max.y - bbox.min.y) * currentScale[1];
      if (originalDimension === 0) originalDimension = 1; // Sıfıra bölmeyi önle
      newScale[1] = (newValue / originalDimension) * currentScale[1];
    } else if (dimension === 'depth') {
      originalDimension = (bbox.max.z - bbox.min.z) * currentScale[2];
      if (originalDimension === 0) originalDimension = 1; // Sıfıra bölmeyi önle
      newScale[2] = (newValue / originalDimension) * currentScale[2];
    }

    // Şekli yeni ölçek değerleriyle güncelle
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
          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-4">G:</span> {/* Genişlik */}
            <input
              type="number"
              value={convertToDisplayUnit(currentWidth).toFixed(1)}
              onChange={(e) => handleDimensionChange('width', e.target.value)}
              className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
              step="0.1"
              min="1"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-4">Y:</span> {/* Yükseklik */}
            <input
              type="number"
              value={convertToDisplayUnit(currentHeight).toFixed(1)}
              onChange={(e) => handleDimensionChange('height', e.target.value)}
              className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
              step="0.1"
              min="1"
            />
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-300 text-xs w-4">D:</span> {/* Derinlik */}
            <input
              type="number"
              value={convertToDisplayUnit(currentDepth).toFixed(1)}
              onChange={(e) => handleDimensionChange('depth', e.target.value)}
              className="flex-1 bg-gray-800/50 text-white text-xs px-2 py-1 rounded border border-gray-600/50 focus:outline-none focus:border-violet-500/50"
              step="0.1"
              min="1"
            />
          </div>
        </div>
      </div>
    </>
  );
};

export default Module;
```
---
Bu güncelleme ile, `Module` panelindeki boyut giriş alanları artık düzenlenmekte olan nesnenin **gerçek geometrik sınırlarını** yansıtacak. Kullanıcı bu değerleri değiştirdiğinde ise, nesnenin temel geometrisi korunarak yalnızca **ölçekleme** işlemi uygulanacaktır. Bu, özellikle polylinelar gibi önceden tanımlanmış `width`, `height`, `depth` parametreleri olmayan nesneler için daha doğru ve esnek bir düzenleme deneyimi sağlar.

Uygulamanızda bu değişiklikleri test edebilirsiniz. Başka bir şeye ihtiyacınız olursa çekinmey