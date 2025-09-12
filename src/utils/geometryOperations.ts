import * as THREE from 'three';
import { Shape } from '../types/shapes';

/**
 * Perform CSG (Constructive Solid Geometry) boolean subtraction operation
 * This is a simplified implementation - in a real CAD application,
 * you would use a proper CSG library like three-csg or similar
 */
export const performCSGSubtraction = (
  targetShape: Shape,
  subtractorShape: Shape
): THREE.BufferGeometry | null => {
  try {
    console.log(`➖ Performing CSG boolean subtraction: ${targetShape.type} - ${subtractorShape.type}`);
    
    // Create world matrices for both shapes
    const targetMatrix = new THREE.Matrix4();
    const subtractorMatrix = new THREE.Matrix4();
    
    // Target shape transform
    targetMatrix.compose(
      new THREE.Vector3(...targetShape.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...targetShape.rotation)),
      new THREE.Vector3(...targetShape.scale)
    );
    
    // Subtractor shape transform
    subtractorMatrix.compose(
      new THREE.Vector3(...subtractorShape.position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...subtractorShape.rotation)),
      new THREE.Vector3(...subtractorShape.scale)
    );
    
    // For now, we'll create a simplified result
    // In a real implementation, you would use a CSG library
    const resultGeometry = createSimplifiedSubtractedGeometry(
      targetShape.geometry,
      subtractorShape.geometry,
      targetMatrix,
      subtractorMatrix
    );
    
    console.log('➖ CSG boolean subtraction completed successfully');
    return resultGeometry;
    
  } catch (error) {
    console.error('➖ CSG boolean subtraction failed:', error);
    return null;
  }
};

/**
 * Create a simplified subtracted geometry
 * This is a placeholder implementation - replace with actual CSG operations
 */
const createSimplifiedSubtractedGeometry = (
  targetGeometry: THREE.BufferGeometry,
  subtractorGeometry: THREE.BufferGeometry,
  targetMatrix: THREE.Matrix4,
  subtractorMatrix: THREE.Matrix4
): THREE.BufferGeometry => {
  
  // Clone the target geometry
  const resultGeometry = targetGeometry.clone();
  
  // Apply transformations
  resultGeometry.applyMatrix4(targetMatrix);
  
  // Get subtractor bounds in world space
  const subtractorGeometryTransformed = subtractorGeometry.clone();
  subtractorGeometryTransformed.applyMatrix4(subtractorMatrix);
  subtractorGeometryTransformed.computeBoundingBox();
  
  if (!subtractorGeometryTransformed.boundingBox) {
    return resultGeometry;
  }
  
  const subtractorBounds = subtractorGeometryTransformed.boundingBox;
  
  // Simplified subtraction: Remove vertices that are inside the subtractor bounds
  const positions = resultGeometry.attributes.position;
  const newPositions: number[] = [];
  const newIndices: number[] = [];
  
  if (resultGeometry.index) {
    // Indexed geometry
    const indices = resultGeometry.index.array;
    let newVertexIndex = 0;
    const vertexMap = new Map<number, number>();
    
    for (let i = 0; i < indices.length; i += 3) {
      const triangle = [
        indices[i],
        indices[i + 1],
        indices[i + 2]
      ];
      
      // Check if triangle should be kept
      let keepTriangle = true;
      const triangleVertices: THREE.Vector3[] = [];
      
      for (const vertexIndex of triangle) {
        const vertex = new THREE.Vector3().fromBufferAttribute(positions, vertexIndex);
        triangleVertices.push(vertex);
        
        // Simple inside check - if vertex is inside subtractor bounds, remove triangle
        if (subtractorBounds.containsPoint(vertex)) {
          keepTriangle = false;
          break;
        }
      }
      
      if (keepTriangle) {
        // Add vertices and indices
        for (let j = 0; j < 3; j++) {
          const originalIndex = triangle[j];
          
          if (!vertexMap.has(originalIndex)) {
            // Add new vertex
            const vertex = triangleVertices[j];
            newPositions.push(vertex.x, vertex.y, vertex.z);
            vertexMap.set(originalIndex, newVertexIndex);
            newVertexIndex++;
          }
          
          newIndices.push(vertexMap.get(originalIndex)!);
        }
      }
    }
  } else {
    // Non-indexed geometry - simpler approach
    for (let i = 0; i < positions.count; i += 3) {
      const triangle = [
        new THREE.Vector3().fromBufferAttribute(positions, i),
        new THREE.Vector3().fromBufferAttribute(positions, i + 1),
        new THREE.Vector3().fromBufferAttribute(positions, i + 2)
      ];
      
      // Check if any vertex is inside knife bounds
      let keepTriangle = true;
      for (const vertex of triangle) {
        if (subtractorBounds.containsPoint(vertex)) {
          keepTriangle = false;
          break;
        }
      }
      
      if (keepTriangle) {
        triangle.forEach(vertex => {
          newPositions.push(vertex.x, vertex.y, vertex.z);
        });
      }
    }
  }
  
  // Create new geometry with trimmed vertices
  const trimmedGeometry = new THREE.BufferGeometry();
  
  if (newPositions.length > 0) {
    trimmedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    
    if (newIndices.length > 0) {
      trimmedGeometry.setIndex(newIndices);
    }
    
    // Compute normals and other attributes
    trimmedGeometry.computeVertexNormals();
    trimmedGeometry.computeBoundingBox();
    trimmedGeometry.computeBoundingSphere();
  } else {
    // Fallback: return a small box if everything was trimmed
    return new THREE.BoxGeometry(10, 10, 10);
  }
  
  console.log(`➖ Subtracted geometry: ${newPositions.length / 3} vertices, ${newIndices.length / 3} triangles`);
  
  return trimmedGeometry;
};

