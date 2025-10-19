import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber';
import { useAppStore, OrthoMode } from '../store';

interface PolylineDrawerProps {
  faceNormal: THREE.Vector3;
  faceCenter: THREE.Vector3;
  shapePosition: [number, number, number];
}

export const PolylineDrawer: React.FC<PolylineDrawerProps> = ({
  faceNormal,
  faceCenter,
  shapePosition,
}) => {
  const { polylinePoints, addPolylinePoint, clearPolylinePoints, orthoMode } = useAppStore();
  const [previewPoint, setPreviewPoint] = useState<THREE.Vector3 | null>(null);
  const { camera, raycaster, gl } = useThree();
  const planeRef = useRef<THREE.Mesh>(null);

  useEffect(() => {
    return () => {
      clearPolylinePoints();
    };
  }, [clearPolylinePoints]);

  const getFacePlane = (): THREE.Plane => {
    const worldCenter = faceCenter.clone().add(new THREE.Vector3(...shapePosition));
    const plane = new THREE.Plane();
    plane.setFromNormalAndCoplanarPoint(faceNormal, worldCenter);
    return plane;
  };

  const getLocalCoordinates = (worldPoint: THREE.Vector3): THREE.Vector3 => {
    return worldPoint.clone().sub(new THREE.Vector3(...shapePosition));
  };

  const snapToOrtho = (localPoint: THREE.Vector3, lastPoint: [number, number, number]): THREE.Vector3 => {
    if (orthoMode === OrthoMode.OFF) {
      return localPoint;
    }

    const last = new THREE.Vector3(...lastPoint);
    const delta = localPoint.clone().sub(last);

    if (Math.abs(faceNormal.z) > 0.9) {
      if (Math.abs(delta.x) > Math.abs(delta.y)) {
        return new THREE.Vector3(localPoint.x, last.y, last.z);
      } else {
        return new THREE.Vector3(last.x, localPoint.y, last.z);
      }
    } else if (Math.abs(faceNormal.y) > 0.9) {
      if (Math.abs(delta.x) > Math.abs(delta.z)) {
        return new THREE.Vector3(localPoint.x, last.y, last.z);
      } else {
        return new THREE.Vector3(last.x, last.y, localPoint.z);
      }
    } else if (Math.abs(faceNormal.x) > 0.9) {
      if (Math.abs(delta.y) > Math.abs(delta.z)) {
        return new THREE.Vector3(last.x, localPoint.y, last.z);
      } else {
        return new THREE.Vector3(last.x, last.y, localPoint.z);
      }
    }

    return localPoint;
  };

  const handlePointerMove = (event: any) => {
    event.stopPropagation();

    const plane = getFacePlane();
    const intersectPoint = new THREE.Vector3();
    raycaster.ray.intersectPlane(plane, intersectPoint);

    if (!intersectPoint) return;

    let localPoint = getLocalCoordinates(intersectPoint);

    if (polylinePoints.length > 0) {
      localPoint = snapToOrtho(localPoint, polylinePoints[polylinePoints.length - 1]);
    }

    setPreviewPoint(localPoint);
  };

  const handleClick = (event: any) => {
    event.stopPropagation();

    if (!previewPoint) return;

    addPolylinePoint(previewPoint.toArray() as [number, number, number]);
    console.log(`✅ Polyline point added:`, previewPoint.toArray());
  };

  const getFaceRotation = (): [number, number, number] => {
    if (Math.abs(faceNormal.z) > 0.9) {
      return [0, 0, 0];
    } else if (Math.abs(faceNormal.y) > 0.9) {
      return faceNormal.y > 0 ? [-Math.PI / 2, 0, 0] : [Math.PI / 2, 0, 0];
    } else if (Math.abs(faceNormal.x) > 0.9) {
      return faceNormal.x > 0 ? [0, Math.PI / 2, 0] : [0, -Math.PI / 2, 0];
    }
    return [0, 0, 0];
  };

  const drawLine = (start: [number, number, number], end: [number, number, number]) => {
    const startVec = new THREE.Vector3(...start);
    const endVec = new THREE.Vector3(...end);
    const midpoint = startVec.clone().add(endVec).multiplyScalar(0.5);
    const distance = startVec.distanceTo(endVec);
    const direction = endVec.clone().sub(startVec).normalize();

    const angle = Math.atan2(direction.y, direction.x);

    return (
      <group position={midpoint.toArray()}>
        <mesh rotation={[0, 0, angle]}>
          <boxGeometry args={[distance, 4, 4]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      </group>
    );
  };

  return (
    <group position={shapePosition}>
      <mesh
        ref={planeRef}
        position={faceCenter.toArray()}
        rotation={getFaceRotation()}
        onClick={handleClick}
        onPointerMove={handlePointerMove}
      >
        <planeGeometry args={[10000, 10000]} />
        <meshBasicMaterial
          color="#60a5fa"
          transparent
          opacity={0.15}
          side={THREE.DoubleSide}
        />
      </mesh>

      {polylinePoints.map((point, index) => (
        <mesh key={`point-${index}`} position={point}>
          <sphereGeometry args={[15, 16, 16]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      ))}

      {polylinePoints.length > 1 &&
        polylinePoints.map((point, index) => {
          if (index === 0) return null;
          return drawLine(polylinePoints[index - 1], point);
        })}

      {previewPoint && polylinePoints.length > 0 && (
        <>
          <mesh position={previewPoint.toArray()}>
            <sphereGeometry args={[12, 16, 16]} />
            <meshBasicMaterial color="#ffff00" transparent opacity={0.7} />
          </mesh>
          {drawLine(
            polylinePoints[polylinePoints.length - 1],
            previewPoint.toArray() as [number, number, number]
          )}
        </>
      )}
    </group>
  );
};
