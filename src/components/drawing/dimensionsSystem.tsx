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
  const { camera } = useThree();
  
  // Calculate dynamic text size based on camera distance
  const textSize = useMemo(() => {
    const distance = camera.position.distanceTo(dimension.textPosition);
    // Scale text size based on distance to maintain readability
    const baseSize = 14;
    const scaleFactor = Math.max(0.5, Math.min(2.0, distance / 2000));
    return baseSize * scaleFactor;
  }, [camera.position, dimension.textPosition]);
  
  // Calculate text background size based on text content
  const textBackgroundSize = useMemo(() => {
    const text = `${dimension.distance.toFixed(1)} ${dimension.unit}`;
    const width = Math.max(120, text.length * textSize * 0.6);
    const height = textSize * 1.8;
    return { width, height };
  }, [dimension.distance, dimension.unit, textSize]);

  const points = useMemo(() => {
    const start = dimension.startPoint;
    const end = dimension.endPoint;
    const originalStart = dimension.originalStart || start;
    const originalEnd = dimension.originalEnd || end;
    
    // Ana ölçü çizgisi
    const mainLine = [start, end];
    
    // Extension çizgileri (orijinal noktalardan ölçü çizgisine)
    const extensionLines = [];
    
    // İlk nokta için extension çizgisi
    if (originalStart.distanceTo(start) > 1) {
      extensionLines.push([originalStart, start]);
    }
    
    // İkinci nokta için extension çizgisi
    if (originalEnd.distanceTo(end) > 1) {
      extensionLines.push([originalEnd, end]);
    }
    
    // Ölçü çizgisinin uçlarında kısa perpendicular çizgiler
    const direction = new THREE.Vector3().subVectors(end, start).normalize();
    const perpendicular = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(15);
    
    const tick1Start = start.clone().add(perpendicular);
    const tick1End = start.clone().sub(perpendicular);
    const tick2Start = end.clone().add(perpendicular);
    const tick2End = end.clone().sub(perpendicular);
    
    // Ok uçları için hesaplamalar
    const arrowSize = 25;
    const arrowAngle = Math.PI / 6; // 30 derece
    
    // Başlangıç oku (start noktasında)
    const arrowDir1 = direction.clone().multiplyScalar(-arrowSize);
    const arrowPerp1 = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(arrowSize * Math.tan(arrowAngle));
    
    const arrow1Point1 = start.clone().add(arrowDir1).add(arrowPerp1);
    const arrow1Point2 = start.clone().add(arrowDir1).sub(arrowPerp1);
    
    // Bitiş oku (end noktasında)
    const arrowDir2 = direction.clone().multiplyScalar(arrowSize);
    const arrowPerp2 = new THREE.Vector3(-direction.z, 0, direction.x).multiplyScalar(arrowSize * Math.tan(arrowAngle));
    
    const arrow2Point1 = end.clone().add(arrowDir2).add(arrowPerp2);
    const arrow2Point2 = end.clone().add(arrowDir2).sub(arrowPerp2);
    
    return {
      mainLine,
      extensionLines,
      ticks: [
        [tick1Start, tick1End],
        [tick2Start, tick2End]
      ],
      arrows: [
        [start, arrow1Point1],
        [start, arrow1Point2],
        [end, arrow2Point1],
        [end, arrow2Point2]
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
          linewidth={3}
        />
      </line>

      {/* Extension çizgileri */}
      {points.extensionLines.map((ext, index) => (
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
            linewidth={1.5}
            lineDashSize={8}
            gapSize={4}
            dashed={true}
            opacity={0.7}
            transparent
          />
        </line>
      ))}
      
      {/* Tick marks (uç çizgileri) */}
      {points.ticks.map((tick, index) => (
        <line key={`tick-${index}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                ...tick[0].toArray(),
                ...tick[1].toArray()
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial 
            color={isPreview ? "#ff6b35" : "#2563eb"} 
            linewidth={2.5}
          />
        </line>
      ))}
      
      {/* Ok uçları */}
      {points.arrows.map((arrow, index) => (
        <line key={`arrow-${index}`}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={2}
              array={new Float32Array([
                ...arrow[0].toArray(),
                ...arrow[1].toArray()
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial 
            color={isPreview ? "#ff6b35" : "#2563eb"} 
            linewidth={2.5}
          />
        </line>
      ))}

      {/* Ölçü metni - Çizgiden uzaklaştırılmış pozisyon */}
      <Billboard 
        position={[
          dimension.textPosition.x,
          dimension.textPosition.y + 40, // Çizginin üstüne yerleştir
          dimension.textPosition.z
        ]}
        follow={true}
        lockX={false}
        lockY={false}
        lockZ={false}
      >
        <mesh>
          <planeGeometry args={[textBackgroundSize.width, textBackgroundSize.height]} />
          <meshBasicMaterial 
            color="white" 
            transparent 
            opacity={0.95}
            depthWrite={false}
          />
        </mesh>
        <Text
          position={[0, 0, 0.1]}
          fontSize={textSize}
          color={isPreview ? "#ff6b35" : "#2563eb"}
          anchorX="center"
          anchorY="middle"
          font="/fonts/inter-medium.woff"
          fontWeight="500"
          letterSpacing={0.02}
          lineHeight={1.2}
          maxWidth={textBackgroundSize.width * 0.9}
          textAlign="center"
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
  previewPosition: THREE.Vector3 | null;
  completedDimensions: SimpleDimension[];
  currentSnapPoint: any;
}

const INITIAL_SIMPLE_DIMENSIONS_STATE: SimpleDimensionsState = {
  firstPoint: null,
  secondPoint: null,
  isPositioning: false,
  previewPosition: null,
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
    
    let worldPoint = new THREE.Vector3();
    let intersectionSuccess = false;
    
    // Positioning modunda iken, ölçü çizgisini perpendicular düzlemde konumlandır
    if (dimensionsState.isPositioning && dimensionsState.firstPoint && dimensionsState.secondPoint) {
      // Seçilen iki noktanın ortalama yüksekliğinde düzlem oluştur
      const averageY = (dimensionsState.firstPoint.y + dimensionsState.secondPoint.y) / 2;
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), -averageY);
      intersectionSuccess = raycaster.ray.intersectPlane(plane, worldPoint);
    } else {
      // Normal mod: Y=0 düzlemi
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      intersectionSuccess = raycaster.ray.intersectPlane(plane, worldPoint);
    }
    
    if (!intersectionSuccess) {
      return null;
    }
    
    setMouseWorldPosition(worldPoint);
    
    // Positioning modunda snap detection yapma
    if (!dimensionsState.isPositioning) {
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
    }
    
    // Positioning modunda raw world point döndür
    return worldPoint;
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
        isPositioning: false,
        previewPosition: null
      }));
      console.log(`🎯 Dimension: First point selected at [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`);
    } else if (!dimensionsState.secondPoint) {
      // İkinci nokta seçimi
      const distance = dimensionsState.firstPoint.distanceTo(point);
      setDimensionsState(prev => ({
        ...prev,
        secondPoint: point.clone(),
        isPositioning: false, // Henüz positioning başlamadı
        previewPosition: null
      }));
      console.log(`🎯 Dimension: Second point selected, distance: ${convertToDisplayUnit(distance).toFixed(1)}${measurementUnit}`);
      console.log(`🎯 Dimension: Move mouse to position dimension line, then click to confirm`);
    } else if (dimensionsState.isPositioning) {
      // Ölçü tamamlama
      const distance = dimensionsState.firstPoint.distanceTo(dimensionsState.secondPoint);
      
      // Seçilen noktaların yükseklik hizasında ölçü çizgisi oluştur
      const averageY = (dimensionsState.firstPoint.y + dimensionsState.secondPoint.y) / 2;
      
      // Ana vektör (XZ düzleminde)
      const mainVector = new THREE.Vector3(
        dimensionsState.secondPoint.x - dimensionsState.firstPoint.x,
        0, // Y bileşenini sıfırla
        dimensionsState.secondPoint.z - dimensionsState.firstPoint.z
      );
      
      // Orta nokta (seçilen noktaların yükseklik hizasında)
      const midPoint = new THREE.Vector3(
        (dimensionsState.firstPoint.x + dimensionsState.secondPoint.x) / 2,
        averageY,
        (dimensionsState.firstPoint.z + dimensionsState.secondPoint.z) / 2
      );
      
      // Tıklanan noktadan orta noktaya vektör (sadece XZ düzleminde)
      const clickPoint = dimensionsState.previewPosition || point;
      const toClick = new THREE.Vector3(
        clickPoint.x - midPoint.x,
        0, // Y bileşenini sıfırla
        clickPoint.z - midPoint.z
      );
      
      // Perpendicular offset hesapla (XZ düzleminde)
      const mainVectorNormalized = mainVector.clone().normalize();
      const parallelComponent = mainVectorNormalized.clone().multiplyScalar(toClick.dot(mainVectorNormalized));
      const perpendicularOffset = toClick.clone().sub(parallelComponent);
      
      // Ölçü çizgisinin başlangıç ve bitiş noktalarını seçilen noktaların yükseklik hizasında ayarla
      const dimensionStart = new THREE.Vector3(
        dimensionsState.firstPoint.x + perpendicularOffset.x,
        averageY, // Seçilen noktaların ortalama yüksekliği
        dimensionsState.firstPoint.z + perpendicularOffset.z
      );
      const dimensionEnd = new THREE.Vector3(
        dimensionsState.secondPoint.x + perpendicularOffset.x,
        averageY, // Seçilen noktaların ortalama yüksekliği
        dimensionsState.secondPoint.z + perpendicularOffset.z
      );
      const textPosition = dimensionStart.clone().add(dimensionEnd).multiplyScalar(0.5);
      
      const newDimension: SimpleDimension = {
        id: Math.random().toString(36).substr(2, 9),
        startPoint: dimensionStart,
        endPoint: dimensionEnd,
        distance: convertToDisplayUnit(distance),
        unit: measurementUnit,
        textPosition,
        originalStart: dimensionsState.firstPoint,
        originalEnd: dimensionsState.secondPoint
      };
      
      setDimensionsState(prev => ({
        ...prev,
        completedDimensions: [...prev.completedDimensions, newDimension],
        firstPoint: null,
        secondPoint: null,
        isPositioning: false,
        currentSnapPoint: null,
        previewPosition: null
      }));
      
      console.log(`🎯 Dimension created: ${newDimension.distance.toFixed(1)}${measurementUnit}`);
    }
  };

  // Move handler
  const handlePointerMove = (event: THREE.Event<PointerEvent>) => {
    if (activeTool !== Tool.DIMENSION) return;
    
    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;
    
    // İkinci nokta seçildikten sonra fareyle ölçü pozisyonunu güncelle
    if (dimensionsState.firstPoint && dimensionsState.secondPoint) {
      setDimensionsState(prev => ({
        ...prev,
        isPositioning: true,
        previewPosition: point.clone()
      }));
    }
  };

  // Preview ölçüsü oluştur
  const previewDimension = useMemo(() => {
    // İkinci nokta seçildikten sonra ve fare hareket ettikçe preview göster
    if (!dimensionsState.firstPoint || !dimensionsState.secondPoint || !dimensionsState.previewPosition) {
      return null;
    }

    const distance = dimensionsState.firstPoint.distanceTo(dimensionsState.secondPoint);
    
    // Seçilen noktaların yükseklik hizasında preview oluştur
    const averageY = (dimensionsState.firstPoint.y + dimensionsState.secondPoint.y) / 2;
    
    // Ana vektör (XZ düzleminde)
    const mainVector = new THREE.Vector3(
      dimensionsState.secondPoint.x - dimensionsState.firstPoint.x,
      0, // Y bileşenini sıfırla
      dimensionsState.secondPoint.z - dimensionsState.firstPoint.z
    );
    
    // Orta nokta (seçilen noktaların yükseklik hizasında)
    const midPoint = new THREE.Vector3(
      (dimensionsState.firstPoint.x + dimensionsState.secondPoint.x) / 2,
      averageY,
      (dimensionsState.firstPoint.z + dimensionsState.secondPoint.z) / 2
    );
    
    // Preview pozisyonundan orta noktaya vektör (sadece XZ düzleminde)
    const toPreview = new THREE.Vector3(
      dimensionsState.previewPosition.x - midPoint.x,
      0, // Y bileşenini sıfırla
      dimensionsState.previewPosition.z - midPoint.z
    );
    
    // Perpendicular offset hesapla (XZ düzleminde)
    const mainVectorNormalized = mainVector.clone().normalize();
    const parallelComponent = mainVectorNormalized.clone().multiplyScalar(toPreview.dot(mainVectorNormalized));
    const perpendicularOffset = toPreview.clone().sub(parallelComponent);
    
    // Ölçü çizgisinin başlangıç ve bitiş noktalarını seçilen noktaların yükseklik hizasında ayarla
    const dimensionStart = new THREE.Vector3(
      dimensionsState.firstPoint.x + perpendicularOffset.x,
      averageY, // Seçilen noktaların ortalama yüksekliği
      dimensionsState.firstPoint.z + perpendicularOffset.z
    );
    const dimensionEnd = new THREE.Vector3(
      dimensionsState.secondPoint.x + perpendicularOffset.x,
      averageY, // Seçilen noktaların ortalama yüksekliği
      dimensionsState.secondPoint.z + perpendicularOffset.z
    );
    const textPosition = dimensionStart.clone().add(dimensionEnd).multiplyScalar(0.5);
    
    return {
      id: 'preview',
      startPoint: dimensionStart,
      endPoint: dimensionEnd,
      distance: convertToDisplayUnit(distance),
      unit: measurementUnit,
      textPosition,
      originalStart: dimensionsState.firstPoint,
      originalEnd: dimensionsState.secondPoint
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