import * as THREE from 'three';
import { CompletedShape, SnapPoint } from './types';
import { SnapType, SnapSettings } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import { findLineIntersection } from './utils';

// Helper function to get all vertices from 3D shape geometry with proper transforms
const getShapeVertices = (shape: Shape): THREE.Vector3[] => {
  const vertices: THREE.Vector3[] = [];
  const geometry = shape.geometry;
  
  if (!geometry.attributes.position) return vertices;
  
  // Create transform matrix for shape position, rotation, scale
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(...shape.position),
    new THREE.Euler(...shape.rotation),
    new THREE.Vector3(...shape.scale)
  );
  
  // Get ALL vertices from geometry (not just outline)
  const positions = geometry.attributes.position;
  const uniqueVertices = new Map<string, THREE.Vector3>();
  
  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix);
    
    // Use rounded coordinates as key to avoid duplicates
    const key = `${Math.round(vertex.x * 100) / 100},${Math.round(vertex.y * 100) / 100},${Math.round(vertex.z * 100) / 100}`;
    if (!uniqueVertices.has(key)) {
      uniqueVertices.set(key, vertex);
    }
  }
  
  console.log(`🎯 Shape ${shape.type} vertices: ${uniqueVertices.size} unique points (including top/bottom)`);
  return Array.from(uniqueVertices.values());
};

