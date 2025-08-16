import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { initOpenCascade } from '../opencascade.ts'; // Güncellenmiş başlatma fonksiyonunu import ediyoruz

export const useOcWorker = () => {
  const { setInitialized } = useAppStore();

  useEffect(() => {
    // Başlatma fonksiyonunu çağırıyoruz
    initOpenCascade().then((ocInstance: unknown) => {
      if (ocInstance) {
        console.log('OpenCascade.js initialized successfully.');
        // Gerekirse instance'ı global olarak erişilebilir yap
        (window as any).oc = ocInstance;
        setInitialized(true);
      } else {
        console.error('Failed to initialize OpenCascade.js');
        setInitialized(false);
      }
    });
  }, [setInitialized]);

  // Bu fonksiyonlar yer tutucudur, genişletilebilir
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
