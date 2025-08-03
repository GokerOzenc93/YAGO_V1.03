import * as THREE from 'three';

export const createPolylineGeometry = (
  points: THREE.Vector3[],
  height: number,
  gridSize: number = 50,
  keepOriginalPosition: boolean = true
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

    // If keeping original position, use points as-is
    // Otherwise, center the shape at origin
    let shapePoints = points;
    
    if (!keepOriginalPosition) {
      // Calculate center for centering at origin
      const center = new THREE.Vector3();
      points.forEach(point => center.add(point));
      center.divideScalar(points.length);
      
      // Translate points to center at origin
      shapePoints = points.map(point => point.clone().sub(center));
    }

    // Move to the first point (either original or centered)
    shape.moveTo(shapePoints[0].x, shapePoints[0].z);
    
    // Add lines to subsequent points
    for (let i = 1; i < shapePoints.length; i++) {
      shape.lineTo(shapePoints[i].x, shapePoints[i].z);
    }
    
    // Close the shape if it's not already closed
    if (shapePoints.length > 2) {
      shape.lineTo(shapePoints[0].x, shapePoints[0].z);
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
    
    // Keep the geometry as extruded - no rotation needed
    // The extrusion naturally goes in the Z direction
    // We want it to go up in the Y direction, so rotate appropriately
    geometry.rotateX(-Math.PI / 2); // This makes it lie flat on XZ plane
    
    // Move the geometry so its bottom is at Y=0
    geometry.translate(0, 0, height / 2);
    
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