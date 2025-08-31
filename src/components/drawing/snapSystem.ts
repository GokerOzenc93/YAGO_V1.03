import * as THREE from 'three';
import { CompletedShape, SnapPoint } from './types';
import { SnapType, SnapSettings } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import { findLineIntersection } from './utils';

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
  
  // Get outline edges only (not all internal edges)
  const edgesGeometry = new THREE.EdgesGeometry(geometry);
  const positions = edgesGeometry.attributes.position;
  
  // Extract edge lines and transform to world space
  for (let i = 0; i < positions.count; i += 2) {
    const start = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix);
    const end = new THREE.Vector3().fromBufferAttribute(positions, i + 1).applyMatrix4(matrix);
    
    // Project to XZ plane (Y = 0) for 2D drawing
    start.y = 0;
    end.y = 0;
    
    edges.push(new THREE.Line3(start, end));
  }
  
  return edges;
};

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
  
  // Get unique vertices by using a Set with string keys
  const uniqueVertices = new Map<string, THREE.Vector3>();
  
  // Use EdgesGeometry to get only outline vertices
  const edgesGeometry = new THREE.EdgesGeometry(geometry);
  const positions = edgesGeometry.attributes.position;
  
  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix);
    
    // Project to XZ plane (Y = 0) for 2D drawing
    vertex.y = 0;
    
    // Use rounded coordinates as key to avoid duplicates
    const key = `${Math.round(vertex.x * 10) / 10},${Math.round(vertex.z * 10) / 10}`;
    if (!uniqueVertices.has(key)) {
      uniqueVertices.set(key, vertex);
    }
  }
  
  return Array.from(uniqueVertices.values());
};

// Helper function to get specific snap points for box shapes
const getBoxSnapPoints = (shape: Shape): { endpoints: THREE.Vector3[], midpoints: THREE.Vector3[], center: THREE.Vector3 } => {
  const endpoints: THREE.Vector3[] = [];
  const midpoints: THREE.Vector3[] = [];
  
  // Get box parameters with scale applied
  const width = (shape.parameters.width || 500) * shape.scale[0];
  const height = (shape.parameters.height || 500) * shape.scale[1];
  const depth = (shape.parameters.depth || 500) * shape.scale[2];
  
  const [x, y, z] = shape.position;
  
  // Calculate 4 corner points (endpoints) - projected to Y=0 for 2D drawing
  const corners = [
    new THREE.Vector3(x - width/2, 0, z - depth/2), // Bottom-left-front
    new THREE.Vector3(x + width/2, 0, z - depth/2), // Bottom-right-front
    new THREE.Vector3(x + width/2, 0, z + depth/2), // Bottom-right-back
    new THREE.Vector3(x - width/2, 0, z + depth/2), // Bottom-left-back
  ];
  
  endpoints.push(...corners);
  
  // Calculate edge midpoints (only bottom edges for 2D drawing)
  const edgeMidpoints = [
    new THREE.Vector3((corners[0].x + corners[1].x)/2, 0, (corners[0].z + corners[1].z)/2), // Front edge
    new THREE.Vector3((corners[1].x + corners[2].x)/2, 0, (corners[1].z + corners[2].z)/2), // Right edge
    new THREE.Vector3((corners[2].x + corners[3].x)/2, 0, (corners[2].z + corners[3].z)/2), // Back edge
    new THREE.Vector3((corners[3].x + corners[0].x)/2, 0, (corners[3].z + corners[0].z)/2), // Left edge
  ];
  
  midpoints.push(...edgeMidpoints);
  
  // Center point
  const center = new THREE.Vector3(x, 0, z);
  
  return { endpoints, midpoints, center };
};

