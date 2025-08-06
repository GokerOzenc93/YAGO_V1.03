import React, { useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { useAppStore } from '../store/appStore';

// Helper function to create box faces - MUST be declared before component
const createBoxFaces4 = (shape: Shape) => {
  if (shape.type !== 'box') return [];
  
  const { width = 500, height = 500, depth = 500 } = shape.parameters;
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;
  
  return [
    {
      index: 0,
      name: 'Front',
      center: new THREE.Vector3(0, 0, hd),
      normal: new THREE.Vector3(0, 0, 1),
      corners: [
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, hh, hd),
        new THREE.Vector3(-hw, hh, hd)
      ],
      area: width * height
    },
    {
      index: 1,
      name: 'Back',
      center: new THREE.Vector3(0, 0, -hd),
      normal: new THREE.Vector3(0, 0, -1),
      corners: [
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(-hw, hh, -hd),
        new THREE.Vector3(hw, hh, -hd)
      ],
      area: width * height
    },
    {
      index: 2,
      name: 'Top',
      center: new THREE.Vector3(0, hh, 0),
      normal: new THREE.Vector3(0, 1, 0),
      corners: [
        new THREE.Vector3(-hw, hh, hd),
        new THREE.Vector3(hw, hh, hd),
        new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(-hw, hh, -hd)
      ],
      area: width * depth
    },
    {
      index: 3,
      name: 'Bottom',
      center: new THREE.Vector3(0, -hh, 0),
      normal: new THREE.Vector3(0, -1, 0),
      corners: [
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(-hw, -hh, hd)
      ],
      area: width * depth
    },
    {
      index: 4,
      name: 'Right',
      center: new THREE.Vector3(hw, 0, 0),
      normal: new THREE.Vector3(1, 0, 0),
      corners: [
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(hw, hh, hd)
      ],
      area: height * depth
    },
    {
      index: 5,
      name: 'Left',
      center: new THREE.Vector3(-hw, 0, 0),
      normal: new THREE.Vector3(-1, 0, 0),
      corners: [
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(-hw, hh, hd),
        new THREE.Vector3(-hw, hh, -hd)
      ],
      area: height * depth
    }
  ];
};

// Helper function to create box faces for traditional box/rectangle shapes
const createBoxFaces3 = (shape: Shape): FaceInfo[] => {
  const { width = 500, height = 500, depth = 500 } = shape.parameters;
  const [scaleX, scaleY, scaleZ] = shape.scale;
  
  // Apply scale to dimensions
  const scaledWidth = width * scaleX;
  const scaledHeight = height * scaleY;
  const scaledDepth = depth * scaleZ;
  
  const hw = scaledWidth / 2;
  const hh = scaledHeight / 2;
  const hd = scaledDepth / 2;
  
  console.log(`🎯 createBoxFaces3 - Creating faces for ${shape.type}:`, {
    originalDimensions: { width, height, depth },
    scale: shape.scale,
    scaledDimensions: { scaledWidth, scaledHeight, scaledDepth }
  });
  
  return [
    {
      id: 0,
      name: 'Front',
      description: 'Front face (positive Z)',
      center: new THREE.Vector3(0, 0, hd),
      normal: new THREE.Vector3(0, 0, 1),
      area: scaledWidth * scaledHeight,
      vertices: [
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, hh, hd),
        new THREE.Vector3(-hw, hh, hd)
      ],
      bounds: {
        min: new THREE.Vector3(-hw, -hh, hd),
        max: new THREE.Vector3(hw, hh, hd)
      }
    },
    {
      id: 1,
      name: 'Back',
      description: 'Back face (negative Z)',
      center: new THREE.Vector3(0, 0, -hd),
      normal: new THREE.Vector3(0, 0, -1),
      area: scaledWidth * scaledHeight,
      vertices: [
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(-hw, hh, -hd),
        new THREE.Vector3(hw, hh, -hd)
      ],
      bounds: {
        min: new THREE.Vector3(-hw, -hh, -hd),
        max: new THREE.Vector3(hw, hh, -hd)
      }
    },
    {
      id: 2,
      name: 'Top',
      description: 'Top face (positive Y)',
      center: new THREE.Vector3(0, hh, 0),
      normal: new THREE.Vector3(0, 1, 0),
      area: scaledWidth * scaledDepth,
      vertices: [
        new THREE.Vector3(-hw, hh, -hd),
        new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(hw, hh, hd),
        new THREE.Vector3(-hw, hh, hd)
      ],
      bounds: {
        min: new THREE.Vector3(-hw, hh, -hd),
        max: new THREE.Vector3(hw, hh, hd)
      }
    },
    {
      id: 3,
      name: 'Bottom',
      description: 'Bottom face (negative Y)',
      center: new THREE.Vector3(0, -hh, 0),
      normal: new THREE.Vector3(0, -1, 0),
      area: scaledWidth * scaledDepth,
      vertices: [
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, -hd)
      ],
      bounds: {
        min: new THREE.Vector3(-hw, -hh, -hd),
        max: new THREE.Vector3(hw, -hh, hd)
      }
    },
    {
      id: 4,
      name: 'Right',
      description: 'Right face (positive X)',
      center: new THREE.Vector3(hw, 0, 0),
      normal: new THREE.Vector3(1, 0, 0),
      area: scaledDepth * scaledHeight,
      vertices: [
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(hw, hh, hd)
      ],
      bounds: {
        min: new THREE.Vector3(hw, -hh, -hd),
        max: new THREE.Vector3(hw, hh, hd)
      }
    },
    {
      id: 5,
      name: 'Left',
      description: 'Left face (negative X)',
      center: new THREE.Vector3(-hw, 0, 0),
      normal: new THREE.Vector3(-1, 0, 0),
      area: scaledDepth * scaledHeight,
      vertices: [
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(-hw, hh, hd),
        new THREE.Vector3(-hw, hh, -hd)
      ],
      bounds: {
        min: new THREE.Vector3(-hw, -hh, -hd),
        max: new THREE.Vector3(-hw, hh, hd)
      }
    }
  ];
};

