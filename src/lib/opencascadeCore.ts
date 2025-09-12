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

  console.log('🎯 OpenCascade.js not available, using Three.js fallback...');
  
  initPromise = Promise.resolve(null).then(() => {
    ocInstance = null;
    isInitialized = false;
    console.log('⚠️ OpenCascade.js not available, using Three.js fallback');
    return null;
  });

  return initPromise;
};

/**
 * Get OpenCascade instance (must be initialized first)
 */
export const getOpenCascade = (): any => {
  if (!ocInstance) {
    console.warn('OpenCascade.js not available, using Three.js fallback');
    return null;
  }
  return ocInstance;
};

/**
 * Check if OpenCascade is initialized
 */
export const isOpenCascadeInitialized = (): boolean => {
  return false; // Always return false since we're not using OpenCascade
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
    console.log('🎯 OpenCascade.js fallback disposed');
  }
};