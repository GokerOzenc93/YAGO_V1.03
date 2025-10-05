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
    updateSelectedLineValue,
    updateSelectedLineVertices,
    updateSelectedLineFormula,
    updateSelectedLineLabel,
    removeSelectedLine,
    shapes
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
  const [inputA, setInputA] = useState('');
  const [resultA, setResultA] = useState<string>('');

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

  useEffect(() => {
    if (inputA && inputA.trim()) {
      const evaluated = evaluateExpression(inputA);
      if (evaluated !== null && !isNaN(evaluated) && evaluated > 0) {
        setResultA(evaluated.toFixed(2));
      }
    }
  }, [inputA, currentWidth, currentHeight, currentDepth, customParameters, selectedLines]);

  useEffect(() => {
    recalculateAllParameters();
  }, [currentWidth, currentHeight, currentDepth, resultA, JSON.stringify(customParameters.map(p => ({ d: p.description, v: p.value })))]);

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

  const evaluateExpression = (expression: string): number | null => {
    try {
      let processed = expression
        .replace(/\bW\b/g, convertToDisplayUnit(currentWidth).toString())
        .replace(/\bH\b/g, convertToDisplayUnit(currentHeight).toString())
        .replace(/\bD\b/g, convertToDisplayUnit(currentDepth).toString());

      if (inputA && resultA) {
        processed = processed.replace(/\bA\b/g, resultA);
      }

      customParameters.forEach(param => {
        if (param.description && param.result) {
          processed = processed.replace(new RegExp(`\\b${param.description}\\b`, 'g'), param.result);
        }
      });

      selectedLines.forEach(line => {
        if (line.label) {
          processed = processed.replace(new RegExp(`\\b${line.label}\\b`, 'g'), line.value.toString());
        }
      });

      const result = eval(processed);
      return typeof result === 'number' && isFinite(result) ? result : null;
    } catch {
      return null;
    }
  };

  const recalculateAllParameters = () => {
    const updatedParams = customParameters.map(param => {
      if (!param.value.trim()) return param;
      const evaluated = evaluateExpression(param.value);
      return evaluated !== null && !isNaN(evaluated)
        ? { ...param, result: evaluated.toFixed(2) }
        : param;
    });

    if (updatedParams.some((p, i) => p.result !== customParameters[i].result)) {
      setCustomParameters(updatedParams);
    }

    const vertexMovesByShape = new Map<string, Array<{
      oldVertex: [number, number, number];
      newVertex: [number, number, number];
      lineId: string;
      newValue: number;
    }>>();

    selectedLines.forEach(line => {
      if (!line.formula?.trim()) return;

      const evaluated = evaluateExpression(line.formula);
      if (evaluated === null || isNaN(evaluated) || evaluated <= 0) return;

      const currentVal = parseFloat(line.value.toFixed(2));
      const newVal = parseFloat(evaluated.toFixed(2));

      if (Math.abs(currentVal - newVal) <= 0.01) return;

      const shape = shapes.find(s => s.id === line.shapeId);
      if (!shape?.geometry) return;

      const dx = Math.abs(line.endVertex[0] - line.startVertex[0]);
      const dy = Math.abs(line.endVertex[1] - line.startVertex[1]);
      const dz = Math.abs(line.endVertex[2] - line.startVertex[2]);

      let fixedVertex: [number, number, number], movingVertex: [number, number, number];

      if (dy > dx && dy > dz) {
        [fixedVertex, movingVertex] = line.startVertex[1] < line.endVertex[1]
          ? [line.startVertex, line.endVertex]
          : [line.endVertex, line.startVertex];
      } else if (dx > dy && dx > dz) {
        [fixedVertex, movingVertex] = line.startVertex[0] > line.endVertex[0]
          ? [line.startVertex, line.endVertex]
          : [line.endVertex, line.startVertex];
      } else {
        [fixedVertex, movingVertex] = line.startVertex[2] < line.endVertex[2]
          ? [line.startVertex, line.endVertex]
          : [line.endVertex, line.startVertex];
      }

      const newLength = convertToBaseUnit(newVal);
      const direction = new THREE.Vector3(
        movingVertex[0] - fixedVertex[0],
        movingVertex[1] - fixedVertex[1],
        movingVertex[2] - fixedVertex[2]
      ).normalize();

      const newMovingVertex: [number, number, number] = [
        fixedVertex[0] + direction.x * newLength,
        fixedVertex[1] + direction.y * newLength,
        fixedVertex[2] + direction.z * newLength
      ];

      if (!vertexMovesByShape.has(line.shapeId)) {
        vertexMovesByShape.set(line.shapeId, []);
      }

      vertexMovesByShape.get(line.shapeId)!.push({
        oldVertex: movingVertex,
        newVertex: newMovingVertex,
        lineId: line.id,
        newValue: newVal
      });
    });

    vertexMovesByShape.forEach((moves, shapeId) => {
      const shape = shapes.find(s => s.id === shapeId);
      if (!shape?.geometry) return;

      const newGeometry = shape.geometry.clone();
      const positions = newGeometry.attributes.position.array;

      moves.forEach(move => {
        for (let i = 0; i < positions.length; i += 3) {
          const dist = Math.sqrt(
            Math.pow(positions[i] - move.oldVertex[0], 2) +
            Math.pow(positions[i + 1] - move.oldVertex[1], 2) +
            Math.pow(positions[i + 2] - move.oldVertex[2], 2)
          );

          if (dist < 0.01) {
            positions[i] = move.newVertex[0];
            positions[i + 1] = move.newVertex[1];
            positions[i + 2] = move.newVertex[2];
          }
        }
        updateSelectedLineValue(move.lineId, move.newValue);
        updateSelectedLineVertices(move.lineId, move.newVertex);
      });

      newGeometry.attributes.position.needsUpdate = true;
      newGeometry.computeBoundingBox();
      newGeometry.computeVertexNormals();
      updateShape(shapeId, { geometry: newGeometry });
    });
  };

  const applyDimensionChange = (dimension: 'width' | 'height' | 'depth', value: string) => {
    const evaluated = evaluateExpression(value);
    if (evaluated === null || isNaN(evaluated) || evaluated <= 0) return;

    if (dimension === 'width') setResultWidth(evaluated.toFixed(2));
    if (dimension === 'height') setResultHeight(evaluated.toFixed(2));
    if (dimension === 'depth') setResultDepth(evaluated.toFixed(2));

    const newValue = convertToBaseUnit(evaluated);
    editedShape.geometry.computeBoundingBox();
    const bbox = editedShape.geometry.boundingBox;
    const currentScale = [...editedShape.scale];
    const newScale = [...currentScale];

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

    updateShape(editedShape.id, {
      scale: newScale as [number, number, number],
      geometry: editedShape.geometry.clone(),
    });
  };

  const handleInputChange = (setter: (val: string) => void, value: string) => {
    if (/^[0-9a-zA-Z+\-*/().\s]*$/.test(value) || value === '') {
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

    const evaluated = evaluateExpression(param.value);
    if (evaluated === null || isNaN(evaluated)) {
      alert('Invalid formula');
      return;
    }

    setCustomParameters(prev => prev.map(p =>
      p.id === id ? { ...p, result: evaluated.toFixed(2) } : p
    ));
  };

  const handleEdgeApply = (lineId: string, formula: string) => {
    const evaluated = evaluateExpression(formula);
    if (evaluated === null || isNaN(evaluated) || evaluated <= 0) return;

    updateSelectedLineFormula(lineId, formula);
    setTimeout(() => recalculateAllParameters(), 0);
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
          <button onClick={onClose} className="p-1.5 hover:bg-orange-200 rounded-sm transition-colors">
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
            <div className="flex items-center h-10 px-2 rounded-md border border-blue-300 bg-blue-50/50 shadow-sm">
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <div className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shadow-sm border bg-gradient-to-br from-blue-400 to-blue-500 text-white border-blue-300">
                  A
                </div>

                <input
                  type="text"
                  value="A"
                  readOnly
                  className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 text-black font-medium cursor-default"
                />

                <input
                  type="text"
                  value={inputA}
                  onChange={(e) => handleInputChange(setInputA, e.target.value)}
                  placeholder="Formula..."
                  className="flex-1 min-w-0 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-400 placeholder-gray-400 text-black font-medium"
                />

                <input
                  type="text"
                  value={resultA}
                  readOnly
                  className="flex-shrink-0 w-[57px] h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
                />

                <div className="flex items-center gap-1 flex-shrink-0">
                  <button
                    onClick={() => {
                      if (inputA.trim()) {
                        const evaluated = evaluateExpression(inputA);
                        if (evaluated !== null && !isNaN(evaluated) && evaluated > 0) {
                          setResultA(evaluated.toFixed(2));
                          setTimeout(() => recalculateAllParameters(), 0);
                        }
                      }
                    }}
                    disabled={!inputA.trim()}
                    className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
                      inputA.trim()
                        ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                        : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                    }`}
                  >
                    <Check size={11} />
                  </button>
                  <button
                    onClick={() => {
                      setInputA('');
                      setResultA('');
                      setTimeout(() => recalculateAllParameters(), 0);
                    }}
                    className="flex-shrink-0 p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-sm transition-colors"
                  >
                    <X size={11} />
                  </button>
                </div>
              </div>
            </div>

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

        {selectedLines.length > 0 && (
          <div className="bg-white rounded-md border border-stone-200 p-2">
            <div className="space-y-2 max-h-[200px] overflow-y-auto">
              {selectedLines.map((line, index) => (
                <div key={line.id} className="flex items-center h-10 px-2 rounded-md border border-orange-300 bg-orange-50/50 shadow-sm">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <div className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shadow-sm border bg-gradient-to-br from-blue-400 to-blue-500 text-white border-blue-300">
                      {index + 1}
                    </div>

                    <input
                      type="text"
                      value={line.label}
                      onChange={(e) => updateSelectedLineLabel(line.id, e.target.value)}
                      placeholder="Name"
                      className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 text-black font-medium focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-400"
                    />

                    <input
                      type="text"
                      value={editingLineId === line.id ? editingLineValue : (line.formula || '')}
                      onChange={(e) => editingLineId === line.id && setEditingLineValue(e.target.value)}
                      onFocus={() => {
                        setEditingLineId(line.id);
                        setEditingLineValue(line.formula || '');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && editingLineId === line.id) {
                          handleEdgeApply(line.id, editingLineValue);
                        } else if (e.key === 'Escape') {
                          setEditingLineId(null);
                          setEditingLineValue('');
                        }
                      }}
                      placeholder="Formula..."
                      className="flex-1 min-w-0 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-400 placeholder-gray-400 text-black font-medium"
                    />

                    <input
                      type="text"
                      value={(() => {
                        if (line.formula?.trim()) {
                          const evaluated = evaluateExpression(line.formula);
                          return evaluated !== null && !isNaN(evaluated) ? evaluated.toFixed(2) : line.value.toFixed(2);
                        }
                        return line.value.toFixed(2);
                      })()}
                      readOnly
                      className="flex-shrink-0 w-[57px] h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
                    />

                    <div className="flex items-center gap-1 flex-shrink-0">
                      <button
                        onClick={() => editingLineId === line.id && editingLineValue.trim() && handleEdgeApply(line.id, editingLineValue)}
                        disabled={editingLineId !== line.id || !editingLineValue.trim()}
                        className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
                          editingLineId === line.id && editingLineValue.trim()
                            ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                            : 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        }`}
                      >
                        <Check size={11} />
                      </button>
                      <button
                        onClick={() => removeSelectedLine(line.id)}
                        className="flex-shrink-0 p-1.5 bg-orange-100 text-orange-600 hover:bg-orange-200 rounded-sm transition-colors"
                      >
                        <X size={11} />
                      </button>
                    </div>
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
