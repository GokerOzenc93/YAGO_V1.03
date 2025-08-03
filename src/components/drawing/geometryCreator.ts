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

    // Calculate the center of the polyline for positioning
    const center = new THREE.Vector3();
    const uniquePoints = points.length > 2 && points[points.length - 1].equals(points[0]) 
      ? points.slice(0, -1) // Remove duplicate closing point
      : points;
    
    uniquePoints.forEach(point => center.add(point));
    center.divideScalar(uniquePoints.length);

    // Create shape using original points directly (no translation to center)
    // This preserves the original drawing orientation
    
    // Move to the first point using X and Z coordinates (Y is ignored for 2D shape)
    shape.moveTo(uniquePoints[0].x, uniquePoints[0].z);
    
    // Add lines to subsequent points using X and Z coordinates
    for (let i = 1; i < uniquePoints.length; i++) {
      shape.lineTo(uniquePoints[i].x, uniquePoints[i].z);
    }
    
    // Close the shape by returning to first point
    shape.lineTo(uniquePoints[0].x, uniquePoints[0].z);

    // Create extrude settings
    const extrudeSettings = {
      depth: height,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 8
    };

    // Create the extruded geometry
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // DON'T rotate the geometry - keep it in original orientation
    // The ExtrudeGeometry already creates the shape in the correct XY plane
    // We just need to position it correctly
    
    // Move geometry so bottom is at Y=0 (ground level)
    geometry.translate(0, 0, height / 2);
    
    // Compute bounding volumes
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    console.log(`🎯 Polyline geometry created with original orientation, height: ${height}mm`);
    console.log(`🎯 Points used: ${uniquePoints.length}, first point: [${uniquePoints[0].x.toFixed(1)}, ${uniquePoints[0].z.toFixed(1)}]`);
    
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