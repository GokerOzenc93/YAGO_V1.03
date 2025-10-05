import React, { useState, useEffect, useCallback } from 'react';
import { X, Check, Plus, ChevronLeft, Ruler } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import { useRefVolumeGeometry } from '../../hooks/useRefVolumeGeometry';
import { useRefVolumeFormulas } from '../../hooks/useRefVolumeFormulas';
import { useEdgeRecalculation } from '../../hooks/useEdgeRecalculation';

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
    updateSelectedLineValue,
    updateSelectedLineVertices,
    updateSelectedLineFormula,
    updateSelectedLineLabel,
    removeSelectedLine,
    shapes
  } = useAppStore();

  const { currentWidth, currentHeight, currentDepth, canEditWidth, canEditDepth } =
    useRefVolumeGeometry(editedShape);

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
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);

  const { formulaEvaluatorRef, syncFormulaVariables, evaluateExpression } =
    useRefVolumeFormulas(currentWidth, currentHeight, currentDepth, customParameters, selectedLines, convertToDisplayUnit);

  const { recalculateAllParameters } =
    useEdgeRecalculation(
      customParameters, setCustomParameters, selectedLines, shapes,
      convertToBaseUnit, convertToDisplayUnit,
      updateSelectedLineValue, updateSelectedLineVertices, updateShape,
      evaluateExpression, syncFormulaVariables, formulaEvaluatorRef
    );

  useEffect(() => {
    setVisibleDimensions(selectedDimensions);
  }, [selectedDimensions, setVisibleDimensions]);

  useEffect(() => {
    if (!inputWidth) setInputWidth(convertToDisplayUnit(currentWidth).toFixed(0));
    if (!inputHeight) setInputHeight(convertToDisplayUnit(currentHeight).toFixed(0));
    if (!inputDepth) setInputDepth(convertToDisplayUnit(currentDepth).toFixed(0));
    setResultWidth(convertToDisplayUnit(currentWidth).toFixed(2));
    setResultHeight(convertToDisplayUnit(currentHeight).toFixed(2));
    setResultDepth(convertToDisplayUnit(currentDepth).toFixed(2));
  }, [currentWidth, currentHeight, currentDepth, convertToDisplayUnit]);

  useEffect(() => {
    syncFormulaVariables();
    recalculateAllParameters();
  }, [currentWidth, currentHeight, currentDepth,
      JSON.stringify(customParameters.map(p => ({ d: p.description, v: p.value }))),
      JSON.stringify(selectedLines.map(l => ({ id: l.id, formula: l.formula }))),
      syncFormulaVariables]);

  const updateDimensionResult = (dimension: 'width' | 'height' | 'depth', input: string, setter: (val: string) => void) => {
    if (input && input !== convertToDisplayUnit(dimension === 'width' ? currentWidth : dimension === 'height' ? currentHeight : currentDepth).toFixed(0)) {
      const evaluated = evaluateExpression(input);
      if (evaluated !== null && !isNaN(evaluated) && evaluated > 0) {
        setter(evaluated.toFixed(2));
      }
    }
  };

  useEffect(() => updateDimensionResult('width', inputWidth, setResultWidth), [inputWidth, customParameters, selectedLines]);
  useEffect(() => updateDimensionResult('height', inputHeight, setResultHeight), [inputHeight, customParameters, selectedLines]);
  useEffect(() => updateDimensionResult('depth', inputDepth, setResultDepth), [inputDepth, customParameters, selectedLines]);

  const applyResultChange = (dimension: 'width' | 'height' | 'depth', result: string, current: number, canEdit: boolean) => {
    if (isApplyingChanges) return;
    const newValue = parseFloat(result);
    if (result && Math.abs(newValue - convertToDisplayUnit(current)) > 0.1 && !isNaN(newValue) && newValue > 0 && canEdit) {
      setIsApplyingChanges(true);
      applyDimensionChange(dimension, result);
      setTimeout(() => setIsApplyingChanges(false), 200);
    }
  };

  useEffect(() => applyResultChange('width', resultWidth, currentWidth, canEditWidth), [resultWidth]);
  useEffect(() => applyResultChange('height', resultHeight, currentHeight, true), [resultHeight]);
  useEffect(() => applyResultChange('depth', resultDepth, currentDepth, canEditDepth), [resultDepth]);

  const applyDimensionChange = (dimension: 'width' | 'height' | 'depth', value: string) => {
    const evaluated = evaluateExpression(value);
    if (evaluated === null || isNaN(evaluated) || evaluated <= 0) return;

    if (dimension === 'width') setResultWidth(evaluated.toFixed(2));
    else if (dimension === 'height') setResultHeight(evaluated.toFixed(2));
    else if (dimension === 'depth') setResultDepth(evaluated.toFixed(2));

    const baseValue = convertToBaseUnit(evaluated);
    const newGeometry = editedShape.geometry?.clone();
    if (!newGeometry) return;

    const scale = dimension === 'width' ? baseValue / currentWidth :
                  dimension === 'height' ? baseValue / currentHeight :
                  baseValue / currentDepth;

    const positions = newGeometry.attributes.position.array;
    for (let i = 0; i < positions.length; i += 3) {
      if (dimension === 'width') positions[i] *= scale;
      else if (dimension === 'height') positions[i + 1] *= scale;
      else if (dimension === 'depth') positions[i + 2] *= scale;
    }

    newGeometry.attributes.position.needsUpdate = true;
    newGeometry.computeBoundingBox();
    newGeometry.computeVertexNormals();
    updateShape(editedShape.id, { geometry: newGeometry });
  };

  const handleInputChange = (setter: (value: string) => void, value: string) => {
    if (value === '' || /^[0-9+\-*/().WwHhDdAaA-Za-z ]*$/.test(value)) {
      setter(value);
    }
  };

  const handleApplyParameter = (id: string) => {
    const param = customParameters.find(p => p.id === id);
    if (!param?.value.trim() || !param.description?.trim()) {
      alert('Please enter both code name and formula');
      return;
    }

    if (!/^[a-zA-Z][a-zA-Z0-9]*$/.test(param.description)) {
      alert('Code must start with a letter and contain only letters and numbers');
      return;
    }

    syncFormulaVariables();

    const evaluated = evaluateExpression(param.value, `param-${param.description}`);
    if (evaluated === null || isNaN(evaluated)) {
      alert('Invalid formula');
      return;
    }

    setCustomParameters(prev => prev.map(p =>
      p.id === id ? { ...p, result: evaluated.toFixed(2) } : p
    ));

    requestAnimationFrame(() => {
      const evaluator = formulaEvaluatorRef.current;
      evaluator.setVariable(param.description, evaluated);
      console.log(`✅ Parameter applied: ${param.description}=${evaluated}`);

      syncFormulaVariables();

      selectedLines.forEach(line => {
        if (line.formula?.trim()) {
          const lineEvaluated = evaluateExpression(line.formula, `edge-${line.label || line.id}`);
          if (lineEvaluated !== null && !isNaN(lineEvaluated) && lineEvaluated > 0) {
            const currentVal = parseFloat(line.value.toFixed(2));
            const newVal = parseFloat(lineEvaluated.toFixed(2));

            if (Math.abs(currentVal - newVal) > 0.01) {
              console.log(`🔄 Forcing edge update: ${line.label || line.id} from ${currentVal} to ${newVal}`);
              updateSelectedLineValue(line.id, newVal);
            }
          }
        }
      });

      recalculateAllParameters();
    });
  };

  const handleEdgeApply = (lineId: string, formula: string) => {
    syncFormulaVariables();

    const evaluated = evaluateExpression(formula, `edge-${lineId}`);
    if (evaluated === null || isNaN(evaluated) || evaluated <= 0) {
      console.warn(`⚠️ Invalid formula for edge ${lineId}: ${formula}`);
      return;
    }

    updateSelectedLineFormula(lineId, formula);

    requestAnimationFrame(() => {
      syncFormulaVariables();
      recalculateAllParameters();
    });

    setEditingLineId(null);
    setEditingLineValue('');
  };

  const renderDimensionInput = (
    label: string,
    code: string,
    input: string,
    setInput: (val: string) => void,
    result: string,
    dimension: 'width' | 'height' | 'depth',
    canEdit: boolean,
    index: number
  ) => (
    <div className="flex items-center h-10 px-2 rounded-md border border-stone-300 bg-white shadow-sm">
      <button
        onClick={() => {
          setSelectedDimensions(prev => {
            const newSet = new Set(prev);
            const key = `${dimension}-${editedShape.id}`;
            newSet.has(key) ? newSet.delete(key) : newSet.add(key);
            return newSet;
          });
        }}
        className={`flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shadow-sm border transition-colors ${
          selectedDimensions.has(`${dimension}-${editedShape.id}`)
            ? 'bg-white text-stone-500 border-stone-300'
            : 'bg-gradient-to-br from-stone-400 to-stone-500 text-white border-stone-300'
        }`}
      >
        {index}
      </button>

      <div className="flex-1 flex items-center gap-1 ml-2 min-w-0">
        <span className="text-xs font-medium text-black flex-shrink-0 w-10">{label}:</span>
        <span className="text-xs text-black flex-shrink-0 w-4">{code}</span>
        <span className="text-xs text-black flex-shrink-0">=</span>

        <input
          type="text"
          value={input}
          onChange={(e) => handleInputChange(setInput, e.target.value)}
          disabled={!canEdit}
          className="flex-1 min-w-0 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 focus:outline-none focus:ring-1 focus:ring-stone-500/20 focus:border-stone-400 disabled:bg-gray-100 disabled:text-gray-500 placeholder-gray-400 text-black font-medium"
        />
      </div>

      <span className="ml-2 text-xs text-black flex-shrink-0 w-16 text-right">{result}</span>
    </div>
  );

  return (
    <div className="h-full flex flex-col bg-gradient-to-b from-orange-50 to-white">
      <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 bg-white border-b border-stone-200 shadow-sm">
        <div className="flex items-center gap-2">
          <button
            onClick={onClose}
            className="p-1 hover:bg-stone-100 rounded-sm transition-colors"
          >
            <ChevronLeft size={11} className="text-orange-600" />
          </button>
          <span className="text-xs font-medium text-orange-800">Volume Parameters</span>
        </div>
        <div className="flex items-center gap-2">
          {customParameters.length > 0 && (
            <button
              onClick={() => setCustomParameters([])}
              className="h-6 px-2 text-xs font-medium text-red-600 hover:text-red-800 rounded-sm hover:bg-red-50 transition-colors"
            >
              Clear All
            </button>
          )}
          <button
            onClick={() => setCustomParameters(prev => [...prev, {
              id: `param_${Date.now()}`,
              description: '',
              value: '',
              result: null
            }])}
            className="p-1.5 hover:bg-orange-100 text-orange-600 rounded-sm transition-colors"
          >
            <Plus size={14} />
          </button>
          <button
            onClick={() => setIsRulerMode(!isRulerMode)}
            className={`p-1.5 rounded-sm transition-colors ${
              isRulerMode ? 'bg-orange-500 text-white' : 'bg-orange-100 text-orange-600 hover:bg-orange-200'
            }`}
          >
            <Ruler size={14} />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4 space-y-2">
        <div className="bg-white rounded-md border border-stone-200 p-2">
          <div className="space-y-2">
            {canEditWidth && renderDimensionInput('Width', 'W', inputWidth, setInputWidth, resultWidth, 'width', true, 1)}
            {renderDimensionInput('Height', 'H', inputHeight, setInputHeight, resultHeight, 'height', true, 2)}
            {canEditDepth && renderDimensionInput('Depth', 'D', inputDepth, setInputDepth, resultDepth, 'depth', true, 3)}

            {customParameters.map((param, index) => (
              <div key={param.id} className="flex items-center h-10 px-2 rounded-md border border-orange-300 bg-orange-50/50 shadow-sm">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <button
                    onClick={() => {
                      setSelectedDimensions(prev => {
                        const newSet = new Set(prev);
                        const key = `param-${param.id}`;
                        newSet.has(key) ? newSet.delete(key) : newSet.add(key);
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
                    onChange={(e) => setCustomParameters(prev => prev.map(p =>
                      p.id === param.id ? { ...p, description: e.target.value } : p
                    ))}
                    placeholder="Code"
                    className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 text-black font-medium"
                  />

                  <input
                    type="text"
                    value={param.value}
                    onChange={(e) => handleInputChange(val =>
                      setCustomParameters(prev => prev.map(p =>
                        p.id === param.id ? { ...p, value: val, result: null } : p
                      )), e.target.value
                    )}
                    placeholder="Formula"
                    className="flex-1 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 text-black font-medium"
                  />

                  <button
                    onClick={() => handleApplyParameter(param.id)}
                    className="flex-shrink-0 p-1 hover:bg-orange-200 rounded-sm transition-colors text-orange-600"
                  >
                    <Check size={14} />
                  </button>

                  <button
                    onClick={() => setCustomParameters(prev => prev.filter(p => p.id !== param.id))}
                    className="flex-shrink-0 p-1 hover:bg-red-100 rounded-sm transition-colors text-red-600"
                  >
                    <X size={14} />
                  </button>
                </div>

                {param.result && (
                  <span className="ml-2 text-xs text-black flex-shrink-0 w-16 text-right">{param.result}</span>
                )}
              </div>
            ))}
          </div>
        </div>

        {selectedLines.length > 0 && (
          <div className="bg-white rounded-md border border-stone-200 p-2">
            <div className="text-xs font-medium text-stone-600 mb-2 px-2">Selected Edges</div>
            <div className="space-y-1">
              {selectedLines.map((line) => (
                <div key={line.id} className="flex items-center gap-2 px-2 py-1 hover:bg-stone-50 rounded-sm">
                  <input
                    type="text"
                    value={line.label}
                    onChange={(e) => updateSelectedLineLabel(line.id, e.target.value)}
                    placeholder="Label"
                    className="w-16 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 focus:outline-none focus:ring-1 focus:ring-stone-500/20 focus:border-stone-400"
                  />

                  {editingLineId === line.id ? (
                    <>
                      <input
                        type="text"
                        value={editingLineValue}
                        onChange={(e) => setEditingLineValue(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleEdgeApply(line.id, editingLineValue);
                          if (e.key === 'Escape') { setEditingLineId(null); setEditingLineValue(''); }
                        }}
                        placeholder="Formula"
                        className="flex-1 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 focus:outline-none focus:ring-1 focus:ring-stone-500/20 focus:border-stone-400"
                        autoFocus
                      />
                      <button
                        onClick={() => handleEdgeApply(line.id, editingLineValue)}
                        className="p-1 hover:bg-green-100 rounded-sm transition-colors text-green-600"
                      >
                        <Check size={14} />
                      </button>
                    </>
                  ) : (
                    <>
                      <div
                        onClick={() => {
                          setEditingLineId(line.id);
                          setEditingLineValue(line.formula || '');
                        }}
                        className="flex-1 h-6 text-xs px-1 rounded-sm cursor-text hover:bg-stone-100 flex items-center text-stone-600"
                      >
                        {line.formula || 'Click to add formula'}
                      </div>
                      <span className="text-xs text-stone-600 w-16 text-right">{line.value.toFixed(2)}</span>
                    </>
                  )}

                  <button
                    onClick={() => removeSelectedLine(line.id)}
                    className="p-1 hover:bg-red-100 rounded-sm transition-colors text-red-600"
                  >
                    <X size={14} />
                  </button>
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
