import React, { useState, useEffect } from 'react';
import { ChevronLeft, Archive, Plus, Save } from 'lucide-react';
import { getSavedVolumes } from '../../utils/fileSystem';

interface VolumeLibraryProps {
  onBack: () => void;
  onVolumeSelect: (volumeName: string) => void;
  onVolumeDelete: (volumeName: string) => void;
  onSaveCurrentVolume: () => void;
  refreshTrigger: number;
}

const VolumeLibrary: React.FC<VolumeLibraryProps> = ({
  onBack,
  onVolumeSelect,
  onVolumeDelete,
  onSaveCurrentVolume,
  refreshTrigger
}) => {
  const [volumes, setVolumes] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadVolumes = async () => {
      setLoading(true);
      const volumeList = await getSavedVolumes();
      setVolumes(volumeList);
      setLoading(false);
    };

    loadVolumes();
  }, [refreshTrigger]);

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
        <div className="flex items-center gap-1">
          <button
            onClick={onSaveCurrentVolume}
            className="h-6 px-2 text-xs font-medium bg-green-100 text-green-700 rounded-sm hover:bg-green-200 transition-colors flex items-center gap-1"
            title="Save current volume"
          >
            <Save size={11} />
            <span>Save</span>
          </button>
          <button
            onClick={onSaveCurrentVolume}
            className="p-1.5 hover:bg-orange-200 rounded-sm transition-colors"
            title="New volume"
          >
            <Plus size={14} className="text-orange-600" />
          </button>
        </div>
      </div>

      <div className="flex-1 p-4">
        {loading ? (
          <div className="text-center py-4 text-xs text-gray-500">Loading volumes...</div>
        ) : (
          <div className="space-y-2">
            {volumes.map((volumeName) => (
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
          {volumes.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <Archive size={32} className="mx-auto mb-2 opacity-50" />
              <p className="text-xs">No saved volumes</p>
            </div>
          )}
        </div>
        )}
      </div>
    </div>
  );
};

export default VolumeLibrary;