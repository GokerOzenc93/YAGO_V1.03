import React from 'react';
import { useAppStore, Tool, CameraType } from '../store';
import {
  MousePointer2,
  Move,
  RotateCcw,
  Maximize,
  Save,
  Package,
  Camera,
  CameraOff,
  Plus,
  Minus
} from 'lucide-react';
import * as THREE from 'three';

const Toolbar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    addShape,
    selectedShapeId,
    cameraType,
    setCameraType,
    opencascadeInstance
  } = useAppStore();

  const handleAddGeometry = async () => {
    try {
      if (opencascadeInstance) {
        const { createOCGeometry, convertOCShapeToThreeGeometry } = await import('../opencascade');

        const ocShape = createOCGeometry(opencascadeInstance, {
          type: 'box',
          width: 600,
          height: 600,
          depth: 600
        });

        const geometry = convertOCShapeToThreeGeometry(opencascadeInstance, ocShape);

        addShape({
          id: `oc-box-${Date.now()}`,
          type: 'box',
          geometry,
          position: [0, 300, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: '#2563eb',
          parameters: { width: 600, height: 600, depth: 600 },
          ocShape
        });
        console.log('✅ OpenCascade geometry created');
      } else {
        const geometry = new THREE.BoxGeometry(600, 600, 600);
        addShape({
          id: `box-${Date.now()}`,
          type: 'box',
          geometry,
          position: [0, 300, 0],
          rotation: [0, 0, 0],
          scale: [1, 1, 1],
          color: '#2563eb',
          parameters: { width: 600, height: 600, depth: 600 }
        });
        console.log('✅ Three.js geometry created');
      }
    } catch (error) {
      console.error('❌ Failed to create geometry:', error);
    }
  };

  const transformTools = [
    { id: Tool.SELECT, icon: <MousePointer2 size={12} />, label: 'Select' },
    { id: Tool.MOVE, icon: <Move size={12} />, label: 'Move' },
    { id: Tool.ROTATE, icon: <RotateCcw size={12} />, label: 'Rotate' },
    { id: Tool.SCALE, icon: <Maximize size={12} />, label: 'Scale' }
  ];

  return (
    <div className="flex flex-col bg-stone-50 border-b border-stone-200">
      <div className="flex items-center h-12 px-4">
        <div className="flex items-center gap-3">
          <img
            src="/yago_logo.png"
            alt="YAGO Design"
            className="h-6 w-auto object-contain"
          />
          <div className="w-px h-5 bg-stone-300"></div>
          <span className="text-sm font-semibold text-slate-800">YAGO CAD</span>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() =>
              setCameraType(
                cameraType === CameraType.PERSPECTIVE
                  ? CameraType.ORTHOGRAPHIC
                  : CameraType.PERSPECTIVE
              )
            }
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-orange-100 hover:bg-orange-200 transition-colors"
          >
            {cameraType === CameraType.PERSPECTIVE ? (
              <Camera size={11} className="text-orange-700" />
            ) : (
              <CameraOff size={11} className="text-orange-700" />
            )}
            <span className="text-xs font-semibold text-orange-800">
              {cameraType === CameraType.PERSPECTIVE ? 'Persp' : 'Ortho'}
            </span>
          </button>
        </div>
      </div>

      <div className="flex items-center h-10 gap-1.5 px-3">
        <div className="flex items-center gap-0.5 bg-white rounded-md p-1 shadow-sm border border-stone-200">
          <button className="p-1.5 rounded-sm text-stone-600 hover:bg-stone-50">
            <Save size={11} />
          </button>
        </div>

        <div className="w-px h-6 bg-stone-300"></div>

        <div className="flex items-center gap-0.5 bg-white rounded-md p-1 shadow-sm border border-stone-200">
          {transformTools.map((tool) => (
            <button
              key={tool.id}
              className={`p-1.5 rounded-sm transition-all ${
                activeTool === tool.id
                  ? 'bg-orange-50 text-orange-800 shadow-sm border border-orange-200'
                  : 'hover:bg-stone-50 text-stone-600'
              }`}
              onClick={() => setActiveTool(tool.id)}
              title={tool.label}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-6 bg-stone-300"></div>

        <div className="flex items-center gap-0.5 bg-white rounded-md p-1 shadow-sm border border-stone-200">
          <button
            onClick={handleAddGeometry}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-sm hover:bg-orange-50 hover:text-orange-800 text-stone-600 transition-all"
          >
            <Package size={11} />
            <span className="text-xs font-medium">Add Geometry</span>
          </button>
        </div>

        <div className="w-px h-6 bg-stone-300"></div>

        <div className="flex items-center gap-0.5 bg-white rounded-md p-1 shadow-sm border border-stone-200">
          <button
            className="p-1.5 rounded-sm hover:bg-stone-50 text-stone-600"
            disabled={!selectedShapeId}
            title="Union"
          >
            <Plus size={11} />
          </button>
          <button
            className="p-1.5 rounded-sm hover:bg-stone-50 text-stone-600"
            disabled={!selectedShapeId}
            title="Subtract"
          >
            <Minus size={11} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default Toolbar;
