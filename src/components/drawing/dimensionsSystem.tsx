import React, { useState, useEffect, useMemo, useRef } from 'react';
import * as THREE from 'three';
import { Text, Billboard } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import { useAppStore, Tool, SnapType, SnapSettings, OrthoMode } from '../../store/appStore.ts';
import { findSnapPoints, SnapPointIndicators } from './snapSystem.tsx';
import { CompletedShape } from './types';
import { Shape } from '../../types/shapes';
import { snapToGrid } from './utils.ts';
import { applyDimensionOrthoConstraint } from '../../utils/orthoUtils.ts';

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
  const groupRef = useRef<THREE.Group>(null);
  const textRef = useRef<THREE.Mesh>(null);
  
  // Ölçü yazısı için formatlama
  const formattedDistance = useMemo(() => {
    const value = dimension.distance;
    return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  }, [dimension.distance]);

  const points = useMemo(() => {
    const start = dimension.startPoint;
    const end = dimension.endPoint;
    const originalStart = dimension.originalStart || start;
    const originalEnd = dimension.originalEnd || end;
    
    const distance = start.distanceTo(end);
    
    // Ana ölçü çizgisi
    const mainLine = [start, end];
    
    // Uzatma çizgileri
    const extensionLines = [];
    
    // Uzatma çizgileri daima orijinal noktadan, ölçü çizgisinin nihai noktasına kadar uzanır.
    if (originalStart.distanceTo(start) > 0.1) {
      extensionLines.push([originalStart, start]);
    }
    
    if (originalEnd.distanceTo(end) > 0.1) {
      extensionLines.push([originalEnd, end]);
    }
    
    // Ok uçları için hesaplamalar - daha küçük ve profesyonel
    const arrowSize = 15;
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(arrowSize / 2);
    
    const arrows = [];
    // Okları doğru konumlarda oluştur
    const arrow1a = start.clone().sub(perp);
    const arrow1b = start.clone().add(perp);
    const arrow1c = start.clone().sub(dir.clone().multiplyScalar(arrowSize));
    arrows.push([arrow1a, arrow1c], [arrow1b, arrow1c]);
    
    const arrow2a = end.clone().sub(perp);
    const arrow2b = end.clone().add(perp);
    const arrow2c = end.clone().add(dir.clone().multiplyScalar(arrowSize));
    arrows.push([arrow2a, arrow2c], [arrow2b, arrow2c]);

    return { mainLine, extensionLines, arrows };
  }, [dimension]);

  // Adjust text scale based on camera distance
  useEffect(() => {
    const updateTextSize = () => {
      if (textRef.current && groupRef.current) {
        const distance = camera.position.distanceTo(groupRef.current.position);
        
        const scaleFactor = distance / 200;
        
        const clampedScale = Math.min(Math.max(scaleFactor, 0.5), 5);
        
        textRef.current.scale.setScalar(clampedScale);
      }
    };

    updateTextSize();
    camera.addEventListener('change', updateTextSize);

    return () => camera.removeEventListener('change', updateTextSize);
  }, [camera, dimension, groupRef]);

  return (
    <group ref={groupRef}>
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
          color={isPreview ? "#ff6b35" : "#00ff00"} 
          linewidth={3}
          depthTest={false}
        />
      </line>

      {/* Uzatma çizgileri */}
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
            color={isPreview ? "#ff6b35" : "#00ff00"} 
            linewidth={2}
            depthTest={false}
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
            color={isPreview ? "#ff6b35" : "#00ff00"} 
            linewidth={3}
            depthTest={false}
          />
        </line>
      ))}

      {/* Ölçü metni */}
      <Billboard position={dimension.textPosition} follow={true} lockX={false} lockY={false} lockZ={false}>
        <Text
          ref={textRef}
          position={[0, 0, 0.1]}
          fontSize={14}
          color={isPreview ? "#ff6b35" : "#00ff00"}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0}
          outlineColor="#000000"
        >
          {formattedDistance}
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
    setSnapSettingsBatch,
    snapTolerance,
    snapSettings,
    orthoMode, 
    setOrthoMode 
  } = useAppStore();
  
  const { camera, raycaster, gl } = useThree();
  const [dimensionsState, setDimensionsState] = useState<SimpleDimensionsState>(INITIAL_SIMPLE_DIMENSIONS_STATE);
  const [mouseWorldPosition, setMouseWorldPosition] = useState<THREE.Vector3 | null>(null);
  const [originalSnapSettings, setOriginalSnapSettings] = useState<SnapSettings | null>(null);

  // Dimension tool aktivasyonu/deaktivasyonu için snap ayarlarını yönet
  useEffect(() => {
    if (activeTool === Tool.DIMENSION) {
      // Mevcut snap ayarlarını store'dan al
      const currentSnapSettings = useAppStore.getState().snapSettings;
      
      // Mevcut snap ayarlarını kaydet
      setOriginalSnapSettings({ ...currentSnapSettings });
      
      // Ortho mode'u otomatik aç
      setOrthoMode(OrthoMode.ON);
      
      // Sadece ENDPOINT ve MIDPOINT'i aktif et - batch update
      setSnapSettingsBatch({
        [SnapType.ENDPOINT]: true,
        [SnapType.MIDPOINT]: true,
        [SnapType.CENTER]: false,
        [SnapType.QUADRANT]: false,
        [SnapType.PERPENDICULAR]: false,
        [SnapType.INTERSECTION]: false,
        [SnapType.NEAREST]: false,
      });
      
      console.log('🎯 Dimension tool activated: ENDPOINT/MIDPOINT snaps + Ortho mode enabled');
    } else if (originalSnapSettings && activeTool !== Tool.DIMENSION) {
      // Orijinal snap ayarlarını geri yükle
      setSnapSettingsBatch(originalSnapSettings);
      setOriginalSnapSettings(null);
      
      // Ortho mode'u kapat
      setOrthoMode(OrthoMode.OFF);
      
      console.log('🎯 Dimension tool deactivated: Original settings + Ortho mode restored');
    }
  }, [activeTool, setSnapSettingsBatch, originalSnapSettings, setOrthoMode]);

  const getIntersectionPoint = (event: PointerEvent): THREE.Vector3 | null => {
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    const mouseScreenPos = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);

    raycaster.setFromCamera({ x, y }, camera);
    
    let worldPoint = new THREE.Vector3();
    let intersectionSuccess = false;
    
    if (dimensionsState.isPositioning && dimensionsState.firstPoint && dimensionsState.secondPoint) {
      const mainVector = new THREE.Vector3().subVectors(dimensionsState.secondPoint, dimensionsState.firstPoint);
      const mainVectorNormalized = mainVector.clone().normalize();
      const perpendicularVector = new THREE.Vector3().crossVectors(mainVectorNormalized, new THREE.Vector3(0, 1, 0)).normalize();
      const midPoint = new THREE.Vector3().addVectors(dimensionsState.firstPoint, dimensionsState.secondPoint).multiplyScalar(0.5);
      
      const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(perpendicularVector, midPoint);
      intersectionSuccess = raycaster.ray.intersectPlane(plane, worldPoint);
    } else {
      const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
      intersectionSuccess = raycaster.ray.intersectPlane(plane, worldPoint);
    }
    
    if (!intersectionSuccess) {
      return null;
    }
    
    setMouseWorldPosition(worldPoint);
    
    if (orthoMode === OrthoMode.ON && dimensionsState.firstPoint && !dimensionsState.isPositioning) {
      worldPoint = applyDimensionOrthoConstraint(worldPoint, dimensionsState.firstPoint, orthoMode);
    }
    
    if (!dimensionsState.isPositioning && !dimensionsState.secondPoint) {
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
        mouseScreenPos
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
    
    if (dimensionsState.isPositioning) {
      setDimensionsState(prev => ({ ...prev, currentSnapPoint: null }));
    }
    
    return worldPoint;
  };

  const handlePointerDown = (event: THREE.Event<PointerEvent>) => {
    if (activeTool !== Tool.DIMENSION) return;
    if (event.nativeEvent.button !== 0) return;
    
    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;
    
    event.stopPropagation();
    
    if (!dimensionsState.firstPoint) {
      setDimensionsState(prev => ({
        ...prev,
        firstPoint: point.clone(),
        secondPoint: null,
        isPositioning: false,
        previewPosition: null
      }));
      console.log(`🎯 Dimension: First point selected at [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`);
    } else if (!dimensionsState.secondPoint) {
      const distance = dimensionsState.firstPoint.distanceTo(point);
      setDimensionsState(prev => ({
        ...prev,
        secondPoint: point.clone(),
        isPositioning: false,
        previewPosition: null
      }));
      console.log(`🎯 Dimension: Second point selected, distance: ${convertToDisplayUnit(distance).toFixed(1)}${measurementUnit}`);
      console.log(`🎯 Dimension: Move mouse to position dimension line, then click to confirm`);
    } else if (dimensionsState.isPositioning) {
      const distance = dimensionsState.firstPoint.distanceTo(dimensionsState.secondPoint);
      
      const mainVector = new THREE.Vector3().subVectors(dimensionsState.secondPoint, dimensionsState.firstPoint);
      const mainVectorNormalized = mainVector.clone().normalize();
      
      const toPreview = new THREE.Vector3().subVectors(dimensionsState.previewPosition, dimensionsState.firstPoint);
      
      const parallelComponent = mainVectorNormalized.clone().multiplyScalar(toPreview.dot(mainVectorNormalized));
      const perpendicularOffset = toPreview.clone().sub(parallelComponent);
      
      const dimensionStart = dimensionsState.firstPoint.clone().add(perpendicularOffset);
      const dimensionEnd = dimensionsState.secondPoint.clone().add(perpendicularOffset);
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

  const handlePointerMove = (event: THREE.Event<PointerEvent>) => {
    if (activeTool !== Tool.DIMENSION) return;
    
    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;
    
    if (orthoMode === OrthoMode.ON && dimensionsState.firstPoint && dimensionsState.secondPoint) {
      const constrainedPoint = applyDimensionOrthoConstraint(point, dimensionsState.firstPoint, orthoMode);
      setDimensionsState(prev => ({
        ...prev,
        isPositioning: true,
        previewPosition: constrainedPoint
      }));
      return;
    }
    
    if (dimensionsState.firstPoint && dimensionsState.secondPoint) {
      setDimensionsState(prev => ({
        ...prev,
        isPositioning: true,
        previewPosition: point.clone()
      }));
    }
  };

  const previewDimension = useMemo(() => {
    if (!dimensionsState.firstPoint || !dimensionsState.secondPoint || !dimensionsState.previewPosition) {
      return null;
    }

    const distance = dimensionsState.firstPoint.distanceTo(dimensionsState.secondPoint);
    
    const mainVector = new THREE.Vector3().subVectors(dimensionsState.secondPoint, dimensionsState.firstPoint);
    const mainVectorNormalized = mainVector.clone().normalize();
    
    const toPreview = new THREE.Vector3().subVectors(dimensionsState.previewPosition, dimensionsState.firstPoint);
    
    const parallelComponent = mainVectorNormalized.clone().multiplyScalar(toPreview.dot(mainVectorNormalized));
    const perpendicularOffset = toPreview.clone().sub(parallelComponent);
    
    const dimensionStart = dimensionsState.firstPoint.clone().add(perpendicularOffset);
    const dimensionEnd = dimensionsState.secondPoint.clone().add(perpendicularOffset);
    const textPosition = dimensionStart.clone().add(dimensionEnd).multiplyScalar(0.5);
    
    return {
      id: 'preview',
      startPoint: dimensionStart,
      endPoint: dimensionEnd,
      distance: convertToDisplayUnit(distance),
      unit: measurementUnit,
      textPosition,
      originalStart: dimensionsState.firstPoint,
      originalEnd: dimensionsState.secondPoint,
    };
  }, [dimensionsState, convertToDisplayUnit, measurementUnit]);

  useEffect(() => {
    if (activeTool !== Tool.DIMENSION) {
      setDimensionsState(prev => ({
        ...INITIAL_SIMPLE_DIMENSIONS_STATE,
        completedDimensions: prev.completedDimensions
      }));
    }
  }, [activeTool]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (activeTool === Tool.DIMENSION && e.key === 'Escape') {
        setDimensionsState(prev => ({
          ...INITIAL_SIMPLE_DIMENSIONS_STATE,
          completedDimensions: prev.completedDimensions
        }));
        
        const { setActiveTool } = useAppStore.getState();
        setActiveTool(Tool.SELECT);
        
        console.log('🎯 Dimension tool exited with Escape key - dimensions preserved');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
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

      {dimensionsState.completedDimensions.map(dimension => (
        <SimpleDimensionLine 
          key={dimension.id} 
          dimension={dimension} 
        />
      ))}
      
      {previewDimension && (
        <SimpleDimensionLine 
          dimension={previewDimension} 
          isPreview={true}
        />
      )}
      
      {dimensionsState.firstPoint && !dimensionsState.secondPoint && (
        <mesh position={dimensionsState.firstPoint}>
          <sphereGeometry args={[5]} />
          <meshBasicMaterial color="#ff6b35" />
        </mesh>
      )}
      
      {activeTool === Tool.DIMENSION && dimensionsState.currentSnapPoint && (
        <SnapPointIndicators snapPoint={dimensionsState.currentSnapPoint} />
      )}
    </>
  );
};
