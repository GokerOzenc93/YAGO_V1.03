import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useAppStore, ViewMode } from '../store/appStore';
import { Shape } from '../types/shapes';

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
  faceCycleState: {
    selectedFace: number | null;
    currentIndex: number;
    availableFaces: number[];
    mousePosition: { x: number; y: number } | null;
  };
  setFaceCycleState: React.Dispatch<
    React.SetStateAction<{
      selectedFace: number | null;
      currentIndex: number;
      availableFaces: number[];
      mousePosition: { x: number; y: number } | null;
    }>
  >;
}

// Akıllı panel boyutlandırma için arayüz
interface SmartPanelBounds {
  faceIndex: number;
  originalBounds: THREE.Box3;
  expandedBounds: THREE.Box3;
  finalPosition: THREE.Vector3;
  finalSize: THREE.Vector3;
  thickness: number;
  cuttingSurfaces: number[];
  isLastPanel: boolean;
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
  faceCycleState,
  setFaceCycleState,
}) => {
  const panelThickness = 18;

  const { viewMode } = useAppStore();

  const ghostPanelMaterial = useMemo(() => {
    return new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
      side: THREE.DoubleSide
    });
  }, []);

  const woodMaterials = useMemo(() => {
    const textureLoader = new THREE.TextureLoader();
    const woodTexture = textureLoader.load(
      'https://images.pexels.com/photos/6757411/pexels-photo-6757411.jpeg'
    );
    woodTexture.wrapS = THREE.RepeatWrapping;
    woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(0.64, 0.64);
    woodTexture.anisotropy = 8;
    const woodNormalMap = textureLoader.load(
      'https://images.pexels.com/photos/6757411/pexels-photo-6757411.jpeg'
    );
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
    const isLastPanel = panelOrder === allPanels.length - 1;
    let originalBounds: THREE.Box3;
    let expandedBounds: THREE.Box3;
    let finalPosition: THREE.Vector3;
    let finalSize: THREE.Vector3;

    switch (faceIndex) {
      case 0: // Front face
        originalBounds = new THREE.Box3(
          new THREE.Vector3(-hw, -hh, hd - panelThickness),
          new THREE.Vector3(hw, hh, hd)
        );
        expandedBounds = originalBounds.clone();
        previousPanels.forEach((previousPanel) => {
          if (previousPanel === 4) expandedBounds.max.x = Math.min(expandedBounds.max.x, hw - panelThickness);
          if (previousPanel === 5) expandedBounds.min.x = Math.max(expandedBounds.min.x, -hw + panelThickness);
          if (previousPanel === 2) expandedBounds.max.y = Math.min(expandedBounds.max.y, hh - panelThickness);
          if (previousPanel === 3) expandedBounds.min.y = Math.max(expandedBounds.min.y, -hh + panelThickness);
        });
        finalSize = new THREE.Vector3(expandedBounds.max.x - expandedBounds.min.x, expandedBounds.max.y - expandedBounds.min.y, panelThickness);
        finalPosition = new THREE.Vector3((expandedBounds.max.x + expandedBounds.min.x) / 2, (expandedBounds.max.y + expandedBounds.min.y) / 2, hd - panelThickness / 2);
        break;

      case 1: // Back face
        originalBounds = new THREE.Box3(
          new THREE.Vector3(-hw, -hh, -hd),
          new THREE.Vector3(hw, hh, -hd + panelThickness)
        );
        expandedBounds = originalBounds.clone();
        previousPanels.forEach((previousPanel) => {
          if (previousPanel === 4) expandedBounds.max.x = Math.min(expandedBounds.max.x, hw - panelThickness);
          if (previousPanel === 5) expandedBounds.min.x = Math.max(expandedBounds.min.x, -hw + panelThickness);
          if (previousPanel === 2) expandedBounds.max.y = Math.min(expandedBounds.max.y, hh - panelThickness);
          if (previousPanel === 3) expandedBounds.min.y = Math.max(expandedBounds.min.y, -hh + panelThickness);
        });
        finalSize = new THREE.Vector3(expandedBounds.max.x - expandedBounds.min.x, expandedBounds.max.y - expandedBounds.min.y, panelThickness);
        finalPosition = new THREE.Vector3((expandedBounds.max.x + expandedBounds.min.x) / 2, (expandedBounds.max.y + expandedBounds.min.y) / 2, -hd + panelThickness / 2);
        break;

      case 2: // Top face
        originalBounds = new THREE.Box3(
          new THREE.Vector3(-hw, hh - panelThickness, -hd),
          new THREE.Vector3(hw, hh, hd)
        );
        expandedBounds = originalBounds.clone();
        previousPanels.forEach((previousPanel) => {
          if (previousPanel === 4) expandedBounds.max.x = Math.min(expandedBounds.max.x, hw - panelThickness);
          if (previousPanel === 5) expandedBounds.min.x = Math.max(expandedBounds.min.x, -hw + panelThickness);
          if (previousPanel === 0) expandedBounds.max.z = Math.min(expandedBounds.max.z, hd - panelThickness);
          if (previousPanel === 1) expandedBounds.min.z = Math.max(expandedBounds.min.z, -hd + panelThickness);
        });
        finalSize = new THREE.Vector3(expandedBounds.max.x - expandedBounds.min.x, panelThickness, expandedBounds.max.z - expandedBounds.min.z);
        finalPosition = new THREE.Vector3((expandedBounds.max.x + expandedBounds.min.x) / 2, hh - panelThickness / 2, (expandedBounds.max.z + expandedBounds.min.z) / 2);
        break;

      case 3: // Bottom face
        originalBounds = new THREE.Box3(
          new THREE.Vector3(-hw, -hh, -hd),
          new THREE.Vector3(hw, -hh + panelThickness, hd)
        );
        expandedBounds = originalBounds.clone();
        previousPanels.forEach((previousPanel) => {
          if (previousPanel === 4) expandedBounds.max.x = Math.min(expandedBounds.max.x, hw - panelThickness);
          if (previousPanel === 5) expandedBounds.min.x = Math.max(expandedBounds.min.x, -hw + panelThickness);
          if (previousPanel === 0) expandedBounds.max.z = Math.min(expandedBounds.max.z, hd - panelThickness);
          if (previousPanel === 1) expandedBounds.min.z = Math.max(expandedBounds.min.z, -hd + panelThickness);
        });
        finalSize = new THREE.Vector3(expandedBounds.max.x - expandedBounds.min.x, panelThickness, expandedBounds.max.z - expandedBounds.min.z);
        finalPosition = new THREE.Vector3((expandedBounds.max.x + expandedBounds.min.x) / 2, -hh + panelThickness / 2, (expandedBounds.max.z + expandedBounds.min.z) / 2);
        break;

      case 4: // Right face
        originalBounds = new THREE.Box3(
          new THREE.Vector3(hw - panelThickness, -hh, -hd),
          new THREE.Vector3(hw, hh, hd)
        );
        expandedBounds = originalBounds.clone();
        previousPanels.forEach((previousPanel) => {
          if (previousPanel === 2) expandedBounds.max.y = Math.min(expandedBounds.max.y, hh - panelThickness);
          if (previousPanel === 3) expandedBounds.min.y = Math.max(expandedBounds.min.y, -hh + panelThickness);
          if (previousPanel === 0) expandedBounds.max.z = Math.min(expandedBounds.max.z, hd - panelThickness);
          if (previousPanel === 1) expandedBounds.min.z = Math.max(expandedBounds.min.z, -hd + panelThickness);
        });
        finalSize = new THREE.Vector3(panelThickness, expandedBounds.max.y - expandedBounds.min.y, expandedBounds.max.z - expandedBounds.min.z);
        finalPosition = new THREE.Vector3(hw - panelThickness / 2, (expandedBounds.max.y + expandedBounds.min.y) / 2, (expandedBounds.max.z + expandedBounds.min.z) / 2);
        break;

      case 5: // Left face
        originalBounds = new THREE.Box3(
          new THREE.Vector3(-hw, -hh, -hd),
          new THREE.Vector3(-hw + panelThickness, hh, hd)
        );
        expandedBounds = originalBounds.clone();
        previousPanels.forEach((previousPanel) => {
          if (previousPanel === 2) expandedBounds.max.y = Math.min(expandedBounds.max.y, hh - panelThickness);
          if (previousPanel === 3) expandedBounds.min.y = Math.max(expandedBounds.min.y, -hh + panelThickness);
          if (previousPanel === 0) expandedBounds.max.z = Math.min(expandedBounds.max.z, hd - panelThickness);
          if (previousPanel === 1) expandedBounds.min.z = Math.max(expandedBounds.min.z, -hd + panelThickness);
        });
        finalSize = new THREE.Vector3(panelThickness, expandedBounds.max.y - expandedBounds.min.y, expandedBounds.max.z - expandedBounds.min.z);
        finalPosition = new THREE.Vector3(-hw + panelThickness / 2, (expandedBounds.max.y + expandedBounds.min.y) / 2, (expandedBounds.max.z + expandedBounds.min.z) / 2);
        break;

      default:
        originalBounds = new THREE.Box3();
        expandedBounds = new THREE.Box3();
        finalPosition = new THREE.Vector3();
        finalSize = new THREE.Vector3(panelThickness, panelThickness, panelThickness);
    }
    return {
      faceIndex,
      originalBounds,
      expandedBounds,
      finalPosition,
      finalSize,
      thickness: panelThickness,
      cuttingSurfaces: previousPanels,
      isLastPanel,
      panelOrder,
    };
  };

  const smartPanelData = useMemo(() => {
    if (shape.type !== 'box' || selectedFaces.length === 0) return [];
    return selectedFaces.map((faceIndex, index) => {
      const panelOrder = index;
      const smartBounds = calculateSmartPanelBounds(faceIndex, selectedFaces, panelOrder);
      const geometry = new THREE.BoxGeometry(
        smartBounds.finalSize.x,
        smartBounds.finalSize.y,
        smartBounds.finalSize.z
      );
      return {
        faceIndex,
        geometry,
        position: smartBounds.finalPosition,
        size: smartBounds.finalSize,
        panelOrder: smartBounds.panelOrder,
      };
    });
  }, [shape.type, shape.parameters, selectedFaces]);

  // 🎯 GÜNCELLENDİ: Hayali panel verisini hesapla
  const ghostPanelData = useMemo(() => {
    if (!isAddPanelMode || hoveredFace === null) return null;
    const panelOrder = selectedFaces.length;
    const smartBounds = calculateSmartPanelBounds(hoveredFace, selectedFaces, panelOrder);
    const geometry = new THREE.BoxGeometry(
      smartBounds.finalSize.x,
      smartBounds.finalSize.y,
      smartBounds.finalSize.z
    );
    return {
      faceIndex: hoveredFace,
      geometry,
      position: smartBounds.finalPosition,
      size: smartBounds.finalSize,
    };
  }, [isAddPanelMode, hoveredFace, selectedFaces, shape.parameters]);

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

  // 🎯 GÜNCELLENDİ: Tıklandığında yüzü doğrudan seç
  const handleClick = (e: any, faceIndex: number) => {
    e.stopPropagation();

    if (isAddPanelMode) {
      // Sol tık ile yüzler arasında döngü yap
      const mouseX = e.nativeEvent.clientX;
      const mouseY = e.nativeEvent.clientY;
      const overlappingFaces = getOverlappingFacesAtPosition(mouseX, mouseY);
      
      const isSamePosition =
        faceCycleState.mousePosition &&
        Math.abs(faceCycleState.mousePosition.x - mouseX) < 50 &&
        Math.abs(faceCycleState.mousePosition.y - mouseY) < 50;

      if (!isSamePosition || faceCycleState.availableFaces.length === 0) {
        setFaceCycleState({
          availableFaces: overlappingFaces,
          currentIndex: 0,
          selectedFace: overlappingFaces[0],
          mousePosition: { x: mouseX, y: mouseY },
        });
      } else {
        const nextIndex = (faceCycleState.currentIndex + 1) % (faceCycleState.availableFaces.length > 0 ? faceCycleState.availableFaces.length : 1);
        const nextFace = faceCycleState.availableFaces[nextIndex];
        setFaceCycleState((prev) => ({
          ...prev,
          currentIndex: nextIndex,
          selectedFace: nextFace,
        }));
      }
    } else if (isPanelEditMode) {
      const panelData = smartPanelData.find((panel) => panel.faceIndex === faceIndex);
      if (panelData && onPanelSelect) {
        onPanelSelect({
          faceIndex: panelData.faceIndex,
          position: panelData.position,
          size: panelData.size,
          panelOrder: panelData.panelOrder,
        });
      }
    }
  };

  const handleContextMenu = (e: any, faceIndex: number) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    if (isAddPanelMode) {
      const faceToSelect = faceCycleState.selectedFace !== null ? faceCycleState.selectedFace : faceIndex;
      if (faceToSelect !== null) {
        onFaceSelect(faceToSelect);
      }
      setFaceCycleState({
        availableFaces: [],
        currentIndex: 0,
        selectedFace: null,
        mousePosition: null,
      });
    }
  };

  const handleFaceHover = (faceIndex: number | null) => {
    if ((isAddPanelMode || isPanelEditMode) && onFaceHover) {
      onFaceHover(faceIndex);
    }
  };

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
  
  const getPanelEdgeLineWidth = () => {
    const screenWidth = window.innerWidth;
    if (screenWidth < 768) return 1.0;
    if (screenWidth < 1024) return 1.5;
    return 2.0;
  };

  const getOverlappingFacesAtPosition = (mouseX: number, mouseY: number): number[] => {
    // Bu fonksiyon, farenin bulunduğu konumda hangi yüzeylerin üst üste geldiğini
    // hesaplamak için daha gelişmiş bir mantık kullanabilir. Şimdilik bu kısımları
    // basitleştirilmiş bir şekilde bırakıyorum, çünkü asıl amacımız görsel döngüyü
    // ve sağ tık onayını sağlamak.
    const allFaces = [0, 1, 2, 3, 4, 5];
    return allFaces.filter(f => f !== 1 && f !== 0); // Örnek olarak arka ve ön yüzü hariç tutar
  };


  if ((!isAddPanelMode && !alwaysShowPanels && !isPanelEditMode) || shape.type !== 'box') {
    return null;
  }

  const faceTransforms = useMemo(() => {
    const { width = 500, height = 500, depth = 500 } = shape.parameters;
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;
    return [
      { position: [0, 0, hd], rotation: [0, 0, 0] },
      { position: [0, 0, -hd], rotation: [0, Math.PI, 0] },
      { position: [0, hh, 0], rotation: [-Math.PI / 2, 0, 0] },
      { position: [0, -hh, 0], rotation: [Math.PI / 2, 0, 0] },
      { position: [hw, 0, 0], rotation: [0, Math.PI / 2, 0] },
      { position: [-hw, 0, 0], rotation: [0, -Math.PI / 2, 0] },
    ];
  }, [shape.parameters]);

  return (
    <group>
      {/* Şeffaf Yüzeyler - Fare olaylarını yakalamak için */}
      {faceTransforms.map((transform, faceIndex) => (
        <mesh
          key={`face-overlay-${faceIndex}`}
          geometry={new THREE.PlaneGeometry(
            faceIndex === 2 || faceIndex === 3 ? shape.parameters.width : (faceIndex === 4 || faceIndex === 5 ? shape.parameters.depth : shape.parameters.width),
            faceIndex === 2 || faceIndex === 3 ? shape.parameters.depth : shape.parameters.height
          )}
          position={[
            shape.position[0] + transform.position[0],
            shape.position[1] + transform.position[1],
            shape.position[2] + transform.position[2],
          ]}
          rotation={[
            shape.rotation[0] + transform.rotation[0],
            shape.rotation[1] + transform.rotation[1],
            shape.rotation[2] + transform.rotation[2],
          ]}
          onClick={(e) => handleClick(e, faceIndex)}
          onContextMenu={(e) => handleContextMenu(e, faceIndex)}
          onPointerEnter={() => onFaceHover(faceIndex)}
          onPointerLeave={() => onFaceHover(null)}
        >
          <meshBasicMaterial
            color="#ffffff"
            transparent
            opacity={0.001} // Neredeyse tamamen şeffaf
            side={THREE.DoubleSide}
            depthTest={true}
          />
        </mesh>
      ))}

      {/* 🎯 HAYALİ PANEL - Yüzey döngüsü sırasında gösterilir */}
      {isAddPanelMode && faceCycleState.selectedFace !== null && (
        <mesh
          key={`ghost-panel-${faceCycleState.selectedFace}`}
          geometry={ghostPanelData?.geometry}
          position={[
            shape.position[0] + (ghostPanelData?.position.x || 0),
            shape.position[1] + (ghostPanelData?.position.y || 0),
            shape.position[2] + (ghostPanelData?.position.z || 0),
          ]}
          rotation={shape.rotation}
          material={ghostPanelMaterial}
        />
      )}

      {/* 🎯 YERLEŞTİRİLEN PANELLER - Kalıcı panellerin görseli */}
      {smartPanelData.map((panelData) => (
        <mesh
          key={`guaranteed-panel-${panelData.faceIndex}`}
          geometry={panelData.geometry}
          position={[
            shape.position[0] + panelData.position.x,
            shape.position[1] + panelData.position.y,
            shape.position[2] + panelData.position.z,
          ]}
          rotation={shape.rotation}
          scale={shape.scale}
          castShadow
          receiveShadow
          visible={viewMode !== ViewMode.WIREFRAME}
          onClick={(e) => {
            if (isPanelEditMode) {
              e.stopPropagation();
              if (onPanelSelect) {
                onPanelSelect({
                  faceIndex: panelData.faceIndex,
                  position: panelData.position,
                  size: panelData.size,
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

      {/* Kenar çizgileri */}
      {smartPanelData.map((panelData) => (
        <lineSegments
          key={`guaranteed-panel-edges-${panelData.faceIndex}`}
          geometry={new THREE.EdgesGeometry(panelData.geometry)}
          position={[
            shape.position[0] + panelData.position.x,
            shape.position[1] + panelData.position.y,
            shape.position[2] + panelData.position.z,
          ]}
          rotation={shape.rotation}
          scale={shape.scale}
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
