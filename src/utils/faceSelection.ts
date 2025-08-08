import * as THREE from 'three';
// Assuming 'Shape' type is defined in '../types/shapes'
// import { Shape } from '../types/shapes'; 

// Placeholder for Shape type if not available
// You should ensure your actual Shape type definition is correctly imported or defined.
interface Shape {
  type: 'box' | 'rectangle2d' | 'cylinder' | 'circle2d' | 'polyline2d' | 'polygon2d' | 'polyline3d' | 'polygon3d';
  parameters: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
    [key: string]: any; // Allows for other parameters
  };
  scale: [number, number, number];
  position: [number, number, number];
  rotation: [number, number, number]; // Euler angles
  quaternion?: THREE.Quaternion; // Preferred for rotations
  originalPoints?: THREE.Vector3[]; // For extruded shapes
  geometry: THREE.BufferGeometry; // Reference to the actual THREE.js geometry
}


export interface FaceInfo {
  index: number;
  name: string;
  center: THREE.Vector3;
  normal: THREE.Vector3;
  area: number;
  vertices: THREE.Vector3[];
}

/**
 * Get face information for different shape types
 */
export const getFaceInfo = (shape: Shape): FaceInfo[] => {
  const faces: FaceInfo[] = [];
  
  switch (shape.type) {
    case 'box':
    case 'rectangle2d':
      return getBoxFaces(shape);
    
    case 'cylinder':
    case 'circle2d':
      return getCylinderFaces(shape);
    
    case 'polyline2d':
    case 'polygon2d':
    case 'polyline3d':
    case 'polygon3d':
      return getExtrudedShapeFaces(shape);
    
    default:
      console.warn(`Face selection not implemented for shape type: ${shape.type}`);
      return [];
  }
};

/**
 * Box/Rectangle faces
 */
const getBoxFaces = (shape: Shape): FaceInfo[] => {
  const { width = 500, height = 500, depth = 500 } = shape.parameters;
  const hw = (width * shape.scale[0]) / 2;
  const hh = (height * shape.scale[1]) / 2;
  const hd = (depth * shape.scale[2]) / 2;
  
  return [
    {
      index: 0,
      name: 'Front',
      center: new THREE.Vector3(0, 0, hd),
      normal: new THREE.Vector3(0, 0, 1),
      area: width * height,
      vertices: [
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, hh, hd),
        new THREE.Vector3(-hw, hh, hd)
      ]
    },
    {
      index: 1,
      name: 'Back',
      center: new THREE.Vector3(0, 0, -hd),
      normal: new THREE.Vector3(0, 0, -1),
      area: width * height,
      vertices: [
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(-hw, hh, -hd),
        new THREE.Vector3(hw, hh, -hd)
      ]
    },
    {
      index: 2,
      name: 'Top',
      center: new THREE.Vector3(0, hh, 0),
      normal: new THREE.Vector3(0, 1, 0),
      area: width * depth,
      vertices: [
        new THREE.Vector3(-hw, hh, -hd),
        new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(hw, hh, hd),
        new THREE.Vector3(-hw, hh, hd)
      ]
    },
    {
      index: 3,
      name: 'Bottom',
      center: new THREE.Vector3(0, -hh, 0),
      normal: new THREE.Vector3(0, -1, 0),
      area: width * depth,
      vertices: [
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, -hd)
      ]
    },
    {
      index: 4,
      name: 'Right',
      center: new THREE.Vector3(hw, 0, 0),
      normal: new THREE.Vector3(1, 0, 0),
      area: height * depth,
      vertices: [
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(hw, hh, hd)
      ]
    },
    {
      index: 5,
      name: 'Left',
      center: new THREE.Vector3(-hw, 0, 0),
      normal: new THREE.Vector3(-1, 0, 0),
      area: height * depth,
      vertices: [
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(-hw, hh, hd),
        new THREE.Vector3(-hw, hh, -hd)
      ]
    }
  ];
};

/**
 * Cylinder/Circle faces
 */
