import React, { useState, useEffect } from 'react';
import { Line, Html } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { detectEdgeFromIntersection } from '../utils/edgeSelection';

interface MeasurementLineProps {
  edge1: {
    start: THREE.Vector3;
    end: THREE.Vector3;
    midpoint: THREE.Vector3;
    shapeId: string;
  };
  edge2: {
    start: THREE.Vector3;
    end: THREE.Vector3;
    midpoint: THREE.Vector3;
    shapeId: string;
  };
  distance: string;
  measurementUnit: string;
  parameterLabel: string;
  rowId: string;
}

const MeasurementLine: React.FC<MeasurementLineProps> = ({
  edge1: initialEdge1,
  edge2: initialEdge2,
  distance: initialDistance,
  measurementUnit,
  parameterLabel,
  rowId
}) => {
  const { scene } = useThree();
  const [edge1, setEdge1] = useState(initialEdge1);
  const [edge2, setEdge2] = useState(initialEdge2);
  const [distance, setDistance] = useState(initialDistance);

  const convertToDisplayUnit = (value: number): number => {
    if (measurementUnit === 'mm') return value;
    if (measurementUnit === 'cm') return value / 10;
    if (measurementUnit === 'in') return value / 25.4;
    return value;
  };

  useFrame(() => {
    const shape1 = scene.children.find((obj: any) => obj.userData?.shapeId === initialEdge1.shapeId);
    const shape2 = scene.children.find((obj: any) => obj.userData?.shapeId === initialEdge2.shapeId);

    if (!shape1 || !shape2) return;

    const mesh1 = shape1.children.find((child: any) => child.isMesh);
    const mesh2 = shape2.children.find((child: any) => child.isMesh);

    if (!mesh1 || !mesh2) return;

    const findClosestEdge = (mesh: THREE.Mesh, targetMidpoint: THREE.Vector3) => {
      const geometry = mesh.geometry;
      if (!geometry || !geometry.isBufferGeometry) return null;

      const positionAttribute = geometry.attributes.position;
      if (!positionAttribute) return null;

      const worldMatrix = mesh.matrixWorld;
      const vertices: THREE.Vector3[] = [];

      for (let i = 0; i < positionAttribute.count; i++) {
        const vertex = new THREE.Vector3(
          positionAttribute.getX(i),
          positionAttribute.getY(i),
          positionAttribute.getZ(i)
        );
        vertex.applyMatrix4(worldMatrix);
        vertices.push(vertex);
      }

      let closestEdge = null;
      let minDistance = Infinity;
      const index = geometry.index;

      const processEdge = (v1: THREE.Vector3, v2: THREE.Vector3) => {
        const edgeMidpoint = new THREE.Vector3().lerpVectors(v1, v2, 0.5);
        const dist = edgeMidpoint.distanceTo(targetMidpoint);

        if (dist < minDistance) {
          minDistance = dist;
          closestEdge = {
            start: v1.clone(),
            end: v2.clone(),
            midpoint: edgeMidpoint,
            length: v1.distanceTo(v2)
          };
        }
      };

      if (index) {
        for (let i = 0; i < index.count; i += 3) {
          const a = index.getX(i);
          const b = index.getX(i + 1);
          const c = index.getX(i + 2);

          processEdge(vertices[a], vertices[b]);
          processEdge(vertices[b], vertices[c]);
          processEdge(vertices[c], vertices[a]);
        }
      }

      return closestEdge;
    };

    const newEdge1 = findClosestEdge(mesh1, initialEdge1.midpoint);
    const newEdge2 = findClosestEdge(mesh2, initialEdge2.midpoint);

    if (newEdge1 && newEdge2) {
      setEdge1({ ...newEdge1, shapeId: initialEdge1.shapeId });
      setEdge2({ ...newEdge2, shapeId: initialEdge2.shapeId });

      const newDistance = newEdge1.midpoint.distanceTo(newEdge2.midpoint);
      const displayDistance = convertToDisplayUnit(newDistance).toFixed(2);
      setDistance(displayDistance);

      const updateEvent = new CustomEvent('updateMeasurementValue', {
        detail: { rowId, value: displayDistance }
      });
      window.dispatchEvent(updateEvent);
    }
  });

  const lineStart = edge1.midpoint;
  const lineEnd = edge2.midpoint;
  const lineMidpoint = new THREE.Vector3().lerpVectors(lineStart, lineEnd, 0.5);

  return (
    <group>
      <Line
        points={[
          [lineStart.x, lineStart.y, lineStart.z],
          [lineEnd.x, lineEnd.y, lineEnd.z]
        ]}
        color="#9ca3af"
        lineWidth={1.5}
        dashed
        dashScale={1}
        dashSize={8}
        gapSize={4}
      />

      <Line
        points={[
          [lineStart.x, lineStart.y, lineStart.z],
          [lineStart.x, lineStart.y, lineStart.z]
        ]}
        color="#9ca3af"
        lineWidth={1}
        dashed
        dashScale={1}
        dashSize={8}
        gapSize={4}
      />

      <Line
        points={[
          [lineEnd.x, lineEnd.y, lineEnd.z],
          [lineEnd.x, lineEnd.y, lineEnd.z]
        ]}
        color="#9ca3af"
        lineWidth={1}
        dashed
        dashScale={1}
        dashSize={8}
        gapSize={4}
      />

      <Html
        position={[lineMidpoint.x, lineMidpoint.y + 20, lineMidpoint.z]}
        center
      >
        <div className="text-gray-800 text-sm font-semibold whitespace-nowrap bg-white px-1">
          {parameterLabel}: {distance} {measurementUnit}
        </div>
      </Html>
    </group>
  );
};

export default MeasurementLine;