// Helper function to get specific snap points for cylinder shapes
const getCylinderSnapPoints = (shape: Shape): { endpoints: THREE.Vector3[], midpoints: THREE.Vector3[], center: THREE.Vector3, quadrants: THREE.Vector3[] } => {
  const endpoints: THREE.Vector3[] = [];
  const midpoints: THREE.Vector3[] = [];
  const quadrants: THREE.Vector3[] = [];
  
  const radius = (shape.parameters.radius || 250) * shape.scale[0];
  const [x, y, z] = shape.position;
  
  // Center point
  const center = new THREE.Vector3(x, 0, z);
  
  // Quadrant points (4 points around the circle)
  const quadrantPoints = [
    new THREE.Vector3(x + radius, 0, z), // Right
    new THREE.Vector3(x - radius, 0, z), // Left
    new THREE.Vector3(x, 0, z + radius), // Back
    new THREE.Vector3(x, 0, z - radius), // Front
  ];
  
  quadrants.push(...quadrantPoints);
  endpoints.push(...quadrantPoints); // Quadrants are also endpoints for cylinders
  
  // Calculate midpoints between quadrants
  for (let i = 0; i < quadrantPoints.length; i++) {
    const current = quadrantPoints[i];
    const next = quadrantPoints[(i + 1) % quadrantPoints.length];
    const midpoint = new THREE.Vector3().addVectors(current, next).multiplyScalar(0.5);
    midpoints.push(midpoint);
  }
  
  return { endpoints, midpoints, center, quadrants };
};

// 🎯 NEW: Convert screen coordinates to world coordinates properly
const screenToWorld = (
  screenX: number, 
  screenY: number, 
  camera: THREE.Camera, 
  canvas: HTMLCanvasElement
): THREE.Vector3 => {
  const rect = canvas.getBoundingClientRect();
  const x = ((screenX - rect.left) / rect.width) * 2 - 1;
  const y = -((screenY - rect.top) / rect.height) * 2 + 1;
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera({ x, y }, camera);
  
  // Project ray to Y=0 plane for 2D drawing
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const worldPoint = new THREE.Vector3();
  raycaster.ray.intersectPlane(plane, worldPoint);
  
  return worldPoint || new THREE.Vector3(0, 0, 0);
};

