import React, { useMemo, useRef, useEffect, useCallback } from 'react';
import * as THREE from 'three';
import { useThree } from '@react-three/fiber'; // useThree hook for camera and renderer
import { Shape } from '../types/shapes';
import { ViewMode, useAppStore } from '../store/appStore';
import { PanelData, FaceCycleState } from '../types/panelTypes';

// Helper function to calculate shape dimensions
const calculateShapeDimensions = (shape: Shape) => {
  let width = 100, height = 100, depth = 100; // Default values
  
  if (shape.type === 'box' && shape.parameters) {
    width = shape.parameters.width || 100;
    height = shape.parameters.height || 100;
    depth = shape.parameters.depth || 100;
  } else if (shape.type === 'cylinder' && shape.parameters) {
    const radius = shape.parameters.radius || 50;
    width = radius * 2;
    depth = radius * 2;
    height = shape.parameters.height || 100;
  } else if (shape.type === 'sphere' && shape.parameters) {
    const radius = shape.parameters.radius || 50;
    width = radius * 2;
    height = radius * 2;
    depth = radius * 2;
  } else if (shape.type === 'polyline' && shape.geometry) {
    // Calculate bounding box for polyline
    const points = shape.geometry.points || [];
    if (points.length > 0) {
      let minX = points[0][0], maxX = points[0][0];
      let minY = points[0][1], maxY = points[0][1];
      let minZ = points[0][2] || 0, maxZ = points[0][2] || 0;
      
      points.forEach(point => {
        minX = Math.min(minX, point[0]);
        maxX = Math.max(maxX, point[0]);
        minY = Math.min(minY, point[1]);
        maxY = Math.max(maxY, point[1]);
        if (point[2] !== undefined) {
          minZ = Math.min(minZ, point[2]);
          maxZ = Math.max(maxZ, point[2]);
        }
      });
      
      width = maxX - minX;
      height = maxY - minY;
      depth = maxZ - minZ;
    }
  }
  
  // Apply scale
  width *= shape.scale[0];
  height *= shape.scale[1];
  depth *= shape.scale[2];
  
  return { width, height, depth };
};

interface PanelManagerProps {
  shape: Shape;
  isAddPanelMode: boolean;
  selectedPanels: number[]; // Array of face indices
  hoveredPanelId: string | null; // Now stores panel ID
  showEdges: boolean;
  showFaces: boolean;
  onPanelSelect: (panel: PanelData) => void; // Updated to pass PanelData
  onPanelHover: (panelId: string | null) => void; // Updated to pass panel ID
  // Face cycle indicator props (will be adapted for dynamic panels)
  onFaceCycleUpdate?: (cycleState: FaceCycleState) => void;
  // Face cycling state from parent
  faceCycleState: FaceCycleState;
  setFaceCycleState: React.Dispatch<React.SetStateAction<FaceCycleState>>;
  alwaysShowPanels?: boolean;
  isPanelEditMode?: boolean;
  onPanelEditSelect?: (panelData: PanelData) => void; // Updated for editing
}

