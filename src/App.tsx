import React from 'react';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Scene from './components/Scene';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import Terminal from './components/Terminal';
import { useAppStore } from './store/appStore';

function App() {
  const { setOpenCascadeInstance } = useAppStore();

  useEffect(() => {
    const loadOpenCascade = async () => {
      try {
        const { useOpenCascade } = await import('./hooks/useOpenCascade');
        console.log('✅ OpenCascade module loaded');
      } catch (error) {
        console.warn('⚠️ OpenCascade not available:', error);
      }
    };

    loadOpenCascade();
  }, [setOpenCascadeInstance]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200">
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