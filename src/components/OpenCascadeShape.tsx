import React, { useRef, useEffect, useMemo, useState } from 'react';
import { useAppStore } from '../store/appStore';
import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { SHAPE_COLORS } from '../types/shapes';
import { ViewMode } from '../store/appStore';
import {
  createBox as createOcBox,
  createCylinder as createOcCylinder,
  ocShapeToThreeGeometry
} from '../lib/opencascadeUtils';

interface Props {
  shape: Shape;
  onContextMenuRequest?: (event: any, shape: Shape) => void;
  isEditMode?: boolean;
  isBeingEdited?: boolean;
  isFaceEditMode?: boolean;
  selectedFaceIndex?: number | null;
  onFaceSelect?: (faceIndex: number) => void;
  isVolumeEditMode?: boolean;
}

const OpenCascadeShape: React.FC<Props> = ({
  shape,
  onContextMenuRequest,
  isEditMode = false,
  isBeingEdited = false,
  isFaceEditMode = false,
  onFaceSelect,
  isVolumeEditMode = false,
}) => {
  // HATA DÜZELTMESİ: Bileşenin en başında, 'shape' prop'unun geçerli olup olmadığını kontrol et.
  // Bu, 'position' gibi özelliklere erişmeye çalışırken oluşan çökmeyi engeller.
  if (!shape) {
    return null;
  }

  const meshRef = useRef<THREE.Mesh>(null);
  const transformRef = useRef<any>(null);
  const {
    activeTool,
    selectedShapeId,
    gridSize,
    setSelectedObjectPosition,
    viewMode,
  } = useAppStore();
  const isSelected = selectedShapeId === shape.id;

  // Geometriyi bileşenin kendi içinde state olarak tutuyoruz.
  const [geometry, setGeometry] = useState<THREE.BufferGeometry | null>(null);

  // Bu effect, bileşen yüklendiğinde OCC ile geometriyi oluşturur.
  useEffect(() => {
    let isMounted = true;
    const generateGeometry = async () => {
      const ocInstance = (window as any).oc;
      if (!ocInstance) {
        console.warn("OCC instance'ı hazır değil, bekleniyor:", shape.id);
        return;
      }

      let ocShape;
      try {
        if (shape.type === 'box') {
          const { width, height, depth } = shape.parameters;
          ocShape = createOcBox(ocInstance, width, height, depth);
        } else if (shape.type === 'cylinder') {
          const { radius, height } = shape.parameters;
          ocShape = createOcCylinder(ocInstance, radius, height);
        } else {
          return;
        }

        if (ocShape) {
          const threeGeom = ocShapeToThreeGeometry(ocInstance, ocShape);
          if (threeGeom && isMounted) {
            setGeometry(threeGeom); // Oluşturulan geometriyi state'e kaydet
          }
        }
      } catch (error) {
        console.error(`'${shape.id}' ID'li şekil için geometri oluşturulurken hata:`, error);
      }
    };

    generateGeometry();

    return () => {
      isMounted = false;
    };
  }, [shape.id, shape.type, shape.parameters]);

  const edgesGeometry = useMemo(() => {
    if (!geometry) return null;
    const newGeom = new THREE.BufferGeometry();
    newGeom.setAttribute('position', geometry.attributes.position);
    if (geometry.index) {
      newGeom.setIndex(geometry.index);
    }
    return new THREE.EdgesGeometry(newGeom);
  }, [geometry]);

  useEffect(() => {
    const controls = transformRef.current;
    if (!controls) return;
    
    const handleObjectChange = () => {
      const mesh = meshRef.current;
      if (!mesh) return;
      const { position, rotation, scale } = mesh;
      useAppStore.getState().updateShape(shape.id, {
        position: position.toArray() as [number, number, number],
        rotation: rotation.toArray().slice(0, 3) as [number, number, number],
        scale: scale.toArray() as [number, number, number],
      });
      if (isSelected) {
        setSelectedObjectPosition(position.toArray() as [number, number, number]);
      }
    };

    controls.addEventListener('objectChange', handleObjectChange);
    return () => controls.removeEventListener('objectChange', handleObjectChange);
  }, [shape.id, isSelected, setSelectedObjectPosition]);

  // HATA DÜZELTMESİ: Geometri hazır olana kadar hiçbir şey render etme.
  if (!geometry || !edgesGeometry) {
    return null;
  }

  const handleClick = (e: any) => {
    if (e.nativeEvent.button === 0) {
      e.stopPropagation();
      useAppStore.getState().selectShape(shape.id);
    }
  };

  const handleContextMenu = (e: any) => {
    if (isSelected && onContextMenuRequest) {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      onContextMenuRequest(e, shape);
    }
  };
  
  const getShapeColor = () => {
    if (isBeingEdited) return '#ff6b35';
    if (isSelected) return '#60a5fa';
    if (isEditMode && !isBeingEdited) return '#6b7280';
    return SHAPE_COLORS[shape.type as keyof typeof SHAPE_COLORS] || '#94a3b8';
  };

  return (
    <group>
      <mesh
        ref={meshRef}
        geometry={geometry}
        position={shape.position}
        rotation={shape.rotation}
        scale={shape.scale}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        castShadow
        receiveShadow
        visible={viewMode === ViewMode.SOLID}
      >
        <meshPhysicalMaterial 
          color={getShapeColor()}
          transparent={true}
          opacity={0.9} // Görünürlüğü artır
          side={THREE.DoubleSide}
        />
      </mesh>

      <lineSegments
        geometry={edgesGeometry}
        position={shape.position}
        rotation={shape.rotation}
        scale={shape.scale}
        visible={true}
      >
        <lineBasicMaterial
          color={viewMode === ViewMode.SOLID ? '#000000' : getShapeColor()}
        />
      </lineSegments>

      {isSelected && meshRef.current && !isEditMode && !isFaceEditMode && (
          <TransformControls
            ref={transformRef}
            object={meshRef.current}
            mode={
              activeTool === 'Move' ? 'translate' :
              activeTool === 'Rotate' ? 'rotate' :
              'scale'
            }
          />
        )}
    </group>
  );
};

export default OpenCascadeShape;
