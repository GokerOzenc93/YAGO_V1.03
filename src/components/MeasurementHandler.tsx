import { useEffect } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useAppStore } from '../store/appStore';
import { getEdgesFromShape, findClosestEdgePoint, determineDimensionType } from '../utils/measurementUtils';

export const MeasurementHandler = () => {
  const { camera, scene, gl } = useThree();
  const {
    isMeasurementMode,
    shapes,
    activeMeasurement,
    setActiveMeasurement,
    addMeasurement,
    setMeasurementMode,
  } = useAppStore();

  useEffect(() => {
    if (!isMeasurementMode) return;

    const handleClick = (event: MouseEvent) => {
      const canvas = gl.domElement;
      const rect = canvas.getBoundingClientRect();

      const mouse = new THREE.Vector2(
        ((event.clientX - rect.left) / rect.width) * 2 - 1,
        -((event.clientY - rect.top) / rect.height) * 2 + 1
      );

      const raycaster = new THREE.Raycaster();
      raycaster.setFromCamera(mouse, camera);

      const meshes = scene.children.filter(
        (child) => child instanceof THREE.Mesh && child.visible
      ) as THREE.Mesh[];

      const intersects = raycaster.intersectObjects(meshes, true);

      if (intersects.length === 0) {
        console.log('No shape intersected');
        return;
      }

      const intersect = intersects[0];
      const clickPoint = intersect.point;

      const shape = shapes.find((s) => {
        const meshPosition = new THREE.Vector3(...s.position);
        return intersect.object.position.equals(meshPosition);
      });

      if (!shape) {
        console.log('Shape not found in store');
        return;
      }

      const edges = getEdgesFromShape(shape);
      const closestEdge = findClosestEdgePoint(clickPoint, edges, 100);

      if (!closestEdge) {
        console.log('No edge found nearby');
        return;
      }

      if (!activeMeasurement || !activeMeasurement.point1) {
        const newMeasurement = {
          id: `measurement_${Date.now()}`,
          point1: {
            position: closestEdge.point,
            shapeId: shape.id,
            edgeIndex: closestEdge.edgeIndex,
          },
          point2: null,
          distance: 0,
          dimension: 'custom' as 'custom',
        };

        setActiveMeasurement(newMeasurement);
        console.log('First point selected:', closestEdge.point);
      } else {
        const distance = activeMeasurement.point1.position.distanceTo(closestEdge.point);
        const dimension = determineDimensionType(
          activeMeasurement.point1.position,
          closestEdge.point,
          shape
        );

        const completedMeasurement = {
          ...activeMeasurement,
          point2: {
            position: closestEdge.point,
            shapeId: shape.id,
            edgeIndex: closestEdge.edgeIndex,
          },
          distance,
          dimension,
        };

        setActiveMeasurement(completedMeasurement);
        addMeasurement(completedMeasurement);

        console.log('Second point selected, measurement complete:', {
          distance,
          dimension,
        });
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMeasurementMode(false);
        setActiveMeasurement(null);
        console.log('Measurement mode cancelled');
      }
    };

    window.addEventListener('click', handleClick);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('click', handleClick);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [
    isMeasurementMode,
    camera,
    scene,
    gl,
    shapes,
    activeMeasurement,
    setActiveMeasurement,
    addMeasurement,
    setMeasurementMode,
  ]);

  return null;
};
