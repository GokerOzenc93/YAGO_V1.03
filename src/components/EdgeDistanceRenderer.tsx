import React from 'react';
import { Line, Html } from '@react-three/drei';
import { useAppStore } from '../store/appStore';
import * as THREE from 'three';

const EdgeDistanceRenderer: React.FC = () => {
  const { edgeDistances, selectedLines } = useAppStore();

  if (edgeDistances.length === 0) return null;

  return (
    <>
      {edgeDistances.map((dist) => {
        const edge1 = selectedLines.find(l => l.id === dist.edge1Id);
        const edge2 = selectedLines.find(l => l.id === dist.edge2Id);

        if (!edge1 || !edge2) return null;

        const edge1Mid = new THREE.Vector3(
          (edge1.startVertex[0] + edge1.endVertex[0]) / 2,
          (edge1.startVertex[1] + edge1.endVertex[1]) / 2,
          (edge1.startVertex[2] + edge1.endVertex[2]) / 2
        );
        const edge2Mid = new THREE.Vector3(
          (edge2.startVertex[0] + edge2.endVertex[0]) / 2,
          (edge2.startVertex[1] + edge2.endVertex[1]) / 2,
          (edge2.startVertex[2] + edge2.endVertex[2]) / 2
        );

        const midPoint = new THREE.Vector3().lerpVectors(edge1Mid, edge2Mid, 0.5);

        return (
          <group key={dist.id}>
            <Line
              points={[edge1Mid, edge2Mid]}
              color="#3b82f6"
              lineWidth={2}
              dashed
              dashScale={10}
              dashSize={2}
              gapSize={1}
            />

            <mesh position={edge1Mid}>
              <sphereGeometry args={[3, 16, 16]} />
              <meshBasicMaterial color="#3b82f6" />
            </mesh>

            <mesh position={edge2Mid}>
              <sphereGeometry args={[3, 16, 16]} />
              <meshBasicMaterial color="#3b82f6" />
            </mesh>

            <Html position={midPoint} center>
              <div className="bg-blue-500 text-white px-2 py-1 rounded text-xs font-semibold shadow-lg">
                {dist.label}: {dist.distance.toFixed(2)}
              </div>
            </Html>
          </group>
        );
      })}
    </>
  );
};

export default EdgeDistanceRenderer;