// Helper function to create box faces - moved to top to avoid hoisting issues
const createBoxFaces2 = (width: number, height: number, depth: number) => {
  const hw = width / 2;
  const hh = height / 2;
  const hd = depth / 2;

  return [
    {
      id: 0,
      name: 'Front',
      normal: new THREE.Vector3(0, 0, 1),
      center: new THREE.Vector3(0, 0, hd),
      width: width,
      height: height,
      vertices: [
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, hh, hd),
        new THREE.Vector3(-hw, hh, hd),
      ],
    },
    {
      id: 1,
      name: 'Back',
      normal: new THREE.Vector3(0, 0, -1),
      center: new THREE.Vector3(0, 0, -hd),
      width: width,
      height: height,
      vertices: [
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(-hw, hh, -hd),
        new THREE.Vector3(hw, hh, -hd),
      ],
    },
    {
      id: 2,
      name: 'Top',
      normal: new THREE.Vector3(0, 1, 0),
      center: new THREE.Vector3(0, hh, 0),
      width: width,
      height: depth,
      vertices: [
        new THREE.Vector3(-hw, hh, -hd),
        new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(hw, hh, hd),
        new THREE.Vector3(-hw, hh, hd),
      ],
    },
    {
      id: 3,
      name: 'Bottom',
      normal: new THREE.Vector3(0, -1, 0),
      center: new THREE.Vector3(0, -hh, 0),
      width: width,
      height: depth,
      vertices: [
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, -hd),
      ],
    },
    {
      id: 4,
      name: 'Right',
      normal: new THREE.Vector3(1, 0, 0),
      center: new THREE.Vector3(hw, 0, 0),
      width: depth,
      height: height,
      vertices: [
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(hw, hh, hd),
      ],
    },
    {
      id: 5,
      name: 'Left',
      normal: new THREE.Vector3(-1, 0, 0),
      center: new THREE.Vector3(-hw, 0, 0),
      width: depth,
      height: height,
      vertices: [
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(-hw, hh, hd),
        new THREE.Vector3(-hw, hh, -hd),
      ],
    },
  ];
};

