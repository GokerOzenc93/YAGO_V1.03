import * as THREE from 'three';
import earcut from 'earcut';
import * as martinez from 'martinez-polygon-clipping';

// Tolerances for planar face grouping
const NORMAL_EPSILON = 1e-3; // ~0.06 degrees
const PLANE_EPSILON = 1e-2;  // 10mm plane distance tolerance
const VERTEX_EPSILON = 1e-3; // 1mm vertex welding tolerance

export interface PlanarGroup {
  id: string;
  triangles: number[];
  normal: THREE.Vector3;
  plane: THREE.Plane;
  boundingBox: THREE.Box3;
  area: number;
  vertices: THREE.Vector3[];
  polygon: THREE.Vector2[][];
}

/**
 * Get face normal from triangle vertices
 */
const getFaceNormal = (v1: THREE.Vector3, v2: THREE.Vector3, v3: THREE.Vector3): THREE.Vector3 => {
  const edge1 = new THREE.Vector3().subVectors(v2, v1);
  const edge2 = new THREE.Vector3().subVectors(v3, v1);
  return new THREE.Vector3().crossVectors(edge1, edge2).normalize();
};

/**
 * Get triangle vertices from geometry
 */
const getTriangleVertices = (
  geometry: THREE.BufferGeometry, 
  triangleIndex: number,
  worldMatrix: THREE.Matrix4
): THREE.Vector3[] => {
  const position = geometry.attributes.position;
  const index = geometry.index;
  
  const vertices: THREE.Vector3[] = [];
  
  if (index) {
    // Indexed geometry
    for (let i = 0; i < 3; i++) {
      const vertexIndex = index.getX(triangleIndex * 3 + i);
      const vertex = new THREE.Vector3().fromBufferAttribute(position, vertexIndex);
      vertex.applyMatrix4(worldMatrix);
      vertices.push(vertex);
    }
  } else {
    // Non-indexed geometry
    for (let i = 0; i < 3; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(position, triangleIndex * 3 + i);
      vertex.applyMatrix4(worldMatrix);
      vertices.push(vertex);
    }
  }
  
  return vertices;
};

/**
 * Check if two normals are coplanar (same or opposite direction)
 */
const areNormalsCoplanar = (normal1: THREE.Vector3, normal2: THREE.Vector3): boolean => {
  const angle = Math.min(
    normal1.angleTo(normal2),
    normal1.angleTo(normal2.clone().negate())
  );
  return angle < NORMAL_EPSILON;
};

/**
 * Check if vertices are coplanar with given plane
 */
const areVerticesCoplanar = (vertices: THREE.Vector3[], plane: THREE.Plane): boolean => {
  return vertices.every(vertex => Math.abs(plane.distanceToPoint(vertex)) < PLANE_EPSILON);
};

/**
 * Weld vertices that are very close together
 */
const weldVertices = (vertices: THREE.Vector3[]): { 
  weldedVertices: THREE.Vector3[], 
  indexMap: Map<number, number> 
} => {
  const weldedVertices: THREE.Vector3[] = [];
  const indexMap = new Map<number, number>();
  
  vertices.forEach((vertex, originalIndex) => {
    // Find existing welded vertex
    let weldedIndex = -1;
    for (let i = 0; i < weldedVertices.length; i++) {
      if (vertex.distanceTo(weldedVertices[i]) < VERTEX_EPSILON) {
        weldedIndex = i;
        break;
      }
    }
    
    if (weldedIndex === -1) {
      // Add new welded vertex
      weldedIndex = weldedVertices.length;
      weldedVertices.push(vertex.clone());
    }
    
    indexMap.set(originalIndex, weldedIndex);
  });
  
  return { weldedVertices, indexMap };
};

/**
 * Convert 3D vertices to 2D polygon coordinates
 */
