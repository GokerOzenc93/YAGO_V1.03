import * as THREE from 'three';
import { CompletedShape, SnapPoint } from './types';
import { SnapType, SnapSettings } from '../../store/appStore';
import { Shape } from '../../types/shapes';
import { findLineIntersection } from './utils';

// Helper function to get edges from 3D shape geometry
const getShapeEdges = (shape: Shape): THREE.Line3[] => {
  const edges: THREE.Line3[] = [];
  const geometry = shape.geometry;
  
  if (!geometry.attributes.position) return edges;
  
  // Create edges geometry to get the outline edges
  const edgesGeometry = new THREE.EdgesGeometry(geometry);
  const positions = edgesGeometry.attributes.position;
  
  // Transform matrix for shape position, rotation, scale
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(...shape.position),
    new THREE.Euler(...shape.rotation),
    new THREE.Vector3(...shape.scale)
  );
  
  // Extract edge lines
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

// Helper function to get vertices from 3D shape geometry
const getShapeVertices = (shape: Shape): THREE.Vector3[] => {
  const vertices: THREE.Vector3[] = [];
  const geometry = shape.geometry;
  
  if (!geometry.attributes.position) return vertices;
  
  // Transform matrix for shape position, rotation, scale
  const matrix = new THREE.Matrix4();
  matrix.compose(
    new THREE.Vector3(...shape.position),
    new THREE.Euler(...shape.rotation),
    new THREE.Vector3(...shape.scale)
  );
  
  // Get unique vertices by using a Set with string keys
  const uniqueVertices = new Map<string, THREE.Vector3>();
  const positions = geometry.attributes.position;
  
  for (let i = 0; i < positions.count; i++) {
    const vertex = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(matrix);
    
    // Project to XZ plane (Y = 0) for 2D drawing
    vertex.y = 0;
    
    // Use rounded coordinates as key to avoid duplicates
    const key = `${Math.round(vertex.x)},${Math.round(vertex.z)}`;
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
  
  // Get box parameters
  const width = shape.parameters.width || 500;
  const height = shape.parameters.height || 500;
  const depth = shape.parameters.depth || 500;
  
  // Apply scale
  const scaledWidth = width * shape.scale[0];
  const scaledHeight = height * shape.scale[1];
  const scaledDepth = depth * shape.scale[2];
  
  const [x, y, z] = shape.position;
  
  // Calculate 8 corner points (endpoints) - projected to Y=0
  const corners = [
    new THREE.Vector3(x - scaledWidth/2, 0, z - scaledDepth/2), // Bottom-left-front
    new THREE.Vector3(x + scaledWidth/2, 0, z - scaledDepth/2), // Bottom-right-front
    new THREE.Vector3(x + scaledWidth/2, 0, z + scaledDepth/2), // Bottom-right-back
    new THREE.Vector3(x - scaledWidth/2, 0, z + scaledDepth/2), // Bottom-left-back
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
  
  console.log(`🎯 SNAP DEBUG: Looking for snap points near [${mousePoint.x.toFixed(1)}, ${mousePoint.z.toFixed(1)}] with tolerance ${tolerance}`);
  console.log(`🎯 SNAP DEBUG: Available 3D shapes: ${shapes.length}`);

  // Endpoint snapping
  if (snapSettings[SnapType.ENDPOINT]) {
    // 2D completed shapes
    completedShapes.forEach(shape => {
      if (!shape.points || shape.points.length === 0) return;

      shape.points.forEach((point, index) => {
        if (shape.isClosed && index === shape.points.length - 1) return;
        
        const distance = mousePoint.distanceTo(point);
        if (distance <= tolerance) {
          snapPoints.push({
            point: point.clone(),
            type: SnapType.ENDPOINT,
            shapeId: shape.id,
            distance
          });
        }
      });
    });

    // 3D shapes - specific handling for each shape type
    shapes.forEach(shape => {
      console.log(`🎯 SNAP DEBUG: Checking endpoints for shape ${shape.id} (${shape.type})`);
      
      if (shape.type === 'box' || shape.type === 'rectangle2d') {
        const { endpoints } = getBoxSnapPoints(shape);
        console.log(`🎯 SNAP DEBUG: Box has ${endpoints.length} endpoints`);
        endpoints.forEach(endpoint => {
          const distance = mousePoint.distanceTo(endpoint);
          console.log(`🎯 SNAP DEBUG: Endpoint at [${endpoint.x.toFixed(1)}, ${endpoint.z.toFixed(1)}], distance: ${distance.toFixed(1)}`);
          if (distance <= tolerance) {
            console.log(`🎯 SNAP DEBUG: ✅ ENDPOINT SNAP FOUND!`);
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
        console.log(`🎯 SNAP DEBUG: Cylinder has ${endpoints.length} endpoints`);
        endpoints.forEach(endpoint => {
          const distance = mousePoint.distanceTo(endpoint);
          console.log(`🎯 SNAP DEBUG: Cylinder endpoint at [${endpoint.x.toFixed(1)}, ${endpoint.z.toFixed(1)}], distance: ${distance.toFixed(1)}`);
          if (distance <= tolerance) {
            console.log(`🎯 SNAP DEBUG: ✅ CYLINDER ENDPOINT SNAP FOUND!`);
            snapPoints.push({
              point: endpoint.clone(),
              type: SnapType.ENDPOINT,
              shapeId: shape.id,
              distance
            });
          }
        });
      } else {
        // Fallback for other shape types
        const vertices = getShapeVertices(shape);
        vertices.forEach(vertex => {
          const distance = mousePoint.distanceTo(vertex);
          if (distance <= tolerance) {
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
  }

  // Midpoint snapping
  if (snapSettings[SnapType.MIDPOINT]) {
    // 2D completed shapes
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

    // 3D shapes - specific handling for each shape type
    shapes.forEach(shape => {
      console.log(`🎯 SNAP DEBUG: Checking midpoints for shape ${shape.id} (${shape.type})`);
      
      if (shape.type === 'box' || shape.type === 'rectangle2d') {
        const { midpoints } = getBoxSnapPoints(shape);
        console.log(`🎯 SNAP DEBUG: Box has ${midpoints.length} midpoints`);
        midpoints.forEach(midpoint => {
          const distance = mousePoint.distanceTo(midpoint);
          console.log(`🎯 SNAP DEBUG: Midpoint at [${midpoint.x.toFixed(1)}, ${midpoint.z.toFixed(1)}], distance: ${distance.toFixed(1)}`);
          if (distance <= tolerance) {
            console.log(`🎯 SNAP DEBUG: ✅ MIDPOINT SNAP FOUND!`);
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
        midpoints.forEach(midpoint => {
          const distance = mousePoint.distanceTo(midpoint);
          if (distance <= tolerance) {
            snapPoints.push({
              point: midpoint.clone(),
              type: SnapType.MIDPOINT,
              shapeId: shape.id,
              distance
            });
          }
        });
      } else {
        // Fallback for other shape types
        const edges = getShapeEdges(shape);
        edges.forEach(edge => {
          const midpoint = new THREE.Vector3().addVectors(edge.start, edge.end).multiplyScalar(0.5);
          const distance = mousePoint.distanceTo(midpoint);
          if (distance <= tolerance) {
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
  }

  // Center snapping
  if (snapSettings[SnapType.CENTER]) {
    // 2D completed shapes
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

    // 3D shapes - specific handling for each shape type
    shapes.forEach(shape => {
      console.log(`🎯 SNAP DEBUG: Checking center for shape ${shape.id} (${shape.type})`);
      
      if (shape.type === 'box' || shape.type === 'rectangle2d') {
        const { center } = getBoxSnapPoints(shape);
        const distance = mousePoint.distanceTo(center);
        console.log(`🎯 SNAP DEBUG: Box center at [${center.x.toFixed(1)}, ${center.z.toFixed(1)}], distance: ${distance.toFixed(1)}`);
        if (distance <= tolerance) {
          console.log(`🎯 SNAP DEBUG: ✅ CENTER SNAP FOUND!`);
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
        console.log(`🎯 SNAP DEBUG: Cylinder center at [${center.x.toFixed(1)}, ${center.z.toFixed(1)}], distance: ${distance.toFixed(1)}`);
        if (distance <= tolerance) {
          console.log(`🎯 SNAP DEBUG: ✅ CYLINDER CENTER SNAP FOUND!`);
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
        if (distance <= tolerance) {
          snapPoints.push({
            point: shapeCenter,
            type: SnapType.CENTER,
            shapeId: shape.id,
            distance
          });
        }
      }
    });
  }

  // Quadrant snapping
  if (snapSettings[SnapType.QUADRANT]) {
    // 2D completed shapes
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

    // 3D shapes quadrants (for cylinders and circular shapes)
    shapes.forEach(shape => {
      if (shape.type === 'cylinder' || shape.type === 'circle2d') {
        const { quadrants } = getCylinderSnapPoints(shape);
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

  // Intersection snapping
  if (snapSettings[SnapType.INTERSECTION]) {
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

  // Perpendicular snapping
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

  // Nearest point snapping
  if (snapSettings[SnapType.NEAREST]) {
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

    // 3D shape edges
    shapes.forEach(shape => {
      const edges = getShapeEdges(shape);
      edges.forEach(edge => {
        const closestPoint = new THREE.Vector3();
        edge.closestPointToPoint(mousePoint, true, closestPoint);
        
        const distance = mousePoint.distanceTo(closestPoint);
        if (distance <= tolerance) {
          snapPoints.push({
            point: closestPoint,
            type: SnapType.NEAREST,
            shapeId: shape.id,
            distance
          });
        }
      });
    });
  }

  console.log(`🎯 SNAP DEBUG: Total snap points found: ${snapPoints.length}`);
  if (snapPoints.length > 0) {
    console.log(`🎯 SNAP DEBUG: Closest snap: ${snapPoints[0].type} at distance ${snapPoints[0].distance.toFixed(1)}`);
  }

  return snapPoints.sort((a, b) => a.distance - b.distance);
};