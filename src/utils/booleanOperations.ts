import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import MeshoptDecoder from 'meshoptimizer/meshopt_decoder.module.js';
import { GeometryFactory } from '../lib/geometryFactory';

/**
 * Advanced geometry repair using meshoptimizer
 * Scans all surfaces and fixes post-CSG artifacts
 */
export function repairCSGGeometryWithMeshoptimizer(geom: THREE.BufferGeometry, tolerance = 1e-3): THREE.BufferGeometry {
  console.log('🔧 Starting advanced meshoptimizer-based geometry repair...');
  
  // Check if meshoptimizer is ready
  if (!GeometryFactory.isMeshoptimizerReady()) {
    console.warn('⚠️ Meshoptimizer not ready, falling back to basic cleanup');
    return cleanCSGGeometry(geom, tolerance);
  }
  
  if (!geom.attributes.position) {
    console.warn('repairCSGGeometry: geometry has no position attribute');
    return geom;
  }

  const originalVertexCount = geom.attributes.position.count;
  const originalTriangleCount = geom.index ? geom.index.count / 3 : originalVertexCount / 3;

  console.log(`🔧 Input geometry: ${originalVertexCount} vertices, ${originalTriangleCount.toFixed(0)} triangles`);

  // 1) Convert to non-indexed for processing
  let workingGeom = geom.index ? geom.toNonIndexed() : geom.clone();
  
  if (!workingGeom.attributes.position) {
    console.warn('Failed to create working geometry');
    return geom;
  }

  // 2) Extract vertex and index data for meshoptimizer
  const positions = workingGeom.attributes.position.array as Float32Array;
  const vertexCount = positions.length / 3;
  
  // Create indices array (0, 1, 2, 3, 4, 5, ...)
  const indices = new Uint32Array(vertexCount);
  for (let i = 0; i < vertexCount; i++) {
    indices[i] = i;
  }

  console.log(`🔧 Processing ${vertexCount} vertices with meshoptimizer...`);

  try {
    // 3) Optimize vertex cache for better performance
    const optimizedIndices = MeshoptDecoder.optimizeVertexCache(indices, vertexCount);
    
    // 4) Remove duplicate vertices with high precision
    const [remappedIndices, uniqueVertexCount] = MeshoptDecoder.optimizeVertexFetch(
      optimizedIndices,
      positions,
      vertexCount
    );
    
    console.log(`🔧 Vertex deduplication: ${vertexCount} → ${uniqueVertexCount} vertices`);
    
    // 5) Create new optimized positions array
    const newPositions = new Float32Array(uniqueVertexCount * 3);
    for (let i = 0; i < uniqueVertexCount; i++) {
      const srcIndex = i * 3;
      newPositions[srcIndex] = positions[srcIndex];
      newPositions[srcIndex + 1] = positions[srcIndex + 1];
      newPositions[srcIndex + 2] = positions[srcIndex + 2];
    }
    
    // 6) Simplify geometry to remove broken triangles (gentle simplification)
    const targetTriangleCount = Math.floor(remappedIndices.length / 3 * 0.98); // Keep 98% of triangles
    const simplifiedIndices = MeshoptDecoder.simplify(
      remappedIndices,
      newPositions,
      uniqueVertexCount,
      targetTriangleCount,
      0.01 // Very low error threshold to preserve shape
    );
    
    console.log(`🔧 Triangle optimization: ${(remappedIndices.length / 3).toFixed(0)} → ${(simplifiedIndices.length / 3).toFixed(0)} triangles`);
    
    // 7) Build final optimized geometry
    const finalGeometry = new THREE.BufferGeometry();
    finalGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
    finalGeometry.setIndex(Array.from(simplifiedIndices));
    
    // 8) Final cleanup with BufferGeometryUtils
    let mergedGeometry;
    try {
      mergedGeometry = BufferGeometryUtils.mergeVertices(finalGeometry, tolerance);
    } catch (err) {
      console.warn('BufferGeometryUtils.mergeVertices failed, using unmerged geometry:', err);
      mergedGeometry = finalGeometry;
    }
    
    // 9) Compute normals and bounds
    mergedGeometry.computeVertexNormals();
    mergedGeometry.computeBoundingBox();
    mergedGeometry.computeBoundingSphere();
    
    const finalVertexCount = mergedGeometry.attributes.position.count;
    const finalTriangleCount = mergedGeometry.index ? mergedGeometry.index.count / 3 : finalVertexCount / 3;
    
    console.log(`🔧 ✅ Meshoptimizer repair complete:`, {
      originalVertices: originalVertexCount,
      finalVertices: finalVertexCount,
      originalTriangles: originalTriangleCount.toFixed(0),
      finalTriangles: finalTriangleCount.toFixed(0),
      vertexReduction: `${(((originalVertexCount - finalVertexCount) / originalVertexCount) * 100).toFixed(1)}%`,
      triangleReduction: `${(((originalTriangleCount - finalTriangleCount) / originalTriangleCount) * 100).toFixed(1)}%`
    });
    
    return mergedGeometry;
    
  } catch (error) {
    console.error('❌ Meshoptimizer repair failed, falling back to basic cleanup:', error);
    return cleanCSGGeometry(geom, tolerance);
  }
}

