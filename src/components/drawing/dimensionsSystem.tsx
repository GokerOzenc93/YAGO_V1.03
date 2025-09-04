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
  previewPosition?: THREE.Vector3;
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
    
    const textGap = 50; 
    const mainVector = new THREE.Vector3().subVectors(end, start).normalize();
    
    const mainLinePoints = [];
    if (distance > textGap) {
      const startOfTextGap = start.clone().add(mainVector.clone().multiplyScalar(distance / 2 - textGap / 2));
      const endOfTextGap = start.clone().add(mainVector.clone().multiplyScalar(distance / 2 + textGap / 2));
      mainLinePoints.push(start, startOfTextGap, endOfTextGap, end);
    } else {
      mainLinePoints.push(start, end);
    }
    
    const extensionLines = [];
    if (originalStart.distanceTo(start) > 0.1) {
      extensionLines.push([originalStart, start]);
    }
    if (originalEnd.distanceTo(end) > 0.1) {
      extensionLines.push([originalEnd, end]);
    }
    
    const tickSize = 10;
    const perp = new THREE.Vector3(-mainVector.z, 0, mainVector.x).multiplyScalar(tickSize / 2);
    
    const ticks = [
      [start.clone().sub(perp), start.clone().add(perp)],
      [end.clone().sub(perp), end.clone().add(perp)]
    ];

    return { mainLinePoints, extensionLines, ticks };
  }, [dimension]);

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
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.mainLinePoints.length}
            array={new Float32Array(points.mainLinePoints.flatMap(p => p.toArray()))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial 
          color={"#00ff00"} 
          linewidth={3}
          depthTest={false}
        />
      </line>

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
            color={"#a9a9a9"} 
            linewidth={2}
            depthTest={false}
          />
        </line>
      ))}
      
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
            color={"#00ff00"} 
            linewidth={3}
            depthTest={false}
          />
        </line>
      ))}

      <Billboard position={dimension.textPosition} follow={true} lockX={false} lockY={false} lockZ={false}>
        <Text
          ref={textRef}
          position={[0, 0, 0.1]}
          fontSize={14}
          color={"#00ff00"}
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

  useEffect(() => {
    if (activeTool === Tool.DIMENSION) {
      const currentSnapSettings = useAppStore.getState().snapSettings;
      
      setOriginalSnapSettings({ ...currentSnapSettings });
      
      setOrthoMode(OrthoMode.ON);
      
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
      setSnapSettingsBatch(originalSnapSettings);
      setOriginalSnapSettings(null);
      
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
    
    const midPoint = new THREE.Vector3().addVectors(dimensionsState.firstPoint, dimensionsState.secondPoint).multiplyScalar(0.5);

    const toPreview = new THREE.Vector3().subVectors(dimensionsState.previewPosition, midPoint);
    const mainVector = new THREE.Vector3().subVectors(dimensionsState.secondPoint, dimensionsState.firstPoint);
    const mainVectorNormalized = mainVector.clone().normalize();
    
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
