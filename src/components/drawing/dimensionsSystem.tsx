import React, { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Text, Billboard, Line } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useAppStore, Tool, SnapType } from '../../store/appStore';
import { findSnapPoints, SnapPointIndicators } from './snapSystem';
import { CompletedShape } from './types';
import { Shape } from '../../types/shapes';
import { snapToGrid } from './utils';

export interface SimpleDimension {
  id: string;
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  distance: number;
  unit: string;
  textPosition: THREE.Vector3;
  originalStart?: THREE.Vector3;
  originalEnd?: THREE.Vector3;
}

interface SimpleDimensionLineProps {
  dimension: SimpleDimension;
  isPreview?: boolean;
}

const SimpleDimensionLine: React.FC<SimpleDimensionLineProps> = ({
  dimension,
  isPreview = false,
}) => {
  const { startPoint, endPoint, originalStart, originalEnd } = dimension;

  const points = useMemo(() => {
    // Ana ölçü çizgisi
    const mainLinePoints = [startPoint, endPoint];

    // Uzatma çizgileri
    const extensionLinesPoints = [];
    if (originalStart && originalStart.distanceTo(startPoint) > 1) {
      extensionLinesPoints.push(originalStart, startPoint);
    }
    if (originalEnd && originalEnd.distanceTo(endPoint) > 1) {
      extensionLinesPoints.push(originalEnd, endPoint);
    }

    // Kesme işaretleri (oklar yerine)
    const direction = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(15);

    const tick1Points = [startPoint.clone().add(perpendicular), startPoint.clone().sub(perpendicular)];
    const tick2Points = [endPoint.clone().add(perpendicular), endPoint.clone().sub(perpendicular)];

    return {
      mainLinePoints,
      extensionLinesPoints,
      tick1Points,
      tick2Points,
    };
  }, [dimension]);

  return (
    <group>
      {/* Ana ölçü çizgisi */}
      <Line
        points={points.mainLinePoints}
        color={isPreview ? '#ff6b35' : '#2563eb'}
        lineWidth={2}
        dashed={false}
      />

      {/* Uzatma çizgileri */}
      {points.extensionLinesPoints.length > 0 && (
        <Line
          points={points.extensionLinesPoints}
          color="#888888"
          lineWidth={0.8}
          dashed={true}
          dashSize={5}
          gapSize={3}
        />
      )}

      {/* Kesme işaretleri */}
      <Line
        points={points.tick1Points}
        color={isPreview ? '#ff6b35' : '#2563eb'}
        lineWidth={2}
        dashed={false}
      />
      <Line
        points={points.tick2Points}
        color={isPreview ? '#ff6b35' : '#2563eb'}
        lineWidth={2}
        dashed={false}
      />

      {/* Ölçü metni */}
      <Billboard position={dimension.textPosition}>
        <Text
          position={[0, 0, 0]}
          fontSize={20}
          color="black"
          anchorX="center"
          anchorY="middle"
          outlineWidth={1}
          outlineColor="white"
        >
          {`${dimension.distance.toFixed(1)} ${dimension.unit}`}
        </Text>
      </Billboard>
    </group>
  );
};

interface DimensionsState {
  startPoint: THREE.Vector3 | null;
  endPoint: THREE.Vector3 | null;
  isPositioning: boolean;
  previewPosition: THREE.Vector3 | null;
  completedDimensions: SimpleDimension[];
  currentSnapPoint: any;
}

const INITIAL_DIMENSIONS_STATE: DimensionsState = {
  startPoint: null,
  endPoint: null,
  isPositioning: false,
  previewPosition: null,
  completedDimensions: [],
  currentSnapPoint: null,
};

interface DimensionsManagerProps {
  completedShapes: CompletedShape[];
  shapes: Shape[];
}

