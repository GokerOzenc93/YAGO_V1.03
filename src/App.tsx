import React, { useEffect } from 'react';
import Layout from './components/Layout';
import Scene from './components/Scene';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import Terminal from './components/Terminal';
import { useAppStore } from './store/appStore';
import { useOcWorker } from './hooks/useOcWorker';
// opencascade.ts import'u kaldırıldı.
import { 
  createBox as createOcBox, 
  createCylinder as createOcCylinder, 
  ocShapeToThreeGeometry 
} from './lib/opencascadeUtils';
import { Shape } from './types/shapes';

function App() {
  useOcWorker(); 
  
  const { initialized, addShape } = useAppStore();

  useEffect(() => {
    if (initialized) {
      console.log("✅ OpenCascade.js hazır. Test şekilleri oluşturuluyor.");
      
      const createTestShapes = async () => {
        try {
          // 'oc' instance'ına global window nesnesinden erişiyoruz
          const ocInstance = (window as any).oc;
          if (!ocInstance) {
            console.error("OpenCascade instance bulunamadı.");
            return;
          }

          // 1. OpenCascade ile bir kutu oluştur
          const ocBox = createOcBox(ocInstance, 500, 500, 500);
          const boxGeom = ocShapeToThreeGeometry(ocInstance, ocBox);
          // HATA DÜZELTİLDİ: ocBox.delete() satırı kaldırıldı.
          // Bu nesnenin belleği, onu oluşturan yardımcı fonksiyon içinde yönetiliyor.

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
          const cylinderGeom = ocShapeToThreeGeometry(ocInstance, ocCylinder);
          // HATA DÜZELTİLDİ: ocCylinder.delete() satırı kaldırıldı.

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
          console.error("❌ Test şekilleri oluşturulurken bir hata oluştu:", error);
        }
      };

      createTestShapes();
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
