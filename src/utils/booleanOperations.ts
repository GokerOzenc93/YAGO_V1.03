import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Clean up CSG-generated geometry:
 * - applyMatrix4 should be done *before* calling this
 * - converts to non-indexed, welds vertices by tolerance, removes degenerate triangles,
 * rebuilds indexed geometry, merges vertices, computes normals/bounds
 * - merges coplanar faces to eliminate unnecessary vertices
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

 // 7) 🎯 NEW: Merge coplanar faces to eliminate unnecessary vertices
 console.log('🎯 Starting coplanar face merging...');
 merged = mergeCoplanarFaces(merged, tolerance);
 // 8) Recompute normals and bounds
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
 * Merge coplanar faces to eliminate unnecessary vertices and create cleaner surfaces
 * @param {THREE.BufferGeometry} geometry - Input geometry
 * @param {number} tolerance - Tolerance for coplanarity check
 * @returns {THREE.BufferGeometry} Geometry with merged coplanar faces
 */
function mergeCoplanarFaces(geometry, tolerance = 1e-2) {
  if (!geometry.index || !geometry.attributes.position) {
    console.warn('mergeCoplanarFaces: Invalid geometry');
    return geometry;
  }

  const positions = geometry.attributes.position.array;
  const indices = geometry.index.array;
  const triangleCount = indices.length / 3;

  console.log(`🎯 Analyzing ${triangleCount} triangles for coplanar face merging...`);

  // Calculate face normals and centers
  const faceNormals = [];
  const faceCenters = [];
  const faceAreas = [];

  for (let i = 0; i < triangleCount; i++) {
    const i0 = indices[i * 3] * 3;
    const i1 = indices[i * 3 + 1] * 3;
    const i2 = indices[i * 3 + 2] * 3;

    const v0 = new THREE.Vector3(positions[i0], positions[i0 + 1], positions[i0 + 2]);
    const v1 = new THREE.Vector3(positions[i1], positions[i1 + 1], positions[i1 + 2]);
    const v2 = new THREE.Vector3(positions[i2], positions[i2 + 1], positions[i2 + 2]);

    // Calculate normal
    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();

    // Calculate center
    const center = new THREE.Vector3().addVectors(v0, v1).add(v2).divideScalar(3);

    // Calculate area
    const area = edge1.cross(edge2).length() / 2;

    faceNormals.push(normal);
    faceCenters.push(center);
    faceAreas.push(area);
  }

  // Group coplanar faces
  const coplanarGroups = [];
  const processed = new Set();
  const normalTolerance = Math.cos(THREE.MathUtils.degToRad(1)); // 1 degree tolerance
  const planeTolerance = tolerance * 10; // Distance tolerance for same plane

  for (let i = 0; i < triangleCount; i++) {
    if (processed.has(i)) continue;

    const group = [i];
    const baseNormal = faceNormals[i];
    const baseCenter = faceCenters[i];
    processed.add(i);

    // Find coplanar faces
    for (let j = i + 1; j < triangleCount; j++) {
      if (processed.has(j)) continue;

      const testNormal = faceNormals[j];
      const testCenter = faceCenters[j];

      // Check if normals are parallel (same or opposite direction)
      const normalDot = Math.abs(baseNormal.dot(testNormal));
      if (normalDot < normalTolerance) continue;

      // Check if faces are on the same plane
      const centerDiff = new THREE.Vector3().subVectors(testCenter, baseCenter);
      const distanceToPlane = Math.abs(centerDiff.dot(baseNormal));
      
      if (distanceToPlane < planeTolerance) {
        group.push(j);
        processed.add(j);
      }
    }

    if (group.length > 1) {
      coplanarGroups.push(group);
    }
  }

  console.log(`🎯 Found ${coplanarGroups.length} coplanar face groups`);

  if (coplanarGroups.length === 0) {
    return geometry; // No coplanar faces to merge
  }

  // Create new geometry with merged faces
  const newPositions = [];
  const newIndices = [];
  let vertexIndex = 0;

  // Keep non-coplanar faces as-is
  const allGroupedFaces = new Set();
  coplanarGroups.forEach(group => group.forEach(faceIndex => allGroupedFaces.add(faceIndex)));

  for (let i = 0; i < triangleCount; i++) {
    if (allGroupedFaces.has(i)) continue;

    // Copy original triangle
    const i0 = indices[i * 3] * 3;
    const i1 = indices[i * 3 + 1] * 3;
    const i2 = indices[i * 3 + 2] * 3;

    newPositions.push(
      positions[i0], positions[i0 + 1], positions[i0 + 2],
      positions[i1], positions[i1 + 1], positions[i1 + 2],
      positions[i2], positions[i2 + 1], positions[i2 + 2]
    );

    newIndices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
    vertexIndex += 3;
  }

  // Process coplanar groups - create simplified faces
  let mergedFaceCount = 0;
  coplanarGroups.forEach(group => {
    // Collect all vertices from the group
    const groupVertices = [];
    const vertexSet = new Set();

    group.forEach(faceIndex => {
      for (let v = 0; v < 3; v++) {
        const idx = indices[faceIndex * 3 + v] * 3;
        const vertex = new THREE.Vector3(positions[idx], positions[idx + 1], positions[idx + 2]);
        const key = `${vertex.x.toFixed(6)}_${vertex.y.toFixed(6)}_${vertex.z.toFixed(6)}`;
        
        if (!vertexSet.has(key)) {
          vertexSet.add(key);
          groupVertices.push(vertex);
        }
      }
    });

    if (groupVertices.length < 3) return;

    // Create a simplified representation using convex hull or boundary detection
    // For now, we'll use a simple approach: create triangles from the boundary vertices
    const normal = faceNormals[group[0]];
    
    // Project vertices to 2D plane for triangulation
    const u = new THREE.Vector3(1, 0, 0);
    if (Math.abs(normal.dot(u)) > 0.9) {
      u.set(0, 1, 0);
    }
    const v = new THREE.Vector3().crossVectors(normal, u).normalize();
    u.crossVectors(v, normal).normalize();

    const projectedVertices = groupVertices.map(vertex => ({
      vertex,
      u: vertex.dot(u),
      v: vertex.dot(v)
    }));

    // Simple fan triangulation from first vertex
    if (projectedVertices.length >= 3) {
      const baseVertex = projectedVertices[0].vertex;
      
      for (let i = 1; i < projectedVertices.length - 1; i++) {
        const v1 = projectedVertices[i].vertex;
        const v2 = projectedVertices[i + 1].vertex;

        // Add triangle vertices
        newPositions.push(
          baseVertex.x, baseVertex.y, baseVertex.z,
          v1.x, v1.y, v1.z,
          v2.x, v2.y, v2.z
        );

        newIndices.push(vertexIndex, vertexIndex + 1, vertexIndex + 2);
        vertexIndex += 3;
      }
      
      mergedFaceCount++;
    }
  });

  console.log(`🎯 Merged ${coplanarGroups.length} coplanar groups into ${mergedFaceCount} simplified faces`);

  // Create new geometry
  const mergedGeometry = new THREE.BufferGeometry();
  mergedGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newPositions), 3));
  mergedGeometry.setIndex(newIndices);

  return mergedGeometry;
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
      
      // 🎯 ROBUST CSG CLEANUP - Advanced geometry cleaning
      console.log('🎯 Applying robust CSG cleanup to subtraction result...');
      newGeom = cleanCSGGeometry(newGeom, 0.05); // Yüksek tolerans değeri ile daha iyi kaynaklama
      
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
    
    // 🎯 ROBUST CSG CLEANUP - Advanced geometry cleaning
    console.log('🎯 Applying robust CSG cleanup to union result...');
    newGeom = cleanCSGGeometry(newGeom, 0.05); // Yüksek tolerans değeri ile daha iyi kaynaklama
    
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
