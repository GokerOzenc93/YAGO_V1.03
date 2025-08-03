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

    // Create shape relative to center (translate to origin for shape creation)
    const relativePoints = uniquePoints.map(point => point.clone().sub(center));
    
    // Move to the first relative point
    shape.moveTo(relativePoints[0].x, relativePoints[0].z);
    
    // Add lines to subsequent points
    for (let i = 1; i < relativePoints.length; i++) {
      shape.lineTo(relativePoints[i].x, relativePoints[i].z);
    }
    
    // Close the shape
    shape.lineTo(relativePoints[0].x, relativePoints[0].z);

    // Create extrude settings
    const extrudeSettings = {
      depth: height,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 8
    };

    // Create the extruded geometry
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // Rotate to make it horizontal (lying on XZ plane)
    geometry.rotateX(-Math.PI / 2);
    
    // Move geometry so bottom is at Y=0
    geometry.translate(0, height / 2, 0);
    
    // Now translate the geometry to the original polyline position
    geometry.translate(center.x, 0, center.z);
    
    // Compute bounding volumes
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    console.log(`🎯 Polyline geometry created at center: [${center.x.toFixed(1)}, 0, ${center.z.toFixed(1)}] with height: ${height}mm`);
    
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