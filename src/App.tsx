import React, { useEffect } from 'react';
import Layout from './components/Layout';
import Scene from './components/Scene';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import Terminal from './components/Terminal';
import { useAppStore } from './store/appStore';
import { oc } from './opencascade'; // OCC başlatma modülünü import ediyoruz
import { 
  createBox as createOcBox, 
  createCylinder as createOcCylinder, 
  ocShapeToThreeGeometry 
} from './lib/opencascadeUtils'; // Gerçek OCC fonksiyonlarını import ediyoruz
import { Shape } from './types/shapes';

function App() {
  const { addShape, setShapes, setInitialized } = useAppStore();

  useEffect(() => {
    const initializeScene = async () => {
      try {
        // Boş şekillerle başla
        setShapes([]);
        
        // OpenCascade.js'in yüklenmesini bekle
        const ocInstance = await oc;
        console.log("✅ OpenCascade.js yüklendi, test şekilleri oluşturuluyor...");
        setInitialized(true);

        // 1. OpenCascade ile bir kutu oluştur
        const ocBox = createOcBox(ocInstance, 500, 500, 500);
        // Oluşturulan kutuyu Three.js geometrisine çevir
        const boxGeom = ocShapeToThreeGeometry(ocInstance, ocBox);
        ocBox.delete(); // Bellekten temizle

        if (boxGeom) {
          const boxShape: Shape = {
            id: 'oc_box_1',
            type: 'box',
            position: [0, 250, 0],
            rotation: [0, 0, 0],
            scale: [1, 1, 1],
            geometry: boxGeom,
            parameters: { width: 500, height: 500, depth: 500 },
          };
          addShape(boxShape);
          console.log("🧊 OpenCascade kutusu sahneye eklendi.");
        }

        // 2. OpenCascade ile bir silindir oluştur
        const ocCylinder = createOcCylinder(ocInstance, 250, 500);
        // Oluşturulan silindiri Three.js geometrisine çevir
        const cylinderGeom = ocShapeToThreeGeometry(ocInstance, ocCylinder);
        ocCylinder.delete(); // Bellekten temizle

        if (cylinderGeom) {
           const cylinderShape: Shape = {
              id: 'oc_cylinder_1',
              type: 'cylinder',
              position: [750, 250, 0],
              rotation: [0, 0, 0],
              scale: [1, 1, 1],
              geometry: cylinderGeom,
              parameters: { radius: 250, height: 500 },
            };
            addShape(cylinderShape);
            console.log("⚪ OpenCascade silindiri sahneye eklendi.");
        }

      } catch (error) {
        console.error("❌ OpenCascade başlatılırken veya test şekilleri oluşturulurken hata:", error);
        setInitialized(false);
      }
    };

    initializeScene();

  }, [addShape, setShapes, setInitialized]);

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
