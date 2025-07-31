import React, { useMemo, useCallback, useState } from 'react';
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

  const [faceCycleState, setFaceCycleState] = useState<{
    availableFaces: number[];
    currentIndex: number;
    selectedFace: number | null;
    mousePosition: { x: number; y: number } | null;
    isActive: boolean;
  }>({
    availableFaces: [],
    currentIndex: 0,
    selectedFace: null,
    mousePosition: null,
    isActive: false,
  });

  // 🎯 GEOMETRIK FACE DETECTION - Raycasting ile fare pozisyonundaki face'leri algıla
  const detectFacesAtMousePosition = useCallback((event: any): number[] => {
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera({ x, y }, camera);
    
    // Her face için invisible mesh oluştur ve intersection test et
    const detectedFaces: { faceIndex: number; distance: number }[] = [];
    const { width = 500, height = 500, depth = 500 } = shape.parameters;
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;

    // Face geometrileri ve pozisyonları
    const faceData = [
      { geometry: new THREE.PlaneGeometry(width, height), position: [0, 0, hd], rotation: [0, 0, 0] }, // Front
      { geometry: new THREE.PlaneGeometry(width, height), position: [0, 0, -hd], rotation: [0, Math.PI, 0] }, // Back
      { geometry: new THREE.PlaneGeometry(width, depth), position: [0, hh, 0], rotation: [-Math.PI / 2, 0, 0] }, // Top
      { geometry: new THREE.PlaneGeometry(width, depth), position: [0, -hh, 0], rotation: [Math.PI / 2, 0, 0] }, // Bottom
      { geometry: new THREE.PlaneGeometry(depth, height), position: [hw, 0, 0], rotation: [0, Math.PI / 2, 0] }, // Right
      { geometry: new THREE.PlaneGeometry(depth, height), position: [-hw, 0, 0], rotation: [0, -Math.PI / 2, 0] }, // Left
    ];

    faceData.forEach((face, faceIndex) => {
      const mesh = new THREE.Mesh(face.geometry);
      mesh.position.set(face.position[0], face.position[1], face.position[2]);
      mesh.rotation.set(face.rotation[0], face.rotation[1], face.rotation[2]);
      
      // Shape'in transform'unu uygula
      mesh.position.add(new THREE.Vector3(...shape.position));
      mesh.rotation.x += shape.rotation[0];
      mesh.rotation.y += shape.rotation[1];
      mesh.rotation.z += shape.rotation[2];
      mesh.scale.set(...shape.scale);
      
      mesh.updateMatrixWorld();
      
      const intersects = raycaster.intersectObject(mesh);
      if (intersects.length > 0) {
        detectedFaces.push({
          faceIndex,
          distance: intersects[0].distance
        });
      }
    });

    // Mesafeye göre sırala (en yakından en uzağa)
    detectedFaces.sort((a, b) => a.distance - b.distance);
    const sortedFaces = detectedFaces.map(f => f.faceIndex);
    
    console.log(`🎯 Geometrik algılama: ${sortedFaces.length} face bulundu:`, sortedFaces);
    return sortedFaces;
  }, [camera, raycaster, gl, shape]);
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

  const detectFacesAtMousePosition = useCallback((event: any): number[] => {
    // Basit bir yaklaşım: Tıklanan pozisyona göre hangi face'lerin olabileceğini hesapla
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.setFromCamera({ x, y }, camera);
    
    // Tüm face'leri mesafeye göre sırala
    const allFaces = [0, 1, 2, 3, 4, 5]; // Front, Back, Top, Bottom, Right, Left
    
    console.log(`🎯 All available faces for cycling:`, allFaces);
    return allFaces;
  }, [camera, raycaster, gl]);

  // 🎯 YENİ CLICK HANDLER - Geometrik algılama ile face cycle
  const handleClick = useCallback((e: any, faceIndex: number) => {
    e.stopPropagation();
    if (isAddPanelMode && e.nativeEvent.button === 0) {
      // Geometrik algılama yap
      const detectedFaces = detectFacesAtMousePosition(e.nativeEvent);
      
      if (!faceCycleState.isActive) {
        // İlk tık: Algılanan face'lerle cycle başlat
        if (detectedFaces.length === 0) {
          console.log('🎯 Hiç face algılanmadı');
          return;
        }
        
        setFaceCycleState({
          availableFaces: detectedFaces,
          currentIndex: 0,
          selectedFace: detectedFaces[0],
          mousePosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
          isActive: true,
        });
        console.log(`🎯 Face cycle başladı: Face ${detectedFaces[0]} seçildi (1/${detectedFaces.length})`);
      } else {
        // Sonraki tıklar: Mevcut listede cycle devam et
        const nextIndex = (faceCycleState.currentIndex + 1) % faceCycleState.availableFaces.length;
        setFaceCycleState(prev => ({
          ...prev,
          currentIndex: nextIndex,
          selectedFace: prev.availableFaces[nextIndex],
          mousePosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY },
        }));
        console.log(`🎯 Face değişti: Face ${faceCycleState.availableFaces[nextIndex]} (${nextIndex + 1}/${faceCycleState.availableFaces.length})`);
      }
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
  }, [isAddPanelMode, isPanelEditMode, onPanelSelect, smartPanelData, faceCycleState, detectFacesAtMousePosition]);

  // 🎯 SAĞ TIK HANDLER - Panel yerleştirme
  const handleContextMenu = useCallback((e: any) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    if (isAddPanelMode && faceCycleState.isActive && faceCycleState.selectedFace !== null) {
      // Panel yerleştir
      onFaceSelect(faceCycleState.selectedFace);
      console.log(`🎯 Panel yerleştirildi: Face ${faceCycleState.selectedFace}`);
      
      // Cycle'ı sıfırla
      setFaceCycleState({
        availableFaces: [],
        currentIndex: 0,
        selectedFace: null,
        mousePosition: null,
        isActive: false,
      });
    }
  }, [isAddPanelMode, faceCycleState, onFaceSelect]);


  const handleFaceHover = useCallback((faceIndex: number | null) => {
    if ((isAddPanelMode || isPanelEditMode) && onFaceHover) {
      onFaceHover(faceIndex);
    }
  }, [isAddPanelMode, isPanelEditMode, onFaceHover]);


  if ((!isAddPanelMode && !alwaysShowPanels && !isPanelEditMode) || shape.type !== 'box') {
    return null;
  }

  return (
    <group>
      {/* 🎯 MEVCUT PANELLER - Yerleştirilmiş paneller */}
      {smartPanelData.map((panelData, index) => (
        <group key={`panel-${panelData.faceIndex}-${index}`}>
          <mesh
            position={panelData.finalPosition}
            onClick={isPanelEditMode ? (e) => {
              e.stopPropagation();
              if (onPanelSelect) {
                onPanelSelect({
                  faceIndex: panelData.faceIndex,
                  position: panelData.finalPosition,
                  size: panelData.finalSize,
                  panelOrder: panelData.panelOrder,
                });
              }
            } : undefined}
          >
            <boxGeometry args={[panelData.finalSize.x, panelData.finalSize.y, panelData.finalSize.z]} />
            <primitive object={getPanelMaterial(panelData.faceIndex)} />
          </mesh>
          
          {showEdges && (
            <lineSegments position={panelData.finalPosition}>
              <edgesGeometry args={[new THREE.BoxGeometry(panelData.finalSize.x, panelData.finalSize.y, panelData.finalSize.z)]} />
              <lineBasicMaterial
                color={getPanelEdgeColor()}
                linewidth={getPanelEdgeLineWidth()}
                transparent
                opacity={0.8}
              />
            </lineSegments>
          )}
        </group>
      ))}

      {/* 🎯 GHOST PANEL - Cycle sırasında gösterilen sarı panel */}
      {isAddPanelMode && faceCycleState.isActive && faceCycleState.selectedFace !== null && (
        <group>
          {(() => {
            const ghostPanelData = calculateSmartPanelBounds(
              faceCycleState.selectedFace,
              selectedFaces,
              selectedFaces.length
            );
            return (
              <mesh position={ghostPanelData.finalPosition}>
                <boxGeometry args={[ghostPanelData.finalSize.x, ghostPanelData.finalSize.y, ghostPanelData.finalSize.z]} />
                <primitive object={ghostPanelMaterial} />
              </mesh>
            );
          })()}
        </group>
      )}

      {/* 🎯 INVISIBLE FACE MESHES - Click detection için */}
      {isAddPanelMode && faceTransforms.map((transform, faceIndex) => (
        <mesh
          key={`face-${faceIndex}`}
          position={transform.position}
          rotation={transform.rotation}
          onClick={(e) => handleClick(e, faceIndex)}
          onContextMenu={handleContextMenu}
          onPointerEnter={() => handleFaceHover(faceIndex)}
          onPointerLeave={() => handleFaceHover(null)}
        >
          {faceIndex === 0 || faceIndex === 1 ? (
            <planeGeometry args={[shape.parameters.width || 500, shape.parameters.height || 500]} />
          ) : faceIndex === 2 || faceIndex === 3 ? (
            <planeGeometry args={[shape.parameters.width || 500, shape.parameters.depth || 500]} />
          ) : (
            <planeGeometry args={[shape.parameters.depth || 500, shape.parameters.height || 500]} />
          )}
          <meshBasicMaterial
            color={getFaceColor(faceIndex)}
            transparent
            opacity={getFaceOpacity(faceIndex)}
            side={THREE.DoubleSide}
          />
        </mesh>
      ))}
    </group>
  );
};

export default PanelManager;