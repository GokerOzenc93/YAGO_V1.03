import * as THREE from 'three';
import { CompletedShape } from './types';
import { Shape } from '../../types/shapes';
import { createPolylineGeometry } from './geometryCreator';
import { calculatePolylineCenter } from './utils';

export const convertTo3DShape = (
  shape: CompletedShape,
  addShape: (shape: Shape) => void,
  selectShape: (id: string) => void,
  gridSize: number = 50
): Shape | null => {
  // Allow all shape types to be converted to selectable objects
  console.log(`Converting ${shape.type} to selectable 2D shape with ID: ${shape.id}`);

  const height = 10; // Minimal height for 2D shapes
  let geometry: THREE.BufferGeometry;
  let position: [number, number, number];
  let shapeType: string;

  console.log(`Converting ${shape.type} to 3D selectable shape with ID: ${shape.id}`);

  switch (shape.type) {
    case 'rectangle': {
      const width = Math.abs(shape.points[2].x - shape.points[0].x);
      const depth = Math.abs(shape.points[2].z - shape.points[0].z);
      geometry = new THREE.BoxGeometry(width, height, depth);
      position = [
        shape.points[0].x + width / 2,
        height / 2,
        shape.points[0].z + depth / 2
      ];
      shapeType = 'rectangle2d';
      break;
    }
    case 'circle': {
      const radius = shape.points[0].distanceTo(shape.points[1]);
      geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      position = [shape.points[0].x, height / 2, shape.points[0].z];
      shapeType = 'circle2d';
      break;
    }
    case 'polyline':
    case 'polygon': {
      geometry = createPolylineGeometry(shape.points, height, gridSize);
      const center = calculatePolylineCenter(shape.points);
      position = [center.x, height / 2, center.z]; // Position at proper height
      shapeType = shape.type === 'polygon' ? 'polygon2d' : 'polyline2d';
      break;
    }
    default:
      return null;
  }

  const newShape: Shape = {
    id: shape.id,
    type: shapeType,
    position: position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    geometry,
    parameters: shape.type === 'circle' 
      ? { radius: shape.points[0].distanceTo(shape.points[1]), height }
      : shape.type === 'rectangle'
      ? { 
          width: Math.abs(shape.points[2].x - shape.points[0].x),
          height,
          depth: Math.abs(shape.points[2].z - shape.points[0].z)
        }
      : { 
          points: shape.points.length,
          height,
          area: 'calculated'
        },
    originalPoints: shape.points,
    is2DShape: true,
  };

  addShape(newShape);
  selectShape(newShape.id);

  console.log(`2D shape converted to 3D selectable shape at GROUND LEVEL: [${position.join(', ')}]`);
  return newShape;
};

export const extrudeShape = (
  shape: CompletedShape,
  addShape: (shape: Shape) => void,
  height: number = 500,
  gridSize: number = 50
): Shape | null => {
  let geometry: THREE.BufferGeometry;
  let position: [number, number, number];
  let shapeType: string;

  console.log(`Extruding ${shape.type} shape with ID: ${shape.id}`);

  switch (shape.type) {
    case 'rectangle': {
      const width = Math.abs(shape.points[2].x - shape.points[0].x);
      const depth = Math.abs(shape.points[2].z - shape.points[0].z);
      geometry = new THREE.BoxGeometry(width, height, depth);
      position = [
        shape.points[0].x + width / 2,
        height / 2,
        shape.points[0].z + depth / 2
      ];
      shapeType = 'box';
      console.log(`Rectangle extruded: ${width}x${height}x${depth}mm`);
      break;
    }
    case 'circle': {
      const radius = shape.points[0].distanceTo(shape.points[1]);
      geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      position = [shape.points[0].x, height / 2, shape.points[0].z];
      shapeType = 'cylinder';
      console.log(`Circle extruded: radius ${radius}mm, height ${height}mm`);
      break;
    }
    case 'polyline':
    case 'polygon': {
      // Create centered geometry
      geometry = createPolylineGeometry(shape.points, height, gridSize);
      
      // Calculate the center of the original polyline points for positioning
      const center = calculatePolylineCenter(shape.points);
      position = [center.x, height / 2, center.z]; // Position at polyline center with proper Y offset
      
      shapeType = shape.type === 'polygon' ? 'polygon3d' : 'polyline3d';
      console.log(`${shape.type} extruded: ${shape.points.length} points, height ${height}mm at position [${position.join(', ')}]`);
      break;
    }
    default:
      console.warn(`Cannot extrude shape type: ${shape.type}`);
      return null;
  }

  const newShape: Shape = {
    id: Math.random().toString(36).substr(2, 9),
    type: shapeType,
    position: position,
    rotation: [0, 0, 0],
    scale: [1, 1, 1],
    geometry,
    parameters: shape.type === 'circle' 
      ? { radius: shape.points[0].distanceTo(shape.points[1]), height }
      : shape.type === 'rectangle'
      ? { 
          width: Math.abs(shape.points[2].x - shape.points[0].x),
          height,
          depth: Math.abs(shape.points[2].z - shape.points[0].z)
        }
      : {
          points: shape.points.length,
          height,
          area: 'calculated'
        },
  };

  addShape(newShape);
  console.log(`3D shape created with ID: ${newShape.id}`);
  return newShape;
};