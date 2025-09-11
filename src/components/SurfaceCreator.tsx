import React, { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';

interface SurfaceCreatorProps {
  vertices: THREE.Vector3[];
  onSurfaceCreated: (geometry: THREE.BufferGeometry) => void;
}

const SurfaceCreator: React.FC<SurfaceCreatorProps> = ({ vertices, onSurfaceCreated }) => {
  const { scene } = useThree();

  useEffect(() => {
    if (vertices.length < 3) return;

    console.log(`🎯 Creating surface from ${vertices.length} vertices`);

    try {
      // Create a surface from selected vertices using Delaunay triangulation
      const geometry = createSurfaceFromVertices(vertices);
      
      // Create preview mesh
      const material = new THREE.MeshBasicMaterial({ 
        color: 0x00ff00, 
        transparent: true, 
        opacity: 0.7,
        side: THREE.DoubleSide,
        wireframe: false
      });
      
      const mesh = new THREE.Mesh(geometry, material);
      scene.add(mesh);
      
      // Call callback
      onSurfaceCreated(geometry);
      
      console.log('✅ Surface created successfully');
      
      // Remove preview after 3 seconds
      setTimeout(() => {
        scene.remove(mesh);
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      }, 3000);
      
    } catch (error) {
      console.error('❌ Failed to create surface:', error);
    }
  }, [vertices, scene, onSurfaceCreated]);

  return null;
};

// Create surface geometry from vertices
const createSurfaceFromVertices = (vertices: THREE.Vector3[]): THREE.BufferGeometry => {
  if (vertices.length < 3) {
    throw new Error('Need at least 3 vertices to create a surface');
  }

  // Calculate centroid
  const centroid = new THREE.Vector3();
  vertices.forEach(v => centroid.add(v));
  centroid.divideScalar(vertices.length);

  // Calculate normal using first 3 vertices
  const v1 = new THREE.Vector3().subVectors(vertices[1], vertices[0]);
  const v2 = new THREE.Vector3().subVectors(vertices[2], vertices[0]);
  const normal = new THREE.Vector3().crossVectors(v1, v2).normalize();

  // Create local coordinate system
  const up = Math.abs(normal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3().crossVectors(up, normal).normalize();
  const bitangent = new THREE.Vector3().crossVectors(normal, tangent).normalize();

  // Project vertices to 2D plane
  const vertices2D: THREE.Vector2[] = vertices.map(vertex => {
    const relative = vertex.clone().sub(centroid);
    const x = relative.dot(tangent);
    const y = relative.dot(bitangent);
    return new THREE.Vector2(x, y);
  });

  // Simple triangulation - fan triangulation from centroid
  const triangles: number[] = [];
  for (let i = 0; i < vertices2D.length; i++) {
    const next = (i + 1) % vertices2D.length;
    // Create triangle: centroid, current vertex, next vertex
    triangles.push(vertices.length, i, next); // centroid index is vertices.length
  }

  // Create geometry
  const geometry = new THREE.BufferGeometry();
  
  // Add centroid to vertices list for geometry creation
  const allVertices = [...vertices, centroid];
  const positions = new Float32Array(allVertices.length * 3);
  
  allVertices.forEach((vertex, i) => {
    positions[i * 3] = vertex.x;
    positions[i * 3 + 1] = vertex.y;
    positions[i * 3 + 2] = vertex.z;
  });

  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  geometry.setIndex(triangles);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
};

export default SurfaceCreator;