const getCylinderFaces = (shape: Shape): FaceInfo[] => {
  const { radius = 250, height = 500 } = shape.parameters;
  const r = radius * Math.max(shape.scale[0], shape.scale[2]);
  const h = height * shape.scale[1];
  const hh = h / 2;
  
  const faces: FaceInfo[] = [
    {
      index: 0,
      name: 'Top',
      center: new THREE.Vector3(0, hh, 0),
      normal: new THREE.Vector3(0, 1, 0),
      area: Math.PI * r * r,
      vertices: []
    },
    {
      index: 1,
      name: 'Bottom',
      center: new THREE.Vector3(0, -hh, 0),
      normal: new THREE.Vector3(0, -1, 0),
      area: Math.PI * r * r,
      vertices: []
    }
  ];
  
  // Add cylindrical surface segments (8 segments)
  const segments = 8;
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2;
    const nextAngle = ((i + 1) / segments) * Math.PI * 2;
    
    const x = Math.cos(angle) * r;
    const z = Math.sin(angle) * r;
    const nextX = Math.cos(nextAngle) * r;
    const nextZ = Math.sin(nextAngle) * r;
    
    faces.push({
      index: i + 2,
      name: `Side ${i + 1}`,
      center: new THREE.Vector3(x, 0, z),
      // Normal points outwards from the center of the cylinder at this segment
      normal: new THREE.Vector3(Math.cos(angle + segmentAngle / 2), 0, Math.sin(angle + segmentAngle / 2)).normalize(),
      area: 2 * Math.PI * r * h / segments,
      vertices: [
        new THREE.Vector3(x, -hh, z),
        new THREE.Vector3(nextX, -hh, nextZ),
        new THREE.Vector3(nextX, hh, nextZ),
        new THREE.Vector3(x, hh, z)
      ]
    });
  }
  
  return faces;
};

/**
 * Extruded shape faces (polyline, polygon)
 */
const getExtrudedShapeFaces = (shape: Shape): FaceInfo[] => {
  const faces: FaceInfo[] = [];
  
  if (!shape.originalPoints || shape.originalPoints.length < 3) {
    console.warn('No original points found for extruded shape, using fallback geometry analysis');
    // Fallback: Analyze the actual geometry
    return getGeometryBasedFaces(shape);
  }
  
  const points = shape.originalPoints;
  const height = shape.parameters.height || 500;
  const hh = (height * shape.scale[1]) / 2;
  
  // Top face
  const topCenter = calculatePolygonCenter(points);
  topCenter.y = hh;
  
  faces.push({
    index: 0,
    name: 'Top',
    center: topCenter,
    normal: new THREE.Vector3(0, 1, 0),
    area: calculatePolygonArea(points),
    vertices: points.map(p => new THREE.Vector3(p.x, hh, p.z))
  });
  
  // Bottom face
  const bottomCenter = topCenter.clone();
  bottomCenter.y = -hh;
  
  faces.push({
    index: 1,
    name: 'Bottom',
    center: bottomCenter,
    normal: new THREE.Vector3(0, -1, 0),
    area: calculatePolygonArea(points),
    vertices: points.map(p => new THREE.Vector3(p.x, -hh, p.z)).reverse()
  });
  
  // Side faces
  const uniquePoints = points.length > 2 && points[points.length - 1].equals(points[0])  
    ? points.slice(0, -1)  
    : points;
  
  for (let i = 0; i < uniquePoints.length; i++) {
    const current = uniquePoints[i];
    const next = uniquePoints[(i + 1) % uniquePoints.length];
    
    const edgeCenter = new THREE.Vector3(
      (current.x + next.x) / 2,
      0,
      (current.z + next.z) / 2
    );
    
    // Calculate normal perpendicular to the edge in the XZ plane
    const edgeVector = new THREE.Vector3().subVectors(next, current);
    const normal = new THREE.Vector3(-edgeVector.z, 0, edgeVector.x).normalize();
    
    const edgeLength = edgeVector.length();
    
    faces.push({
      index: i + 2,
      name: `Side ${i + 1}`,
      center: edgeCenter,
      normal: normal,
      area: edgeLength * height,
      vertices: [
        new THREE.Vector3(current.x, -hh, current.z),
        new THREE.Vector3(next.x, -hh, next.z),
        new THREE.Vector3(next.x, hh, next.z),
        new THREE.Vector3(current.x, hh, current.z)
      ]
    });
  }
  
  return faces;
};

/**
 * Find face at intersection point using raycast data
 * @param intersectionPoint The intersection point in world coordinates.
 * @param intersectionNormal The normal at the intersection point in world coordinates.
 * @param shape The shape object.
 * @param raycastIntersection (Optional) The full THREE.Intersection object from the raycast.
 * @returns The index of the matched face, or null if no good match is found.
 */
