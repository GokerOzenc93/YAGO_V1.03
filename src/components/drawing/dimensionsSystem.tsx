import React, { useMemo, useState, useEffect } from 'react';
import * as THREE from 'three';
import { Text, Billboard } from '@react-three/drei';
import * as makerjs from 'makerjs';
import { useThree } from '@react-three/fiber';
import { useAppStore, Tool, SnapType } from '../../store/appStore';
import { findSnapPoints, SnapPointIndicators } from './snapSystem';
import { CompletedShape } from './types';
import { Shape } from '../../types/shapes';
import { snapToGrid } from './utils';

export interface MakerDimension {
  id: string;
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  distance: number;
  position: THREE.Vector3;
  unit: string;
  offset?: number;
}

interface MakerDimensionLineProps {
  dimension: MakerDimension;
  isPreview?: boolean;
}

export const MakerDimensionLine: React.FC<MakerDimensionLineProps> = ({ 
  dimension, 
  isPreview = false 
}) => {
  const dimensionGeometry = useMemo(() => {
    // Maker.js ile ölçü çizgisi oluştur
    const start = [dimension.startPoint.x, dimension.startPoint.z];
    const end = [dimension.endPoint.x, dimension.endPoint.z];
    
    // Ölçü offset'i (varsayılan 80mm)
    const offset = dimension.offset || 80;
    
    // Ana çizgi yönü
    const direction = [end[0] - start[0], end[1] - start[1]];
    const length = Math.sqrt(direction[0] * direction[0] + direction[1] * direction[1]);
    const normalizedDir = [direction[0] / length, direction[1] / length];
    
    // Perpendicular yön (offset için)
    const perpDir = [-normalizedDir[1], normalizedDir[0]];
    
    // Offset edilmiş başlangıç ve bitiş noktaları
    const offsetStart = [
      start[0] + perpDir[0] * offset,
      start[1] + perpDir[1] * offset
    ];
    const offsetEnd = [
      end[0] + perpDir[0] * offset,
      end[1] + perpDir[1] * offset
    ];
    
    // Maker.js model oluştur
    const model: makerjs.IModel = {
      models: {},
      paths: {}
    };
    
    // Ana ölçü çizgisi
    model.paths!['dimension_line'] = new makerjs.paths.Line(offsetStart, offsetEnd);
    
    // Extension çizgileri
    model.paths!['ext_line_1'] = new makerjs.paths.Line(start, [
      offsetStart[0] + perpDir[0] * 20,
      offsetStart[1] + perpDir[1] * 20
    ]);
    
    model.paths!['ext_line_2'] = new makerjs.paths.Line(end, [
      offsetEnd[0] + perpDir[0] * 20,
      offsetEnd[1] + perpDir[1] * 20
    ]);
    
    // Ok uçları (arrowheads)
    const arrowSize = 15;
    const arrowAngle = Math.PI / 6; // 30 derece
    
    // Sol ok
    const leftArrowDir1 = [
      -normalizedDir[0] * Math.cos(arrowAngle) - normalizedDir[1] * Math.sin(arrowAngle),
      -normalizedDir[0] * Math.sin(arrowAngle) + normalizedDir[1] * Math.cos(arrowAngle)
    ];
    const leftArrowDir2 = [
      -normalizedDir[0] * Math.cos(-arrowAngle) - normalizedDir[1] * Math.sin(-arrowAngle),
      -normalizedDir[0] * Math.sin(-arrowAngle) + normalizedDir[1] * Math.cos(-arrowAngle)
    ];
    
    model.paths!['arrow_left_1'] = new makerjs.paths.Line(offsetStart, [
      offsetStart[0] + leftArrowDir1[0] * arrowSize,
      offsetStart[1] + leftArrowDir1[1] * arrowSize
    ]);
    
    model.paths!['arrow_left_2'] = new makerjs.paths.Line(offsetStart, [
      offsetStart[0] + leftArrowDir2[0] * arrowSize,
      offsetStart[1] + leftArrowDir2[1] * arrowSize
    ]);
    
    // Sağ ok
    const rightArrowDir1 = [
      normalizedDir[0] * Math.cos(arrowAngle) - normalizedDir[1] * Math.sin(arrowAngle),
      normalizedDir[0] * Math.sin(arrowAngle) + normalizedDir[1] * Math.cos(arrowAngle)
    ];
    const rightArrowDir2 = [
      normalizedDir[0] * Math.cos(-arrowAngle) - normalizedDir[1] * Math.sin(-arrowAngle),
      normalizedDir[0] * Math.sin(-arrowAngle) + normalizedDir[1] * Math.cos(-arrowAngle)
    ];
    
    model.paths!['arrow_right_1'] = new makerjs.paths.Line(offsetEnd, [
      offsetEnd[0] + rightArrowDir1[0] * arrowSize,
      offsetEnd[1] + rightArrowDir1[1] * arrowSize
    ]);
    
    model.paths!['arrow_right_2'] = new makerjs.paths.Line(offsetEnd, [
      offsetEnd[0] + rightArrowDir2[0] * arrowSize,
      offsetEnd[1] + rightArrowDir2[1] * arrowSize
    ]);
    
    // Maker.js modelini Three.js geometrisine dönüştür
    const points: THREE.Vector3[] = [];
    
    makerjs.model.walk(model, {
      onPath: (walkPath) => {
        if (walkPath.pathContext && walkPath.pathContext.type === 'line') {
          const line = walkPath.pathContext as makerjs.IPathLine;
          points.push(new THREE.Vector3(line.origin[0], 0.1, line.origin[1]));
          points.push(new THREE.Vector3(line.end[0], 0.1, line.end[1]));
        }
      }
    });
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    
    points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;
    });
    
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    
    return { geometry, textPosition: new THREE.Vector3(
      (offsetStart[0] + offsetEnd[0]) / 2,
      5,
      (offsetStart[1] + offsetEnd[1]) / 2
    )};
  }, [dimension]);
  
  return (
    <group>
      {/* Ölçü çizgileri */}
      <lineSegments geometry={dimensionGeometry.geometry}>
        <lineBasicMaterial 
          color={isPreview ? "#ff6b35" : "#2563eb"} 
          linewidth={2}
          transparent
          opacity={isPreview ? 0.8 : 1.0}
        />
      </lineSegments>
      
      {/* Ölçü metni */}
      <Billboard position={dimensionGeometry.textPosition}>
        <mesh>
          <planeGeometry args={[150, 40]} />
          <meshBasicMaterial 
            color="white" 
            transparent 
            opacity={isPreview ? 0.8 : 0.95}
          />
        </mesh>
        <Text
          position={[0, 0, 0.1]}
          fontSize={14}
          color={isPreview ? "#ff6b35" : "#000000"}
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-medium.woff"
        >
          {`${dimension.distance.toFixed(1)} ${dimension.unit}`}
        </Text>
      </Billboard>
    </group>
  );
};

