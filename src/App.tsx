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
    const loadOpenCascade = async () => {
      console.log('🔄 Starting OpenCascade load...');
      setOpenCascadeLoading(true);

      try {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/opencascade.js@2.0.0-beta.b5ff984/dist/opencascade.full.js';
        script.async = false;

        script.onload = async () => {
          try {
            console.log('📦 OpenCascade script loaded, initializing...');
            const initOpenCascade = (window as any).opencascade;
            if (initOpenCascade) {
              const oc = await initOpenCascade();
              setOpenCascadeInstance(oc);
              setOpenCascadeLoading(false);
              console.log('✅ OpenCascade.js ready');
            } else {
              throw new Error('opencascade not found on window');
            }
          } catch (error) {
            console.error('❌ Failed to initialize OpenCascade:', error);
            setOpenCascadeLoading(false);
          }
        };

        script.onerror = () => {
          console.error('❌ Failed to load OpenCascade from CDN');
          setOpenCascadeLoading(false);
        };

        document.head.appendChild(script);

        return () => {
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
        };
      } catch (error) {
        console.error('❌ OpenCascade load error:', error);
        setOpenCascadeLoading(false);
      }
    };

    loadOpenCascade();
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
