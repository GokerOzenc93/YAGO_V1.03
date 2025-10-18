import React from 'react';
import { Edit, Copy, Move, RotateCcw, Trash2, Eye, EyeOff, Navigation } from 'lucide-react';
import { useAppStore, Tool } from '../store/appStore';

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
  const { setActiveTool, setPointToPointMoveState, selectShape } = useAppStore();

  const handlePointToPointMove = () => {
    // Point to Point Move modunu başlat
    setActiveTool(Tool.POINT_TO_POINT_MOVE);
    
    // Auto snap'i etkinleştir
    const { enableAutoSnap } = useAppStore.getState();
    enableAutoSnap(Tool.POINT_TO_POINT_MOVE);
    
    setPointToPointMoveState({
      isActive: true,
      selectedShapeId: shapeId,
      sourcePoint: null,
      targetPoint: null,
    });
    selectShape(shapeId);
    console.log(`Point to Point Move started for shape: ${shapeId}`);
    onClose();
  };

  const menuItems = [
    {
      icon: <Edit size={14} />,
      label: 'Edit',
      action: onEdit,
      enabled: true,
      shortcut: 'E',
      description: 'Enter edit mode for this object'
    },
    {
      icon: <Copy size={14} />,
      label: 'Copy',
      action: onCopy,
      enabled: false, // Şimdilik devre dışı
      shortcut: 'Ctrl+C'
    },
    {
      icon: <Navigation size={14} />,
      label: 'Point to Point Move',
      action: handlePointToPointMove,
      enabled: true,
      shortcut: 'P2P',
      description: 'Move object from one snap point to another'
    },
    {
      icon: <RotateCcw size={14} />,
      label: 'Rotate',
      action: onRotate,
      enabled: false, // Şimdilik devre dışı
      shortcut: 'R'
    },
    { type: 'separator' },
    {
      icon: <Eye size={14} />,
      label: 'Hide/Show',
      action: onToggleVisibility,
      enabled: false, // Şimdilik devre dışı
      shortcut: 'H'
    },
    {
      icon: <Trash2 size={14} />,
      label: 'Delete',
      action: onDelete,
      enabled: false, // Şimdilik devre dışı
      shortcut: 'Del'
    },
  ];

  React.useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      onClose();
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    // Kısa bir gecikme ile event listener'ları ekle
    setTimeout(() => {
      document.addEventListener('click', handleClickOutside);
      document.addEventListener('keydown', handleKeyDown);
    }, 10);

    return () => {
      document.removeEventListener('click', handleClickOutside);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return (
    <div
      className="fixed bg-gray-800/95 backdrop-blur-sm rounded-md border border-gray-600/50 py-1 z-50 shadow-lg min-w-[180px]"
      style={{
        left: position.x,
        top: position.y,
      }}
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="px-3 py-1.5 border-b border-gray-600/50">
        <div className="text-xs text-gray-400 font-medium">
          {shapeType.charAt(0).toUpperCase() + shapeType.slice(1)}
        </div>
        <div className="text-[10px] text-gray-500 font-mono">
          ID: {shapeId.substring(0, 8)}...
        </div>
      </div>

      {/* Menu Items */}
      {menuItems.map((item, index) => (
        item.type === 'separator' ? (
          <div key={index} className="border-t border-gray-600/50 my-1" />
        ) : (
          <button
            key={index}
            className={`w-full px-3 py-1.5 text-left text-xs flex items-center justify-between transition-colors ${
              item.enabled
                ? 'hover:bg-gray-700/50 text-gray-200 cursor-pointer'
                : 'text-gray-500 cursor-not-allowed opacity-50'
            }`}
            onClick={(e) => {
              e.stopPropagation();
              if (item.enabled) {
                item.action();
                onClose();
              }
            }}
            disabled={!item.enabled}
            title={item.description || item.label}
          >
            <div className="flex items-center gap-2">
              {item.icon}
              <span className="font-medium">{item.label}</span>
              {item.label === 'Edit' && (
                <span className="text-[9px] text-orange-400 bg-orange-400/20 px-1 rounded">
                  ISOLATE
                </span>
              )}
            </div>
            {item.shortcut && (
              <span className="text-[10px] text-gray-400 font-mono">
                {item.shortcut}
              </span>
            )}
          </button>
        )
      ))}

      {/* Footer */}
      <div className="px-3 py-1 border-t border-gray-600/50 mt-1">
        <div className="text-[10px] text-gray-500">
          Edit mode will isolate this object
        </div>
      </div>
    </div>
  );
};

export default ContextMenu;