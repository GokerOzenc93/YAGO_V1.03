import * as THREE from 'three';

/**
 * Convert OpenCascade shape to Three.js BufferGeometry
 */
export const ocShapeToThreeGeometry = (shape: any): THREE.BufferGeometry => {
  console.warn('OpenCascade.js not available, using Three.js fallback geometry');
  
  // Fallback to simple box geometry
  const fallbackGeometry = new THREE.BoxGeometry(100, 100, 100);
  fallbackGeometry.computeBoundingBox();
  fallbackGeometry.computeBoundingSphere();
  
  return fallbackGeometry;
};

/**
 * Create OpenCascade box shape
 */
export const createOCBox = (width: number, height: number, depth: number): any => {
  console.warn('OpenCascade.js not available, using Three.js fallback for box creation');
  return null;
};

/**
 * Create OpenCascade cylinder shape
 */
export const createOCCylinder = (radius: number, height: number): any => {
  console.warn('OpenCascade.js not available, using Three.js fallback for cylinder creation');
  return null;
};

/**
 * Create OpenCascade polyline/polygon shape (extruded)
 */
export const createOCPolyline = (points: THREE.Vector3[], height: number): any => {
  console.warn('OpenCascade.js not available, using Three.js fallback for polyline creation');
  return null;
};

/**
 * Perform OpenCascade boolean union
 */
export const performOCUnion = (shape1: any, shape2: any): any => {
  console.warn('OpenCascade.js not available, using Three.js fallback for boolean union');
  return null;
};

/**
 * Perform OpenCascade boolean subtraction
 */
export const performOCSubtraction = (shape1: any, shape2: any): any => {
  console.warn('OpenCascade.js not available, using Three.js fallback for boolean subtraction');
  return null;
};

/**
 * Dispose OpenCascade shape resources
 */
export const disposeOCShape = (shape: any): void => {
  // No-op for Three.js fallback
  console.log('OpenCascade.js not available, no shape disposal needed');
};