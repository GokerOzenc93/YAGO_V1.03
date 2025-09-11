import React, { useState, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/appStore';
import { Shape } from '../types/shapes';

interface VertexSelectorProps {
  shape: Shape;
  isActive: boolean;
  onVerticesSelected: (vertices: THREE.Vector3[]) => void;
}

const VertexSelector: React.FC<VertexSelectorProps> = ({ shape, isActive, onVerticesSelected }) => {
  const { camera, gl, scene } = useThree();
  const [selectedVertices, setSelectedVertices] = useState<THREE.Vector3[]>([]);
  const [vertexMarkers, setVertexMarkers] = useState<THREE.Mesh[]>([]);
  const raycaster = useRef(new THREE.Raycaster());
  const tempMesh = useRef<THREE.Mesh | null>(null);

  // Create vertex markers for visualization
  useEffect(() => {
    if (!isActive || !shape.geometry) return;

    // Clear existing markers
    vertexMarkers.forEach(marker => {
      scene.remove(marker);
      marker.geometry.dispose();
      (marker.material as THREE.Material).dispose();
    });

    // Get all vertices from geometry
    const geometry = shape.geometry;
    const positions = geometry.attributes.position;
    if (!positions) return;

    const newMarkers: THREE.Mesh[] = [];
    const vertices: THREE.Vector3[] = [];

    // Create transform matrix for shape
    const matrix = new THREE.Matrix4();
    const quaternion = shape.quaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation));
    matrix.compose(
      new THREE.Vector3(...shape.position),
      quaternion,
      new THREE.Vector3(...shape.scale)
    );

    // Get unique vertices
    const uniqueVertices = new Map<string, THREE.Vector3>();
    const precision = 1000;

    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(positions, i);
      vertex.applyMatrix4(matrix); // Transform to world space

      const key = `${Math.round(vertex.x * precision)},${Math.round(vertex.y * precision)},${Math.round(vertex.z * precision)}`;
      if (!uniqueVertices.has(key)) {
        uniqueVertices.set(key, vertex);
        vertices.push(vertex);

        // Create vertex marker
        const markerGeometry = new THREE.SphereGeometry(8, 8, 8);
        const markerMaterial = new THREE.MeshBasicMaterial({ 
          color: 0xffff00, 
          transparent: true, 
          opacity: 0.8,
          depthTest: false
        });
        const marker = new THREE.Mesh(markerGeometry, markerMaterial);
        marker.position.copy(vertex);
        marker.userData = { vertex, index: vertices.length - 1 };
        
        scene.add(marker);
        newMarkers.push(marker);
      }
    }

    setVertexMarkers(newMarkers);

    return () => {
      newMarkers.forEach(marker => {
        scene.remove(marker);
        marker.geometry.dispose();
        (marker.material as THREE.Material).dispose();
      });
    };
  }, [isActive, shape, scene]);

  // Handle vertex selection
  const handlePointerDown = (event: PointerEvent) => {
    if (!isActive || event.button !== 0) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.current.setFromCamera(mouse, camera);
    const intersects = raycaster.current.intersectObjects(vertexMarkers);

    if (intersects.length > 0) {
      const marker = intersects[0].object as THREE.Mesh;
      const vertex = marker.userData.vertex as THREE.Vector3;
      
      // Toggle vertex selection
      const isSelected = selectedVertices.some(v => v.distanceTo(vertex) < 0.1);
      
      if (isSelected) {
        // Deselect vertex
        const newSelected = selectedVertices.filter(v => v.distanceTo(vertex) >= 0.1);
        setSelectedVertices(newSelected);
        (marker.material as THREE.MeshBasicMaterial).color.setHex(0xffff00);
      } else {
        // Select vertex
        const newSelected = [...selectedVertices, vertex];
        setSelectedVertices(newSelected);
        (marker.material as THREE.MeshBasicMaterial).color.setHex(0xff0000);
      }
    }
  };

  // Handle Enter key to create surface
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && isActive && selectedVertices.length >= 3) {
        console.log(`🎯 Creating surface from ${selectedVertices.length} selected vertices`);
        onVerticesSelected(selectedVertices);
        
        // Clear selection
        setSelectedVertices([]);
        vertexMarkers.forEach(marker => {
          (marker.material as THREE.MeshBasicMaterial).color.setHex(0xffff00);
        });
      }
    };

    if (isActive) {
      window.addEventListener('keydown', handleKeyDown);
      gl.domElement.addEventListener('pointerdown', handlePointerDown);
    }

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      gl.domElement.removeEventListener('pointerdown', handlePointerDown);
    };
  }, [isActive, selectedVertices, onVerticesSelected, vertexMarkers, gl.domElement]);

  return null;
};

export default VertexSelector;