// Helper function to create box faces - moved to top to avoid initialization error
const createBoxFaces = (shape: Shape) => {
  const { width = 500, height = 500, depth = 500 } = shape.parameters;
  const scale = shape.scale || [1, 1, 1];
  
  // Apply scale to dimensions
  const scaledWidth = width * scale[0];
  const scaledHeight = height * scale[1];
  const scaledDepth = depth * scale[2];
  
  const hw = scaledWidth / 2;
  const hh = scaledHeight / 2;
  const hd = scaledDepth / 2;

  return [
    {
      id: 0,
      name: 'Front',
      description: 'Front face (positive Z)',
      normal: new THREE.Vector3(0, 0, 1),
      center: new THREE.Vector3(0, 0, hd),
      width: scaledWidth,
      height: scaledHeight,
      area: scaledWidth * scaledHeight,
      vertices: [
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, hh, hd),
        new THREE.Vector3(-hw, hh, hd)
      ]
    },
    {
      id: 1,
      name: 'Back',
      description: 'Back face (negative Z)',
      normal: new THREE.Vector3(0, 0, -1),
      center: new THREE.Vector3(0, 0, -hd),
      width: scaledWidth,
      height: scaledHeight,
      area: scaledWidth * scaledHeight,
      vertices: [
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(-hw, hh, -hd),
        new THREE.Vector3(hw, hh, -hd)
      ]
    },
    {
      id: 2,
      name: 'Top',
      description: 'Top face (positive Y)',
      normal: new THREE.Vector3(0, 1, 0),
      center: new THREE.Vector3(0, hh, 0),
      width: scaledWidth,
      height: scaledDepth,
      area: scaledWidth * scaledDepth,
      vertices: [
        new THREE.Vector3(-hw, hh, -hd),
        new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(hw, hh, hd),
        new THREE.Vector3(-hw, hh, hd)
      ]
    },
    {
      id: 3,
      name: 'Bottom',
      description: 'Bottom face (negative Y)',
      normal: new THREE.Vector3(0, -1, 0),
      center: new THREE.Vector3(0, -hh, 0),
      width: scaledWidth,
      height: scaledDepth,
      area: scaledWidth * scaledDepth,
      vertices: [
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, -hd)
      ]
    },
    {
      id: 4,
      name: 'Right',
      description: 'Right face (positive X)',
      normal: new THREE.Vector3(1, 0, 0),
      center: new THREE.Vector3(hw, 0, 0),
      width: scaledDepth,
      height: scaledHeight,
      area: scaledDepth * scaledHeight,
      vertices: [
        new THREE.Vector3(hw, -hh, hd),
        new THREE.Vector3(hw, -hh, -hd),
        new THREE.Vector3(hw, hh, -hd),
        new THREE.Vector3(hw, hh, hd)
      ]
    },
    {
      id: 5,
      name: 'Left',
      description: 'Left face (negative X)',
      normal: new THREE.Vector3(-1, 0, 0),
      center: new THREE.Vector3(-hw, 0, 0),
      width: scaledDepth,
      height: scaledHeight,
      area: scaledDepth * scaledHeight,
      vertices: [
        new THREE.Vector3(-hw, -hh, -hd),
        new THREE.Vector3(-hw, -hh, hd),
        new THREE.Vector3(-hw, hh, hd),
        new THREE.Vector3(-hw, hh, -hd)
      ]
    }
  ];
};


// NEW: Dynamic face detection for any geometry
interface DynamicFace {
  id: string;
  index: number;
  center: THREE.Vector3;
  normal: THREE.Vector3;
  area: number;
  vertices: THREE.Vector3[];
  bounds: THREE.Box3;
  triangles: THREE.Triangle[];
  shape: 'triangle' | 'quad' | 'polygon';
  isFlat: boolean;
}

interface DynamicPanel {
  faceId: string;
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  scale: THREE.Vector3;
  thickness: number;
}