const projectTo2D = (vertices: THREE.Vector3[], normal: THREE.Vector3): THREE.Vector2[] => {
  // Create orthonormal basis
  const up = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();
  
  // Project vertices to 2D
  return vertices.map(vertex => {
    const x = vertex.dot(tangent);
    const y = vertex.dot(bitangent);
    return new THREE.Vector2(x, y);
  });
};

/**
 * Create polygon from triangulated faces using martinez clipping
 */
const createPolygonFromTriangles = (
  triangles: number[],
  geometry: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4,
  normal: THREE.Vector3
): THREE.Vector2[][] => {
  console.log(`🔧 Creating polygon from ${triangles.length} triangles`);
  
  // Collect all vertices from triangles
  const allVertices: THREE.Vector3[] = [];
  triangles.forEach(triangleIndex => {
    const vertices = getTriangleVertices(geometry, triangleIndex, worldMatrix);
    allVertices.push(...vertices);
  });
  
  // Validate that we have vertices
  if (allVertices.length === 0) {
    console.warn('No vertices found for triangles');
    return [];
  }

  // Weld close vertices
  const { weldedVertices, indexMap } = weldVertices(allVertices);
  
  // Validate welded vertices
  if (weldedVertices.length === 0) {
    console.warn('No welded vertices found');
    return [];
  }
  
  // Project to 2D
  const weldedVertices2D = projectTo2D(weldedVertices, normal);
  
  // Validate 2D projection
  if (weldedVertices2D.length === 0) {
    console.warn('No 2D vertices found after projection');
    return [];
  }
  
  // Create individual triangle polygons
  const trianglePolygons: number[][][] = [];
  
  for (let i = 0; i < triangles.length; i++) {
    // Get original vertex indices for this triangle
    const originalIdx0 = i * 3;
    const originalIdx1 = i * 3 + 1;
    const originalIdx2 = i * 3 + 2;
    
    // Map to welded vertex indices
    const weldedIdx0 = indexMap.get(originalIdx0);
    const weldedIdx1 = indexMap.get(originalIdx1);
    const weldedIdx2 = indexMap.get(originalIdx2);
    
    // Validate mapped indices
    if (weldedIdx0 === undefined || weldedIdx1 === undefined || weldedIdx2 === undefined) {
      console.warn(`Invalid welded indices for triangle ${i}: ${weldedIdx0}, ${weldedIdx1}, ${weldedIdx2}`);
      continue;
    }
    
    // Get 2D points
    const p0 = weldedVertices2D[weldedIdx0];
    const p1 = weldedVertices2D[weldedIdx1];
    const p2 = weldedVertices2D[weldedIdx2];
    
    // Validate 2D points
    if (!p0 || !p1 || !p2) {
      console.warn(`Invalid 2D points for triangle ${i}: ${p0}, ${p1}, ${p2}`);
      continue;
    }
    
    // Create triangle polygon
    const triangle2D = [
      [p0.x, p0.y],
      [p1.x, p1.y],
      [p2.x, p2.y],
      [p0.x, p0.y] // Close the polygon
    ];
    trianglePolygons.push([triangle2D]);
  }
  
  // Validate that we have triangle polygons
  if (trianglePolygons.length === 0) {
    console.warn('No valid triangle polygons created');
    return [];
  }
  
  try {
    // Union all triangles using martinez clipping
    let result = trianglePolygons[0];
    
    for (let i = 1; i < trianglePolygons.length; i++) {
      result = martinez.union(result, trianglePolygons[i]);
    }
    
    // Convert result to THREE.Vector2 format
    const polygons: THREE.Vector2[][] = result.map(ring => 
      ring.map(coord => new THREE.Vector2(coord[0], coord[1]))
    );
    
    console.log(`✅ Polygon created with ${polygons.length} rings`);
    return polygons;
    
  } catch (error) {
    console.warn('Martinez clipping failed, using convex hull fallback:', error);
    
    // Fallback: Create simple convex hull
    const hull = createConvexHull2D(weldedVertices2D);
    return [hull];
  }
};

