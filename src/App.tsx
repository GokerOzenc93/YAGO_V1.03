import React from 'react';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Scene from './components/Scene';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import Terminal from './components/Terminal';
import { GeometryFactory } from './lib/geometryFactory';
import { useAppStore } from './store/appStore';

function App() {
  const { setOpenCascadeInitialized, setGeometryMode } = useAppStore();

  useEffect(() => {
    // Initialize GeometryFactory on app start
    const initializeGeometry = async () => {
      try {
        await GeometryFactory.initialize();
        const isUsingOC = GeometryFactory.isUsingOpenCascade();
        const mode = GeometryFactory.getCurrentMode();
        
        setOpenCascadeInitialized(isUsingOC);
        setGeometryMode(mode);
        
        console.log(`🎯 App initialized with geometry engine: ${mode}`);
      } catch (error) {
        console.error('Failed to initialize geometry factory:', error);
        setGeometryMode('Three.js');
      }
    };

    initializeGeometry();
  }, [setOpenCascadeInitialized, setGeometryMode]);

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