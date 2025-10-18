import React, { useEffect, useState } from 'react';
import Scene from './Scene';
import Toolbar from './ui/Toolbar';
import Terminal from './ui/Terminal';
import CatalogPanel from './ui/CatalogPanel';
import { useAppStore } from './store';
import { catalogService, CatalogItem } from './lib/supabase';
import * as THREE from 'three';

function App() {
  const { setOpenCascadeInstance, setOpenCascadeLoading, opencascadeLoading, addShape } = useAppStore();
  const [catalogOpen, setCatalogOpen] = useState(false);
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  useEffect(() => {
    let mounted = true;

    const loadOpenCascade = async () => {
      if ((window as any).opencascadeLoaded) {
        return;
      }

      console.log('🔄 Starting OpenCascade load...');
      setOpenCascadeLoading(true);

      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/opencascade.js@1.1.1/dist/opencascade.wasm.js';
      script.async = true;

      script.onload = async () => {
        try {
          await new Promise(resolve => setTimeout(resolve, 200));

          const initOC = (window as any).opencascade;
          if (!initOC) {
            throw new Error('OpenCascade not found');
          }

          const oc = await initOC({
            locateFile: (path: string) =>
              `https://cdn.jsdelivr.net/npm/opencascade.js@1.1.1/dist/${path}`
          });

          if (mounted) {
            setOpenCascadeInstance(oc);
            setOpenCascadeLoading(false);
            (window as any).opencascadeLoaded = true;
            console.log('✅ OpenCascade.js ready');
          }
        } catch (error) {
          console.error('❌ Failed to initialize OpenCascade:', error);
          if (mounted) setOpenCascadeLoading(false);
        }
      };

      script.onerror = () => {
        console.error('❌ Failed to load OpenCascade script');
        if (mounted) setOpenCascadeLoading(false);
      };

      document.head.appendChild(script);
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

    let geometry: THREE.BufferGeometry;

    switch (geometryData.type) {
      case 'box':
        geometry = new THREE.BoxGeometry(
          params.width || 100,
          params.height || 100,
          params.depth || 100
        );
        break;
      case 'cylinder':
        geometry = new THREE.CylinderGeometry(
          params.radiusTop || 50,
          params.radiusBottom || 50,
          params.height || 100,
          32
        );
        break;
      case 'sphere':
        geometry = new THREE.SphereGeometry(params.radius || 50, 32, 32);
        break;
      case 'cone':
        geometry = new THREE.ConeGeometry(params.radius || 40, params.height || 100, 32);
        break;
      default:
        geometry = new THREE.BoxGeometry(100, 100, 100);
        break;
    }

    addShape({
      id: `${geometryData.type}-${Date.now()}`,
      type: geometryData.type || 'box',
      geometry,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: geometryData.color || '#2563eb',
      parameters: params
    });

    setCatalogOpen(false);
    console.log('Loaded geometry from catalog:', item.code);
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
      <div className="flex-1 overflow-hidden pb-12">
        <Scene />
      </div>
      <Terminal />
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
