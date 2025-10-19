import React, { useState } from 'react';
import * as THREE from 'three';

interface FaceSelectorProps {
  shape: any;
  onFaceSelect: (faceIndex: number, faceNormal: THREE.Vector3, faceCenter: THREE.Vector3) => void;
}

export const FaceSelector: React.FC<FaceSelectorProps> = ({ shape, onFaceSelect }) => {
  const [hoveredFace, setHoveredFace] = useState<number | null>(null);

  const w = shape.parameters.width;
  const h = shape.parameters.height;
  const d = shape.parameters.depth;

  const faces = [
    {
      index: 0,
      name: 'Front',
      normal: new THREE.Vector3(0, 0, 1),
      center: new THREE.Vector3(w / 2, h / 2, d),
      size: [w, h],
      rotation: [0, 0, 0] as [number, number, number],
    },
    {
      index: 1,
      name: 'Back',
      normal: new THREE.Vector3(0, 0, -1),
      center: new THREE.Vector3(w / 2, h / 2, 0),
      size: [w, h],
      rotation: [0, Math.PI, 0] as [number, number, number],
    },
    {
      index: 2,
      name: 'Top',
      normal: new THREE.Vector3(0, 1, 0),
      center: new THREE.Vector3(w / 2, h, d / 2),
      size: [w, d],
      rotation: [-Math.PI / 2, 0, 0] as [number, number, number],
    },
    {
      index: 3,
      name: 'Bottom',
      normal: new THREE.Vector3(0, -1, 0),
      center: new THREE.Vector3(w / 2, 0, d / 2),
      size: [w, d],
      rotation: [Math.PI / 2, 0, 0] as [number, number, number],
    },
    {
      index: 4,
      name: 'Right',
      normal: new THREE.Vector3(1, 0, 0),
      center: new THREE.Vector3(w, h / 2, d / 2),
      size: [d, h],
      rotation: [0, Math.PI / 2, 0] as [number, number, number],
    },
    {
      index: 5,
      name: 'Left',
      normal: new THREE.Vector3(-1, 0, 0),
      center: new THREE.Vector3(0, h / 2, d / 2),
      size: [d, h],
      rotation: [0, -Math.PI / 2, 0] as [number, number, number],
    },
  ];

  return (
    <group>
      {faces.map((face) => {
        const isHovered = hoveredFace === face.index;

        return (
          <mesh
            key={face.index}
            position={face.center.toArray()}
            rotation={face.rotation}
            onPointerOver={(e) => {
              e.stopPropagation();
              setHoveredFace(face.index);
            }}
            onPointerOut={(e) => {
              e.stopPropagation();
              setHoveredFace(null);
            }}
            onClick={(e) => {
              e.stopPropagation();
              console.log(`Face selected: ${face.name}`, face);
              onFaceSelect(face.index, face.normal, face.center);
            }}
          >
            <planeGeometry args={[face.size[0], face.size[1]]} />
            <meshBasicMaterial
              color={isHovered ? '#ffff00' : '#2563eb'}
              transparent
              opacity={isHovered ? 0.5 : 0.1}
              side={THREE.DoubleSide}
            />
          </mesh>
        );
      })}
    </group>
  );
};
