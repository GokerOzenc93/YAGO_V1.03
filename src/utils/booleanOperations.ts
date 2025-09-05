import * as THREE from 'three';
import { Shape } from '../types/shapes';

// Helper function to get shape bounds with transformations
const getShapeBounds = (shape: Shape): THREE.Box3 => {
  const geometry = shape.geometry;
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  
  // Apply shape transformations
  const min = new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z);
  const max = new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z);
  
  // Apply scale
  min.multiply(new THREE.Vector3(...shape.scale));
  max.multiply(new THREE.Vector3(...shape.scale));
  
  // Apply position
  min.add(new THREE.Vector3(...shape.position));
  max.add(new THREE.Vector3(...shape.position));
  
  return new THREE.Box3(min, max);
};

// Helper function to check if two bounding boxes intersect
const boundsIntersect = (bounds1: THREE.Box3, bounds2: THREE.Box3): boolean => {
  return (
    bounds1.min.x <= bounds2.max.x && bounds1.max.x >= bounds2.min.x &&
    bounds1.min.y <= bounds2.max.y && bounds1.max.y >= bounds2.min.y &&
    bounds1.min.z <= bounds2.max.z && bounds1.max.z >= bounds2.min.z
  );
};

// Create a modified geometry with cavity effect
const createSubtractedGeometry = (
  targetGeometry: THREE.BufferGeometry, 
  subtractShape: Shape
): THREE.BufferGeometry => {
  console.log('🎯 Creating subtracted geometry...');
  
  // Clone the original geometry
  const newGeometry = targetGeometry.clone();
  
  // Get the subtract shape's bounds and center
  const subtractBounds = getShapeBounds(subtractShape);
  const subtractCenter = new THREE.Vector3(
    (subtractBounds.min.x + subtractBounds.max.x) / 2,
    (subtractBounds.min.y + subtractBounds.max.y) / 2,
    (subtractBounds.min.z + subtractBounds.max.z) / 2
  );
  
  // Calculate influence radius based on subtract shape size
  const influenceRadius = Math.max(
    subtractBounds.max.x - subtractBounds.min.x,
    subtractBounds.max.y - subtractBounds.min.y,
    subtractBounds.max.z - subtractBounds.min.z
  ) / 2;
  
  console.log('🎯 Subtract operation:', {
    center: subtractCenter.toArray().map(v => v.toFixed(1)),
    influenceRadius: influenceRadius.toFixed(1),
    shapeType: subtractShape.type
  });
  
  // Modify vertices to create cavity effect
  const positions = newGeometry.attributes.position;
  if (positions) {
    const positionArray = positions.array as Float32Array;
    let modifiedVertices = 0;
    
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positionArray[i * 3],
        positionArray[i * 3 + 1],
        positionArray[i * 3 + 2]
      );
      
      // Check if vertex is within the subtract shape's influence
      const distance = vertex.distanceTo(subtractCenter);
      
      if (distance < influenceRadius) {
        // Create a cavity effect by pushing vertices inward
        const direction = vertex.clone().sub(subtractCenter).normalize();
        const pushDistance = (influenceRadius - distance) * 0.4; // Cavity depth factor
        
        // Push vertex inward (toward the center)
        vertex.sub(direction.multiplyScalar(pushDistance));
        
        // Update the position array
        positionArray[i * 3] = vertex.x;
        positionArray[i * 3 + 1] = vertex.y;
        positionArray[i * 3 + 2] = vertex.z;
        
        modifiedVertices++;
      }
    }
    
    console.log(`🎯 Modified ${modifiedVertices} vertices for cavity effect`);
    
    // Mark the attribute as needing update
    positions.needsUpdate = true;
    
    // Recompute geometry properties
    newGeometry.computeVertexNormals();
    newGeometry.computeBoundingBox();
    newGeometry.computeBoundingSphere();
  }
  
  return newGeometry;
};

// Find intersecting shapes
export const findIntersectingShapes = (
  selectedShape: Shape, 
  allShapes: Shape[]
): Shape[] => {
  const selectedBounds = getShapeBounds(selectedShape);
  
  const intersectingShapes = allShapes.filter(shape => {
    if (shape.id === selectedShape.id) return false;
    
    const shapeBounds = getShapeBounds(shape);
    const intersects = boundsIntersect(selectedBounds, shapeBounds);
    
    if (intersects) {
      console.log(`🎯 Intersection found: ${selectedShape.type} (${selectedShape.id}) with ${shape.type} (${shape.id})`);
    }
    
    return intersects;
  });
  
  return intersectingShapes;
};

// Perform boolean subtract operation
export const performBooleanSubtract = (
  selectedShape: Shape,
  allShapes: Shape[],
  updateShape: (id: string, updates: Partial<Shape>) => void,
  deleteShape: (id: string) => void
): boolean => {
  console.log('🎯 Starting boolean subtract operation...');
  
  // Find intersecting shapes
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ No intersecting shapes found for boolean operation');
    return false;
  }
  
  console.log(`🎯 Found ${intersectingShapes.length} intersecting shapes`);
  
  // Apply subtract operation to each intersecting shape
  intersectingShapes.forEach(targetShape => {
    console.log(`🎯 Subtracting ${selectedShape.type} from ${targetShape.type}`);
    
    // Create modified geometry
    const modifiedGeometry = createSubtractedGeometry(targetShape.geometry, selectedShape);
    
    // Update the target shape with modified geometry
    updateShape(targetShape.id, {
      geometry: modifiedGeometry,
      parameters: {
        ...targetShape.parameters,
        booleanOperation: 'subtract',
        subtractedShapeId: selectedShape.id,
        lastModified: Date.now()
      }
    });
    
    console.log(`✅ Applied subtract operation to shape ${targetShape.id}`);
  });
  
  // Delete the selected shape (the one being subtracted)
  deleteShape(selectedShape.id);
  console.log(`🗑️ Deleted subtracted shape: ${selectedShape.id}`);
  
  console.log(`✅ Boolean subtract completed: ${intersectingShapes.length} shapes modified`);
  return true;
};

// Perform boolean union operation (placeholder for future implementation)
export const performBooleanUnion = (
  selectedShape: Shape,
  allShapes: Shape[],
  updateShape: (id: string, updates: Partial<Shape>) => void,
  deleteShape: (id: string) => void
): boolean => {
  console.log('🎯 Boolean union operation - not yet implemented');
  return false;
};