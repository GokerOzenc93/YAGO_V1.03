import * as THREE from 'three';

export const createPolylineGeometry = (
  points: THREE.Vector3[],
  height: number,
  gridSize: number = 50,
  isFromFrontView: boolean = false
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

    // Get unique points (remove duplicate closing point if exists)
    const uniquePoints = points.length > 2 && points[points.length - 1].equals(points[0]) 
      ? points.slice(0, -1)
      : points;
    
    let relativePoints: THREE.Vector2[];
    
    if (isFromFrontView) {
      // Ön görünüş: XY düzleminde çizildi, Z ekseni boyunca extrude
      relativePoints = uniquePoints.map(point => new THREE.Vector2(point.x, point.y));
    } else {
      // Üst görünüş: XZ düzleminde çizildi, Y ekseni boyunca extrude
      relativePoints = uniquePoints.map(point => new THREE.Vector2(point.x, -point.z));
    }
    
    // Move to the first point
    shape.moveTo(relativePoints[0].x, relativePoints[0].y);
    
    // Add lines to subsequent points
    for (let i = 1; i < relativePoints.length; i++) {
      shape.lineTo(relativePoints[i].x, relativePoints[i].y);
    }
    
    // Close the shape
    shape.lineTo(relativePoints[0].x, relativePoints[0].y);

    // Create extrude settings
    const extrudeSettings = {
      depth: height,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 8
    };

    // Create the extruded geometry
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    if (!isFromFrontView) {
      // Üst görünüş: Rotate to make it horizontal (lying on XZ plane)
      geometry.rotateX(-Math.PI / 2);
    }
    // Ön görünüş: Geometry zaten doğru yönde (Z ekseni boyunca extrude)
    
    // Center the geometry at origin - this ensures gizmo appears at center
    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      const center = geometry.boundingBox.getCenter(new THREE.Vector3());
      geometry.translate(-center.x, -center.y, -center.z);
    }
    
    // Compute bounding volumes
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    console.log(`🎯 Polyline geometry created centered at origin with height: ${height}mm${isFromFrontView ? ' (FRONT VIEW - FORWARD EXTRUDE)' : ' (TOP VIEW)'}`);
    
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