/**
 * Check if two geometries intersect (simplified)
 */
export const checkGeometryIntersection = (
  geometry1: THREE.BufferGeometry,
  matrix1: THREE.Matrix4,
  geometry2: THREE.BufferGeometry,
  matrix2: THREE.Matrix4
): boolean => {
  // Compute bounding boxes in world space
  const box1 = geometry1.boundingBox?.clone();
  const box2 = geometry2.boundingBox?.clone();
  
  if (!box1 || !box2) return false;
  
  box1.applyMatrix4(matrix1);
  box2.applyMatrix4(matrix2);
  
  return box1.intersectsBox(box2);
};

/**
 * Create a unified geometry from multiple subtracted pieces
 */
export const createUnifiedGeometry = (geometries: THREE.BufferGeometry[]): THREE.BufferGeometry => {
  if (geometries.length === 0) {
    return new THREE.BoxGeometry(1, 1, 1);
  }
  
  if (geometries.length === 1) {
    return geometries[0];
  }
  
  // Merge all geometries into one
  const mergedGeometry = new THREE.BufferGeometry();
  const positions: number[] = [];
  const normals: number[] = [];
  const indices: number[] = [];
  let vertexOffset = 0;
  
  geometries.forEach(geometry => {
    const pos = geometry.attributes.position;
    const norm = geometry.attributes.normal;
    const idx = geometry.index;
    
    if (pos) {
      for (let i = 0; i < pos.count; i++) {
        positions.push(pos.getX(i), pos.getY(i), pos.getZ(i));
      }
    }
    
    if (norm) {
      for (let i = 0; i < norm.count; i++) {
        normals.push(norm.getX(i), norm.getY(i), norm.getZ(i));
      }
    }
    
    if (idx) {
      for (let i = 0; i < idx.count; i++) {
        indices.push(idx.getX(i) + vertexOffset);
      }
    }
    
    vertexOffset += pos ? pos.count : 0;
  });
  
  mergedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  
  if (normals.length > 0) {
    mergedGeometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
  } else {
    mergedGeometry.computeVertexNormals();
  }
  
  if (indices.length > 0) {
    mergedGeometry.setIndex(indices);
  }
  
  mergedGeometry.computeBoundingBox();
  mergedGeometry.computeBoundingSphere();
  
  console.log(`➖ Unified geometry created: ${positions.length / 3} vertices, ${indices.length / 3} triangles`);
  
  return mergedGeometry;
};