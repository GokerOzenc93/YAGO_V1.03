import React, { useMemo, useState, useEffect, useRef, useCallback } from 'react';
import { X, Check, Plus, ChevronLeft, Ruler, RefreshCw } from 'lucide-react';
import { useAppStore } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import * as THREE from 'three';
import { FormulaEvaluator, FormulaVariable } from '../../utils/formulaEvaluator';

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
    shapes,
    setParameterVariable,
    getParameterVariable,
    evaluateFormula
  } = useAppStore();

  const { currentWidth, currentHeight, currentDepth } = useMemo(() => {
    if (!editedShape.geometry) {
      return { currentWidth: 500, currentHeight: 500, currentDepth: 500 };
    }

    editedShape.geometry.computeBoundingBox();
    const bbox = editedShape.geometry.boundingBox;
    if (!bbox) return { currentWidth: 500, currentHeight: 500, currentDepth: 500 };

    return {
      currentWidth: (bbox.max.x - bbox.min.x) * editedShape.scale[0],
      currentHeight: (bbox.max.y - bbox.min.y) * editedShape.scale[1],
      currentDepth: (bbox.max.z - bbox.min.z) * editedShape.scale[2],
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
  const [isApplyingChanges, setIsApplyingChanges] = useState(false);

  const formulaEvaluatorRef = useRef<FormulaEvaluator>(new FormulaEvaluator());
  const updateDependentEdgesRef = useRef<() => void>();

  const canEditWidth = ['box', 'rectangle2d', 'polyline2d', 'polygon2d', 'polyline3d', 'polygon3d'].includes(editedShape.type);
  const canEditDepth = canEditWidth;

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

  const syncFormulaVariables = useCallback(() => {
    const evaluator = formulaEvaluatorRef.current;

    evaluator.clearVariables();

    evaluator.setVariable('W', convertToDisplayUnit(currentWidth));
    evaluator.setVariable('H', convertToDisplayUnit(currentHeight));
    evaluator.setVariable('D', convertToDisplayUnit(currentDepth));

    setParameterVariable('W', convertToDisplayUnit(currentWidth));
    setParameterVariable('H', convertToDisplayUnit(currentHeight));
    setParameterVariable('D', convertToDisplayUnit(currentDepth));

    customParameters.forEach(param => {
      if (param.description && param.result) {
        evaluator.setVariable(param.description, parseFloat(param.result));
        setParameterVariable(param.description, parseFloat(param.result));
      }
    });

    console.log('🔄 Formula variables synced:', evaluator.getAllVariables().map(v => `${v.name}=${v.value}`).join(', '));
  }, [currentWidth, currentHeight, currentDepth, customParameters, convertToDisplayUnit, setParameterVariable]);

  useEffect(() => {
    syncFormulaVariables();
    recalculateAllParameters();
  }, [JSON.stringify(customParameters.map(p => ({ d: p.description, v: p.value })))]);

  useEffect(() => {
    const handleUpdateAll = () => {
      console.log('🔄 Received updateAllParametricEdges event');
      updateDependentEdges();
    };

    window.addEventListener('updateAllParametricEdges', handleUpdateAll);
    return () => {
      window.removeEventListener('updateAllParametricEdges', handleUpdateAll);
    };
  }, []);

  const updateDimensionResult = (dimension: 'width' | 'height' | 'depth', input: string, setter: (val: string) => void) => {
    if (input && input !== convertToDisplayUnit(dimension === 'width' ? currentWidth : dimension === 'height' ? currentHeight : currentDepth).toFixed(0)) {
      const evaluated = evaluateExpression(input);
      if (evaluated !== null && !isNaN(evaluated) && evaluated > 0) {
        setter(evaluated.toFixed(2));
      }
    }
  };

  useEffect(() => updateDimensionResult('width', inputWidth, setResultWidth), [inputWidth, customParameters]);
  useEffect(() => updateDimensionResult('height', inputHeight, setResultHeight), [inputHeight, customParameters]);
  useEffect(() => updateDimensionResult('depth', inputDepth, setResultDepth), [inputDepth, customParameters]);

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

  const evaluateExpression = (expression: string, debugLabel?: string): number | null => {
    return formulaEvaluatorRef.current.evaluateOrNull(expression, debugLabel);
  };

  const recalculateAllParameters = useCallback(() => {
    try {
      syncFormulaVariables();

      const updatedParams = customParameters.map(param => {
        if (!param.value.trim()) return param;
        const evaluated = evaluateExpression(param.value, `param-${param.description}`);
        return evaluated !== null && !isNaN(evaluated)
          ? { ...param, result: evaluated.toFixed(2) }
          : param;
      });

      const hasParamChanges = updatedParams.some((p, i) => p.result !== customParameters[i].result);
      if (hasParamChanges) {
        setCustomParameters(updatedParams);

        const evaluator = formulaEvaluatorRef.current;
        updatedParams.forEach(param => {
          if (param.description && param.result) {
            evaluator.setVariable(param.description, parseFloat(param.result));
            console.log(`🔄 Updated parameter variable: ${param.description}=${param.result}`);
          }
        });
      }

    // Edge calculation removed

    // Edge processing removed
        if (!line.formula?.trim()) return;

    } catch (error) {
      console.error('❌ Error during parameter recalculation:', error);
    }
  }, [customParameters, shapes, convertToBaseUnit, updateShape, evaluateExpression, syncFormulaVariables, convertToDisplayUnit]);

  const applyDimensionChange = (dimension: 'width' | 'height' | 'depth', value: string) => {
    try {
      const evaluated = evaluateExpression(value);
      if (evaluated === null || isNaN(evaluated) || evaluated <= 0) return;

      if (dimension === 'width') setResultWidth(evaluated.toFixed(2));
      if (dimension === 'height') setResultHeight(evaluated.toFixed(2));
      if (dimension === 'depth') setResultDepth(evaluated.toFixed(2));

      const newValue = convertToBaseUnit(evaluated);

      if (!editedShape.geometry) {
        console.error('❌ No geometry found for edited shape');
        return;
      }

      editedShape.geometry.computeBoundingBox();
      const bbox = editedShape.geometry.boundingBox;

      if (!bbox) {
        console.error('❌ Failed to compute bounding box');
        return;
      }

      const currentScale = [...editedShape.scale];
      const newScale = [...currentScale];
      const oldScale = [...currentScale];

      let originalDimension = 0;
      if (dimension === 'width') {
        originalDimension = (bbox.max.x - bbox.min.x) * currentScale[0] || 1;
        newScale[0] = (newValue / originalDimension) * currentScale[0];
      } else if (dimension === 'height') {
        originalDimension = (bbox.max.y - bbox.min.y) * currentScale[1] || 1;
        newScale[1] = (newValue / originalDimension) * currentScale[1];
      } else {
        originalDimension = (bbox.max.z - bbox.min.z) * currentScale[2] || 1;
        newScale[2] = (newValue / originalDimension) * currentScale[2];
      }

      const scaleRatio = [
        newScale[0] / oldScale[0],
        newScale[1] / oldScale[1],
        newScale[2] / oldScale[2]
      ];


      updateShape(editedShape.id, {
        scale: newScale as [number, number, number],
        geometry: editedShape.geometry.clone(),
      });

      console.log(`✅ W/H/D updated: ${dimension} = ${evaluated}, scale ratio: [${scaleRatio.join(', ')}]`);
    } catch (error) {
      console.error('❌ Error applying dimension change:', error);
    }
  };

  const handleInputChange = (setter: (val: string) => void, value: string) => {
    setter(value);
  };

  const updateDependentEdges = useCallback(() => {
    const { shapes, evaluateFormula } = useAppStore.getState();
    console.log('🔄 updateDependentEdges called, shapes:', shapes.length);
    shapes.forEach(shape => {
      if (!shape.edgeFormulas || shape.edgeFormulas.length === 0) return;

      shape.edgeFormulas.forEach(edgeFormula => {
        const newValue = evaluateFormula(edgeFormula.formula);
        if (newValue !== null && newValue > 0) {
          const event = new CustomEvent('updateEdgeMeasurement', {
            detail: {
              shapeId: shape.id,
              edgeId: edgeFormula.edgeId,
              newValue,
              formula: edgeFormula.formula
            }
          });
          window.dispatchEvent(event);
          console.log(`🔄 Auto-updated edge ${edgeFormula.edgeId} of shape ${shape.id} to ${newValue} mm`);
        }
      });
    });
  }, []);

  updateDependentEdgesRef.current = updateDependentEdges;

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
      setParameterVariable(param.description, evaluated);
      console.log(`✅ Parameter applied: ${param.description}=${evaluated}`);

      syncFormulaVariables();

      recalculateAllParameters();

      // Update all edges that depend on this parameter
      updateDependentEdges();
    });
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
    <div className="flex items-center h-10 px-2 rounded-md border border-orange-300 bg-orange-50/50 shadow-sm">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <button
          onClick={() => {
            setSelectedDimensions(prev => {
              const newSet = new Set(prev);
              newSet.has(dimension) ? newSet.delete(dimension) : newSet.add(dimension);
              return newSet;
            });
          }}
          className={`flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shadow-sm border transition-colors ${
            selectedDimensions.has(dimension)
              ? 'bg-white text-orange-500 border-orange-300'
              : 'bg-gradient-to-br from-orange-400 to-orange-500 text-white border-orange-300'
          }`}
        >
          {index}
        </button>

        <input
          type="text"
          value={code}
          readOnly
          className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 text-black font-medium cursor-default"
        />

        <input
          type="text"
          value={input}
          onChange={(e) => handleInputChange(setInput, e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && applyDimensionChange(dimension, input)}
          placeholder="Formula..."
          className="flex-1 min-w-0 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 text-black font-medium"
        />

        <input
          type="text"
          value={result}
          readOnly
          className="flex-shrink-0 w-[57px] h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
        />

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={() => applyDimensionChange(dimension, input)}
            disabled={!input.trim() || !canEdit}
            className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
              input.trim() && canEdit
                ? 'bg-orange-100 text-orange-600 hover:bg-orange-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            <Check size={11} />
          </button>
          <button disabled className="flex-shrink-0 p-1.5 bg-gray-100 text-gray-400 rounded-sm cursor-not-allowed">
            <X size={11} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between h-10 px-3 bg-orange-50 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <button onClick={() => {
            setIsRulerMode(false);
            onClose();
          }} className="p-1.5 hover:bg-orange-200 rounded-sm transition-colors">
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
            onClick={() => {
              try {
                console.log('🔄 Manual parametric update button clicked');
                if (updateDependentEdgesRef.current) {
                  updateDependentEdgesRef.current();
                } else {
                  console.error('❌ updateDependentEdgesRef.current is undefined');
                }
              } catch (error) {
                console.error('❌ Error updating dependent edges:', error);
              }
            }}
            className="p-1.5 hover:bg-orange-100 text-orange-600 rounded-sm transition-colors"
            title="Update all parametric edges"
          >
            <RefreshCw size={11} />
          </button>
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
            onClick={() => {
              const { isRulerMode, setIsRulerMode } = useAppStore.getState();
              setIsRulerMode(!isRulerMode);
            }}
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
                    onKeyDown={(e) => e.key === 'Enter' && handleApplyParameter(param.id)}
                    placeholder="Formula..."
                    className="flex-1 min-w-0 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 focus:outline-none focus:ring-1 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 text-black font-medium"
                  />

                  <input
                    type="text"
                    value={param.result || ''}
                    readOnly
                    className="flex-shrink-0 w-[57px] h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
                  />

                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      onClick={() => handleApplyParameter(param.id)}
                      disabled={!param.value.trim()}
                      className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
                        param.value.trim() ? 'bg-orange-100 text-orange-600 hover:bg-orange-200' : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                      }`}
                    >
                      <Check size={11} />
                    </button>
                    <button
                      onClick={() => setCustomParameters(prev => prev.filter(p => p.id !== param.id))}
                      className="flex-shrink-0 p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-sm transition-colors"
                    >
                      <X size={11} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {['cylinder', 'circle2d'].includes(editedShape.type) && (
          <div className="text-xs text-slate-600 p-2 bg-orange-50 rounded-sm border border-orange-200">
            {editedShape.type === 'cylinder' ? 'Cylinder' : 'Circle'}: Only height can be edited
          </div>
        )}

      </div>
    </div>
  );
};

export default RefVolume;
