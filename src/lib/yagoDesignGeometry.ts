import * as THREE from 'three';

/**
 * Convert YagoDesign shape to Three.js BufferGeometry
 */
export const yagoShapeToThreeGeometry = (shape: any): THREE.BufferGeometry => {
  console.warn('YagoDesign.js not available, using Three.js fallback geometry');
  
  // Fallback to simple box geometry
  const fallbackGeometry = new THREE.BoxGeometry(100, 100, 100);
  fallbackGeometry.computeBoundingBox();
  fallbackGeometry.computeBoundingSphere();
  
  return fallbackGeometry;
};

/**
 * Create YagoDesign box shape
 */
export const createYagoBox = (width: number, height: number, depth: number): any => {
  console.warn('YagoDesign.js not available, using Three.js fallback for box creation');
  return null;
};

/**
 * Create YagoDesign cylinder shape
 */
export const createYagoCylinder = (radius: number, height: number): any => {
  console.warn('YagoDesign.js not available, using Three.js fallback for cylinder creation');
  return null;
};

/**
 * Create YagoDesign polyline/polygon shape (extruded)
 */
export const createYagoPolyline = (points: THREE.Vector3[], height: number): any => {
  console.warn('YagoDesign.js not available, using Three.js fallback for polyline creation');
  return null;
};

/**
 * Perform YagoDesign boolean union
 */
export const performYagoUnion = (shape1: any, shape2: any): any => {
  console.warn('YagoDesign.js not available, using Three.js fallback for boolean union');
  return null;
};

/**
 * Perform YagoDesign boolean subtraction
 */
export const performYagoSubtraction = (shape1: any, shape2: any): any => {
  console.warn('YagoDesign.js not available, using Three.js fallback for boolean subtraction');
  return null;
};

/**
 * Dispose YagoDesign shape resources
 */
export const disposeYagoShape = (shape: any): void => {
  // No-op for Three.js fallback
  console.log('YagoDesign.js not available, no shape disposal needed');
};