import React from 'react';
import { Save, X, FileCheck } from 'lucide-react';

interface VolumeInfoBarProps {
  volumeName: string;
  cabinetCode: string;
  description: string;
  pose: number;
  onSave: () => void;
  onSaveAs: () => void;
  onExit: () => void;
}

const VolumeInfoBar: React.FC<VolumeInfoBarProps> = ({
  volumeName,
  cabinetCode,
  description,
  pose,
  onSave,
  onSaveAs,
  onExit,
}) => {
  return (
    <div className="flex items-center justify-between h-10 px-3 bg-white border-b border-gray-200">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Volume</span>
          <span className="text-xs font-semibold text-gray-900">{volumeName}</span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded border border-gray-200">
          <span className="text-xs font-medium text-gray-500">CabinetCode</span>
          <span className="text-xs font-semibold text-gray-900">{cabinetCode}</span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Description</span>
          <span className="text-xs font-semibold text-gray-900">{description || '-'}</span>
        </div>
        <div className="flex items-center gap-2 px-2 py-1 bg-gray-50 rounded border border-gray-200">
          <span className="text-xs font-medium text-gray-500">Pose</span>
          <span className="text-xs font-semibold text-gray-900">{pose}</span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={onSave}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 rounded border border-stone-200 hover:border-stone-300 transition-all flex-shrink-0"
          title="Save Volume"
        >
          <Save size={12} />
          <span>Save</span>
        </button>
        <button
          onClick={onSaveAs}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 rounded border border-stone-200 hover:border-stone-300 transition-all flex-shrink-0"
          title="Save As New Volume"
        >
          <FileCheck size={12} />
          <span>Save As</span>
        </button>
        <button
          onClick={onExit}
          className="flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-stone-700 hover:text-stone-900 bg-stone-50 hover:bg-stone-100 rounded border border-stone-200 hover:border-stone-300 transition-all flex-shrink-0"
          title="Exit Edit Mode"
        >
          <X size={12} />
          <span>Exit</span>
        </button>
      </div>
    </div>
  );
};

export default VolumeInfoBar;
