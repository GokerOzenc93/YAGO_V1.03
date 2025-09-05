import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Dummy data and types to make the code runnable without external files
const Shape = {};
const Vector3 = THREE.Vector3;
const Matrix4 = THREE.Matrix4;

// Doğru bounding box hesaplama (rotation/scale destekli)
const getShapeBounds = (shape) => {
  const geometry = shape.geometry;
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox.clone(); // local bbox

  const pos = new THREE.Vector3(...(shape.position || [0, 0, 0]));
  const scale = new THREE.Vector3(...(shape.scale || [1, 1, 1]));
  // shape.rotation olabilir; eğer yoksa 0,0,0 al
  const rot = shape.rotation ? new THREE.Euler(...shape.rotation) : new THREE.Euler(0, 0, 0);
  const quat = new THREE.Quaternion().setFromEuler(rot);

  const m = new THREE.Matrix4().compose(pos, quat, scale);
  bbox.applyMatrix4(m); // bbox'ı world/shape-space'e dönüştür

  return bbox;
};

// Helper function to check if two bounding boxes intersect
const boundsIntersect = (bounds1, bounds2) => {
  return bounds1.intersectsBox(bounds2);
};

// Find intersecting shapes
export const findIntersectingShapes = (
  selectedShape,
  allShapes
) => {
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

// Create brush from shape with proper transforms
const createBrushFromShape = (shape) => {
  const brush = new Brush(shape.geometry.clone());
  
  // Apply transforms
  brush.position.fromArray(shape.position || [0, 0, 0]);
  brush.scale.fromArray(shape.scale || [1, 1, 1]);
  
  if (shape.rotation) {
    const euler = new THREE.Euler(...shape.rotation);
    brush.quaternion.setFromEuler(euler);
  }
  
  // CRITICAL: Update matrix world
  brush.updateMatrixWorld(true);
  
  console.log(`🎯 Brush created:`, {
    position: brush.position.toArray().map(v => v.toFixed(1)),
    scale: brush.scale.toArray().map(v => v.toFixed(1)),
    rotation: shape.rotation?.map(v => (v * 180 / Math.PI).toFixed(1)) || [0, 0, 0]
  });
  
  return brush;
};

// Perform boolean subtract operation with three-bvh-csg
export const performBooleanSubtract = (
  selectedShape,
  allShapes,
  updateShape,
  deleteShape
) => {
  console.log('🎯 ===== BOOLEAN SUBTRACT OPERATION STARTED (CSG) =====');
  console.log(`🎯 Selected shape for subtraction: ${selectedShape.type} (${selectedShape.id})`);
  
  // Find intersecting shapes
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ No intersecting shapes found for subtract operation');
    return false;
  }
  
  console.log(`🎯 Processing subtraction with ${intersectingShapes.length} intersecting shapes using CSG`);
  
  const evaluator = new Evaluator();
  
  try {
    // Process each intersecting shape
    intersectingShapes.forEach((targetShape, index) => {
      console.log(`🎯 Subtract operation ${index + 1}/${intersectingShapes.length}: ${targetShape.type} (${targetShape.id})`);
      
      // Create brushes
      const selectedBrush = createBrushFromShape(selectedShape);
      const targetBrush = createBrushFromShape(targetShape);
      
      console.log('🎯 Performing CSG subtraction...');
      
      // A - B (subtraction)
      const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, SUBTRACTION);
      
      if (!resultMesh || !resultMesh.geometry) {
        console.error('❌ CSG subtraction operation failed - no result mesh');
        return;
      }
      
      resultMesh.updateMatrixWorld(true);
      
      console.log('✅ CSG subtraction completed, transforming result to local space...');
      
      // Transform result geometry back into target's LOCAL space
      const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
      let newGeom = resultMesh.geometry.clone();
      newGeom.applyMatrix4(invTarget);
      
      // 🎯 GEOMETRY CLEANUP - Remove extra vertices and optimize
      console.log('🎯 Cleaning up CSG subtraction result geometry...');
      
      // Capture original counts before cleanup
      const originalVertexCount = newGeom.attributes.position?.count || 0;
      const originalTriangleCount = newGeom.index ? newGeom.index.count / 3 : originalVertexCount / 3;
      
      // Yüksek tolerans değeri ile köşe noktalarını birleştirerek
      // yüzeyleri tek parça haline getirmeye çalışırız.
      newGeom = BufferGeometryUtils.mergeVertices(newGeom, 1e-2);
      
      const cleanVertexCount = newGeom.attributes.position?.count || 0;
      const cleanTriangleCount = newGeom.index ? newGeom.index.count / 3 : cleanVertexCount / 3;
      
      console.log(`🎯 BufferGeometryUtils union cleanup: ${originalVertexCount} -> ${cleanVertexCount} vertices, ${originalTriangleCount.toFixed(0)} -> ${cleanTriangleCount.toFixed(0)} triangles`);
      
      // 2. Recompute all geometry properties
      newGeom.computeVertexNormals();
      newGeom.computeBoundingBox();
      newGeom.computeBoundingSphere();
      
      console.log(`✅ Final union geometry: ${cleanVertexCount} vertices, ${cleanTriangleCount.toFixed(0)} triangles`);
      
      // Dispose old geometry
      try { 
        targetShape.geometry.dispose(); 
      } catch (e) { 
        console.warn('Could not dispose old geometry:', e);
      }
      
      // Update the target shape
      updateShape(targetShape.id, {
        geometry: newGeom,
        parameters: {
          ...targetShape.parameters,
          booleanOperation: 'subtract',
          subtractedShapeId: selectedShape.id,
          lastModified: Date.now(),
        }
      });
      
      console.log(`✅ Target shape ${targetShape.id} updated with CSG result`);
    });
    
    // Delete the selected shape (the one being subtracted)
    deleteShape(selectedShape.id);
    console.log(`🗑️ Subtracted shape deleted: ${selectedShape.id}`);
    
    console.log(`✅ ===== BOOLEAN SUBTRACT COMPLETED SUCCESSFULLY (CSG) =====`);
    console.log(`📊 Summary: ${intersectingShapes.length} shapes modified with CSG, 1 shape deleted`);
    
    return true;
    
  } catch (error) {
    console.error('❌ ===== BOOLEAN SUBTRACT FAILED (CSG) =====');
    console.error('CSG Error details:', error);
    return false;
  }
};

