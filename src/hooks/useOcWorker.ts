import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
// Gerekli importları doğrudan bu dosyaya ekliyoruz
import opencascade from "opencascade.js/dist/opencascade.full.js";
import opencascadeWasm from "opencascade.js/dist/opencascade.full.wasm?url";

// Başlatma mantığını bu dosyanın içine taşıyoruz
let ocPromise: Promise<any> | null = null;
const initOpenCascade = () => {
  if (!ocPromise) {
    // @ts-ignore
    ocPromise = opencascade({
      locateFile: () => opencascadeWasm,
    });
  }
  return ocPromise;
};

export const useOcWorker = () => {
  const { setInitialized } = useAppStore();

  useEffect(() => {
    // Başlatma fonksiyonunu çağırıyoruz
    initOpenCascade().then((ocInstance: unknown) => {
      if (ocInstance) {
        console.log('OpenCascade.js initialized successfully.');
        (window as any).oc = ocInstance;
        setInitialized(true);
      } else {
        console.error('Failed to initialize OpenCascade.js');
        setInitialized(false);
      }
    });
  }, [setInitialized]);

  // Bu fonksiyonlar yer tutucudur
  const createBox = (width: number, height: number, depth: number) => {
    console.log(`Creating Box with size: ${width}, ${height}, ${depth}`);
    return { success: true, message: 'Box created' };
  };

  const createCylinder = (radius: number, height: number) => {
    console.log(`Creating Cylinder with radius: ${radius}, height: ${height}`);
    return { success: true, message: 'Cylinder created' };
  };

  return {
    initialized: useAppStore((state) => state.initialized),
    createBox,
    createCylinder,
  };
};
