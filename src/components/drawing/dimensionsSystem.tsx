import React, { useState, useEffect, useMemo } from 'react';
import * as THREE from 'three';
import { Text, Billboard } from '@react-three/drei';
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
    
    // Ana ölçü çizgisi
    const mainLine = [start, end];
    
    // Extension çizgileri (kısa dikey çizgiler)
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(20);
    
    const ext1Start = start.clone().add(perpendicular);
    const ext1End = start.clone().sub(perpendicular);
    const ext2Start = end.clone().add(perpendicular);
    const ext2End = end.clone().sub(perpendicular);
    
    return {
      mainLine,
      extensions: [
        [ext1Start, ext1End],
        [ext2Start, ext2End]
      ]
    };
  }, [dimension]);

  return (
    <group>
      {/* Ana ölçü çizgisi */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([
              ...points.mainLine[0].toArray(),
              ...points.mainLine[1].toArray()
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial 
          color={isPreview ? "#ff6b35" : "#2563eb"} 
          linewidth={2}
        />
      </line>

      {/* Extension çizgileri */}
      {points.extensions.map((ext, index) => (
        <line key={index}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                ...ext[0].toArray(),
                ...ext[1].toArray()
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial 
            color={isPreview ? "#ff6b35" : "#2563eb"} 
            linewidth={1}
          />
        </line>
      ))}

      {/* Ölçü metni */}
      <Billboard position={dimension.textPosition}>
        <mesh>
          <planeGeometry args={[120, 30]} />
          <meshBasicMaterial 
            color="white" 
            transparent 
            opacity={0.9}
          />
        </mesh>
        <Text
          position={[0, 0, 0.1]}
          fontSize={12}
          color={isPreview ? "#ff6b35" : "#2563eb"}
          anchorX="center"
          anchorY="middle"
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
  isPositioning: boolean;
  completedDimensions: SimpleDimension[];
  currentSnapPoint: any;
}

const INITIAL_SIMPLE_DIMENSIONS_STATE: SimpleDimensionsState = {
  firstPoint: null,
  secondPoint: null,
  isPositioning: false,
  completedDimensions: [],
  currentSnapPoint: null
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
  const [mouseWorldPosition, setMouseWorldPosition] = useState<THREE.Vector3 | null>(null);

  // Intersection point hesaplama - SADECE DIMENSIONS İÇİN
  const getIntersectionPoint = (event: PointerEvent): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const mouseScreenPos = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);

    raycaster.setFromCamera({ x, y }, camera);
    
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const worldPoint = new THREE.Vector3();
    const intersectionSuccess = raycaster.ray.intersectPlane(plane, worldPoint);
    
    if (!intersectionSuccess) {
      return null;
    }
    
    setMouseWorldPosition(worldPoint);
    
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
    
    let finalPoint: THREE.Vector3;
    
    if (snapPoints.length > 0) {
      const closestSnap = snapPoints[0];
      setDimensionsState(prev => ({ ...prev, currentSnapPoint: closestSnap }));
      finalPoint = closestSnap.point;
    } else {
      setDimensionsState(prev => ({ ...prev, currentSnapPoint: null }));
      finalPoint = new THREE.Vector3(
        snapToGrid(worldPoint.x, gridSize),
        0,
        snapToGrid(worldPoint.z, gridSize)
      );
    }
    
    return finalPoint;
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
        isPositioning: false
      }));
      console.log(`🎯 Dimension: First point selected at [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`);
    } else if (!dimensionsState.secondPoint) {
      // İkinci nokta seçimi
      const distance = dimensionsState.firstPoint.distanceTo(point);
      setDimensionsState(prev => ({
        ...prev,
        secondPoint: point.clone(),
        isPositioning: true
      }));
      console.log(`🎯 Dimension: Second point selected, distance: ${convertToDisplayUnit(distance).toFixed(1)}${measurementUnit}`);
    } else if (dimensionsState.isPositioning) {
      // Ölçü tamamlama
      const distance = dimensionsState.firstPoint.distanceTo(dimensionsState.secondPoint);
      const textPosition = new THREE.Vector3()
        .addVectors(dimensionsState.firstPoint, dimensionsState.secondPoint)
        .multiplyScalar(0.5)
        .add(new THREE.Vector3(0, 50, 0));
      
      const newDimension: SimpleDimension = {
        id: Math.random().toString(36).substr(2, 9),
        startPoint: dimensionsState.firstPoint,
        endPoint: dimensionsState.secondPoint,
        distance: convertToDisplayUnit(distance),
        unit: measurementUnit,
        textPosition
      };
      
      setDimensionsState(prev => ({
        ...prev,
        completedDimensions: [...prev.completedDimensions, newDimension],
        firstPoint: null,
        secondPoint: null,
        isPositioning: false,
        currentSnapPoint: null
      }));
      
      console.log(`🎯 Dimension created: ${newDimension.distance.toFixed(1)}${measurementUnit}`);
    }
  };

  // Move handler
  const handlePointerMove = (event: THREE.Event<PointerEvent>) => {
    if (activeTool !== Tool.DIMENSION) return;
    
    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;
    // Sadece snap point'i güncelle, başka bir şey yapma
  };

  // Preview ölçüsü oluştur
  const previewDimension = useMemo(() => {
    if (!dimensionsState.firstPoint || !dimensionsState.secondPoint || !dimensionsState.isPositioning || !mouseWorldPosition) {
      return null;
    }

    const distance = dimensionsState.firstPoint.distanceTo(dimensionsState.secondPoint);
    const textPosition = new THREE.Vector3()
      .addVectors(dimensionsState.firstPoint, dimensionsState.secondPoint)
      .multiplyScalar(0.5)
      .add(new THREE.Vector3(0, 50, 0));
    
    return {
      id: 'preview',
      startPoint: dimensionsState.firstPoint,
      endPoint: dimensionsState.secondPoint,
      distance: convertToDisplayUnit(distance),
      unit: measurementUnit,
      textPosition
    };
  }, [dimensionsState, mouseWorldPosition, convertToDisplayUnit, measurementUnit]);

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
      {dimensionsState.secondPoint && dimensionsState.isPositioning && (
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