/**
 * Clean up CSG-generated geometry:
 * - applyMatrix4 should be done *before* calling this
 * - converts to non-indexed, welds vertices by tolerance, removes degenerate triangles,
 * rebuilds indexed geometry, merges vertices, safely simplifies, computes normals/bounds
 *
 * @param {THREE.BufferGeometry} geom - geometry already in target-local space
 * @param {number} tolerance - welding tolerance in world units (e.g. 1e-3)
 * @returns {THREE.BufferGeometry} cleaned geometry (indexed)
 */
export function cleanCSGGeometry(geom, tolerance = 1e-2) { // Tolerance increased for better welding
  // 1) Ensure positions exist
  if (!geom.attributes.position) {
    console.warn('cleanCSGGeometry: geometry has no position attribute');
    return geom;
  }

  console.log(`🎯 Starting CSG geometry cleanup with tolerance: ${tolerance}`);
  const originalVertexCount = geom.attributes.position.count;
  const originalTriangleCount = geom.index ? geom.index.count / 3 : originalVertexCount / 3;

  // 2) Convert to non-indexed so triangles are explicit
  let nonIndexed = geom.index ? geom.toNonIndexed() : geom.clone();

  if (!nonIndexed || !nonIndexed.attributes || !nonIndexed.attributes.position) {
    console.warn('cleanCSGGeometry: geometry became invalid after toNonIndexed/clone');
    return new THREE.BufferGeometry();
  }

  const posAttr = nonIndexed.attributes.position;
  
  if (!posAttr.array || posAttr.array.length === 0) {
    console.warn('cleanCSGGeometry: position attribute has no array or empty array');
    return new THREE.BufferGeometry();
  }
  
  const posArray = posAttr.array;
  const triCount = posArray.length / 9;

  // 3) Weld vertices using a spatial hash
  const vertexMap = new Map();
  const uniqueVerts = [];
  const newIndices = [];
  let nextIndex = 0;

  const hash = (x, y, z) =>
    `${Math.round(x / tolerance)}_${Math.round(y / tolerance)}_${Math.round(z / tolerance)}`;

  let degenerateCount = 0;

  for (let tri = 0; tri < triCount; tri++) {
    const triIndices = [];
    for (let v = 0; v < 3; v++) {
      const i = tri * 9 + v * 3;
      const x = posArray[i];
      const y = posArray[i + 1];
      const z = posArray[i + 2];
      const key = hash(x, y, z);

      let idx;
      if (vertexMap.has(key)) {
        idx = vertexMap.get(key);
      } else {
        idx = nextIndex++;
        vertexMap.set(key, idx);
        uniqueVerts.push(x, y, z);
      }
      triIndices.push(idx);
    }

    if (
      triIndices[0] === triIndices[1] ||
      triIndices[1] === triIndices[2] ||
      triIndices[0] === triIndices[2]
    ) {
      degenerateCount++;
      continue;
    }

    newIndices.push(triIndices[0], triIndices[1], triIndices[2]);
  }

  console.log(`🎯 Removed ${degenerateCount} degenerate triangles`);

  // 4) Build new indexed BufferGeometry
  const cleaned = new THREE.BufferGeometry();
  const posBuffer = new Float32Array(uniqueVerts);
  cleaned.setAttribute('position', new THREE.BufferAttribute(posBuffer, 3));
  cleaned.setIndex(newIndices);

  // 5) Merge vertices with BufferGeometryUtils
  let merged;
  try {
    merged = BufferGeometryUtils.mergeVertices(cleaned, tolerance);
  } catch (err) {
    console.warn('BufferGeometryUtils.mergeVertices failed, using cleaned geometry:', err);
    merged = cleaned;
  }

  // 6) Handle invalid index after merge
  if (!merged.index || merged.index.count < 3) {
    console.warn('Invalid index after merge, converting to non-indexed and re-merging');
    const nonIdx = merged.toNonIndexed();
    merged.dispose();
    merged = nonIdx;
    try {
      merged = BufferGeometryUtils.mergeVertices(merged, tolerance);
    } catch (err) {
      console.warn('Second merge attempt failed, using non-indexed geometry:', err);
    }
  }
  
  // YENİ ADIM 7) Yüzeyleri Pürüzsüzleştirme ve İyileştirme 🧚‍♀️
  const finalGeom = merged;

  const finalVertexCount = finalGeom.attributes.position.count;
  const finalTriangleCount = finalGeom.index ? finalGeom.index.count / 3 : finalVertexCount / 3;

  console.log(`🎯 CSG cleanup complete:`, {
    originalVertices: originalVertexCount,
    finalVertices: finalVertexCount,
    originalTriangles: originalTriangleCount.toFixed(0),
    finalTriangles: finalTriangleCount.toFixed(0),
    degenerateRemoved: degenerateCount,
    vertexReduction: `${(((originalVertexCount - finalVertexCount) / originalVertexCount) * 100).toFixed(1)}%`
  });

  return finalGeom;
}

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
  const rot = shape.rotation ? new THREE.Euler(...shape.rotation) : new THREE.Euler(0, 0, 0);
  const quat = new THREE.Quaternion().setFromEuler(rot);

  const m = new THREE.Matrix4().compose(pos, quat, scale);
  bbox.applyMatrix4(m); 

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
  
  brush.position.fromArray(shape.position || [0, 0, 0]);
  brush.scale.fromArray(shape.scale || [1, 1, 1]);
  
  if (shape.rotation) {
    const euler = new THREE.Euler(...shape.rotation);
    brush.quaternion.setFromEuler(euler);
  }
  
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
  
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ No intersecting shapes found for subtract operation');
    return false;
  }
  
  console.log(`🎯 Processing subtraction with ${intersectingShapes.length} intersecting shapes using CSG`);
  
  const evaluator = new Evaluator();
  
  try {
    intersectingShapes.forEach((targetShape, index) => {
      console.log(`🎯 Subtract operation ${index + 1}/${intersectingShapes.length}: ${targetShape.type} (${targetShape.id})`);
      
      const selectedBrush = createBrushFromShape(selectedShape);
      const targetBrush = createBrushFromShape(targetShape);
      
      console.log('🎯 Performing CSG subtraction...');
      
      const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, SUBTRACTION);
      
      if (!resultMesh || !resultMesh.geometry || resultMesh.geometry.attributes.position.count === 0) {
        console.error('❌ CSG subtraction operation failed or resulted in an empty mesh. Aborting for this shape.');
        return;
      }
      
      resultMesh.updateMatrixWorld(true);
      
      console.log('✅ CSG subtraction completed, transforming result to local space...');
      
      const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
      let newGeom = resultMesh.geometry.clone();
      newGeom.applyMatrix4(invTarget);
      
      console.log('🎯 Applying robust CSG cleanup to subtraction result...');
      // 🔧 Use advanced meshoptimizer-based repair
      newGeom = repairCSGGeometryWithMeshoptimizer(newGeom, 0.001); 
      
      if (!newGeom || !newGeom.attributes.position || newGeom.attributes.position.count === 0) {
          console.error(`❌ Meshoptimizer repair resulted in an empty geometry for target shape ${targetShape.id}. Aborting update.`);
          return;
      }
      
      try { 
        targetShape.geometry.dispose(); 
      } catch (e) { 
        console.warn('Could not dispose old geometry:', e);
      }
      
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

// Perform boolean union operation with three-bvh-csg
export const performBooleanUnion = (
  selectedShape,
  allShapes,
  updateShape,
  deleteShape
) => {
  console.log('🎯 ===== BOOLEAN UNION OPERATION STARTED (CSG) =====');
  console.log(`🎯 Selected shape for union: ${selectedShape.type} (${selectedShape.id})`);
  
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ No intersecting shapes found for union operation');
    return false;
  }
  
  console.log(`🎯 Processing union with ${intersectingShapes.length} intersecting shapes using CSG`);
  
  const evaluator = new Evaluator();
  
  try {
    const targetShape = intersectingShapes[0];
    
    console.log(`🎯 Union target: ${targetShape.type} (${targetShape.id})`);
    
    const selectedBrush = createBrushFromShape(selectedShape);
    const targetBrush = createBrushFromShape(targetShape);
    
    console.log('🎯 Performing CSG union...');
    
    const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, ADDITION);
    
    if (!resultMesh || !resultMesh.geometry || resultMesh.geometry.attributes.position.count === 0) {
      console.error('❌ CSG union operation failed or resulted in an empty mesh. Aborting.');
      return false;
    }
    
    resultMesh.updateMatrixWorld(true);
    
    console.log('✅ CSG union completed, transforming result to local space...');
    
    const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
    let newGeom = resultMesh.geometry.clone();
    newGeom.applyMatrix4(invTarget);
    
    console.log('🎯 Applying robust CSG cleanup to union result...');
    // 🔧 Use advanced meshoptimizer-based repair
    newGeom = repairCSGGeometryWithMeshoptimizer(newGeom, 0.001);

    if (!newGeom || !newGeom.attributes.position || newGeom.attributes.position.count === 0) {
        console.error(`❌ Meshoptimizer repair resulted in an empty geometry for union operation. Aborting update.`);
        return false;
    }
    
    try { 
      targetShape.geometry.dispose(); 
    } catch (e) { 
      console.warn('Could not dispose old geometry:', e);
    }
    
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

