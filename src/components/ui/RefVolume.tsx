import React, { useMemo, useState, useEffect } from 'react';
import { X, Check, Plus, ChevronLeft, Ruler } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import * as THREE from 'three';

interface CustomParameter {
  id: string;
  description: string;
  value: string;
  result: string | null;
}

interface RefVolumeProps {
  editedShape: Shape;
  onClose: () => void;
}

const RefVolume: React.FC<RefVolumeProps> = ({ editedShape, onClose }) => {
  const {
    convertToDisplayUnit,
    convertToBaseUnit,
    updateShape,
    setVisibleDimensions,
    isRulerMode,
    setIsRulerMode,
    selectedLines,
    addSelectedLine,
    removeSelectedLine,
    updateSelectedLineValue,
    clearSelectedLines,
    shapes
  } = useAppStore();

  const { currentWidth, currentHeight, currentDepth } = useMemo(() => {
    if (!editedShape.geometry) {
      return { currentWidth: 0, currentHeight: 0, currentDepth: 0 };
    }

    editedShape.geometry.computeBoundingBox();
    const bbox = editedShape.geometry.boundingBox;

    if (!bbox) {
      console.warn('Geometry bounding box hesaplanamadı, varsayılan değerler kullanılıyor');
      return { currentWidth: 500, currentHeight: 500, currentDepth: 500 };
    }

    const width = (bbox.max.x - bbox.min.x) * editedShape.scale[0];
    const height = (bbox.max.y - bbox.min.y) * editedShape.scale[1];
    const depth = (bbox.max.z - bbox.min.z) * editedShape.scale[2];

    return {
      currentWidth: width,
      currentHeight: height,
      currentDepth: depth,
    };
  }, [editedShape.geometry, editedShape.scale]);

  const [inputWidth, setInputWidth] = useState(convertToDisplayUnit(currentWidth).toFixed(0));
  const [inputHeight, setInputHeight] = useState(convertToDisplayUnit(currentHeight).toFixed(0));
  const [inputDepth, setInputDepth] = useState(convertToDisplayUnit(currentDepth).toFixed(0));

  const [resultWidth, setResultWidth] = useState<string>('');
  const [resultHeight, setResultHeight] = useState<string>('');
  const [resultDepth, setResultDepth] = useState<string>('');

  const [customParameters, setCustomParameters] = useState<CustomParameter[]>([]);
  const [selectedDimensions, setSelectedDimensions] = useState<Set<string>>(new Set());
  const [editingLineId, setEditingLineId] = useState<string | null>(null);
  const [editingLineValue, setEditingLineValue] = useState<string>('');

  useEffect(() => {
    setVisibleDimensions(selectedDimensions);
  }, [selectedDimensions, setVisibleDimensions]);

  useEffect(() => {
    return () => {
      clearSelectedLines();
    };
  }, [clearSelectedLines]);

  const canEditWidth = ['box', 'rectangle2d', 'polyline2d', 'polygon2d', 'polyline3d', 'polygon3d'].includes(editedShape.type);
  const canEditHeight = true;
  const canEditDepth = ['box', 'rectangle2d', 'polyline2d', 'polygon2d', 'polyline3d', 'polygon3d'].includes(editedShape.type);

  useEffect(() => {
    if (!inputWidth) setInputWidth(convertToDisplayUnit(currentWidth).toFixed(0));
    if (!inputHeight) setInputHeight(convertToDisplayUnit(currentHeight).toFixed(0));
    if (!inputDepth) setInputDepth(convertToDisplayUnit(currentDepth).toFixed(0));
    setResultWidth(convertToDisplayUnit(currentWidth).toFixed(2));
    setResultHeight(convertToDisplayUnit(currentHeight).toFixed(2));
    setResultDepth(convertToDisplayUnit(currentDepth).toFixed(2));
  }, [currentWidth, currentHeight, currentDepth, convertToDisplayUnit]);

  const handleInputChange = (setter: React.Dispatch<React.SetStateAction<string>>, value: string) => {
    const regex = /^[0-9a-zA-Z+\-*/().\s]*$/;
    if (regex.test(value) || value === '') {
      setter(value);
    }
  };

  const evaluateExpression = (expression: string): number | null => {
    try {
      let processedExpression = expression;
      const originalExpression = expression;

      processedExpression = processedExpression.replace(/\bW\b/g, convertToDisplayUnit(currentWidth).toString());
      processedExpression = processedExpression.replace(/\bH\b/g, convertToDisplayUnit(currentHeight).toString());
      processedExpression = processedExpression.replace(/\bD\b/g, convertToDisplayUnit(currentDepth).toString());

      customParameters.forEach(param => {
        if (param.description && param.result) {
          const regex = new RegExp(`\\b${param.description}\\b`, 'g');
          processedExpression = processedExpression.replace(regex, param.result);
        }
      });

      const undefinedParams = processedExpression.match(/\b[a-zA-Z][a-zA-Z0-9]*\b/g);
      if (undefinedParams && undefinedParams.length > 0) {
        const validFunctions = ['abs', 'acos', 'asin', 'atan', 'atan2', 'ceil', 'cos', 'exp', 'floor', 'log', 'max', 'min', 'pow', 'random', 'round', 'sin', 'sqrt', 'tan'];
        const invalidParams = undefinedParams.filter(param => !validFunctions.includes(param.toLowerCase()));

        if (invalidParams.length > 0) {
          alert(`Undefined parameter(s): ${invalidParams.join(', ')}\n\nPlease define these parameters first or check for typos.`);
          return null;
        }
      }

      const result = eval(processedExpression);
      if (typeof result === 'number' && isFinite(result)) {
        return result;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const applyDimensionChange = (
    dimension: 'width' | 'height' | 'depth',
    value: string
  ) => {
    const evaluatedValue = evaluateExpression(value);

    if (evaluatedValue === null || isNaN(evaluatedValue) || evaluatedValue <= 0) {
      return;
    }

    if (dimension === 'width') setResultWidth(evaluatedValue.toFixed(2));
    if (dimension === 'height') setResultHeight(evaluatedValue.toFixed(2));
    if (dimension === 'depth') setResultDepth(evaluatedValue.toFixed(2));

    const newValue = convertToBaseUnit(evaluatedValue);

    editedShape.geometry.computeBoundingBox();
    const bbox = editedShape.geometry.boundingBox;

    const currentScale = [...editedShape.scale];
    const originalScale = new THREE.Vector3(...currentScale);
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

    // 🎯 CRITICAL FIX: Geometry is now positioned with min corner at origin (0,0,0)
    // This means when we scale, it naturally grows in X+, Y+, Z+ directions!
    // We DON'T need to adjust position because the geometry's origin IS the min corner

    updateShape(editedShape.id, {
      scale: newScale as [number, number, number],
    });

    console.log(`🎯 RefVolume: ${dimension} changed, geometry scales from origin (min corner):`, {
      dimension,
      bbox: { min: [bbox.min.x, bbox.min.y, bbox.min.z], max: [bbox.max.x, bbox.max.y, bbox.max.z] },
      oldScale: originalScale.toArray(),
      newScale,
      position: editedShape.position
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

  const handleLineValueChange = (lineId: string, newValueStr: string) => {
    const newValue = parseFloat(newValueStr);
    if (isNaN(newValue) || newValue <= 0) {
      console.log('❌ Invalid value:', newValueStr);
      return;
    }

    const line = selectedLines.find(l => l.id === lineId);
    if (!line) {
      console.log('❌ Line not found:', lineId);
      return;
    }

    const shape = shapes.find(s => s.id === line.shapeId);
    if (!shape || !shape.geometry) {
      console.log('❌ Shape not found:', line.shapeId);
      return;
    }

    console.log('🔧 Updating line:', {
      lineId,
      oldValue: line.value,
      newValue,
      shapeId: shape.id,
      edgeIndex: line.edgeIndex
    });

    const oldLength = Math.sqrt(
      Math.pow(line.endVertex[0] - line.startVertex[0], 2) +
      Math.pow(line.endVertex[1] - line.startVertex[1], 2) +
      Math.pow(line.endVertex[2] - line.startVertex[2], 2)
    );

    const newLengthInBase = convertToBaseUnit(newValue);
    console.log('📏 Lengths:', { oldLength, newLengthInBase, displayValue: newValue });

    const direction = new THREE.Vector3(
      line.endVertex[0] - line.startVertex[0],
      line.endVertex[1] - line.startVertex[1],
      line.endVertex[2] - line.startVertex[2]
    ).normalize();

    const newEndVertex = new THREE.Vector3(
      line.startVertex[0] + direction.x * newLengthInBase,
      line.startVertex[1] + direction.y * newLengthInBase,
      line.startVertex[2] + direction.z * newLengthInBase
    );

    console.log('🎯 Vertices:', {
      start: line.startVertex,
      oldEnd: line.endVertex,
      newEnd: [newEndVertex.x, newEndVertex.y, newEndVertex.z]
    });

    const newGeometry = shape.geometry.clone();
    const positionAttr = newGeometry.attributes.position;
    const positions = positionAttr.array;
    let updatedCount = 0;

    for (let i = 0; i < positions.length; i += 3) {
      const vx = positions[i];
      const vy = positions[i + 1];
      const vz = positions[i + 2];

      const distToEnd = Math.sqrt(
        Math.pow(vx - line.endVertex[0], 2) +
        Math.pow(vy - line.endVertex[1], 2) +
        Math.pow(vz - line.endVertex[2], 2)
      );

      if (distToEnd < 0.01) {
        positions[i] = newEndVertex.x;
        positions[i + 1] = newEndVertex.y;
        positions[i + 2] = newEndVertex.z;
        updatedCount++;
        console.log(`✅ Updated vertex ${i/3}:`, [newEndVertex.x, newEndVertex.y, newEndVertex.z]);
      }
    }

    console.log(`📊 Updated ${updatedCount} vertices`);

    positionAttr.needsUpdate = true;
    newGeometry.computeBoundingBox();
    newGeometry.computeVertexNormals();

    updateShape(shape.id, {
      geometry: newGeometry
    });

    updateSelectedLineValue(lineId, newValue);

    setEditingLineId(null);
    setEditingLineValue('');

    console.log('✅ Geometry updated successfully');
  };

  const handleClearAllParameters = () => {
    setCustomParameters([]);
  };

  const handleParameterDescriptionChange = (id: string, description: string) => {
    setCustomParameters(prev => prev.map(param =>
      param.id === id ? { ...param, description } : param
    ));
  };

  const handleParameterValueChange = (id: string, value: string) => {
    const regex = /^[0-9a-zA-Z+\-*/().\s]*$/;
    if (regex.test(value) || value === '') {
      setCustomParameters(prev => prev.map(param =>
        param.id === id ? { ...param, value, result: null } : param
      ));
    }
  };

  const handleApplyParameter = (id: string) => {
    const param = customParameters.find(p => p.id === id);
    if (!param || !param.value.trim()) return;

    if (!param.description || !param.description.trim()) {
      alert('Please enter a code name for this parameter');
      return;
    }

    const codeRegex = /^[a-zA-Z][a-zA-Z0-9]*$/;
    if (!codeRegex.test(param.description)) {
      alert('Code must start with a letter and contain only letters and numbers');
      return;
    }

    const evaluatedValue = evaluateExpression(param.value);
    if (evaluatedValue === null || isNaN(evaluatedValue)) {
      alert('Invalid formula. Check if all referenced parameters have been applied.');
      return;
    }

    const displayValue = evaluatedValue.toFixed(2);
    setCustomParameters(prev => prev.map(p =>
      p.id === id ? { ...p, result: displayValue } : p
    ));
  };

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between h-10 px-3 bg-orange-50 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              clearSelectedLines();
              onClose();
            }}
            className="p-1.5 hover:bg-orange-200 rounded-sm transition-colors"
          >
            <ChevronLeft size={11} className="text-orange-600" />
          </button>
          <span className="text-xs font-medium text-orange-800">Volume Parameters</span>
        </div>
        <div className="flex items-center gap-2">
          {customParameters.length > 0 && (
            <button
              onClick={handleClearAllParameters}
              className="h-6 px-2 text-xs font-medium text-red-600 hover:text-red-800 rounded-sm hover:bg-red-50 transition-colors"
            >
              Clear All
            </button>
          )}
          <button
            onClick={handleAddParameter}
            className="p-1.5 hover:bg-orange-100 text-orange-600 rounded-sm transition-colors"
            title="Add Custom Parameter"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => {
              if (isRulerMode) {
                clearSelectedLines();
              }
              setIsRulerMode(!isRulerMode);
            }}
            className={`p-1.5 rounded-sm transition-colors ${
              isRulerMode
                ? 'bg-orange-500 text-white'
                : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
            }`}
            title="Ruler Mode - Select Lines"
          >
            <Ruler size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-2">

        <div className="bg-white rounded-md border border-stone-200 p-2">
          <div className="space-y-2">
            {canEditWidth && (
              <div className="flex items-center h-10 px-2 rounded-md border transition-all duration-200 border-orange-300 bg-orange-50/50 shadow-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={() => {
                    setSelectedDimensions(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has('width')) {
                        newSet.delete('width');
                      } else {
                        newSet.add('width');
                      }
                      return newSet;
                    });
                  }}
                  className={`flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shadow-sm border transition-colors ${
                    selectedDimensions.has('width')
                      ? 'bg-white text-orange-500 border-orange-300'
                      : 'bg-gradient-to-br from-orange-400 to-orange-500 text-white border-orange-300'
                  }`}
                >
                  1
                </button>

                <input
                  type="text"
                  value="W"
                  readOnly
                  className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 text-black font-medium cursor-default"
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

                <input
                  type="text"
                  value={resultWidth}
                  readOnly
                  className="flex-shrink-0 w-[57px] h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
                  placeholder="Result"
                />

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => applyDimensionChange('width', inputWidth)}
                    disabled={!inputWidth.trim()}
                    className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
                      inputWidth.trim()
                        ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Apply Width"
                  >
                    <Check size={11} />
                  </button>

                  <button
                    onClick={() => handleRemoveParameter('')}
                    disabled
                    className="flex-shrink-0 p-1.5 bg-gray-100 text-gray-400 rounded-sm cursor-not-allowed"
                    title="Cannot remove basic dimension"
                  >
                    <X size={11} />
                  </button>
                </div>
                </div>
              </div>
            )}

            {canEditHeight && (
              <div className="flex items-center h-10 px-2 rounded-md border transition-all duration-200 border-orange-300 bg-orange-50/50 shadow-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={() => {
                    setSelectedDimensions(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has('height')) {
                        newSet.delete('height');
                      } else {
                        newSet.add('height');
                      }
                      return newSet;
                    });
                  }}
                  className={`flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shadow-sm border transition-colors ${
                    selectedDimensions.has('height')
                      ? 'bg-white text-orange-500 border-orange-300'
                      : 'bg-gradient-to-br from-orange-400 to-orange-500 text-white border-orange-300'
                  }`}
                >
                  2
                </button>

                <input
                  type="text"
                  value="H"
                  readOnly
                  className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 text-black font-medium cursor-default"
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

                <input
                  type="text"
                  value={resultHeight}
                  readOnly
                  className="flex-shrink-0 w-[57px] h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
                  placeholder="Result"
                />

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => applyDimensionChange('height', inputHeight)}
                    disabled={!inputHeight.trim()}
                    className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
                      inputHeight.trim()
                        ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Apply Height"
                  >
                    <Check size={11} />
                  </button>

                  <button
                    onClick={() => handleRemoveParameter('')}
                    disabled
                    className="flex-shrink-0 p-1.5 bg-gray-100 text-gray-400 rounded-sm cursor-not-allowed"
                    title="Cannot remove basic dimension"
                  >
                    <X size={11} />
                  </button>
                </div>
                </div>
              </div>
            )}

            {canEditDepth && (
              <div className="flex items-center h-10 px-2 rounded-md border transition-all duration-200 border-orange-300 bg-orange-50/50 shadow-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={() => {
                    setSelectedDimensions(prev => {
                      const newSet = new Set(prev);
                      if (newSet.has('depth')) {
                        newSet.delete('depth');
                      } else {
                        newSet.add('depth');
                      }
                      return newSet;
                    });
                  }}
                  className={`flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shadow-sm border transition-colors ${
                    selectedDimensions.has('depth')
                      ? 'bg-white text-orange-500 border-orange-300'
                      : 'bg-gradient-to-br from-orange-400 to-orange-500 text-white border-orange-300'
                  }`}
                >
                  3
                </button>

                <input
                  type="text"
                  value="D"
                  readOnly
                  className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 text-black font-medium cursor-default"
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

                <input
                  type="text"
                  value={resultDepth}
                  readOnly
                  className="flex-shrink-0 w-[57px] h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
                  placeholder="Result"
                />

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => applyDimensionChange('depth', inputDepth)}
                    disabled={!inputDepth.trim()}
                    className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
                      inputDepth.trim()
                        ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                    title="Apply Depth"
                  >
                    <Check size={11} />
                  </button>

                  <button
                    onClick={() => handleRemoveParameter('')}
                    disabled
                    className="flex-shrink-0 p-1.5 bg-gray-100 text-gray-400 rounded-sm cursor-not-allowed"
                    title="Cannot remove basic dimension"
                  >
                    <X size={11} />
                  </button>
                </div>
                </div>
              </div>
            )}

            {customParameters.map((param, index) => (
              <div
                key={param.id}
                className="flex items-center h-10 px-2 rounded-md border transition-all duration-200 border-orange-300 bg-orange-50/50 shadow-sm"
              >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                <button
                  onClick={() => {
                    setSelectedDimensions(prev => {
                      const newSet = new Set(prev);
                      const paramKey = `param-${param.id}`;
                      if (newSet.has(paramKey)) {
                        newSet.delete(paramKey);
                      } else {
                        newSet.add(paramKey);
                      }
                      return newSet;
                    });
                  }}
                  className={`flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shadow-sm border transition-colors ${
                    selectedDimensions.has(`param-${param.id}`)
                      ? 'bg-white text-orange-500 border-orange-300'
                      : 'bg-gradient-to-br from-orange-400 to-orange-500 text-white border-orange-300'
                  }`}
                >
                  {index + 4}
                </button>

                <input
                  type="text"
                  value={param.description}
                  onChange={(e) => handleParameterDescriptionChange(param.id, e.target.value)}
                  placeholder="Code"
                  className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 text-black font-medium"
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
                  placeholder="Formula..."
                  className="flex-1 min-w-0 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 text-black font-medium"
                />

                <input
                  type="text"
                  value={param.result || ''}
                  readOnly
                  className="flex-shrink-0 w-[57px] h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
                  placeholder="Result"
                />

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleApplyParameter(param.id)}
                    disabled={!param.value.trim()}
                    className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
                      param.value.trim()
                        ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
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
                </div>
              </div>
            ))}
          </div>
        </div>

        {editedShape.type === 'cylinder' && (
          <div className="text-xs text-slate-600 p-2 bg-orange-50 rounded-sm border border-orange-200">
            Cylinder: Only height can be edited
          </div>
        )}

        {editedShape.type === 'circle2d' && (
          <div className="text-xs text-slate-600 p-2 bg-orange-50 rounded-sm border border-orange-200">
            Circle: Only height can be edited
          </div>
        )}

        {selectedLines.length > 0 && (
          <div className="bg-white rounded-md border border-stone-200 p-2 mt-2">
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {selectedLines.map((line, index) => (
                <div
                  key={line.id}
                  className="flex items-center h-10 px-2 rounded-md border transition-all duration-200 border-orange-300 bg-orange-50/50 shadow-sm"
                >
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shadow-sm border bg-gradient-to-br from-blue-400 to-blue-500 text-white border-blue-300">
                      {index + 1}
                    </div>

                    <input
                      type="text"
                      value={line.label}
                      readOnly
                      className="flex-1 min-w-0 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-black font-medium cursor-default"
                    />

                    <input
                      type="text"
                      value={editingLineId === line.id ? editingLineValue : line.value.toFixed(2)}
                      onChange={(e) => {
                        if (editingLineId === line.id) {
                          setEditingLineValue(e.target.value);
                        }
                      }}
                      onFocus={() => {
                        setEditingLineId(line.id);
                        setEditingLineValue(line.value.toFixed(2));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editingLineId === line.id) {
                          handleLineValueChange(line.id, editingLineValue);
                        } else if (e.key === 'Escape') {
                          setEditingLineId(null);
                          setEditingLineValue('');
                        }
                      }}
                      className="flex-shrink-0 w-[57px] h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-400"
                    />

                    {editingLineId === line.id && (
                      <button
                        onClick={() => handleLineValueChange(line.id, editingLineValue)}
                        disabled={!editingLineValue.trim()}
                        className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
                          editingLineValue.trim()
                            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                        title="Apply Line Change"
                      >
                        <Check size={11} />
                      </button>
                    )}

                    <button
                      onClick={() => removeSelectedLine(line.id)}
                      className="flex-shrink-0 p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-sm transition-colors"
                      title="Remove Line"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default RefVolume;
