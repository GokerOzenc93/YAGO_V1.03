import * as THREE from 'three';
import { Shape } from './shapes';

/**
 * Calculate bounding box for shapes
 */
export const calculateShapesBounds = (shapes: Shape[]): THREE.Box3 => {
  const bounds = new THREE.Box3();
  
  if (shapes.length === 0) {
    // Default bounds if no shapes
    bounds.setFromCenterAndSize(new THREE.Vector3(0, 0, 0), new THREE.Vector3(2000, 1000, 2000));
    return bounds;
  }

  shapes.forEach(shape => {
    const geometry = shape.geometry;
    const position = new THREE.Vector3(...shape.position);
    const scale = new THREE.Vector3(...shape.scale);
    
    // Get geometry bounds
    geometry.computeBoundingBox();
    if (geometry.boundingBox) {
      const shapeBounds = geometry.boundingBox.clone();
      
      // Apply scale
      shapeBounds.min.multiply(scale);
      shapeBounds.max.multiply(scale);
      
      // Apply position
      shapeBounds.translate(position);
      
      bounds.union(shapeBounds);
    }
  });

  // Ensure minimum size
  const size = bounds.getSize(new THREE.Vector3());
  if (size.length() < 100) {
    const center = bounds.getCenter(new THREE.Vector3());
    bounds.setFromCenterAndSize(center, new THREE.Vector3(1000, 500, 1000));
  }

  return bounds;
};

/**
 * Fit camera to view shapes with proper scaling - OPTIMIZED FOR EDIT MODE
 */
export const fitCameraToShapes = (
  camera: THREE.Camera,
  controls: any,
  shapes: Shape[],
  padding: number = 1.2
): void => {
  if (!controls) return;

  const bounds = calculateShapesBounds(shapes);
  const center = bounds.getCenter(new THREE.Vector3());
  const size = bounds.getSize(new THREE.Vector3());

  // Calculate optimal distance based on object size
  let distance: number;
  
  if (camera instanceof THREE.PerspectiveCamera) {
    // For perspective camera, calculate distance to fit objects perfectly
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = camera.fov * (Math.PI / 180);
    
    // Calculate distance so object fits in view with padding
    distance = (maxDim * padding) / (2 * Math.tan(fov / 2));
    
    // Reasonable constraints for edit mode - closer view
    distance = Math.max(distance, 300); // Minimum closer distance
    distance = Math.min(distance, 8000); // Maximum distance reduced
    
    console.log('Perspective camera fit:', {
      objectSize: maxDim.toFixed(1),
      calculatedDistance: distance.toFixed(1),
      fov: camera.fov
    });
    
  } else if (camera instanceof THREE.OrthographicCamera) {
    // For orthographic camera, adjust zoom to fit objects
    const maxDim = Math.max(size.x, size.z); // Use X and Z for top-down view
    const viewportSize = Math.min(window.innerWidth, window.innerHeight);
    
    // Calculate zoom to fit object with padding - BETTER SCALING
    const targetZoom = (viewportSize / (maxDim * padding)) * 0.8; // Increased multiplier for better fit
    camera.zoom = Math.max(targetZoom, 0.2); // Higher minimum zoom
    camera.zoom = Math.min(camera.zoom, 8.0); // Higher maximum zoom
    camera.updateProjectionMatrix();
    
    distance = 1500; // Closer fixed distance for orthographic
    
    console.log('Orthographic camera fit:', {
      objectSize: maxDim.toFixed(1),
      calculatedZoom: camera.zoom.toFixed(3),
      viewportSize
    });
  } else {
    distance = 1500; // Closer fallback
  }

  // Position camera with more front-facing angle and slight upward pan
  const direction = new THREE.Vector3(0.5, 0.8, 0.9).normalize(); // More front-facing
  const newPosition = center.clone().add(direction.multiplyScalar(distance));
  
  // Slightly elevated target for upward pan
  const targetPosition = center.clone().add(new THREE.Vector3(0, 100, 0));

  // Smoothly animate to new position
  controls.object.position.copy(newPosition);
  controls.target.copy(targetPosition);
  
  // 🎯 CRITICAL: Reset target to prevent pan drift
  controls.target.set(0, 100, 0); // Slightly elevated target for upward pan
  controls.update();

  console.log('Camera fitted to shapes (EDIT MODE OPTIMIZED):', {
    center: center.toArray().map(v => v.toFixed(1)),
    size: size.toArray().map(v => v.toFixed(1)),
    distance: distance.toFixed(1),
    zoom: camera instanceof THREE.OrthographicCamera ? camera.zoom.toFixed(3) : 'N/A',
    padding,
    cameraAngle: 'front-facing with upward pan',
    editModeOptimized: true
  });
};

/**
 * Fit camera to single shape (for edit mode) - FIXED COORDINATES [424, 877, 1114]
 */
export const fitCameraToShape = (
  camera: THREE.Camera,
  controls: any,
  shape: Shape,
  padding: number = 1.3 // This parameter is now ignored for fixed positioning
): void => {
  if (!controls) return;

  console.log('Edit mode: Using FIXED camera coordinates [424, 877, 1114] for perfect fit');
  
  const bounds = calculateShapesBounds([shape]);
  const center = bounds.getCenter(new THREE.Vector3());
  
  // FIXED CAMERA COORDINATES - exactly as requested
  const fixedPosition = new THREE.Vector3(424, 877, 1114);
  
  // Target remains at shape center for proper focus
  const targetPosition = center.clone();

  // Apply fixed position immediately
  controls.object.position.copy(fixedPosition);
  controls.target.copy(targetPosition);
  
  // 🎯 CRITICAL: Ensure target is at shape center for proper pan behavior
  controls.target.copy(targetPosition);
  
  // For orthographic camera, set appropriate zoom for this fixed distance
  if (camera instanceof THREE.OrthographicCamera) {
    camera.zoom = 0.6; // Optimized zoom for the fixed distance
    camera.updateProjectionMatrix();
  }
  
  controls.update();

  console.log('Edit mode camera set to FIXED coordinates:', {
    position: fixedPosition.toArray(),
    target: targetPosition.toArray().map(v => v.toFixed(1)),
    zoom: camera instanceof THREE.OrthographicCamera ? camera.zoom.toFixed(3) : 'N/A',
    shapeCenter: center.toArray().map(v => v.toFixed(1)),
    fixedCoordinates: true
  });
};

/**
 * Reset camera to default position with front-facing angle
 */
export const resetCameraPosition = (
  camera: THREE.Camera,
  controls: any,
  cameraType: 'perspective' | 'orthographic'
): void => {
  if (!controls) return;

  const distance = cameraType === 'perspective' ? 2000 : 1000;
  
  // More front-facing position with slight upward pan
  controls.object.position.set(distance * 0.5, distance * 0.8, distance * 0.9);
  controls.target.set(0, 0, 0); // 🎯 RESET: Center target to prevent pan drift
  
  if (camera instanceof THREE.OrthographicCamera) {
    camera.zoom = 0.25;
    camera.updateProjectionMatrix();
  }
  
  controls.update();
  
  console.log('Camera reset to default front-facing position with upward pan');
};