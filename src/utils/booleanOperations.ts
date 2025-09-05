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

// Helper function to create mesh from shape for operations
const createMeshFromShape = (shape: Shape): THREE.Mesh => {
  const geometry = shape.geometry.clone();
  const material = new THREE.MeshBasicMaterial({ color: 0x888888 });
  const mesh = new THREE.Mesh(geometry, material);
  
  // Apply transformations
  mesh.position.set(...shape.position);
  mesh.rotation.set(...shape.rotation);
  mesh.scale.set(...shape.scale);
  
  // Update matrix
  mesh.updateMatrixWorld(true);
  
  return mesh;
};

// Simple cavity effect for subtract operation (fallback)
const createSubtractedGeometry = (targetGeometry: THREE.BufferGeometry, subtractShape: Shape): THREE.BufferGeometry => {
  const newGeometry = targetGeometry.clone();
  
  // Get the subtract shape's dimensions and position
  const subtractBounds = getShapeBounds(subtractShape);
  const subtractCenter = new THREE.Vector3(
    (subtractBounds.min.x + subtractBounds.max.x) / 2,
    (subtractBounds.min.y + subtractBounds.max.y) / 2,
    (subtractBounds.min.z + subtractBounds.max.z) / 2
  );
  
  // Create a visual indication by modifying the geometry
  if (subtractShape.type === 'box' || subtractShape.type === 'cylinder') {
    const positions = newGeometry.attributes.position;
    const positionArray = positions.array as Float32Array;
    
    // Modify vertices that are close to the subtract shape
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positionArray[i * 3],
        positionArray[i * 3 + 1],
        positionArray[i * 3 + 2]
      );
      
      // Check if vertex is within the subtract shape's influence
      const distance = vertex.distanceTo(subtractCenter);
      const influenceRadius = Math.max(
        subtractBounds.max.x - subtractBounds.min.x,
        subtractBounds.max.y - subtractBounds.min.y,
        subtractBounds.max.z - subtractBounds.min.z
      ) / 2;
      
      if (distance < influenceRadius) {
        // Create a cavity effect by pushing vertices inward
        const direction = vertex.clone().sub(subtractCenter).normalize();
        const pushDistance = (influenceRadius - distance) * 0.3;
        vertex.sub(direction.multiplyScalar(pushDistance));
        
        positionArray[i * 3] = vertex.x;
        positionArray[i * 3 + 1] = vertex.y;
        positionArray[i * 3 + 2] = vertex.z;
      }
    }
    
    // Mark the attribute as needing update
    positions.needsUpdate = true;
    newGeometry.computeVertexNormals();
    newGeometry.computeBoundingBox();
    newGeometry.computeBoundingSphere();
  }
  
  console.log('Boolean subtraction applied - geometry modified with cavity effect');
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

// Perform boolean subtract operation (fallback implementation)
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
  
  try {
    // Apply subtract operation to each intersecting shape
    intersectingShapes.forEach(targetShape => {
      console.log(`🎯 Subtracting ${selectedShape.type} from ${targetShape.type}`);
      
      // Create modified geometry with cavity effect
      const newGeometry = createSubtractedGeometry(targetShape.geometry, selectedShape);
      
      updateShape(targetShape.id, {
        geometry: newGeometry,
        parameters: {
          ...targetShape.parameters,
          booleanOperation: 'subtract',
          subtractedShapeId: selectedShape.id,
          lastModified: Date.now()
        }
      });
      
      console.log(`✅ Subtract applied to shape ${targetShape.id}`);
    });
    
    // Delete the selected shape (the one being subtracted)
    deleteShape(selectedShape.id);
    console.log(`🗑️ Deleted subtracted shape: ${selectedShape.id}`);
    
    console.log(`✅ Boolean subtract completed: ${intersectingShapes.length} shapes modified`);
    return true;
    
  } catch (error) {
    console.error('❌ Boolean subtract failed:', error);
    return false;
  }
};

// Perform boolean union operation (fallback implementation)
export const performBooleanUnion = (
  selectedShape: Shape,
  allShapes: Shape[],
  updateShape: (id: string, updates: Partial<Shape>) => void,
  deleteShape: (id: string) => void
): boolean => {
  console.log('🎯 Starting boolean union operation...');
  
  // Find intersecting shapes
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ No intersecting shapes found for union operation');
    return false;
  }
  
  console.log(`🎯 Found ${intersectingShapes.length} intersecting shapes for union`);
  
  try {
    // For union, we'll merge the selected shape with the first intersecting shape
    const targetShape = intersectingShapes[0];
    
    console.log(`🎯 Union ${selectedShape.type} with ${targetShape.type}`);
    
    // Simple union: expand the target shape's bounding box
    const selectedBounds = getShapeBounds(selectedShape);
    const targetBounds = getShapeBounds(targetShape);
    
    // Create a new box that encompasses both shapes
    const unionBounds = new THREE.Box3().copy(targetBounds).union(selectedBounds);
    const size = unionBounds.getSize(new THREE.Vector3());
    const center = unionBounds.getCenter(new THREE.Vector3());
    
    // Create new geometry
    const newGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
    
    updateShape(targetShape.id, {
      geometry: newGeometry,
      position: [center.x, center.y, center.z],
      parameters: {
        ...targetShape.parameters,
        width: size.x,
        height: size.y,
        depth: size.z,
        booleanOperation: 'union',
        unionedShapeId: selectedShape.id,
        lastModified: Date.now()
      }
    });
    
    console.log(`✅ Union applied to shape ${targetShape.id}`);
    
    // Delete the selected shape (it's now merged)
    deleteShape(selectedShape.id);
    console.log(`🗑️ Deleted merged shape: ${selectedShape.id}`);
    
    console.log(`✅ Boolean union completed`);
    return true;
    
  } catch (error) {
    console.error('❌ Boolean union failed:', error);
    return false;
  }
};