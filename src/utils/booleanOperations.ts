import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * A more robust method to clean and weld vertices using quantization.
 * This function replaces the previous implementation.
 * @param {THREE.BufferGeometry} geom - The geometry to clean.
 * @param {number} tolerance - The quantization tolerance.
 * @returns {THREE.BufferGeometry} The cleaned and rebuilt geometry.
 */
export function cleanCSGGeometry(geom, tolerance = 1e-4) { // Using a smaller default tolerance for precision
    if (!geom.attributes.position) {
        console.warn('cleanCSGGeometry: geometry has no position attribute.');
        return geom;
    }

    console.log(`🎯 Starting ROBUST CSG geometry cleanup with tolerance: ${tolerance}`);
    const originalVertexCount = geom.attributes.position.count;
    const originalTriangleCount = geom.index ? geom.index.count / 3 : originalVertexCount / 3;

    // --- Öznitelikleri kaldırarak sadece pozisyona odaklan ---
    const geomClone = geom.clone();
    geomClone.deleteAttribute('normal');
    geomClone.deleteAttribute('uv');
    geomClone.deleteAttribute('color');
    console.log('🎯 Removed normal, uv, and color attributes for clean merging.');

    // --- Geometriyi non-indexed hale getirerek üçgenleri garantile ---
    const nonIndexed = geomClone.index ? geomClone.toNonIndexed() : geomClone;
    if (geomClone !== nonIndexed) {
        geomClone.dispose();
    }
    
    if (!nonIndexed || !nonIndexed.attributes.position || !nonIndexed.attributes.position.array) {
        console.error("cleanCSGGeometry: Geometry is invalid after preparation.");
        return new THREE.BufferGeometry();
    }

    // --- Vertex'leri quantize et ve hash tablosu ile tekilleştir ---
    const pos = nonIndexed.attributes.position.array;
    const map = new Map();
    const newVerts = [];
    const newIndices = [];
    let degenerateCount = 0;

    const triCount = pos.length / 9;
    for (let i = 0; i < triCount; i++) {
        const triVtxIndices = [];
        for (let j = 0; j < 3; j++) {
            const offset = i * 9 + j * 3;
            const x = Math.round(pos[offset] / tolerance) * tolerance;
            const y = Math.round(pos[offset + 1] / tolerance) * tolerance;
            const z = Math.round(pos[offset + 2] / tolerance) * tolerance;
            const key = `${x},${y},${z}`;

            if (!map.has(key)) {
                map.set(key, newVerts.length / 3);
                newVerts.push(x, y, z);
            }
            triVtxIndices.push(map.get(key));
        }

        // Dejenere üçgenleri (aynı indekse sahip köşeleri olan) atla
        if (triVtxIndices[0] === triVtxIndices[1] || triVtxIndices[1] === triVtxIndices[2] || triVtxIndices[0] === triVtxIndices[2]) {
            degenerateCount++;
            continue;
        }

        newIndices.push(...triVtxIndices);
    }
    
    nonIndexed.dispose();

    console.log(`🎯 Removed ${degenerateCount} degenerate triangles during quantization.`);

    // --- Yeni, temiz geometriyi oluştur ---
    const newGeo = new THREE.BufferGeometry();
    newGeo.setAttribute('position', new THREE.Float32BufferAttribute(newVerts, 3));
    newGeo.setIndex(newIndices);

    // --- Son adımlar ---
    newGeo.computeVertexNormals();
    newGeo.computeBoundingBox();
    newGeo.computeBoundingSphere();

    const finalVertexCount = newGeo.attributes.position.count;
    const finalTriangleCount = newGeo.index ? newGeo.index.count / 3 : 0;

    console.log(`🎯 CSG cleanup complete:`, {
        originalVertices: originalVertexCount,
        finalVertices: finalVertexCount,
        originalTriangles: originalTriangleCount.toFixed(0),
        finalTriangles: finalTriangleCount.toFixed(0),
        degenerateRemoved: degenerateCount,
        vertexReduction: `${originalVertexCount > 0 ? (((originalVertexCount - finalVertexCount) / originalVertexCount) * 100).toFixed(1) : 0}%`
    });

    return newGeo;
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
  const originalGeom = shape.geometry.clone();

  // --- YENİ: CSG öncesi ön temizleme ---
  console.log(`✨ Pre-cleaning geometry for brush (Shape ID: ${shape.id})`);
  const preCleanedGeom = cleanCSGGeometry(originalGeom, 1e-4); // Use a fine tolerance for pre-cleaning
  originalGeom.dispose(); // Dispose of the clone

  const brush = new Brush(preCleanedGeom);
  
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

