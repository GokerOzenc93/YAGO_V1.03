import React, { useMemo, useState, useEffect } from 'react';
import { X, Puzzle, Check, Plus } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import * as THREE from 'three';

interface CustomParameter {
  id: string;
  description: string;
  value: string;
  result: string | null;
}

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

  // Custom parameters state
  const [customParameters, setCustomParameters] = useState<CustomParameter[]>([]);

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

  const handleAddParameter = () => {
    const newParam: CustomParameter = {
      id: `param_${Date.now()}`,
      description: '',
      value: '',
      result: null
    };
    setCustomParameters(prev => [...prev, newParam]);
  };

  const handleRemoveParameter = (id: string) => {
    setCustomParameters(prev => prev.filter(param => param.id !== id));
  };

  const handleParameterDescriptionChange = (id: string, description: string) => {
    setCustomParameters(prev => prev.map(param =>
      param.id === id ? { ...param, description } : param
    ));
  };

  const handleParameterValueChange = (id: string, value: string) => {
    const regex = /^[0-9+\-*/().\s]*$/;
    if (regex.test(value) || value === '') {
      setCustomParameters(prev => prev.map(param =>
        param.id === id ? { ...param, value, result: null } : param
      ));
    }
  };

  const handleApplyParameter = (id: string) => {
    const param = customParameters.find(p => p.id === id);
    if (!param || !param.value.trim()) return;

    const evaluatedValue = evaluateExpression(param.value);
    if (evaluatedValue === null || isNaN(evaluatedValue)) {
      console.warn(`Invalid expression for parameter ${id}: ${param.value}`);
      return;
    }

    const displayValue = convertToDisplayUnit(evaluatedValue).toFixed(2);
    setCustomParameters(prev => prev.map(p =>
      p.id === id ? { ...p, result: displayValue } : p
    ));

    console.log(`✅ Parameter applied: ${param.description} = ${param.value} = ${displayValue}`);
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
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-medium text-slate-700">Basic Dimensions</span>
            <button
              onClick={handleAddParameter}
              className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-sm transition-colors"
              title="Add Custom Parameter"
            >
              <Plus size={11} />
            </button>
          </div>

          {canEditWidth && (
            <div className="flex items-center gap-2 h-10 px-2 rounded-md border border-gray-200 bg-gray-50/50">
              <input
                type="text"
                value="W"
                disabled
                className="w-24 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-black font-medium text-center"
              />
              <input
                type="text"
                value={inputWidth}
                onChange={(e) => handleInputChange(setInputWidth, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyDimensionChange('width', inputWidth);
                  }
                }}
                placeholder="Formula..."
                className="flex-1 min-w-0 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 text-black font-medium"
              />
              <span className="text-xs font-medium text-green-600 whitespace-nowrap">
                = {inputWidth ? evaluateExpression(inputWidth)?.toFixed(2) || inputWidth : '0'}
              </span>
              <button
                onClick={() => applyDimensionChange('width', inputWidth)}
                disabled={!inputWidth.trim()}
                className={`flex-shrink-0 p-1.5 rounded-sm transition-colors ${
                  inputWidth.trim()
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title="Apply Width"
              >
                <Check size={11} />
              </button>

              <button
                disabled
                className="flex-shrink-0 p-1.5 bg-gray-100 text-gray-400 rounded-sm cursor-not-allowed"
                title="Cannot remove basic dimension"
              >
                <X size={11} />
              </button>
            </div>
          )}

          {canEditHeight && (
            <div className="flex items-center gap-2 h-10 px-2 rounded-md border border-gray-200 bg-gray-50/50">
              <input
                type="text"
                value="H"
                disabled
                className="w-24 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-black font-medium text-center"
              />
              <input
                type="text"
                value={inputHeight}
                onChange={(e) => handleInputChange(setInputHeight, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyDimensionChange('height', inputHeight);
                  }
                }}
                placeholder="Formula..."
                className="flex-1 min-w-0 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 text-black font-medium"
              />
              <span className="text-xs font-medium text-green-600 whitespace-nowrap">
                = {inputHeight ? evaluateExpression(inputHeight)?.toFixed(2) || inputHeight : '0'}
              </span>
              <button
                onClick={() => applyDimensionChange('height', inputHeight)}
                disabled={!inputHeight.trim()}
                className={`flex-shrink-0 p-1.5 rounded-sm transition-colors ${
                  inputHeight.trim()
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title="Apply Height"
              >
                <Check size={11} />
              </button>

              <button
                disabled
                className="flex-shrink-0 p-1.5 bg-gray-100 text-gray-400 rounded-sm cursor-not-allowed"
                title="Cannot remove basic dimension"
              >
                <X size={11} />
              </button>
            </div>
          )}

          {canEditDepth && (
            <div className="flex items-center gap-2 h-10 px-2 rounded-md border border-gray-200 bg-gray-50/50">
              <input
                type="text"
                value="D"
                disabled
                className="w-24 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-black font-medium text-center"
              />
              <input
                type="text"
                value={inputDepth}
                onChange={(e) => handleInputChange(setInputDepth, e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    applyDimensionChange('depth', inputDepth);
                  }
                }}
                placeholder="Formula..."
                className="flex-1 min-w-0 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 text-black font-medium"
              />
              <span className="text-xs font-medium text-green-600 whitespace-nowrap">
                = {inputDepth ? evaluateExpression(inputDepth)?.toFixed(2) || inputDepth : '0'}
              </span>
              <button
                onClick={() => applyDimensionChange('depth', inputDepth)}
                disabled={!inputDepth.trim()}
                className={`flex-shrink-0 p-1.5 rounded-sm transition-colors ${
                  inputDepth.trim()
                    ? 'bg-green-600 hover:bg-green-700 text-white'
                    : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                }`}
                title="Apply Depth"
              >
                <Check size={11} />
              </button>

              <button
                disabled
                className="flex-shrink-0 p-1.5 bg-gray-100 text-gray-400 rounded-sm cursor-not-allowed"
                title="Cannot remove basic dimension"
              >
                <X size={11} />
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

        {customParameters.length > 0 && (
          <div className="space-y-2 mt-4 pt-4 border-t border-gray-200">
            <span className="text-xs font-medium text-slate-700">Custom Parameters</span>
            {customParameters.map((param) => (
              <div
                key={param.id}
                className="flex items-center gap-2 h-10 px-2 rounded-md border border-gray-200 bg-gray-50/50"
              >
                <input
                  type="text"
                  value={param.description}
                  onChange={(e) => handleParameterDescriptionChange(param.id, e.target.value)}
                  placeholder="Description..."
                  className="w-24 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 text-black font-medium"
                />

                <input
                  type="text"
                  value={param.value}
                  onChange={(e) => handleParameterValueChange(param.id, e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      handleApplyParameter(param.id);
                    }
                  }}
                  placeholder="Value..."
                  className="flex-1 min-w-0 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 text-black font-medium"
                />

                {param.result && (
                  <span className="text-xs font-medium text-green-600 whitespace-nowrap">
                    = {param.result}
                  </span>
                )}

                <button
                  onClick={() => handleApplyParameter(param.id)}
                  disabled={!param.value.trim()}
                  className={`flex-shrink-0 p-1.5 rounded-sm transition-colors ${
                    param.value.trim()
                      ? 'bg-green-600 hover:bg-green-700 text-white'
                      : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                  }`}
                  title="Apply Parameter"
                >
                  <Check size={11} />
                </button>

                <button
                  onClick={() => handleRemoveParameter(param.id)}
                  className="flex-shrink-0 p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-sm transition-colors"
                  title="Remove Parameter"
                >
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
};

export default Module;
