import React, { useState, useMemo } from 'react';
import { Line, Html } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import * as THREE from 'three';

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
  const [frameCount, setFrameCount] = useState(0);
  const [lastGeometryVersion1, setLastGeometryVersion1] = useState<string>('');
  const [lastGeometryVersion2, setLastGeometryVersion2] = useState<string>('');

  const convertToDisplayUnit = (value: number): number => {
    if (measurementUnit === 'mm') return value;
    if (measurementUnit === 'cm') return value / 10;
    if (measurementUnit === 'in') return value / 25.4;
    return value;
  };

  useFrame(() => {
    setFrameCount(prev => prev + 1);
    if (frameCount % 5 !== 0) return;
    if (!initialEdge1?.shapeId || !initialEdge2?.shapeId) return;

    let shape1 = null;
    let shape2 = null;

    scene.traverse((obj: any) => {
      if (obj.userData?.shapeId === initialEdge1.shapeId) {
        shape1 = obj;
      }
      if (obj.userData?.shapeId === initialEdge2.shapeId) {
        shape2 = obj;
      }
    });

    if (!shape1 || !shape2) return;

    const mesh1 = shape1.children?.find((child: any) => child.isMesh) || (shape1.isMesh ? shape1 : null);
    const mesh2 = shape2.children?.find((child: any) => child.isMesh) || (shape2.isMesh ? shape2 : null);

    if (!mesh1 || !mesh2) return;

    const currentVersion1 = `${mesh1.geometry?.uuid || ''}_${mesh1.scale.x}_${mesh1.scale.y}_${mesh1.scale.z}`;
    const currentVersion2 = `${mesh2.geometry?.uuid || ''}_${mesh2.scale.x}_${mesh2.scale.y}_${mesh2.scale.z}`;

    const versionChanged1 = currentVersion1 !== lastGeometryVersion1;
    const versionChanged2 = currentVersion2 !== lastGeometryVersion2;

    if (versionChanged1) {
      setLastGeometryVersion1(currentVersion1);
    }
    if (versionChanged2) {
      setLastGeometryVersion2(currentVersion2);
    }

    const getEdgeFromIndices = (mesh: THREE.Mesh, edgeInfo: any) => {
      const geometry = mesh.geometry;
      if (!geometry || !geometry.isBufferGeometry) return null;

      const positionAttribute = geometry.attributes.position;
      if (!positionAttribute) return null;

      const worldMatrix = mesh.matrixWorld;

      if (edgeInfo.vertexIndex1 !== undefined && edgeInfo.vertexIndex2 !== undefined) {
        const idx1 = edgeInfo.vertexIndex1;
        const idx2 = edgeInfo.vertexIndex2;

        if (idx1 < positionAttribute.count && idx2 < positionAttribute.count) {
          const v1 = new THREE.Vector3(
            positionAttribute.getX(idx1),
            positionAttribute.getY(idx1),
            positionAttribute.getZ(idx1)
          ).applyMatrix4(worldMatrix);

          const v2 = new THREE.Vector3(
            positionAttribute.getX(idx2),
            positionAttribute.getY(idx2),
            positionAttribute.getZ(idx2)
          ).applyMatrix4(worldMatrix);

          return {
            start: v1,
            end: v2,
            midpoint: new THREE.Vector3().lerpVectors(v1, v2, 0.5),
            length: v1.distanceTo(v2)
          };
        }
      }

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
        const dist = edgeMidpoint.distanceTo(edgeInfo.midpoint);

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

    const shouldRecalculate = versionChanged1 || versionChanged2;

    const edgeInfoToUse1 = shouldRecalculate ? edge1 : initialEdge1;
    const edgeInfoToUse2 = shouldRecalculate ? edge2 : initialEdge2;

    const newEdge1 = getEdgeFromIndices(mesh1, edgeInfoToUse1);
    const newEdge2 = getEdgeFromIndices(mesh2, edgeInfoToUse2);

    if (newEdge1 && newEdge2) {
      const newDistance = newEdge1.midpoint.distanceTo(newEdge2.midpoint);
      const displayDistance = convertToDisplayUnit(newDistance).toFixed(2);

      const shouldUpdate = shouldRecalculate || displayDistance !== distance;

      if (shouldUpdate) {
        setEdge1({ ...newEdge1, shapeId: initialEdge1.shapeId });
        setEdge2({ ...newEdge2, shapeId: initialEdge2.shapeId });
        setDistance(displayDistance);

        const updateEvent = new CustomEvent('updateMeasurementValue', {
          detail: { rowId, value: displayDistance }
        });
        window.dispatchEvent(updateEvent);
      }
    }
  });

  const lineGeometry = useMemo(() => {
    const lineStart = edge1.midpoint;
    const lineEnd = edge2.midpoint;
    const lineMidpoint = new THREE.Vector3().lerpVectors(lineStart, lineEnd, 0.5);

    const direction = new THREE.Vector3().subVectors(lineEnd, lineStart).normalize();
    const arrowSize = 10;

    const perpendicular = new THREE.Vector3();
    if (Math.abs(direction.y) < 0.9) {
      perpendicular.crossVectors(direction, new THREE.Vector3(0, 1, 0)).normalize();
    } else {
      perpendicular.crossVectors(direction, new THREE.Vector3(1, 0, 0)).normalize();
    }

    const arrowTip1 = lineStart.clone().add(direction.clone().multiplyScalar(arrowSize));
    const arrowLeft1 = lineStart.clone()
      .add(direction.clone().multiplyScalar(arrowSize))
      .add(perpendicular.clone().multiplyScalar(arrowSize * 5.3));
    const arrowRight1 = lineStart.clone()
      .add(direction.clone().multiplyScalar(arrowSize))
      .sub(perpendicular.clone().multiplyScalar(arrowSize * 5.3));

    const arrowTip2 = lineEnd.clone().sub(direction.clone().multiplyScalar(arrowSize));
    const arrowLeft2 = lineEnd.clone()
      .sub(direction.clone().multiplyScalar(arrowSize))
      .add(perpendicular.clone().multiplyScalar(arrowSize * 5.3));
    const arrowRight2 = lineEnd.clone()
      .sub(direction.clone().multiplyScalar(arrowSize))
      .sub(perpendicular.clone().multiplyScalar(arrowSize * 5.3));

    return {
      lineStart,
      lineEnd,
      lineMidpoint,
      arrowTip1,
      arrowLeft1,
      arrowRight1,
      arrowTip2,
      arrowLeft2,
      arrowRight2
    };
  }, [edge1.midpoint.x, edge1.midpoint.y, edge1.midpoint.z, edge2.midpoint.x, edge2.midpoint.y, edge2.midpoint.z]);

  return (
    <group>
      <Line
        points={[
          [lineGeometry.lineStart.x, lineGeometry.lineStart.y, lineGeometry.lineStart.z],
          [lineGeometry.lineEnd.x, lineGeometry.lineEnd.y, lineGeometry.lineEnd.z]
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
          [lineGeometry.lineStart.x, lineGeometry.lineStart.y, lineGeometry.lineStart.z],
          [lineGeometry.arrowTip1.x, lineGeometry.arrowTip1.y, lineGeometry.arrowTip1.z]
        ]}
        color="#9ca3af"
        lineWidth={2}
      />
      <Line
        points={[
          [lineGeometry.lineStart.x, lineGeometry.lineStart.y, lineGeometry.lineStart.z],
          [lineGeometry.arrowLeft1.x, lineGeometry.arrowLeft1.y, lineGeometry.arrowLeft1.z]
        ]}
        color="#9ca3af"
        lineWidth={2}
      />
      <Line
        points={[
          [lineGeometry.lineStart.x, lineGeometry.lineStart.y, lineGeometry.lineStart.z],
          [lineGeometry.arrowRight1.x, lineGeometry.arrowRight1.y, lineGeometry.arrowRight1.z]
        ]}
        color="#9ca3af"
        lineWidth={2}
      />

      <Line
        points={[
          [lineGeometry.lineEnd.x, lineGeometry.lineEnd.y, lineGeometry.lineEnd.z],
          [lineGeometry.arrowTip2.x, lineGeometry.arrowTip2.y, lineGeometry.arrowTip2.z]
        ]}
        color="#9ca3af"
        lineWidth={2}
      />
      <Line
        points={[
          [lineGeometry.lineEnd.x, lineGeometry.lineEnd.y, lineGeometry.lineEnd.z],
          [lineGeometry.arrowLeft2.x, lineGeometry.arrowLeft2.y, lineGeometry.arrowLeft2.z]
        ]}
        color="#9ca3af"
        lineWidth={2}
      />
      <Line
        points={[
          [lineGeometry.lineEnd.x, lineGeometry.lineEnd.y, lineGeometry.lineEnd.z],
          [lineGeometry.arrowRight2.x, lineGeometry.arrowRight2.y, lineGeometry.arrowRight2.z]
        ]}
        color="#9ca3af"
        lineWidth={2}
      />

      <Html
        position={[lineGeometry.lineMidpoint.x, lineGeometry.lineMidpoint.y + 20, lineGeometry.lineMidpoint.z]}
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
