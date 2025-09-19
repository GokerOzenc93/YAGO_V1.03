import React, { useState, useRef, useEffect } from 'react';
import { X, Pin, PinOff, Edit3, Save } from 'lucide-react';

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
    <div className="flex items-center justify-between p-3 pt-4 border-b border-gray-200">
      <div className="flex items-center gap-2 flex-1">
        {isEditingName ? (
          <input
            ref={nameInputRef}
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            onKeyDown={handleNameKeyDown}
            onBlur={handleNameSave}
            className="text-gray-900 font-inter text-base font-bold bg-transparent border-b border-blue-500 outline-none flex-1 min-w-0"
            maxLength={20}
          />
        ) : (
          <div className="flex items-center gap-1 flex-1 min-w-0">
            <span className="text-gray-900 font-inter text-base font-bold truncate">
              {volumeName}
            </span>
            <button
              onClick={handleNameEdit}
              className="text-gray-500 hover:text-blue-600 p-0.5 rounded transition-colors flex-shrink-0"
              title="Edit Name"
            >
              <Edit3 size={12} />
            </button>
          </div>
        )}
        
        <button
          onClick={onSaveVolume}
          className="text-gray-500 hover:text-green-600 p-1.5 rounded-lg transition-colors bg-gray-50 hover:bg-green-50 flex-shrink-0"
          title="Save Volume"
        >
          <Save size={14} />
        </button>
      </div>
      
      {/* Panel genişliği 200px'ten büyükse düğmeleri göster*/}
      {panelWidth > 200 && (
        <div className="flex items-center gap-1">
          {isLocked && (
            <button
              onClick={onCollapse}
              className="text-gray-500 hover:text-blue-600 p-1.5 rounded-lg transition-colors bg-gray-50 hover:bg-blue-50"
              title="Arayüzü Küçült"
            >
              <X size={14} />
            </button>
          )}
          
          <button
            onClick={onToggleLock}
            className={`p-1 rounded transition-colors ${
              isLocked ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50'
            }`}
            title={isLocked ? 'Paneli Çöz' : 'Paneli Sabitle'}
          >
            {isLocked ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
          
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-red-600 p-1.5 rounded-lg transition-colors bg-gray-50 hover:bg-red-50"
            title="Düzenleme Modundan Çık"
          >
            <X size={14} />
          </button>
        </div>
      )}
    </div>
  );
};

export default EditModeHeader;