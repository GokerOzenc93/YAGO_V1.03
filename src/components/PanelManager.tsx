import React, { useMemo, useCallback, useRef, useState } from 'react';
import { useThree, useFrame } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { ViewMode, useAppStore } from '../store/appStore';

interface PanelManagerProps {
  shape: Shape;
  isAddPanelMode: boolean;
  selectedFaces: number[];
  onFaceSelect?: (faceIndex: number) => void;
  onFaceHover?: (faceIndex: number | null) => void;
  hoveredFace?: number | null;
  showEdges?: boolean;
  showFaces?: boolean;
  onFaceCycleUpdate?: (cycleState: {
    selectedFace: number | null;
    currentIndex: number;
    availableFaces: number[];
    mousePosition: { x: number; y: number } | null;
  }) => void;
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
  selectedFaces,
  onFaceSelect,
  onFaceHover,
  hoveredFace,
  showEdges = true,
  showFaces = true,
  onFaceCycleUpdate,
  isPanelEditMode = false,
  onPanelSelect,
}) => {
  const panelThickness = 18;
  const { camera, raycaster, gl } = useThree();
  const { viewMode } = useAppStore();
  const boxMeshRef = useRef<THREE.Mesh>(null);
  const [hoveredFaceInfo, setHoveredFaceInfo] = useState<{
    faceIndex: number;
    point: THREE.Vector3;
  } | null>(null);

  // UseMemo ile materyalleri bir kez oluştur
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

  // Yüzey rotasyonları ve pozisyonları
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

  // Akıllı panel boyutlandırma mantığı
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
  
  // Hayali panel için material
  const ghostPanelMaterial = useMemo(() => new THREE.MeshBasicMaterial({
    color: '#fbbf24',
    transparent: true,
    opacity: 0.5,
    side: THREE.DoubleSide,
    depthTest: false,
  }), []);

  // UseFrame ile her frame'de raycaster'ı güncelle
  useFrame(() => {
    if (!isAddPanelMode || !boxMeshRef.current) return;

    const mouse = new THREE.Vector2();
    const rect = gl.domElement.getBoundingClientRect();
    const x = ((gl.domElement.width / rect.width) * (gl.domElement.getBoundingClientRect().left - window.innerWidth / 2) + gl.domElement.width / 2) / gl.domElement.width * 2 - 1;
    const y = -((gl.domElement.height / rect.height) * (gl.domElement.getBoundingClientRect().top - window.innerHeight / 2) + gl.domElement.height / 2) / gl.domElement.height * 2 + 1;
    mouse.set(x, y);

    raycaster.setFromCamera(mouse, camera);

    const intersects = raycaster.intersectObject(boxMeshRef.current);

    if (intersects.length > 0) {
      const { faceIndex, point } = intersects[0];
      setHoveredFaceInfo({ faceIndex: faceIndex as number, point });
    } else {
      setHoveredFaceInfo(null);
    }
  });

  const handleClick = useCallback((e: any) => {
    e.stopPropagation();
    
    if (isAddPanelMode && e.nativeEvent.button === 0) {
      // Sol tık - Face cycle başlat veya devam ettir
      const detectedFaces = detectFacesAtMousePosition(e.nativeEvent);
      
      if (detectedFaces.length > 0) {
        if (faceCycleState.availableFaces.length === 0) {
          // İlk tık - cycle başlat
          setFaceCycleState({
            availableFaces: detectedFaces,
            currentIndex: 0,
            selectedFace: detectedFaces[0],
            mousePosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
          });
          console.log(`🎯 Face cycle started with ${detectedFaces.length} faces:`, detectedFaces);
        } else {
          // Sonraki tık - cycle devam ettir
          const nextIndex = (faceCycleState.currentIndex + 1) % faceCycleState.availableFaces.length;
          setFaceCycleState(prev => ({
            ...prev,
            currentIndex: nextIndex,
            selectedFace: prev.availableFaces[nextIndex],
            mousePosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }
          }));
          console.log(`🎯 Face cycle: ${nextIndex + 1}/${faceCycleState.availableFaces.length} - Face ${faceCycleState.availableFaces[nextIndex]}`);
        }
      }
    } else if (isAddPanelMode && e.nativeEvent.button === 2 && faceCycleState.selectedFace !== null) {
      // Sağ tık - Panel yerleştir
      if (onFaceSelect) {
        onFaceSelect(faceCycleState.selectedFace);
        console.log(`🎯 Panel placed on face ${faceCycleState.selectedFace}`);
      }
      
      // Cycle'ı sıfırla
      setFaceCycleState({
        availableFaces: [],
        currentIndex: 0,
        selectedFace: null,
        mousePosition: null
      });
    } else if (isPanelEditMode) {
      // Panel edit mode logic burada olacak
    }
  }, [isAddPanelMode, isPanelEditMode, faceCycleState, onFaceSelect, detectFacesAtMousePosition]);

  const handleContextMenu = useCallback((e: any) => {
    e.stopPropagation();
    e.nativeEvent.preventDefault();
    
    if (isAddPanelMode && faceCycleState.selectedFace !== null) {
      // Sağ tık - Panel yerleştir
      if (onFaceSelect) {
        onFaceSelect(faceCycleState.selectedFace);
        console.log(`🎯 Panel placed on face ${faceCycleState.selectedFace} (right-click)`);
      }
      
      // Cycle'ı sıfırla
      setFaceCycleState({
        availableFaces: [],
        currentIndex: 0,
        selectedFace: null,
        mousePosition: null
      });
    }
  }, []);

  // Ghost panel için cycle'daki seçili face'i kullan
  const ghostPanelData = useMemo(() => {
    if (!isAddPanelMode || faceCycleState.selectedFace === null) return null;
    const panelOrder = selectedFaces.length;
    return calculateSmartPanelBounds(faceCycleState.selectedFace, selectedFaces, panelOrder);
  }, [isAddPanelMode, faceCycleState.selectedFace, selectedFaces, shape.parameters]);

  // Face cycle state'ini parent'a bildir
  useEffect(() => {
    if (onFaceCycleUpdate) {
      onFaceCycleUpdate(faceCycleState);
    }
  }, [faceCycleState, onFaceCycleUpdate]);

  return (
    <group>
      {/* Asıl kutu mesh'i - Görsel panellerin yerleşimi için bir referans olarak kullanılır */}
      <mesh
        ref={boxMeshRef}
        visible={isAddPanelMode || isPanelEditMode || selectedFaces.length === 0}
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onPointerMove={(e) => {
          if (isAddPanelMode) {
            e.stopPropagation();
            const { faceIndex, point } = e.intersections[0];
            setHoveredFaceInfo({ faceIndex: faceIndex as number, point });
          }
        }}
        onPointerOut={() => {
          if (isAddPanelMode) {
            setHoveredFaceInfo(null);
          }
        }}
      >
        <boxGeometry args={[shape.parameters.width, shape.parameters.height, shape.parameters.depth]} />
        <meshStandardMaterial transparent opacity={0.0} />
      </mesh>
      
      {/* Hayali panel - Hover durumuna göre gösterilir */}
      {isAddPanelMode && ghostPanelData && (
        <mesh
          position={[
            shape.position[0] + ghostPanelData.finalPosition.x,
            shape.position[1] + ghostPanelData.finalPosition.y,
            shape.position[2] + ghostPanelData.finalPosition.z,
          ]}
          rotation={faceTransforms[ghostPanelData.faceIndex].rotation}
          material={ghostPanelMaterial}
        >
          <boxGeometry args={[ghostPanelData.finalSize.x, ghostPanelData.finalSize.y, ghostPanelData.finalSize.z]} />
        </mesh>
      )}

      {/* 🎯 FACE NUMBERS - Panel modunda yüzey numaraları */}
      {isAddPanelMode && faceTransforms.map((transform, faceIndex) => (
        <Billboard
          key={`face-number-${faceIndex}`}
          follow={true}
          lockX={false}
          lockY={false}
          lockZ={false}
          position={[
            shape.position[0] + transform.position.x + transform.normal.x * 50,
            shape.position[1] + transform.position.y + transform.normal.y * 50,
            shape.position[2] + transform.position.z + transform.normal.z * 50,
          ]}
        >
          <mesh>
            <circleGeometry args={[30, 16]} />
            <meshBasicMaterial
              color={
                selectedFaces.includes(faceIndex) ? '#10b981' : 
                faceCycleState.selectedFace === faceIndex ? '#fbbf24' :
                '#3b82f6'
              }
              transparent
              opacity={0.9}
              depthTest={false}
            />
          </mesh>
          <Text
            position={[0, 0, 1]}
            fontSize={25}
            color="white"
            anchorX="center"
            anchorY="middle"
            outlineWidth={3}
            outlineColor="#000000"
          >
            {faceIndex}
          </Text>
        </Billboard>
      ))}

      {/* Yerleştirilen paneller */}
      {smartPanelData.map((panelData, index) => (
        <mesh
          key={`panel-${panelData.faceIndex}-${index}`}
          position={[
            shape.position[0] + panelData.finalPosition.x,
            shape.position[1] + panelData.finalPosition.y,
            shape.position[2] + panelData.finalPosition.z,
          ]}
          rotation={faceTransforms[panelData.faceIndex].rotation}
          castShadow
          receiveShadow
          visible={viewMode !== ViewMode.WIREFRAME}
        >
          <boxGeometry args={[panelData.finalSize.x, panelData.finalSize.y, panelData.finalSize.z]} />
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

      {/* 🎯 FACE NUMBERS - Panel modunda yüzey numaraları */}
      {isAddPanelMode && faceTransforms.map((transform, faceIndex) => (
        <Billboard
          key={`face-number-${faceIndex}`}
          follow={true}
          lockX={false}
          lockY={false}
          lockZ={false}
          position={[
            shape.position[0] + transform.position.x + transform.normal.x * 30,
            shape.position[1] + transform.position.y + transform.normal.y * 30,
            shape.position[2] + transform.position.z + transform.normal.z * 30,
          ]}
        >
          <mesh>
            <circleGeometry args={[25, 16]} />
            <meshBasicMaterial
              color={selectedFaces.includes(faceIndex) ? '#10b981' : '#3b82f6'}
              transparent
              opacity={0.8}
              depthTest={false}
            />
          </mesh>
          <Text
            position={[0, 0, 1]}
            fontSize={20}
            color="white"
            anchorX="center"
            anchorY="middle"
            font="/fonts/inter-bold.woff"
            outlineWidth={2}
            outlineColor="#000000"
          >
            {faceIndex}
          </Text>
        </Billboard>
      ))}

      {smartPanelData.map((panelData, index) => (
        <lineSegments
          key={`guaranteed-panel-edges-${panelData.faceIndex}-${index}`}
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
