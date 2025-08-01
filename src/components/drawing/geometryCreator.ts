import * as THREE from 'three';

export const createPolylineGeometry = (
  points: THREE.Vector3[],
  height: number,
  gridSize: number = 50
): THREE.BufferGeometry => {
  try {
    // Create a 2D shape from the points
    const shape = new THREE.Shape();
    
    if (points.length < 3) {
      // Fallback for insufficient points
      const geometry = new THREE.BoxGeometry(100, height, 100);
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      return geometry;
    }

    // Move to the first point
    shape.moveTo(points[0].x, points[0].z);
    
    // Add lines to subsequent points
    for (let i = 1; i < points.length; i++) {
      shape.lineTo(points[i].x, points[i].z);
    }
    
    // Close the shape if it's not already closed
    if (points.length > 2) {
      shape.lineTo(points[0].x, points[0].z);
    }

    // Create extrude settings
    const extrudeSettings = {
      depth: height,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 8
    };

    // Create the extruded geometry
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Rotate geometry to keep it horizontal (lying flat on XZ plane)
    // ExtrudeGeometry creates vertical extrusion, we need horizontal
    geometry.rotateX(-Math.PI / 2);
    
    // Compute bounding volumes (critical for Three.js rendering)
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    return geometry;
    
  } catch (error) {
    console.warn('Failed to create polyline geometry, using fallback:', error);
    
    // Fallback geometry
    const fallbackGeometry = new THREE.BoxGeometry(100, height, 100);
    fallbackGeometry.computeBoundingBox();
    fallbackGeometry.computeBoundingSphere();
    
    return fallbackGeometry;
  }
};