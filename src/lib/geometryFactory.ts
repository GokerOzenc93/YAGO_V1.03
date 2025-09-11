import * as THREE from 'three';
import { Shape } from '../types/shapes';

export class GeometryFactory {
  static createBox(width: number, height: number, depth: number): THREE.BufferGeometry {
    return new THREE.BoxGeometry(width, height, depth);
  }

  static createCylinder(radius: number, height: number, segments: number = 32): THREE.BufferGeometry {
    return new THREE.CylinderGeometry(radius, radius, height, segments);
  }

  static createSphere(radius: number, widthSegments: number = 32, heightSegments: number = 16): THREE.BufferGeometry {
    return new THREE.SphereGeometry(radius, widthSegments, heightSegments);
  }

  static createPlane(width: number, height: number): THREE.BufferGeometry {
    return new THREE.PlaneGeometry(width, height);
  }

  static createFromShape(shape: Shape): THREE.BufferGeometry {
    // If shape already has geometry, return it
    if (shape.geometry) {
      return shape.geometry;
    }

    // Create geometry based on shape type and parameters
    switch (shape.type) {
      case 'box':
        return this.createBox(
          shape.parameters.width || 500,
          shape.parameters.height || 500,
          shape.parameters.depth || 500
        );
      
      case 'cylinder':
        return this.createCylinder(
          shape.parameters.radius || 250,
          shape.parameters.height || 500
        );
      
      case 'sphere':
        return this.createSphere(
          shape.parameters.radius || 250
        );
      
      default:
        console.warn(`Unknown shape type: ${shape.type}, creating default box`);
        return this.createBox(500, 500, 500);
    }
  }
}