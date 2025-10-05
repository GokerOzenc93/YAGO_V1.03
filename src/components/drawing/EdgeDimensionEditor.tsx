import React, { useState, useEffect } from 'react';
import { Check, X, Ruler } from 'lucide-react';
import { EdgeInfo } from './types';

interface EdgeDimensionEditorProps {
  edge: EdgeInfo;
  currentLength: number;
  unit: string;
  onApply: (newLength: number) => void;
  onCancel: () => void;
  convertToDisplayUnit: (value: number) => number;
  convertToBaseUnit: (value: number) => number;
}

const EdgeDimensionEditor: React.FC<EdgeDimensionEditorProps> = ({
  edge,
  currentLength,
  unit,
  onApply,
  onCancel,
  convertToDisplayUnit,
  convertToBaseUnit,
}) => {
  const [inputValue, setInputValue] = useState(convertToDisplayUnit(currentLength).toFixed(0));
  const [resultValue, setResultValue] = useState(convertToDisplayUnit(currentLength).toFixed(2));

  useEffect(() => {
    setInputValue(convertToDisplayUnit(currentLength).toFixed(0));
    setResultValue(convertToDisplayUnit(currentLength).toFixed(2));
  }, [currentLength, convertToDisplayUnit]);

  const handleInputChange = (value: string) => {
    const regex = /^[0-9+\-*/().\s]*$/;
    if (regex.test(value) || value === '') {
      setInputValue(value);
    }
  };

  const evaluateExpression = (expression: string): number | null => {
    try {
      const result = eval(expression);
      if (typeof result === 'number' && isFinite(result) && result > 0) {
        return result;
      }
      return null;
    } catch (e) {
      return null;
    }
  };

  const handleApply = () => {
    const evaluatedValue = evaluateExpression(inputValue);
    if (evaluatedValue === null || isNaN(evaluatedValue) || evaluatedValue <= 0) {
      alert('Invalid value. Please enter a valid positive number or formula.');
      return;
    }

    setResultValue(evaluatedValue.toFixed(2));
    const newLengthInBase = convertToBaseUnit(evaluatedValue);
    onApply(newLengthInBase);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleApply();
    } else if (e.key === 'Escape') {
      onCancel();
    }
  };

  return (
    <div className="flex items-center h-10 px-2 rounded-md border border-blue-300 bg-blue-50/50 shadow-sm">
      <div className="flex items-center gap-2 flex-1 min-w-0">
        <div className="flex-shrink-0 w-5 h-5 rounded-full text-xs font-bold flex items-center justify-center shadow-sm border bg-gradient-to-br from-blue-400 to-blue-500 text-white border-blue-300">
          {edge.edgeIndex + 1}
        </div>

        <input
          type="text"
          value="L"
          readOnly
          className="flex-shrink-0 w-12 h-6 text-xs bg-white border border-gray-300 rounded-sm px-1 text-black font-medium cursor-default"
        />

        <input
          type="text"
          value={inputValue}
          onChange={(e) => handleInputChange(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Formula..."
          autoFocus
          className="flex-1 min-w-0 h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 focus:outline-none focus:ring-1 focus:ring-blue-500/20 focus:border-blue-400 placeholder-gray-400 text-black font-medium"
        />

        <input
          type="text"
          value={resultValue}
          readOnly
          className="flex-shrink-0 w-[57px] h-6 text-xs bg-white border border-gray-300 rounded-sm px-2 text-gray-700 font-medium cursor-default"
          placeholder="Result"
        />

        <div className="flex items-center gap-1 flex-shrink-0">
          <button
            onClick={handleApply}
            disabled={!inputValue.trim()}
            className={`flex-shrink-0 p-1.5 rounded-sm transition-all ${
              inputValue.trim()
                ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
            title="Apply Length"
          >
            <Check size={11} />
          </button>

          <button
            onClick={onCancel}
            className="flex-shrink-0 p-1.5 bg-red-100 hover:bg-red-200 text-red-600 rounded-sm transition-colors"
            title="Cancel"
          >
            <X size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default EdgeDimensionEditor;
