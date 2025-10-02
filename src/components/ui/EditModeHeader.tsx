import React, { useState, useRef, useEffect } from 'react';
import { X, Pin, PinOff, CreditCard as Edit3, Save } from 'lucide-react';

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
  volumeName,
  onVolumeNameChange,
  onSaveVolume,
  onToggleLock,
  onCollapse,
  onClose,
  isLocked,
  panelWidth
}) => {
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(volumeName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameEdit = () => {
    setTempName(volumeName);
    setIsEditingName(true);
  };

  const handleNameSave = () => {
    if (tempName.trim()) {
      onVolumeNameChange(tempName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setTempName(volumeName);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  return (
    <div className="flex items-center justify-between h-10 px-3 border-b border-gray-200">
      <div className="flex items-center gap-2 flex-1">
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={handleNameSave}
            className="text-gray-900 font-inter text-xs font-medium bg-transparent border-b border-orange-500 outline-none flex-1 min-w-0"
            maxLength={20}
          />
        ) : (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className="text-gray-900 font-inter text-xs font-medium truncate">
              {volumeName}
            </span>
            <button
              onClick={handleNameEdit}
              className="text-stone-600 hover:text-orange-600 p-1 rounded transition-colors flex-shrink-0"
              title="Edit Name"
            >
              <Edit3 size={11} />
            </button>
          </div>
        )}

        <button
          onClick={onSaveVolume}
          className="text-stone-600 hover:text-green-600 p-1.5 rounded-sm transition-colors bg-stone-50 hover:bg-green-50 flex-shrink-0"
          title="Save Volume"
        >
          <Save size={11} />
        </button>
      </div>

      {panelWidth > 200 && (
        <div className="flex items-center gap-1">
          {isLocked && (
            <button
              onClick={onCollapse}
              className="text-stone-600 hover:text-orange-600 p-1.5 rounded-sm transition-colors bg-stone-50 hover:bg-orange-50 flex-shrink-0"
              title="Arayüzü Küçült"
            >
              <X size={11} />
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

          <button
            onClick={onClose}
            className="text-stone-600 hover:text-red-600 p-1.5 rounded-sm transition-colors bg-stone-50 hover:bg-red-50 flex-shrink-0"
            title="Düzenleme Modundan Çık"
          >
            <X size={11} />
          </button>
        </div>
      )}
    </div>
  );
};

export default EditModeHeader;