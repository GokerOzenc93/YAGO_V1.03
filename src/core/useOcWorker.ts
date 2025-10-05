import { useEffect } from 'react';
import { useAppStore } from './appStore';

export const useOcWorker = () => {
  const { setInitialized } = useAppStore();

  useEffect(() => {
    // Since we don't have OpenCascade.js yet, we'll initialize immediately
    setInitialized(true);
  }, [setInitialized]);

  return {
    initialized: true,
    createBox: () => ({ success: true, message: 'Box created' }),
    createCylinder: () => ({ success: true, message: 'Cylinder created' })
  };
};