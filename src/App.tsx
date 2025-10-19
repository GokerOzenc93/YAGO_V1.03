import React, { useEffect, useState } from 'react';
import Scene from './Scene';
import Toolbar from './ui/Toolbar';
import Terminal from './ui/Terminal';
import StatusBar from './ui/StatusBar';
import CatalogPanel from './ui/CatalogPanel';
import { useAppStore } from './store';
import { catalogService, CatalogItem } from './lib/supabase';
import { createGeometryFromType } from './utils/geometry';

function App() {
  const { setOpenCascadeInstance, setOpenCascadeLoading, opencascadeLoading, addShape } = useAppStore();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadOpenCascade = async () => {
      if ((window as any).opencascadeInstance) {
        console.log('✅ OpenCascade already loaded, reusing instance');
        if (mounted) {
          setOpenCascadeInstance((window as any).opencascadeInstance);
          setOpenCascadeLoading(false);
        }
        return;
      }

      if ((window as any).opencascadeLoading) {
        console.log('⏳ OpenCascade already loading...');
        return;
      }

      console.log('🔄 Starting OpenCascade load...');
      (window as any).opencascadeLoading = true;

      if (mounted) {
        setOpenCascadeLoading(true);
      }

      try {
        console.log('📦 Importing OpenCascade module...');
        const { initOpenCascade } = await import('opencascade.js');

        console.log('🔧 Initializing OpenCascade WASM...');
        const oc = await initOpenCascade();

        if (mounted) {
          (window as any).opencascadeInstance = oc;
          (window as any).opencascadeLoading = false;
          setOpenCascadeInstance(oc);
          setOpenCascadeLoading(false);
          console.log('✅ OpenCascade.js ready!');
        }
      } catch (error) {
        console.error('❌ Failed to load OpenCascade:', error);
        (window as any).opencascadeLoading = false;
        if (mounted) setOpenCascadeLoading(false);
      }
    };

    loadOpenCascade();

    return () => {
      mounted = false;
    };
  }, [setOpenCascadeInstance, setOpenCascadeLoading]);

  useEffect(() => {
    if (catalogOpen) {
      loadCatalogItems();
    }
  }, [catalogOpen]);

  const loadCatalogItems = async () => {
    const items = await catalogService.getAll();
    setCatalogItems(items);
  };

  const handleLoadFromCatalog = (item: CatalogItem) => {
    const geometryData = item.geometry_data;
    const params = geometryData.parameters || {};

    console.log('📥 Loading geometry from catalog:', {
      code: item.code,
      type: geometryData.type,
      parameters: params,
      position: geometryData.position,
      scale: geometryData.scale,
      vertexModifications: geometryData.vertexModifications?.length || 0
    });

    const geometry = createGeometryFromType(geometryData.type, params);

    const newPosition: [number, number, number] = [
      geometryData.position?.[0] ?? 0,
      geometryData.position?.[1] ?? 0,
      geometryData.position?.[2] ?? 0
    ];

    addShape({
      id: `${geometryData.type}-${Date.now()}`,
      type: geometryData.type || 'box',
      geometry,
      position: newPosition,
      rotation: [
        geometryData.rotation?.[0] ?? 0,
        geometryData.rotation?.[1] ?? 0,
        geometryData.rotation?.[2] ?? 0
      ],
      scale: [
        geometryData.scale?.[0] ?? 1,
        geometryData.scale?.[1] ?? 1,
        geometryData.scale?.[2] ?? 1
      ],
      color: geometryData.color || '#2563eb',
      parameters: params,
      vertexModifications: geometryData.vertexModifications || []
    });

    setCatalogOpen(false);
    console.log('✅ Loaded geometry from catalog:', item.code);
  };

  const handleDeleteFromCatalog = async (id: string) => {
    await catalogService.delete(id);
    await loadCatalogItems();
  };

  return (
    <div className="flex flex-col h-screen bg-stone-100">
      {opencascadeLoading && (
        <div className="fixed inset-0 bg-stone-900 bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 flex flex-col items-center gap-3">
            <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin"></div>
            <div className="text-sm font-medium text-slate-700">Loading OpenCascade...</div>
            <div className="text-xs text-slate-500">Please wait a moment</div>
          </div>
        </div>
      )}
      <Toolbar onOpenCatalog={() => setCatalogOpen(true)} />
      <div className="flex-1 overflow-hidden relative">
        <Scene />
      </div>
      <div className="relative">
        <Terminal />
        <StatusBar />
      </div>
      <CatalogPanel
        isOpen={catalogOpen}
        onClose={() => setCatalogOpen(false)}
        onLoad={handleLoadFromCatalog}
        onDelete={handleDeleteFromCatalog}
        items={catalogItems}
      />
    </div>
  );
}

export default App;