/**
 * Advanced CSG geometry cleanup - removes extra vertices and creates clean surfaces for face selection
 */
const cleanupCSGGeometry = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => {
  console.log('🎯 Starting advanced CSG geometry cleanup...');
  
  const position = geometry.attributes.position;
  const index = geometry.index;
  
  if (!position || !index) {
    console.warn('Geometry missing position or index attributes');
    return geometry;
  }
  
  // 1. Coplanar face detection and merging
  const faces: { vertices: THREE.Vector3[]; normal: THREE.Vector3; indices: number[] }[] = [];
  const faceCount = index.count / 3;
  
  for (let i = 0; i < faceCount; i++) {
    const a = index.getX(i * 3);
    const b = index.getX(i * 3 + 1);
    const c = index.getX(i * 3 + 2);
    
    const va = new THREE.Vector3().fromBufferAttribute(position, a);
    const vb = new THREE.Vector3().fromBufferAttribute(position, b);
    const vc = new THREE.Vector3().fromBufferAttribute(position, c);
    
    // Calculate face normal
    const normal = new THREE.Vector3()
      .subVectors(vb, va)
      .cross(new THREE.Vector3().subVectors(vc, va))
      .normalize();
    
    faces.push({
      vertices: [va, vb, vc],
      normal: normal,
      indices: [a, b, c]
    });
  }
  
  // 2. Group coplanar faces
  const coplanarGroups: typeof faces[] = [];
  const processed = new Set<number>();
  const NORMAL_TOLERANCE = 0.01; // ~0.6 degrees
  const PLANE_TOLERANCE = 0.1; // 0.1mm
  
  for (let i = 0; i < faces.length; i++) {
    if (processed.has(i)) continue;
    
    const group = [faces[i]];
    processed.add(i);
    
    const refNormal = faces[i].normal;
    const refPoint = faces[i].vertices[0];
    
    for (let j = i + 1; j < faces.length; j++) {
      if (processed.has(j)) continue;
      
      const face = faces[j];
      
      // Check if normals are similar (or opposite)
      const normalDot = Math.abs(refNormal.dot(face.normal));
      if (normalDot < (1 - NORMAL_TOLERANCE)) continue;
      
      // Check if face is on the same plane
      const distance = Math.abs(refNormal.dot(new THREE.Vector3().subVectors(face.vertices[0], refPoint)));
      if (distance > PLANE_TOLERANCE) continue;
      
      group.push(face);
      processed.add(j);
    }
    
    coplanarGroups.push(group);
  }
  
  console.log(`🎯 Found ${coplanarGroups.length} coplanar groups from ${faces.length} faces`);
  
  // 3. Create new geometry with merged coplanar faces
  const newVertices: number[] = [];
  const newIndices: number[] = [];
  let vertexIndex = 0;
  
  for (const group of coplanarGroups) {
    if (group.length === 1) {
      // Single face - add as is
      const face = group[0];
      for (const vertex of face.vertices) {
        newVertices.push(vertex.x, vertex.y, vertex.z);
      }
      newIndices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
      vertexIndex += 3;
    } else {
      // Multiple coplanar faces - create a single quad or merged face
      // For simplicity, we'll keep the largest face from the group
      let largestFace = group[0];
      let largestArea = 0;
      
      for (const face of group) {
        const area = new THREE.Vector3()
          .subVectors(face.vertices[1], face.vertices[0])
          .cross(new THREE.Vector3().subVectors(face.vertices[2], face.vertices[0]))
          .length() / 2;
        
        if (area > largestArea) {
          largestArea = area;
          largestFace = face;
        }
      }
      
      // Add the largest face
      for (const vertex of largestFace.vertices) {
        newVertices.push(vertex.x, vertex.y, vertex.z);
      }
      newIndices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
      vertexIndex += 3;
    }
  }
  
  // 4. Create new geometry
  const cleanGeometry = new THREE.BufferGeometry();
  cleanGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newVertices, 3));
  cleanGeometry.setIndex(newIndices);
  
  // 5. Final merge vertices to remove any remaining duplicates
  const finalGeometry = BufferGeometryUtils.mergeVertices(cleanGeometry, 1e-4);
  
  console.log(`🎯 Advanced cleanup complete: ${faces.length} -> ${coplanarGroups.length} faces, ${newVertices.length/3} vertices`);
  
  return finalGeometry;
};

