import { useRef, useCallback } from 'react';
import { FormulaEvaluator } from '../utils/formulaEvaluator';

interface CustomParameter {
  id: string;
  description: string;
  value: string;
  result: string | null;
}

interface EdgeLine {
  id: string;
  label: string;
  value: number;
  formula?: string;
}

export function useRefVolumeFormulas(
  currentWidth: number,
  currentHeight: number,
  currentDepth: number,
  customParameters: CustomParameter[],
  selectedLines: EdgeLine[],
  convertToDisplayUnit: (value: number) => number
) {
  const formulaEvaluatorRef = useRef<FormulaEvaluator>(new FormulaEvaluator());

  const syncFormulaVariables = useCallback(() => {
    const evaluator = formulaEvaluatorRef.current;

    evaluator.clearVariables();

    evaluator.setVariable('W', convertToDisplayUnit(currentWidth));
    evaluator.setVariable('H', convertToDisplayUnit(currentHeight));
    evaluator.setVariable('D', convertToDisplayUnit(currentDepth));

    customParameters.forEach(param => {
      if (param.description && param.result) {
        evaluator.setVariable(param.description, parseFloat(param.result));
      }
    });

    selectedLines.forEach(line => {
      if (line.label) {
        evaluator.setVariable(line.label, line.value);
      }
    });

    console.log('🔄 Formula variables synced:', evaluator.getAllVariables().map(v => `${v.name}=${v.value}`).join(', '));
  }, [currentWidth, currentHeight, currentDepth, customParameters, selectedLines, convertToDisplayUnit]);

  const evaluateExpression = useCallback((expression: string, debugLabel?: string): number | null => {
    return formulaEvaluatorRef.current.evaluateOrNull(expression, debugLabel);
  }, []);

  return {
    formulaEvaluatorRef,
    syncFormulaVariables,
    evaluateExpression
  };
}
