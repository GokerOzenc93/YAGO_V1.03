import React from 'react';
import { CreditCard as Edit, Copy, Move, RotateCw, Trash2, Eye, EyeOff } from 'lucide-react';

interface ContextMenuProps {
  position: { x: number; y: number };
  shapeId: string;
  shapeType: string;
  onClose: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onMove: () => void;
  onRotate: () => void;
  onDelete: () => void;
  onToggleVisibility: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  position,
  shapeId,
  shapeType,
  onClose,
  onEdit,
  onCopy,
  onMove,
  onRotate,
  onDelete,
  onToggleVisibility,
}) => {
  React.useEffect(() => {
    const handleClickOutside = () => onClose();
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [onClose]);

  return (
    <div
      className="fixed bg-gray-800 rounded-lg shadow-xl border border-gray-700 py-2 z-50 min-w-48"
      style={{ left: position.x, top: position.y }}
      onClick={(e) => e.stopPropagation()}
    >
      <div className="px-4 py-2 border-b border-gray-700 text-sm text-gray-400">
        {shapeType} - {shapeId.slice(0, 8)}
      </div>

      <button
        onClick={onEdit}
        className="w-full px-4 py-2 hover:bg-gray-700 flex items-center gap-3 text-left"
      >
        <Edit size={16} />
        <span>Edit</span>
      </button>

      <button
        onClick={onCopy}
        className="w-full px-4 py-2 hover:bg-gray-700 flex items-center gap-3 text-left"
      >
        <Copy size={16} />
        <span>Copy</span>
      </button>

      <button
        onClick={onMove}
        className="w-full px-4 py-2 hover:bg-gray-700 flex items-center gap-3 text-left"
      >
        <Move size={16} />
        <span>Move</span>
      </button>

      <button
        onClick={onRotate}
        className="w-full px-4 py-2 hover:bg-gray-700 flex items-center gap-3 text-left"
      >
        <RotateCw size={16} />
        <span>Rotate</span>
      </button>

      <div className="border-t border-gray-700 my-1" />

      <button
        onClick={onToggleVisibility}
        className="w-full px-4 py-2 hover:bg-gray-700 flex items-center gap-3 text-left"
      >
        <Eye size={16} />
        <span>Toggle Visibility</span>
      </button>

      <button
        onClick={onDelete}
        className="w-full px-4 py-2 hover:bg-gray-700 flex items-center gap-3 text-left text-red-400"
      >
        <Trash2 size={16} />
        <span>Delete</span>
      </button>
    </div>
  );
};

export default ContextMenu;
