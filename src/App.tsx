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
        const initOpenCascade = (await import('opencascade.js')).default;
        const oc = await initOpenCascade();
        setOpenCascadeInstance(oc);
        console.log('✅ OpenCascade.js loaded');
      } catch (error) {
        console.warn('⚠️ OpenCascade not available:', error);
      }
    };

    loadOpenCascade();
  }, [setOpenCascadeInstance]);

  return (
    <div className="flex flex-col h-screen bg-gray-900">
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
