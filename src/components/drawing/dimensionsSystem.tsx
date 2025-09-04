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
  // Dynamic tracking properties
  attachedToShapeId?: string;
  startAttachment?: {
    shapeId: string;
    localOffset: THREE.Vector3;
  };
  endAttachment?: {
    shapeId: string;
    localOffset: THREE.Vector3;
  };
}

interface SimpleDimensionLineProps {
  dimension: SimpleDimension;
  isPreview?: boolean;
  previewPosition?: THREE.Vector3;
}

const SimpleDimensionLine: React.FC<SimpleDimensionLineProps> = ({ 
  dimension, 
  isPreview = false,
  previewPosition
}) => {
  const { camera } = useThree();
  const { shapes } = useAppStore();
  const groupRef = useRef<THREE.Group>(null);
  const textRef = useRef<THREE.Mesh>(null);
  
  // Calculate dynamic dimension based on shape movements
  const dynamicDimension = useMemo(() => {
    let updatedDimension = { ...dimension };
    
    // Update start point if attached to a shape
    if (dimension.startAttachment) {
      const attachedShape = shapes.find(s => s.id === dimension.startAttachment!.shapeId);
      if (attachedShape) {
        const shapePosition = new THREE.Vector3(...attachedShape.position);
        updatedDimension.startPoint = shapePosition.clone().add(dimension.startAttachment.localOffset);
        updatedDimension.originalStart = updatedDimension.startPoint.clone();
      }
    }
    
    // Update end point if attached to a shape
    if (dimension.endAttachment) {
      const attachedShape = shapes.find(s => s.id === dimension.endAttachment!.shapeId);
      if (attachedShape) {
        const shapePosition = new THREE.Vector3(...attachedShape.position);
        updatedDimension.endPoint = shapePosition.clone().add(dimension.endAttachment.localOffset);
        updatedDimension.originalEnd = updatedDimension.endPoint.clone();
      }
    }
    
    // Recalculate distance and text position
    if (updatedDimension.startPoint && updatedDimension.endPoint) {
      const newDistance = updatedDimension.startPoint.distanceTo(updatedDimension.endPoint);
      updatedDimension.distance = useAppStore.getState().convertToDisplayUnit(newDistance);
      updatedDimension.textPosition = updatedDimension.startPoint.clone()
        .add(updatedDimension.endPoint)
        .multiplyScalar(0.5);
    }
    
    return updatedDimension;
  }, [dimension, shapes]);
  
  // Ölçü yazısı için formatlama
  const formattedDistance = useMemo(() => {
    const value = dynamicDimension.distance;
    return value % 1 === 0 ? value.toFixed(0) : value.toFixed(1);
  }, [dynamicDimension.distance]);

  const points = useMemo(() => {
    const start = dynamicDimension.startPoint;
    const end = dynamicDimension.endPoint;
    const originalStart = dynamicDimension.originalStart || start;
    const originalEnd = dynamicDimension.originalEnd || end;
    
    const distance = start.distanceTo(end);
    
    // Ana ölçü çizgisi
    const mainLine = [start, end];
    
    // Uzatma çizgileri
    const extensionLines = [];
    if (isPreview && previewPosition) {
      extensionLines.push([originalStart, previewPosition]);
      extensionLines.push([originalEnd, previewPosition]);
    } else {
      if (originalStart.distanceTo(start) > 0.1) {
        extensionLines.push([originalStart, start]);
      }
      if (originalEnd.distanceTo(end) > 0.1) {
        extensionLines.push([originalEnd, end]);
      }
    }
    
    // Ok uçları için hesaplamalar - daha küçük ve profesyonel
    const arrowSize = 10;
    const dir = new THREE.Vector3().subVectors(end, start).normalize();
    const perp = new THREE.Vector3(-dir.z, 0, dir.x).multiplyScalar(arrowSize / 2);
    
    const arrows = [];
    if (distance > arrowSize * 2) {
      // Çizgi yeterince uzunsa okları göster
      const arrow1a = start.clone().add(dir.clone().multiplyScalar(arrowSize).add(perp));
      const arrow1b = start.clone().add(dir.clone().multiplyScalar(arrowSize).sub(perp));
      arrows.push([start, arrow1a], [start, arrow1b]);
      
      const arrow2a = end.clone().sub(dir.clone().multiplyScalar(arrowSize).add(perp));
      const arrow2b = end.clone().sub(dir.clone().multiplyScalar(arrowSize).sub(perp));
      arrows.push([end, arrow2a], [end, arrow2b]);
    } else {
      // Aksi halde, çizginin dışına taşan okları göster (metin için yer açmak adına)
      const arrow1a = start.clone().add(dir.clone().multiplyScalar(-arrowSize).add(perp));
      const arrow1b = start.clone().add(dir.clone().multiplyScalar(-arrowSize).sub(perp));
      arrows.push([start, arrow1a], [start, arrow1b]);
      
      const arrow2a = end.clone().add(dir.clone().multiplyScalar(arrowSize).add(perp));
      const arrow2b = end.clone().add(dir.clone().multiplyScalar(arrowSize).sub(perp));
      arrows.push([end, arrow2a], [end, arrow2b]);
    }

    return { mainLine, extensionLines, arrows };
  }, [dynamicDimension, isPreview, previewPosition]);

  // Adjust text scale based on camera distance
  useEffect(() => {
    const updateTextSize = () => {
      if (textRef.current && groupRef.current) {
        const distance = camera.position.distanceTo(groupRef.current.position);
        
        // Dynamic scaling based on camera distance
        const scaleFactor = distance / 200;
        
        // Minimum ve maksimum ölçek sınırları
        const clampedScale = Math.min(Math.max(scaleFactor, 0.5), 5); // 0.5x ile 5x arasında sınırla
        
        textRef.current.scale.setScalar(clampedScale);
      }
    };

    updateTextSize();
    camera.addEventListener('change', updateTextSize);

    return () => camera.removeEventListener('change', updateTextSize);
  }, [camera, dynamicDimension, groupRef]);

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
          linewidth={2}
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
            color={isPreview ? "#ff6b35" : "#a9a9a9"} 
            linewidth={1}
            lineCap="round"
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
            linewidth={2}
            lineCap="round"
          />
        </line>
      ))}

      {/* Ölçü metni */}
      <Billboard position={dynamicDimension.textPosition} follow={true} lockX={false} lockY={false} lockZ={false}>
        <Text
          ref={textRef}
          position={[0, 0, 0.1]}
          fontSize={12} // Font size will be overridden by scale effect
          color={isPreview ? "#ff6b35" : "#00ff00"}
          anchorX="center"
          anchorY="middle"
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
  firstPointAttachment?: {
    shapeId: string;
    localOffset: THREE.Vector3;
  };
  secondPointAttachment?: {
    shapeId: string;
    localOffset: THREE.Vector3;
  };
}

