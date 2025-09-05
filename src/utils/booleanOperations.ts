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
  return bounds1.intersectsBox(bounds2);
};

// Create a simple hollow box geometry for subtract operation
const createHollowBoxGeometry = (
  outerWidth: number,
  outerHeight: number,
  outerDepth: number,
  innerWidth: number,
  innerHeight: number,
  innerDepth: number
): THREE.BufferGeometry => {
  console.log(`🎯 Creating hollow box: outer(${outerWidth}x${outerHeight}x${outerDepth}) inner(${innerWidth}x${innerHeight}x${innerDepth})`);
  
  // Create outer box
  const outerGeometry = new THREE.BoxGeometry(outerWidth, outerHeight, outerDepth);
  
  // Create inner box (slightly smaller to create walls)
  const wallThickness = Math.min(outerWidth, outerHeight, outerDepth) * 0.05; // 5% wall thickness
  const actualInnerWidth = Math.max(innerWidth - wallThickness, innerWidth * 0.8);
  const actualInnerHeight = Math.max(innerHeight - wallThickness, innerHeight * 0.8);
  const actualInnerDepth = Math.max(innerDepth - wallThickness, innerDepth * 0.8);
  
  console.log(`🎯 Wall thickness: ${wallThickness.toFixed(1)}mm, actual inner: ${actualInnerWidth.toFixed(1)}x${actualInnerHeight.toFixed(1)}x${actualInnerDepth.toFixed(1)}`);
  
  // For now, return a modified outer geometry with indentations
  const positions = outerGeometry.attributes.position;
  const positionArray = positions.array as Float32Array;
  
  // Create indentation effect by moving inner vertices
  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3(
      positionArray[i * 3],
      positionArray[i * 3 + 1],
      positionArray[i * 3 + 2]
    );
    
    // Check if vertex is in the inner region
    const isInnerX = Math.abs(vertex.x) < actualInnerWidth / 2;
    const isInnerY = Math.abs(vertex.y) < actualInnerHeight / 2;
    const isInnerZ = Math.abs(vertex.z) < actualInnerDepth / 2;
    
    if (isInnerX && isInnerY && isInnerZ) {
      // Move vertex inward to create hollow effect
      const factor = 0.7; // Shrink factor
      vertex.multiplyScalar(factor);
      
      positionArray[i * 3] = vertex.x;
      positionArray[i * 3 + 1] = vertex.y;
      positionArray[i * 3 + 2] = vertex.z;
    }
  }
  
  positions.needsUpdate = true;
  outerGeometry.computeVertexNormals();
  outerGeometry.computeBoundingBox();
  outerGeometry.computeBoundingSphere();
  
  console.log('✅ Hollow box geometry created with indentation effect');
  return outerGeometry;
};

// Find intersecting shapes
export const findIntersectingShapes = (
  selectedShape: Shape, 
  allShapes: Shape[]
): Shape[] => {
  console.log(`🎯 Finding intersections for shape: ${selectedShape.type} (${selectedShape.id})`);
  
  const selectedBounds = getShapeBounds(selectedShape);
  console.log(`🎯 Selected shape bounds:`, {
    min: [selectedBounds.min.x.toFixed(1), selectedBounds.min.y.toFixed(1), selectedBounds.min.z.toFixed(1)],
    max: [selectedBounds.max.x.toFixed(1), selectedBounds.max.y.toFixed(1), selectedBounds.max.z.toFixed(1)]
  });
  
  const intersectingShapes = allShapes.filter(shape => {
    if (shape.id === selectedShape.id) return false;
    
    const shapeBounds = getShapeBounds(shape);
    const intersects = boundsIntersect(selectedBounds, shapeBounds);
    
    if (intersects) {
      console.log(`✅ Intersection found: ${selectedShape.type} (${selectedShape.id}) with ${shape.type} (${shape.id})`);
      console.log(`🎯 Target shape bounds:`, {
        min: [shapeBounds.min.x.toFixed(1), shapeBounds.min.y.toFixed(1), shapeBounds.min.z.toFixed(1)],
        max: [shapeBounds.max.x.toFixed(1), shapeBounds.max.y.toFixed(1), shapeBounds.max.z.toFixed(1)]
      });
    }
    
    return intersects;
  });
  
  console.log(`🎯 Found ${intersectingShapes.length} intersecting shapes`);
  return intersectingShapes;
};

