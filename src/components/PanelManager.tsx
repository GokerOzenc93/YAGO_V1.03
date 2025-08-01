import React, { useMemo, useState, useCallback } from 'react';
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
  // NEW: Face selection callbacks
  onShowFaceSelection?: (faces: FaceSelectionOption[], position: { x: number; y: number }) => void;
  onHideFaceSelection?: () => void;
  onSelectFace?: (faceIndex: number) => void;
  // NEW: Dynamic face selection props
  onDynamicFaceSelect?: (faceIndex: number) => void;
  selectedDynamicFace?: number | null;
  isDynamicSelectionMode?: boolean;
}

// NEW: Geometric face detection system
interface GeometricFace {
  index: number;
  center: THREE.Vector3;
  normal: THREE.Vector3;
  area: number;
  vertices: THREE.Vector3[];
  bounds: THREE.Box3;
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
  onShowFaceSelection,
  onHideFaceSelection,
  onSelectFace,
  onDynamicFaceSelect,
  selectedDynamicFace,
  isDynamicSelectionMode = false,
}) => {
  const panelThickness = 18; // 18mm panel thickness

  const { viewMode } = useAppStore();

  // NEW: Geometric face detection
  const geometricFaces = useMemo(() => {
    if (shape.type !== 'box') return [];
    
    const { width = 500, height = 500, depth = 500 } = shape.parameters;
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;
    
    const faces: GeometricFace[] = [
      // Front face (0)
      {
        index: 0,
        center: new THREE.Vector3(0, 0, hd),
        normal: new THREE.Vector3(0, 0, 1),
        area: width * height,
        vertices: [
          new THREE.Vector3(-hw, -hh, hd),
          new THREE.Vector3(hw, -hh, hd),
          new THREE.Vector3(hw, hh, hd),
          new THREE.Vector3(-hw, hh, hd)
        ],
        bounds: new THREE.Box3(
          new THREE.Vector3(-hw, -hh, hd - 1),
          new THREE.Vector3(hw, hh, hd + 1)
        )
      },
      // Back face (1)
      {
        index: 1,
        center: new THREE.Vector3(0, 0, -hd),
        normal: new THREE.Vector3(0, 0, -1),
        area: width * height,
        vertices: [
          new THREE.Vector3(hw, -hh, -hd),
          new THREE.Vector3(-hw, -hh, -hd),
          new THREE.Vector3(-hw, hh, -hd),
          new THREE.Vector3(hw, hh, -hd)
        ],
        bounds: new THREE.Box3(
          new THREE.Vector3(-hw, -hh, -hd - 1),
          new THREE.Vector3(hw, hh, -hd + 1)
        )
      },
      // Top face (2)
      {
        index: 2,
        center: new THREE.Vector3(0, hh, 0),
        normal: new THREE.Vector3(0, 1, 0),
        area: width * depth,
        vertices: [
          new THREE.Vector3(-hw, hh, -hd),
          new THREE.Vector3(hw, hh, -hd),
          new THREE.Vector3(hw, hh, hd),
          new THREE.Vector3(-hw, hh, hd)
        ],
        bounds: new THREE.Box3(
          new THREE.Vector3(-hw, hh - 1, -hd),
          new THREE.Vector3(hw, hh + 1, hd)
        )
      },
      // Bottom face (3)
      {
        index: 3,
        center: new THREE.Vector3(0, -hh, 0),
        normal: new THREE.Vector3(0, -1, 0),
        area: width * depth,
        vertices: [
          new THREE.Vector3(-hw, -hh, hd),
          new THREE.Vector3(hw, -hh, hd),
          new THREE.Vector3(hw, -hh, -hd),
          new THREE.Vector3(-hw, -hh, -hd)
        ],
        bounds: new THREE.Box3(
          new THREE.Vector3(-hw, -hh - 1, -hd),
          new THREE.Vector3(hw, -hh + 1, hd)
        )
      },
      // Right face (4)
      {
        index: 4,
        center: new THREE.Vector3(hw, 0, 0),
        normal: new THREE.Vector3(1, 0, 0),
        area: height * depth,
        vertices: [
          new THREE.Vector3(hw, -hh, hd),
          new THREE.Vector3(hw, -hh, -hd),
          new THREE.Vector3(hw, hh, -hd),
          new THREE.Vector3(hw, hh, hd)
        ],
        bounds: new THREE.Box3(
          new THREE.Vector3(hw - 1, -hh, -hd),
          new THREE.Vector3(hw + 1, hh, hd)
        )
      },
      // Left face (5)
      {
        index: 5,
        center: new THREE.Vector3(-hw, 0, 0),
        normal: new THREE.Vector3(-1, 0, 0),
        area: height * depth,
        vertices: [
          new THREE.Vector3(-hw, -hh, -hd),
          new THREE.Vector3(-hw, -hh, hd),
          new THREE.Vector3(-hw, hh, hd),
          new THREE.Vector3(-hw, hh, -hd)
        ],
        bounds: new THREE.Box3(
          new THREE.Vector3(-hw - 1, -hh, -hd),
          new THREE.Vector3(-hw + 1, hh, hd)
        )
      }
    ];
    
    return faces;
  }, [shape.parameters]);

  // NEW: Find closest face to a 3D point using geometric calculations
  const findClosestFace = useCallback((worldPoint: THREE.Vector3): number | null => {
    if (geometricFaces.length === 0) return null;
    
    // Convert world point to local space (shape coordinate system)
    const shapePosition = new THREE.Vector3(...shape.position);
    const localPoint = worldPoint.clone().sub(shapePosition);
    
    let closestFace = -1;
    let minDistance = Infinity;
    
    geometricFaces.forEach((face) => {
      // Calculate distance from clicked point to face center
      const distanceToFaceCenter = localPoint.distanceTo(face.center);
      
      // Project point onto face plane
      const pointToFaceCenter = localPoint.clone().sub(face.center);
      const projectionDistance = pointToFaceCenter.dot(face.normal);
      const projectedPoint = localPoint.clone().sub(face.normal.clone().multiplyScalar(projectionDistance));
      
      // Check if projected point is within face bounds
      const isWithinBounds = face.bounds.containsPoint(projectedPoint);
      
      // Use distance to face center for closest face determination
      if (isWithinBounds && distanceToFaceCenter < minDistance) {
        minDistance = distanceToFaceCenter;
        closestFace = face.index;
        console.log(`🎯 Face ${face.index} - Distance: ${distanceToFaceCenter.toFixed(1)}, Within bounds: ${isWithinBounds}`);
      }
    });
    
    console.log(`🎯 Closest face found: ${closestFace} with distance: ${minDistance.toFixed(1)}`);
    return closestFace !== -1 ? closestFace : null;
  }, [geometricFaces, shape.position]);

  // NEW: Find next face in sequence (cycling through faces)
  const findNextFace = useCallback((currentFace: number): number => {
    if (geometricFaces.length === 0) return currentFace;
    
    // Get the last click position from global state
    const lastClickPosition = (window as any).lastClickPosition;
    if (!lastClickPosition) {
      return (currentFace + 1) % 6;
    }
    
    // Convert world point to local space
    const shapePosition = new THREE.Vector3(...shape.position);
    const localPoint = lastClickPosition.clone().sub(shapePosition);
    
    // Calculate distances from click point to all face centers
    const faceDistances = geometricFaces
      .filter(face => face.index !== currentFace) // Exclude current face
      .map(face => ({
        index: face.index,
        distance: localPoint.distanceTo(face.center),
        name: getFaceName(face.index)
      }))
      .sort((a, b) => a.distance - b.distance); // Sort by distance (closest first)
    
    console.log(`🎯 Face distances from click point:`, faceDistances.map(f => 
      `${f.name}(${f.index}): ${f.distance.toFixed(1)}mm`
    ).join(', '));
    
    // Find current face in the sorted list and get next one
    const currentIndex = faceDistances.findIndex(f => f.index === currentFace);
    const nextIndex = (currentIndex + 1) % faceDistances.length;
    
    const nextFace = faceDistances[nextIndex]?.index || faceDistances[0]?.index || (currentFace + 1) % 6;
    
    console.log(`🎯 Current face: ${currentFace}, Next closest face: ${nextFace}`);
    return nextFace;
  }, [geometricFaces]);

  // Helper function to get face name
  const getFaceName = (faceIndex: number): string => {
    const names = ['Front', 'Back', 'Top', 'Bottom', 'Right', 'Left'];
    return names[faceIndex] || `Face ${faceIndex}`;
  };

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

  // 🎯 NEW: Create preview panel for dynamically selected face
  const previewPanelData = useMemo(() => {
    if (!isAddPanelMode || selectedDynamicFace === null || shape.type !== 'box') return null;
    
    // Don't show preview if face already has a panel
    if (selectedFaces.includes(selectedDynamicFace)) return null;
    
    const faceIndex = selectedDynamicFace;
    const smartBounds = calculateSmartPanelBounds(
      faceIndex,
      [...selectedFaces, faceIndex], // Include current face in calculation
      selectedFaces.length // This would be the panel order
    );

    // 🎯 NEW: Create cut panel geometry (kesilmiş panel simülasyonu)
    const cutPanelGeometry = createCutPanelGeometry(
      smartBounds.finalSize,
      faceIndex,
      selectedFaces,
      shape.parameters
    );

    return {
      faceIndex,
      geometry: cutPanelGeometry,
      position: smartBounds.finalPosition,
      size: smartBounds.finalSize,
      panelOrder: selectedFaces.length,
      isCutPreview: true,
    };
  }, [isAddPanelMode, selectedDynamicFace, selectedFaces, shape.type, shape.parameters]);

  // 🎯 NEW: Create cut panel geometry with notches and cuts
  const createCutPanelGeometry = (
    panelSize: THREE.Vector3,
    faceIndex: number,
    existingPanels: number[],
    shapeParams: any
  ): THREE.BufferGeometry => {
    const { width = 500, height = 500, depth = 500 } = shapeParams;
    
    // Create base panel shape
    const shape = new THREE.Shape();
    const hw = panelSize.x / 2;
    const hh = panelSize.y / 2;
    const hd = panelSize.z / 2;
    
    // Define panel rectangle based on face orientation
    let panelWidth, panelHeight;
    
    switch (faceIndex) {
      case 0: // Front
      case 1: // Back
        panelWidth = panelSize.x;
        panelHeight = panelSize.y;
        break;
      case 2: // Top
      case 3: // Bottom
        panelWidth = panelSize.x;
        panelHeight = panelSize.z;
        break;
      case 4: // Right
      case 5: // Left
        panelWidth = panelSize.z;
        panelHeight = panelSize.y;
        break;
      default:
        panelWidth = panelSize.x;
        panelHeight = panelSize.y;
    }
    
    const pw = panelWidth / 2;
    const ph = panelHeight / 2;
    
    // Create main panel rectangle
    shape.moveTo(-pw, -ph);
    shape.lineTo(pw, -ph);
    shape.lineTo(pw, ph);
    shape.lineTo(-pw, ph);
    shape.closePath();
    
    // 🎯 ADD NOTCHES for intersecting panels (kesilmiş yerler)
    const notchDepth = panelThickness;
    const notchWidth = panelThickness;
    
    existingPanels.forEach((existingPanel) => {
      // Calculate where this panel would intersect with existing panels
      const intersection = calculatePanelIntersection(faceIndex, existingPanel, shapeParams);
      
      if (intersection) {
        // Create notch (kesik) at intersection point
        const notch = new THREE.Path();
        
        // Position notch based on intersection
        const notchX = intersection.x * (panelWidth / width);
        const notchY = intersection.y * (panelHeight / height);
        
        // Create rectangular notch
        notch.moveTo(notchX - notchWidth/2, notchY - notchDepth/2);
        notch.lineTo(notchX + notchWidth/2, notchY - notchDepth/2);
        notch.lineTo(notchX + notchWidth/2, notchY + notchDepth/2);
        notch.lineTo(notchX - notchWidth/2, notchY + notchDepth/2);
        notch.closePath();
        
        // Add notch as hole in main shape
        shape.holes.push(notch);
      }
    });
    
    // Create extruded geometry
    const extrudeSettings = {
      depth: panelSize.z,
      bevelEnabled: false,
      steps: 1,
    };
    
    try {
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      
      // Rotate geometry to match face orientation
      switch (faceIndex) {
        case 2: // Top
        case 3: // Bottom
          geometry.rotateX(-Math.PI / 2);
          break;
        case 4: // Right
        case 5: // Left
          geometry.rotateY(Math.PI / 2);
          break;
      }
      
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      
      return geometry;
    } catch (error) {
      console.warn('Failed to create cut panel geometry, using simple box:', error);
      return new THREE.BoxGeometry(panelSize.x, panelSize.y, panelSize.z);
    }
  };
  
  // 🎯 NEW: Calculate panel intersection points
  const calculatePanelIntersection = (
    faceIndex: number,
    existingPanelFace: number,
    shapeParams: any
  ): { x: number; y: number } | null => {
    const { width = 500, height = 500, depth = 500 } = shapeParams;
    
    // Define intersection logic between different faces
    const intersections: { [key: string]: { x: number; y: number } | null } = {
      // Front face intersections
      '0-2': { x: 0, y: height/2 - panelThickness/2 }, // Front-Top
      '0-3': { x: 0, y: -height/2 + panelThickness/2 }, // Front-Bottom
      '0-4': { x: width/2 - panelThickness/2, y: 0 }, // Front-Right
      '0-5': { x: -width/2 + panelThickness/2, y: 0 }, // Front-Left
      
      // Back face intersections
      '1-2': { x: 0, y: height/2 - panelThickness/2 }, // Back-Top
      '1-3': { x: 0, y: -height/2 + panelThickness/2 }, // Back-Bottom
      '1-4': { x: width/2 - panelThickness/2, y: 0 }, // Back-Right
      '1-5': { x: -width/2 + panelThickness/2, y: 0 }, // Back-Left
      
      // Top face intersections
      '2-0': { x: 0, y: depth/2 - panelThickness/2 }, // Top-Front
      '2-1': { x: 0, y: -depth/2 + panelThickness/2 }, // Top-Back
      '2-4': { x: width/2 - panelThickness/2, y: 0 }, // Top-Right
      '2-5': { x: -width/2 + panelThickness/2, y: 0 }, // Top-Left
      
      // Bottom face intersections
      '3-0': { x: 0, y: depth/2 - panelThickness/2 }, // Bottom-Front
      '3-1': { x: 0, y: -depth/2 + panelThickness/2 }, // Bottom-Back
      '3-4': { x: width/2 - panelThickness/2, y: 0 }, // Bottom-Right
      '3-5': { x: -width/2 + panelThickness/2, y: 0 }, // Bottom-Left
      
      // Right face intersections
      '4-0': { x: depth/2 - panelThickness/2, y: 0 }, // Right-Front
      '4-1': { x: -depth/2 + panelThickness/2, y: 0 }, // Right-Back
      '4-2': { x: 0, y: height/2 - panelThickness/2 }, // Right-Top
      '4-3': { x: 0, y: -height/2 + panelThickness/2 }, // Right-Bottom
      
      // Left face intersections
      '5-0': { x: -depth/2 + panelThickness/2, y: 0 }, // Left-Front
      '5-1': { x: depth/2 - panelThickness/2, y: 0 }, // Left-Back
      '5-2': { x: 0, y: height/2 - panelThickness/2 }, // Left-Top
      '5-3': { x: 0, y: -height/2 + panelThickness/2 }, // Left-Bottom
    };
    
    const key = `${faceIndex}-${existingPanelFace}`;
    return intersections[key] || null;
  };

  // Face positions and rotations for box - MOVED BEFORE CONDITIONAL RETURN
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

  // NEW: Handle dynamic face selection with geometric detection
  const handleDynamicClick = useCallback((e: any) => {
    if (!isAddPanelMode) return;
    
    e.stopPropagation();
    
    if (e.nativeEvent.button === 0) {
      // Left click - cycle through faces geometrically
      const intersectionPoint = e.point; // Get 3D intersection point
      
      if (selectedDynamicFace === null) {
        // First click - find closest face
        const closestFace = findClosestFace(intersectionPoint);
        if (closestFace !== null && onDynamicFaceSelect) {
          onDynamicFaceSelect(closestFace);
          console.log(`🎯 First click: Selected face ${closestFace} geometrically`);
        }
      } else {
        // Subsequent clicks - find next adjacent face
        const nextFace = findNextFace(selectedDynamicFace);
        if (onDynamicFaceSelect) {
          onDynamicFaceSelect(nextFace);
          console.log(`🎯 Next click: Cycled to face ${nextFace} from ${selectedDynamicFace}`);
        }
      }
    } else if (e.nativeEvent.button === 2) {
      // Right click - add panel to currently selected face
      if (selectedDynamicFace !== null) {
        onFaceSelect(selectedDynamicFace);
        console.log(`🎯 Right click: Added panel to face ${selectedDynamicFace}`);
      }
    }
  }, [isAddPanelMode, selectedDynamicFace, onDynamicFaceSelect, onFaceSelect, findClosestFace, findNextFace]);

  const handleClick = (e: any, faceIndex: number) => {
    // Dynamic selection is always active in panel mode
    if (isAddPanelMode) {
      handleDynamicClick(e);
      return;
    }
    
    if (isAddPanelMode && e.nativeEvent.button === 0) {
      e.stopPropagation();
      onFaceSelect(faceIndex);
    } else if (isPanelEditMode) {
      e.stopPropagation();
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
  };

  const handleFaceHover = (faceIndex: number | null) => {
    if ((isAddPanelMode || isPanelEditMode) && onFaceHover) {
      onFaceHover(faceIndex);
    }
  };

  const getFaceColor = (faceIndex: number) => {
    // Dynamic selection highlighting (always active in panel mode)
    if (isAddPanelMode && selectedDynamicFace === faceIndex) {
      return '#fbbf24'; // Yellow for dynamically selected face
    }
    if (selectedFaces.includes(faceIndex)) return '#10b981'; // Green for confirmed selected
    if (hoveredFace === faceIndex) return '#eeeeee'; // Gray for hovered
    return '#3b82f6'; // Blue for default
  };

  const getFaceOpacity = (faceIndex: number) => {
    // Dynamic selection visibility (always active in panel mode)
    if (isAddPanelMode && selectedDynamicFace === faceIndex) {
      return 0.7; // More visible for selected face
    }
    if (selectedFaces.includes(faceIndex)) return 0.0;
    if (hoveredFace === faceIndex) return 0.0;
    return 0.001;
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

  // 🎯 ALWAYS SHOW PANELS - Only hide if shape is not a box
  if (shape.type !== 'box') {
    return null;
  }

  return (
    <group>
      {/* Individual face overlays for panel mode - ALL FACES VISIBLE */}
      {(showFaces || isAddPanelMode) &&
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
              onContextMenu={(e) => {
                if (isAddPanelMode) {
                  handleDynamicClick(e);
                } else {
                  // Original right-click behavior for non-dynamic mode
                  e.stopPropagation();
                  e.nativeEvent.preventDefault();
                }
              }}
              onPointerEnter={() => handleFaceHover(faceIndex)}
              onPointerLeave={() => handleFaceHover(null)}
              userData={{ faceIndex }}
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

      {/* Wood panels with guaranteed sizing */}
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

      {/* 🎯 NEW: Preview panel for dynamically selected face (YELLOW) */}
      {previewPanelData && (
        <mesh
          key={`preview-panel-${previewPanelData.faceIndex}`}
          geometry={previewPanelData.geometry}
          position={[
            shape.position[0] + previewPanelData.position.x,
            shape.position[1] + previewPanelData.position.y,
            shape.position[2] + previewPanelData.position.z,
          ]}
          rotation={shape.rotation}
          scale={shape.scale}
          visible={viewMode !== ViewMode.WIREFRAME}
        >
          <meshPhysicalMaterial
            color="#fbbf24" // Sarı kesilmiş panel rengi
            roughness={0.6}
            metalness={0.02}
            transparent
            opacity={0.7}
            depthWrite={false}
          />
        </mesh>
      )}

      {/* Preview panel edges */}
      {previewPanelData && (
        <lineSegments
          key={`preview-panel-edges-${previewPanelData.faceIndex}`}
          geometry={new THREE.EdgesGeometry(previewPanelData.geometry)}
          position={[
            shape.position[0] + previewPanelData.position.x,
            shape.position[1] + previewPanelData.position.y,
            shape.position[2] + previewPanelData.position.z,
          ]}
          rotation={shape.rotation}
          scale={shape.scale}
        >
          <lineBasicMaterial
            color="#f59e0b" // Koyu sarı kesilmiş panel kenarları
            linewidth={2.0}
            transparent
            opacity={0.9}
            depthTest={false}
          />
        </lineSegments>
      )}

      {/* Panel edges */}
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