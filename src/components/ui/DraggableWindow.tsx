import React, { useState, useRef, useEffect } from 'react';
import { X, Maximize2, Minimize2 } from 'lucide-react';

interface DraggableWindowProps {
  id: string;
  title: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  children: React.ReactNode;
  onClose: () => void;
  onPositionChange: (position: { x: number; y: number }) => void;
  onSizeChange?: (size: { width: number; height: number }) => void;
}

const DraggableWindow: React.FC<DraggableWindowProps> = ({
  id,
  title,
  position,
  size,
  children,
  onClose,
  onPositionChange,
  onSizeChange,
}) => {
  const [isDragging, setIsDragging] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const [zIndex, setZIndex] = useState(1000);
  const windowRef = useRef<HTMLDivElement>(null);

  // Bring window to front when clicked
  const bringToFront = () => {
    setZIndex(Date.now());
  };

  // Handle mouse down on header (start dragging)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.window-header')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
      bringToFront();
      e.preventDefault();
    }
  };

  // Handle mouse move (dragging)
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        const newX = Math.max(0, Math.min(window.innerWidth - size.width, e.clientX - dragOffset.x));
        const newY = Math.max(0, Math.min(window.innerHeight - size.height, e.clientY - dragOffset.y));
        
        onPositionChange({ x: newX, y: newY });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset, position, size, onPositionChange]);

  // Prevent window from going off-screen when window resizes
  useEffect(() => {
    const handleResize = () => {
      const maxX = window.innerWidth - size.width;
      const maxY = window.innerHeight - size.height;
      
      if (position.x > maxX || position.y > maxY) {
        onPositionChange({
          x: Math.max(0, Math.min(maxX, position.x)),
          y: Math.max(0, Math.min(maxY, position.y)),
        });
      }
    };

    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [position, size, onPositionChange]);

  return (
    <div
      ref={windowRef}
      className={`fixed bg-gray-800/95 backdrop-blur-sm border border-gray-600/50 rounded-lg shadow-2xl ${
        isDragging ? 'cursor-grabbing' : 'cursor-default'
      }`}
      style={{
        left: position.x,
        top: position.y,
        width: size.width,
        height: isMinimized ? 'auto' : size.height,
        zIndex,
        minWidth: 250,
        minHeight: isMinimized ? 'auto' : 200,
      }}
      onMouseDown={bringToFront}
    >
      {/* Window Header */}
      <div
        className={`window-header flex items-center justify-between px-3 py-2 bg-gray-700/50 border-b border-gray-600/50 rounded-t-lg ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
      >
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 bg-red-500 rounded-full"></div>
          <div className="w-3 h-3 bg-yellow-500 rounded-full"></div>
          <div className="w-3 h-3 bg-green-500 rounded-full"></div>
          <span className="text-white text-sm font-medium ml-2">{title}</span>
        </div>

        <div className="flex items-center gap-1">
          {/* Minimize Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              setIsMinimized(!isMinimized);
            }}
            className="p-1 hover:bg-gray-600/50 rounded transition-colors"
            title={isMinimized ? "Restore" : "Minimize"}
          >
            {isMinimized ? <Maximize2 size={12} className="text-gray-300" /> : <Minimize2 size={12} className="text-gray-300" />}
          </button>

          {/* Close Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="p-1 hover:bg-red-600/50 rounded transition-colors"
            title="Close"
          >
            <X size={12} className="text-gray-300 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Window Content */}
      {!isMinimized && (
        <div 
          className="overflow-auto"
          style={{ 
            height: size.height - 40, // Subtract header height
            maxHeight: size.height - 40 
          }}
        >
          {children}
        </div>
      )}

      {/* Resize Handle */}
      {!isMinimized && onSizeChange && (
        <div
          className="absolute bottom-0 right-0 w-4 h-4 cursor-se-resize"
          onMouseDown={(e) => {
            e.stopPropagation();
            // Resize functionality can be implemented here if needed
          }}
        >
          <div className="absolute bottom-1 right-1 w-2 h-2 bg-gray-500 rounded-sm"></div>
        </div>
      )}
    </div>
  );
};

export default DraggableWindow;