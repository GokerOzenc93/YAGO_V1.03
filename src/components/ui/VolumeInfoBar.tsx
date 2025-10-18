import React from 'react';

interface VolumeInfoBarProps {
  volumeName: string;
  cabinetCode: string;
  description: string;
  pose: number;
}

const VolumeInfoBar: React.FC<VolumeInfoBarProps> = ({
  volumeName,
  cabinetCode,
  description,
  pose,
}) => {
  return (
    <div className="flex items-center h-10 px-3 bg-gray-50 border-b border-gray-200">
      <div className="flex items-center gap-4 text-xs text-gray-700">
        <div className="flex items-center gap-1">
          <span className="font-medium text-gray-500">Volume:</span>
          <span className="font-semibold text-gray-900">{volumeName}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium text-gray-500">CabinetCode:</span>
          <span className="font-semibold text-gray-900">{cabinetCode}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium text-gray-500">Description:</span>
          <span className="font-semibold text-gray-900">{description}</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="font-medium text-gray-500">Pose:</span>
          <span className="font-semibold text-gray-900">{pose}</span>
        </div>
      </div>
    </div>
  );
};

export default VolumeInfoBar;
