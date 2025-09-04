import React, { useEffect, useRef } from 'react';
import {
  Copy,
  Trash2,
  Move,
  RotateCw,
  Square,
  Circle,
  Ruler,
  Eye,
  EyeOff,
  Lock,
  Unlock,
} from 'lucide-react';
import { useAppStore, Tool } from './store/appStore';

interface ContextMenuProps {
  x: number;
  y: number;
  onClose: () => void;
}

export default function ContextMenu({ x, y, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const {
    selectedShapeId,
    shapes,
    setTool,
    duplicateShape,
    deleteShape,
    toggleShapeVisibility,
    toggleShapeLock,
  } = useAppStore();

  const selectedShape = shapes.find(s => s.id === selectedShapeId);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        onClose();
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [onClose]);

  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  const menuItems = [
    // Creation tools
    {
      icon: Square,
      label: 'Rectangle',
      action: () => setTool(Tool.RECTANGLE),
      divider: false,
    },
    {
      icon: Circle,
      label: 'Circle',
      action: () => setTool(Tool.CIRCLE),
      divider: false,
    },
    {
      icon: Ruler,
      label: 'Line',
      action: () => setTool(Tool.LINE),
      divider: true,
    },
  ];

  // Add shape-specific actions if a shape is selected
  if (selectedShape) {
    menuItems.push(
      {
        icon: Copy,
        label: 'Duplicate',
        action: () => duplicateShape(selectedShape.id),
        divider: false,
      },
      {
        icon: Move,
        label: 'Move',
        action: () => setTool(Tool.MOVE),
        divider: false,
      },
      {
        icon: RotateCw,
        label: 'Rotate',
        action: () => setTool(Tool.ROTATE),
        divider: false,
      },
      {
        icon: selectedShape.visible ? EyeOff : Eye,
        label: selectedShape.visible ? 'Hide' : 'Show',
        action: () => toggleShapeVisibility(selectedShape.id),
        divider: false,
      },
      {
        icon: selectedShape.locked ? Unlock : Lock,
        label: selectedShape.locked ? 'Unlock' : 'Lock',
        action: () => toggleShapeLock(selectedShape.id),
        divider: false,
      },
      {
        icon: Trash2,
        label: 'Delete',
        action: () => deleteShape(selectedShape.id),
        divider: false,
        danger: true,
      }
    );
  }

  // Position the menu to stay within viewport
  const menuStyle: React.CSSProperties = {
    position: 'fixed',
    left: x,
    top: y,
    zIndex: 1000,
  };

  // Adjust position if menu would go off-screen
  if (menuRef.current) {
    const rect = menuRef.current.getBoundingClientRect();
    if (x + rect.width > window.innerWidth) {
      menuStyle.left = x - rect.width;
    }
    if (y + rect.height > window.innerHeight) {
      menuStyle.top = y - rect.height;
    }
  }

  return (
    <div
      ref={menuRef}
      style={menuStyle}
      className="bg-gray-800 border border-gray-600 rounded-lg shadow-lg py-2 min-w-48"
    >
      {menuItems.map((item, index) => (
        <React.Fragment key={index}>
          <button
            onClick={() => handleAction(item.action)}
            className={`w-full px-4 py-2 text-left flex items-center space-x-3 hover:bg-gray-700 transition-colors ${
              item.danger ? 'text-red-400 hover:text-red-300' : 'text-gray-300 hover:text-white'
            }`}
          >
            <item.icon className="w-4 h-4" />
            <span>{item.label}</span>
          </button>
          {item.divider && <div className="border-t border-gray-600 my-1" />}
        </React.Fragment>
      ))}
    </div>
  );
}