const PanelManager: React.FC<PanelManagerProps> = ({
  shape,
  isAddPanelMode,
  selectedPanels,
  hoveredPanelId,
  showEdges,
  showFaces,
  onPanelSelect,
  onPanelHover,
  onFaceCycleUpdate, // Will be adapted
  faceCycleState, // Will be adapted
  setFaceCycleState, // Will be adapted
  alwaysShowPanels = false,
  isPanelEditMode = false,
  onPanelEditSelect,
}) => {
  // Convert face indices to PanelData objects
  const panelDataArray = useMemo(() => {
    if (!selectedPanels || !Array.isArray(selectedPanels)) {
      return [];
    }
    
    return selectedPanels.map((faceIndex) => {
      // Generate PanelData from face index
      const panelData = generatePanelDataFromFace(shape, faceIndex);
      return panelData;
    });
  }, [selectedPanels, shape]);

  const panelThickness = 18; // 18mm panel thickness
  const { viewMode } = useAppStore();
  const { camera, gl, scene } = useThree(); // Access Three.js camera and renderer
  const meshRef = useRef<THREE.Mesh>(null); // Reference to the main shape mesh

  // Helper function to generate PanelData from face index
  const generatePanelDataFromFace = useCallback((shape: Shape, faceIndex: number): PanelData => {
    const { width, height, depth } = calculateShapeDimensions(shape);
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;

    // Define face configurations
    const faceConfigs = [
      { name: 'Front', position: [0, 0, hd], rotation: [0, 0, 0], size: [width, height, panelThickness] },
      { name: 'Back', position: [0, 0, -hd], rotation: [0, Math.PI, 0], size: [width, height, panelThickness] },
      { name: 'Right', position: [hw, 0, 0], rotation: [0, Math.PI/2, 0], size: [depth, height, panelThickness] },
      { name: 'Left', position: [-hw, 0, 0], rotation: [0, -Math.PI/2, 0], size: [depth, height, panelThickness] },
      { name: 'Top', position: [0, hh, 0], rotation: [-Math.PI/2, 0, 0], size: [width, depth, panelThickness] },
      { name: 'Bottom', position: [0, -hh, 0], rotation: [Math.PI/2, 0, 0], size: [width, depth, panelThickness] },
    ];

    const config = faceConfigs[faceIndex] || faceConfigs[0];
    
    return {
      id: `face-${faceIndex}-${config.name.toLowerCase()}`,
      position: new THREE.Vector3(...config.position),
      rotation: new THREE.Euler(...config.rotation),
      size: new THREE.Vector3(...config.size),
      normal: new THREE.Vector3(0, 0, 1).applyEuler(new THREE.Euler(...config.rotation)),
    };
  }, [panelThickness]);

  // 🪵 BALANCED WOOD MATERIALS - Elegant but controlled reflections
  const woodMaterials = useMemo(() => {
    const textureLoader = new THREE.TextureLoader();

    const woodTexture = textureLoader.load(
      '[https://images.pexels.com/photos/6757411/pexels-photo-6757411.jpeg](https://images.pexels.com/photos/6757411/pexels-photo-6757411.jpeg)'
    );
    woodTexture.wrapS = THREE.RepeatWrapping;
    woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(0.64, 0.64);
    woodTexture.anisotropy = 8;

    const woodNormalMap = textureLoader.load(
      '[https://images.pexels.com/photos/6757411/pexels-photo-6757411.jpeg](https://images.pexels.com/photos/6757411/pexels-photo-6757411.jpeg)'
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

  // Helper to get panel material based on its normal (determining orientation)
  const getPanelMaterial = useCallback((normal: THREE.Vector3) => {
    // Determine if the panel is more horizontal (top/bottom) or vertical (sides)
    const angleToYAxis = normal.angleTo(new THREE.Vector3(0, 1, 0));
    const angleToXAxis = normal.angleTo(new THREE.Vector3(1, 0, 0));
    const angleToZAxis = normal.angleTo(new THREE.Vector3(0, 0, 1));

    // If normal is mostly along Y-axis (top/bottom), use horizontal grain
    if (Math.abs(angleToYAxis) < Math.PI / 4 || Math.abs(angleToYAxis - Math.PI) < Math.PI / 4) {
      return woodMaterials.horizontal;
    }
    // Otherwise, use vertical grain
    return woodMaterials.vertical;
  }, [woodMaterials]);

  // NEW: Get panel edge color based on view mode
  const getPanelEdgeColor = () => {
    switch (viewMode) {
      case ViewMode.WIREFRAME:
        return '#ffffff'; // Beyaz kenarlar tel kafes modunda
      case ViewMode.TRANSPARENT:
        return '#000000'; // Şeffaf modda siyah kenarlar
      case ViewMode.SOLID:
        return '#2a2a2a'; // Katı modda koyu gri
      default:
        return '#2a2a2a';
    }
  };

  // 🎨 PROFESSIONAL EDGE LINE WIDTH - Sharp and clear
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

  // 🎯 RAYCASTING FOR DYNAMIC FACE DETECTION
  const raycaster = useMemo(() => new THREE.Raycaster(), []);
  const mouse = useMemo(() => new THREE.Vector2(), []);

  // Function to get overlapping faces at mouse position using raycasting
  const getOverlappingFacesAtPosition = useCallback(
    (clientX: number, clientY: number): PanelData[] => {
      // Normalize mouse coordinates to [-1, 1]
      mouse.x = (clientX / window.innerWidth) * 2 - 1;
      mouse.y = -(clientY / window.innerHeight) * 2 + 1;

      raycaster.setFromCamera(mouse, camera);

      const intersections: THREE.Intersection[] = [];

      // If the main shape mesh exists, intersect with it
      if (meshRef.current) {
        raycaster.intersectObject(meshRef.current, true, intersections);
      }

      const detectedPanels: PanelData[] = [];

      // Process intersections to create PanelData
      intersections.forEach((intersection) => {
        if (intersection.face && intersection.object === meshRef.current) {
          const point = intersection.point.clone();
          const normal = intersection.face.normal.clone();

          // Transform normal to world coordinates
          normal.transformDirection(meshRef.current.matrixWorld);

          // Calculate a unique ID for the face/panel
          const id = `${normal.x.toFixed(2)}-${normal.y.toFixed(2)}-${normal.z.toFixed(2)}-${point.x.toFixed(2)}-${point.y.toFixed(2)}-${point.z.toFixed(2)}`;

          // Calculate rotation for the panel to align with the face normal
          const quaternion = new THREE.Quaternion();
          const upVector = new THREE.Vector3(0, 1, 0); // Default up
          quaternion.setFromUnitVectors(upVector, normal);
          const rotation = new THREE.Euler().setFromQuaternion(quaternion);

          // For simplicity, let's assume a default panel size for now.
          // In a real application, you'd calculate this based on the intersected face's actual dimensions.
          // This is a placeholder for dynamic size calculation.
          const panelSize = new THREE.Vector3(100, 100, panelThickness);

          // Offset the panel slightly along the normal to avoid z-fighting
          const panelPosition = point.clone().add(normal.multiplyScalar(panelThickness / 2));

          detectedPanels.push({
            id,
            position: panelPosition,
            rotation,
            size: panelSize,
            normal,
          });
        }
      });

      // Filter out duplicate panels (e.g., if multiple triangles form one logical face)
      const uniquePanels: PanelData[] = [];
      const uniqueIds = new Set<string>();
      detectedPanels.forEach(panel => {
        if (!uniqueIds.has(panel.id)) {
          uniqueIds.add(panel.id);
          uniquePanels.push(panel);
        }
      });

      console.log(`🎯 OVERLAPPING FACES DETECTED (Raycasting):`, {
        mousePosition: { x: clientX, y: clientY },
        detectedPanels: uniquePanels.map(p => ({
          id: p.id,
          pos: p.position.toArray().map(v => v.toFixed(1)),
          normal: p.normal.toArray().map(v => v.toFixed(2))
        })),
        panelCount: uniquePanels.length,
      });

      return uniquePanels;
    },
    [camera, raycaster, mouse, panelThickness]
  );

  const handleClick = useCallback(
    (event: MouseEvent) => {
      if (!isAddPanelMode && !isPanelEditMode) return;

      event.stopPropagation();

      const mouseX = event.clientX;
      const mouseY = event.clientY;

      const overlappingPanels = getOverlappingFacesAtPosition(mouseX, mouseY);

      // 🔴 NEW: Panel Edit Mode - Click on panels to edit them
      if (isPanelEditMode) {
        const clickedPanel = overlappingPanels.find(panel =>
          selectedPanels.some(sp => sp.id === panel.id)
        );
        if (clickedPanel && onPanelEditSelect) {
          onPanelEditSelect(clickedPanel);
          console.log(`🔴 Panel ${clickedPanel.id} selected for editing`);
        }
        return;
      }

      // Left click - ENHANCED FACE CYCLING SYSTEM (only in add panel mode)
      if (isAddPanelMode && event.button === 0) {
        if (overlappingPanels.length === 0) {
          console.log('🎯 NO FACES DETECTED at this position');
          return;
        }

        const isSamePosition =
          faceCycleState.mousePosition &&
          Math.abs(faceCycleState.mousePosition.x - mouseX) < 50 &&
          Math.abs(faceCycleState.mousePosition.y - mouseY) < 50;

        if (!isSamePosition || faceCycleState.availableFaces.length === 0) {
          // NEW POSITION - Start new cycle
          const faceIndices = overlappingPanels.map((_, index) => index);
          setFaceCycleState({
            availableFaces: faceIndices,
            currentIndex: 0,
            selectedFace: 0,
            mousePosition: { x: mouseX, y: mouseY },
          });

          console.log(`🎯 NEW FACE CYCLE STARTED:`, {
            position: { x: mouseX, y: mouseY },
            availableFaces: faceIndices,
            selectedFace: 0,
            totalFaces: overlappingPanels.length,
          });
        } else {
          // SAME POSITION - Continue cycling through faces
          const nextIndex =
            (faceCycleState.currentIndex + 1) %
            faceCycleState.availableFaces.length;
          const nextFaceIndex = faceCycleState.availableFaces[nextIndex];

          setFaceCycleState((prev) => ({
            ...prev,
            currentIndex: nextIndex,
            selectedFace: nextFaceIndex,
          }));

          console.log(`🎯 FACE CYCLE CONTINUED:`, {
            previousFace: faceCycleState.selectedFace,
            newFace: nextFaceIndex,
            cycleIndex: `${nextIndex + 1}/${
              faceCycleState.availableFaces.length
            }`,
            availableFaces: faceCycleState.availableFaces,
          });
        }
      }
    },
    [isAddPanelMode, isPanelEditMode, getOverlappingFacesAtPosition, faceCycleState, setFaceCycleState, selectedPanels, onPanelEditSelect]
  );

  const handleContextMenu = useCallback(
    (event: MouseEvent) => {
      if (!isAddPanelMode) return;

      event.stopPropagation();
      event.preventDefault();

      const targetFaceIndex = faceCycleState.selectedFace;

      if (targetFaceIndex !== null && onPanelSelect) {
        const targetPanel = generatePanelDataFromFace(shape, targetFaceIndex);
        onPanelSelect(targetPanel);
        console.log(`🎯 GUARANTEED SYSTEM - Panel ${targetPanel.id} confirmed:`, {
          confirmedPanel: targetPanel.id,
          method: 'right-click',
          faceIndex: targetFaceIndex,
        });

        // Reset cycle state after confirmation
        setFaceCycleState({
          availableFaces: [],
          currentIndex: 0,
          selectedFace: null,
          mousePosition: null,
        });
      }
    },
    [isAddPanelMode, faceCycleState.selectedFace, onPanelSelect, setFaceCycleState, shape, generatePanelDataFromFace]
  );

  const handlePointerMove = useCallback(
    (event: MouseEvent) => {
      if (!(isAddPanelMode || isPanelEditMode) || !onPanelHover) return;

      const mouseX = event.clientX;
      const mouseY = event.clientY;

      const overlappingFaces = getOverlappingFacesAtPosition(mouseX, mouseY);

      if (overlappingFaces.length > 0) {
        // For simplicity, just hover the first detected panel
        const firstFacePanel = overlappingPanels[0];
        onPanelHover(firstFacePanel.id);
      } else {
        onPanelHover(null);
      }
    },
    [isAddPanelMode, isPanelEditMode, onPanelHover, getOverlappingFacesAtPosition, shape, generatePanelDataFromFace]
  );

  useEffect(() => {
    // Attach event listeners to the canvas element
    const canvas = gl.domElement;
    canvas.addEventListener('click', handleClick);
    canvas.addEventListener('contextmenu', handleContextMenu);
    canvas.addEventListener('mousemove', handlePointerMove);

    return () => {
      canvas.removeEventListener('click', handleClick);
      canvas.removeEventListener('contextmenu', handleContextMenu);
      canvas.removeEventListener('mousemove', handlePointerMove);
    };
  }, [gl, handleClick, handleContextMenu, handlePointerMove]);

  // Get face color based on state (now for dynamic panels)
  const getPanelOverlayColor = (faceIndex: number) => {
    if (faceCycleState.selectedFace === faceIndex) return '#fbbf24'; // YELLOW for currently selected face in cycle
    if (selectedPanels.includes(faceIndex)) return '#10b981'; // Green for confirmed selected
    const panel = generatePanelDataFromFace(shape, faceIndex);
    if (hoveredPanelId === panel.id) return '#eeeeee'; // Gray for hovered
    return '#3b82f6'; // Blue for default (should rarely be seen if opacity is low)
  };

  // Get face opacity - ALL FACES VISIBLE IN PANEL MODE
  const getPanelOverlayOpacity = (faceIndex: number) => {
    if (faceCycleState.selectedFace === faceIndex) return 0.8; // High visibility for cycling face
    if (selectedPanels.includes(faceIndex)) return 0.0; // Confirmed panels are now actual meshes, so overlay can be hidden
    const panel = generatePanelDataFromFace(shape, faceIndex);
    if (hoveredPanelId === panel.id) return 0.0; // Hovered panels are now actual meshes, so overlay can be hidden
    return 0.001; // Very low but visible for all other faces
  };

  // Generate the main shape's geometry
  const shapeGeometry = useMemo(() => {
    if (shape.type === 'box') {
      const { width = 500, height = 500, depth = 500 } = shape.parameters;
      return new THREE.BoxGeometry(width, height, depth);
    }
    // Add other shape types here (e.g., SphereGeometry, CylinderGeometry)
    // For now, return a default if type is not box
    return new THREE.BoxGeometry(100, 100, 100); // Fallback
  }, [shape]);

  // Main shape mesh - this is what we will raycast against
  const mainShapeMesh = useMemo(() => {
    const material = new THREE.MeshBasicMaterial({
      color: 0x888888, // A neutral color for the base shape
      transparent: true,
      opacity: 0.2, // Slightly transparent to see through
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(shapeGeometry, material);
    mesh.position.set(shape.position[0], shape.position[1], shape.position[2]);
    mesh.rotation.set(shape.rotation[0], shape.rotation[1], shape.rotation[2]);
    mesh.scale.set(shape.scale[0], shape.scale[1], shape.scale[2]);
    mesh.name = "mainShape"; // Give it a name for identification
    return mesh;
  }, [shape, shapeGeometry]);

  // Add/remove main shape mesh to/from scene
  useEffect(() => {
    if (meshRef.current) {
      scene.remove(meshRef.current);
    }
    meshRef.current = mainShapeMesh;
    scene.add(mainShapeMesh);

    return () => {
      if (meshRef.current) {
        scene.remove(meshRef.current);
      }
    };
  }, [mainShapeMesh, scene]);

  // Create overlay meshes for dynamic face visualization (for hovering/cycling)
  // This will be more complex as we need to generate a plane for each detected face
  // For now, we will rely on the actual panel meshes for selection feedback.
  // If you need to visualize *all* potential faces of a complex mesh, you'd need to
  // iterate through its geometry's faces and create temporary meshes.
  // For this dynamic approach, the "face overlays" are effectively the panels themselves
  // when they are in the "hovered" or "cycling" state.

  return (
    <group>
      {/* Render the main shape (the object we are adding panels to) */}
      {/* The actual mesh is added to the scene via useEffect and meshRef */}

      {/* Render dynamically generated panels */}
      {panelDataArray.map((panelData) => (
        <mesh
          key={`panel-${panelData.id}`}
          position={panelData.position}
          rotation={panelData.rotation}
          castShadow
          receiveShadow
          visible={viewMode !== ViewMode.WIREFRAME}
          onClick={(e) => {
            if (isPanelEditMode) {
              e.stopPropagation();
              if (onPanelEditSelect) {
                onPanelEditSelect(panelData);
                console.log(`🔴 Panel ${panelData.id} clicked for editing`);
              }
            }
          }}
        >
          <boxGeometry
            args={[
              panelData.size.x,
              panelData.size.y,
              panelData.size.z,
            ]}
          />
          {isPanelEditMode ? (
            <meshPhysicalMaterial
              color="#dc2626" // Kırmızı renk düzenleme modunda
              roughness={0.6}
              metalness={0.02}
              transparent={viewMode === ViewMode.TRANSPARENT}
              opacity={viewMode === ViewMode.TRANSPARENT ? 0.3 : 1.0}
              depthWrite={viewMode === ViewMode.SOLID}
            />
          ) : (
            <meshPhysicalMaterial
              {...getPanelMaterial(panelData.normal).parameters} // Normal'e göre malzeme seçimi
              transparent={viewMode === ViewMode.TRANSPARENT}
              opacity={viewMode === ViewMode.TRANSPARENT ? 0.3 : 1.0}
              depthWrite={viewMode === ViewMode.SOLID}
            />
          )}
        </mesh>
      ))}

      {/* Render edges for dynamically generated panels */}
      {panelDataArray.map((panelData) => (
        <lineSegments
          key={`panel-edges-${panelData.id}`}
          position={panelData.position}
          rotation={panelData.rotation}
          visible={
            viewMode === ViewMode.WIREFRAME ||
            isPanelEditMode ||
            true
          }
        >
          <edgesGeometry
            args={[
              new THREE.BoxGeometry(
                panelData.size.x,
                panelData.size.y,
                panelData.size.z
              ),
            ]}
          />
          <lineBasicMaterial
            color={isPanelEditMode ? '#7f1d1d' : getPanelEdgeColor()} // Koyu kırmızı kenarlar düzenleme modunda
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

      {/* Render the currently cycling/hovered panel as an overlay */}
      {isAddPanelMode && faceCycleState.selectedFace !== null && (
        (() => {
          const selectedPanel = generatePanelDataFromFace(shape, faceCycleState.selectedFace);
          return (
        <mesh
          position={selectedPanel.position}
          rotation={selectedPanel.rotation}
          // Scale slightly larger to make it visible as an overlay
          scale={[1.01, 1.01, 1.01]}
        >
          <boxGeometry
            args={[
              selectedPanel.size.x,
              selectedPanel.size.y,
              selectedPanel.size.z,
            ]}
          />
          <meshBasicMaterial
            color={getPanelOverlayColor(faceCycleState.selectedFace)}
            transparent
            opacity={getPanelOverlayOpacity(faceCycleState.selectedFace)}
            side={THREE.DoubleSide}
            depthTest={false} // Ensure it's always visible
          />
        </mesh>
          );
        })()
      )}
    </group>
  );
};

export default PanelManager;
