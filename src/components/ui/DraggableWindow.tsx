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
  const [isResizing, setIsResizing] = useState(false);
  const [resizeStart, setResizeStart] = useState({ x: 0, y: 0, width: 0, height: 0 });
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
      } else if (isResizing && onSizeChange) {
        const newWidth = Math.max(200, resizeStart.width + (e.clientX - resizeStart.x));
        const newHeight = Math.max(150, resizeStart.height + (e.clientY - resizeStart.y));
        
        onSizeChange({ width: newWidth, height: newHeight });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
      setIsResizing(false);
    };

    if (isDragging || isResizing) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, isResizing, dragOffset, resizeStart, position, size, onPositionChange, onSizeChange]);

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
        className={`window-header flex items-center justify-between px-2 py-1.5 bg-gray-700/50 border-b border-gray-600/50 rounded-t-lg ${
          isDragging ? 'cursor-grabbing' : 'cursor-grab'
        }`}
        onMouseDown={handleMouseDown}
      >
        <span className="text-white text-xs font-medium">{title}</span>

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
            {isMinimized ? <Maximize2 size={10} className="text-gray-300" /> : <Minimize2 size={10} className="text-gray-300" />}
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
            <X size={10} className="text-gray-300 hover:text-white" />
          </button>
        </div>
      </div>

      {/* Window Content */}
      {!isMinimized && (
        <div 
          className="overflow-auto"
          style={{ 
            height: size.height - 32, // Subtract header height (reduced)
            maxHeight: size.height - 32 
          }}
        >
          {children}
        </div>
      )}

      {/* Resize Handle */}
      {!isMinimized && (
        <div
          className="absolute bottom-0 right-0 w-3 h-3 cursor-se-resize hover:bg-gray-500/50 rounded-tl"
          onMouseDown={(e) => {
            e.stopPropagation();
            setIsResizing(true);
            setResizeStart({
              x: e.clientX,
              y: e.clientY,
              width: size.width,
              height: size.height
            });
            bringToFront();
          }}
        >
          <div className="absolute bottom-0.5 right-0.5 w-1.5 h-1.5 bg-gray-400 rounded-sm"></div>
        </div>
      )}
    </div>
  );
};

export default DraggableWindow;