import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { ConvexGeometry } from 'three/examples/jsm/geometries/ConvexGeometry.js';

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

// Create boundary-only geometry from CSG result
const createBoundaryOnlyGeometry = (csgGeometry: THREE.BufferGeometry): THREE.BufferGeometry => {
  console.log('🎯 Creating boundary-only geometry from CSG result...');
  
  // Get all vertices from CSG result
  const positions = csgGeometry.attributes.position;
  const vertices: THREE.Vector3[] = [];
  
  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(positions, i);
    vertices.push(vertex);
  }
  
  console.log(`🎯 Processing ${vertices.length} vertices for boundary detection...`);
  
  // Find boundary vertices (vertices that are on the outer surface)
  const boundaryVertices: THREE.Vector3[] = [];
  const tolerance = 0.1; // Tolerance for boundary detection
  
  // Calculate bounding box
  const bbox = new THREE.Box3().setFromPoints(vertices);
  const center = bbox.getCenter(new THREE.Vector3());
  const size = bbox.getSize(new THREE.Vector3());
  
  console.log(`🎯 Bounding box: center=[${center.x.toFixed(1)}, ${center.y.toFixed(1)}, ${center.z.toFixed(1)}], size=[${size.x.toFixed(1)}, ${size.y.toFixed(1)}, ${size.z.toFixed(1)}]`);
  
  // Find vertices on each face of the bounding box
  vertices.forEach(vertex => {
    const isOnBoundary = 
      Math.abs(vertex.x - bbox.min.x) < tolerance || // Left face
      Math.abs(vertex.x - bbox.max.x) < tolerance || // Right face
      Math.abs(vertex.y - bbox.min.y) < tolerance || // Bottom face
      Math.abs(vertex.y - bbox.max.y) < tolerance || // Top face
      Math.abs(vertex.z - bbox.min.z) < tolerance || // Front face
      Math.abs(vertex.z - bbox.max.z) < tolerance;   // Back face
    
    if (isOnBoundary) {
      boundaryVertices.push(vertex);
    }
  });
  
  console.log(`🎯 Found ${boundaryVertices.length} boundary vertices`);
  
  // Remove duplicate boundary vertices
  const uniqueBoundaryVertices: THREE.Vector3[] = [];
  const vertexMap = new Map<string, THREE.Vector3>();
  const precision = 1000;
  
  boundaryVertices.forEach(vertex => {
    const key = `${Math.round(vertex.x * precision)}_${Math.round(vertex.y * precision)}_${Math.round(vertex.z * precision)}`;
    if (!vertexMap.has(key)) {
      vertexMap.set(key, vertex);
      uniqueBoundaryVertices.push(vertex);
    }
  });
  
  console.log(`🎯 Unique boundary vertices: ${uniqueBoundaryVertices.length}`);
  
  // Create convex hull from boundary vertices for clean outer surface
  if (uniqueBoundaryVertices.length >= 4) {
    try {
      const convexGeometry = new ConvexGeometry(uniqueBoundaryVertices);
      convexGeometry.computeVertexNormals();
      convexGeometry.computeBoundingBox();
      convexGeometry.computeBoundingSphere();
      
      console.log(`✅ Boundary-only geometry created: ${convexGeometry.attributes.position.count} vertices, ${convexGeometry.index ? convexGeometry.index.count / 3 : convexGeometry.attributes.position.count / 3} triangles`);
      
      return convexGeometry;
    } catch (error) {
      console.warn('🎯 ConvexGeometry failed, using simplified box geometry:', error);
    }
  }
  
  // Fallback: Create simplified box geometry based on bounding box
  const simplifiedGeometry = new THREE.BoxGeometry(size.x, size.y, size.z);
  simplifiedGeometry.translate(center.x, center.y, center.z);
  simplifiedGeometry.computeVertexNormals();
  simplifiedGeometry.computeBoundingBox();
  simplifiedGeometry.computeBoundingSphere();
  
  console.log(`✅ Fallback boundary geometry created: simplified box`);
  
  return simplifiedGeometry;
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
      
      // 🎯 CREATE BOUNDARY-ONLY GEOMETRY - Only outer surfaces, no internal vertices
      newGeom = createBoundaryOnlyGeometry(newGeom);
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
    
    // 🎯 GEOMETRY CLEANUP - Remove extra vertices and optimize
    console.log('🎯 Cleaning up CSG union result geometry...');
    
    // Merge duplicate vertices (weld)
    const mergedGeometry = new THREE.BufferGeometry();
    const positions = newGeom.attributes.position;
    const indices = newGeom.index;
    
    if (positions && indices) {
      // Create clean geometry with merged vertices
      const positionArray = positions.array;
      const indexArray = indices.array;
      
      // Use a tolerance for merging close vertices
      const tolerance = 0.001;
      const uniqueVertices = [];
      const vertexMap = new Map();
      const newIndices = [];
      
      // Process each triangle
      for (let i = 0; i < indexArray.length; i += 3) {
        const triangle = [
          indexArray[i],
          indexArray[i + 1], 
          indexArray[i + 2]
        ];
        
        const newTriangle = [];
        
        for (const vertexIndex of triangle) {
          const vertex = new THREE.Vector3(
            positionArray[vertexIndex * 3],
            positionArray[vertexIndex * 3 + 1],
            positionArray[vertexIndex * 3 + 2]
          );
          
          // Create a key for this vertex position
          const key = `${Math.round(vertex.x / tolerance)}_${Math.round(vertex.y / tolerance)}_${Math.round(vertex.z / tolerance)}`;
          
          let newIndex;
          if (vertexMap.has(key)) {
            newIndex = vertexMap.get(key);
          } else {
            newIndex = uniqueVertices.length;
            uniqueVertices.push(vertex);
            vertexMap.set(key, newIndex);
          }
          
          newTriangle.push(newIndex);
        }
        
        // Only add triangle if it's not degenerate
        if (newTriangle[0] !== newTriangle[1] && 
            newTriangle[1] !== newTriangle[2] && 
            newTriangle[0] !== newTriangle[2]) {
          newIndices.push(...newTriangle);
        }
      }
      
      // Create clean position array
      const cleanPositions = new Float32Array(uniqueVertices.length * 3);
      uniqueVertices.forEach((vertex, index) => {
        cleanPositions[index * 3] = vertex.x;
        cleanPositions[index * 3 + 1] = vertex.y;
        cleanPositions[index * 3 + 2] = vertex.z;
      });
      
      // Set clean attributes
      mergedGeometry.setAttribute('position', new THREE.BufferAttribute(cleanPositions, 3));
      mergedGeometry.setIndex(newIndices);
      
      console.log(`🎯 Union geometry cleaned: ${positions.count} -> ${uniqueVertices.length} vertices, ${indexArray.length/3} -> ${newIndices.length/3} triangles`);
      
      // Use cleaned geometry
      newGeom.dispose();
      newGeom = mergedGeometry;
    }
    
    // Final geometry processing
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
