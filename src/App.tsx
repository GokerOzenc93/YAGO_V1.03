import React, { useEffect, useState } from 'react';
import Scene from './Scene';
import Toolbar from './ui/Toolbar';
import Terminal from './ui/Terminal';
import StatusBar from './ui/StatusBar';
import CatalogPanel from './ui/CatalogPanel';
import { useAppStore } from './store';
import { catalogService, CatalogItem } from './lib/supabase';
import { createGeometryFromType } from './utils/geometry';
import * as THREE from 'three';

function App() {
  const { setOpenCascadeInstance, setOpenCascadeLoading, opencascadeLoading, addShape } = useAppStore();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    let mounted = true;
    let scriptElement: HTMLScriptElement | null = null;

    const loadOpenCascade = async () => {
      if ((window as any).opencascadeLoaded) {
        console.log('ℹ️ OpenCascade already loaded');
        setOpenCascadeInstance((window as any).opencascadeInstance);
        setOpenCascadeLoading(false);
        return;
      }

      console.log('🔄 Starting OpenCascade load from CDN...');
      setOpenCascadeLoading(true);

      const existingScript = document.querySelector('script[src*="opencascade.wasm.js"]');
      if (existingScript) {
        console.log('ℹ️ Script already added, waiting...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        if ((window as any).opencascade) {
          await initializeOC();
        }
        return;
      }

      scriptElement = document.createElement('script');
      scriptElement.src = 'https://cdn.jsdelivr.net/npm/opencascade.js@1.1.1/dist/opencascade.wasm.js';
      scriptElement.async = true;
      scriptElement.crossOrigin = 'anonymous';

      scriptElement.onload = async () => {
        console.log('✅ Script loaded');
        await initializeOC();
      };

      scriptElement.onerror = (error) => {
        console.error('❌ Failed to load OpenCascade script:', error);
        if (mounted) {
          setOpenCascadeLoading(false);
        }
      };

      document.head.appendChild(scriptElement);
    };

    const initializeOC = async () => {
      try {
        await new Promise(resolve => setTimeout(resolve, 300));

        const initOC = (window as any).opencascade;
        if (!initOC) {
          throw new Error('opencascade initializer not found on window object');
        }

        console.log('🔄 Initializing OpenCascade...');
        const oc = await initOC({
          locateFile: (path: string) => {
            const url = `https://cdn.jsdelivr.net/npm/opencascade.js@1.1.1/dist/${path}`;
            console.log(`📂 Loading: ${url}`);
            return url;
          }
        });

        if (!mounted) return;

        if (!oc) {
          throw new Error('OpenCascade initialization returned null');
        }

        console.log('🔍 Verifying OpenCascade API...');
        const apis = {
          'BRepPrimAPI_MakeBox_2': !!oc.BRepPrimAPI_MakeBox_2,
          'BRepAlgoAPI_Cut_2': !!oc.BRepAlgoAPI_Cut_2,
          'BRepAlgoAPI_Cut_3': !!oc.BRepAlgoAPI_Cut_3,
          'BRepAlgoAPI_Fuse_2': !!oc.BRepAlgoAPI_Fuse_2,
          'BRepAlgoAPI_Fuse_3': !!oc.BRepAlgoAPI_Fuse_3,
          'Message_ProgressRange_1': !!oc.Message_ProgressRange_1
        };

        console.log('📊 API Status:', apis);

        if (!oc.BRepPrimAPI_MakeBox_2) {
          throw new Error('Critical API missing: BRepPrimAPI_MakeBox_2');
        }

        if (!oc.BRepAlgoAPI_Cut_2 && !oc.BRepAlgoAPI_Cut_3) {
          console.warn('⚠️ Boolean Cut operations may not be available');
        }

        setOpenCascadeInstance(oc);
        setOpenCascadeLoading(false);
        (window as any).opencascadeLoaded = true;
        (window as any).opencascadeInstance = oc;

        console.log('✅ OpenCascade.js loaded successfully!');
        console.log('✅ Boolean operations:', oc.BRepAlgoAPI_Cut_2 || oc.BRepAlgoAPI_Cut_3 ? 'AVAILABLE' : 'LIMITED');
        console.log('✅ Primitive shapes: AVAILABLE');
      } catch (error) {
        console.error('❌ Failed to initialize OpenCascade:', error);
        if (mounted) {
          setOpenCascadeLoading(false);
        }
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