export const findSnapPoints = (
  mousePoint: THREE.Vector3,
  completedShapes: CompletedShape[],
  shapes: Shape[],
  snapSettings: SnapSettings,
  tolerance: number,
  currentPoint?: THREE.Vector3 | null,
  currentDirection?: THREE.Vector3 | null
): SnapPoint[] => {
  const snapPoints: SnapPoint[] = [];
  
  console.log(`🎯 SNAP SEARCH: Mouse at [${mousePoint.x.toFixed(1)}, ${mousePoint.y.toFixed(1)}, ${mousePoint.z.toFixed(1)}], tolerance: ${tolerance}`);

  // 🎯 ENDPOINT SNAPPING - 3D shapes with specific handling
  if (snapSettings[SnapType.ENDPOINT]) {
    console.log(`🔍 Checking ENDPOINT snap for ${shapes.length} 3D shapes...`);
    
    shapes.forEach((shape, shapeIndex) => {
      console.log(`🔍 Shape ${shapeIndex}: ${shape.type} at [${shape.position.join(', ')}]`);
      
      if (shape.type === 'box' || shape.type === 'rectangle2d') {
        const { endpoints } = getBoxSnapPoints(shape);
        console.log(`📦 Box endpoints: ${endpoints.length} points`);
        
        endpoints.forEach((endpoint, pointIndex) => {
          const distance = mousePoint.distanceTo(endpoint);
          console.log(`   Point ${pointIndex}: [${endpoint.x.toFixed(1)}, ${endpoint.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
          
          if (distance <= tolerance) {
            console.log(`✅ ENDPOINT SNAP: Box point ${pointIndex} selected!`);
            snapPoints.push({
              point: endpoint.clone(),
              type: SnapType.ENDPOINT,
              shapeId: shape.id,
              distance
            });
          }
        });
      } else if (shape.type === 'cylinder' || shape.type === 'circle2d') {
        const { endpoints } = getCylinderSnapPoints(shape);
        console.log(`🔵 Cylinder endpoints: ${endpoints.length} points`);
        
        endpoints.forEach((endpoint, pointIndex) => {
          const distance = mousePoint.distanceTo(endpoint);
          console.log(`   Point ${pointIndex}: [${endpoint.x.toFixed(1)}, ${endpoint.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
          
          if (distance <= tolerance) {
            console.log(`✅ ENDPOINT SNAP: Cylinder point ${pointIndex} selected!`);
            snapPoints.push({
              point: endpoint.clone(),
              type: SnapType.ENDPOINT,
              shapeId: shape.id,
              distance
            });
          }
        });
      } else {
        // Fallback for other shape types using outline vertices
        const vertices = getShapeVertices(shape);
        console.log(`🔧 Generic shape vertices: ${vertices.length} points`);
        
        vertices.forEach((vertex, pointIndex) => {
          const distance = mousePoint.distanceTo(vertex);
          console.log(`   Vertex ${pointIndex}: [${vertex.x.toFixed(1)}, ${vertex.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
          
          if (distance <= tolerance) {
            console.log(`✅ ENDPOINT SNAP: Generic vertex ${pointIndex} selected!`);
            snapPoints.push({
              point: vertex.clone(),
              type: SnapType.ENDPOINT,
              shapeId: shape.id,
              distance
            });
          }
        });
      }
    });

    // 2D completed shapes endpoints
    completedShapes.forEach(shape => {
      if (!shape.points || shape.points.length === 0) return;

      shape.points.forEach((point, pointIndex) => {
        if (shape.isClosed && pointIndex === shape.points.length - 1) return;
        
        const distance = mousePoint.distanceTo(point);
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

  // 🎯 MIDPOINT SNAPPING - 3D shapes with specific handling
  if (snapSettings[SnapType.MIDPOINT]) {
    console.log(`🔍 Checking MIDPOINT snap for ${shapes.length} 3D shapes...`);
    
    shapes.forEach((shape, shapeIndex) => {
      if (shape.type === 'box' || shape.type === 'rectangle2d') {
        const { midpoints } = getBoxSnapPoints(shape);
        console.log(`📦 Box midpoints: ${midpoints.length} points`);
        
        midpoints.forEach((midpoint, pointIndex) => {
          const distance = mousePoint.distanceTo(midpoint);
          console.log(`   Midpoint ${pointIndex}: [${midpoint.x.toFixed(1)}, ${midpoint.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
          
          if (distance <= tolerance) {
            console.log(`✅ MIDPOINT SNAP: Box midpoint ${pointIndex} selected!`);
            snapPoints.push({
              point: midpoint.clone(),
              type: SnapType.MIDPOINT,
              shapeId: shape.id,
              distance
            });
          }
        });
      } else if (shape.type === 'cylinder' || shape.type === 'circle2d') {
        const { midpoints } = getCylinderSnapPoints(shape);
        console.log(`🔵 Cylinder midpoints: ${midpoints.length} points`);
        
        midpoints.forEach((midpoint, pointIndex) => {
          const distance = mousePoint.distanceTo(midpoint);
          console.log(`   Midpoint ${pointIndex}: [${midpoint.x.toFixed(1)}, ${midpoint.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
          
          if (distance <= tolerance) {
            console.log(`✅ MIDPOINT SNAP: Cylinder midpoint ${pointIndex} selected!`);
            snapPoints.push({
              point: midpoint.clone(),
              type: SnapType.MIDPOINT,
              shapeId: shape.id,
              distance
            });
          }
        });
      } else {
        // Fallback for other shape types using edge midpoints
        const edges = getShapeEdges(shape);
        console.log(`🔧 Generic shape edges: ${edges.length} edges`);
        
        edges.forEach((edge, edgeIndex) => {
          const midpoint = new THREE.Vector3().addVectors(edge.start, edge.end).multiplyScalar(0.5);
          const distance = mousePoint.distanceTo(midpoint);
          console.log(`   Edge ${edgeIndex} midpoint: [${midpoint.x.toFixed(1)}, ${midpoint.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
          
          if (distance <= tolerance) {
            console.log(`✅ MIDPOINT SNAP: Generic edge midpoint ${edgeIndex} selected!`);
            snapPoints.push({
              point: midpoint,
              type: SnapType.MIDPOINT,
              shapeId: shape.id,
              distance
            });
          }
        });
      }
    });

    // 2D completed shapes midpoints
    completedShapes.forEach(shape => {
      for (let i = 0; i < shape.points.length - 1; i++) {
        if (shape.isClosed && i === shape.points.length - 2) continue;
        
        const start = shape.points[i];
        const end = shape.points[i + 1];
        const midpoint = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
        
        const distance = mousePoint.distanceTo(midpoint);
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

  // 🎯 CENTER SNAPPING - 3D shapes with specific handling
  if (snapSettings[SnapType.CENTER]) {
    console.log(`🔍 Checking CENTER snap for ${shapes.length} 3D shapes...`);
    
    shapes.forEach((shape, shapeIndex) => {
      if (shape.type === 'box' || shape.type === 'rectangle2d') {
        const { center } = getBoxSnapPoints(shape);
        const distance = mousePoint.distanceTo(center);
        console.log(`📦 Box center: [${center.x.toFixed(1)}, ${center.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
        
        if (distance <= tolerance) {
          console.log(`✅ CENTER SNAP: Box center selected!`);
          snapPoints.push({
            point: center.clone(),
            type: SnapType.CENTER,
            shapeId: shape.id,
            distance
          });
        }
      } else if (shape.type === 'cylinder' || shape.type === 'circle2d') {
        const { center } = getCylinderSnapPoints(shape);
        const distance = mousePoint.distanceTo(center);
        console.log(`🔵 Cylinder center: [${center.x.toFixed(1)}, ${center.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
        
        if (distance <= tolerance) {
          console.log(`✅ CENTER SNAP: Cylinder center selected!`);
          snapPoints.push({
            point: center.clone(),
            type: SnapType.CENTER,
            shapeId: shape.id,
            distance
          });
        }
      } else {
        // Fallback for other shape types
        const shapeCenter = new THREE.Vector3(...shape.position);
        shapeCenter.y = 0;
        const distance = mousePoint.distanceTo(shapeCenter);
        console.log(`🔧 Generic shape center: [${shapeCenter.x.toFixed(1)}, ${shapeCenter.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
        
        if (distance <= tolerance) {
          console.log(`✅ CENTER SNAP: Generic center selected!`);
          snapPoints.push({
            point: shapeCenter,
            type: SnapType.CENTER,
            shapeId: shape.id,
            distance
          });
        }
      }
    });

    // 2D completed shapes centers
    completedShapes.forEach(shape => {
      if (shape.type === 'circle' && shape.points.length >= 2) {
        const center = shape.points[0];
        const distance = mousePoint.distanceTo(center);
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
          0,
          (shape.points[0].z + shape.points[2].z) / 2
        );
        const distance = mousePoint.distanceTo(center);
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

  // 🎯 QUADRANT SNAPPING - Only for circular shapes
  if (snapSettings[SnapType.QUADRANT]) {
    shapes.forEach(shape => {
      if (shape.type === 'cylinder' || shape.type === 'circle2d') {
        const { quadrants } = getCylinderSnapPoints(shape);
        quadrants.forEach((quadPoint, pointIndex) => {
          const distance = mousePoint.distanceTo(quadPoint);
          console.log(`🔵 Cylinder quadrant ${pointIndex}: [${quadPoint.x.toFixed(1)}, ${quadPoint.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
          
          if (distance <= tolerance) {
            console.log(`✅ QUADRANT SNAP: Cylinder quadrant ${pointIndex} selected!`);
            snapPoints.push({
              point: quadPoint,
              type: SnapType.QUADRANT,
              shapeId: shape.id,
              distance
            });
          }
        });
      }
    });

    // 2D completed shapes quadrants
    completedShapes.forEach(shape => {
      if (shape.type === 'circle' && shape.points.length >= 2) {
        const center = shape.points[0];
        const radius = center.distanceTo(shape.points[1]);
        
        const quadrants = [
          new THREE.Vector3(center.x + radius, 0, center.z),
          new THREE.Vector3(center.x - radius, 0, center.z),
          new THREE.Vector3(center.x, 0, center.z + radius),
          new THREE.Vector3(center.x, 0, center.z - radius),
        ];

        quadrants.forEach(quadPoint => {
          const distance = mousePoint.distanceTo(quadPoint);
          if (distance <= tolerance) {
            snapPoints.push({
              point: quadPoint,
              type: SnapType.QUADRANT,
              shapeId: shape.id,
              distance
            });
          }
        });
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
        
        const distance = mousePoint.distanceTo(closestPoint);
        console.log(`   Edge ${edgeIndex}: closest point [${closestPoint.x.toFixed(1)}, ${closestPoint.z.toFixed(1)}] - distance: ${distance.toFixed(1)}`);
        
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
        
        const distance = mousePoint.distanceTo(closestPoint);
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
              const distance = mousePoint.distanceTo(intersection);
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
          const distance = mousePoint.distanceTo(intersection);
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
              const distance = mousePoint.distanceTo(intersection);
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
          
          const distance = mousePoint.distanceTo(closestPoint);
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
          
          const distance = mousePoint.distanceTo(closestPoint);
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