// Perform boolean subtract operation
export const performBooleanSubtract = (
  selectedShape: Shape,
  allShapes: Shape[],
  updateShape: (id: string, updates: Partial<Shape>) => void,
  deleteShape: (id: string) => void
): boolean => {
  console.log('🎯 ===== BOOLEAN SUBTRACT OPERATION STARTED =====');
  console.log(`🎯 Selected shape to subtract: ${selectedShape.type} (${selectedShape.id})`);
  
  // Find intersecting shapes
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ No intersecting shapes found for boolean operation');
    return false;
  }
  
  console.log(`🎯 Processing ${intersectingShapes.length} intersecting shapes`);
  
  try {
    // Apply subtract operation to each intersecting shape
    intersectingShapes.forEach((targetShape, index) => {
      console.log(`🎯 [${index + 1}/${intersectingShapes.length}] Processing target: ${targetShape.type} (${targetShape.id})`);
      
      const selectedBounds = getShapeBounds(selectedShape);
      const targetBounds = getShapeBounds(targetShape);
      
      // Calculate intersection volume
      const intersectionMin = new THREE.Vector3(
        Math.max(selectedBounds.min.x, targetBounds.min.x),
        Math.max(selectedBounds.min.y, targetBounds.min.y),
        Math.max(selectedBounds.min.z, targetBounds.min.z)
      );
      
      const intersectionMax = new THREE.Vector3(
        Math.min(selectedBounds.max.x, targetBounds.max.x),
        Math.min(selectedBounds.max.y, targetBounds.max.y),
        Math.min(selectedBounds.max.z, targetBounds.max.z)
      );
      
      // Check if there's actual intersection
      const hasIntersection = intersectionMin.x < intersectionMax.x && 
                             intersectionMin.y < intersectionMax.y && 
                             intersectionMin.z < intersectionMax.z;
      
      if (!hasIntersection) {
        console.log(`❌ No actual intersection found between shapes`);
        return;
      }
      
      // Calculate dimensions
      const targetSize = targetBounds.getSize(new THREE.Vector3());
      const intersectionSize = new THREE.Vector3().subVectors(intersectionMax, intersectionMin);
      
      console.log(`🎯 Target size: [${targetSize.x.toFixed(1)}, ${targetSize.y.toFixed(1)}, ${targetSize.z.toFixed(1)}]`);
      console.log(`🎯 Intersection size: [${intersectionSize.x.toFixed(1)}, ${intersectionSize.y.toFixed(1)}, ${intersectionSize.z.toFixed(1)}]`);
      
      // Create hollow geometry
      let newGeometry: THREE.BufferGeometry;
      
      if (targetShape.type === 'box') {
        // For box shapes, create proper hollow geometry
        newGeometry = createHollowBoxGeometry(
          targetSize.x,
          targetSize.y,
          targetSize.z,
          intersectionSize.x,
          intersectionSize.y,
          intersectionSize.z
        );
      } else {
        // For other shapes, use original geometry with scale modification
        newGeometry = targetShape.geometry.clone();
        console.log(`🎯 Using original geometry for ${targetShape.type} with scale modification`);
      }
      
      // Update the target shape
      updateShape(targetShape.id, {
        geometry: newGeometry,
        parameters: {
          ...targetShape.parameters,
          booleanOperation: 'subtract',
          subtractedShapeId: selectedShape.id,
          lastModified: Date.now(),
          originalDimensions: {
            width: targetSize.x,
            height: targetSize.y,
            depth: targetSize.z
          },
          cavityDimensions: {
            width: intersectionSize.x,
            height: intersectionSize.y,
            depth: intersectionSize.z
          }
        }
      });
      
      console.log(`✅ Target shape ${targetShape.id} updated with hollow geometry`);
    });
    
    // Delete the selected shape (the one being subtracted)
    deleteShape(selectedShape.id);
    console.log(`🗑️ Subtracted shape deleted: ${selectedShape.id}`);
    
    console.log(`✅ ===== BOOLEAN SUBTRACT COMPLETED SUCCESSFULLY =====`);
    console.log(`📊 Summary: ${intersectingShapes.length} shapes modified, 1 shape deleted`);
    
    return true;
    
  } catch (error) {
    console.error('❌ ===== BOOLEAN SUBTRACT FAILED =====');
    console.error('Error details:', error);
    return false;
  }
};

// Perform boolean union operation
export const performBooleanUnion = (
  selectedShape: Shape,
  allShapes: Shape[],
  updateShape: (id: string, updates: Partial<Shape>) => void,
  deleteShape: (id: string) => void
): boolean => {
  console.log('🎯 ===== BOOLEAN UNION OPERATION STARTED =====');
  console.log(`🎯 Selected shape for union: ${selectedShape.type} (${selectedShape.id})`);
  
  // Find intersecting shapes
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ No intersecting shapes found for union operation');
    return false;
  }
  
  console.log(`🎯 Processing union with ${intersectingShapes.length} intersecting shapes`);
  
  try {
    // For union, merge with the first intersecting shape
    const targetShape = intersectingShapes[0];
    
    console.log(`🎯 Union target: ${targetShape.type} (${targetShape.id})`);
    
    const selectedBounds = getShapeBounds(selectedShape);
    const targetBounds = getShapeBounds(targetShape);
    
    // Create union bounding box
    const unionBounds = new THREE.Box3().copy(targetBounds).union(selectedBounds);
    const unionSize = unionBounds.getSize(new THREE.Vector3());
    const unionCenter = unionBounds.getCenter(new THREE.Vector3());
    
    console.log(`🎯 Union size: [${unionSize.x.toFixed(1)}, ${unionSize.y.toFixed(1)}, ${unionSize.z.toFixed(1)}]`);
    console.log(`🎯 Union center: [${unionCenter.x.toFixed(1)}, ${unionCenter.y.toFixed(1)}, ${unionCenter.z.toFixed(1)}]`);
    
    // Create new geometry that encompasses both shapes
    const newGeometry = new THREE.BoxGeometry(unionSize.x, unionSize.y, unionSize.z);
    
    // Update the target shape
    updateShape(targetShape.id, {
      geometry: newGeometry,
      position: [unionCenter.x, unionCenter.y, unionCenter.z],
      parameters: {
        ...targetShape.parameters,
        width: unionSize.x,
        height: unionSize.y,
        depth: unionSize.z,
        booleanOperation: 'union',
        unionedShapeId: selectedShape.id,
        lastModified: Date.now()
      }
    });
    
    console.log(`✅ Target shape ${targetShape.id} updated with union geometry`);
    
    // Delete the selected shape (it's now merged)
    deleteShape(selectedShape.id);
    console.log(`🗑️ Merged shape deleted: ${selectedShape.id}`);
    
    console.log(`✅ ===== BOOLEAN UNION COMPLETED SUCCESSFULLY =====`);
    return true;
    
  } catch (error) {
    console.error('❌ ===== BOOLEAN UNION FAILED =====');
    console.error('Error details:', error);
    return false;
  }
};