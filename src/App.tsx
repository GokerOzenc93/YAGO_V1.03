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
      const initOpenCascade = (window as any).initOpenCascade || (window as any).opencascade;
      if (initOpenCascade) {
        console.log('🔄 OpenCascade already in window, initializing...');
        try {
          const oc = await initOpenCascade({
            locateFile: (path: string) => `https://unpkg.com/opencascade.js@2.0.0-beta.2/dist/${path}`
          });
          if (mounted) {
            setOpenCascadeInstance(oc);
            setOpenCascadeLoading(false);
            console.log('✅ OpenCascade.js ready (from cache)');
          }
        } catch (error) {
          console.error('❌ Failed to initialize cached OpenCascade:', error);
          if (mounted) setOpenCascadeLoading(false);
        }
        return;
      }

      const existingScript = document.querySelector('script[src*="opencascade"]');
      if (existingScript) {
        console.log('🔄 OpenCascade script already loading...');
        return;
      }

      console.log('🔄 Starting OpenCascade load from CDN...');
      setOpenCascadeLoading(true);

      const cdnUrls = [
        'https://unpkg.com/opencascade.js@2.0.0-beta.2/dist/opencascade.wasm.js',
        'https://cdn.jsdelivr.net/npm/opencascade.js@2.0.0-beta.2/dist/opencascade.wasm.js'
      ];

      let currentCdnIndex = 0;

      const tryLoadScript = () => {
        if (currentCdnIndex >= cdnUrls.length) {
          console.warn('⚠️ OpenCascade failed to load from all CDNs. Boolean operations disabled.');
          if (mounted) setOpenCascadeLoading(false);
          return;
        }

        const script = document.createElement('script');
        script.src = cdnUrls[currentCdnIndex];
        script.async = false;
        script.crossOrigin = 'anonymous';

        const timeout = setTimeout(() => {
          console.warn(`⏱️ Timeout loading from ${cdnUrls[currentCdnIndex]}, trying next CDN...`);
          script.remove();
          currentCdnIndex++;
          tryLoadScript();
        }, 15000);

        script.onload = async () => {
          clearTimeout(timeout);
          try {
            console.log('📦 OpenCascade script loaded, initializing...');

            await new Promise(resolve => setTimeout(resolve, 100));

            const initOpenCascade = (window as any).initOpenCascade || (window as any).opencascade;
            if (initOpenCascade) {
              console.log('🔧 Found OpenCascade initializer, starting init...');
              const baseUrl = cdnUrls[currentCdnIndex].replace('/opencascade.wasm.js', '/');
              const oc = await initOpenCascade({
                locateFile: (path: string) => `${baseUrl}${path}`
              });
              if (mounted) {
                setOpenCascadeInstance(oc);
                setOpenCascadeLoading(false);
                console.log('✅ OpenCascade.js ready');
              }
            } else {
              throw new Error('opencascade initializer not found on window');
            }
          } catch (error) {
            console.error('❌ Failed to initialize OpenCascade:', error);
            currentCdnIndex++;
            tryLoadScript();
          }
        };

        script.onerror = () => {
          clearTimeout(timeout);
          console.error(`❌ Failed to load OpenCascade from ${cdnUrls[currentCdnIndex]}`);
          currentCdnIndex++;
          tryLoadScript();
        };

        document.head.appendChild(script);
      };

      tryLoadScript();
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
