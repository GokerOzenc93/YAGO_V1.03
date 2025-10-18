import React from 'react';
import { Save } from 'lucide-react';

interface VolumeInfoBarProps {
  volumeName: string;
  cabinetCode: string;
  description: string;
  pose: number;
  onSave: () => void;
}

const VolumeInfoBar: React.FC<VolumeInfoBarProps> = ({
  volumeName,
  cabinetCode,
  description,
  pose,
  onSave,
}) => {
  return (
    <div className="flex items-center justify-between h-10 px-3 bg-white border-b border-gray-200">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Volume</span>
          <span className="text-xs font-semibold text-gray-900 font-mono">{volumeName}</span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded border border-gray-200">
          <span className="text-xs font-medium text-gray-500">CabinetCode</span>
          <span className="text-xs font-semibold text-gray-900 font-mono">{cabinetCode}</span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Description</span>
          <span className="text-xs font-semibold text-gray-900 font-mono">{description || '-'}</span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Pose</span>
          <span className="text-xs font-semibold text-gray-900 font-mono">{pose}</span>
        </div>
      </div>
      <button
        onClick={onSave}
        className="text-stone-600 hover:text-green-600 p-1.5 rounded-sm transition-colors bg-stone-50 hover:bg-green-50 flex-shrink-0"
        title="Save Volume"
      >
        <Save size={11} />
      </button>
    </div>
  );
};

export default VolumeInfoBar;
