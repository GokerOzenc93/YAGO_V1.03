import * as THREE from 'three';
import { CompletedShape } from './types';
import { calculatePolylineCenter, isShapeClosed } from './utils';

export const createPolylineGeometry = (
  points: THREE.Vector3[], 
  height: number = 10, 
  gridSize: number = 50
): THREE.BufferGeometry => {
  if (points.length < 3) {
    return new THREE.BoxGeometry(gridSize, height, gridSize);
  }

  try {
    const center = calculatePolylineCenter(points);
    const shape = new THREE.Shape();
    
    // FIXED: Use correct coordinate mapping for top-down view
    // X stays X, Z becomes Y in 2D shape coordinates
    const firstPoint = points[0];
    shape.moveTo(firstPoint.x - center.x, firstPoint.z - center.z);
    
    // Process all points in the SAME ORDER as drawn (no reversal)
    for (let i = 1; i < points.length - 1; i++) {
      const point = points[i];
      shape.lineTo(point.x - center.x, point.z - center.z);
    }
    
    // Handle last point for closed shapes
    if (!isShapeClosed(points, 50)) {
      const lastPoint = points[points.length - 1];
      shape.lineTo(lastPoint.x - center.x, lastPoint.z - center.z);
    }
    
    const extrudeSettings = {
      depth: height,
      bevelEnabled: false,
    };
    
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    
    // FIXED: Correct rotation for top-down view
    // Rotate around X-axis to align with XZ plane (no mirroring)
    geometry.rotateX(-Math.PI / 2);
    
    console.log('Polygon geometry created correctly - no mirroring, same orientation as drawn');
    
    return geometry;
  } catch (error) {
    console.warn('Failed to create polyline geometry, using fallback:', error);
    const bounds = new THREE.Box3();
    points.forEach(point => bounds.expandByPoint(point));
    const size = bounds.getSize(new THREE.Vector3());
    return new THREE.BoxGeometry(
      Math.max(size.x, gridSize), 
      height, 
      Math.max(size.z, gridSize)
    );
  }
};