const INITIAL_SIMPLE_DIMENSIONS_STATE: SimpleDimensionsState = {
  firstPoint: null,
  secondPoint: null,
  isPositioning: false,
  previewPosition: null,
  completedDimensions: [],
  currentSnapPoint: null,
  firstPointAttachment: undefined,
  secondPointAttachment: undefined
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
    
    // ORTHO MODE: Apply constraint for dimension positioning
    if (orthoMode === OrthoMode.ON && dimensionsState.firstPoint && !dimensionsState.isPositioning) {
      worldPoint = applyDimensionOrthoConstraint(worldPoint, dimensionsState.firstPoint, orthoMode);
    }
    
    // Positioning modunda snap detection yapma
    if (!dimensionsState.isPositioning) {
      // STANDART SNAP SYSTEM KULLAN - Mevcut snap ayarlarını kullan
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
      const snapPoint = dimensionsState.currentSnapPoint;
      setDimensionsState(prev => ({
        ...prev,
        firstPoint: point.clone(),
        secondPoint: null,
        isPositioning: false,
        previewPosition: null,
        firstPointAttachment: snapPoint ? {
          shapeId: snapPoint.shapeId || '',
          localOffset: new THREE.Vector3().subVectors(point, new THREE.Vector3(...(shapes.find(s => s.id === snapPoint.shapeId)?.position || [0, 0, 0])))
        } : undefined
      }));
      console.log(`🎯 Dimension: First point selected at [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`);
    } else if (!dimensionsState.secondPoint) {
      // İkinci nokta seçimi
      const distance = dimensionsState.firstPoint.distanceTo(point);
      const snapPoint = dimensionsState.currentSnapPoint;
      setDimensionsState(prev => ({
        ...prev,
        secondPoint: point.clone(),
        isPositioning: false, // Henüz positioning başlamadı
        previewPosition: null,
        secondPointAttachment: snapPoint ? {
          shapeId: snapPoint.shapeId || '',
          localOffset: new THREE.Vector3().subVectors(point, new THREE.Vector3(...(shapes.find(s => s.id === snapPoint.shapeId)?.position || [0, 0, 0])))
        } : undefined
      }));
      console.log(`🎯 Dimension: Second point selected, distance: ${convertToDisplayUnit(distance).toFixed(1)}${measurementUnit}`);
      console.log(`🎯 Dimension: Move mouse to position dimension line, then click to confirm`);
    } else if (dimensionsState.isPositioning) {
      // Ölçü tamamlama
      const distance = dimensionsState.firstPoint.distanceTo(dimensionsState.secondPoint);
      
      const mainVector = new THREE.Vector3().subVectors(dimensionsState.secondPoint, dimensionsState.firstPoint);
      
      const absX = Math.abs(mainVector.x);
      const absY = Math.abs(mainVector.y);
      const absZ = Math.abs(mainVector.z);
      
      let perpendicularOffset = new THREE.Vector3();
      
      if (absX >= absY && absX >= absZ) {
        const midPoint = new THREE.Vector3(
          (dimensionsState.firstPoint.x + dimensionsState.secondPoint.x) / 2,
          (dimensionsState.firstPoint.y + dimensionsState.secondPoint.y) / 2,
          (dimensionsState.firstPoint.z + dimensionsState.secondPoint.z) / 2
        );
        
        const toPreview = new THREE.Vector3().subVectors(dimensionsState.previewPosition, midPoint);
        const mainVectorNormalized = mainVector.clone().normalize();
        const parallelComponent = mainVectorNormalized.clone().multiplyScalar(toPreview.dot(mainVectorNormalized));
        perpendicularOffset = toPreview.clone().sub(parallelComponent);
        
      } else if (absZ >= absX && absZ >= absY) {
        const midPoint = new THREE.Vector3(
          (dimensionsState.firstPoint.x + dimensionsState.secondPoint.x) / 2,
          (dimensionsState.firstPoint.y + dimensionsState.secondPoint.y) / 2,
          (dimensionsState.firstPoint.z + dimensionsState.secondPoint.z) / 2
        );
        
        const toPreview = new THREE.Vector3().subVectors(dimensionsState.previewPosition, midPoint);
        const mainVectorNormalized = mainVector.clone().normalize();
        const parallelComponent = mainVectorNormalized.clone().multiplyScalar(toPreview.dot(mainVectorNormalized));
        perpendicularOffset = toPreview.clone().sub(parallelComponent);
        
      } else {
        const averageY = (dimensionsState.firstPoint.y + dimensionsState.secondPoint.y) / 2;
        const mainVectorXZ = new THREE.Vector3(mainVector.x, 0, mainVector.z);
        const midPoint = new THREE.Vector3(
          (dimensionsState.firstPoint.x + dimensionsState.secondPoint.x) / 2,
          averageY,
          (dimensionsState.firstPoint.z + dimensionsState.secondPoint.z) / 2
        );
        
        const toPreview = new THREE.Vector3(
          dimensionsState.previewPosition.x - midPoint.x,
          0,
          dimensionsState.previewPosition.z - midPoint.z
        );
        
        const mainVectorNormalized = mainVectorXZ.clone().normalize();
        const parallelComponent = mainVectorNormalized.clone().multiplyScalar(toPreview.dot(mainVectorNormalized));
        perpendicularOffset = toPreview.clone().sub(parallelComponent);
      }
      
      const dimensionStart = new THREE.Vector3(
        dimensionsState.firstPoint.x + perpendicularOffset.x,
        dimensionsState.firstPoint.y + perpendicularOffset.y,
        dimensionsState.firstPoint.z + perpendicularOffset.z
      );
      const dimensionEnd = new THREE.Vector3(
        dimensionsState.secondPoint.x + perpendicularOffset.x,
        dimensionsState.secondPoint.y + perpendicularOffset.y,
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
        originalEnd: dimensionsState.secondPoint,
        startAttachment: dimensionsState.firstPointAttachment,
        endAttachment: dimensionsState.secondPointAttachment
      };
      
      setDimensionsState(prev => ({
        ...prev,
        completedDimensions: [...prev.completedDimensions, newDimension],
        firstPoint: null,
        secondPoint: null,
        isPositioning: false,
        currentSnapPoint: null,
        previewPosition: null,
        firstPointAttachment: undefined,
        secondPointAttachment: undefined
      }));
      
      console.log(`🎯 Dimension created: ${newDimension.distance.toFixed(1)}${measurementUnit}`);
    }
  };

  // Move handler
  const handlePointerMove = (event: THREE.Event<PointerEvent>) => {
    if (activeTool !== Tool.DIMENSION) return;
    
    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;
    
    // ORTHO MODE: Apply constraint for dimension preview
    if (orthoMode === OrthoMode.ON && dimensionsState.firstPoint && dimensionsState.secondPoint) {
      const constrainedPoint = applyDimensionOrthoConstraint(point, dimensionsState.firstPoint, orthoMode);
      setDimensionsState(prev => ({
        ...prev,
        isPositioning: true,
        previewPosition: constrainedPoint
      }));
      return;
    }
    
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
    if (!dimensionsState.firstPoint || !dimensionsState.secondPoint || !dimensionsState.previewPosition) {
      return null;
    }

    const distance = dimensionsState.firstPoint.distanceTo(dimensionsState.secondPoint);
    
    const averageY = (dimensionsState.firstPoint.y + dimensionsState.secondPoint.y) / 2;
    
    const mainVector = new THREE.Vector3(
      dimensionsState.secondPoint.x - dimensionsState.firstPoint.x,
      0, // Y bileşenini sıfırla
      dimensionsState.secondPoint.z - dimensionsState.firstPoint.z
    );
    
    const midPoint = new THREE.Vector3(
      (dimensionsState.firstPoint.x + dimensionsState.secondPoint.x) / 2,
      averageY,
      (dimensionsState.firstPoint.z + dimensionsState.secondPoint.z) / 2
    );
    
    const toPreview = new THREE.Vector3(
      dimensionsState.previewPosition.x - midPoint.x,
      0,
      dimensionsState.previewPosition.z - midPoint.z
    );
    
    const mainVectorNormalized = mainVector.clone().normalize();
    const parallelComponent = mainVectorNormalized.clone().multiplyScalar(toPreview.dot(mainVectorNormalized));
    const perpendicularOffset = toPreview.clone().sub(parallelComponent);
    
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
      originalEnd: dimensionsState.secondPoint,
      previewPosition: dimensionsState.previewPosition // Fare konumunu prop olarak geç
    };
  }, [dimensionsState, convertToDisplayUnit, measurementUnit]);

  // Reset dimensions state when tool changes
  useEffect(() => {
    if (activeTool !== Tool.DIMENSION) {
      setDimensionsState(prev => ({
        ...INITIAL_SIMPLE_DIMENSIONS_STATE,
        completedDimensions: prev.completedDimensions
      }));
    }
  }, [activeTool]);

  // Handle Escape key to exit dimension tool
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
          isPreview={false}
          previewPosition={dimensionsState.previewPosition}
        />
      )}
      
      {/* İlk nokta göstergesi */}
      {dimensionsState.firstPoint && !dimensionsState.secondPoint && (
        <mesh position={dimensionsState.firstPoint}>
          <sphereGeometry args={[5]} />
          <meshBasicMaterial color="#ff6b35" />
        </mesh>
      )}
      
      {/* Snap point indicators */}
      {activeTool === Tool.DIMENSION && dimensionsState.currentSnapPoint && (
        <SnapPointIndicators snapPoint={dimensionsState.currentSnapPoint} />
      )}
    </>
  );
};
