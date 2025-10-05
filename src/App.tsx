import React from 'react';
import { useEffect } from 'react';
import Layout from './ui/Layout';
import Scene from './components/Scene';
import Toolbar from './ui/Toolbar';
import StatusBar from './ui/StatusBar';
import Terminal from './ui/Terminal';
import { GeometryFactory } from './core/geometryFactory';
import { useAppStore } from './core/appStore';

function App() {
  const { setYagoDesignInitialized, setGeometryMode } = useAppStore();

  useEffect(() => {
    // Initialize GeometryFactory on app start
    const initializeGeometry = async () => {
      try {
        await GeometryFactory.initialize();
        const isUsingYD = GeometryFactory.isUsingYagoDesign();
        const mode = GeometryFactory.getCurrentMode();
        
        setYagoDesignInitialized(isUsingYD);
        setGeometryMode(mode);
        
        console.log(`🎯 App initialized with geometry engine: ${mode}`);
      } catch (error) {
        console.error('Failed to initialize geometry factory:', error);
        setGeometryMode('Three.js');
      }
    };

    initializeGeometry();
  }, [setYagoDesignInitialized, setGeometryMode]);

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