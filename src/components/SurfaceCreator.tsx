import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/appStore';

interface SurfaceCreatorProps {
  faces: number[];
  shape: any;
  onSurfaceCreated: (geometry: THREE.BufferGeometry) => void;
}

const SurfaceCreator: React.FC<SurfaceCreatorProps> = ({ faces, shape, onSurfaceCreated }) => {
  const { scene } = useThree();
  const { addShape, selectShape } = useAppStore();

  useEffect(() => {
    if (faces.length < 1) return;

    console.log(`🎯 Creating unified surface from ${faces.length} faces`);

    try {
    if (!shape.geometry) {
      console.error('❌ Shape geometry is undefined');
      return;
    }

      // Create unified surface from selected faces
      const geometry = createUnifiedSurfaceFromFaces(faces, shape);
      
      // Create preview mesh
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        transparent: true, 
        opacity: 0.8,
        side: THREE.DoubleSide,
        wireframe: false
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      
      // Call callback
      onSurfaceCreated(geometry);
      
      console.log('✅ Unified surface created successfully');
      
      // Create selectable shape from the surface after 2 seconds
      setTimeout(() => {
        // Calculate surface center for positioning
        geometry.computeBoundingBox();
        const center = new THREE.Vector3();
        if (geometry.boundingBox) {
          geometry.boundingBox.getCenter(center);
        }
        
        // Create a new selectable shape from the surface
        const newShape = {
          id: Math.random().toString(36).substr(2, 9),
          type: 'surface',
          position: [center.x, center.y, center.z] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          scale: [1, 1, 1] as [number, number, number],
          geometry: geometry.clone(),
          parameters: {
            faceCount: faces.length,
            sourceShapeId: shape.id,
            createdFromFaces: true,
          },
        };
        
        // Add the new shape to the scene
        addShape(newShape);
        selectShape(newShape.id);
        
        console.log(`🎯 Surface converted to selectable shape: ${newShape.id}`);
        
        // Remove preview mesh
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }, 2000);
      
    } catch (error) {
      console.error('❌ Failed to create unified surface:', error);
    }
  }, [faces, shape, scene, onSurfaceCreated]);

  return null;
};

// Create unified surface geometry from selected faces
const createUnifiedSurfaceFromFaces = (faceIndices: number[], shape: any): THREE.BufferGeometry => {
  if (faceIndices.length < 1) {
    throw new Error('Need at least 1 face to create a surface');
  }

  const originalGeometry = shape.geometry as THREE.BufferGeometry;
  const position = originalGeometry.attributes.position;
  const index = originalGeometry.index;

  if (!position || !index) {
    throw new Error('Geometry must have position attribute and index');
  }

  // Create transform matrix for shape
  const matrix = new THREE.Matrix4();
  const quaternion = shape.quaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation));
  matrix.compose(
    new THREE.Vector3(...shape.position),
    quaternion,
    new THREE.Vector3(...shape.scale)
  );

  // Collect all vertices from selected faces
  const vertices: THREE.Vector3[] = [];
  const faceVertices: THREE.Vector3[][] = [];

  faceIndices.forEach(faceIndex => {
    const a = index.getX(faceIndex * 3);
    const b = index.getX(faceIndex * 3 + 1);
    const c = index.getX(faceIndex * 3 + 2);

    const va = new THREE.Vector3().fromBufferAttribute(position, a).applyMatrix4(matrix);
    const vb = new THREE.Vector3().fromBufferAttribute(position, b).applyMatrix4(matrix);
    const vc = new THREE.Vector3().fromBufferAttribute(position, c).applyMatrix4(matrix);

    faceVertices.push([va, vb, vc]);
    vertices.push(va, vb, vc);
  });

  // Create new geometry with all face vertices
  const newGeometry = new THREE.BufferGeometry();
  
  const positions = new Float32Array(vertices.length * 3);
  vertices.forEach((vertex, i) => {
    positions[i * 3] = vertex.x;
    positions[i * 3 + 1] = vertex.y;
    positions[i * 3 + 2] = vertex.z;
  });

  // Create indices for triangles
  const indices: number[] = [];
  for (let i = 0; i < vertices.length; i += 3) {
    indices.push(i, i + 1, i + 2);
  }

  newGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  newGeometry.setIndex(indices);
  newGeometry.computeVertexNormals();
  newGeometry.computeBoundingBox();
  newGeometry.computeBoundingSphere();

  console.log(`🎯 Unified surface created with ${faceIndices.length} faces (${vertices.length} vertices, ${indices.length / 3} triangles)`);

  return newGeometry;
};

export default SurfaceCreator;