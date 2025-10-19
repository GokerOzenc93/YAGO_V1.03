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

declare global {
  interface Window {
    opencascade: any;
    ocInstance: any;
  }
}

function App() {
  const { setOpenCascadeInstance, setOpenCascadeLoading, opencascadeLoading, addShape } = useAppStore();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadOpenCascade = async () => {
      if (window.ocInstance) {
        console.log('ℹ️ OpenCascade already loaded');
        setOpenCascadeInstance(window.ocInstance);
        setOpenCascadeLoading(false);
        return;
      }

      console.log('🔄 Loading OpenCascade from CDN...');
      setOpenCascadeLoading(true);

      try {
        const scriptExists = document.querySelector('script[src*="opencascade.wasm.js"]');

        if (!scriptExists) {
          await new Promise((resolve, reject) => {
            const script = document.createElement('script');
            script.src = 'https://cdn.jsdelivr.net/npm/opencascade.js@1.1.1/dist/opencascade.wasm.js';
            script.async = true;
            script.crossOrigin = 'anonymous';

            script.onload = () => {
              console.log('✅ Script loaded');
              resolve(true);
            };

            script.onerror = (err) => {
              console.error('❌ Script load failed:', err);
              reject(new Error('Failed to load OpenCascade script'));
            };

            document.head.appendChild(script);
          });
        }

        await new Promise(resolve => setTimeout(resolve, 500));

        if (!window.opencascade) {
          throw new Error('opencascade not found on window');
        }

        console.log('🔄 Initializing OpenCascade instance...');

        const oc = await window.opencascade({
          locateFile: (path: string) => {
            const url = `https://cdn.jsdelivr.net/npm/opencascade.js@1.1.1/dist/${path}`;
            console.log(`📦 Loading: ${path}`);
            return url;
          }
        });

        if (!mounted) return;

        if (!oc) {
          throw new Error('OpenCascade initialization returned null');
        }

        console.log('🔍 Verifying OpenCascade API...');

        const apiCheck = {
          BRepPrimAPI_MakeBox: !!oc.BRepPrimAPI_MakeBox,
          BRepPrimAPI_MakeBox_1: !!oc.BRepPrimAPI_MakeBox_1,
          BRepPrimAPI_MakeBox_2: !!oc.BRepPrimAPI_MakeBox_2,
          BRepAlgoAPI_Cut: !!oc.BRepAlgoAPI_Cut,
          BRepAlgoAPI_Cut_1: !!oc.BRepAlgoAPI_Cut_1,
          BRepAlgoAPI_Cut_2: !!oc.BRepAlgoAPI_Cut_2,
          BRepAlgoAPI_Fuse: !!oc.BRepAlgoAPI_Fuse,
          BRepAlgoAPI_Fuse_1: !!oc.BRepAlgoAPI_Fuse_1,
          BRepAlgoAPI_Fuse_2: !!oc.BRepAlgoAPI_Fuse_2,
        };

        console.log('📊 API Status:', apiCheck);

        const hasMakeBox = apiCheck.BRepPrimAPI_MakeBox || apiCheck.BRepPrimAPI_MakeBox_1 || apiCheck.BRepPrimAPI_MakeBox_2;
        const hasCut = apiCheck.BRepAlgoAPI_Cut || apiCheck.BRepAlgoAPI_Cut_1 || apiCheck.BRepAlgoAPI_Cut_2;
        const hasFuse = apiCheck.BRepAlgoAPI_Fuse || apiCheck.BRepAlgoAPI_Fuse_1 || apiCheck.BRepAlgoAPI_Fuse_2;

        if (!hasMakeBox) {
          throw new Error('Critical API missing: No BRepPrimAPI_MakeBox variant found');
        }

        setOpenCascadeInstance(oc);
        setOpenCascadeLoading(false);
        window.ocInstance = oc;

        console.log('✅ OpenCascade loaded successfully!');
        console.log('✅ Primitive shapes: AVAILABLE');
        console.log('✅ Boolean Cut:', hasCut ? 'AVAILABLE' : 'NOT AVAILABLE');
        console.log('✅ Boolean Fuse:', hasFuse ? 'AVAILABLE' : 'NOT AVAILABLE');

      } catch (error) {
        console.error('❌ OpenCascade initialization failed:', error);
        if (mounted) {
          setOpenCascadeLoading(false);
          console.error('Please refresh the page to retry');
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
            <div className="text-xs text-slate-500">Initializing WebAssembly module</div>
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
