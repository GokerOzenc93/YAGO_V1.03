import { useCallback } from 'react';
import * as THREE from 'three';
import { calculateEdgeDirection, calculateNewVertex, applyGeometryUpdates, findClosestVertices } from '../utils/refVolumeCalculations';

interface EdgeLine {
  id: string;
  value: number;
  label: string;
  shapeId: string;
  edgeIndex: number;
  startVertex: [number, number, number];
  endVertex: [number, number, number];
  formula?: string;
}

interface CustomParameter {
  id: string;
  description: string;
  value: string;
  result: string | null;
}

export function useEdgeRecalculation(
  customParameters: CustomParameter[],
  setCustomParameters: React.Dispatch<React.SetStateAction<CustomParameter[]>>,
  selectedLines: EdgeLine[],
  shapes: any[],
  convertToBaseUnit: (value: number) => number,
  convertToDisplayUnit: (value: number) => number,
  updateSelectedLineValue: (id: string, value: number) => void,
  updateSelectedLineVertices: (id: string, vertex: [number, number, number]) => void,
  updateShape: (id: string, updates: any) => void,
  evaluateExpression: (expr: string, label?: string) => number | null,
  syncFormulaVariables: () => void,
  formulaEvaluatorRef: React.RefObject<any>
) {
  const recalculateAllParameters = useCallback(() => {
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
        }
      });
    }

    const MAX_ITERATIONS = 10;
    let iteration = 0;
    let hasChanges = true;
    const allProcessedLines = new Set<string>();
    const lineValueHistory = new Map<string, number[]>();

    selectedLines.forEach(line => {
      lineValueHistory.set(line.id, [line.value]);
    });

    while (hasChanges && iteration < MAX_ITERATIONS) {
      hasChanges = false;
      iteration++;

      const geometryUpdatesByShape = new Map();

      selectedLines.forEach(line => {
        if (!line.formula?.trim()) return;

        const evaluated = evaluateExpression(line.formula, `edge-${line.label || line.id}`);
        if (evaluated === null || isNaN(evaluated) || evaluated <= 0) return;

        const currentVal = parseFloat(line.value.toFixed(2));
        const newVal = parseFloat(evaluated.toFixed(2));

        if (Math.abs(currentVal - newVal) <= 0.01) return;

        const history = lineValueHistory.get(line.id) || [];
        if (history.some(val => Math.abs(val - newVal) < 0.01)) {
          console.warn(`🔄 Circular dependency detected for edge ${line.label || line.id}`);
          return;
        }
        history.push(newVal);
        lineValueHistory.set(line.id, history);

        const shape = shapes.find(s => s.id === line.shapeId);
        if (!shape?.geometry) return;

        if (!geometryUpdatesByShape.has(line.shapeId)) {
          geometryUpdatesByShape.set(line.shapeId, {
            geometry: shape.geometry.clone(),
            vertexMoves: [],
            lineUpdates: []
          });
        }

        const updateData = geometryUpdatesByShape.get(line.shapeId)!;
        const { fixedVertex, movingVertex } = calculateEdgeDirection(line.startVertex, line.endVertex);
        const newLength = convertToBaseUnit(newVal);
        const newMovingVertex = calculateNewVertex(fixedVertex, movingVertex, newLength);

        updateData.vertexMoves.push({ oldVertex: movingVertex, newVertex: newMovingVertex });
        updateData.lineUpdates.push({ lineId: line.id, newValue: newVal, newEndVertex: newMovingVertex });

        hasChanges = true;
        allProcessedLines.add(line.id);
      });

      if (!hasChanges) break;

      geometryUpdatesByShape.forEach((updateData, shapeId) => {
        applyGeometryUpdates(updateData, updateShape, shapeId);
        updateData.lineUpdates.forEach((update: any) => {
          updateSelectedLineValue(update.lineId, update.newValue);
          updateSelectedLineVertices(update.lineId, update.newEndVertex);
        });
      });

      selectedLines.forEach(line => {
        if (allProcessedLines.has(line.id)) return;

        const shape = shapes.find(s => s.id === line.shapeId);
        if (!shape?.geometry) return;

        shape.geometry.computeBoundingBox();
        const { closestStart, closestEnd } = findClosestVertices(shape.geometry, line.startVertex, line.endVertex);

        if (closestStart && closestEnd) {
          const newLength = Math.sqrt(
            Math.pow(closestEnd[0] - closestStart[0], 2) +
            Math.pow(closestEnd[1] - closestStart[1], 2) +
            Math.pow(closestEnd[2] - closestStart[2], 2)
          );

          const displayLength = convertToDisplayUnit(newLength);
          const currentVal = parseFloat(line.value.toFixed(2));

          if (Math.abs(displayLength - currentVal) > 0.01) {
            updateSelectedLineValue(line.id, displayLength);
            updateSelectedLineVertices(line.id, closestEnd as [number, number, number]);
            hasChanges = true;
          }
        }
      });
    }

    if (iteration >= MAX_ITERATIONS) {
      console.warn('🔄 Edge recalculation reached maximum iterations');
    } else if (iteration > 1) {
      console.log(`✅ Edge updates completed in ${iteration} iterations`);
    }
  }, [customParameters, setCustomParameters, selectedLines, shapes, convertToBaseUnit, convertToDisplayUnit,
      updateSelectedLineValue, updateSelectedLineVertices, updateShape, evaluateExpression, syncFormulaVariables, formulaEvaluatorRef]);

  return { recalculateAllParameters };
}