export const DimensionsManager: React.FC<DimensionsManagerProps> = ({
  completedShapes,
  shapes,
}) => {
  const {
    activeTool,
    gridSize,
    measurementUnit,
    convertToDisplayUnit,
    snapSettings,
    snapTolerance,
  } = useAppStore();

  const { camera, raycaster, gl } = useThree();
  const [dimensionsState, setDimensionsState] = useState<DimensionsState>(INITIAL_DIMENSIONS_STATE);
  const offsetGridSize = 3; // Offset için 3mm'lik sanal ızgara

  // Intersection point calculation
  const getIntersectionPoint = (event: PointerEvent): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const mouseScreenPos = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);

    raycaster.setFromCamera({ x, y }, camera);

    let worldPoint = new THREE.Vector3();
    let intersectionSuccess = false;

    if (dimensionsState.isPositioning) {
      // Positioning mode: Use a plane perpendicular to the dimension line
      const startPoint = dimensionsState.startPoint!;
      const endPoint = dimensionsState.endPoint!;
      const originalDirection = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
      
      // Determine the perpendicular direction on the XZ plane
      const up = new THREE.Vector3(0, 1, 0);
      const perp = new THREE.Vector3().crossVectors(originalDirection, up).normalize();
      
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(perp, startPoint);
      intersectionSuccess = raycaster.ray.intersectPlane(plane, worldPoint);
    } else {
      // Normal mode: Use the working plane (Y=0)
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      intersectionSuccess = raycaster.ray.intersectPlane(plane, worldPoint);
    }
    

    if (!intersectionSuccess) {
      return null;
    }

    // Snap detection
    const snapPoints = findSnapPoints(
      worldPoint,
      completedShapes,
      shapes,
      snapSettings,
      snapTolerance * 2,
      null,
      null,
      camera,
      gl.domElement,
      mouseScreenPos,
      'Dimension'
    );

    if (snapPoints.length > 0) {
      const closestSnap = snapPoints[0];
      setDimensionsState((prev) => ({ ...prev, currentSnapPoint: closestSnap }));
      return closestSnap.point;
    } else {
      setDimensionsState((prev) => ({ ...prev, currentSnapPoint: null }));
      return new THREE.Vector3(
        snapToGrid(worldPoint.x, gridSize),
        0,
        snapToGrid(worldPoint.z, gridSize)
      );
    }
  };

  // Click handler
  const handlePointerDown = (event: THREE.Event<PointerEvent>) => {
    if (activeTool !== Tool.DIMENSION) return;
    if (event.nativeEvent.button !== 0) return;

    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;

    event.stopPropagation();

    if (!dimensionsState.startPoint) {
      // Step 1: Select first point
      setDimensionsState((prev) => ({
        ...prev,
        startPoint: point.clone(),
        endPoint: null,
        previewPosition: point.clone(), // Start with end point position
      }));
      console.log(`🎯 Dimension: First point selected at [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`);
    } else if (!dimensionsState.endPoint) {
      // Step 2: Select second point
      const { startPoint, previewPosition } = dimensionsState;
      const distance = startPoint.distanceTo(previewPosition!);

      setDimensionsState((prev) => ({
        ...prev,
        endPoint: previewPosition!.clone(),
        isPositioning: true,
      }));
      console.log(`🎯 Dimension: Second point selected. Move mouse to position dimension line.`);
    } else if (dimensionsState.isPositioning) {
      // Step 3: Position the dimension line
      const { startPoint, endPoint, previewPosition } = dimensionsState;
      const distance = startPoint!.distanceTo(endPoint!);
      
      // Calculate the perpendicular offset from the original line
      const originalDirection = new THREE.Vector3().subVectors(endPoint!, startPoint!);
      const toMouseVector = new THREE.Vector3().subVectors(previewPosition!, startPoint!);
      
      // Project mouse vector onto original direction to get parallel component
      const originalLength = originalDirection.length();
      const originalDirectionNorm = originalDirection.clone().normalize();
      const parallelComponent = originalDirectionNorm.clone().multiplyScalar(toMouseVector.dot(originalDirectionNorm));
      
      // Get perpendicular offset (the part that's not parallel)
      const perpendicularOffset = toMouseVector.clone().sub(parallelComponent);

      const newDimension: SimpleDimension = {
        id: Math.random().toString(36).substr(2, 9),
        startPoint: startPoint!.clone().add(perpendicularOffset),
        endPoint: endPoint!.clone().add(perpendicularOffset),
        distance: convertToDisplayUnit(distance),
        unit: measurementUnit,
        textPosition: startPoint!.clone().add(endPoint!).multiplyScalar(0.5).add(perpendicularOffset),
        originalStart: startPoint!,
        originalEnd: endPoint!,
      };

      setDimensionsState((prev) => ({
        ...prev,
        completedDimensions: [...prev.completedDimensions, newDimension],
        startPoint: null,
        endPoint: null,
        isPositioning: false,
        currentSnapPoint: null,
        previewPosition: null,
      }));

      console.log(`🎯 Dimension created: ${newDimension.distance.toFixed(1)}${measurementUnit}`);
    }
  };

  // Move handler
  const handlePointerMove = (event: THREE.Event<PointerEvent>) => {
    if (activeTool !== Tool.DIMENSION) return;

    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;

    if (dimensionsState.isPositioning && dimensionsState.startPoint && dimensionsState.endPoint) {
      const { startPoint, endPoint } = dimensionsState;
      const originalDir = new THREE.Vector3().subVectors(endPoint, startPoint).normalize();
      const up = new THREE.Vector3(0, 1, 0);
      const perp = new THREE.Vector3().crossVectors(originalDir, up).normalize();
      
      const toMouse = new THREE.Vector3().subVectors(point, startPoint);
      const offsetMag = toMouse.dot(perp);
      const snappedMag = Math.round(offsetMag / offsetGridSize) * offsetGridSize;
      const snappedOffset = perp.clone().multiplyScalar(snappedMag);
      
      const newPreviewPosition = startPoint.clone().add(snappedOffset);

      setDimensionsState((prev) => ({
        ...prev,
        previewPosition: newPreviewPosition,
      }));
    } else if (dimensionsState.startPoint && !dimensionsState.endPoint) {
      const firstPoint = dimensionsState.startPoint;
      const direction = new THREE.Vector3().subVectors(point, firstPoint);

      const absX = Math.abs(direction.x);
      const absZ = Math.abs(direction.z);

      let previewPoint;
      if (absX > absZ) {
        previewPoint = new THREE.Vector3(point.x, point.y, firstPoint.z);
      } else {
        previewPoint = new THREE.Vector3(firstPoint.x, point.y, point.z);
      }

      setDimensionsState((prev) => ({
        ...prev,
        previewPosition: previewPoint,
      }));
    } else {
      setDimensionsState((prev) => ({ ...prev, currentSnapPoint: null }));
    }
  };

  // Preview dimension
  const previewDimension = useMemo(() => {
    if (!dimensionsState.startPoint || !dimensionsState.endPoint) {
      if (!dimensionsState.startPoint || !dimensionsState.previewPosition) {
        return null;
      }

      const { startPoint, previewPosition } = dimensionsState;
      const distance = startPoint.distanceTo(previewPosition);
      const dimensionStart = startPoint.clone();
      const dimensionEnd = previewPosition.clone();
      const textPosition = dimensionStart.clone().add(dimensionEnd).multiplyScalar(0.5);

      return {
        id: 'preview',
        startPoint: dimensionStart,
        endPoint: dimensionEnd,
        distance: convertToDisplayUnit(distance),
        unit: measurementUnit,
        textPosition,
        originalStart: startPoint,
        originalEnd: previewPosition,
      };
    }

    // Positioning mode
    const { startPoint, endPoint, previewPosition } = dimensionsState;
    const distance = startPoint.distanceTo(endPoint);

    // Offset vector
    const originalDirection = new THREE.Vector3().subVectors(endPoint, startPoint);
    const toMouseVector = new THREE.Vector3().subVectors(previewPosition!, startPoint);
    const originalDirectionNorm = originalDirection.clone().normalize();
    const parallelComponent = originalDirectionNorm.clone().multiplyScalar(toMouseVector.dot(originalDirectionNorm));
    const offsetVector = toMouseVector.clone().sub(parallelComponent);

    const dimensionStart = startPoint.clone().add(offsetVector);
    const dimensionEnd = endPoint.clone().add(offsetVector);
    const textPosition = dimensionStart.clone().add(dimensionEnd).multiplyScalar(0.5);

    return {
      id: 'preview',
      startPoint: dimensionStart,
      endPoint: dimensionEnd,
      distance: convertToDisplayUnit(distance),
      unit: measurementUnit,
      textPosition,
      originalStart: startPoint,
      originalEnd: endPoint,
    };
  }, [dimensionsState, convertToDisplayUnit, measurementUnit]);

  // Reset state when tool changes
  useEffect(() => {
    if (activeTool !== Tool.DIMENSION) {
      setDimensionsState(INITIAL_DIMENSIONS_STATE);
    }
  }, [activeTool]);

  return (
    <>
      {activeTool === Tool.DIMENSION && (
        <mesh
          position={[0, 0, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
          visible={false}
        >
          <planeGeometry args={[100000, 100000]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}

      {dimensionsState.completedDimensions.map((dimension) => (
        <SimpleDimensionLine key={dimension.id} dimension={dimension} />
      ))}

      {previewDimension && (
        <SimpleDimensionLine dimension={previewDimension} isPreview={true} />
      )}

      {dimensionsState.startPoint && !dimensionsState.endPoint && (
        <mesh position={dimensionsState.startPoint}>
          <sphereGeometry args={[15]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.8} />
        </mesh>
      )}

      {dimensionsState.endPoint && (
        <mesh position={dimensionsState.endPoint}>
          <sphereGeometry args={[15]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.8} />
        </mesh>
      )}

      {activeTool === Tool.DIMENSION && (
        <SnapPointIndicators snapPoint={dimensionsState.currentSnapPoint} />
      )}
    </>
  );
};
