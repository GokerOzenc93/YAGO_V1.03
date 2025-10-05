let yagoDesignInstance: any = null;
let isInitialized = false;
let initPromise: Promise<any> | null = null;

/**
 * Initialize YagoDesign.js instance
 */
export const initializeYagoDesign = async (): Promise<any> => {
  if (yagoDesignInstance) {
    return yagoDesignInstance;
  }

  if (initPromise) {
    return initPromise;
  }

  console.log('🎯 YagoDesign.js not available, using Three.js fallback...');
  
  initPromise = Promise.resolve(null).then(() => {
    yagoDesignInstance = null;
    isInitialized = false;
    console.log('⚠️ YagoDesign.js not available, using Three.js fallback');
    return null;
  });

  return initPromise;
};

/**
 * Get YagoDesign instance (must be initialized first)
 */
export const getYagoDesign = (): any => {
  if (!yagoDesignInstance) {
    console.warn('YagoDesign.js not available, using Three.js fallback');
    return null;
  }
  return yagoDesignInstance;
};

/**
 * Check if YagoDesign is initialized
 */
export const isYagoDesignInitialized = (): boolean => {
  return false; // Always return false since we're not using YagoDesign
};

/**
 * Dispose YagoDesign resources
 */
export const disposeYagoDesign = (): void => {
  if (yagoDesignInstance) {
    // Clean up any resources if needed
    yagoDesignInstance = null;
    isInitialized = false;
    initPromise = null;
    console.log('🎯 YagoDesign.js fallback disposed');
  }
};