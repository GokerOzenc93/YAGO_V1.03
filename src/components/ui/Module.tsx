import React, { useMemo, useState, useEffect } from 'react';
import { X, Puzzle, Check, Plus, ChevronLeft, Ruler } from 'lucide-react';
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

  const canEditWidth = ['box', 'rectangle2d', 'polyline2d', 'polygon2d', 'polyline3d', 'polygon3d'].includes(editedShape.type);
  const canEditHeight = true;
  const canEditDepth = ['box', 'rectangle2d', 'polyline2d', 'polygon2d', 'polyline3d', 'polygon3d'].includes(editedShape.type);

  useEffect(() => {
    setInputWidth(convertToDisplayUnit(currentWidth).toFixed(0));
    setInputHeight(convertToDisplayUnit(currentHeight).toFixed(0));
    setInputDepth(convertToDisplayUnit(currentDepth).toFixed(0));
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

      processedExpression = processedExpression.replace(/\bW\b/g, convertToDisplayUnit(currentWidth).toString());
      processedExpression = processedExpression.replace(/\bH\b/g, convertToDisplayUnit(currentHeight).toString());
      processedExpression = processedExpression.replace(/\bD\b/g, convertToDisplayUnit(currentDepth).toString());

      customParameters.forEach(param => {
        if (param.description && param.result) {
          const regex = new RegExp(`\\b${param.description}\\b`, 'g');
          processedExpression = processedExpression.replace(regex, param.result);
        }
      });

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
      if (dimension === 'width') setInputWidth(convertToDisplayUnit(currentWidth).toFixed(0));
      if (dimension === 'height') setInputHeight(convertToDisplayUnit(currentHeight).toFixed(0));
      if (dimension === 'depth') setInputDepth(convertToDisplayUnit(currentDepth).toFixed(0));
      return;
    }

    if (dimension === 'width') setResultWidth(evaluatedValue.toFixed(2));
    if (dimension === 'height') setResultHeight(evaluatedValue.toFixed(2));
    if (dimension === 'depth') setResultDepth(evaluatedValue.toFixed(2));

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
            onClick={onClose}
            className="p-1.5 hover:bg-orange-200 rounded-sm transition-colors"
          >
            <ChevronLeft size={11} className="text-orange-600" />
          </button>
          <Ruler size={11} className="text-orange-600" />
          <span className="text-xs font-medium text-orange-800">Volume Parameters</span>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-4">

        <div className="bg-white rounded-md border border-stone-200 p-2">
          <div className="flex items-center justify-between h-10">
            <div className="flex items-center gap-2">
              <button
                onClick={handleAddParameter}
                className="p-1.5 bg-green-600 hover:bg-green-700 text-white rounded-sm transition-colors"
                title="Add Custom Parameter"
              >
                <Plus size={11} />
              </button>
              <span className="text-xs font-medium text-gray-700">Add Parameter</span>
            </div>

            {customParameters.length > 0 && (
              <button
                onClick={handleClearAllParameters}
                className="h-6 px-2 text-xs font-medium text-red-600 hover:text-red-800 rounded-sm hover:bg-red-50 transition-colors"
              >
                Clear All
              </button>
            )}
          </div>
        </div>

        <div className="bg-white rounded-md border border-stone-200 p-2">
          <div className="mb-2">
            <h4 className="text-xs font-medium text-slate-800">Parameters</h4>
          </div>

          <div className="space-y-2">
            {canEditWidth && (
              <div className="flex items-center gap-2 h-10 rounded-md border border-gray-200 bg-gray-50/50 overflow-hidden">
                <div className="flex-shrink-0 w-1 h-full bg-gradient-to-b from-orange-400 to-orange-500"></div>
                <div className="flex items-center gap-2 flex-1 pr-2 min-w-0">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white text-xs font-bold flex items-center justify-center shadow-sm border border-orange-300">
                  1
                </div>

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
                  className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
                  placeholder="Result"
                />

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => applyDimensionChange('width', inputWidth)}
                    disabled={!inputWidth.trim()}
                    className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
                      inputWidth.trim()
                        ? 'bg-green-600 text-white hover:bg-green-700'
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
              <div className="flex items-center gap-2 h-10 rounded-md border border-gray-200 bg-gray-50/50 overflow-hidden">
                <div className="flex-shrink-0 w-1 h-full bg-gradient-to-b from-orange-400 to-orange-500"></div>
                <div className="flex items-center gap-2 flex-1 pr-2 min-w-0">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white text-xs font-bold flex items-center justify-center shadow-sm border border-orange-300">
                  2
                </div>

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
                  className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
                  placeholder="Result"
                />

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => applyDimensionChange('height', inputHeight)}
                    disabled={!inputHeight.trim()}
                    className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
                      inputHeight.trim()
                        ? 'bg-green-600 text-white hover:bg-green-700'
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
              <div className="flex items-center gap-2 h-10 rounded-md border border-gray-200 bg-gray-50/50 overflow-hidden">
                <div className="flex-shrink-0 w-1 h-full bg-gradient-to-b from-orange-400 to-orange-500"></div>
                <div className="flex items-center gap-2 flex-1 pr-2 min-w-0">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white text-xs font-bold flex items-center justify-center shadow-sm border border-orange-300">
                  3
                </div>

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
                  className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
                  placeholder="Result"
                />

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => applyDimensionChange('depth', inputDepth)}
                    disabled={!inputDepth.trim()}
                    className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
                      inputDepth.trim()
                        ? 'bg-green-600 text-white hover:bg-green-700'
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
                className="flex items-center gap-2 h-10 rounded-md border border-gray-200 bg-gray-50/50 overflow-hidden"
              >
                <div className="flex-shrink-0 w-1 h-full bg-gradient-to-b from-orange-400 to-orange-500"></div>
                <div className="flex items-center gap-2 flex-1 pr-2 min-w-0">
                <div className="flex-shrink-0 w-5 h-5 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white text-xs font-bold flex items-center justify-center shadow-sm border border-orange-300">
                  {index + 4}
                </div>

                <input
                  type="text"
                  value={param.description}
                  onChange={(e) => handleParameterDescriptionChange(param.id, e.target.value)}
                  placeholder="Code"
                  className="w-16 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 text-black font-medium"
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
                  className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
                  placeholder="Result"
                />

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => handleApplyParameter(param.id)}
                    disabled={!param.value.trim()}
                    className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
                      param.value.trim()
                        ? 'bg-green-600 text-white hover:bg-green-700'
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
      </div>
    </div>
  );
};

export default Module;
