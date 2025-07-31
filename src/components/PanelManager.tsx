import React, { useMemo, useCallback, useRef, useState } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { ViewMode, useAppStore } from '../store/appStore';

interface PanelManagerProps {
  shape: Shape;
  isAddPanelMode: boolean;
  selectedFaces: number[];
  onPanelAdd: (faceIndex: number) => void;
  isPanelEditMode?: boolean;
  onPanelSelect?: (panelData: {
    faceIndex: number;
    position: THREE.Vector3;
    size: THREE.Vector3;
    panelOrder: number;
  }) => void;
}

interface SmartPanelBounds {
  faceIndex: number;
  finalPosition: THREE.Vector3;
  finalSize: THREE.Vector3;
  panelOrder: number;
}

const PanelManager: React.FC<PanelManagerProps> = ({
  shape,
  isAddPanelMode,
  onPanelAdd,
  selectedFaces,
  isPanelEditMode = false,
  onPanelSelect,
}) => {
  const panelThickness = 18;
  const { camera, raycaster, gl } = useThree();
  const { viewMode } = useAppStore();
  const boxMeshRef = useRef<THREE.Mesh>(null);
  const [hoveredFaceFromMouse, setHoveredFaceFromMouse] = useState<number | null>(null);

  const woodMaterials = useMemo(() => {
    const textureLoader = new THREE.TextureLoader();
    const woodTexture = textureLoader.load('https://images.pexels.com/photos/6757411/pexels-photo-6757411.jpeg');
    woodTexture.wrapS = THREE.RepeatWrapping;
    woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(0.64, 0.64);
    woodTexture.anisotropy = 8;
    const woodNormalMap = textureLoader.load('https://images.pexels.com/photos/6757411/pexels-photo-6757411.jpeg');
    woodNormalMap.wrapS = THREE.RepeatWrapping;
    woodNormalMap.wrapT = THREE.RepeatWrapping;
    woodNormalMap.repeat.set(0.6, 0.6);
    woodNormalMap.anisotropy = 108;
    const baseMaterialProps = {
      metalness: 0.02,
      roughness: 1.1,
      clearcoat: 0.4,
      clearcoatRoughness: 0.1,
      reflectivity: 0.1,
      envMapIntensity: 0.4,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0.0,
      side: THREE.DoubleSide,
      map: woodTexture,
      normalMap: woodNormalMap,
      normalScale: new THREE.Vector2(0.4, 0.4),
      color: new THREE.Color(0xf3f6f4),
      transparent: false,
      opacity: 1.0,
      alphaTest: 0,
      depthWrite: true,
      depthTest: true,
      premultipliedAlpha: false,
      vertexColors: false,
      fog: true,
      flatShading: false,
      iridescence: 0.0,
      iridescenceIOR: 1.0,
      sheen: 0.1,
      sheenRoughness: 0.9,
      sheenColor: new THREE.Color(0xffffff),
      specularIntensity: 0.3,
      specularColor: new THREE.Color(0xffffff),
      transmission: 0.0,
      thickness: 0.0,
      attenuationDistance: Infinity,
      attenuationColor: new THREE.Color(0xffffff),
      ior: 1.2,
    };
    const verticalMaterial = new THREE.MeshPhysicalMaterial(baseMaterialProps);
    const horizontalMaterial = new THREE.MeshPhysicalMaterial({
      ...baseMaterialProps,
      map: woodTexture.clone(),
      normalMap: woodNormalMap.clone(),
    });
    horizontalMaterial.map!.rotation = Math.PI / 2;
    horizontalMaterial.normalMap!.rotation = Math.PI / 2;
    return { vertical: verticalMaterial, horizontal: horizontalMaterial };
  }, []);

  const faceTransforms = useMemo(() => {
    const { width = 500, height = 500, depth = 500 } = shape.parameters;
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;
    return [
      { position: new THREE.Vector3(0, 0, hd), rotation: new THREE.Euler(0, 0, 0), normal: new THREE.Vector3(0, 0, 1) },
      { position: new THREE.Vector3(0, 0, -hd), rotation: new THREE.Euler(0, Math.PI, 0), normal: new THREE.Vector3(0, 0, -1) },
      { position: new THREE.Vector3(0, hh, 0), rotation: new THREE.Euler(-Math.PI / 2, 0, 0), normal: new THREE.Vector3(0, 1, 0) },
      { position: new THREE.Vector3(0, -hh, 0), rotation: new THREE.Euler(Math.PI / 2, 0, 0), normal: new THREE.Vector3(0, -1, 0) },
      { position: new THREE.Vector3(hw, 0, 0), rotation: new THREE.Euler(0, Math.PI / 2, 0), normal: new THREE.Vector3(1, 0, 0) },
      { position: new THREE.Vector3(-hw, 0, 0), rotation: new THREE.Euler(0, -Math.PI / 2, 0), normal: new THREE.Vector3(-1, 0, 0) },
    ];
  }, [shape.parameters]);

  const calculateSmartPanelBounds = (
    faceIndex: number,
    allPanels: number[],
    panelOrder: number
  ): SmartPanelBounds => {
    const { width = 500, height = 500, depth = 500 } = shape.parameters;
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;
    const previousPanels = allPanels.slice(0, panelOrder);
    const bounds = new THREE.Box3(
      new THREE.Vector3(-hw, -hh, -hd),
      new THREE.Vector3(hw, hh, hd)
    );
    const expandedBounds = bounds.clone();

    previousPanels.forEach((previousPanelIndex) => {
      switch (previousPanelIndex) {
        case 0: expandedBounds.max.z -= panelThickness; break;
        case 1: expandedBounds.min.z += panelThickness; break;
        case 2: expandedBounds.max.y -= panelThickness; break;
        case 3: expandedBounds.min.y += panelThickness; break;
        case 4: expandedBounds.max.x -= panelThickness; break;
        case 5: expandedBounds.min.x += panelThickness; break;
      }
    });

    let finalSize;
    let finalPosition;
    
    switch (faceIndex) {
      case 0: case 1:
        finalSize = new THREE.Vector3(expandedBounds.max.x - expandedBounds.min.x, expandedBounds.max.y - expandedBounds.min.y, panelThickness);
        finalPosition = new THREE.Vector3((expandedBounds.max.x + expandedBounds.min.x) / 2, (expandedBounds.max.y + expandedBounds.min.y) / 2, faceTransforms[faceIndex].position.z);
        break;
      case 2: case 3:
        finalSize = new THREE.Vector3(expandedBounds.max.x - expandedBounds.min.x, panelThickness, expandedBounds.max.z - expandedBounds.min.z);
        finalPosition = new THREE.Vector3((expandedBounds.max.x + expandedBounds.min.x) / 2, faceTransforms[faceIndex].position.y, (expandedBounds.max.z + expandedBounds.min.z) / 2);
        break;
      case 4: case 5:
        finalSize = new THREE.Vector3(panelThickness, expandedBounds.max.y - expandedBounds.min.y, expandedBounds.max.z - expandedBounds.min.z);
        finalPosition = new THREE.Vector3(faceTransforms[faceIndex].position.x, (expandedBounds.max.y + expandedBounds.min.y) / 2, (expandedBounds.max.z + expandedBounds.min.z) / 2);
        break;
      default:
        finalSize = new THREE.Vector3(100, 100, 10);
        finalPosition = new THREE.Vector3(0, 0, 0);
        break;
    }

    return {
      faceIndex,
      finalPosition,
      finalSize,
      panelOrder,
    };
  };

  const smartPanelData = useMemo(() => {
    if (shape.type !== 'box' || selectedFaces.length === 0) return [];
    return selectedFaces.map((faceIndex, index) =>
      calculateSmartPanelBounds(faceIndex, selectedFaces, index)
    );
  }, [shape.type, shape.parameters, selectedFaces]);

  const getPanelMaterial = (faceIndex: number) => {
    if (faceIndex === 2 || faceIndex === 3) return woodMaterials.horizontal;
    return woodMaterials.vertical;
  };

  const getPanelEdgeColor = () => {
    switch (viewMode) {
      case ViewMode.WIREFRAME: return '#ffffff';
      case ViewMode.TRANSPARENT: return '#000000';
      case ViewMode.SOLID: return '#2a2a2a';
      default: return '#2a2a2a';
    }
  };

  const getPanelEdgeLineWidth = () => {
    const screenWidth = window.innerWidth;
    if (screenWidth < 768) return 1.0;
    if (screenWidth < 1024) return 1.5;
    return 2.0;
  };
  
  const ghostPanelMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fbbf24',
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthTest: false,
  }), []);

  const handleClick = useCallback((e: any, faceIndex: number) => {
    e.stopPropagation();
    if (isAddPanelMode && e.nativeEvent.button === 0) {
      onPanelAdd(faceIndex);
    } else if (isPanelEditMode) {
      const panelData = smartPanelData.find(
        (panel) => panel.faceIndex === faceIndex
      );
      if (panelData && onPanelSelect) {
        onPanelSelect({
          faceIndex: panelData.faceIndex,
          position: panelData.finalPosition,
          size: panelData.finalSize,
          panelOrder: panelData.panelOrder,
        });
      }
    }
  }, [isAddPanelMode, onPanelAdd, isPanelEditMode, onPanelSelect, smartPanelData]);

  const handleContextMenu = useCallback((e: any, faceIndex: number) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    if (isAddPanelMode) {
      onPanelAdd(faceIndex);
    }
  }, [isAddPanelMode, onPanelAdd]);
  
  const handleFaceHover = useCallback((faceIndex: number | null) => {
    if (isAddPanelMode) {
      setHoveredFaceFromMouse(faceIndex);
    }
  }, [isAddPanelMode]);

  const getFaceColor = (faceIndex: number) => {
    if (selectedFaces.includes(faceIndex)) return '#10b981';
    if (hoveredFaceFromMouse === faceIndex) return '#fbbf24';
    return '#3b82f6';
  };

  const getFaceOpacity = (faceIndex: number) => {
    if (isAddPanelMode && hoveredFaceFromMouse === faceIndex) return 0.5;
    if (selectedFaces.includes(faceIndex)) return 0.0;
    return 0.001;
  };

  if ((!isAddPanelMode && !isPanelEditMode && selectedFaces.length === 0) || shape.type !== 'box') {
    return null;
  }

  return (
    <group>
      {faceTransforms.map((transform, faceIndex) => (
        <mesh
          key={`face-overlay-${faceIndex}`}
          geometry={new THREE.PlaneGeometry(
            faceIndex === 2 || faceIndex === 3 ? shape.parameters.width : (faceIndex === 4 || faceIndex === 5 ? shape.parameters.depth : shape.parameters.width),
            faceIndex === 2 || faceIndex === 3 ? shape.parameters.depth : shape.parameters.height
          )}
          position={[
            shape.position[0] + transform.position.x,
            shape.position[1] + transform.position.y,
            shape.position[2] + transform.position.z,
          ]}
          rotation={transform.rotation}
          onClick={(e) => handleClick(e, faceIndex)}
          onContextMenu={(e) => handleContextMenu(e, faceIndex)}
          onPointerEnter={() => handleFaceHover(faceIndex)}
          onPointerLeave={() => handleFaceHover(null)}
        >
          <meshBasicMaterial
            color={getFaceColor(faceIndex)}
            transparent
            opacity={getFaceOpacity(faceIndex)}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>
      ))}
      
      {isAddPanelMode && hoveredFaceFromMouse !== null && (
        <mesh
          key={`ghost-panel-${hoveredFaceFromMouse}`}
          geometry={new THREE.BoxGeometry(
            hoveredFaceFromMouse === 2 || hoveredFaceFromMouse === 3 ? shape.parameters.width : (hoveredFaceFromMouse === 4 || hoveredFaceFromMouse === 5 ? shape.parameters.depth : shape.parameters.width),
            hoveredFaceFromMouse === 2 || hoveredFaceFromMouse === 3 ? shape.parameters.depth : shape.parameters.height,
            panelThickness
          )}
          position={[
            shape.position[0] + faceTransforms[hoveredFaceFromMouse].position.x,
            shape.position[1] + faceTransforms[hoveredFaceFromMouse].position.y,
            shape.position[2] + faceTransforms[hoveredFaceFromMouse].position.z,
          ]}
          rotation={faceTransforms[hoveredFaceFromMouse].rotation}
          material={ghostPanelMaterial}
        />
      )}

      {smartPanelData.map((panelData) => (
        <mesh
          key={`guaranteed-panel-${panelData.faceIndex}`}
          geometry={new THREE.BoxGeometry(
            panelData.finalSize.x,
            panelData.finalSize.y,
            panelData.finalSize.z
          )}
          position={[
            shape.position[0] + panelData.finalPosition.x,
            shape.position[1] + panelData.finalPosition.y,
            shape.position[2] + panelData.finalPosition.z,
          ]}
          rotation={faceTransforms[panelData.faceIndex].rotation}
          castShadow
          receiveShadow
          visible={viewMode !== ViewMode.WIREFRAME}
          onClick={(e) => {
            if (isPanelEditMode) {
              e.stopPropagation();
              if (onPanelSelect) {
                onPanelSelect({
                  faceIndex: panelData.faceIndex,
                  position: panelData.finalPosition,
                  size: panelData.finalSize,
                  panelOrder: panelData.panelOrder,
                });
              }
            }
          }}
        >
          {isPanelEditMode ? (
            <meshPhysicalMaterial
              color="#dc2626"
              roughness={0.6}
              metalness={0.02}
              transparent={viewMode === ViewMode.TRANSPARENT}
              opacity={viewMode === ViewMode.TRANSPARENT ? 0.3 : 1.0}
              depthWrite={viewMode === ViewMode.SOLID}
            />
          ) : (
            <meshPhysicalMaterial
              {...getPanelMaterial(panelData.faceIndex).parameters}
              transparent={viewMode === ViewMode.TRANSPARENT}
              opacity={viewMode === ViewMode.TRANSPARENT ? 0.3 : 1.0}
              depthWrite={viewMode === ViewMode.SOLID}
            />
          )}
        </mesh>
      ))}

      {smartPanelData.map((panelData) => (
        <lineSegments
          key={`guaranteed-panel-edges-${panelData.faceIndex}`}
          geometry={new THREE.EdgesGeometry(new THREE.BoxGeometry(
            panelData.finalSize.x,
            panelData.finalSize.y,
            panelData.finalSize.z
          ))}
          position={[
            shape.position[0] + panelData.finalPosition.x,
            shape.position[1] + panelData.finalPosition.y,
            shape.position[2] + panelData.finalPosition.z,
          ]}
          rotation={faceTransforms[panelData.faceIndex].rotation}
          visible={
            viewMode === ViewMode.WIREFRAME ||
            isPanelEditMode ||
            selectedFaces.includes(panelData.faceIndex)
          }
        >
          <lineBasicMaterial
            color={isPanelEditMode ? '#7f1d1d' : getPanelEdgeColor()}
            linewidth={getPanelEdgeLineWidth()}
            transparent={
              viewMode === ViewMode.TRANSPARENT || viewMode === ViewMode.WIREFRAME
            }
            opacity={viewMode === ViewMode.TRANSPARENT ? 0.5 : 1.0}
            depthTest={viewMode === ViewMode.SOLID}
          />
        </lineSegments>
      ))}
    </group>
  );
};

export default PanelManager;