interface FaceSelectionOption {
  faceIndex: number;
  name: string;
  position: THREE.Vector3;
}

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

  // NEW: Dynamic face detection system
  const dynamicFaces = useMemo(() => {
    console.log(`🎯 Dynamic Face Detection: Analyzing geometry for shape ${shape.id} (${shape.type})`);
    
    const geometry = shape.geometry;
    if (!geometry || !geometry.attributes.position) {
      console.log('❌ No geometry or position attributes found');
      return [];
    }

    const faces: DynamicFace[] = [];
    const positionAttribute = geometry.attributes.position;
    const normalAttribute = geometry.attributes.normal;
    const indexAttribute = geometry.index;

    console.log(`📊 Geometry stats:`, {
      vertices: positionAttribute.count,
      hasNormals: !!normalAttribute,
      hasIndex: !!indexAttribute,
      isIndexed: !!indexAttribute
    });

    // Group triangles by similar normals to find faces
    const faceGroups = new Map<string, {
      triangles: THREE.Triangle[];
      normal: THREE.Vector3;
      vertices: THREE.Vector3[];
      bounds: THREE.Box3;
    }>();

    const normalTolerance = 0.1; // Tolerance for grouping similar normals

    // Process triangles
    const triangleCount = indexAttribute ? indexAttribute.count / 3 : positionAttribute.count / 3;
    
    for (let i = 0; i < triangleCount; i++) {
      const triangle = new THREE.Triangle();
      
      // Get triangle vertices
      if (indexAttribute) {
        const a = indexAttribute.getX(i * 3);
        const b = indexAttribute.getX(i * 3 + 1);
        const c = indexAttribute.getX(i * 3 + 2);
        
        triangle.a.fromBufferAttribute(positionAttribute, a);
        triangle.b.fromBufferAttribute(positionAttribute, b);
        triangle.c.fromBufferAttribute(positionAttribute, c);
      } else {
        triangle.a.fromBufferAttribute(positionAttribute, i * 3);
        triangle.b.fromBufferAttribute(positionAttribute, i * 3 + 1);
        triangle.c.fromBufferAttribute(positionAttribute, i * 3 + 2);
      }

      // Calculate triangle normal
      const normal = new THREE.Vector3();
      triangle.getNormal(normal);
      
      // Find or create face group
      let groupKey = '';
      let foundGroup = false;
      
      for (const [key, group] of faceGroups) {
        if (group.normal.angleTo(normal) < normalTolerance) {
          groupKey = key;
          foundGroup = true;
          break;
        }
      }
      
      if (!foundGroup) {
        groupKey = `face_${faceGroups.size}`;
        faceGroups.set(groupKey, {
          triangles: [],
          normal: normal.clone(),
          vertices: [],
          bounds: new THREE.Box3()
        });
      }
      
      const group = faceGroups.get(groupKey)!;
      group.triangles.push(triangle.clone());
      
      // Add vertices to group
      group.vertices.push(triangle.a.clone(), triangle.b.clone(), triangle.c.clone());
      
      // Expand bounds
      group.bounds.expandByPoint(triangle.a);
      group.bounds.expandByPoint(triangle.b);
      group.bounds.expandByPoint(triangle.c);
    }

    console.log(`🔍 Found ${faceGroups.size} face groups`);

    // Convert groups to faces
    let faceIndex = 0;
    for (const [key, group] of faceGroups) {
      // Calculate face center
      const center = group.bounds.getCenter(new THREE.Vector3());
      
      // Calculate face area
      let totalArea = 0;
      group.triangles.forEach(triangle => {
        totalArea += triangle.getArea();
      });
      
      // Determine face shape
      const uniqueVertices = [];
      const vertexTolerance = 0.01;
      
      for (const vertex of group.vertices) {
        let isUnique = true;
        for (const unique of uniqueVertices) {
          if (vertex.distanceTo(unique) < vertexTolerance) {
            isUnique = false;
            break;
          }
        }
        if (isUnique) {
          uniqueVertices.push(vertex.clone());
        }
      }
      
      const faceShape = uniqueVertices.length === 3 ? 'triangle' : 
                       uniqueVertices.length === 4 ? 'quad' : 'polygon';
      
      const face: DynamicFace = {
        id: key,
        index: faceIndex++,
        center,
        normal: group.normal.clone(),
        area: totalArea,
        vertices: uniqueVertices,
        bounds: group.bounds.clone(),
        triangles: group.triangles,
        shape: faceShape,
        isFlat: group.triangles.length > 0
      };
      
      faces.push(face);
      
      console.log(`✅ Face ${faceIndex - 1} (${key}):`, {
        shape: faceShape,
        vertices: uniqueVertices.length,
        triangles: group.triangles.length,
        area: totalArea.toFixed(2),
        center: center.toArray().map(v => v.toFixed(1)),
        normal: group.normal.toArray().map(v => v.toFixed(2))
      });
    }

    return faces;
  }, [shape.geometry, shape.id, shape.type]);
  
  // 🎯 NEW: Touch long press state for panel confirmation
  const [touchState, setTouchState] = useState<{
    isLongPressing: boolean;
    touchStartTime: number;
    touchFaceIndex: number | null;
    longPressTimer: NodeJS.Timeout | null;
  }>({
    isLongPressing: false,
    touchStartTime: 0,
    touchFaceIndex: null,
    longPressTimer: null,
  });

  const LONG_PRESS_DURATION = 800; // 800ms for long press

  // 🎯 NEW: Touch long press handlers
  const handleTouchStart = useCallback((e: any, faceIndex: number) => {
    if (!isAddPanelMode) return;
    
    e.stopPropagation();
    
    // Clear any existing timer
    if (touchState.longPressTimer) {
      clearTimeout(touchState.longPressTimer);
    }
    
    const startTime = Date.now();
    
    // Set up long press timer
    const timer = setTimeout(() => {
      // Long press detected - confirm panel placement
      if (selectedDynamicFace !== null) {
        onFaceSelect?.(selectedDynamicFace);
        console.log(`🎯 TOUCH LONG PRESS: Panel confirmed on face ${selectedDynamicFace}`);
        
        // Visual feedback - could add haptic feedback here if available
        if (navigator.vibrate) {
          navigator.vibrate(100); // Short vibration feedback
        }
        
        setTouchState(prev => ({
          ...prev,
          isLongPressing: false,
          longPressTimer: null,
        }));
      }
    }, LONG_PRESS_DURATION);
    
    setTouchState({
      isLongPressing: true,
      touchStartTime: startTime,
      touchFaceIndex: faceIndex,
      longPressTimer: timer,
    });
    
    console.log(`🎯 TOUCH START: Long press detection started for face ${faceIndex}`);
  }, [isAddPanelMode, selectedDynamicFace, onFaceSelect, touchState.longPressTimer, LONG_PRESS_DURATION]);

  // 🎯 NEW: Handle touch end - cancel long press if released early
  const handleTouchEnd = useCallback((e: any) => {
    if (!touchState.isLongPressing) return;
    
    e.stopPropagation();
    
    const touchDuration = Date.now() - touchState.touchStartTime;
    
    // Clear the timer
    if (touchState.longPressTimer) {
      clearTimeout(touchState.longPressTimer);
    }
    
    if (touchDuration < LONG_PRESS_DURATION) {
      // Short touch - cycle through faces (same as click)
      const intersectionPoint = e.point || (window as any).lastClickPosition;
      
      if (selectedDynamicFace === null && intersectionPoint) {
        // First touch - find closest face
        const closestFace = findClosestFace(intersectionPoint);
        if (closestFace !== null && onDynamicFaceSelect) {
          onDynamicFaceSelect(closestFace);
          console.log(`🎯 SHORT TOUCH: Selected face ${closestFace} geometrically`);
        }
      } else if (selectedDynamicFace !== null) {
        // Subsequent touches - find next adjacent face
        const nextFace = findNextFace(selectedDynamicFace);
        if (onDynamicFaceSelect) {
          onDynamicFaceSelect(nextFace);
          console.log(`🎯 SHORT TOUCH: Cycled to face ${nextFace} from ${selectedDynamicFace}`);
        }
      }
    }
    
    setTouchState({
      isLongPressing: false,
      touchStartTime: 0,
      touchFaceIndex: null,
      longPressTimer: null,
    });
  }, [touchState, selectedDynamicFace, onDynamicFaceSelect, LONG_PRESS_DURATION]);

  // NEW: Geometric face detection
  const geometricFaces = useMemo(() => {
    // Use dynamic faces for complex geometries, geometric faces for simple ones
    if (['box', 'rectangle2d'].includes(shape.type)) {
      // Use traditional box face system for simple shapes
      return createBoxFaces(shape);
    } else {
      // Use dynamic face detection for complex geometries
      console.log(`🎯 Using dynamic face detection for ${shape.type}`);
      return dynamicFaces.map(face => ({
        index: face.index,
        center: face.center,
        normal: face.normal,
        area: face.area,
        vertices: face.vertices,
        bounds: face.bounds
      }));
    }
  }, [shape.type, shape.parameters, dynamicFaces]);

  // Helper function to create box faces (traditional system)
  const createBoxFaces = () => {
    console.log(`🎯 GeometricFaces: Using box face system for ${shape.type}`);
    
    let width = 500, height = 500, depth = 500;
    
    if (shape.type === 'box' || shape.type === 'rectangle2d') {
      width = shape.parameters.width || 500;
      height = shape.parameters.height || 500;
      depth = shape.parameters.depth || 500;
    } else if (shape.type === 'cylinder' || shape.type === 'circle2d') {
      const radius = shape.parameters.radius || 250;
      width = radius * 2;
      height = shape.parameters.height || 500;
      depth = radius * 2;
    } else if (['polyline2d', 'polygon2d', 'polyline3d', 'polygon3d'].includes(shape.type)) {
      // For polyline/polygon, calculate dimensions from geometry
      const geometry = shape.geometry;
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        width = Math.abs(size.x) || 500;
        height = shape.parameters.height || 500;
        depth = Math.abs(size.z) || 500;
      }
    }
    
    const hw = width / 2;
    const hh = height / 2;
    const hd = depth / 2;

    const faces = [
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
  };

  // NEW: Find closest face to a 3D point
  const findClosestFace = useCallback((point: THREE.Vector3): number | null => {
    if (geometricFaces.length === 0) return null;
    
    // Convert world point to local space
    const shapePosition = new THREE.Vector3(...shape.position);
    const localPoint = point.clone().sub(shapePosition);
    
    // Find the face with the closest center
    let closestFace = 0;
    let closestDistance = localPoint.distanceTo(geometricFaces[0].center);
    
    for (let i = 1; i < geometricFaces.length; i++) {
      const distance = localPoint.distanceTo(geometricFaces[i].center);
      if (distance < closestDistance) {
        closestDistance = distance;
        closestFace = i;
      }
    }
    
    console.log(`🎯 Closest face to point ${localPoint.toArray().map(v => v.toFixed(1))}: Face ${closestFace} (distance: ${closestDistance.toFixed(1)})`);
    return closestFace;
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
  }, [geometricFaces, shape.position]);

  // 🎯 NEW: Handle touch move - cancel long press if finger moves too much
  const handleTouchMove = useCallback((e: any) => {
    if (!touchState.isLongPressing) return;
    
    // Cancel long press if finger moves (to prevent accidental confirmations)
    if (touchState.longPressTimer) {
      clearTimeout(touchState.longPressTimer);
      setTouchState(prev => ({
        ...prev,
        isLongPressing: false,
        longPressTimer: null,
      }));
      console.log(`🎯 TOUCH MOVE: Long press cancelled due to finger movement`);
    }
  }, [touchState]);

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

  // NEW: Create dynamic panel for complex geometries
  const createDynamicPanel = (face: DynamicFace): DynamicPanel => {
    console.log(`🎯 Creating dynamic panel for face ${face.id} (${face.shape})`);
    
    let geometry: THREE.BufferGeometry;
    
    switch (face.shape) {
      case 'triangle': {
        // Create triangular panel
        const vertices = face.vertices.slice(0, 3);
        const shape = new THREE.Shape();
        
        // Convert to 2D shape
        const localVertices = vertices.map(v => {
          const local = v.clone().sub(face.center);
          return new THREE.Vector2(local.x, local.z);
        });
        
        shape.moveTo(localVertices[0].x, localVertices[0].y);
        shape.lineTo(localVertices[1].x, localVertices[1].y);
        shape.lineTo(localVertices[2].x, localVertices[2].y);
        shape.lineTo(localVertices[0].x, localVertices[0].y);
        
        geometry = new THREE.ExtrudeGeometry(shape, {
          depth: panelThickness,
          bevelEnabled: false
        });
        break;
      }
      
      case 'quad': {
        // Create rectangular panel
        const vertices = face.vertices.slice(0, 4);
        const shape = new THREE.Shape();
        
        // Convert to 2D shape
        const localVertices = vertices.map(v => {
          const local = v.clone().sub(face.center);
          return new THREE.Vector2(local.x, local.z);
        });
        
        shape.moveTo(localVertices[0].x, localVertices[0].y);
        for (let i = 1; i < localVertices.length; i++) {
          shape.lineTo(localVertices[i].x, localVertices[i].y);
        }
        shape.lineTo(localVertices[0].x, localVertices[0].y);
        
        geometry = new THREE.ExtrudeGeometry(shape, {
          depth: panelThickness,
          bevelEnabled: false
        });
        break;
      }
      
      default: {
        // Create polygon panel
        const shape = new THREE.Shape();
        
        // Convert to 2D shape
        const localVertices = face.vertices.map(v => {
          const local = v.clone().sub(face.center);
          return new THREE.Vector2(local.x, local.z);
        });
        
        if (localVertices.length > 0) {
          shape.moveTo(localVertices[0].x, localVertices[0].y);
          for (let i = 1; i < localVertices.length; i++) {
            shape.lineTo(localVertices[i].x, localVertices[i].y);
          }
          shape.lineTo(localVertices[0].x, localVertices[0].y);
        }
        
        geometry = new THREE.ExtrudeGeometry(shape, {
          depth: panelThickness,
          bevelEnabled: false
        });
        break;
      }
    }
    
    // Calculate rotation to align with face normal
    const rotation = new THREE.Euler();
    const up = new THREE.Vector3(0, 1, 0);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(up, face.normal);
    rotation.setFromQuaternion(quaternion);
    
    return {
      faceId: face.id,
      geometry,
      position: face.center.clone(),
      rotation,
      scale: new THREE.Vector3(1, 1, 1),
      thickness: panelThickness
    };
  };

  // NEW: Dynamic panel data based on selected faces
  const dynamicPanelData = useMemo(() => {
    if (!['polyline2d', 'polygon2d', 'polyline3d', 'polygon3d', 'cylinder', 'circle2d'].includes(shape.type) || selectedFaces.length === 0) {
      return [];
    }
    
    console.log(`🎯 Creating ${selectedFaces.length} dynamic panels for ${shape.type}`);
    
    return selectedFaces.map(faceIndex => {
      const face = dynamicFaces[faceIndex];
      if (!face) {
        console.warn(`Face ${faceIndex} not found in dynamic faces`);
        return null;
      }
      
      const panel = createDynamicPanel(face);
      return {
        faceIndex,
        faceId: face.id,
        geometry: panel.geometry,
        position: panel.position,
        rotation: panel.rotation,
        scale: panel.scale,
        panelOrder: selectedFaces.indexOf(faceIndex)
      };
    }).filter(Boolean);
  }, [shape.type, selectedFaces, dynamicFaces]);

  const calculateSmartPanelBounds = (
    faceIndex: number,
    allPanels: number[],
    panelOrder: number
  ): SmartPanelBounds => {
    // Gerçek zamanlı boyutları hesapla - shape.scale ile çarpılmış
    let width = 500, height = 500, depth = 500;
    
    if (shape.type === 'box' || shape.type === 'rectangle2d') {
      // Scale ile çarpılmış gerçek boyutları kullan
      width = (shape.parameters.width || 500) * shape.scale[0];
      height = (shape.parameters.height || 500) * shape.scale[1];
      depth = (shape.parameters.depth || 500) * shape.scale[2];
    } else if (shape.type === 'cylinder' || shape.type === 'circle2d') {
      const radius = shape.parameters.radius || 250;
      width = radius * 2 * shape.scale[0];
      height = (shape.parameters.height || 500) * shape.scale[1];
      depth = radius * 2 * shape.scale[2];
    } else if (['polyline2d', 'polygon2d', 'polyline3d', 'polygon3d'].includes(shape.type)) {
      // For polyline/polygon, calculate dimensions from geometry
      const geometry = shape.geometry;
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        // Scale ile çarpılmış boyutları kullan
        width = (Math.abs(size.x) || 500) * shape.scale[0];
        height = (shape.parameters.height || 500) * shape.scale[1];
        depth = (Math.abs(size.z) || 500) * shape.scale[2];
      }
    }
    
    console.log(`🎯 Panel bounds calculation for face ${faceIndex}:`, {
      shapeType: shape.type,
      originalParams: shape.parameters,
      scale: shape.scale,
      calculatedDimensions: {
        width: width.toFixed(1),
        height: height.toFixed(1),
        depth: depth.toFixed(1)
      }
    });
    
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
    if (!['box', 'cylinder', 'polyline2d', 'polygon2d', 'polyline3d', 'polygon3d', 'rectangle2d', 'circle2d'].includes(shape.type) || selectedFaces.length === 0) {
      return [];
    }
    
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
    if (!isAddPanelMode || selectedDynamicFace === null || !['box', 'cylinder', 'polyline2d', 'polygon2d', 'polyline3d', 'polygon3d', 'rectangle2d', 'circle2d'].includes(shape.type)) {
      return null;
    }
    
    // Don't show preview if face already has a panel
    if (selectedFaces.includes(selectedDynamicFace)) return null;
    
    const faceIndex = selectedDynamicFace;
    const smartBounds = calculateSmartPanelBounds(
      faceIndex,
      [...selectedFaces, faceIndex], // Include current face in calculation
      selectedFaces.length // This would be the panel order
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
      panelOrder: selectedFaces.length,
    };
  }, [isAddPanelMode, selectedDynamicFace, selectedFaces, shape.type, shape.parameters]);

  // Face positions and rotations for box - MOVED BEFORE CONDITIONAL RETURN
  const faceTransforms = useMemo(() => {
    // Gerçek zamanlı boyutları hesapla - shape.scale ile çarpılmış
    let width = 500, height = 500, depth = 500;
    
    if (shape.type === 'box' || shape.type === 'rectangle2d') {
      // Scale ile çarpılmış gerçek boyutları kullan
      width = (shape.parameters.width || 500) * shape.scale[0];
      height = (shape.parameters.height || 500) * shape.scale[1];
      depth = (shape.parameters.depth || 500) * shape.scale[2];
    } else if (shape.type === 'cylinder' || shape.type === 'circle2d') {
      const radius = shape.parameters.radius || 250;
      width = radius * 2 * shape.scale[0];
      height = (shape.parameters.height || 500) * shape.scale[1];
      depth = radius * 2 * shape.scale[2];
    } else if (['polyline2d', 'polygon2d', 'polyline3d', 'polygon3d'].includes(shape.type)) {
      // For polyline/polygon, calculate dimensions from geometry
      const geometry = shape.geometry;
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const size = geometry.boundingBox.getSize(new THREE.Vector3());
        // Scale ile çarpılmış boyutları kullan
        width = (Math.abs(size.x) || 500) * shape.scale[0];
        height = (shape.parameters.height || 500) * shape.scale[1];
        depth = (Math.abs(size.z) || 500) * shape.scale[2];
      }
    }
    
    console.log(`🎯 Face transforms calculation:`, {
      shapeType: shape.type,
      scale: shape.scale,
      calculatedDimensions: {
        width: width.toFixed(1),
        height: height.toFixed(1),
        depth: depth.toFixed(1)
      }
    });
    
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
    // Hide all face overlays in panel mode - only show blue panel preview
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
  if (!shape.geometry || !shape.geometry.attributes.position) {
    console.log(`🎯 PanelManager: Shape type '${shape.type}' not supported for panels`);
    return null;
  }

  console.log(`🎯 PanelManager: Rendering panels for shape type '${shape.type}' with ID '${shape.id}'`);

  // Determine which panel system to use
  const useBoxSystem = ['box', 'rectangle2d'].includes(shape.type);
  const useDynamicSystem = !useBoxSystem;

  return (
    <group>
      {/* Face overlays - Box system or Dynamic system */}
      {(showFaces || isAddPanelMode) &&
        (useBoxSystem ? faceTransforms : dynamicFaces).map((item, faceIndex) => {
          const transform = useBoxSystem ? item : {
            position: [item.center.x, item.center.y, item.center.z],
            rotation: [0, 0, 0] // Dynamic rotation will be calculated
          };
          
          const opacity = getFaceOpacity(faceIndex);

          return (
            <mesh
              key={`face-${faceIndex}`}
              geometry={useBoxSystem ? 
                new THREE.PlaneGeometry(
                  faceIndex === 2 || faceIndex === 3 ? 
                    (shape.type === 'box' ? (shape.parameters.width || 500) * shape.scale[0] : 
                     shape.geometry.boundingBox ? shape.geometry.boundingBox.getSize(new THREE.Vector3()).x * shape.scale[0] : 500) : 
                    (faceIndex === 4 || faceIndex === 5 ? 
                      (shape.type === 'box' ? (shape.parameters.depth || 500) * shape.scale[2] : 
                       shape.geometry.boundingBox ? shape.geometry.boundingBox.getSize(new THREE.Vector3()).z * shape.scale[2] : 500) : 
                      (shape.type === 'box' ? (shape.parameters.width || 500) * shape.scale[0] : 
                       shape.geometry.boundingBox ? shape.geometry.boundingBox.getSize(new THREE.Vector3()).x * shape.scale[0] : 500)),
                  faceIndex === 2 || faceIndex === 3 ? 
                    (shape.type === 'box' ? (shape.parameters.depth || 500) * shape.scale[2] : 
                     shape.geometry.boundingBox ? shape.geometry.boundingBox.getSize(new THREE.Vector3()).z * shape.scale[2] : 500) : 
                    (shape.type === 'box' ? (shape.parameters.height || 500) * shape.scale[1] : (shape.parameters.height || 500) * shape.scale[1])
                ) :
                new THREE.PlaneGeometry(
                  Math.sqrt(item.area) * 0.8, // Approximate face size
                  Math.sqrt(item.area) * 0.8
                )
              }
              position={[
                shape.position[0] + transform.position[0],
                shape.position[1] + transform.position[1],
                shape.position[2] + transform.position[2],
              ]}
              rotation={useBoxSystem ? [
                shape.rotation[0] + transform.rotation[0],
                shape.rotation[1] + transform.rotation[1],
                shape.rotation[2] + transform.rotation[2],
              ] : shape.rotation}
              scale={[1, 1, 1]} // Face overlay'lerde scale kullanma, boyutlar zaten hesaplandı
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
              // 🎯 NEW: Touch event handlers for long press
              onTouchStart={(e) => handleTouchStart(e, faceIndex)}
              onTouchEnd={handleTouchEnd}
              onTouchMove={handleTouchMove}
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

      {/* Wood panels - Box system or Dynamic system */}
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

      {/* Dynamic panels for complex geometries */}
      {useDynamicSystem && dynamicPanelData.map((panelData) => (
        <mesh
          key={`dynamic-panel-${panelData.faceId}`}
          geometry={panelData.geometry}
          position={[
            shape.position[0] + panelData.position.x,
            shape.position[1] + panelData.position.y,
            shape.position[2] + panelData.position.z,
          ]}
          rotation={[
            shape.rotation[0] + panelData.rotation.x,
            shape.rotation[1] + panelData.rotation.y,
            shape.rotation[2] + panelData.rotation.z,
          ]}
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
                  size: new THREE.Vector3(1, 1, 1), // Dynamic size
                  panelOrder: panelData.panelOrder,
                });
                console.log(`🔴 Dynamic panel ${panelData.faceId} clicked for editing`);
              }
            }
          }}
        >
          <meshPhysicalMaterial {...getPanelMaterial(panelData.faceIndex).parameters} />
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
          castShadow
          receiveShadow
        >
          <meshPhysicalMaterial
            color="#3b82f6" // Blue preview color
            roughness={0.3}
            metalness={0.1}
            clearcoat={0.8}
            clearcoatRoughness={0.1}
            reflectivity={0.3}
            envMapIntensity={0.8}
            transparent
            opacity={0.85}
            depthWrite={false}
            iridescence={0.2}
            iridescenceIOR={1.3}
            sheen={0.3}
            sheenRoughness={0.2}
            sheenColor="#60a5fa"
            transmission={0.1}
            thickness={2}
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
            color="#1d4ed8" // Darker blue for edges
            linewidth={2.0}
            transparent
            opacity={1.0}
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