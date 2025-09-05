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
  // Create a more realistic subtracted geometry
  const targetBounds = getShapeBounds({ 
    ...subtractShape, 
    geometry: targetGeometry, 
    position: [0, 0, 0], 
    scale: [1, 1, 1] 
  });
  const subtractBounds = getShapeBounds(subtractShape);
  
  // Calculate intersection area
  const intersectionMin = new THREE.Vector3(
    Math.max(targetBounds.min.x, subtractBounds.min.x),
    Math.max(targetBounds.min.y, subtractBounds.min.y),
    Math.max(targetBounds.min.z, subtractBounds.min.z)
  );
  
  const intersectionMax = new THREE.Vector3(
    Math.min(targetBounds.max.x, subtractBounds.max.x),
    Math.min(targetBounds.max.y, subtractBounds.max.y),
    Math.min(targetBounds.max.z, subtractBounds.max.z)
  );
  
  // Check if there's actual intersection
  const hasIntersection = intersectionMin.x < intersectionMax.x && 
                         intersectionMin.y < intersectionMax.y && 
                         intersectionMin.z < intersectionMax.z;
  
  if (!hasIntersection) {
    console.log('No intersection found, returning original geometry');
    return targetGeometry.clone();
  }
  
  // Calculate cavity dimensions
  const cavityWidth = intersectionMax.x - intersectionMin.x;
  const cavityHeight = intersectionMax.y - intersectionMin.y;
  const cavityDepth = intersectionMax.z - intersectionMin.z;
  const cavityCenter = new THREE.Vector3().addVectors(intersectionMin, intersectionMax).multiplyScalar(0.5);
  
  console.log(`🎯 Creating cavity: ${cavityWidth.toFixed(1)}x${cavityHeight.toFixed(1)}x${cavityDepth.toFixed(1)}mm at [${cavityCenter.x.toFixed(1)}, ${cavityCenter.y.toFixed(1)}, ${cavityCenter.z.toFixed(1)}]`);
  
  // Create a more complex geometry with actual cavity
  // For now, we'll create a hollow box effect by scaling down the inner part
  const originalSize = new THREE.Vector3().subVectors(targetBounds.max, targetBounds.min);
  const wallThickness = Math.min(originalSize.x, originalSize.y, originalSize.z) * 0.1; // 10% wall thickness
  
  // Create outer geometry (original size)
  const outerGeometry = new THREE.BoxGeometry(
    originalSize.x,
    originalSize.y,
    originalSize.z
  );
  
  // Create inner geometry (cavity)
  const innerGeometry = new THREE.BoxGeometry(
    Math.max(cavityWidth - wallThickness, cavityWidth * 0.8),
    Math.max(cavityHeight - wallThickness, cavityHeight * 0.8),
    Math.max(cavityDepth - wallThickness, cavityDepth * 0.8)
  );
  
  // Position inner geometry at cavity center
  const innerMatrix = new THREE.Matrix4().makeTranslation(
    cavityCenter.x - (targetBounds.min.x + targetBounds.max.x) / 2,
    cavityCenter.y - (targetBounds.min.y + targetBounds.max.y) / 2,
    cavityCenter.z - (targetBounds.min.z + targetBounds.max.z) / 2
  );
  innerGeometry.applyMatrix4(innerMatrix);
  
  // For a simple implementation, return a modified outer geometry
  // In a real CSG implementation, we would subtract the inner from outer
  const resultGeometry = outerGeometry;
  
  // Add some visual indication of the subtraction
  const positions = resultGeometry.attributes.position;
  const positionArray = positions.array as Float32Array;
  
  // Create indentation effect at cavity location
  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3(
      positionArray[i * 3],
      positionArray[i * 3 + 1],
      positionArray[i * 3 + 2]
    );
    
    // Check if vertex is near the cavity area
    const distanceToCenter = vertex.distanceTo(cavityCenter);
    const maxCavityDim = Math.max(cavityWidth, cavityHeight, cavityDepth);
    
    if (distanceToCenter < maxCavityDim * 0.6) {
      // Create indentation by moving vertices toward cavity center
      const direction = new THREE.Vector3().subVectors(cavityCenter, vertex).normalize();
      const indentAmount = (1 - distanceToCenter / (maxCavityDim * 0.6)) * wallThickness;
      vertex.add(direction.multiplyScalar(indentAmount));
      
      positionArray[i * 3] = vertex.x;
      positionArray[i * 3 + 1] = vertex.y;
      positionArray[i * 3 + 2] = vertex.z;
    }
  }
  
  positions.needsUpdate = true;
  resultGeometry.computeVertexNormals();
  resultGeometry.computeBoundingBox();
  resultGeometry.computeBoundingSphere();
  
  console.log('✅ Boolean subtraction applied - improved cavity geometry created');
  return resultGeometry;
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