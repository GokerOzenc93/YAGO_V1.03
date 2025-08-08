import * as THREE from 'three';
import { Shape } from '../types/shapes';

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
      normal: new THREE.Vector3(Math.cos(angle), 0, Math.sin(angle)),
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
    console.warn('No original points found for extruded shape');
    return [];
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
 */
export const findFaceAtIntersection = (
  intersectionPoint: THREE.Vector3, 
  intersectionNormal: THREE.Vector3,
  shape: Shape
): number | null => {
  const faces = getFaceInfo(shape);
  if (faces.length === 0) return null;
  
  const shapePosition = new THREE.Vector3(...shape.position);
  const worldPoint = intersectionPoint.clone();
  const localPoint = worldPoint.clone().sub(shapePosition);
  const localNormal = intersectionNormal.clone().normalize();
  
  console.log(`🎯 Finding face at intersection for ${shape.type}:`);
  console.log(`🎯 Intersection point: [${intersectionPoint.x.toFixed(1)}, ${intersectionPoint.y.toFixed(1)}, ${intersectionPoint.z.toFixed(1)}]`);
  console.log(`🎯 Intersection normal: [${localNormal.x.toFixed(2)}, ${localNormal.y.toFixed(2)}, ${localNormal.z.toFixed(2)}]`);
  console.log(`🎯 Shape position: [${shapePosition.x.toFixed(1)}, ${shapePosition.y.toFixed(1)}, ${shapePosition.z.toFixed(1)}]`);
  console.log(`🎯 Local point: [${localPoint.x.toFixed(1)}, ${localPoint.y.toFixed(1)}, ${localPoint.z.toFixed(1)}]`);
  
  // Find face with normal most similar to intersection normal
  const faceMatches = faces.map(face => {
    const normalSimilarity = Math.abs(localNormal.dot(face.normal));
    const distanceToCenter = localPoint.distanceTo(face.center);
    const pointToFace = localPoint.clone().sub(face.center);
    const projectionDistance = Math.abs(pointToFace.dot(face.normal));
    
    return {
      index: face.index,
      name: face.name,
      normalSimilarity: normalSimilarity,
      distanceToCenter: distanceToCenter,
      projectionDistance: projectionDistance,
      isOnFace: projectionDistance < 100, // 100mm threshold
      score: normalSimilarity * 2 + (1 / (distanceToCenter + 1)) // Combined score
    };
  }).sort((a, b) => b.score - a.score); // Sort by highest score
  
  console.log(`🎯 Face matches:`, faceMatches.slice(0, 3).map(f => 
    `${f.name}(${f.index}): similarity=${f.normalSimilarity.toFixed(2)}, dist=${f.distanceToCenter.toFixed(1)}mm, score=${f.score.toFixed(2)} ${f.isOnFace ? '✓' : '✗'}`
  ).join(', '));
  
  // Return the face with highest score (best normal match + closest distance)
  const bestMatch = faceMatches[0];
  if (bestMatch && bestMatch.normalSimilarity > 0.3) { // Minimum similarity threshold
    console.log(`🎯 Best face match: ${bestMatch.name} (${bestMatch.index}) with score ${bestMatch.score.toFixed(2)}`);
    return bestMatch.index;
  }
  
  console.log(`🎯 No good face match found, using closest: ${bestMatch.name} (${bestMatch.index})`);
  return bestMatch.index;
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
  let width = 100, height = 100;
  
  switch (shape.type) {
    case 'box':
    case 'rectangle2d': {
      const { width: w = 500, height: h = 500, depth: d = 500 } = shape.parameters;
      const scaledW = w * shape.scale[0];
      const scaledH = h * shape.scale[1];
      const scaledD = d * shape.scale[2];
      
      if (faceIndex === 0 || faceIndex === 1) { // Front/Back
        width = scaledW;
        height = scaledH;
      } else if (faceIndex === 2 || faceIndex === 3) { // Top/Bottom
        width = scaledW;
        height = scaledD;
      } else { // Left/Right
        width = scaledD;
        height = scaledH;
      }
      break;
    }
    
    case 'cylinder':
    case 'circle2d': {
      const { radius = 250, height: h = 500 } = shape.parameters;
      const scaledR = radius * Math.max(shape.scale[0], shape.scale[2]);
      const scaledH = h * shape.scale[1];
      
      if (faceIndex === 0 || faceIndex === 1) { // Top/Bottom
        geometry = new THREE.CircleGeometry(scaledR, 32);
      } else { // Side segments
        const segmentAngle = (Math.PI * 2) / 8;
        const segmentWidth = 2 * scaledR * Math.sin(segmentAngle / 2);
        width = segmentWidth;
        height = scaledH;
      }
      break;
    }
    
    case 'polyline2d':
    case 'polygon2d':
    case 'polyline3d':
    case 'polygon3d': {
      if (faceIndex === 0 || faceIndex === 1) { // Top/Bottom
        // Create geometry from original points
        if (shape.originalPoints && shape.originalPoints.length >= 3) {
          const points2D = shape.originalPoints.map(p => new THREE.Vector2(p.x, p.z));
          const shapeGeom = new THREE.Shape(points2D);
          geometry = new THREE.ShapeGeometry(shapeGeom);
        } else {
          geometry = new THREE.PlaneGeometry(100, 100);
        }
      } else { // Side faces
        const h = (shape.parameters.height || 500) * shape.scale[1];
        if (shape.originalPoints && faceIndex - 2 < shape.originalPoints.length) {
          const i = faceIndex - 2;
          const uniquePoints = shape.originalPoints.length > 2 && 
            shape.originalPoints[shape.originalPoints.length - 1].equals(shape.originalPoints[0]) 
            ? shape.originalPoints.slice(0, -1) 
            : shape.originalPoints;
          
          const current = uniquePoints[i];
          const next = uniquePoints[(i + 1) % uniquePoints.length];
          const edgeLength = current.distanceTo(next);
          
          width = edgeLength;
          height = h;
        } else {
          width = 100;
          height = h;
        }
      }
      break;
    }
  }
  
  // Create geometry if not already created
  if (!geometry) {
    geometry = new THREE.PlaneGeometry(width, height);
  }
  
  // Calculate rotation based on face normal
  const rotation = new THREE.Euler();
  const normal = face.normal;
  
  if (Math.abs(normal.y) > 0.9) {
    // Top/Bottom faces
    rotation.x = normal.y > 0 ? -Math.PI / 2 : Math.PI / 2;
  } else if (Math.abs(normal.z) > 0.9) {
    // Front/Back faces
    rotation.y = normal.z > 0 ? 0 : Math.PI;
  } else if (Math.abs(normal.x) > 0.9) {
    // Left/Right faces
    rotation.y = normal.x > 0 ? Math.PI / 2 : -Math.PI / 2;
  } else {
    // Angled faces (for extruded shapes)
    const angle = Math.atan2(normal.x, normal.z);
    rotation.y = angle;
  }
  
  const position = face.center.clone().add(new THREE.Vector3(...shape.position));
  
  return { geometry, position, rotation };
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