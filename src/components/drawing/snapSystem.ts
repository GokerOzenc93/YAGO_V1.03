import * as THREE from 'three';
import { CompletedShape, SnapPoint } from './types';
import { SnapType, SnapSettings } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import { findLineIntersection } from './utils';
import { Billboard } from '@react-three/drei';
import * as React from 'react';
import * as THREE from 'three';

// Helper function to get all vertices from 3D shape geometry with proper transforms
const getShapeVertices = (shape: Shape): THREE.Vector3[] => {
  const vertices: THREE.Vector3[] = [];
  const geometry = shape.geometry;
  
  if (!geometry.attributes.position) return vertices;
  
  // Create transform matrix for shape position, rotation, scale
  const matrix = new THREE.Matrix4();
  const quaternion = shape.quaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation));
  matrix.compose(
    new THREE.Vector3(...shape.position),
    quaternion,
    new THREE.Vector3(...shape.scale)
  );
  
  // Get ALL vertices from geometry (not just outline)
  const positions = geometry.attributes.position;
  const uniqueVertices = new Map<string, THREE.Vector3>();
  const precision = 1000; // Daha yüksek hassasiyet için 1000
  
  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix);
    
    // Use rounded coordinates as key to avoid duplicates
    const key = `${Math.round(vertex.x * precision) / precision},${Math.round(vertex.y * precision) / precision},${Math.round(vertex.z * precision) / precision}`;
    if (!uniqueVertices.has(key)) {
      uniqueVertices.set(key, vertex);
    }
  }
  
  return Array.from(uniqueVertices.values());
};

// Helper function to get all edges from 3D shape geometry with proper transforms
const getShapeEdges = (shape: Shape): THREE.Line3[] => {
  const edges: THREE.Line3[] = [];
  const geometry = shape.geometry;
  
  if (!geometry.attributes.position) return edges;
  
  const matrix = new THREE.Matrix4();
  const quaternion = shape.quaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation));
  matrix.compose(
    new THREE.Vector3(...shape.position),
    quaternion,
    new THREE.Vector3(...shape.scale)
  );
  
  // Get ALL edges (not just outline)
  const edgesGeometry = new THREE.EdgesGeometry(geometry);
  const positions = edgesGeometry.attributes.position;
  
  // Extract edge lines and transform to world space
  for (let i = 0; i < positions.count; i += 2) {
    const start = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix);
    const end = new THREE.Vector3().fromBufferAttribute(positions, i + 1).applyMatrix4(matrix);
    
    edges.push(new THREE.Line3(start, end));
  }
  
  return edges;
};

// Helper function to project 3D point to screen space for distance calculation
const projectToScreen = (
  point: THREE.Vector3,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement
): THREE.Vector2 => {
  const projected = point.clone().project(camera);
  
  const rect = canvas.getBoundingClientRect();
  const x = (projected.x + 1) * rect.width / 2;
  const y = (-projected.y + 1) * rect.height / 2;
  
  return new THREE.Vector2(x, y);
};

// Helper function to calculate screen distance between mouse and 3D point
const calculateScreenDistance = (
  worldPoint: THREE.Vector3,
  mouseScreenPos: THREE.Vector2,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement
): number => {
  const screenPos = projectToScreen(worldPoint, camera, canvas);
  return mouseScreenPos.distanceTo(screenPos);
};

