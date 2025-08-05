import * as THREE from 'three';

/**
 * Creates an extruded panel geometry based on face vertices, normal, and thickness
 * @param faceVertices - Array of vertices defining the face
 * @param faceNormal - Normal vector of the face
 * @param thickness - Thickness of the panel
 * @returns Object containing geometry, position, and rotation
 */
export const createExtrudedPanelGeometry = (
  faceVertices: THREE.Vector3[],
  faceNormal: THREE.Vector3,
  thickness: number
): {
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  rotation: THREE.Euler;
} => {
  try {
    // Calculate face center
    const center = new THREE.Vector3();
    faceVertices.forEach(vertex => center.add(vertex));
    center.divideScalar(faceVertices.length);

    // Create a 2D shape from the face vertices
    const shape = new THREE.Shape();
    
    if (faceVertices.length < 3) {
      // Fallback for insufficient vertices
      const geometry = new THREE.BoxGeometry(100, thickness, 100);
      return {
        geometry,
        position: center,
        rotation: new THREE.Euler(0, 0, 0)
      };
    }

    // Project vertices to 2D plane based on face normal
    const projectedVertices = projectVerticesTo2D(faceVertices, faceNormal);
    
    // Create shape from projected vertices
    if (projectedVertices.length > 0) {
      shape.moveTo(projectedVertices[0].x, projectedVertices[0].y);
      for (let i = 1; i < projectedVertices.length; i++) {
        shape.lineTo(projectedVertices[i].x, projectedVertices[i].y);
      }
      shape.lineTo(projectedVertices[0].x, projectedVertices[0].y); // Close shape
    }

    // Create extrude settings
    const extrudeSettings = {
      depth: thickness,
      bevelEnabled: false,
      steps: 1,
      curveSegments: 8
    };

    // Create extruded geometry
    const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);

    // Calculate rotation based on face normal
    const rotation = calculateRotationFromNormal(faceNormal);

    // Position the panel at the face center, offset by half thickness along normal
    const position = center.clone().add(faceNormal.clone().multiplyScalar(thickness / 2));

    return {
      geometry,
      position,
      rotation
    };

  } catch (error) {
    console.warn('Failed to create extruded panel geometry, using fallback:', error);
    
    // Fallback geometry
    const fallbackGeometry = new THREE.BoxGeometry(100, thickness, 100);
    const center = new THREE.Vector3();
    faceVertices.forEach(vertex => center.add(vertex));
    center.divideScalar(faceVertices.length);
    
    return {
      geometry: fallbackGeometry,
      position: center,
      rotation: new THREE.Euler(0, 0, 0)
    };
  }
};

/**
 * Projects 3D vertices to 2D plane based on face normal
 */
const projectVerticesTo2D = (vertices: THREE.Vector3[], normal: THREE.Vector3): THREE.Vector2[] => {
  const projected: THREE.Vector2[] = [];
  
  // Determine the best projection plane based on normal
  const absNormal = new THREE.Vector3(Math.abs(normal.x), Math.abs(normal.y), Math.abs(normal.z));
  
  for (const vertex of vertices) {
    let projected2D: THREE.Vector2;
    
    if (absNormal.z > absNormal.x && absNormal.z > absNormal.y) {
      // Project to XY plane (normal mostly in Z direction)
      projected2D = new THREE.Vector2(vertex.x, vertex.y);
    } else if (absNormal.y > absNormal.x) {
      // Project to XZ plane (normal mostly in Y direction)
      projected2D = new THREE.Vector2(vertex.x, vertex.z);
    } else {
      // Project to YZ plane (normal mostly in X direction)
      projected2D = new THREE.Vector2(vertex.y, vertex.z);
    }
    
    projected.push(projected2D);
  }
  
  return projected;
};

/**
 * Calculates rotation from face normal vector
 */
const calculateRotationFromNormal = (normal: THREE.Vector3): THREE.Euler => {
  // Create a quaternion that rotates from default normal (0,0,1) to face normal
  const defaultNormal = new THREE.Vector3(0, 0, 1);
  const quaternion = new THREE.Quaternion().setFromUnitVectors(defaultNormal, normal.clone().normalize());
  
  // Convert quaternion to Euler angles
  const euler = new THREE.Euler().setFromQuaternion(quaternion);
  
  return euler;
};