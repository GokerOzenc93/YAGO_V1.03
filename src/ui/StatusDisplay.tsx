import React from 'react';
import { useAppStore } from '../core/appStore';

interface StatusDisplayProps {
  polylineStatus?: {
    distance: number;
    angle?: number;
    unit: string;
  } | null;
}

const StatusDisplay: React.FC<StatusDisplayProps> = ({ polylineStatus }) => {
  const { activeTool } = useAppStore();

  return (
    <div className="fixed bottom-5 left-0 right-0 bg-gray-700/95 backdrop-blur-sm border-t border-gray-600 z-20" style={{ height: '4mm' }}>
      <div className="flex items-center justify-between h-full px-3">
        {/* Sol taraf - Tool bilgisi */}
        <div className="flex items-center gap-4 text-xs text-gray-300">
          <span className="font-medium">
            Tool: <span className="text-white">{activeTool}</span>
          </span>
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