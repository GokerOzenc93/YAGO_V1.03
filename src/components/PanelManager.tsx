import React, { useMemo, useCallback } from 'react';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { ViewMode, useAppStore } from '../store/appStore';

interface PanelManagerProps {
  shape: Shape;
  isAddPanelMode: boolean;
  selectedFaces: number[];
  hoveredFace: number | null;
  showEdges: boolean;
  showFaces: boolean;
  onFaceSelect: (faceIndex: number) => void;
  onFaceHover: (faceIndex: number | null) => void;
  alwaysShowPanels?: boolean;
  isPanelEditMode?: boolean;
  onPanelSelect?: (panelData: {
    faceIndex: number;
    position: THREE.Vector3;
    size: THREE.Vector3;
    panelOrder: number;
  }) => void;
  // Yeni state'ler, yüzey döngüsü yerine sıralı merkez noktalarını tutar
  selectedFaceCenters: THREE.Vector3[];
  setSelectedFaceCenters: React.Dispatch<React.SetStateAction<THREE.Vector3[]>>;
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
  selectedFaces,
  hoveredFace,
  showEdges,
  showFaces,
  onFaceSelect,
  onFaceHover,
  alwaysShowPanels = false,
  isPanelEditMode = false,
  onPanelSelect,
  selectedFaceCenters,
  setSelectedFaceCenters,
}) => {
  const panelThickness = 18;
  const { camera, raycaster, gl } = useThree();
  const { viewMode } = useAppStore();

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
    const positionOffset = faceTransforms[faceIndex].normal.clone().multiplyScalar(panelThickness / 2);

    switch (faceIndex) {
      case 0: // Front
      case 1: // Back
        finalSize = new THREE.Vector3(
          expandedBounds.max.x - expandedBounds.min.x,
          expandedBounds.max.y - expandedBounds.min.y,
          panelThickness
        );
        finalPosition = new THREE.Vector3(0, 0, faceTransforms[faceIndex].position.z).add(positionOffset);
        break;
      case 2: // Top
      case 3: // Bottom
        finalSize = new THREE.Vector3(
          expandedBounds.max.x - expandedBounds.min.x,
          panelThickness,
          expandedBounds.max.z - expandedBounds.min.z
        );
        finalPosition = new THREE.Vector3(0, faceTransforms[faceIndex].position.y, 0).add(positionOffset);
        break;
      case 4: // Right
      case 5: // Left
        finalSize = new THREE.Vector3(
          panelThickness,
          expandedBounds.max.y - expandedBounds.min.y,
          expandedBounds.max.z - expandedBounds.min.z
        );
        finalPosition = new THREE.Vector3(faceTransforms[faceIndex].position.x, 0, 0).add(positionOffset);
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
  
  // Hayali panel için material
  const ghostPanelMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fbbf24',
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthTest: false,
  }), []);

  const getFaceColor = (faceIndex: number) => {
    if (selectedFaces.includes(faceIndex)) return '#10b981';
    if (hoveredFace === faceIndex) return '#eeeeee';
    return '#3b82f6';
  };

  const getFaceOpacity = (faceIndex: number) => {
    if (isAddPanelMode && hoveredFace === faceIndex) return 0.0;
    if (selectedFaces.includes(faceIndex)) return 0.0;
    return 0.001;
  };

  // Yeni yüzey seçme ve merkez noktasını kaydetme mantığı
  const handleClick = useCallback((e: any, faceIndex: number) => {
    e.stopPropagation();
    if (isAddPanelMode && e.nativeEvent.button === 0) {
      // Tıklanan yüzeyin merkezini al
      const faceCenter = faceTransforms[faceIndex].position;
      // Merkez noktasını listeye ekle
      setSelectedFaceCenters(prevCenters => [...prevCenters, faceCenter]);

      console.log(`Face ${faceIndex} selected. Center: ${faceCenter.toArray()}`);
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
  }, [isAddPanelMode, isPanelEditMode, onPanelSelect, smartPanelData, faceTransforms, setSelectedFaceCenters]);

  const handleContextMenu = useCallback((e: any) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    if (isAddPanelMode && selectedFaceCenters.length > 0) {
      console.log('Panels confirmed.');
      // Burada onFaceSelect'i nasıl tetikleyeceğiniz, projenizin mantığına bağlı.
      // Basitçe tüm seçili yüzeyleri onaylayalım.
      selectedFaces.forEach(onFaceSelect);
      setSelectedFaceCenters([]); // Seçilen yüzeyleri sıfırla
    }
  }, [isAddPanelMode, selectedFaces, onFaceSelect, selectedFaceCenters, setSelectedFaceCenters]);


  const handleFaceHover = useCallback((faceIndex: number | null) => {
    if ((isAddPanelMode || isPanelEditMode) && onFaceHover) {
      onFaceHover(faceIndex);
    }
  }, [isAddPanelMode, isPanelEditMode, onFaceHover]);


  if ((!isAddPanelMode && !alwaysShowPanels && !isPanelEditMode) || shape.type !== 'box') {
    return null;
  }

  // Çizgiyi oluşturmak için useMemo kullan
  const lineGeometry = useMemo(() => {
    if (selectedFaceCenters.length < 2) return null;
    const points = selectedFaceCenters.map(center => center);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    return geometry;
  }, [selectedFaceCenters]);


  return (
    <group>
      {/* Yüzeyleri görselleştirmek için şeffaf mesh'ler */}
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
          onPointerDown={(e) => handleClick(e, faceIndex)}
          onContextMenu={(e) => handleContextMenu(e, faceIndex)}
          onPointerEnter={() => handleFaceHover(faceIndex)}
          onPointerLeave={() => handleFaceHover(null)}
        >
          <meshBasicMaterial
            color={selectedFaces.includes(faceIndex) ? '#fbbf24' : '#ffffff'}
            transparent
            opacity={selectedFaces.includes(faceIndex) ? 0.3 : 0.001}
            side={THREE.DoubleSide}
            depthTest={false}
          />
        </mesh>
      ))}

      {/* Tıklanan yüzeylerin merkezlerini birleştiren çizgi */}
      {lineGeometry && (
        <line>
          <bufferGeometry attach="geometry" {...lineGeometry} />
          <lineBasicMaterial attach="material" color="#ffff00" />
        </line>
      )}

      {/* YERLEŞTİRİLEN PANELLER - Kalıcı panellerin görseli */}
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
