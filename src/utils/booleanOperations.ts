import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Merges co-planar faces of a BufferGeometry by identifying contiguous regions
 * of faces that lie on the same plane and re-triangulating them.
 *
 * @param {THREE.BufferGeometry} geometry - The input geometry (must be indexed).
 * @param {number} toleranceNormal - The dot product tolerance for comparing face normals (lower is stricter).
 * @param {number} toleranceDist - The tolerance for checking if a vertex lies on a plane.
 * @returns {THREE.BufferGeometry} A new BufferGeometry with co-planar faces merged.
 */
function mergeCoplanarFaces(geometry, toleranceNormal = 0.999, toleranceDist = 0.01) {
    if (!geometry.index || !geometry.attributes.position) {
        console.warn('mergeCoplanarFaces requires indexed geometry with position attributes.');
        return geometry;
    }

    const posAttr = geometry.attributes.position;
    const indexAttr = geometry.index;
    const triCount = indexAttr.count / 3;

    const faceData = Array.from({ length: triCount }, (_, i) => {
        const i1 = indexAttr.getX(i * 3);
        const i2 = indexAttr.getX(i * 3 + 1);
        const i3 = indexAttr.getX(i * 3 + 2);

        const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, i1);
        const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, i2);
        const v3 = new THREE.Vector3().fromBufferAttribute(posAttr, i3);

        const plane = new THREE.Plane().setFromCoplanarPoints(v1, v2, v3);
        return { plane, vertices: [v1, v2, v3] };
    });

    const adj = new Map(Array.from({ length: triCount }, (_, i) => [i, []]));
    const edgeMap = new Map();

    for (let i = 0; i < triCount; i++) {
        for (let j = 0; j < 3; j++) {
            const i1 = indexAttr.getX(i * 3 + j);
            const i2 = indexAttr.getX(i * 3 + ((j + 1) % 3));
            const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
            if (!edgeMap.has(key)) edgeMap.set(key, []);
            edgeMap.get(key).push(i);
        }
    }

    edgeMap.forEach(faces => {
        if (faces.length === 2) {
            adj.get(faces[0])?.push(faces[1]);
            adj.get(faces[1])?.push(faces[0]);
        }
    });

    const visited = new Set();
    const finalVertices = [];
    const finalIndices = [];
    let vertexOffset = 0;

    for (let i = 0; i < triCount; i++) {
        if (visited.has(i)) continue;

        const region = [];
        const queue = [i];
        visited.add(i);
        const basePlane = faceData[i].plane;

        while (queue.length > 0) {
            const faceIdx = queue.shift();
            region.push(faceIdx);

            adj.get(faceIdx)?.forEach(neighborIdx => {
                if (!visited.has(neighborIdx)) {
                    const neighborPlane = faceData[neighborIdx].plane;
                    if (Math.abs(neighborPlane.normal.dot(basePlane.normal)) > toleranceNormal &&
                        Math.abs(neighborPlane.constant - basePlane.constant) < toleranceDist) {
                        visited.add(neighborIdx);
                        queue.push(neighborIdx);
                    }
                }
            });
        }

        const regionEdgeMap = new Map();
        const regionVertexMap = new Map();
        region.forEach(faceIdx => {
            for (let j = 0; j < 3; j++) {
                const i1 = indexAttr.getX(faceIdx * 3 + j);
                const i2 = indexAttr.getX(faceIdx * 3 + ((j + 1) % 3));
                const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
                regionEdgeMap.set(key, (regionEdgeMap.get(key) || 0) + 1);
                
                if (!regionVertexMap.has(i1)) regionVertexMap.set(i1, new THREE.Vector3().fromBufferAttribute(posAttr, i1));
            }
        });
        
        const boundaryEdges = [];
        regionEdgeMap.forEach((count, key) => {
            if (count === 1) {
                boundaryEdges.push(key.split('_').map(Number));
            }
        });

        if (boundaryEdges.length < 3) {
            // Not a simple polygon, fallback to original triangles for this region
            region.forEach(faceIdx => {
                 for(let j=0; j<3; j++) {
                    const idx = indexAttr.getX(faceIdx * 3 + j);
                    const v = regionVertexMap.get(idx);
                    finalVertices.push(v.x, v.y, v.z);
                 }
                 finalIndices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
                 vertexOffset += 3;
            });
            continue;
        }

        const boundaryChains = [];
        let currentChain = [...boundaryEdges.shift()];
        while(boundaryEdges.length > 0) {
            let found = false;
            for(let k=0; k < boundaryEdges.length; k++) {
                const edge = boundaryEdges[k];
                if(edge[0] === currentChain[currentChain.length - 1]) {
                    currentChain.push(edge[1]);
                    boundaryEdges.splice(k, 1);
                    found = true;
                    break;
                }
                if(edge[1] === currentChain[currentChain.length - 1]) {
                    currentChain.push(edge[0]);
                    boundaryEdges.splice(k, 1);
                    found = true;
                    break;
                }
            }
            if(!found) {
                boundaryChains.push(currentChain);
                if (boundaryEdges.length > 0) {
                    currentChain = [...boundaryEdges.shift()];
                }
            }
        }
        boundaryChains.push(currentChain);

        try {
            const normal = basePlane.normal;
            const basisU = new THREE.Vector3();
            const basisV = new THREE.Vector3();
            if (Math.abs(normal.x) > Math.abs(normal.z)) {
                basisU.set(-normal.y, normal.x, 0).normalize();
            } else {
                basisU.set(0, -normal.z, normal.y).normalize();
            }
            basisV.crossVectors(normal, basisU);
            
            const shapes = boundaryChains.map(chain => {
                const shapePoints = chain.map(idx => {
                    const v3d = regionVertexMap.get(idx);
                    return new THREE.Vector2(v3d.dot(basisU), v3d.dot(basisV));
                });
                return new THREE.Shape(shapePoints);
            });
            
            const shape = shapes.shift();
            if (shape) {
                shape.holes = shapes;
                const triangulatedGeom = new THREE.ShapeGeometry(shape);
                const tempMesh = new THREE.Mesh(triangulatedGeom);
                const matrix = new THREE.Matrix4().makeBasis(basisU, basisV, normal).setPosition(new THREE.Vector3(0,0,0).projectOnPlane(basePlane));
                tempMesh.geometry.applyMatrix4(matrix);

                const pos = tempMesh.geometry.attributes.position;
                const localIndex = tempMesh.geometry.index;

                for (let k = 0; k < pos.count; k++) {
                    const v = new THREE.Vector3().fromBufferAttribute(pos, k);
                    finalVertices.push(v.x, v.y, v.z);
                }
                for (let k = 0; k < localIndex.count; k++) {
                    finalIndices.push(vertexOffset + localIndex.getX(k));
                }
                vertexOffset += pos.count;
            }
        } catch (e) {
             console.warn("Triangulation failed, falling back for region:", e);
             // Fallback
             region.forEach(faceIdx => {
                for(let j=0; j<3; j++) {
                   const idx = indexAttr.getX(faceIdx * 3 + j);
                   const v = regionVertexMap.get(idx);
                   finalVertices.push(v.x, v.y, v.z);
                }
                finalIndices.push(vertexOffset, vertexOffset + 1, vertexOffset + 2);
                vertexOffset += 3;
           });
        }
    }

    const mergedGeom = new THREE.BufferGeometry();
    mergedGeom.setAttribute('position', new THREE.Float32BufferAttribute(finalVertices, 3));
    mergedGeom.setIndex(finalIndices);
    mergedGeom.computeVertexNormals();
    return mergedGeom;
}


