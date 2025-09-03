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
  isPreview = false
}) => {
  const points = useMemo(() => {
    const start = dimension.startPoint;
    const end = dimension.endPoint;
    const originalStart = dimension.originalStart || start;
    const originalEnd = dimension.originalEnd || end;

    // Ana ölçü çizgisi
    const mainLine = [start, end];

    // Uzatma çizgileri (orijinal noktalardan ölçü çizgisine)
    const extensionLines = [];
    if (originalStart.distanceTo(start) > 1) {
      extensionLines.push(originalStart, start);
    }
    if (originalEnd.distanceTo(end) > 1) {
      extensionLines.push(originalEnd, end);
    }

    // Ölçü çizgisinin uçlarında kesme işaretleri
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(15);
    
    const tick1 = [
      start.clone().add(perpendicular),
      start.clone().sub(perpendicular),
    ];
    const tick2 = [
      end.clone().add(perpendicular),
      end.clone().sub(perpendicular),
    ];

    return {
      mainLine,
      extensionLines,
      tick1,
      tick2
    };
  }, [dimension]);

  return (
    <group>
      {/* Ana ölçü çizgisi */}
      <Line
        points={points.mainLine}
        color={isPreview ? "#ff6b35" : "#2563eb"}
        lineWidth={2}
        dashed={false}
      />
      
      {/* Uzatma çizgileri */}
      {points.extensionLines.length > 0 && (
        <Line
          points={points.extensionLines}
          color="#888888"
          lineWidth={0.8}
          dashed={true}
          dashSize={5}
          gapSize={3}
        />
      )}

      {/* Kesme işaretleri */}
      <Line
        points={points.tick1}
        color={isPreview ? "#ff6b35" : "#2563eb"}
        lineWidth={2}
        dashed={false}
      />
      <Line
        points={points.tick2}
        color={isPreview ? "#ff6b35" : "#2563eb"}
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

interface SimpleDimensionsState {
  firstPoint: THREE.Vector3 | null;
  secondPoint: THREE.Vector3 | null;
  completedDimensions: SimpleDimension[];
  currentSnapPoint: any;
}

const INITIAL_SIMPLE_DIMENSIONS_STATE: SimpleDimensionsState = {
  firstPoint: null,
  secondPoint: null,
  completedDimensions: [],
  currentSnapPoint: null,
};

interface SimpleDimensionsManagerProps {
  completedShapes: CompletedShape[];
  shapes: Shape[];
}

export const DimensionsManager: React.FC<SimpleDimensionsManagerProps> = ({
  completedShapes,
  shapes
}) => {
  const {
    activeTool,
    gridSize,
    measurementUnit,
    convertToDisplayUnit,
    snapSettings,
    snapTolerance
  } = useAppStore();

  const { camera, raycaster, gl } = useThree();
  const [dimensionsState, setDimensionsState] = useState<SimpleDimensionsState>(INITIAL_SIMPLE_DIMENSIONS_STATE);

  // Intersection point hesaplama - SADECE DIMENSIONS İÇİN
  const getIntersectionPoint = (event: PointerEvent): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    const mouseScreenPos = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);

    raycaster.setFromCamera({ x, y }, camera);

    let worldPoint = new THREE.Vector3();
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const intersectionSuccess = raycaster.ray.intersectPlane(plane, worldPoint);
    
    if (!intersectionSuccess) {
      return null;
    }
    
    // Snap detection - SADECE ENDPOINT
    const snapPoints = findSnapPoints(
      worldPoint,
      completedShapes, 
      shapes, 
      { ...snapSettings, [SnapType.ENDPOINT]: true, [SnapType.MIDPOINT]: false, [SnapType.CENTER]: false, [SnapType.QUADRANT]: false, [SnapType.PERPENDICULAR]: false, [SnapType.INTERSECTION]: false, [SnapType.NEAREST]: false }, 
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
      setDimensionsState(prev => ({ ...prev, currentSnapPoint: closestSnap }));
      return closestSnap.point;
    } else {
      setDimensionsState(prev => ({ ...prev, currentSnapPoint: null }));
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
    
    if (!dimensionsState.firstPoint) {
      // İlk nokta seçimi
      setDimensionsState(prev => ({
        ...prev,
        firstPoint: point.clone(),
        secondPoint: null,
      }));
      console.log(`🎯 Dimension: First point selected at [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`);
    } else {
      // İkinci nokta seçimi ve ölçüyü otomatik oluştur
      const firstPoint = dimensionsState.firstPoint!;
      const secondPoint = point.clone();

      // Ölçü çizgisi için offset hesapla (otomatik 200mm dışarıya)
      const offsetDistance = 200;
      const originalDirection = new THREE.Vector3().subVectors(secondPoint, firstPoint);
      const perpendicularOffset = new THREE.Vector3(-originalDirection.z, 0, originalDirection.x).normalize().multiplyScalar(offsetDistance);

      const newDimension: SimpleDimension = {
        id: Math.random().toString(36).substr(2, 9),
        startPoint: firstPoint.clone().add(perpendicularOffset),
        endPoint: secondPoint.clone().add(perpendicularOffset),
        distance: convertToDisplayUnit(firstPoint.distanceTo(secondPoint)),
        unit: measurementUnit,
        textPosition: firstPoint.clone().add(secondPoint).multiplyScalar(0.5).add(perpendicularOffset),
        originalStart: firstPoint,
        originalEnd: secondPoint,
      };
      
      setDimensionsState(prev => ({
        ...prev,
        completedDimensions: [...prev.completedDimensions, newDimension],
        firstPoint: null,
        secondPoint: null,
      }));
      
      console.log(`🎯 Dimension created: ${newDimension.distance.toFixed(1)}${measurementUnit}`);
    }
  };
  
  // Move handler - Artık konumlandırma olmadığı için bu handler boş kalıyor
  const handlePointerMove = (event: THREE.Event<PointerEvent>) => {
    if (activeTool !== Tool.DIMENSION) return;
    
    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;

    if (dimensionsState.firstPoint && !dimensionsState.secondPoint) {
      const firstPoint = dimensionsState.firstPoint.clone();
      const direction = new THREE.Vector3().subVectors(point, firstPoint);
      
      const absX = Math.abs(direction.x);
      const absZ = Math.abs(direction.z);
      
      let previewPoint;
      if (absX > absZ) {
        previewPoint = new THREE.Vector3(point.x, point.y, firstPoint.z);
      } else {
        previewPoint = new THREE.Vector3(firstPoint.x, point.y, point.z);
      }
      
      setDimensionsState(prev => ({
        ...prev,
        secondPoint: previewPoint,
      }));
    } else {
      setDimensionsState(prev => ({ ...prev, currentSnapPoint: null }));
    }
  };

  // Preview ölçüsü oluştur - Artık sadece iki nokta arasındaki çizgiyi gösteriyor
  const previewDimension = useMemo(() => {
    if (!dimensionsState.firstPoint || !dimensionsState.secondPoint) {
      return null;
    }
    
    const firstPoint = dimensionsState.firstPoint;
    const secondPoint = dimensionsState.secondPoint;
    
    const distance = firstPoint.distanceTo(secondPoint);
    const dimensionStart = firstPoint.clone();
    const dimensionEnd = secondPoint.clone();
    const textPosition = dimensionStart.clone().add(dimensionEnd).multiplyScalar(0.5);

    // Ölçü çizgisini otomatik olarak ötele
    const offsetDistance = 200;
    const originalDirection = new THREE.Vector3().subVectors(dimensionEnd, dimensionStart);
    const perpendicularOffset = new THREE.Vector3(-originalDirection.z, 0, originalDirection.x).normalize().multiplyScalar(offsetDistance);

    const offsetStart = dimensionStart.clone().add(perpendicularOffset);
    const offsetEnd = dimensionEnd.clone().add(perpendicularOffset);
    const offsetTextPosition = textPosition.clone().add(perpendicularOffset);
    
    return {
      id: 'preview',
      startPoint: offsetStart,
      endPoint: offsetEnd,
      distance: convertToDisplayUnit(distance),
      unit: measurementUnit,
      textPosition: offsetTextPosition,
      originalStart: dimensionStart,
      originalEnd: dimensionEnd
    };
  }, [dimensionsState, convertToDisplayUnit, measurementUnit]);

  // Reset dimensions state when tool changes
  useEffect(() => {
    if (activeTool !== Tool.DIMENSION) {
      setDimensionsState(INITIAL_SIMPLE_DIMENSIONS_STATE);
    }
  }, [activeTool]);

  return (
    <>
      {/* Invisible plane for interaction - SADECE DIMENSION TOOL AKTIFKEN */}
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

      {/* Tamamlanmış ölçüler */}
      {dimensionsState.completedDimensions.map(dimension => (
        <SimpleDimensionLine
          key={dimension.id}
          dimension={dimension}
        />
      ))}

      {/* Preview ölçüsü */}
      {previewDimension && (
        <SimpleDimensionLine
          dimension={previewDimension}
          isPreview={true}
        />
      )}

      {/* İlk nokta göstergesi */}
      {dimensionsState.firstPoint && !dimensionsState.secondPoint && (
        <mesh position={dimensionsState.firstPoint}>
          <sphereGeometry args={[15]} />
          <meshBasicMaterial color="#10b981" transparent opacity={0.8} />
        </mesh>
      )}

      {/* İkinci nokta göstergesi */}
      {dimensionsState.secondPoint && (
        <mesh position={dimensionsState.secondPoint}>
          <sphereGeometry args={[15]} />
          <meshBasicMaterial color="#f59e0b" transparent opacity={0.8} />
        </mesh>
      )}

      {/* Snap Point Indicator - SADECE DIMENSION TOOL AKTIFKEN */}
      {activeTool === Tool.DIMENSION && (
        <SnapPointIndicators snapPoint={dimensionsState.currentSnapPoint} />
      )}
    </>
  );
};
