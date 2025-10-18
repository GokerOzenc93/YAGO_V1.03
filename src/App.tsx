import React, { useEffect } from 'react';
import Layout from './ui/Layout';
import Scene from './Scene';
import Toolbar from './ui/Toolbar';
import StatusBar from './ui/StatusBar';
import Terminal from './ui/Terminal';
import { useAppStore } from './store';

function App() {
  const { setOpenCascadeInstance, setOpenCascadeLoading, opencascadeLoading } = useAppStore();

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
      <Layout
        toolbar={<Toolbar />}
        content={<Scene />}
        statusBar={<StatusBar />}
      />
      <Terminal />
    </div>
  );
}

export default App;