export const findFaceAtIntersection = (
  intersectionPoint: THREE.Vector3, 
  intersectionNormal: THREE.Vector3,
  shape: Shape,
  raycastIntersection?: THREE.Intersection // Mark as optional
): number | null => {
  const faces = getFaceInfo(shape);
  if (faces.length === 0) return null;
  
  const shapePosition = new THREE.Vector3(...shape.position);
  const worldPoint = intersectionPoint.clone();
  
  // Ensure shape.quaternion is available or convert from Euler angles
  const shapeQuaternion = shape.quaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation));

  // Transform world intersection normal to shape's local space
  const localIntersectionNormal = intersectionNormal.clone().applyQuaternion(shapeQuaternion.clone().invert()).normalize();

  // Transform world intersection point to shape's local space
  // This is crucial for comparing with face.center which is in local space
  const localPoint = worldPoint.clone().sub(shapePosition).applyQuaternion(shapeQuaternion.clone().invert());
  
  console.log(`🎯 Finding face at intersection for ${shape.type}:`);
  console.log(`🎯 Intersection point (world): [${intersectionPoint.x.toFixed(1)}, ${intersectionPoint.y.toFixed(1)}, ${intersectionPoint.z.toFixed(1)}]`);
  console.log(`🎯 Intersection normal (world): [${intersectionNormal.x.toFixed(2)}, ${intersectionNormal.y.toFixed(2)}, ${intersectionNormal.z.toFixed(2)}]`);
  console.log(`🎯 Local intersection point: [${localPoint.x.toFixed(1)}, ${localPoint.y.toFixed(1)}, ${localPoint.z.toFixed(1)}]`);
  console.log(`🎯 Local intersection normal: [${localIntersectionNormal.x.toFixed(2)}, ${localIntersectionNormal.y.toFixed(2)}, ${localIntersectionNormal.z.toFixed(2)}]`);
  console.log(`🎯 Shape position: [${shapePosition.x.toFixed(1)}, ${shapePosition.y.toFixed(1)}, ${shapePosition.z.toFixed(1)}]`);
  console.log(`🎯 Available faces: ${faces.length} faces for ${shape.type}`);
  console.log(`🎯 Face names: ${faces.map(f => f.name).join(', ')}`);

  // Prioritize direct raycast face normal if available and a good match
  // This assumes raycastIntersection.face.normal is in the object's local space
  if (raycastIntersection && raycastIntersection.face) {
    const raycastFaceNormal = raycastIntersection.face.normal; 
    
    const directFaceMatches = faces.map(face => {
      const similarity = Math.abs(raycastFaceNormal.dot(face.normal));
      return { index: face.index, name: face.name, similarity: similarity };
    }).sort((a, b) => b.similarity - a.similarity);

    const bestDirectMatch = directFaceMatches[0];
    if (bestDirectMatch && bestDirectMatch.similarity > 0.95) { // High threshold for direct match
      console.log(`🎯 Direct raycast face match: ${bestDirectMatch.name} (${bestDirectMatch.index}) with similarity ${bestDirectMatch.similarity.toFixed(3)}`);
      return bestDirectMatch.index;
    } else if (bestDirectMatch && bestDirectMatch.similarity > 0.5) { // Lower threshold, but still a direct hint
        console.log(`🎯 Direct raycast face suggested (medium confidence): ${bestDirectMatch.name} (${bestDirectMatch.index}) with similarity ${bestDirectMatch.similarity.toFixed(3)}`);
        // We'll let the detailed heuristic below confirm this if it's not a strong match
    }
  }

  // Find face with normal most similar to local intersection normal (heuristic approach)
  const faceMatches = faces.map(face => {
    // Calculate normal similarity (higher = better match) using local intersection normal
    const normalSimilarity = Math.abs(localIntersectionNormal.dot(face.normal));
    
    // Calculate distance from local intersection point to face center
    const distanceToCenter = localPoint.distanceTo(face.center);
    
    // Calculate how far the point is from the face plane
    // Project localPoint onto the face's normal from the face's center
    const pointToFaceVector = localPoint.clone().sub(face.center);
    const projectionDistance = Math.abs(pointToFaceVector.dot(face.normal));
    
    // Check if point is reasonably close to the face plane
    const isNearFacePlane = projectionDistance < 50; // Smaller threshold for proximity to plane
    
    // Combined score: prioritize normal similarity, then proximity to plane, then distance to center
    // Higher normal similarity and closer proximity to the plane are better
    const normalWeight = 100; // Very high weight for normal similarity
    const planeProximityWeight = 50; // High weight for closeness to plane
    const distanceWeight = 1 / (distanceToCenter + 1); // Inverse distance for secondary sorting
    
    let score = 0;
    if (isNearFacePlane) {
        // If near the plane, combine scores
        score = (normalSimilarity * normalWeight) + (planeProximityWeight * (1 - Math.min(projectionDistance / 50, 1))) + distanceWeight;
    } else {
        // If not near the plane, heavily penalize or just use a very low weighted normal similarity
        score = normalSimilarity * normalWeight * 0.1; // Much lower score if not on the plane
    }

    return {
      index: face.index,
      name: face.name,
      normalSimilarity: normalSimilarity,
      distanceToCenter: distanceToCenter,
      projectionDistance: projectionDistance,
      isNearFacePlane: isNearFacePlane,
      score: score
    };
  }).sort((a, b) => b.score - a.score); // Sort by combined score

  console.log(`🎯 Face matches (sorted by score):`, faceMatches.slice(0, 3).map(f => 
    `${f.name}(${f.index}): score=${f.score.toFixed(2)}, sim=${f.normalSimilarity.toFixed(3)}, dist=${f.distanceToCenter.toFixed(1)}mm, proj=${f.projectionDistance.toFixed(1)}mm ${f.isNearFacePlane ? '✓' : '✗'}`
  ).join(', '));
  
  // Return the face with the best score, with a reasonable minimum similarity
  const bestMatch = faceMatches[0];
  if (bestMatch && bestMatch.normalSimilarity > 0.05 && bestMatch.isNearFacePlane) { // Ensure it's on the plane and normal matches
    console.log(`🎯 Best face match: ${bestMatch.name} (${bestMatch.index}) with similarity ${bestMatch.normalSimilarity.toFixed(3)}`);
    return bestMatch.index;
  }
  
  console.log(`🎯 No sufficiently good face match found via heuristics. Returning null.`);
  // As a last resort, if no suitable face is found, return null.
  return bestMatch?.index || null; 
};