export const findSnapPoints = (
  mousePoint: THREE.Vector3,
  completedShapes: CompletedShape[],
  shapes: Shape[],
  snapSettings: SnapSettings,
  tolerance: number,
  currentPoint?: THREE.Vector3 | null,
  currentDirection?: THREE.Vector3 | null,
  camera?: THREE.Camera,
  canvas?: HTMLCanvasElement,
  mouseScreenPos?: THREE.Vector2
): SnapPoint[] => {
  const snapPoints: SnapPoint[] = [];
  
  if (!camera || !canvas || !mouseScreenPos) {
    console.warn('Snap system needs camera, canvas, and mouse screen position for accurate snapping.');
    return [];
  }
  
  console.log(`🎯 SNAP SEARCH: Mouse at [${mousePoint.x.toFixed(1)}, ${mousePoint.y.toFixed(1)}, ${mousePoint.z.toFixed(1)}], tolerance: ${tolerance}`);

  // 🎯 ENDPOINT SNAPPING - 3D ve 2D
  if (snapSettings[SnapType.ENDPOINT]) {
    // 3D shape vertices
    shapes.forEach((shape) => {
      const vertices = getShapeVertices(shape);
      vertices.forEach((vertex) => {
        const distance = calculateScreenDistance(vertex, mouseScreenPos, camera, canvas);
        if (distance <= tolerance) {
          snapPoints.push({ point: vertex.clone(), type: SnapType.ENDPOINT, shapeId: shape.id, distance });
        }
      });
    });

    // 2D completed shapes endpoints
    completedShapes.forEach(shape => {
      if (!shape.points || shape.points.length === 0) return;
      shape.points.forEach((point, pointIndex) => {
        if (shape.isClosed && pointIndex === shape.points.length - 1) return;
        const distance = calculateScreenDistance(point, mouseScreenPos, camera, canvas);
        if (distance <= tolerance) {
          snapPoints.push({ point: point.clone(), type: SnapType.ENDPOINT, shapeId: shape.id, distance });
        }
      });
    });
  }

  // 🎯 MIDPOINT SNAPPING - 3D ve 2D
  if (snapSettings[SnapType.MIDPOINT]) {
    // 3D shape edges
    shapes.forEach((shape) => {
      const edges = getShapeEdges(shape);
      edges.forEach((edge) => {
        const midpoint = new THREE.Vector3().addVectors(edge.start, edge.end).multiplyScalar(0.5);
        const distance = calculateScreenDistance(midpoint, mouseScreenPos, camera, canvas);
        if (distance <= tolerance) {
          snapPoints.push({ point: midpoint, type: SnapType.MIDPOINT, shapeId: shape.id, distance });
        }
      });
    });

    // 2D completed shapes midpoints
    completedShapes.forEach(shape => {
      for (let i = 0; i < shape.points.length - 1; i++) {
        if (shape.isClosed && i === shape.points.length - 2) continue;
        const start = shape.points[i];
        const end = shape.points[i + 1];
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        const distance = calculateScreenDistance(midpoint, mouseScreenPos, camera, canvas);
        if (distance <= tolerance) {
          snapPoints.push({ point: midpoint, type: SnapType.MIDPOINT, shapeId: shape.id, distance });
        }
      }
    });
  }

  // 🎯 CENTER SNAPPING - 3D ve 2D
  if (snapSettings[SnapType.CENTER]) {
    shapes.forEach((shape) => {
      const shapeCenter = new THREE.Vector3(...shape.position);
      const distance = calculateScreenDistance(shapeCenter, mouseScreenPos, camera, canvas);
      if (distance <= tolerance) {
        snapPoints.push({ point: shapeCenter, type: SnapType.CENTER, shapeId: shape.id, distance });
      }
    });

    // 2D completed shapes centers
    completedShapes.forEach(shape => {
      if (shape.type === 'circle' && shape.points.length >= 2) {
        const center = shape.points[0];
        const distance = calculateScreenDistance(center, mouseScreenPos, camera, canvas);
        if (distance <= tolerance) {
          snapPoints.push({ point: center.clone(), type: SnapType.CENTER, shapeId: shape.id, distance });
        }
      } else if (shape.type === 'rectangle' && shape.points.length >= 4) {
        const center = new THREE.Vector3(
          (shape.points[0].x + shape.points[2].x) / 2,
          (shape.points[0].y + shape.points[2].y) / 2,
          (shape.points[0].z + shape.points[2].z) / 2
        );
        const distance = calculateScreenDistance(center, mouseScreenPos, camera, canvas);
        if (distance <= tolerance) {
          snapPoints.push({ point: center, type: SnapType.CENTER, shapeId: shape.id, distance });
        }
      }
    });
  }

  // 🎯 NEAREST POINT SNAPPING - 3D ve 2D
  if (snapSettings[SnapType.NEAREST]) {
    // 3D shape edges
    shapes.forEach((shape) => {
      const edges = getShapeEdges(shape);
      edges.forEach((edge) => {
        const closestPoint = new THREE.Vector3();
        edge.closestPointToPoint(mousePoint, true, closestPoint);
        const distance = calculateScreenDistance(closestPoint, mouseScreenPos, camera, canvas);
        if (distance <= tolerance) {
          snapPoints.push({ point: closestPoint, type: SnapType.NEAREST, shapeId: shape.id, distance });
        }
      });
    });

    // 2D completed shapes
    completedShapes.forEach(shape => {
      for (let i = 0; i < shape.points.length - 1; i++) {
        const lineStart = shape.points[i];
        const lineEnd = shape.points[i + 1];
        const line = new THREE.Line3(lineStart, lineEnd);
        const closestPoint = new THREE.Vector3();
        line.closestPointToPoint(mousePoint, true, closestPoint);
        const distance = calculateScreenDistance(closestPoint, mouseScreenPos, camera, canvas);
        if (distance <= tolerance) {
          snapPoints.push({ point: closestPoint, type: SnapType.NEAREST, shapeId: shape.id, distance });
        }
      }
    });
  }
  
  // 🎯 INTERSECTION SNAPPING - 3D ve 2D
  if (snapSettings[SnapType.INTERSECTION]) {
    // Tüm 2D ve 3D kenarları topla
    const allEdges: { edge: THREE.Line3; shapeId: string }[] = [];
    completedShapes.forEach(s => {
      for(let i = 0; i < s.points.length - 1; i++) {
        allEdges.push({ edge: new THREE.Line3(s.points[i], s.points[i+1]), shapeId: s.id });
      }
    });
    shapes.forEach(s => {
      getShapeEdges(s).forEach(edge => allEdges.push({ edge, shapeId: s.id }));
    });
    
    // Kesişimleri bul ve snapPoints'e ekle
    for (let i = 0; i < allEdges.length; i++) {
      for (let j = i + 1; j < allEdges.length; j++) {
        const edge1 = allEdges[i].edge;
        const edge2 = allEdges[j].edge;
        
        const intersection = findLineIntersection(edge1.start, edge1.end, edge2.start, edge2.end);
        
        if (intersection) {
          const distance = calculateScreenDistance(intersection, mouseScreenPos, camera, canvas);
          if (distance <= tolerance) {
            snapPoints.push({
              point: intersection,
              type: SnapType.INTERSECTION,
              distance,
            });
          }
        }
      }
    }
  }

  // 🎯 PERPENDICULAR SNAPPING - 3D ve 2D
  if (snapSettings[SnapType.PERPENDICULAR] && currentPoint && currentDirection) {
    // Tüm 2D ve 3D kenarları topla
    const allEdges: { edge: THREE.Line3; shapeId: string }[] = [];
    completedShapes.forEach(s => {
      for(let i = 0; i < s.points.length - 1; i++) {
        allEdges.push({ edge: new THREE.Line3(s.points[i], s.points[i+1]), shapeId: s.id });
      }
    });
    shapes.forEach(s => {
      getShapeEdges(s).forEach(edge => allEdges.push({ edge, shapeId: s.id }));
    });
    
    allEdges.forEach(({ edge, shapeId }) => {
      const lineDir = new THREE.Vector3().subVectors(edge.end, edge.start).normalize();
      const dot = Math.abs(currentDirection.dot(lineDir));
      // Yüksek tolerans değeri, yönlerin tam dik olmasına gerek kalmadan snap yapmasını sağlar
      if (dot < 0.1) { // Perpendicular tolerance (0.1 radyan ≈ 5.7 derece)
        const closestPoint = new THREE.Vector3();
        edge.closestPointToPoint(mousePoint, true, closestPoint);
        const distance = calculateScreenDistance(closestPoint, mouseScreenPos, camera, canvas);
        if (distance <= tolerance) {
          snapPoints.push({
            point: closestPoint,
            type: SnapType.PERPENDICULAR,
            shapeId,
            distance
          });
        }
      }
    });
  }

  const finalSnapPoints = snapPoints.sort((a, b) => a.distance - b.distance);
  
  if (finalSnapPoints.length > 0) {
    console.log(`🎯 SNAP RESULT: Found ${finalSnapPoints.length} snap points, closest: ${finalSnapPoints[0].type} at distance ${finalSnapPoints[0].distance.toFixed(1)}`);
  } else {
    console.log(`🎯 SNAP RESULT: No snap points found within tolerance ${tolerance}`);
  }

  return finalSnapPoints;
};
