import React, { useMemo } from 'react';
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
  // Face cycle indicator props
  onFaceCycleUpdate?: (cycleState: {
    selectedFace: number | null;
    currentIndex: number;
    availableFaces: number[];
    mousePosition: { x: number; y: number } | null;
  }) => void;
  // Face cycling state from parent
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
}

// 🎯 GUARANTEED LAST PANEL SHRINKS SYSTEM - Kesin çözüm!
interface SmartPanelBounds {
  faceIndex: number;
  originalBounds: THREE.Box3;
  expandedBounds: THREE.Box3;
  finalPosition: THREE.Vector3;
  finalSize: THREE.Vector3;
  thickness: number;
  cuttingSurfaces: number[]; // Bu panel hangi panellerden etkilenir
  isLastPanel: boolean; // En son yerleştirilen panel mi?
  panelOrder: number; // Panel yerleştirme sırası
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
  onFaceCycleUpdate,
  faceCycleState,
  setFaceCycleState,
  alwaysShowPanels = false,
  // 🔴 NEW: Panel Edit Mode props
  isPanelEditMode = false,
  onPanelSelect,
}) => {
  const panelThickness = 18; // 18mm panel thickness

  // 🎯 GET CURRENT VIEW MODE
  const { viewMode } = useAppStore();

  // 🪵 BALANCED WOOD MATERIALS - Elegant but controlled reflections
  const woodMaterials = useMemo(() => {
    const textureLoader = new THREE.TextureLoader();

    // 🎨 HIGH-QUALITY WOOD TEXTURE - Premium oak texture
    const woodTexture = textureLoader.load(
      'https://images.pexels.com/photos/6757411/pexels-photo-6757411.jpeg'
    );
    woodTexture.wrapS = THREE.RepeatWrapping;
    woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(0.64, 0.64); // Moderate grain pattern
    woodTexture.anisotropy = 8; // Reduced anisotropy for performance

    // 🎨 NORMAL MAP for realistic depth
    const woodNormalMap = textureLoader.load(
      'https://images.pexels.com/photos/6757411/pexels-photo-6757411.jpeg'
    );
    woodNormalMap.wrapS = THREE.RepeatWrapping;
    woodNormalMap.wrapT = THREE.RepeatWrapping;
    woodNormalMap.repeat.set(0.6, 0.6);
    woodNormalMap.anisotropy = 108;

    // 🎯 BALANCED MATERIAL PROPERTIES - Elegant but controlled
    const baseMaterialProps = {
      // 🎯 CONTROLLED REFLECTIONS - Elegant but not overwhelming
      metalness: 0.02, // Minimal metallic sheen
      roughness: 1.1, // More matte finish
      clearcoat: 0.4, // Moderate clear coat
      clearcoatRoughness: 0.1, // Slightly rough clear coat
      reflectivity: 0.1, // Reduced reflections
      envMapIntensity: 0.4, // Lower environment reflections

      // 🎯 SUBTLE LIGHTING
      emissive: new THREE.Color(0x000000), // No emission
      emissiveIntensity: 0.0,

      // 🎯 PREMIUM SURFACE PROPERTIES
      side: THREE.DoubleSide,
      map: woodTexture,
      normalMap: woodNormalMap,
      normalScale: new THREE.Vector2(0.4, 0.4), // Moderate normal detail
      color: new THREE.Color(0xf3f6f4), // Warm wood color

      // 🎯 PROFESSIONAL FINISH
      transparent: false,
      opacity: 1.0,
      alphaTest: 0,
      depthWrite: true,
      depthTest: true,

      // 🎯 ADVANCED MATERIAL PROPERTIES
      premultipliedAlpha: false,
      vertexColors: false,
      fog: true,
      flatShading: false,

      // 🎯 CONTROLLED LIGHTING EFFECTS
      iridescence: 0.0, // No color shift
      iridescenceIOR: 1.0,
      sheen: 0.1, // Minimal sheen
      sheenRoughness: 0.9, // Rough sheen
      sheenColor: new THREE.Color(0xffffff),
      specularIntensity: 0.3, // Reduced specular highlights
      specularColor: new THREE.Color(0xffffff),
      transmission: 0.0,
      thickness: 0.0,
      attenuationDistance: Infinity,
      attenuationColor: new THREE.Color(0xffffff),
      ior: 1.2, // Moderate index of refraction
    };

    const verticalMaterial = new THREE.MeshPhysicalMaterial(baseMaterialProps);

    // Create horizontal material by rotating texture coordinates
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

  // 🎯 GUARANTEED LAST PANEL SHRINKS SYSTEM - Kesin çözüm!
  const calculateSmartPanelBounds = (
    faceIndex: number,
    allPanels: number[],
    panelOrder: number
  ): SmartPanelBounds => {
    const { width = 500, height = 500, depth = 500 } = shape.parameters;
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;

    // 🎯 CRITICAL: SADECE ÖNCEKİ PANELLER KESİCİ YÜZEY OLUR!
    // Panel sırasına göre: sadece daha önce yerleştirilen paneller kesici yüzey
    const previousPanels = allPanels.slice(0, panelOrder); // Sadece önceki paneller
    const isLastPanel = panelOrder === allPanels.length - 1; // En son panel mi?

    console.log(`🎯 GUARANTEED SYSTEM - Panel ${faceIndex}:`, {
      panelOrder,
      totalPanels: allPanels.length,
      previousPanels,
      isLastPanel,
      willShrink: previousPanels.length > 0,
    });

    let originalBounds: THREE.Box3;
    let expandedBounds: THREE.Box3;
    let finalPosition: THREE.Vector3;
    let finalSize: THREE.Vector3;

    switch (faceIndex) {
      case 0: // Front face
        // 🎯 STEP 1: Start with maximum possible size (fill empty space)
        originalBounds = new THREE.Box3(
          new THREE.Vector3(-hw, -hh, hd - panelThickness),
          new THREE.Vector3(hw, hh, hd)
        );

        // 🎯 STEP 2: Shrink ONLY from previous panels (GUARANTEED)
        expandedBounds = originalBounds.clone();

        // 🎯 CRITICAL: SADECE ÖNCEKİ PANELLERDEN KISALIR
        previousPanels.forEach((previousPanel) => {
          if (previousPanel === 4) {
            // Right panel was placed before
            expandedBounds.max.x = Math.min(
              expandedBounds.max.x,
              hw - panelThickness
            );
            console.log(`🎯 Front panel SHRINKS from PREVIOUS Right panel`);
          }
          if (previousPanel === 5) {
            // Left panel was placed before
            expandedBounds.min.x = Math.max(
              expandedBounds.min.x,
              -hw + panelThickness
            );
            console.log(`🎯 Front panel SHRINKS from PREVIOUS Left panel`);
          }
          if (previousPanel === 2) {
            // Top panel was placed before
            expandedBounds.max.y = Math.min(
              expandedBounds.max.y,
              hh - panelThickness
            );
            console.log(`🎯 Front panel SHRINKS from PREVIOUS Top panel`);
          }
          if (previousPanel === 3) {
            // Bottom panel was placed before
            expandedBounds.min.y = Math.max(
              expandedBounds.min.y,
              -hh + panelThickness
            );
            console.log(`🎯 Front panel SHRINKS from PREVIOUS Bottom panel`);
          }
        });

        // 🎯 STEP 3: Calculate final position and size
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
            // Right panel was placed before
            expandedBounds.max.x = Math.min(
              expandedBounds.max.x,
              hw - panelThickness
            );
            console.log(`🎯 Back panel SHRINKS from PREVIOUS Right panel`);
          }
          if (previousPanel === 5) {
            // Left panel was placed before
            expandedBounds.min.x = Math.max(
              expandedBounds.min.x,
              -hw + panelThickness
            );
            console.log(`🎯 Back panel SHRINKS from PREVIOUS Left panel`);
          }
          if (previousPanel === 2) {
            // Top panel was placed before
            expandedBounds.max.y = Math.min(
              expandedBounds.max.y,
              hh - panelThickness
            );
            console.log(`🎯 Back panel SHRINKS from PREVIOUS Top panel`);
          }
          if (previousPanel === 3) {
            // Bottom panel was placed before
            expandedBounds.min.y = Math.max(
              expandedBounds.min.y,
              -hh + panelThickness
            );
            console.log(`🎯 Back panel SHRINKS from PREVIOUS Bottom panel`);
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
            // Right panel was placed before
            expandedBounds.max.x = Math.min(
              expandedBounds.max.x,
              hw - panelThickness
            );
            console.log(`🎯 Top panel SHRINKS from PREVIOUS Right panel`);
          }
          if (previousPanel === 5) {
            // Left panel was placed before
            expandedBounds.min.x = Math.max(
              expandedBounds.min.x,
              -hw + panelThickness
            );
            console.log(`🎯 Top panel SHRINKS from PREVIOUS Left panel`);
          }
          if (previousPanel === 0) {
            // Front panel was placed before
            expandedBounds.max.z = Math.min(
              expandedBounds.max.z,
              hd - panelThickness
            );
            console.log(`🎯 Top panel SHRINKS from PREVIOUS Front panel`);
          }
          if (previousPanel === 1) {
            // Back panel was placed before
            expandedBounds.min.z = Math.max(
              expandedBounds.min.z,
              -hd + panelThickness
            );
            console.log(`🎯 Top panel SHRINKS from PREVIOUS Back panel`);
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
            // Right panel was placed before
            expandedBounds.max.x = Math.min(
              expandedBounds.max.x,
              hw - panelThickness
            );
            console.log(`🎯 Bottom panel SHRINKS from PREVIOUS Right panel`);
          }
          if (previousPanel === 5) {
            // Left panel was placed before
            expandedBounds.min.x = Math.max(
              expandedBounds.min.x,
              -hw + panelThickness
            );
            console.log(`🎯 Bottom panel SHRINKS from PREVIOUS Left panel`);
          }
          if (previousPanel === 0) {
            // Front panel was placed before
            expandedBounds.max.z = Math.min(
              expandedBounds.max.z,
              hd - panelThickness
            );
            console.log(`🎯 Bottom panel SHRINKS from PREVIOUS Front panel`);
          }
          if (previousPanel === 1) {
            // Back panel was placed before
            expandedBounds.min.z = Math.max(
              expandedBounds.min.z,
              -hd + panelThickness
            );
            console.log(`🎯 Bottom panel SHRINKS from PREVIOUS Back panel`);
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
            // Top panel was placed before
            expandedBounds.max.y = Math.min(
              expandedBounds.max.y,
              hh - panelThickness
            );
            console.log(`🎯 Right panel SHRINKS from PREVIOUS Top panel`);
          }
          if (previousPanel === 3) {
            // Bottom panel was placed before
            expandedBounds.min.y = Math.max(
              expandedBounds.min.y,
              -hh + panelThickness
            );
            console.log(`🎯 Right panel SHRINKS from PREVIOUS Bottom panel`);
          }
          if (previousPanel === 0) {
            // Front panel was placed before
            expandedBounds.max.z = Math.min(
              expandedBounds.max.z,
              hd - panelThickness
            );
            console.log(`🎯 Right panel SHRINKS from PREVIOUS Front panel`);
          }
          if (previousPanel === 1) {
            // Back panel was placed before
            expandedBounds.min.z = Math.max(
              expandedBounds.min.z,
              -hd + panelThickness
            );
            console.log(`🎯 Right panel SHRINKS from PREVIOUS Back panel`);
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
            // Top panel was placed before
            expandedBounds.max.y = Math.min(
              expandedBounds.max.y,
              hh - panelThickness
            );
            console.log(`🎯 Left panel SHRINKS from PREVIOUS Top panel`);
          }
          if (previousPanel === 3) {
            // Bottom panel was placed before
            expandedBounds.min.y = Math.max(
              expandedBounds.min.y,
              -hh + panelThickness
            );
            console.log(`🎯 Left panel SHRINKS from PREVIOUS Bottom panel`);
          }
          if (previousPanel === 0) {
            // Front panel was placed before
            expandedBounds.max.z = Math.min(
              expandedBounds.max.z,
              hd - panelThickness
            );
            console.log(`🎯 Left panel SHRINKS from PREVIOUS Front panel`);
          }
          if (previousPanel === 1) {
            // Back panel was placed before
            expandedBounds.min.z = Math.max(
              expandedBounds.min.z,
              -hd + panelThickness
            );
            console.log(`🎯 Left panel SHRINKS from PREVIOUS Back panel`);
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
      cuttingSurfaces: previousPanels, // Sadece önceki paneller
      isLastPanel,
      panelOrder,
    };
  };

  // Create individual face geometries for box shapes - ALWAYS VISIBLE IN PANEL MODE
  const faceGeometries = useMemo(() => {
    if (shape.type !== 'box' || (!isAddPanelMode && !alwaysShowPanels))
      return [];

    const { width = 500, height = 500, depth = 500 } = shape.parameters;

    return [
      // Front face (0)
      new THREE.PlaneGeometry(width, height),
      // Back face (1)
      new THREE.PlaneGeometry(width, height),
      // Top face (2)
      new THREE.PlaneGeometry(width, depth),
      // Bottom face (3)
      new THREE.PlaneGeometry(width, depth),
      // Right face (4)
      new THREE.PlaneGeometry(depth, height),
      // Left face (5)
      new THREE.PlaneGeometry(depth, height),
    ];
  }, [shape.type, shape.parameters, isAddPanelMode, alwaysShowPanels]);

  // Face positions and rotations for box
  const faceTransforms = useMemo(() => {
    if (shape.type !== 'box') return [];

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
  }, [shape.type, shape.parameters]);

  // 🎯 GUARANTEED LAST PANEL SHRINKS - Kesin çözüm!
  const smartPanelData = useMemo(() => {
    if (shape.type !== 'box' || selectedFaces.length === 0) return [];

    return selectedFaces.map((faceIndex, index) => {
      // 🎯 CRITICAL: Panel sırası array index'ine göre belirlenir
      const panelOrder = index; // 0, 1, 2, 3... sırasında
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

      console.log(
        `🎯 GUARANTEED SYSTEM - Panel ${faceIndex} (Order: ${panelOrder}):`,
        {
          finalSize: smartBounds.finalSize.toArray().map((v) => v.toFixed(1)),
          finalPosition: smartBounds.finalPosition
            .toArray()
            .map((v) => v.toFixed(1)),
          previousPanels: smartBounds.cuttingSurfaces,
          isLastPanel: smartBounds.isLastPanel,
          panelOrder: smartBounds.panelOrder,
          guaranteedSystem: true,
        }
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

  // GET APPROPRIATE WOOD MATERIAL BASED ON PANEL ORIENTATION
  const getPanelMaterial = (faceIndex: number) => {
    // Top and bottom panels use horizontal grain
    if (faceIndex === 2 || faceIndex === 3) {
      return woodMaterials.horizontal;
    }
    // All other panels use vertical grain
    return woodMaterials.vertical;
  };

  // 🔴 NEW: Get panel color based on edit mode
  const getPanelColor = (faceIndex: number) => {
    if (isPanelEditMode && selectedFaces.includes(faceIndex)) {
      return '#dc2626'; // RED for panels in edit mode
    }
    // This function returns a material, not a color string.
    // It should return a THREE.Material instance directly.
    return getPanelMaterial(faceIndex);
  };

  // NEW: Get panel edge color based on view mode
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

  // ENHANCED: Get overlapping faces at mouse position with realistic camera-based detection
  const getOverlappingFacesAtPosition = (
    mouseX: number,
    mouseY: number
  ): number[] => {
    // Get viewport dimensions
    const centerX = window.innerWidth / 2;
    const centerY = window.innerHeight / 2;

    // Calculate relative position from center (-1 to 1)
    const relativeX = (mouseX - centerX) / centerX;
    const relativeY = (mouseY - centerY) / centerY;

    // Determine which faces are potentially visible based on camera angle and mouse position
    const visibleFaces: number[] = [];

    // FRONT-FACING CAMERA ANGLE SIMULATION
    // Based on typical isometric/perspective view where we can see front, top, and right faces

    // Front face (0) - Always visible in front-facing view
    visibleFaces.push(0);

    // Top face (2) - Visible when looking from above
    if (relativeY < 0.3) {
      // Upper part of screen
      visibleFaces.push(2);
    }

    // Bottom face (3) - Visible when looking from below
    if (relativeY > -0.3) {
      // Lower part of screen
      visibleFaces.push(3);
    }

    // Right face (4) - Visible when looking from right side
    if (relativeX > -0.5) {
      // Right side of screen
      visibleFaces.push(4);
    }

    // Left face (5) - Visible when looking from left side
    if (relativeX < 0.5) {
      // Left side of screen
      visibleFaces.push(5);
    }

    // Back face (1) - Usually not visible in front-facing view, but include for completeness
    // Only add if we're in a very specific angle
    if (Math.abs(relativeX) > 0.8 || Math.abs(relativeY) > 0.8) {
      visibleFaces.push(1);
    }

    // Sort faces by typical visibility priority (front -> top -> right -> left -> bottom -> back)
    const priorityOrder = [0, 2, 4, 5, 3, 1];
    const sortedFaces = visibleFaces.sort((a, b) => {
      return priorityOrder.indexOf(a) - priorityOrder.indexOf(b);
    });

    console.log(`🎯 OVERLAPPING FACES DETECTED:`, {
      mousePosition: { x: mouseX, y: mouseY },
      relativePosition: { x: relativeX.toFixed(2), y: relativeY.toFixed(2) },
      visibleFaces: sortedFaces,
      faceCount: sortedFaces.length,
    });

    return sortedFaces;
  };

  const handleClick = (e: any, faceIndex: number) => {
    if (!isAddPanelMode && !isPanelEditMode) return;

    e.stopPropagation();

    const mouseX = e.nativeEvent.clientX;
    const mouseY = e.nativeEvent.clientY;

    // 🔴 NEW: Panel Edit Mode - Click on panels to edit them
    if (isPanelEditMode && selectedFaces.includes(faceIndex)) {
      // Find the panel data for this face
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
        console.log(`🔴 Panel ${faceIndex} selected for editing`);
      }
      return;
    }

    // Left click - ENHANCED FACE CYCLING SYSTEM (only in add panel mode)
    if (isAddPanelMode && e.nativeEvent.button === 0) {
      // Get all overlapping faces at this position
      const overlappingFaces = getOverlappingFacesAtPosition(mouseX, mouseY);

      if (overlappingFaces.length === 0) {
        console.log('🎯 NO FACES DETECTED at this position');
        return;
      }

      // Check if this is a new position or continuing cycle at same position
      const isSamePosition =
        faceCycleState.mousePosition &&
        Math.abs(faceCycleState.mousePosition.x - mouseX) < 50 &&
        Math.abs(faceCycleState.mousePosition.y - mouseY) < 50;

      if (!isSamePosition || faceCycleState.availableFaces.length === 0) {
        // NEW POSITION - Start new cycle
        setFaceCycleState({
          availableFaces: overlappingFaces,
          currentIndex: 0,
          selectedFace: overlappingFaces[0],
          mousePosition: { x: mouseX, y: mouseY },
        });

        console.log(`🎯 NEW FACE CYCLE STARTED:`, {
          position: { x: mouseX, y: mouseY },
          availableFaces: overlappingFaces,
          selectedFace: overlappingFaces[0],
          totalFaces: overlappingFaces.length,
        });
      } else {
        // SAME POSITION - Continue cycling through faces
        const nextIndex =
          (faceCycleState.currentIndex + 1) %
          faceCycleState.availableFaces.length;
        const nextFace = faceCycleState.availableFaces[nextIndex];

        setFaceCycleState((prev) => ({
          ...prev,
          currentIndex: nextIndex,
          selectedFace: nextFace,
        }));

        console.log(`🎯 FACE CYCLE CONTINUED:`, {
          previousFace: faceCycleState.selectedFace,
          newFace: nextFace,
          cycleIndex: `${nextIndex + 1}/${
            faceCycleState.availableFaces.length
          }`,
          availableFaces: faceCycleState.availableFaces,
        });
      }
    }
  };

  const handleContextMenu = (e: any, faceIndex: number) => {
    if (!isAddPanelMode) return;

    e.stopPropagation();
    e.nativeEvent.preventDefault();

    // Use the currently cycling face, or the clicked face as fallback
    const targetFace =
      faceCycleState.selectedFace !== null
        ? faceCycleState.selectedFace
        : faceIndex;

    if (targetFace !== null && onFaceSelect) {
      onFaceSelect(targetFace);
      console.log(`🎯 GUARANTEED SYSTEM - Panel ${targetFace} confirmed:`, {
        confirmedFace: targetFace,
        method: 'right-click',
        wasInCycle: faceCycleState.selectedFace !== null,
        guaranteedLastPanelShrinks: true,
        previousPanelsStayFullSize: true,
      });

      // Reset cycle state after confirmation
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

  // Get face color based on state
  const getFaceColor = (faceIndex: number) => {
    if (faceCycleState.selectedFace === faceIndex) return '#fbbf24'; // YELLOW for currently selected face in cycle
    if (selectedFaces.includes(faceIndex)) return '#10b981'; // Green for confirmed selected
    if (hoveredFace === faceIndex) return '#eeeeee'; // Gray for hovered
    return '#3b82f6'; // Blue for default
  };

  // Get face opacity - ALL FACES VISIBLE IN PANEL MODE
  const getFaceOpacity = (faceIndex: number) => {
    if (faceCycleState.selectedFace === faceIndex) return 0.8; // High visibility for cycling face
    if (selectedFaces.includes(faceIndex)) return 0.0; // Medium visibility for confirmed selected
    if (hoveredFace === faceIndex) return 0.0; // Low visibility for hovered
    return 0.001; // Very low but visible for all other faces
  };

  // 🎨 PROFESSIONAL EDGE LINE WIDTH - Sharp and clear
  const getPanelEdgeLineWidth = () => {
    const screenWidth = window.innerWidth;

    if (screenWidth < 768) {
      // Mobile/Tablet
      return 1.0; // Clear visibility on mobile
    } else if (screenWidth < 1024) {
      // Small desktop
      return 1.5; // Professional thickness
    } else {
      // Large desktop
      return 2.0; // Sharp professional edges
    }
  };

  // 🎯 ALWAYS SHOW PANELS - Show panels regardless of mode when alwaysShowPanels is true
  if (
    (!isAddPanelMode && !alwaysShowPanels && !isPanelEditMode) ||
    shape.type !== 'box'
  ) {
    return null;
  }

  return (
    <group>
      {/* Individual face overlays for panel mode - ALL FACES VISIBLE */}
      {showFaces &&
        faceGeometries.map((geometry, faceIndex) => {
          const opacity = getFaceOpacity(faceIndex);

          return (
            <mesh
              key={`face-${faceIndex}`}
              geometry={geometry}
              position={[
                shape.position[0] + faceTransforms[faceIndex].position[0],
                shape.position[1] + faceTransforms[faceIndex].position[1],
                shape.position[2] + faceTransforms[faceIndex].position[2],
              ]}
              rotation={[
                shape.rotation[0] + faceTransforms[faceIndex].rotation[0],
                shape.rotation[1] + faceTransforms[faceIndex].rotation[1],
                shape.rotation[2] + faceTransforms[faceIndex].rotation[2],
              ]}
              scale={shape.scale}
              onClick={(e) => handleClick(e, faceIndex)}
              onContextMenu={(e) => handleContextMenu(e, faceIndex)}
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
          {/* 🔴 NEW: Conditional material based on edit mode and view mode */}
          {isPanelEditMode ? (
            <meshPhysicalMaterial
              color="#dc2626" // RED color for edit mode
              roughness={0.6}
              metalness={0.02}
              transparent={viewMode === ViewMode.TRANSPARENT} // Make transparent if in transparent view
              opacity={viewMode === ViewMode.TRANSPARENT ? 0.3 : 1.0} // Adjust opacity
              depthWrite={viewMode === ViewMode.SOLID} // Disable depth write in transparent
            />
          ) : (
            <meshPhysicalMaterial
              {...getPanelMaterial(panelData.faceIndex).parameters} // Copy parameters from original material
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
          // Show edges if wireframe, in edit mode or selected
          visible={
            viewMode === ViewMode.WIREFRAME ||
            isPanelEditMode ||
            selectedFaces.includes(panelData.faceIndex)
          }
        >
          <lineBasicMaterial
            color={isPanelEditMode ? '#7f1d1d' : getPanelEdgeColor()} // 🔴 NEW: Dark red edges in edit mode
            linewidth={getPanelEdgeLineWidth()}
            transparent={
              viewMode === ViewMode.TRANSPARENT ||
              viewMode === ViewMode.WIREFRAME
            }
            opacity={viewMode === ViewMode.TRANSPARENT ? 0.5 : 1.0}
            depthTest={viewMode === ViewMode.SOLID} // Enable depth test only in solid mode
          />
        </lineSegments>
      ))}
    </group>
  );
};

export default PanelManager;
