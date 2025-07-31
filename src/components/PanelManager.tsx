import React, { useMemo, useCallback } from 'react';

import { useThree } from '@react-three/fiber';

import * as THREE from 'three';

import { Shape } from '../types/shapes';

import { ViewMode, useAppStore } from '../store/appStore'; // Corrected path



interface PanelManagerProps {

  shape: Shape;

  isAddPanelMode: boolean;

  selectedFaces: number[];

  hoveredFace: number | null;

  showEdges: boolean;

  showFaces: boolean;

  onFaceSelect: (faceIndex: number) => void;

  onFaceHover: (faceIndex: number | null) => void;

  // 🎯 NEW PROP - Always show panels

  alwaysShowPanels?: boolean;

  // 🔴 NEW: Panel Edit Mode props

  isPanelEditMode?: boolean;

  onPanelSelect?: (panelData: {

    faceIndex: number;

    position: THREE.Vector3;

    size: THREE.Vector3;

    panelOrder: number;

  }) => void;

  // Yeniden eklenen prop'lar

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

  const panelThickness = 18; // 18mm panel thickness

  const { camera, raycaster, gl } = useThree();



  const { viewMode } = useAppStore();



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



    return {

      vertical: verticalMaterial,

      horizontal: horizontalMaterial,

    };

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

          if (previousPanel === 4) {

            expandedBounds.max.x = Math.min(expandedBounds.max.x, hw - panelThickness);

          }

          if (previousPanel === 5) {

            expandedBounds.min.x = Math.max(expandedBounds.min.x, -hw + panelThickness);

          }

          if (previousPanel === 2) {

            expandedBounds.max.y = Math.min(expandedBounds.max.y, hh - panelThickness);

          }