// Helper function to get all edges from 3D shape geometry with proper transforms
const getShapeEdges = (shape: Shape): THREE.Line3[] => {
  const edges: THREE.Line3[] = [];
  const geometry = shape.geometry;
  
  if (!geometry.attributes.position) return edges;
  
  // Create transform matrix for shape position, rotation, scale
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(...shape.position),
    new THREE.Euler(...shape.rotation),
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
  
  console.log(`🎯 Shape ${shape.type} edges: ${edges.length} lines (including vertical edges)`);
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
  
  console.log(`🎯 SNAP SEARCH: Mouse at [${mousePoint.x.toFixed(1)}, ${mousePoint.y.toFixed(1)}, ${mousePoint.z.toFixed(1)}], tolerance: ${tolerance}`);

  // 🎯 ENDPOINT SNAPPING - All vertices of 3D shapes
  if (snapSettings[SnapType.ENDPOINT]) {
    console.log(`🔍 Checking ENDPOINT snap for ${shapes.length} 3D shapes...`);
    
    shapes.forEach((shape, shapeIndex) => {
      console.log(`🔍 Shape ${shapeIndex}: ${shape.type} at [${shape.position.join(', ')}]`);
      
      // Get ALL vertices from the shape (including top/bottom)
      const vertices = getShapeVertices(shape);
      console.log(`📦 Shape vertices: ${vertices.length} points`);
      
      vertices.forEach((vertex, pointIndex) => {
        let distance: number;
        
        // Use screen space distance if camera info is available (more accurate for perspective)
        if (camera && canvas && mouseScreenPos) {
          distance = calculateScreenDistance(vertex, mouseScreenPos, camera, canvas);
        } else {
          // Fallback to world space distance
          distance = mousePoint.distanceTo(vertex);
        }
        
        console.log(`   Point ${pointIndex}: [${vertex.x.toFixed(1)}, ${vertex.y.toFixed(1)}, ${vertex.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
        
        if (distance <= tolerance) {
          console.log(`✅ ENDPOINT SNAP: Shape vertex ${pointIndex} selected!`);
          snapPoints.push({
            point: vertex.clone(),
            type: SnapType.ENDPOINT,
            shapeId: shape.id,
            distance
          });
        }
      });
    });

    // 2D completed shapes endpoints
    completedShapes.forEach(shape => {
      if (!shape.points || shape.points.length === 0) return;

      shape.points.forEach((point, pointIndex) => {
        if (shape.isClosed && pointIndex === shape.points.length - 1) return;
        
        let distance: number;
        
        if (camera && canvas && mouseScreenPos) {
          distance = calculateScreenDistance(point, mouseScreenPos, camera, canvas);
        } else {
          distance = mousePoint.distanceTo(point);
        }
        
        if (distance <= tolerance) {
          console.log(`✅ ENDPOINT SNAP: 2D shape point ${pointIndex} selected!`);
          snapPoints.push({
            point: point.clone(),
            type: SnapType.ENDPOINT,
            shapeId: shape.id,
            distance
          });
        }
      });
    });
  }

  // 🎯 MIDPOINT SNAPPING - All edge midpoints of 3D shapes
  if (snapSettings[SnapType.MIDPOINT]) {
    console.log(`🔍 Checking MIDPOINT snap for ${shapes.length} 3D shapes...`);
    
    shapes.forEach((shape, shapeIndex) => {
      const edges = getShapeEdges(shape);
      console.log(`🔧 Shape ${shapeIndex} edges: ${edges.length} edges`);
      
      edges.forEach((edge, edgeIndex) => {
        const midpoint = new THREE.Vector3().addVectors(edge.start, edge.end).multiplyScalar(0.5);
        
        let distance: number;
        
        if (camera && canvas && mouseScreenPos) {
          distance = calculateScreenDistance(midpoint, mouseScreenPos, camera, canvas);
        } else {
          distance = mousePoint.distanceTo(midpoint);
        }
        
        console.log(`   Edge ${edgeIndex} midpoint: [${midpoint.x.toFixed(1)}, ${midpoint.y.toFixed(1)}, ${midpoint.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
        
        if (distance <= tolerance) {
          console.log(`✅ MIDPOINT SNAP: Edge midpoint ${edgeIndex} selected!`);
          snapPoints.push({
            point: midpoint,
            type: SnapType.MIDPOINT,
            shapeId: shape.id,
            distance
          });
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
        
        let distance: number;
        
        if (camera && canvas && mouseScreenPos) {
          distance = calculateScreenDistance(midpoint, mouseScreenPos, camera, canvas);
        } else {
          distance = mousePoint.distanceTo(midpoint);
        }
        
        if (distance <= tolerance) {
          snapPoints.push({
            point: midpoint,
            type: SnapType.MIDPOINT,
            shapeId: shape.id,
            distance
          });
        }
      }
    });
  }

  // 🎯 CENTER SNAPPING - Shape centers
  if (snapSettings[SnapType.CENTER]) {
    console.log(`🔍 Checking CENTER snap for ${shapes.length} 3D shapes...`);
    
    shapes.forEach((shape, shapeIndex) => {
      const shapeCenter = new THREE.Vector3(...shape.position);
      
      let distance: number;
      
      if (camera && canvas && mouseScreenPos) {
        distance = calculateScreenDistance(shapeCenter, mouseScreenPos, camera, canvas);
      } else {
        distance = mousePoint.distanceTo(shapeCenter);
      }
      
      console.log(`🔧 Shape center: [${shapeCenter.x.toFixed(1)}, ${shapeCenter.y.toFixed(1)}, ${shapeCenter.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
      
      if (distance <= tolerance) {
        console.log(`✅ CENTER SNAP: Shape center selected!`);
        snapPoints.push({
          point: shapeCenter,
          type: SnapType.CENTER,
          shapeId: shape.id,
          distance
        });
      }
    });

    // 2D completed shapes centers
    completedShapes.forEach(shape => {
      if (shape.type === 'circle' && shape.points.length >= 2) {
        const center = shape.points[0];
        
        let distance: number;
        
        if (camera && canvas && mouseScreenPos) {
          distance = calculateScreenDistance(center, mouseScreenPos, camera, canvas);
        } else {
          distance = mousePoint.distanceTo(center);
        }
        
        if (distance <= tolerance) {
          snapPoints.push({
            point: center.clone(),
            type: SnapType.CENTER,
            shapeId: shape.id,
            distance
          });
        }
      } else if (shape.type === 'rectangle' && shape.points.length >= 4) {
        const center = new THREE.Vector3(
          (shape.points[0].x + shape.points[2].x) / 2,
          (shape.points[0].y + shape.points[2].y) / 2,
          (shape.points[0].z + shape.points[2].z) / 2
        );
        
        let distance: number;
        
        if (camera && canvas && mouseScreenPos) {
          distance = calculateScreenDistance(center, mouseScreenPos, camera, canvas);
        } else {
          distance = mousePoint.distanceTo(center);
        }
        
        if (distance <= tolerance) {
          snapPoints.push({
            point: center,
            type: SnapType.CENTER,
            shapeId: shape.id,
            distance
          });
        }
      }
    });
  }

  // 🎯 NEAREST POINT SNAPPING - On edges/lines
  if (snapSettings[SnapType.NEAREST]) {
    console.log(`🔍 Checking NEAREST snap for ${shapes.length} 3D shapes...`);
    
    // 3D shape edges
    shapes.forEach((shape, shapeIndex) => {
      const edges = getShapeEdges(shape);
      console.log(`🔧 Shape ${shapeIndex} edges: ${edges.length} edges`);
      
      edges.forEach((edge, edgeIndex) => {
        const closestPoint = new THREE.Vector3();
        edge.closestPointToPoint(mousePoint, true, closestPoint);
        
        let distance: number;
        
        if (camera && canvas && mouseScreenPos) {
          distance = calculateScreenDistance(closestPoint, mouseScreenPos, camera, canvas);
        } else {
          distance = mousePoint.distanceTo(closestPoint);
        }
        
        console.log(`   Edge ${edgeIndex}: closest point [${closestPoint.x.toFixed(1)}, ${closestPoint.y.toFixed(1)}, ${closestPoint.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
        
        if (distance <= tolerance) {
          console.log(`✅ NEAREST SNAP: Edge ${edgeIndex} closest point selected!`);
          snapPoints.push({
            point: closestPoint,
            type: SnapType.NEAREST,
            shapeId: shape.id,
            distance
          });
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
        
        let distance: number;
        
        if (camera && canvas && mouseScreenPos) {
          distance = calculateScreenDistance(closestPoint, mouseScreenPos, camera, canvas);
        } else {
          distance = mousePoint.distanceTo(closestPoint);
        }
        
        if (distance <= tolerance) {
          snapPoints.push({
            point: closestPoint,
            type: SnapType.NEAREST,
            shapeId: shape.id,
            distance
          });
        }
      }
    });
  }

  // 🎯 INTERSECTION SNAPPING
  if (snapSettings[SnapType.INTERSECTION]) {
    console.log(`🔍 Checking INTERSECTION snap...`);
    
    // 2D shape intersections
    for (let i = 0; i < completedShapes.length; i++) {
      for (let j = i + 1; j < completedShapes.length; j++) {
        const shape1 = completedShapes[i];
        const shape2 = completedShapes[j];
        
        for (let seg1 = 0; seg1 < shape1.points.length - 1; seg1++) {
          for (let seg2 = 0; seg2 < shape2.points.length - 1; seg2++) {
            const intersection = findLineIntersection(
              shape1.points[seg1], shape1.points[seg1 + 1],
              shape2.points[seg2], shape2.points[seg2 + 1]
            );
            
            if (intersection) {
              let distance: number;
              
              if (camera && canvas && mouseScreenPos) {
                distance = calculateScreenDistance(intersection, mouseScreenPos, camera, canvas);
              } else {
                distance = mousePoint.distanceTo(intersection);
              }
              
              if (distance <= tolerance) {
                snapPoints.push({
                  point: intersection,
                  type: SnapType.INTERSECTION,
                  distance
                });
              }
            }
          }
        }
      }
    }

    // 3D shape edge intersections
    const allEdges: { edge: THREE.Line3; shapeId: string }[] = [];
    
    // Collect all 3D shape edges
    shapes.forEach(shape => {
      const edges = getShapeEdges(shape);
      edges.forEach(edge => {
        allEdges.push({ edge, shapeId: shape.id });
      });
    });
    
    // Find intersections between 3D shape edges
    for (let i = 0; i < allEdges.length; i++) {
      for (let j = i + 1; j < allEdges.length; j++) {
        const edge1 = allEdges[i].edge;
        const edge2 = allEdges[j].edge;
        
        const intersection = findLineIntersection(
          edge1.start, edge1.end,
          edge2.start, edge2.end
        );
        
        if (intersection) {
          let distance: number;
          
          if (camera && canvas && mouseScreenPos) {
            distance = calculateScreenDistance(intersection, mouseScreenPos, camera, canvas);
          } else {
            distance = mousePoint.distanceTo(intersection);
          }
          
          if (distance <= tolerance) {
            console.log(`✅ INTERSECTION SNAP: 3D edge intersection selected!`);
            snapPoints.push({
              point: intersection,
              type: SnapType.INTERSECTION,
              distance
            });
          }
        }
      }
    }

    // 2D and 3D shape intersections
    completedShapes.forEach(shape2D => {
      shapes.forEach(shape3D => {
        const edges3D = getShapeEdges(shape3D);
        
        for (let seg2D = 0; seg2D < shape2D.points.length - 1; seg2D++) {
          edges3D.forEach(edge3D => {
            const intersection = findLineIntersection(
              shape2D.points[seg2D], shape2D.points[seg2D + 1],
              edge3D.start, edge3D.end
            );
            
            if (intersection) {
              let distance: number;
              
              if (camera && canvas && mouseScreenPos) {
                distance = calculateScreenDistance(intersection, mouseScreenPos, camera, canvas);
              } else {
                distance = mousePoint.distanceTo(intersection);
              }
              
              if (distance <= tolerance) {
                snapPoints.push({
                  point: intersection,
                  type: SnapType.INTERSECTION,
                  distance
                });
              }
            }
          });
        }
      });
    });
  }

  // 🎯 PERPENDICULAR SNAPPING
  if (snapSettings[SnapType.PERPENDICULAR] && currentPoint && currentDirection) {
    // 2D completed shapes
    completedShapes.forEach(shape => {
      for (let i = 0; i < shape.points.length - 1; i++) {
        const lineStart = shape.points[i];
        const lineEnd = shape.points[i + 1];
        const lineDir = new THREE.Vector3().subVectors(lineEnd, lineStart).normalize();
        
        const dot = Math.abs(currentDirection.dot(lineDir));
        if (dot < 0.1) {
          const line = new THREE.Line3(lineStart, lineEnd);
          const closestPoint = new THREE.Vector3();
          line.closestPointToPoint(mousePoint, true, closestPoint);
          
          let distance: number;
          
          if (camera && canvas && mouseScreenPos) {
            distance = calculateScreenDistance(closestPoint, mouseScreenPos, camera, canvas);
          } else {
            distance = mousePoint.distanceTo(closestPoint);
          }
          
          if (distance <= tolerance) {
            snapPoints.push({
              point: closestPoint,
              type: SnapType.PERPENDICULAR,
              shapeId: shape.id,
              distance
            });
          }
        }
      }
    });

    // 3D shape edges
    shapes.forEach(shape => {
      const edges = getShapeEdges(shape);
      edges.forEach(edge => {
        const lineDir = new THREE.Vector3().subVectors(edge.end, edge.start).normalize();
        
        const dot = Math.abs(currentDirection.dot(lineDir));
        if (dot < 0.1) { // Perpendicular tolerance
          const closestPoint = new THREE.Vector3();
          edge.closestPointToPoint(mousePoint, true, closestPoint);
          
          let distance: number;
          
          if (camera && canvas && mouseScreenPos) {
            distance = calculateScreenDistance(closestPoint, mouseScreenPos, camera, canvas);
          } else {
            distance = mousePoint.distanceTo(closestPoint);
          }
          
          if (distance <= tolerance) {
            snapPoints.push({
              point: closestPoint,
              type: SnapType.PERPENDICULAR,
              shapeId: shape.id,
              distance
            });
          }
        }
      });
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