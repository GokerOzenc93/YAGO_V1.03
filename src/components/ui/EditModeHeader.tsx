import React from 'react';
import { Pin, PinOff, ChevronLeft } from 'lucide-react';

interface EditModeHeaderProps {
  volumeName: string;
  onVolumeNameChange: (name: string) => void;
  onSaveVolume: () => void;
  onToggleLock: () => void;
  onCollapse: () => void;
  onClose: () => void;
  isLocked: boolean;
  panelWidth: number;
}

const EditModeHeader: React.FC<EditModeHeaderProps> = ({
  onToggleLock,
  onCollapse,
  onClose,
  isLocked,
  panelWidth
}) => {

  return (
    <div className="flex items-center justify-between h-10 px-3 border-b border-gray-200 bg-white">
      <h1 className="text-sm font-semibold text-gray-900">Edit Mode</h1>

      {panelWidth > 200 && (
        <div className="flex items-center gap-1">
          {isLocked && (
            <button
              onClick={onCollapse}
              className="text-stone-600 hover:text-orange-600 p-1.5 rounded-sm transition-colors bg-stone-50 hover:bg-orange-50 flex-shrink-0"
              title="Paneli Sola Gizle"
            >
              <ChevronLeft size={11} />
            </button>
          )}

          <button
            onClick={onToggleLock}
            className={`p-1.5 rounded-sm transition-colors flex-shrink-0 ${
              isLocked ? 'bg-orange-50 text-orange-800 shadow-sm border border-orange-200' : 'text-stone-600 hover:text-orange-600 bg-stone-50 hover:bg-orange-50'
            }`}
            title={isLocked ? 'Paneli Çöz' : 'Paneli Sabitle'}
          >
            {isLocked ? <Pin size={11} /> : <PinOff size={11} />}
          </button>
        </div>
      )}
    </div>
  );
};

export default EditModeHeader;