/**
 * Get face geometry for rendering overlay
 */
export const getFaceGeometry = (shape: Shape, faceIndex: number): {
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  rotation: THREE.Euler;
} | null => {
  const faces = getFaceInfo(shape);
  const face = faces.find(f => f.index === faceIndex);
  
  if (!face) return null;

  let geometry: THREE.BufferGeometry;
  
  console.log(`🎯 Creating face geometry for ${shape.type}, face ${faceIndex} (${face.name})`);
  console.log(`🎯 Face center (local): [${face.center.x.toFixed(1)}, ${face.center.y.toFixed(1)}, ${face.center.z.toFixed(1)}]`);
  console.log(`🎯 Face normal (local): [${face.normal.x.toFixed(2)}, ${face.normal.y.toFixed(2)}, ${face.normal.z.toFixed(2)}]`);
  console.log(`🎯 Face area: ${face.area.toFixed(1)}mm²`);
  
  switch (shape.type) {
    case 'box':
    case 'rectangle2d': {
      const { width: w = 500, height: h = 500, depth: d = 500 } = shape.parameters;
      const scaledW = w * shape.scale[0];
      const scaledH = h * shape.scale[1];
      const scaledD = d * shape.scale[2];
      
      if (faceIndex === 0 || faceIndex === 1) { // Front/Back
        geometry = new THREE.PlaneGeometry(scaledW, scaledH);
      } else if (faceIndex === 2 || faceIndex === 3) { // Top/Bottom
        geometry = new THREE.PlaneGeometry(scaledW, scaledD);
      } else { // Left/Right
        geometry = new THREE.PlaneGeometry(scaledD, scaledH);
      }
      console.log(`🎯 Box face geometry: ${scaledW.toFixed(1)}x${scaledH.toFixed(1)}x${scaledD.toFixed(1)}mm`);
      break;
    }
    
    case 'cylinder':
    case 'circle2d': {
      const { radius = 250, height: h = 500 } = shape.parameters;
      const scaledR = radius * Math.max(shape.scale[0], shape.scale[2]);
      const scaledH = h * shape.scale[1];
      
      if (faceIndex === 0 || faceIndex === 1) { // Top/Bottom
        geometry = new THREE.CircleGeometry(scaledR, 32);
        console.log(`🎯 Cylinder top/bottom: radius ${scaledR.toFixed(1)}mm`);
      } else { // Side segments
        const segmentAngle = (Math.PI * 2) / 8;
        const segmentWidth = 2 * scaledR * Math.sin(segmentAngle / 2);
        geometry = new THREE.PlaneGeometry(segmentWidth, scaledH);
        console.log(`🎯 Cylinder side segment: ${segmentWidth.toFixed(1)}x${scaledH.toFixed(1)}mm`);
      }
      break;
    }
    
    case 'polyline2d':
    case 'polygon2d':
    case 'polyline3d':
    case 'polygon3d': {
      const h = (shape.parameters.height || 500) * shape.scale[1];
      
      if (faceIndex === 0 || faceIndex === 1) { // Top/Bottom
        // Create geometry from original points
        if (shape.originalPoints && shape.originalPoints.length >= 3) {
          // Convert 3D points to 2D for shape geometry
          const uniquePoints = shape.originalPoints.length > 2 &&  
            shape.originalPoints[shape.originalPoints.length - 1].equals(shape.originalPoints[0])  
            ? shape.originalPoints.slice(0, -1)  
            : shape.originalPoints;
          
          const points2D = uniquePoints.map(p => new THREE.Vector2(p.x, p.z));
          const shapeGeom = new THREE.Shape(points2D);
          geometry = new THREE.ShapeGeometry(shapeGeom);
          console.log(`🎯 Polyline top/bottom: ${uniquePoints.length} points, area ${face.area.toFixed(1)}mm²`);
        } else {
          // Fallback: Use bounding box dimensions
          shape.geometry.computeBoundingBox();
          const bbox = shape.geometry.boundingBox;
          if (bbox) {
            const w = (bbox.max.x - bbox.min.x) * shape.scale[0];
            const d = (bbox.max.z - bbox.min.z) * shape.scale[2];
            geometry = new THREE.PlaneGeometry(w, d);
            console.log(`🎯 Polyline fallback top/bottom: ${w.toFixed(1)}x${d.toFixed(1)}mm`);
          } else {
            geometry = new THREE.PlaneGeometry(100, 100);
            console.log(`🎯 Polyline default top/bottom: 100x100mm`);
          }
        }
      } else { // Side faces
        if (shape.originalPoints && faceIndex - 2 < shape.originalPoints.length) {
          const i = faceIndex - 2;
          const uniquePoints = shape.originalPoints.length > 2 &&  
            shape.originalPoints[shape.originalPoints.length - 1].equals(shape.originalPoints[0])  
            ? shape.originalPoints.slice(0, -1)  
            : shape.originalPoints;
          
          const current = uniquePoints[i];
          const next = uniquePoints[(i + 1) % uniquePoints.length];
          const edgeLength = current.distanceTo(next);
          
          geometry = new THREE.PlaneGeometry(edgeLength, h);
          console.log(`🎯 Polyline side ${i + 1}: ${edgeLength.toFixed(1)}x${h.toFixed(1)}mm`);
        } else {
          // Fallback: Use average edge length from bounding box
          shape.geometry.computeBoundingBox();
          const bbox = shape.geometry.boundingBox;
          if (bbox) {
            const w = (bbox.max.x - bbox.min.x) * shape.scale[0];
            const d = (bbox.max.z - bbox.min.z) * shape.scale[2];
            const avgEdgeLength = Math.max(w, d) / 4; // Approximate edge length
            geometry = new THREE.PlaneGeometry(avgEdgeLength, h);
            console.log(`🎯 Polyline fallback side: ${avgEdgeLength.toFixed(1)}x${h.toFixed(1)}mm`);
          } else {
            geometry = new THREE.PlaneGeometry(100, h);
            console.log(`🎯 Polyline default side: 100x${h.toFixed(1)}mm`);
          }
        }
      }
      break;
    }
    default:
      console.warn(`Geometry creation not implemented for shape type: ${shape.type}`);
      return null;
  }
  
  // Calculate transformation for the face overlay using matrix
  
  // Ensure shape.quaternion is available or convert from Euler angles
  const shapeQuaternion = shape.quaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation));

  // Create a matrix from the shape's world position, rotation (quaternion), and scale
  // This matrix will transform the face's local center and normal into world coordinates
  const shapeMatrix = new THREE.Matrix4();
  shapeMatrix.compose(
    new THREE.Vector3(...shape.position),
    shapeQuaternion,
    new THREE.Vector3(...shape.scale)
  );

  // Transform the face's local center to world coordinates
  const worldFaceCenter = face.center.clone().applyMatrix4(shapeMatrix);
  
  // Transform the face's local normal to world coordinates and normalize it
  // Normals should only be rotated, not translated or scaled for correct orientation
  const worldFaceNormal = face.normal.clone().applyQuaternion(shapeQuaternion).normalize();

  // The PlaneGeometry, CircleGeometry, and ShapeGeometry are created in the XY plane,
  // meaning their default local normal is (0, 0, 1).
  const sourceNormal = new THREE.Vector3(0, 0, 1);
  
  // Create a quaternion that rotates the source normal (default geometry normal)
  // to the target world face normal. This correctly aligns the plane.
  const rotationQuaternion = new THREE.Quaternion().setFromUnitVectors(sourceNormal, worldFaceNormal);
  
  // Convert the quaternion to Euler angles for the return type
  const finalRotation = new THREE.Euler().setFromQuaternion(rotationQuaternion);

  console.log(`🎯 Face overlay position (world): [${worldFaceCenter.x.toFixed(1)}, ${worldFaceCenter.y.toFixed(1)}, ${worldFaceCenter.z.toFixed(1)}]`);
  console.log(`🎯 Face overlay rotation (Euler, degrees): [${(finalRotation.x * 180 / Math.PI).toFixed(1)}°, ${(finalRotation.y * 180 / Math.PI).toFixed(1)}°, ${(finalRotation.z * 180 / Math.PI).toFixed(1)}°]`);
  
  return { 
    geometry, 
    position: worldFaceCenter, 
    rotation: finalRotation 
  };
};

