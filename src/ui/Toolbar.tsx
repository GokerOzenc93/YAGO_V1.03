import React from 'react';
import { useAppStore, Tool, CameraType, ViewMode } from '../store';
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
  Minus,
  Box
} from 'lucide-react';
import * as THREE from 'three';

const Toolbar: React.FC = () => {
  const {
    activeTool,
    setActiveTool,
    addShape,
    selectedShapeId,
    shapes,
    subtractShape,
    cameraType,
    setCameraType,
    viewMode,
    setViewMode,
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

  const handleSubtract = async () => {
    console.log('Subtract button clicked');
    console.log('Selected shape ID:', selectedShapeId);
    console.log('Total shapes:', shapes.length);

    if (!selectedShapeId || shapes.length < 2) {
      console.warn('⚠️ Need at least 2 shapes and one selected');
      return;
    }

    if (!opencascadeInstance) {
      console.error('❌ OpenCascade not loaded yet');
      return;
    }

    const { updateShape } = useAppStore.getState();
    const selectedShape = shapes.find((s) => s.id === selectedShapeId);
    const otherShapes = shapes.filter((s) => s.id !== selectedShapeId);

    if (otherShapes.length === 0) {
      console.warn('⚠️ No other shapes to subtract from');
      return;
    }

    const targetShape = otherShapes[0];

    console.log('Selected shape has ocShape:', !!selectedShape?.ocShape);
    console.log('Target shape has ocShape:', !!targetShape.ocShape);

    try {
      const { createOCGeometry } = await import('../opencascade');

      if (!selectedShape?.ocShape && selectedShape) {
        console.log('🔄 Converting selected shape to OpenCascade...');
        const selectedOCShape = createOCGeometry(opencascadeInstance, {
          type: selectedShape.type as any,
          ...selectedShape.parameters
        });
        updateShape(selectedShape.id, { ocShape: selectedOCShape });
      }

      if (!targetShape.ocShape) {
        console.log('🔄 Converting target shape to OpenCascade...');
        const targetOCShape = createOCGeometry(opencascadeInstance, {
          type: targetShape.type as any,
          ...targetShape.parameters
        });
        updateShape(targetShape.id, { ocShape: targetOCShape });
      }

      setTimeout(() => {
        const updatedShapes = useAppStore.getState().shapes;
        const updatedSelected = updatedShapes.find((s) => s.id === selectedShapeId);
        const updatedTarget = updatedShapes.find((s) => s.id === targetShape.id);

        if (updatedSelected?.ocShape && updatedTarget?.ocShape) {
          console.log('🔧 Performing subtraction...');
          subtractShape(updatedTarget.id, updatedSelected.id);
        }
      }, 100);
    } catch (error) {
      console.error('❌ Subtraction failed:', error);
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
              setViewMode(
                viewMode === ViewMode.WIREFRAME
                  ? ViewMode.SOLID
                  : ViewMode.WIREFRAME
              )
            }
            className="flex items-center gap-1 px-2 py-1 rounded-md bg-blue-100 hover:bg-blue-200 transition-colors"
          >
            <Box size={11} className="text-blue-700" />
            <span className="text-xs font-semibold text-blue-800">
              {viewMode === ViewMode.WIREFRAME ? 'Wire' : 'Solid'}
            </span>
          </button>

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
            className="p-1.5 rounded-sm hover:bg-stone-50 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed"
            disabled={!selectedShapeId}
            title="Union"
          >
            <Plus size={11} />
          </button>
          <button
            onClick={handleSubtract}
            className="p-1.5 rounded-sm hover:bg-red-50 hover:text-red-700 text-stone-600 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
            disabled={!selectedShapeId || shapes.length < 2}
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
