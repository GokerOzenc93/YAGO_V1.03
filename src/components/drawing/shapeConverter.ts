import * as THREE from 'three';
import { CompletedShape } from './types';
import { Shape } from '../../types/shapes';
import { createPolylineGeometry } from './geometryCreator';
import { calculatePolylineCenter } from './utils';

export const convertTo3DShape = (
  shape: CompletedShape,
  addShape: (shape: Shape) => void,
  selectShape: (id: string) => void,
  gridSize: number = 50,
  drawingView?: string
): Shape | null => {
  if (!shape.isClosed && shape.type !== 'polyline' && shape.type !== 'polygon') return null;

  const height = 10;
  let geometry: THREE.BufferGeometry;
  let position: [number, number, number];
  let shapeType: string;
  
  // Ön görünüşten çizim kontrolü
  const isFromFrontView = drawingView === 'front' || drawingView === 'back';

  console.log(`Converting ${shape.type} to 3D selectable shape with ID: ${shape.id}`);
  if (isFromFrontView) {
    console.log(`🎯 Front view drawing detected - will extrude forward`);
  }

  switch (shape.type) {
    case 'rectangle': {
      const width = Math.abs(shape.points[2].x - shape.points[0].x);
      
      if (isFromFrontView) {
        // Ön görünüşten: Y ekseni height, Z ekseni depth (öne doğru)
        const rectHeight = Math.abs(shape.points[2].y - shape.points[0].y);
        const depth = height; // Sabit derinlik öne doğru
        geometry = new THREE.BoxGeometry(width, rectHeight, depth);
        position = [
          shape.points[0].x + width / 2,
          shape.points[0].y + rectHeight / 2,
          depth / 2 // Öne doğru extrude
        ];
      } else {
        // Üst görünüş: Normal davranış
        const depth = Math.abs(shape.points[2].z - shape.points[0].z);
        geometry = new THREE.BoxGeometry(width, height, depth);
        position = [
          shape.points[0].x + width / 2,
          height / 2,
          shape.points[0].z + depth / 2
        ];
      }
      shapeType = 'rectangle2d';
      break;
    }
    case 'circle': {
      const radius = shape.points[0].distanceTo(shape.points[1]);
      geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      
      if (isFromFrontView) {
        // Ön görünüşten: Silindir yatay (Z ekseni boyunca)
        geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
        geometry.rotateZ(Math.PI / 2); // Yatay hale getir
        position = [shape.points[0].x, shape.points[0].y, height / 2];
      } else {
        // Üst görünüş: Normal dikey silindir
        position = [shape.points[0].x, height / 2, shape.points[0].z];
      }
      shapeType = 'circle2d';
      break;
    }
    case 'polyline':
    case 'polygon': {
      geometry = createPolylineGeometry(shape.points, height, gridSize, isFromFrontView);
      const center = calculatePolylineCenter(shape.points);
      
      if (isFromFrontView) {
        // Ön görünüşten: XY düzleminde çizildi, Z ekseni boyunca extrude
        position = [center.x, center.y, height / 2];
      } else {
        // Üst görünüş: XZ düzleminde çizildi, Y ekseni boyunca extrude
        position = [center.x, 0, center.z];
      }
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

  console.log(`2D shape converted to 3D selectable shape at: [${position.join(', ')}]${isFromFrontView ? ' (FRONT VIEW - EXTRUDED FORWARD)' : ' (TOP VIEW)'}`);
  return newShape;
};

export const extrudeShape = (
  shape: CompletedShape,
  addShape: (shape: Shape) => void,
  height: number = 500,
  gridSize: number = 50,
  drawingView: string = 'top'
): Shape | null => {
  let geometry: THREE.BufferGeometry;
  let position: [number, number, number];
  let shapeType: string;
  
  // Ön görünüşten çizim kontrolü
  const isFromFrontView = drawingView === 'front' || drawingView === 'back';

  console.log(`Extruding ${shape.type} shape with ID: ${shape.id} from ${drawingView} view`);

  switch (shape.type) {
    case 'rectangle': {
      const width = Math.abs(shape.points[2].x - shape.points[0].x);
      
      if (isFromFrontView) {
        // Ön görünüşten: Y ekseni height, Z ekseni depth (öne doğru)
        const rectHeight = Math.abs(shape.points[2].y - shape.points[0].y);
        geometry = new THREE.BoxGeometry(width, rectHeight, height);
        position = [
          shape.points[0].x + width / 2,
          shape.points[0].y + rectHeight / 2,
          height / 2 // Öne doğru extrude
        ];
      } else {
        // Üst görünüş: Normal davranış
        const depth = Math.abs(shape.points[2].z - shape.points[0].z);
        geometry = new THREE.BoxGeometry(width, height, depth);
        position = [
          shape.points[0].x + width / 2,
          height / 2,
          shape.points[0].z + depth / 2
        ];
      }
      shapeType = 'box';
      console.log(`Rectangle extruded from ${drawingView} view`);
      break;
    }
    case 'circle': {
      const radius = shape.points[0].distanceTo(shape.points[1]);
      geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
      
      if (isFromFrontView) {
        // Ön görünüşten: Silindir yatay (Z ekseni boyunca)
        geometry.rotateZ(Math.PI / 2); // Yatay hale getir
        position = [shape.points[0].x, shape.points[0].y, height / 2];
      } else {
        // Üst görünüş: Normal dikey silindir
        position = [shape.points[0].x, height / 2, shape.points[0].z];
      }
      shapeType = 'cylinder';
      console.log(`Circle extruded from ${drawingView} view: radius ${radius}mm, height ${height}mm`);
      break;
    }
    case 'polyline':
    case 'polygon': {
      // Create centered geometry
      geometry = createPolylineGeometry(shape.points, height, gridSize, isFromFrontView);
      
      // Calculate the center of the original polyline points for positioning
      const center = calculatePolylineCenter(shape.points);
      
      if (isFromFrontView) {
        // Ön görünüşten: XY düzleminde çizildi, Z ekseni boyunca extrude
        position = [center.x, center.y, height / 2];
      } else {
        // Üst görünüş: XZ düzleminde çizildi, Y ekseni boyunca extrude
        position = [center.x, height / 2, center.z];
      }
      
      shapeType = shape.type === 'polygon' ? 'polygon3d' : 'polyline3d';
      console.log(`${shape.type} extruded from ${drawingView} view: ${shape.points.length} points, height ${height}mm at position [${position.join(', ')}]`);
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
  console.log(`3D shape created with ID: ${newShape.id} from ${drawingView} view`);
  return newShape;
};