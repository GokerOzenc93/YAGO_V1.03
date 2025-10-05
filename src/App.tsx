import React, { useState } from 'react';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Scene from './components/Scene';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import Terminal from './components/Terminal';
import { GeometryFactory } from './lib/geometryFactory';
import { useAppStore } from './store/appStore';
import EdgeDimensionEditor from './components/drawing/EdgeDimensionEditor';
import { EdgeInfo } from './components/drawing/types';

function App() {
  const { setYagoDesignInitialized, setGeometryMode, convertToDisplayUnit, convertToBaseUnit, measurementUnit } = useAppStore();
  const [selectedEdge, setSelectedEdge] = useState<EdgeInfo | null>(null);
  const [showEdgeEditor, setShowEdgeEditor] = useState(false);

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

  useEffect(() => {
    (window as any).setSelectedEdge = (edge: EdgeInfo | null) => {
      setSelectedEdge(edge);
      setShowEdgeEditor(!!edge);
    };
    return () => {
      delete (window as any).setSelectedEdge;
    };
  }, []);

  const handleApplyEdgeLength = (newLength: number) => {
    if ((window as any).applyEdgeLength) {
      (window as any).applyEdgeLength(newLength);
    }
    setSelectedEdge(null);
    setShowEdgeEditor(false);
  };

  const handleCancelEdgeEdit = () => {
    setSelectedEdge(null);
    setShowEdgeEditor(false);
  };

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200">
      <Layout
        toolbar={<Toolbar />}
        content={<Scene />}
        statusBar={<StatusBar />}
      />
      <Terminal />

      {showEdgeEditor && selectedEdge && (
        <div className="fixed left-[360px] bottom-24 z-50 w-80 bg-white rounded-lg shadow-2xl p-3 border border-gray-200">
          <div className="mb-2 text-xs font-medium text-slate-700">Edit Edge Length</div>
          <EdgeDimensionEditor
            edge={selectedEdge}
            currentLength={selectedEdge.length}
            unit={measurementUnit}
            onApply={handleApplyEdgeLength}
            onCancel={handleCancelEdgeEdit}
            convertToDisplayUnit={convertToDisplayUnit}
            convertToBaseUnit={convertToBaseUnit}
          />
        </div>
      )}
    </div>
  );
}

export default App;