/**
 * Create convex hull from 2D points (fallback method)
 */
const createConvexHull2D = (points: THREE.Vector2[]): THREE.Vector2[] => {
  if (points.length < 3) return points;
  
  // Simple gift wrapping algorithm
  const hull: THREE.Vector2[] = [];
  
  // Find leftmost point
  let leftmost = 0;
  for (let i = 1; i < points.length; i++) {
    if (points[i].x < points[leftmost].x) {
      leftmost = i;
    }
  }
  
  let current = leftmost;
  do {
    hull.push(points[current].clone());
    let next = (current + 1) % points.length;
    
    for (let i = 0; i < points.length; i++) {
      const cross = (points[next].x - points[current].x) * (points[i].y - points[current].y) -
                   (points[next].y - points[current].y) * (points[i].x - points[current].x);
      if (cross > 0) {
        next = i;
      }
    }
    
    current = next;
  } while (current !== leftmost);
  
  return hull;
};

/**
 * Group coplanar faces using advanced algorithms
 */
export const groupPlanarFaces = (
  geometry: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4
): PlanarGroup[] => {
  console.log('🎯 Starting advanced planar face grouping...');
  
  const triangleCount = geometry.index ? 
    geometry.index.count / 3 : 
    geometry.attributes.position.count / 3;
  
  console.log(`📊 Processing ${triangleCount} triangles`);
  
  const groups: PlanarGroup[] = [];
  const processedTriangles = new Set<number>();
  
  // Process each triangle
  for (let i = 0; i < triangleCount; i++) {
    if (processedTriangles.has(i)) continue;
    
    const vertices = getTriangleVertices(geometry, i, worldMatrix);
    const normal = getFaceNormal(vertices[0], vertices[1], vertices[2]);
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, vertices[0]);
    
    // Find all coplanar triangles
    const coplanarTriangles: number[] = [i];
    processedTriangles.add(i);
    
    for (let j = i + 1; j < triangleCount; j++) {
      if (processedTriangles.has(j)) continue;
      
      const otherVertices = getTriangleVertices(geometry, j, worldMatrix);
      const otherNormal = getFaceNormal(otherVertices[0], otherVertices[1], otherVertices[2]);
      
      // Check if coplanar
      if (areNormalsCoplanar(normal, otherNormal) && 
          areVerticesCoplanar(otherVertices, plane)) {
        coplanarTriangles.push(j);
        processedTriangles.add(j);
      }
    }
    
    console.log(`🔍 Found ${coplanarTriangles.length} coplanar triangles for group ${groups.length + 1}`);
    
    // Create polygon from coplanar triangles
    const polygon = createPolygonFromTriangles(coplanarTriangles, geometry, worldMatrix, normal);
    
    // Collect all vertices for bounding box
    const allVertices: THREE.Vector3[] = [];
    coplanarTriangles.forEach(triangleIndex => {
      const triangleVertices = getTriangleVertices(geometry, triangleIndex, worldMatrix);
      allVertices.push(...triangleVertices);
    });
    
    // Calculate bounding box
    const boundingBox = new THREE.Box3().setFromPoints(allVertices);
    
    // Calculate area (approximate)
    const area = polygon.reduce((total, ring) => {
      let ringArea = 0;
      for (let k = 0; k < ring.length - 1; k++) {
        const curr = ring[k];
        const next = ring[k + 1];
        ringArea += curr.x * next.y - next.x * curr.y;
      }
      return total + Math.abs(ringArea) / 2;
    }, 0);
    
    // Create planar group
    const group: PlanarGroup = {
      id: `planar_group_${groups.length + 1}`,
      triangles: coplanarTriangles,
      normal: normal.clone(),
      plane: plane.clone(),
      boundingBox,
      area,
      vertices: allVertices,
      polygon
    };
    
    groups.push(group);
  }
  
  console.log(`✅ Planar face grouping complete: ${groups.length} groups created`);
  
  // Sort groups by area (largest first)
  groups.sort((a, b) => b.area - a.area);
  
  return groups;
};

