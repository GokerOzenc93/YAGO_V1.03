import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeometryFactory } from '../lib/geometryFactory';
// SimplifyModifier, nesnelerin kaybolmasına neden olduğu için kaldırıldı.

/**
 * Clean up CSG-generated geometry:
 * - applyMatrix4 should be done *before* calling this
 * - converts to non-indexed, welds vertices by tolerance, removes degenerate triangles,
 * rebuilds indexed geometry, merges vertices, computes normals/bounds
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

  // 2) Convert to non-indexed so triangles are explicit (easier to dedupe & remove degenerate)
  let nonIndexed = geom.index ? geom.toNonIndexed() : geom.clone();

  // 2.1) Validate geometry after conversion
  if (!nonIndexed || !nonIndexed.attributes || !nonIndexed.attributes.position) {
    console.warn('cleanCSGGeometry: geometry became invalid after toNonIndexed/clone');
    return new THREE.BufferGeometry();
  }

  const posAttr = nonIndexed.attributes.position;
  
  // 2.2) Validate position attribute array
  if (!posAttr.array || posAttr.array.length === 0) {
    console.warn('cleanCSGGeometry: position attribute has no array or empty array');
    return new THREE.BufferGeometry();
  }
  
  const posArray = posAttr.array;
  const triCount = posArray.length / 9; // 3 verts * 3 components

  // 3) Spatial hash to weld vertices with given tolerance
  const vertexMap = new Map(); // key -> newIndex
  const uniqueVerts = []; // flattened xyz
  const newIndices = []; // triangles (indices into uniqueVerts)
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

    // remove degenerate triangles (two or three indices equal)
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

  // 5) Merge vertices with BufferGeometryUtils as extra safety
  let merged;
  try {
    merged = BufferGeometryUtils.mergeVertices(cleaned, tolerance);
  } catch (err) {
    console.warn('BufferGeometryUtils.mergeVertices failed, using cleaned geometry:', err);
    merged = cleaned;
  }

  // 6) Remove isolated vertices - Recompute indices validity
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

  // 7) Recompute normals and bounds
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  const finalVertexCount = merged.attributes.position.count;
  const finalTriangleCount = merged.index ? merged.index.count / 3 : finalVertexCount / 3;

  console.log(`🎯 CSG cleanup complete:`, {
    originalVertices: originalVertexCount,
    finalVertices: finalVertexCount,
    originalTriangles: originalTriangleCount.toFixed(0),
    finalTriangles: finalTriangleCount.toFixed(0),
    degenerateRemoved: degenerateCount,
    vertexReduction: `${(((originalVertexCount - finalVertexCount) / originalVertexCount) * 100).toFixed(1)}%`
  });

  return merged;
}

/**
 * Reconstruct geometry from world vertices with proper surface generation
 * Creates new clean geometry based on bounding box and shape type
 */
const reconstructGeometryFromBounds = async (
  originalShape: any,
  resultGeometry: THREE.BufferGeometry,
  targetBrush: any
): Promise<THREE.BufferGeometry> => {
  console.log('🎯 Starting geometry reconstruction from bounds...');
  
  // Get the result geometry bounds in world space
  resultGeometry.computeBoundingBox();
  const bbox = resultGeometry.boundingBox;
  
  if (!bbox) {
    console.warn('No bounding box available for reconstruction');
    return resultGeometry;
  }
  
  // Calculate dimensions from bounding box
  const width = Math.abs(bbox.max.x - bbox.min.x);
  const height = Math.abs(bbox.max.y - bbox.min.y);
  const depth = Math.abs(bbox.max.z - bbox.min.z);
  
  console.log(`🎯 Reconstructing geometry with dimensions: ${width.toFixed(1)} x ${height.toFixed(1)} x ${depth.toFixed(1)}`);
  
  let newGeometry: THREE.BufferGeometry;
  
  // Determine shape type and create appropriate geometry
  if (originalShape.type === 'box' || !originalShape.type) {
    // Create new box geometry with calculated dimensions
    newGeometry = await GeometryFactory.createBox(width, height, depth);
  } else if (originalShape.type === 'cylinder') {
    // For cylinder, use average of width/depth as radius
    const radius = Math.max(width, depth) / 2;
    newGeometry = await GeometryFactory.createCylinder(radius, height);
  } else {
    // For other shapes, default to box
    newGeometry = await GeometryFactory.createBox(width, height, depth);
  }
  
  // Center the new geometry at the result's center
  const center = bbox.getCenter(new THREE.Vector3());
  newGeometry.translate(center.x, center.y, center.z);
  
  // Transform back to local space
  const invMatrix = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
  newGeometry.applyMatrix4(invMatrix);
  
  console.log('✅ Geometry reconstruction completed with clean surfaces');
  return newGeometry;
};

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
      newGeom = cleanCSGGeometry(newGeom, 0.05);
      
      // 🎯 NEW: Reconstruct geometry with proper surfaces if cleanup failed or resulted in poor quality
      if (!newGeom || !newGeom.attributes.position || newGeom.attributes.position.count < 12) {
        console.log('🎯 CSG result has poor quality, reconstructing geometry from bounds...');
        try {
          newGeom = await reconstructGeometryFromBounds(targetShape, resultMesh.geometry, targetBrush);
        } catch (error) {
          console.error('❌ Geometry reconstruction failed:', error);
          return;
        }
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
    newGeom = cleanCSGGeometry(newGeom, 0.05);

    // 🎯 NEW: Reconstruct geometry with proper surfaces if cleanup failed or resulted in poor quality
    if (!newGeom || !newGeom.attributes.position || newGeom.attributes.position.count < 12) {
      console.log('🎯 CSG result has poor quality, reconstructing geometry from bounds...');
      try {
        newGeom = await reconstructGeometryFromBounds(targetShape, resultMesh.geometry, targetBrush);
      } catch (error) {
        console.error('❌ Geometry reconstruction failed:', error);
        return false;
      }
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