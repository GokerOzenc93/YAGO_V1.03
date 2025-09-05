import * as THREE from 'three';
import { CSG } from 'three-bvh-csg';
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

// Helper function to create mesh from shape for CSG operations
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

// Perform boolean subtract operation using three-bvh-csg
export const performBooleanSubtract = (
  selectedShape: Shape,
  allShapes: Shape[],
  updateShape: (id: string, updates: Partial<Shape>) => void,
  deleteShape: (id: string) => void
): boolean => {
  console.log('🎯 Starting CSG boolean subtract operation...');
  
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
      console.log(`🎯 CSG Subtracting ${selectedShape.type} from ${targetShape.type}`);
      
      // Create meshes for CSG operation
      const targetMesh = createMeshFromShape(targetShape);
      const subtractMesh = createMeshFromShape(selectedShape);
      
      // Perform CSG subtract operation
      const resultMesh = CSG.subtract(targetMesh, subtractMesh);
      
      if (resultMesh && resultMesh.geometry) {
        // Apply the result geometry to world space
        resultMesh.geometry.applyMatrix4(resultMesh.matrixWorld);
        
        // Update the target shape with new geometry
        const newGeometry = resultMesh.geometry.clone();
        newGeometry.computeBoundingBox();
        newGeometry.computeBoundingSphere();
        newGeometry.computeVertexNormals();
        
        updateShape(targetShape.id, {
          geometry: newGeometry,
          parameters: {
            ...targetShape.parameters,
            booleanOperation: 'subtract',
            subtractedShapeId: selectedShape.id,
            lastModified: Date.now()
          }
        });
        
        console.log(`✅ CSG subtract applied to shape ${targetShape.id}`);
        
        // Clean up temporary meshes
        targetMesh.geometry.dispose();
        (targetMesh.material as THREE.Material).dispose();
        subtractMesh.geometry.dispose();
        (subtractMesh.material as THREE.Material).dispose();
        
        if (resultMesh.geometry !== newGeometry) {
          resultMesh.geometry.dispose();
        }
        if (resultMesh.material) {
          (resultMesh.material as THREE.Material).dispose();
        }
      } else {
        console.warn(`⚠️ CSG operation failed for shape ${targetShape.id}`);
      }
    });
    
    // Delete the selected shape (the one being subtracted)
    deleteShape(selectedShape.id);
    console.log(`🗑️ Deleted subtracted shape: ${selectedShape.id}`);
    
    console.log(`✅ CSG Boolean subtract completed: ${intersectingShapes.length} shapes modified`);
    return true;
    
  } catch (error) {
    console.error('❌ CSG Boolean subtract failed:', error);
    return false;
  }
};

// Perform boolean union operation using three-bvh-csg
export const performBooleanUnion = (
  selectedShape: Shape,
  allShapes: Shape[],
  updateShape: (id: string, updates: Partial<Shape>) => void,
  deleteShape: (id: string) => void
): boolean => {
  console.log('🎯 Starting CSG boolean union operation...');
  
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
    
    console.log(`🎯 CSG Union ${selectedShape.type} with ${targetShape.type}`);
    
    // Create meshes for CSG operation
    const targetMesh = createMeshFromShape(targetShape);
    const unionMesh = createMeshFromShape(selectedShape);
    
    // Perform CSG union operation
    const resultMesh = CSG.union(targetMesh, unionMesh);
    
    if (resultMesh && resultMesh.geometry) {
      // Apply the result geometry to world space
      resultMesh.geometry.applyMatrix4(resultMesh.matrixWorld);
      
      // Update the target shape with new geometry
      const newGeometry = resultMesh.geometry.clone();
      newGeometry.computeBoundingBox();
      newGeometry.computeBoundingSphere();
      newGeometry.computeVertexNormals();
      
      updateShape(targetShape.id, {
        geometry: newGeometry,
        parameters: {
          ...targetShape.parameters,
          booleanOperation: 'union',
          unionedShapeId: selectedShape.id,
          lastModified: Date.now()
        }
      });
      
      console.log(`✅ CSG union applied to shape ${targetShape.id}`);
      
      // Clean up temporary meshes
      targetMesh.geometry.dispose();
      (targetMesh.material as THREE.Material).dispose();
      unionMesh.geometry.dispose();
      (unionMesh.material as THREE.Material).dispose();
      
      if (resultMesh.geometry !== newGeometry) {
        resultMesh.geometry.dispose();
      }
      if (resultMesh.material) {
        (resultMesh.material as THREE.Material).dispose();
      }
      
      // Delete the selected shape (it's now merged)
      deleteShape(selectedShape.id);
      console.log(`🗑️ Deleted merged shape: ${selectedShape.id}`);
      
      console.log(`✅ CSG Boolean union completed`);
      return true;
    } else {
      console.warn(`⚠️ CSG union operation failed`);
      return false;
    }
    
  } catch (error) {
    console.error('❌ CSG Boolean union failed:', error);
    return false;
  }
};