/**
 * Helper functions
 */
const calculatePolygonCenter = (points: THREE.Vector3[]): THREE.Vector3 => {
  const center = new THREE.Vector3();
  const uniquePoints = points.length > 2 && points[points.length - 1].equals(points[0])  
    ? points.slice(0, -1)  
    : points;
  
  for (const point of uniquePoints) {
    center.add(point);
  }
  
  center.divideScalar(uniquePoints.length);
  return center;
};

const calculatePolygonArea = (points: THREE.Vector3[]): number => {
  if (points.length < 3) return 0;
  
  const uniquePoints = points.length > 2 && points[points.length - 1].equals(points[0])  
    ? points.slice(0, -1)  
    : points;
  
  let area = 0;
  for (let i = 0; i < uniquePoints.length; i++) {
    const j = (i + 1) % uniquePoints.length;
    area += uniquePoints[i].x * uniquePoints[j].z;
    area -= uniquePoints[j].x * uniquePoints[i].z;
  }
  
  return Math.abs(area) / 2;
};

/**
 * Fallback geometry-based face detection for shapes without originalPoints
 */
const getGeometryBasedFaces = (shape: Shape): FaceInfo[] => {
  const faces: FaceInfo[] = [];
  
  // Get geometry bounding box
  shape.geometry.computeBoundingBox();
  const bbox = shape.geometry.boundingBox;
  
  if (!bbox) {
    console.warn('No bounding box available for geometry-based face detection');
    return [];
  }
  
  // Ensure bounding box dimensions are correctly scaled
  const width = (bbox.max.x - bbox.min.x) * shape.scale[0];
  const height = (bbox.max.y - bbox.min.y) * shape.scale[1];
  const depth = (bbox.max.z - bbox.min.z) * shape.scale[2];
  
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;
  
  // Create basic 6 faces based on bounding box
  faces.push(
    {
      index: 0,
      name: 'Top',
      center: new THREE.Vector3(0, hh, 0), // Center in local bbox coordinates
      normal: new THREE.Vector3(0, 1, 0),
      area: width * depth,
      vertices: [] // Vertices for fallback might not be precisely defined
    },
    {
      index: 1,
      name: 'Bottom',
      center: new THREE.Vector3(0, -hh, 0),
      normal: new THREE.Vector3(0, -1, 0),
      area: width * depth,
      vertices: []
    },
    {
      index: 2,
      name: 'Front',
      center: new THREE.Vector3(0, 0, hd),
      normal: new THREE.Vector3(0, 0, 1),
      area: width * height,
      vertices: []
    },
    {
      index: 3,
      name: 'Back',
      center: new THREE.Vector3(0, 0, -hd),
      normal: new THREE.Vector3(0, 0, -1),
      area: width * height,
      vertices: []
    },
    {
      index: 4,
      name: 'Right',
      center: new THREE.Vector3(hw, 0, 0),
      normal: new THREE.Vector3(1, 0, 0),
      area: height * depth,
      vertices: []
    },
    {
      index: 5,
      name: 'Left',
      center: new THREE.Vector3(-hw, 0, 0),
      normal: new THREE.Vector3(-1, 0, 0),
      area: height * depth,
      vertices: []
    }
  );
  
  console.log(`🎯 Generated ${faces.length} geometry-based faces for ${shape.type}`);
  return faces;
};