// Perform boolean union operation with three-bvh-csg
export const performBooleanUnion = (
  selectedShape,
  allShapes,
  updateShape,
  deleteShape
) => {
  console.log('🎯 ===== BOOLEAN UNION OPERATION STARTED (CSG) =====');
  console.log(`🎯 Selected shape for union: ${selectedShape.type} (${selectedShape.id})`);
  
  // Find intersecting shapes
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ No intersecting shapes found for union operation');
    return false;
  }
  
  console.log(`🎯 Processing union with ${intersectingShapes.length} intersecting shapes using CSG`);
  
  const evaluator = new Evaluator();
  
  try {
    // For union, merge with the first intersecting shape
    const targetShape = intersectingShapes[0];
    
    console.log(`🎯 Union target: ${targetShape.type} (${targetShape.id})`);
    
    // Create brushes
    const selectedBrush = createBrushFromShape(selectedShape);
    const targetBrush = createBrushFromShape(targetShape);
    
    console.log('🎯 Performing CSG union...');
    
    // A + B (union)
    const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, ADDITION);
    
    if (!resultMesh || !resultMesh.geometry) {
      console.error('❌ CSG union operation failed - no result mesh');
      return false;
    }
    
    resultMesh.updateMatrixWorld(true);
    
    console.log('✅ CSG union completed, transforming result to local space...');
    
    // Transform result geometry back into target's LOCAL space
    const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
    let newGeom = resultMesh.geometry.clone();
    newGeom.applyMatrix4(invTarget);
    
    // 🎯 ADVANCED GEOMETRY CLEANUP - Remove extra vertices and create clean surfaces
    console.log('🎯 Advanced CSG geometry cleanup for face selection...');
    
    // 1. İlk temizlik - duplicate vertex'leri birleştir
    newGeom = BufferGeometryUtils.mergeVertices(newGeom, 1e-3);
    // Capture original counts before cleanup
    const originalVertexCount = newGeom.attributes.position?.count || 0;
    const originalTriangleCount = newGeom.index ? newGeom.index.count / 3 : originalVertexCount / 3;
    
    // 1. İlk temizlik - duplicate vertex'leri birleştir
    newGeom = BufferGeometryUtils.mergeVertices(newGeom, 1e-3);
    
    // 2. Coplanar face'leri birleştir ve fazla vertex'leri kaldır
    newGeom = cleanupCSGGeometry(newGeom);
    
    const cleanVertexCount = newGeom.attributes.position?.count || 0;
    const cleanTriangleCount = newGeom.index ? newGeom.index.count / 3 : cleanVertexCount / 3;
    
    console.log(`🎯 Advanced cleanup: ${originalVertexCount} -> ${cleanVertexCount} vertices, ${originalTriangleCount.toFixed(0)} -> ${cleanTriangleCount.toFixed(0)} triangles`);
    
    // 3. Recompute all geometry properties
    newGeom.computeVertexNormals();
    newGeom.computeBoundingBox();
    newGeom.computeBoundingSphere();
    
    console.log(`🎯 Union result geometry:`, {
      vertices: newGeom.attributes.position?.count || 0,
      triangles: newGeom.index ? newGeom.index.count / 3 : newGeom.attributes.position?.count / 3 || 0
    });
    
    // Dispose old geometry
    try { 
      targetShape.geometry.dispose(); 
    } catch (e) { 
      console.warn('Could not dispose old geometry:', e);
    }
    
    // Update the target shape
    updateShape(targetShape.id, {
      geometry: newGeom,
      parameters: {
        ...targetShape.parameters,
        booleanOperation: 'union',
        unionedShapeId: selectedShape.id,
        lastModified: Date.now()
      }
    });
    
    console.log(`✅ Target shape ${targetShape.id} updated with union geometry`);
    
    // Delete the selected shape (it's now merged)
    deleteShape(selectedShape.id);
    console.log(`🗑️ Merged shape deleted: ${selectedShape.id}`);
    
    console.log(`✅ ===== BOOLEAN UNION COMPLETED SUCCESSFULLY (CSG) =====`);
    return true;
    
  } catch (error) {
    console.error('❌ ===== BOOLEAN UNION FAILED (CSG) =====');
    console.error('CSG Error details:', error);
    return false;
  }
};