import React, { useEffect } from 'react';
import Layout from './ui/Layout';
import Scene from './Scene';
import Toolbar from './ui/Toolbar';
import StatusBar from './ui/StatusBar';
import Terminal from './ui/Terminal';
import { useAppStore } from './store';
import initOpenCascade from 'opencascade.js/dist/opencascade.wasm.js';

function App() {
  const { setOpenCascadeInstance, setOpenCascadeLoading, opencascadeLoading } = useAppStore();

  useEffect(() => {
    let mounted = true;

    const loadOpenCascade = async () => {
      console.log('🔄 Starting OpenCascade load from local package...');
      setOpenCascadeLoading(true);

      try {
        const oc = await initOpenCascade({
          locateFile: (path: string) => {
            return `/${path}`;
          }
        });

        if (mounted) {
          setOpenCascadeInstance(oc);
          setOpenCascadeLoading(false);
          console.log('✅ OpenCascade.js ready');
        }
      } catch (error) {
        console.error('❌ Failed to initialize OpenCascade:', error);
        if (mounted) setOpenCascadeLoading(false);
      }
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
