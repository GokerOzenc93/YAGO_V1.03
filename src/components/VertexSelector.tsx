import React, { useState, useEffect, useRef } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/appStore';
import { Shape } from '../types/shapes';

interface FaceSelectorProps {
  shape: Shape;
  isActive: boolean;
  onFacesSelected: (faces: number[]) => void;
}

const FaceSelector: React.FC<FaceSelectorProps> = ({ shape, isActive, onFacesSelected }) => {
  const { camera, gl, scene } = useThree();
  const [selectedFaces, setSelectedFaces] = useState<number[]>([]);
  const [faceHighlights, setFaceHighlights] = useState<THREE.Mesh[]>([]);
  const raycaster = useRef(new THREE.Raycaster());
  const shapeMesh = useRef<THREE.Mesh | null>(null);

  // Create shape mesh for raycasting
  useEffect(() => {
    if (!isActive || !shape.geometry) return;

    // Clean up existing mesh
    if (shapeMesh.current) {
      scene.remove(shapeMesh.current);
      shapeMesh.current = null;
    }

    // Create invisible mesh for raycasting
    const mesh = new THREE.Mesh(
      shape.geometry,
      new THREE.MeshBasicMaterial({ visible: false })
    );
    
    mesh.position.fromArray(shape.position);
    mesh.rotation.fromArray(shape.rotation);
    mesh.scale.fromArray(shape.scale);
    mesh.updateMatrixWorld();
    
    scene.add(mesh);
    shapeMesh.current = mesh;

    return () => {
      if (shapeMesh.current) {
        scene.remove(shapeMesh.current);
        shapeMesh.current = null;
      }
    };
  }, [isActive, shape, scene]);

  // Clean up highlights when not active
  useEffect(() => {
    if (!isActive) {
      faceHighlights.forEach(highlight => {
        scene.remove(highlight);
        highlight.geometry.dispose();
        (highlight.material as THREE.Material).dispose();
      });
      setFaceHighlights([]);
      setSelectedFaces([]);
    }
  }, [isActive, scene, faceHighlights]);

  // Create face highlight
  const createFaceHighlight = (faceIndex: number, color: number): THREE.Mesh | null => {
    if (!shapeMesh.current) return null;

    const geometry = shapeMesh.current.geometry as THREE.BufferGeometry;
    const position = geometry.attributes.position;
    const index = geometry.index;

    if (!position || !index) return null;

    // Get triangle vertices
    const a = index.getX(faceIndex * 3);
    const b = index.getX(faceIndex * 3 + 1);
    const c = index.getX(faceIndex * 3 + 2);

    const va = new THREE.Vector3().fromBufferAttribute(position, a);
    const vb = new THREE.Vector3().fromBufferAttribute(position, b);
    const vc = new THREE.Vector3().fromBufferAttribute(position, c);

    // Apply shape transforms
    const matrix = shapeMesh.current.matrixWorld;
    va.applyMatrix4(matrix);
    vb.applyMatrix4(matrix);
    vc.applyMatrix4(matrix);

    // Create highlight geometry
    const highlightGeometry = new THREE.BufferGeometry();
    const vertices = new Float32Array([
      va.x, va.y, va.z,
      vb.x, vb.y, vb.z,
      vc.x, vc.y, vc.z
    ]);
    
    highlightGeometry.setAttribute('position', new THREE.BufferAttribute(vertices, 3));
    highlightGeometry.setIndex([0, 1, 2]);
    highlightGeometry.computeVertexNormals();

    const highlightMaterial = new THREE.MeshBasicMaterial({
      color: color,
      transparent: true,
      opacity: 0.7,
      side: THREE.DoubleSide,
      depthTest: false
    });

    const highlight = new THREE.Mesh(highlightGeometry, highlightMaterial);
    scene.add(highlight);

    return highlight;
  };

  // Handle face selection
  const handlePointerDown = (event: PointerEvent) => {
    if (!isActive || !shapeMesh.current || event.button !== 0) return;

    const rect = gl.domElement.getBoundingClientRect();
    const mouse = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -((event.clientY - rect.top) / rect.height) * 2 + 1
    );

    raycaster.current.setFromCamera(mouse, camera);
    const intersects = raycaster.current.intersectObject(shapeMesh.current);

    if (intersects.length > 0 && intersects[0].faceIndex !== undefined) {
      const faceIndex = intersects[0].faceIndex;
      
      // Toggle face selection
      const isSelected = selectedFaces.includes(faceIndex);
      
      if (isSelected) {
        // Deselect face
        const newSelected = selectedFaces.filter(f => f !== faceIndex);
        setSelectedFaces(newSelected);
        
        // Remove highlight
        const highlightIndex = faceHighlights.findIndex(h => h.userData.faceIndex === faceIndex);
        if (highlightIndex !== -1) {
          const highlight = faceHighlights[highlightIndex];
          scene.remove(highlight);
          highlight.geometry.dispose();
          (highlight.material as THREE.Material).dispose();
          
          const newHighlights = [...faceHighlights];
          newHighlights.splice(highlightIndex, 1);
          setFaceHighlights(newHighlights);
        }
      } else {
        // Select face
        const newSelected = [...selectedFaces, faceIndex];
        setSelectedFaces(newSelected);
        
        // Add highlight
        const highlight = createFaceHighlight(faceIndex, 0xffff00); // Yellow
        if (highlight) {
          highlight.userData.faceIndex = faceIndex;
          setFaceHighlights(prev => [...prev, highlight]);
        }
      }
      
      console.log(`🎯 Face ${faceIndex} ${isSelected ? 'deselected' : 'selected'}. Total: ${isSelected ? selectedFaces.length - 1 : selectedFaces.length + 1}`);
    }
  };

  // Handle Enter key to create surface
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Enter' && isActive && selectedFaces.length >= 1) {
        console.log(`🎯 Creating surface from ${selectedFaces.length} selected faces`);
        onFacesSelected(selectedFaces);
        
        // Clear selection
        setSelectedFaces([]);
        
        // Clear highlights
        faceHighlights.forEach(highlight => {
          scene.remove(highlight);
          highlight.geometry.dispose();
          (highlight.material as THREE.Material).dispose();
        });
        setFaceHighlights([]);
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
  }, [isActive, selectedFaces, onFacesSelected, faceHighlights, gl.domElement, scene]);

  return null;
};

export default FaceSelector;