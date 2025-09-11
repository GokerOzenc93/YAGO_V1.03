import initOpenCascade from 'opencascade.js';

let ocInstance: any = null;
let isInitialized = false;
let initPromise: Promise<any> | null = null;

/**
 * Initialize OpenCascade.js instance
 */
export const initializeOpenCascade = async (): Promise<any> => {
  if (ocInstance) {
    return ocInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  console.log('🎯 Initializing OpenCascade.js...');
  
  initPromise = initOpenCascade({
    locateFile: (path: string) => {
      if (path.endsWith('.wasm')) {
        return '/opencascade.wasm.wasm?init';
      }
      return path;
    }
  }).then((oc) => {
    ocInstance = oc;
    isInitialized = true;
    console.log('✅ OpenCascade.js initialized successfully');
    return oc;
  }).catch((error) => {
    console.error('❌ OpenCascade.js initialization failed:', error);
    ocInstance = null;
    isInitialized = false;
    throw error;
  });

  return initPromise;
};

/**
 * Get OpenCascade instance (must be initialized first)
 */
export const getOpenCascade = (): any => {
  if (!ocInstance) {
    throw new Error('OpenCascade.js not initialized. Call initializeOpenCascade() first.');
  }
  return ocInstance;
};

/**
 * Check if OpenCascade is initialized
 */
export const isOpenCascadeInitialized = (): boolean => {
  return isInitialized && ocInstance !== null;
};

/**
 * Dispose OpenCascade resources
 */
export const disposeOpenCascade = (): void => {
  if (ocInstance) {
    // Clean up any resources if needed
    ocInstance = null;
    isInitialized = false;
    initPromise = null;
    console.log('🎯 OpenCascade.js disposed');
  }
};