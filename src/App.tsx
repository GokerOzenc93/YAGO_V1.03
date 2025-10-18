import React, { useEffect } from 'react';
import Layout from './ui/Layout';
import Scene from './Scene';
import Toolbar from './ui/Toolbar';
import StatusBar from './ui/StatusBar';
import Terminal from './ui/Terminal';
import { useAppStore } from './store';

function App() {
  const { setOpenCascadeInstance } = useAppStore();

  useEffect(() => {
    const loadOpenCascade = async () => {
      try {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/opencascade.js@2.0.0-beta.b5ff984/dist/opencascade.full.js';
        script.async = true;

        script.onload = async () => {
          try {
            const initOpenCascade = (window as any).opencascade;
            if (initOpenCascade) {
              const oc = await initOpenCascade();
              setOpenCascadeInstance(oc);
              console.log('✅ OpenCascade.js loaded from CDN');
            }
          } catch (error) {
            console.warn('⚠️ Failed to initialize OpenCascade:', error);
          }
        };

        script.onerror = () => {
          console.warn('⚠️ Failed to load OpenCascade from CDN');
        };

        document.head.appendChild(script);

        return () => {
          if (script.parentNode) {
            script.parentNode.removeChild(script);
          }
        };
      } catch (error) {
        console.warn('⚠️ OpenCascade not available:', error);
      }
    };

    loadOpenCascade();
  }, [setOpenCascadeInstance]);

  return (
    <div className="flex flex-col h-screen bg-stone-100">
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
