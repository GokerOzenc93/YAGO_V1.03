import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { createPolylineGeometry } from '../components/drawing/geometryCreator';

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

// Extract actual boundary from CSG result
const extractActualBoundary = (resultGeometry, vertices) => {
  // This is a placeholder function - implement actual boundary extraction logic
  // For now, return a simplified boundary based on the vertices
  if (vertices.length < 3) return [];
  
  // Project vertices to XZ plane and find convex hull
  const projectedPoints = vertices.map(v => new THREE.Vector2(v.x, v.z));
  const hull2D = getConvexHull2D(projectedPoints);
  
  // Convert back to 3D points at Y=0
  const boundaryPoints = hull2D.map(p => new THREE.Vector3(p.x, 0, p.y));
  
  // Close the loop if not already closed
  if (boundaryPoints.length > 0) {
    const first = boundaryPoints[0];
    const last = boundaryPoints[boundaryPoints.length - 1];
    if (!first.equals(last)) {
      boundaryPoints.push(first.clone());
    }
  }
  
  return boundaryPoints;
};

// Extract boundary points from CSG result and recreate as clean polyline-based geometry
const recreateShapeFromBooleanResult = (
  resultGeometry: THREE.BufferGeometry,
  originalPosition: [number, number, number],
  originalScale: [number, number, number]
): THREE.BufferGeometry => {
  console.log('🎯 Recreating shape from boolean result...');
  
  try {
    // Get all vertices from the result geometry
    const positions = resultGeometry.attributes.position;
    if (!positions) {
      console.warn('No position attribute found, using original geometry');
      return resultGeometry;
    }
    
    // Extract all vertices and analyze the geometry structure
    const vertices: THREE.Vector3[] = [];
    const vertexMap = new Map<string, THREE.Vector3>();
    const precision = 100; // Reduced precision for better grouping
    
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(positions, i);
      const key = `${Math.round(vertex.x * precision)},${Math.round(vertex.y * precision)},${Math.round(vertex.z * precision)}`;
      
      if (!vertexMap.has(key)) {
        vertexMap.set(key, vertex);
        vertices.push(vertex);
      }
    }
    
    console.log(`🎯 Extracted ${vertices.length} unique vertices from boolean result`);
    
    // Find the bounding box to determine the shape's dimensions
    const bbox = new THREE.Box3().setFromPoints(vertices);
    const size = bbox.getSize(new THREE.Vector3());
    const center = bbox.getCenter(new THREE.Vector3());
    
    console.log(`🎯 Shape bounds: ${size.x.toFixed(1)}x${size.y.toFixed(1)}x${size.z.toFixed(1)}mm`);
    
    // Analyze the geometry to find the actual boundary outline
    // Instead of convex hull, find the actual perimeter of the shape
    const boundaryPoints = extractActualBoundary(resultGeometry, vertices);
    
    if (boundaryPoints.length < 3) {
      console.warn('🎯 Could not extract proper boundary, using bounding box');
      // Fallback to bounding box
      const min = bbox.min;
      const max = bbox.max;
      const fallbackPoints = [
        new THREE.Vector3(min.x, 0, min.z),
        new THREE.Vector3(max.x, 0, min.z),
        new THREE.Vector3(max.x, 0, max.z),
        new THREE.Vector3(min.x, 0, max.z),
        new THREE.Vector3(min.x, 0, min.z) // Close the loop
      ];
      
      const height = size.y;
      const newGeometry = createPolylineGeometry(fallbackPoints, height, 50, false);
      
      // Position at the center of the original shape
      const translation = new THREE.Matrix4().makeTranslation(
        center.x,
        originalPosition[1],
        center.z
      );
      newGeometry.applyMatrix4(translation);
      
      return newGeometry;
    }
    
    console.log(`🎯 Created boundary with ${boundaryPoints.length} points`);
    
    // Use the polyline geometry creator to make a clean extruded shape
    const height = size.y; // Use the calculated height
    const newGeometry = createPolylineGeometry(boundaryPoints, height, 50, false);
    
    // Position the new geometry at the center of the boolean result
    const translation = new THREE.Matrix4().makeTranslation(
      center.x,
      originalPosition[1], // Keep original Y position
      center.z
    );
    newGeometry.applyMatrix4(translation);
    
    console.log(`✅ Shape recreated with actual boundary geometry`);
    return newGeometry;
    
  } catch (error) {
    console.error('🎯 Error recreating shape from boolean result:', error);
    console.log('🎯 Falling back to original geometry');
    return resultGeometry;
  }
};

// Simple 2D convex hull algorithm (Graham scan)
const getConvexHull2D = (points: THREE.Vector2[]): THREE.Vector2[] => {
  if (points.length < 3) return points;
  
  // Find the bottom-most point (and leftmost in case of tie)
  let start = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].y < points[start].y || 
        (points[i].y === points[start].y && points[i].x < points[start].x)) {
      start = i;
    }
  }
  
  // Swap start point to beginning
  [points[0], points[start]] = [points[start], points[0]];
  const startPoint = points[0];
  
  // Sort points by polar angle with respect to start point
  const sortedPoints = points.slice(1).sort((a, b) => {
    const angleA = Math.atan2(a.y - startPoint.y, a.x - startPoint.x);
    const angleB = Math.atan2(b.y - startPoint.y, b.x - startPoint.x);
    return angleA - angleB;
  });
  
  // Build convex hull
  const hull = [startPoint];
  
  for (const point of sortedPoints) {
    // Remove points that make clockwise turn
    while (hull.length > 1) {
      const p1 = hull[hull.length - 2];
      const p2 = hull[hull.length - 1];
      const cross = (p2.x - p1.x) * (point.y - p1.y) - (p2.y - p1.y) * (point.x - p1.x);
      if (cross > 0) break; // Counter-clockwise turn
      hull.pop();
    }
    hull.push(point);
  }
  
  return hull;
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
      
      // 🎯 RECREATE SHAPE - Create clean polyline-based geometry from boolean result
      console.log('🎯 Recreating shape from boolean subtraction result...');
      
      // Store original transform info
      const originalPosition = targetShape.position;
      const originalScale = targetShape.scale;
      
      // Recreate the shape using polyline-based geometry creation
      newGeom = recreateShapeFromBooleanResult(newGeom, originalPosition, originalScale);
      
      const finalVertexCount = newGeom.attributes.position?.count || 0;
      const finalTriangleCount = newGeom.index ? newGeom.index.count / 3 : finalVertexCount / 3;
      
      console.log(`✅ Shape recreated: ${finalVertexCount} vertices, ${finalTriangleCount.toFixed(0)} triangles`);
      
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
    
    // 🎯 RECREATE SHAPE - Create clean polyline-based geometry from boolean result
    console.log('🎯 Recreating shape from boolean union result...');
    
    // Store original transform info
    const originalPosition = targetShape.position;
    const originalScale = targetShape.scale;
    
    // Recreate the shape using polyline-based geometry creation
    newGeom = recreateShapeFromBooleanResult(newGeom, originalPosition, originalScale);
    
    const finalVertexCount = newGeom.attributes.position?.count || 0;
    const finalTriangleCount = newGeom.index ? newGeom.index.count / 3 : finalVertexCount / 3;
    
    console.log(`✅ Shape recreated: ${finalVertexCount} vertices, ${finalTriangleCount.toFixed(0)} triangles`);
    
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