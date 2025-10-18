import React, { useEffect } from 'react';
import { Eye, Edit3, Copy, Trash2, Scissors } from 'lucide-react';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
  onIsolate: () => void;
  onEdit: () => void;
  onCopy: () => void;
  onDelete: () => void;
  onCut: () => void;
}

const ContextMenu: React.FC<ContextMenuProps> = ({
  x,
  y,
  onClose,
  onIsolate,
  onEdit,
  onCopy,
  onDelete,
  onCut
}) => {
  useEffect(() => {
    const handleClick = () => onClose();
    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      onClose();
    };

    setTimeout(() => {
      document.addEventListener('click', handleClick);
      document.addEventListener('contextmenu', handleContextMenu);
    }, 0);

    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleContextMenu);
    };
  }, [onClose]);

  const menuItems = [
    { icon: <Eye size={14} />, label: 'Isolate', onClick: onIsolate },
    { icon: <Edit3 size={14} />, label: 'Edit', onClick: onEdit },
    { icon: <Copy size={14} />, label: 'Copy', onClick: onCopy },
    { icon: <Scissors size={14} />, label: 'Cut', onClick: onCut },
    { icon: <Trash2 size={14} />, label: 'Delete', onClick: onDelete, danger: true }
  ];

  return (
    <div
      className="fixed bg-white rounded-lg shadow-xl border border-stone-200 py-1 z-[100] min-w-[160px]"
      style={{ left: x, top: y }}
      onClick={(e) => e.stopPropagation()}
    >
      {menuItems.map((item, index) => (
        <button
          key={index}
          onClick={(e) => {
            e.stopPropagation();
            item.onClick();
            onClose();
          }}
          className={`w-full flex items-center gap-3 px-4 py-2 text-sm transition-colors ${
            item.danger
              ? 'text-red-600 hover:bg-red-50'
              : 'text-stone-700 hover:bg-stone-50'
          }`}
        >
          {item.icon}
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default ContextMenu;