/**
 * Clean up CSG-generated geometry:
 * - applyMatrix4 should be done *before* calling this
 * - converts to non-indexed, welds vertices by tolerance, removes degenerate triangles,
 * rebuilds indexed geometry, merges vertices, computes normals/bounds
  * - NEW: Merges co-planar faces for a cleaner result.
 *
 * @param {THREE.BufferGeometry} geom - geometry already in target-local space
 * @param {number} tolerance - welding tolerance in world units (e.g. 1e-3)
 * @returns {THREE.BufferGeometry} cleaned geometry (indexed)
 */
export function cleanCSGGeometry(geom, tolerance = 1e-2) {
  if (!geom.attributes.position) {
    console.warn('cleanCSGGeometry: geometry has no position attribute');
    return geom;
  }

  console.log(`🎯 Starting CSG geometry cleanup with tolerance: ${tolerance}`);
  const originalVertexCount = geom.attributes.position.count;
  const originalTriangleCount = geom.index ? geom.index.count / 3 : originalVertexCount / 3;

  const geomClone = geom.clone();
  geomClone.deleteAttribute('normal');
  geomClone.deleteAttribute('uv');
  geomClone.deleteAttribute('color');
  console.log('🎯 Removed normal, uv, and color attributes for clean merging.');

  let nonIndexed = geomClone.index ? geomClone.toNonIndexed() : geomClone;
  if (geomClone !== nonIndexed) {
      geomClone.dispose();
  }

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
    newIndices.push(...triIndices);
  }
  console.log(`🎯 Removed ${degenerateCount} degenerate triangles`);

  const cleaned = new THREE.BufferGeometry();
  cleaned.setAttribute('position', new THREE.BufferAttribute(new Float32Array(uniqueVerts), 3));
  cleaned.setIndex(newIndices);

  let merged;
  try {
    merged = BufferGeometryUtils.mergeVertices(cleaned, tolerance);
  } catch (err) {
    console.warn('BufferGeometryUtils.mergeVertices failed, using cleaned geometry:', err);
    merged = cleaned;
  }
  
  // --- YENİ: Yüzey birleştirme adımı ---
  console.log('✨ Applying advanced co-planar face merging...');
  let finalGeometry;
  try {
      finalGeometry = mergeCoplanarFaces(merged);
      console.log('✅ Co-planar face merging completed.');
  } catch (e) {
      console.error("❌ Co-planar face merging failed, using vertex-merged geometry.", e);
      finalGeometry = merged;
  }
  
  // Re-run merge vertices as a final cleanup step on the new geometry
  try {
    finalGeometry = BufferGeometryUtils.mergeVertices(finalGeometry, tolerance);
  } catch (err) {
    console.warn('Final mergeVertices pass failed:', err);
  }

  finalGeometry.computeVertexNormals();
  finalGeometry.computeBoundingBox();
  finalGeometry.computeBoundingSphere();

  const finalVertexCount = finalGeometry.attributes.position.count;
  const finalTriangleCount = finalGeometry.index ? finalGeometry.index.count / 3 : finalVertexCount / 3;

  console.log(`🎯 CSG cleanup complete:`, {
    originalVertices: originalVertexCount,
    finalVertices: finalVertexCount,
    originalTriangles: originalTriangleCount.toFixed(0),
    finalTriangles: finalTriangleCount.toFixed(0),
    degenerateRemoved: degenerateCount,
    vertexReduction: `${(((originalVertexCount - finalVertexCount) / originalVertexCount) * 100).toFixed(1)}%`
  });

  return finalGeometry;
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
