import React, { useState } from 'react';
import { useAppStore } from '../store/appStore';
import { ChevronUp, ChevronDown } from 'lucide-react';

interface StatusDisplayProps {
  polylineStatus?: {
    distance: number;
    angle?: number;
    unit: string;
  } | null;
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({ polylineStatus }) => {
  const { activeTool, formulaEvaluator } = useAppStore();
  const [showVariables, setShowVariables] = useState(false);

  const variables = formulaEvaluator.getAllVariables();

  return (
    <div className="fixed bottom-5 left-0 right-0 bg-gray-700/95 backdrop-blur-sm border-t border-gray-600 z-20" style={{ minHeight: '4mm' }}>
      {showVariables && variables.length > 0 && (
        <div className="px-3 py-2 border-b border-gray-600">
          <div className="text-xs text-gray-300 font-medium mb-1">Variables:</div>
          <div className="flex flex-wrap gap-2">
            {variables.map((v) => (
              <div key={v.name} className="flex items-center gap-1 px-2 py-1 bg-gray-600/50 rounded text-xs">
                <span className="text-blue-400 font-mono font-medium">{v.name}</span>
                <span className="text-gray-400">=</span>
                <span className="text-green-400 font-mono">{v.value.toFixed(2)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="flex items-center justify-between h-[4mm] px-3">
        {/* Sol taraf - Tool bilgisi */}
        <div className="flex items-center gap-4 text-xs text-gray-300">
          <span className="font-medium">
            Tool: <span className="text-white">{activeTool}</span>
          </span>
          {variables.length > 0 && (
            <button
              onClick={() => setShowVariables(!showVariables)}
              className="flex items-center gap-1 text-gray-400 hover:text-gray-200 transition-colors"
            >
              <span className="font-mono">{variables.length} vars</span>
              {showVariables ? <ChevronDown size={12} /> : <ChevronUp size={12} />}
            </button>
          )}
        </div>

        {/* Orta - Polyline ölçü bilgileri */}
        {polylineStatus && (
          <div className="flex items-center gap-4 text-xs">
            {/* Polyline/Polygon için uzunluk ve açı */}
            {(activeTool === 'Polyline' || activeTool === 'Polygon') && (
              <>
                <span className="text-gray-300">
                  Length: <span className="text-green-400 font-mono font-medium">{polylineStatus.distance.toFixed(1)}{polylineStatus.unit}</span>
                </span>
                {polylineStatus.angle !== undefined && (
                  <span className="text-gray-300">
                    Angle: <span className="text-blue-400 font-mono font-medium">{polylineStatus.angle.toFixed(1)}°</span>
                  </span>
                )}
              </>
            )}
            
            {/* Rectangle için genişlik ve yükseklik */}
            {activeTool === 'Rectangle' && (
              <>
                <span className="text-gray-300">
                  Width: <span className="text-green-400 font-mono font-medium">{polylineStatus.distance.toFixed(1)}{polylineStatus.unit}</span>
                </span>
                {polylineStatus.angle !== undefined && (
                  <span className="text-gray-300">
                    Height: <span className="text-blue-400 font-mono font-medium">{polylineStatus.angle.toFixed(1)}{polylineStatus.unit}</span>
                  </span>
                )}
              </>
            )}
            
            {/* Circle için radius */}
            {activeTool === 'Circle' && (
              <span className="text-gray-300">
                Radius: <span className="text-green-400 font-mono font-medium">{polylineStatus.distance.toFixed(1)}{polylineStatus.unit}</span>
              </span>
            )}
          </div>
        )}

        {/* Sağ taraf - Durum bilgileri */}
        <div className="flex items-center gap-4 text-xs text-gray-300">
          <span>Ready</span>
        </div>
      </div>
    </div>
  );
};

export default StatusDisplay;