/**
 * Find planar group containing specific triangle
 */
export const findPlanarGroupByTriangle = (
  groups: PlanarGroup[],
  triangleIndex: number
): PlanarGroup | null => {
  return groups.find(group => group.triangles.includes(triangleIndex)) || null;
};

/**
 * Create highlight mesh from planar group
 */
export const createPlanarGroupHighlight = (
  group: PlanarGroup,
  color: number = 0xff6b35,
  opacity: number = 0.6
): THREE.Mesh => {
  console.log(`🎨 Creating highlight for planar group with ${group.triangles.length} triangles`);
  
  // Use earcut to triangulate the polygon
  const outerRing = group.polygon[0];
  const holes = group.polygon.slice(1);
  
  // Flatten coordinates for earcut
  const coords: number[] = [];
  const holeIndices: number[] = [];
  
  // Add outer ring
  outerRing.forEach(point => {
    coords.push(point.x, point.y);
  });
  
  // Add holes
  holes.forEach(hole => {
    holeIndices.push(coords.length / 2);
    hole.forEach(point => {
      coords.push(point.x, point.y);
    });
  });
  
  // Triangulate using earcut
  const triangles = earcut(coords, holeIndices);
  
  // Convert back to 3D
  const up = Math.abs(group.normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3().crossVectors(up, group.normal).normalize();
  const bitangent = new THREE.Vector3().crossVectors(group.normal, tangent).normalize();
  
  // Get a reference point on the plane
  const planePoint = group.vertices[0];
  
  const vertices3D: number[] = [];
  for (let i = 0; i < coords.length; i += 2) {
    const x = coords[i];
    const y = coords[i + 1];
    
    // Convert 2D to 3D
    const vertex3D = planePoint.clone()
      .addScaledVector(tangent, x)
      .addScaledVector(bitangent, y)
      .addScaledVector(group.normal, 0.1); // Slight offset for visibility
    
    vertices3D.push(vertex3D.x, vertex3D.y, vertex3D.z);
  }
  
  // Create geometry
  const geometry = new THREE.BufferGeometry();
  
  // Validate vertices before creating geometry
  const validVertices = [];
  for (let i = 0; i < vertices3D.length; i += 3) {
    const x = vertices3D[i];
    const y = vertices3D[i + 1];
    const z = vertices3D[i + 2];
    
    if (isNaN(x) || isNaN(y) || isNaN(z) || 
        !isFinite(x) || !isFinite(y) || !isFinite(z)) {
      console.warn('🎯 Skipping invalid vertex with NaN/Infinite values:', [x, y, z]);
      continue;
    }
    
    validVertices.push(x, y, z);
  }
  
  // Check if we have enough valid vertices
  if (validVertices.length < 9) { // Need at least 3 vertices (9 components)
    console.warn('🎯 Not enough valid vertices for geometry creation');
    return new THREE.Mesh(new THREE.BufferGeometry()); // Return empty geometry
  }
  
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(validVertices, 3));
  geometry.setIndex(triangles);
  
  // Validate geometry before computing bounds
  const posAttr = geometry.attributes.position;
  if (!posAttr || !posAttr.array || posAttr.array.length === 0) {
    console.warn('🎯 Invalid position attribute, returning empty geometry');
    return new THREE.Mesh(new THREE.BufferGeometry());
  }
  
  geometry.computeVertexNormals();
  
  // Safe bounding computation with error handling
  try {
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
  } catch (error) {
    console.warn('🎯 Failed to compute bounds, geometry may have invalid data:', error);
    return new THREE.Mesh(new THREE.BufferGeometry()); // Return empty geometry on error
  }
  
  // Create material
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    side: THREE.DoubleSide,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = 999;
  
  console.log(`✅ Planar group highlight created with ${triangles.length / 3} triangles`);
  
  return mesh;
};