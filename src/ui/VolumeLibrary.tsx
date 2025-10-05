import React from 'react';
import { ChevronLeft, Archive } from 'lucide-react';
import { getSavedVolumes } from '../core/fileSystem';

interface VolumeLibraryProps {
  onBack: () => void;
  onVolumeSelect: (volumeName: string) => void;
  onVolumeDelete: (volumeName: string) => void;
  refreshTrigger: number;
}

const VolumeLibrary: React.FC<VolumeLibraryProps> = ({
  onBack,
  onVolumeSelect,
  onVolumeDelete,
  refreshTrigger
}) => {
  return (
    <div className="flex-1 flex flex-col">
      <div className="flex items-center justify-between h-10 px-3 bg-orange-50 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1.5 hover:bg-orange-200 rounded-sm transition-colors"
          >
            <ChevronLeft size={11} className="text-orange-600" />
          </button>
          <Archive size={11} className="text-orange-600" />
          <span className="text-xs font-medium text-orange-800">Volume Library</span>
        </div>
      </div>

      <div className="flex-1 p-4">
        <div className="space-y-2">
          {getSavedVolumes().map((volumeName) => (
            <div key={volumeName} className="flex items-center justify-between h-10 px-3 bg-white rounded-md border border-stone-200">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 bg-orange-100 rounded flex items-center justify-center">
                  <Archive size={11} className="text-orange-600" />
                </div>
                <span className="text-xs font-medium text-slate-800">{volumeName}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => onVolumeSelect(volumeName)}
                  className="h-6 px-2 text-xs font-medium bg-orange-100 text-orange-700 rounded-sm hover:bg-orange-200 transition-colors"
                >
                  Load
                </button>
                <button
                  onClick={() => onVolumeDelete(volumeName)}
                  className="h-6 px-2 text-xs font-medium bg-red-100 text-red-700 rounded-sm hover:bg-red-200 transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
          {getSavedVolumes().length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Archive size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">No saved volumes</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VolumeLibrary;