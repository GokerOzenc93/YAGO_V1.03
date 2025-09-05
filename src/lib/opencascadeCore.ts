import initOpenCascade, { OpenCascadeInstance } from 'opencascade.js';

let ocInstance: OpenCascadeInstance | null = null;
let isInitialized = false;
let initPromise: Promise<OpenCascadeInstance> | null = null;

/**
 * Initialize OpenCascade.js instance
 */
export const initializeOpenCascade = async (): Promise<OpenCascadeInstance> => {
  if (ocInstance) {
    return ocInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  console.log('🎯 Initializing OpenCascade.js...');
  
  initPromise = initOpenCascade({
    locateFile: (path: string) => {
      // Use CDN for OpenCascade.js files
      return `https://cdn.jsdelivr.net/npm/opencascade.js@2.0.0-beta.2a/${path}`;
    }
  }).then((oc) => {
    ocInstance = oc;
    isInitialized = true;
    console.log('✅ OpenCascade.js initialized successfully');
    return oc;
  }).catch((error) => {
    console.error('❌ Failed to initialize OpenCascade.js:', error);
    initPromise = null;
    throw error;
  });

  return initPromise;
};

/**
 * Get OpenCascade instance (must be initialized first)
 */
export const getOpenCascade = (): OpenCascadeInstance => {
  if (!ocInstance) {
    throw new Error('OpenCascade.js not initialized. Call initializeOpenCascade() first.');
  }
  return ocInstance;
};

/**
 * Check if OpenCascade is initialized
 */
export const isOpenCascadeInitialized = (): boolean => {
  return isInitialized;
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