export interface MakerDimensionsState {
  firstPoint: THREE.Vector3 | null;
  secondPoint: THREE.Vector3 | null;
  previewPosition: THREE.Vector3 | null;
  isPositioning: boolean;
  completedDimensions: MakerDimension[];
  offset: number;
}

export const INITIAL_MAKER_DIMENSIONS_STATE: MakerDimensionsState = {
  firstPoint: null,
  secondPoint: null,
  previewPosition: null,
  isPositioning: false,
  completedDimensions: [],
  offset: 80 // Varsayılan offset 80mm
};

interface MakerDimensionsSystemProps {
  dimensionsState: MakerDimensionsState;
  mousePosition: THREE.Vector3 | null;
}

export const MakerDimensionsSystem: React.FC<MakerDimensionsSystemProps> = ({
  dimensionsState,
  mousePosition
}) => {
  // Preview ölçüsü oluştur
  const previewDimension = useMemo(() => {
    if (!dimensionsState.isPositioning || 
        !dimensionsState.firstPoint || 
        !dimensionsState.secondPoint || 
        !mousePosition) {
      return null;
    }

    const distance = dimensionsState.firstPoint.distanceTo(dimensionsState.secondPoint);
    
    return {
      id: 'preview',
      startPoint: dimensionsState.firstPoint,
      endPoint: dimensionsState.secondPoint,
      distance,
      position: mousePosition,
      unit: 'mm',
      offset: dimensionsState.offset
    };
  }, [dimensionsState, mousePosition]);

  return (
    <group>
      {/* Tamamlanmış ölçüler */}
      {dimensionsState.completedDimensions.map(dimension => (
        <MakerDimensionLine 
          key={dimension.id} 
          dimension={dimension} 
        />
      ))}
      
      {/* Preview ölçüsü */}
      {previewDimension && (
        <MakerDimensionLine 
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
    </group>
  );
};

// Tam ölçülendirme sistemi bileşeni
interface DimensionsManagerProps {
  completedShapes: CompletedShape[];
  shapes: Shape[];
}

export const DimensionsManager: React.FC<DimensionsManagerProps> = ({
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
  const [dimensionsState, setDimensionsState] = useState<MakerDimensionsState>(INITIAL_MAKER_DIMENSIONS_STATE);
  const [mouseWorldPosition, setMouseWorldPosition] = useState<THREE.Vector3 | null>(null);
  const [drawingState, setDrawingState] = useState({ snapPoint: null });

  // Intersection point hesaplama
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
    
    const perspectiveTolerance = snapTolerance * (camera instanceof THREE.PerspectiveCamera ? 3 : 1);
    
    const snapPoints = findSnapPoints(
      worldPoint,
      completedShapes, 
      shapes, 
      snapSettings, 
      perspectiveTolerance,
      null,
      null,
      camera,
      gl.domElement,
      mouseScreenPos,
      activeTool
    );
    
    let finalPoint: THREE.Vector3;
    
    if (snapPoints.length > 0) {
      const closestSnap = snapPoints[0];
      setDrawingState({ snapPoint: closestSnap });
      finalPoint = closestSnap.point;
    } else {
      setDrawingState({ snapPoint: null });
      finalPoint = new THREE.Vector3(
        snapToGrid(worldPoint.x, gridSize),
        0,
        snapToGrid(worldPoint.z, gridSize)
      );
    }
    
    return finalPoint;
  };

  // Ölçü click handler
  const handleDimensionsClick = (
    point: THREE.Vector3,
    dimensionsState: MakerDimensionsState,
    setDimensionsState: (updates: Partial<MakerDimensionsState>) => void,
    convertToDisplayUnit: (value: number) => number,
    measurementUnit: string
  ) => {
    if (!dimensionsState.firstPoint) {
      setDimensionsState({
        firstPoint: point.clone(),
        secondPoint: null,
        isPositioning: false,
        previewPosition: null
      });
      console.log(`🎯 Maker.js Dimension: First point selected at [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`);
    } else if (!dimensionsState.secondPoint) {
      const distance = dimensionsState.firstPoint.distanceTo(point);
      setDimensionsState({
        secondPoint: point.clone(),
        isPositioning: true
      });
      console.log(`🎯 Maker.js Dimension: Second point selected, distance: ${convertToDisplayUnit(distance).toFixed(1)}${measurementUnit}`);
    } else if (dimensionsState.isPositioning) {
      const distance = dimensionsState.firstPoint.distanceTo(dimensionsState.secondPoint);
      const newDimension: MakerDimension = {
        id: Math.random().toString(36).substr(2, 9),
        startPoint: dimensionsState.firstPoint,
        endPoint: dimensionsState.secondPoint,
        distance: convertToDisplayUnit(distance),
        position: point.clone(),
        unit: measurementUnit,
        offset: dimensionsState.offset
      };
      
      setDimensionsState({
        completedDimensions: [...dimensionsState.completedDimensions, newDimension],
        firstPoint: null,
        secondPoint: null,
        isPositioning: false,
        previewPosition: null
      });
      
      console.log(`🎯 Maker.js Dimension created: ${newDimension.distance.toFixed(1)}${measurementUnit} at position [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`);
    }
  };

  // Ölçü move handler
  const handleDimensionsMove = (
    point: THREE.Vector3,
    dimensionsState: MakerDimensionsState,
    setDimensionsState: (updates: Partial<MakerDimensionsState>) => void
  ) => {
    if (dimensionsState.isPositioning) {
      setDimensionsState({
        previewPosition: point.clone()
      });
    }
  };

  // Event handlers
  const handlePointerDown = (event: THREE.Event<PointerEvent>) => {
    if (activeTool !== Tool.DIMENSION) return;
    if (event.nativeEvent.button !== 0) return;
    
    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;
    
    event.stopPropagation();
    
    handleDimensionsClick(
      point,
      dimensionsState,
      (updates) => setDimensionsState(prev => ({ ...prev, ...updates })),
      convertToDisplayUnit,
      measurementUnit
    );
  };

  const handlePointerMove = (event: THREE.Event<PointerEvent>) => {
    if (activeTool !== Tool.DIMENSION) return;
    
    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;

    handleDimensionsMove(
      point,
      dimensionsState,
      (updates) => setDimensionsState(prev => ({ ...prev, ...updates }))
    );
  };

  // Reset dimensions state when tool changes
  useEffect(() => {
    if (activeTool === Tool.DIMENSION) {
      setDimensionsState(INITIAL_MAKER_DIMENSIONS_STATE);
    } else {
      setDimensionsState(INITIAL_MAKER_DIMENSIONS_STATE);
    }
  }, [activeTool]);

  return (
    <>
      {/* Invisible plane for interaction */}
      <mesh
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        visible={activeTool === Tool.DIMENSION}
      >
        <planeGeometry args={[100000, 100000]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Dimensions System */}
      <MakerDimensionsSystem 
        dimensionsState={dimensionsState}
        mousePosition={mouseWorldPosition}
      />

      {/* Snap Point Indicator */}
      <SnapPointIndicators snapPoint={drawingState.snapPoint} />
    </>
  );
};