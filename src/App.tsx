import React, { useEffect } from 'react';
import Layout from './components/Layout';
import Scene from './components/Scene';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import Terminal from './components/Terminal';
import { useAppStore } from './store/appStore';
import { useOcWorker } from './hooks/useOcWorker';
import { Shape } from './types/shapes';

function App() {
  useOcWorker(); 
  
  const { initialized, addShape } = useAppStore();

  useEffect(() => {
    if (initialized) {
      console.log("✅ OpenCascade.js hazır. Test şekil tanımları oluşturuluyor.");
      
      const boxShapeDefinition: Shape = {
        id: 'oc_box_1',
        type: 'box',
        position: [0, 250, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parameters: { width: 500, height: 500, depth: 500 },
      };
      addShape(boxShapeDefinition);
      console.log("🧊 Kutu tanımı sahneye eklendi.");

      const cylinderShapeDefinition: Shape = {
        id: 'oc_cylinder_1',
        type: 'cylinder',
        position: [750, 250, 0],
        rotation: [0, 0, 0],
        scale: [1, 1, 1],
        parameters: { radius: 250, height: 500 },
      };
      addShape(cylinderShapeDefinition);
      console.log("⚪ Silindir tanımı sahneye eklendi.");
    }
  }, [initialized, addShape]);

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
