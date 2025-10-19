import React from 'react';
import { Package, FolderOpen } from 'lucide-react';
import { useAppStore } from '../store';
import { createBoxGeometry } from '../utils/geometry';

interface ToolbarProps {
  onOpenCatalog: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onOpenCatalog }) => {
  const { addShape, opencascadeInstance } = useAppStore();

  const handleAddGeometry = async () => {
    const w = 600, h = 600, d = 600;
    const geometry = createBoxGeometry(w, h, d);

    let ocShape = null;
    if (opencascadeInstance) {
      try {
        const { createOCGeometry } = await import('../opencascade');
        ocShape = createOCGeometry(opencascadeInstance, {
          type: 'box',
          width: w,
          height: h,
          depth: d
        });
        console.log('✅ OpenCascade shape created for box');
      } catch (error) {
        console.error('❌ Failed to create OpenCascade shape:', error);
      }
    }

    addShape({
      id: `box-${Date.now()}`,
      type: 'box',
      geometry,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#2563eb',
      parameters: { width: w, height: h, depth: d },
      ocShape
    });
    console.log('✅ Box geometry added');
  };

  return (
    <div className="flex items-center h-16 px-4 bg-stone-50 border-b border-stone-200 shadow-sm">
      <div className="flex items-center gap-2">
        <img
          src="/yago_logo.png"
          alt="YAGO Design Logo"
          className="h-10 w-auto object-contain"
        />
        <span className="text-lg font-bold text-slate-800">YAGO Design</span>
      </div>

      <div className="ml-auto flex items-center gap-3">
        <button
          onClick={handleAddGeometry}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-medium transition-colors"
        >
          <Package size={18} />
          Add Box
        </button>

        <button
          onClick={onOpenCatalog}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-700 text-white font-medium transition-colors"
        >
          <FolderOpen size={18} />
          Catalog
        </button>
      </div>
    </div>
  );
};

export default Toolbar;