          if (previousPanel === 3) {

            expandedBounds.min.y = Math.max(expandedBounds.min.y, -hh + panelThickness);

          }

        });

        finalSize = new THREE.Vector3(

          expandedBounds.max.x - expandedBounds.min.x,

          expandedBounds.max.y - expandedBounds.min.y,

          panelThickness

        );

        finalPosition = new THREE.Vector3(

          (expandedBounds.max.x + expandedBounds.min.x) / 2,

          (expandedBounds.max.y + expandedBounds.min.y) / 2,

          hd - panelThickness / 2

        );

        break;



      case 1: // Back face

        originalBounds = new THREE.Box3(

          new THREE.Vector3(-hw, -hh, -hd),

          new THREE.Vector3(hw, hh, -hd + panelThickness)

        );

        expandedBounds = originalBounds.clone();

        previousPanels.forEach((previousPanel) => {

          if (previousPanel === 4) {

            expandedBounds.max.x = Math.min(expandedBounds.max.x, hw - panelThickness);

          }

          if (previousPanel === 5) {

            expandedBounds.min.x = Math.max(expandedBounds.min.x, -hw + panelThickness);

          }

          if (previousPanel === 2) {

            expandedBounds.max.y = Math.min(expandedBounds.max.y, hh - panelThickness);

          }

          if (previousPanel === 3) {

            expandedBounds.min.y = Math.max(expandedBounds.min.y, -hh + panelThickness);

          }

        });

        finalSize = new THREE.Vector3(

          expandedBounds.max.x - expandedBounds.min.x,

          expandedBounds.max.y - expandedBounds.min.y,

          panelThickness

        );

        finalPosition = new THREE.Vector3(

          (expandedBounds.max.x + expandedBounds.min.x) / 2,

          (expandedBounds.max.y + expandedBounds.min.y) / 2,

          -hd + panelThickness / 2

        );

        break;



      case 2: // Top face

        originalBounds = new THREE.Box3(

          new THREE.Vector3(-hw, hh - panelThickness, -hd),

          new THREE.Vector3(hw, hh, hd)

        );

        expandedBounds = originalBounds.clone();

        previousPanels.forEach((previousPanel) => {

          if (previousPanel === 4) {

            expandedBounds.max.x = Math.min(expandedBounds.max.x, hw - panelThickness);

          }

          if (previousPanel === 5) {

            expandedBounds.min.x = Math.max(expandedBounds.min.x, -hw + panelThickness);

          }

          if (previousPanel === 0) {

            expandedBounds.max.z = Math.min(expandedBounds.max.z, hd - panelThickness);

          }

          if (previousPanel === 1) {

            expandedBounds.min.z = Math.max(expandedBounds.min.z, -hd + panelThickness);

          }

        });

        finalSize = new THREE.Vector3(

          expandedBounds.max.x - expandedBounds.min.x,

          panelThickness,

          expandedBounds.max.z - expandedBounds.min.z

        );

        finalPosition = new THREE.Vector3(

          (expandedBounds.max.x + expandedBounds.min.x) / 2,

          hh - panelThickness / 2,

          (expandedBounds.max.z + expandedBounds.min.z) / 2

        );

        break;



      case 3: // Bottom face

        originalBounds = new THREE.Box3(

          new THREE.Vector3(-hw, -hh, -hd),

          new THREE.Vector3(hw, -hh + panelThickness, hd)

        );

        expandedBounds = originalBounds.clone();

        previousPanels.forEach((previousPanel) => {

          if (previousPanel === 4) {

            expandedBounds.max.x = Math.min(expandedBounds.max.x, hw - panelThickness);

          }

          if (previousPanel === 5) {

            expandedBounds.min.x = Math.max(expandedBounds.min.x, -hw + panelThickness);

          }

          if (previousPanel === 0) {

            expandedBounds.max.z = Math.min(expandedBounds.max.z, hd - panelThickness);

          }

          if (previousPanel === 1) {

            expandedBounds.min.z = Math.max(expandedBounds.min.z, -hd + panelThickness);

          }

        });

        finalSize = new THREE.Vector3(

          expandedBounds.max.x - expandedBounds.min.x,

          panelThickness,

          expandedBounds.max.z - expandedBounds.min.z

        );

        finalPosition = new THREE.Vector3(

          (expandedBounds.max.x + expandedBounds.min.x) / 2,

          -hh + panelThickness / 2,

          (expandedBounds.max.z + expandedBounds.min.z) / 2

        );

        break;



      case 4: // Right face

        originalBounds = new THREE.Box3(

          new THREE.Vector3(hw - panelThickness, -hh, -hd),

          new THREE.Vector3(hw, hh, hd)

        );

        expandedBounds = originalBounds.clone();

        previousPanels.forEach((previousPanel) => {

          if (previousPanel === 2) {

            expandedBounds.max.y = Math.min(expandedBounds.max.y, hh - panelThickness);

          }

          if (previousPanel === 3) {

            expandedBounds.min.y = Math.max(expandedBounds.min.y, -hh + panelThickness);

          }

          if (previousPanel === 0) {

            expandedBounds.max.z = Math.min(expandedBounds.max.z, hd - panelThickness);

          }

          if (previousPanel === 1) {

            expandedBounds.min.z = Math.max(expandedBounds.min.z, -hd + panelThickness);

          }

        });

        finalSize = new THREE.Vector3(

          panelThickness,

          expandedBounds.max.y - expandedBounds.min.y,

          expandedBounds.max.z - expandedBounds.min.z

        );

        finalPosition = new THREE.Vector3(

          hw - panelThickness / 2,

          (expandedBounds.max.y + expandedBounds.min.y) / 2,

          (expandedBounds.max.z + expandedBounds.min.z) / 2

        );

        break;



      case 5: // Left face

        originalBounds = new THREE.Box3(

          new THREE.Vector3(-hw, -hh, -hd),

          new THREE.Vector3(-hw + panelThickness, hh, hd)

        );

        expandedBounds = originalBounds.clone();

        previousPanels.forEach((previousPanel) => {

          if (previousPanel === 2) {

            expandedBounds.max.y = Math.min(expandedBounds.max.y, hh - panelThickness);

          }

          if (previousPanel === 3) {

            expandedBounds.min.y = Math.max(expandedBounds.min.y, -hh + panelThickness);

          }

          if (previousPanel === 0) {

            expandedBounds.max.z = Math.min(expandedBounds.max.z, hd - panelThickness);

          }

          if (previousPanel === 1) {

            expandedBounds.min.z = Math.max(expandedBounds.min.z, -hd + panelThickness);

          }

        });

        finalSize = new THREE.Vector3(

          panelThickness,

          expandedBounds.max.y - expandedBounds.min.y,

          expandedBounds.max.z - expandedBounds.min.z

        );

        finalPosition = new THREE.Vector3(

          -hw + panelThickness / 2,

          (expandedBounds.max.y + expandedBounds.min.y) / 2,

          (expandedBounds.max.z + expandedBounds.min.z) / 2

        );

        break;



      default:

        originalBounds = new THREE.Box3();

        expandedBounds = new THREE.Box3();

        finalPosition = new THREE.Vector3();

        finalSize = new THREE.Vector3(

          panelThickness,

          panelThickness,

          panelThickness

        );

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

      const smartBounds = calculateSmartPanelBounds(

        faceIndex,

        selectedFaces,

        panelOrder

      );



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



  const getPanelMaterial = (faceIndex: number) => {

    if (faceIndex === 2 || faceIndex === 3) {

      return woodMaterials.horizontal;

    }

    return woodMaterials.vertical;

  };



  const getPanelColor = (faceIndex: number) => {

    if (isPanelEditMode && selectedFaces.includes(faceIndex)) {

      return '#dc2626'; // RED for panels in edit mode

    }

    return getPanelMaterial(faceIndex);

  };



  const getPanelEdgeColor = () => {

    switch (viewMode) {

      case ViewMode.WIREFRAME:

        return '#ffffff'; // White edges in wireframe mode

      case ViewMode.TRANSPARENT:

        return '#000000'; // Black edges in transparent mode

      case ViewMode.SOLID:

        return '#2a2a2a'; // Dark gray in solid mode

      default:

        return '#2a2a2a';

    }

  };



  // Dinamik face detection - mouse pozisyonuna göre hangi face'lerin altında olduğunu bul

  const detectFacesAtMousePosition = useCallback((event: MouseEvent): number[] => {

    const rect = gl.domElement.getBoundingClientRect();

    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;

    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;



    raycaster.setFromCamera({ x, y }, camera);

    

    // Box'ın tüm face'lerini test et

    const detectedFaces: { faceIndex: number; distance: number }[] = [];

    const { width = 500, height = 500, depth = 500 } = shape.parameters;

    const hw = width / 2;

    const hh = height / 2;

    const hd = depth / 2;



    // Face geometrileri ve pozisyonları

    const faceData = [

      // Front face (0) - Z+

      { geometry: new THREE.PlaneGeometry(width, height), position: [0, 0, hd], rotation: [0, 0, 0] },

      // Back face (1) - Z-

      { geometry: new THREE.PlaneGeometry(width, height), position: [0, 0, -hd], rotation: [0, Math.PI, 0] },

      // Top face (2) - Y+

      { geometry: new THREE.PlaneGeometry(width, depth), position: [0, hh, 0], rotation: [-Math.PI / 2, 0, 0] },

      // Bottom face (3) - Y-

      { geometry: new THREE.PlaneGeometry(width, depth), position: [0, -hh, 0], rotation: [Math.PI / 2, 0, 0] },

      // Right face (4) - X+

      { geometry: new THREE.PlaneGeometry(depth, height), position: [hw, 0, 0], rotation: [0, Math.PI / 2, 0] },

      // Left face (5) - X-

      { geometry: new THREE.PlaneGeometry(depth, height), position: [-hw, 0, 0], rotation: [0, -Math.PI / 2, 0] },

    ];



    faceData.forEach((face, faceIndex) => {

      const mesh = new THREE.Mesh(face.geometry);

      mesh.position.set(

        shape.position[0] + face.position[0],

        shape.position[1] + face.position[1],

        shape.position[2] + face.position[2]

      );

      mesh.rotation.set(

        shape.rotation[0] + face.rotation[0],

        shape.rotation[1] + face.rotation[1],

        shape.rotation[2] + face.rotation[2]

      );

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

    return detectedFaces.map(f => f.faceIndex);

  }, [camera, raycaster, gl, shape]);



  // Mouse pozisyonunu güncelle

  const updateMousePosition = useCallback((event: MouseEvent) => {

    setFaceCycleState(prev => ({

      ...prev,

      mousePosition: { x: event.clientX, y: event.clientY }

    }));

  }, [setFaceCycleState]);



  // Wrap handleClick with useCallback to ensure stable function reference

  const handleClick = useCallback((e: any, faceIndex: number) => {

    e.stopPropagation();

    

    // Mouse pozisyonunu güncelle

    updateMousePosition(e.nativeEvent);



    if (isAddPanelMode && e.nativeEvent.button === 0) {

      // Dinamik face detection

      const detectedFaces = detectFacesAtMousePosition(e.nativeEvent);

      

      if (detectedFaces.length === 0) return;



      // Eğer cycle state boşsa veya farklı bir pozisyonda tıklandıysa, yeni cycle başlat

      if (faceCycleState.availableFaces.length === 0 || 

          JSON.stringify(faceCycleState.availableFaces) !== JSON.stringify(detectedFaces)) {

        setFaceCycleState({

          availableFaces: detectedFaces,

          currentIndex: 0,

          selectedFace: detectedFaces[0],

          mousePosition: { x: e.nativeEvent.clientX, y: e.nativeEvent.clientY }

        });

        console.log(`🎯 Face cycle started: ${detectedFaces.length} faces detected`);

      } else {

        // Cycle içinde bir sonraki face'e geç

        const nextIndex = (faceCycleState.currentIndex + 1) % faceCycleState.availableFaces.length;

        setFaceCycleState(prev => ({

          ...prev,

          currentIndex: nextIndex,

          selectedFace: prev.availableFaces[nextIndex]

        }));

        console.log(`🎯 Face cycled to: ${faceCycleState.availableFaces[nextIndex]} (${nextIndex + 1}/${faceCycleState.availableFaces.length})`);

      }

    } else if (isPanelEditMode && e.nativeEvent.button === 0) {

      // Edit modunda sol tık ile paneli seç

      const panelData = smartPanelData.find(

        (panel) => panel.faceIndex === faceIndex

      );

      if (panelData && onPanelSelect) {

        onPanelSelect({

          faceIndex: panelData.faceIndex,

          position: panelData.position,

          size: panelData.size,

          panelOrder: panelData.panelOrder,

        });

      }

    }

  }, [isAddPanelMode, isPanelEditMode, selectedFaces, onFaceSelect, smartPanelData, onPanelSelect, detectFacesAtMousePosition, faceCycleState, setFaceCycleState, updateMousePosition]);



  const handleContextMenu = useCallback((e: any, faceIndex: number) => {

    // Sağ tık ile panel yerleştirmeyi onayla

    if (!isAddPanelMode) return;



    e.stopPropagation();

    e.nativeEvent.preventDefault();



    // Eğer cycle state'de seçili face varsa, onu onayla

    if (faceCycleState.selectedFace !== null) {

      onFaceSelect(faceCycleState.selectedFace);

      

      // Cycle state'i sıfırla

      setFaceCycleState({

        availableFaces: [],

        currentIndex: 0,

        selectedFace: null,

        mousePosition: null

      });

      

      console.log(`🎯 Panel confirmed on face: ${faceCycleState.selectedFace}`);

    }

  }, [isAddPanelMode, onFaceSelect, faceCycleState, setFaceCycleState]);





  const handleFaceHover = useCallback((faceIndex: number | null) => {

    if ((isAddPanelMode || isPanelEditMode) && onFaceHover) {

      onFaceHover(faceIndex);

    }

  }, [isAddPanelMode, isPanelEditMode, onFaceHover]);

  

  // Hayali panel için material

  const ghostPanelMaterial = new THREE.MeshBasicMaterial({

    color: '#fbbf24', // Sarı

    transparent: true,

    opacity: 0.5,

    side: THREE.DoubleSide,

    depthTest: false,

  });



  const getFaceColor = (faceIndex: number) => {

    if (selectedFaces.includes(faceIndex)) return '#10b981';

    if (hoveredFace === faceIndex) return '#eeeeee';

    return '#3b82f6';

  };



  const getFaceOpacity = (faceIndex: number) => {

    if (isAddPanelMode && hoveredFace === faceIndex) return 0.0; // Hoverlanan yüzü görünmez yap

    if (selectedFaces.includes(faceIndex)) return 0.0;

    return 0.001; // Diğer yüzeyleri neredeyse görünmez yapar

  };



  const getPanelEdgeLineWidth = () => {

    const screenWidth = window.innerWidth;

    if (screenWidth < 768) {

      return 1.0;

    } else if (screenWidth < 1024) {

      return 1.5;

    } else {

      return 2.0;

    }

  };



  if (

    (!isAddPanelMode && !alwaysShowPanels && !isPanelEditMode) ||

    shape.type !== 'box'

  ) {

    return null;

  }



  // Face positions and rotations for box

  const faceTransforms = useMemo(() => {

    const { width = 500, height = 500, depth = 500 } = shape.parameters;

    const hw = width / 2;

    const hh = height / 2;

    const hd = depth / 2;



    return [

      // Front face (0) - Z+

      { position: [0, 0, hd], rotation: [0, 0, 0] },

      // Back face (1) - Z-

      { position: [0, 0, -hd], rotation: [0, Math.PI, 0] },

      // Top face (2) - Y+

      { position: [0, hh, 0], rotation: [-Math.PI / 2, 0, 0] },

      // Bottom face (3) - Y-

      { position: [0, -hh, 0], rotation: [Math.PI / 2, 0, 0] },

      // Right face (4) - X+

      { position: [hw, 0, 0], rotation: [0, Math.PI / 2, 0] },

      // Left face (5) - X-

      { position: [-hw, 0, 0], rotation: [0, -Math.PI / 2, 0] },

    ];

  }, [shape.parameters]);



  return (

    <group>

      {/* Individual face overlays for panel mode - ALL FACES VISIBLE */}

      {showFaces &&

        faceTransforms.map((transform, faceIndex) => {

          const opacity = getFaceOpacity(faceIndex);



          return (

            <mesh

              key={`face-${faceIndex}`}

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

              scale={shape.scale}

              onClick={(e) => handleClick(e, faceIndex)}

              onContextMenu={(e) => handleContextMenu(e, faceIndex)} // Sağ tık eklendi

              onPointerEnter={() => handleFaceHover(faceIndex)}

              onPointerLeave={() => handleFaceHover(null)}

            >

              <meshBasicMaterial

                color={getFaceColor(faceIndex)}

                transparent

                opacity={opacity}

                side={THREE.DoubleSide}

                depthTest={false}

              />

            </mesh>

          );

        })}



      {/* 🎯 HAYALİ PANEL - Yüzeye yaklaştığında gösterilecek */}

      {isAddPanelMode && faceCycleState.selectedFace !== null && !selectedFaces.includes(faceCycleState.selectedFace) && (

        <mesh

          key={`ghost-panel-${faceCycleState.selectedFace}`}

          geometry={new THREE.PlaneGeometry(

            faceCycleState.selectedFace === 2 || faceCycleState.selectedFace === 3 ? shape.parameters.width : (faceCycleState.selectedFace === 4 || faceCycleState.selectedFace === 5 ? shape.parameters.depth : shape.parameters.width),

            faceCycleState.selectedFace === 2 || faceCycleState.selectedFace === 3 ? shape.parameters.depth : shape.parameters.height

          )}

          position={[

            shape.position[0] + faceTransforms[faceCycleState.selectedFace].position[0],

            shape.position[1] + faceTransforms[faceCycleState.selectedFace].position[1],

            shape.position[2] + faceTransforms[faceCycleState.selectedFace].position[2],

          ]}

          rotation={[

            shape.rotation[0] + faceTransforms[faceCycleState.selectedFace].rotation[0],

            shape.rotation[1] + faceTransforms[faceCycleState.selectedFace].rotation[1],

            shape.rotation[2] + faceTransforms[faceCycleState.selectedFace].rotation[2],

          ]}

          scale={shape.scale}

          material={ghostPanelMaterial}

        />

      )}



      {/* 🎯 GUARANTEED LAST PANEL SHRINKS - Wood panels with guaranteed sizing */}

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

          // Hide mesh in wireframe mode

          visible={viewMode !== ViewMode.WIREFRAME}

          // 🔴 NEW: Click handler for panel edit mode

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

                console.log(

                  `🔴 Panel ${panelData.faceIndex} clicked for editing`

                );

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



      {/* 🎨 PROFESSIONAL SHARP EDGES - Clear black outlines */}

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

              viewMode === ViewMode.TRANSPARENT ||

              viewMode === ViewMode.WIREFRAME

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