import { useEffect } from 'react';
import { useAppStore } from '../store/appStore';
import { oc } from '../opencascade';

export const useOcWorker = () => {
  const { setInitialized } = useAppStore();

  useEffect(() => {
    oc.then((ocInstance: unknown) => {
      if (ocInstance) {
        console.log('OpenCascade.js initialized successfully.');
        // Make the instance globally available if needed, e.g., for debugging
        (window as any).oc = ocInstance;
        setInitialized(true);
      } else {
        console.error('Failed to initialize OpenCascade.js');
        setInitialized(false);
      }
    });
  }, [setInitialized]);

  // Placeholder functions, these can be expanded or moved
  const createBox = (width: number, height: number, depth: number) => {
    console.log(`Creating Box with size: ${width}, ${height}, ${depth}`);
    // Actual implementation will be in opencascadeUtils.ts
    return { success: true, message: 'Box created' };
  };

  const createCylinder = (radius: number, height: number) => {
    console.log(`Creating Cylinder with radius: ${radius}, height: ${height}`);
     // Actual implementation will be in opencascadeUtils.ts
    return { success: true, message: 'Cylinder created' };
  };

  return {
    initialized: useAppStore((state) => state.initialized),
    createBox,
    createCylinder,
  };
};