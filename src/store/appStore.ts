import { create } from 'zustand';
import { Shape } from '../types/shapes';
import * as THREE from 'three';
import { performBooleanSubtract, performBooleanUnion } from '../utils/booleanOperations';
import { GeometryFactory } from '../lib/geometryFactory';

// Helper function to get shape bounds
const getShapeBounds = (shape: Shape) => {
  const geometry = shape.geometry;
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox!;
  
  // Apply shape transformations
  const min = new THREE.Vector3(bbox.min.x, bbox.min.y, bbox.min.z);
  const max = new THREE.Vector3(bbox.max.x, bbox.max.y, bbox.max.z);
  
  // Apply scale
  min.multiply(new THREE.Vector3(...shape.scale));
  max.multiply(new THREE.Vector3(...shape.scale));
  
  // Apply position
  min.add(new THREE.Vector3(...shape.position));
  max.add(new THREE.Vector3(...shape.position));
  
  return { min, max };
};

// Helper function to check if two bounding boxes intersect
const boundsIntersect = (bounds1: any, bounds2: any): boolean => {
  return (
    bounds1.min.x <= bounds2.max.x && bounds1.max.x >= bounds2.min.x &&
    bounds1.min.y <= bounds2.max.y && bounds1.max.y >= bounds2.min.y &&
    bounds1.min.z <= bounds2.max.z && bounds1.max.z >= bounds2.min.z
  );
};

// Helper function to create subtracted geometry (simplified implementation)
const createSubtractedGeometry = (targetGeometry: THREE.BufferGeometry, subtractShape: Shape): THREE.BufferGeometry => {
  // Create a new geometry with a hole/cavity based on the subtract shape
  const newGeometry = targetGeometry.clone();
  
  // Get the subtract shape's dimensions and position
  const subtractBounds = getShapeBounds(subtractShape);
  const subtractCenter = new THREE.Vector3(
    (subtractBounds.min.x + subtractBounds.max.x) / 2,
    (subtractBounds.min.y + subtractBounds.max.y) / 2,
    (subtractBounds.min.z + subtractBounds.max.z) / 2
  );
  
  // For demonstration, we'll create a modified geometry
  // This is a simplified approach - in a real CAD system, you'd use proper CSG
  
  if (subtractShape.type === 'box' || subtractShape.type === 'cylinder') {
    // Create a visual indication by modifying the geometry
    // Scale down the geometry slightly to show the subtraction effect
    const positions = newGeometry.attributes.position;
    const positionArray = positions.array as Float32Array;
    
    // Modify vertices that are close to the subtract shape
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3(
        positionArray[i * 3],
        positionArray[i * 3 + 1],
        positionArray[i * 3 + 2]
      );
      
      // Check if vertex is within the subtract shape's influence
      const distance = vertex.distanceTo(subtractCenter);
      const influenceRadius = Math.max(
        subtractBounds.max.x - subtractBounds.min.x,
        subtractBounds.max.y - subtractBounds.min.y,
        subtractBounds.max.z - subtractBounds.min.z
      ) / 2;
      
      if (distance < influenceRadius) {
        // Create a cavity effect by pushing vertices inward
        const direction = vertex.clone().sub(subtractCenter).normalize();
        const pushDistance = (influenceRadius - distance) * 0.3;
        vertex.sub(direction.multiplyScalar(pushDistance));
        
        positionArray[i * 3] = vertex.x;
        positionArray[i * 3 + 1] = vertex.y;
        positionArray[i * 3 + 2] = vertex.z;
      }
    }
    
    // Mark the attribute as needing update
    positions.needsUpdate = true;
    newGeometry.computeVertexNormals();
    newGeometry.computeBoundingBox();
    newGeometry.computeBoundingSphere();
  }
  
  console.log('Boolean subtraction applied - geometry modified with cavity effect');
  return newGeometry;
};

export enum Tool {
  MOVE = 'Move',
  ROTATE = 'Rotate',
  SCALE = 'Scale',
  SELECT = 'Select',
  POLYLINE = 'Polyline',
  POLYLINE_EDIT = 'Polyline Edit',
  RECTANGLE = 'Rectangle',
  CIRCLE = 'Circle',
  ARC = 'Arc',
  POLYGON = 'Polygon',
  MIRROR = 'Mirror',
  ARRAY = 'Array',
  OFFSET = 'Offset',
  FILLET = 'Fillet',
  CHAMFER = 'Chamfer',
  TRIM = 'Trim',
  EXTEND = 'Extend',
  DIMENSION = 'Dimension',
  PAN = 'Pan',
  ZOOM = 'Zoom',
  BOOLEAN_UNION = 'Union',
  BOOLEAN_SUBTRACT = 'Subtract',
  BOOLEAN_INTERSECT = 'Intersect',
  POINT_TO_POINT_MOVE = 'Point to Point Move',
}

export enum CameraType {
  PERSPECTIVE = 'perspective',
  ORTHOGRAPHIC = 'orthographic',
}

export enum MeasurementUnit {
  MM = 'mm',
  CM = 'cm',
  INCH = 'inch',
}

export enum ModificationType {
  MIRROR = 'mirror',
  ARRAY = 'array',
  FILLET = 'fillet',
  CHAMFER = 'chamfer',
}

export enum SnapType {
  ENDPOINT = 'endpoint',
  MIDPOINT = 'midpoint',
  CENTER = 'center',
  QUADRANT = 'quadrant',
  PERPENDICULAR = 'perpendicular',
  INTERSECTION = 'intersection',
  NEAREST = 'nearest',
}

// 🎯 NEW: View Mode Enum - Tel, Saydam, Katı görünümler
export enum ViewMode {
  WIREFRAME = 'wireframe',    // Tel görünüş
  SOLID = 'solid'             // Katı görünüş
}

// 🎯 NEW: Ortho Mode Enum - Tam dik hareket modu
export enum OrthoMode {
  OFF = 'off',
  ON = 'on'
}

export interface SnapSettings {
  [SnapType.ENDPOINT]: boolean;
  [SnapType.MIDPOINT]: boolean;
  [SnapType.CENTER]: boolean;
  [SnapType.QUADRANT]: boolean;
  [SnapType.PERPENDICULAR]: boolean;
  [SnapType.INTERSECTION]: boolean;
  [SnapType.NEAREST]: boolean;
}

export interface ModificationParams {
  type: ModificationType;
  mirror?: {
    axis: 'x' | 'y' | 'z';
    distance: number;
  };
  array?: {
    count: number;
    spacing: number;
    direction: 'x' | 'y' | 'z';
  };
  fillet?: {
    radius: number;
  };
  chamfer?: {
    distance: number;
  };
}

export const UNIT_CONVERSIONS = {
  [MeasurementUnit.MM]: 1,
  [MeasurementUnit.CM]: 10,
  [MeasurementUnit.INCH]: 25.4,
};

interface AppState {
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  lastTransformTool: Tool;
  setLastTransformTool: (tool: Tool) => void;
  shapes: Shape[];
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  selectedShapeId: string | null;
  selectShape: (id: string | null) => void;
  performBooleanOperation: (operation: 'union' | 'subtract') => void;
  // OpenCascade integration
  isOpenCascadeInitialized: boolean;
  setOpenCascadeInitialized: (initialized: boolean) => void;
  geometryMode: string;
  setGeometryMode: (mode: string) => void;
  cameraPosition: [number, number, number];
  setCameraPosition: (position: [number, number, number]) => void;
  selectedObjectPosition: [number, number, number];
  setSelectedObjectPosition: (position: [number, number, number]) => void;
  gridSize: number;
  setGridSize: (size: number) => void;
  cameraType: CameraType;
  setCameraType: (type: CameraType) => void;
  measurementUnit: MeasurementUnit;
  setMeasurementUnit: (unit: MeasurementUnit) => void;
  convertToDisplayUnit: (value: number) => number;
  convertToBaseUnit: (value: number) => number;
  scriptContent: string;
  setScriptContent: (content: string) => void;
  modifyShape: (id: string, params: ModificationParams) => void;
  snapSettings: SnapSettings;
  setSnapSetting: (snapType: SnapType, enabled: boolean) => void;
  toggleSnapSetting: (snapType: SnapType) => void;
  setSnapSettingsBatch: (settings: Partial<SnapSettings>) => void;
  snapTolerance: number;
  setSnapTolerance: (tolerance: number) => void;
  editingPolylineId: string | null;
  setEditingPolylineId: (id: string | null) => void;
  // Auto snap management
  autoSnapEnabled: boolean;
  setAutoSnapEnabled: (enabled: boolean) => void;
  enableAutoSnap: (tool: Tool) => void;
  disableAutoSnap: () => void;
  // Point to Point Move state
  pointToPointMoveState: {
    isActive: boolean;
    sourcePoint: THREE.Vector3 | null;
    targetPoint: THREE.Vector3 | null;
    selectedShapeId: string | null;
  };
  setPointToPointMoveState: (state: Partial<{
    isActive: boolean;
    sourcePoint: THREE.Vector3 | null;
    targetPoint: THREE.Vector3 | null;
    selectedShapeId: string | null;
  }>) => void;
  resetPointToPointMove: () => void;
  // Edit mode isolation
  isEditMode: boolean;
  setEditMode: (enabled: boolean) => void;
  editingShapeId: string | null;
  setEditingShapeId: (id: string | null) => void;
  hiddenShapeIds: string[];
  setHiddenShapeIds: (ids: string[]) => void;
  // 🎯 NEW: View Mode State - Görünüm modları
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  cycleViewMode: () => void;
  // 🎯 NEW: Ortho Mode State - Tam dik hareket modu
  orthoMode: OrthoMode;
  setOrthoMode: (mode: OrthoMode) => void;
  toggleOrthoMode: () => void;
  // Panel mode states
  isAddPanelMode: boolean;
  setIsAddPanelMode: (enabled: boolean) => void;
  isPanelEditMode: boolean;
  setIsPanelEditMode: (enabled: boolean) => void;
  history: {
    past: AppState[];
    future: AppState[];
  };
  undo: () => void;
  redo: () => void;
}

const defaultScript = `// Create a box
function createBox() {
  return {
    type: 'box',
    width: 500,
    height: 500,
    depth: 500
  };
}

// Create a cylinder
function createCylinder() {
  return {
    type: 'cylinder',
    radius: 250,
    height: 500
  };
}

// Example: Create and position shapes
const box = createBox();
box.position = [0, 250, 0];

const cylinder = createCylinder();
cylinder.position = [750, 250, 0];
`;

export const useAppStore = create<AppState>((set, get) => ({
  activeTool: Tool.SELECT,
  setActiveTool: (tool) => set({ activeTool: tool }),
  lastTransformTool: Tool.MOVE,
  setLastTransformTool: (tool) => {
    // Only store actual transform tools
    if ([Tool.MOVE, Tool.ROTATE, Tool.SCALE].includes(tool)) {
      set({ lastTransformTool: tool });
    }
  },
  
  // OpenCascade integration
  isOpenCascadeInitialized: false,
  setOpenCascadeInitialized: (initialized) => set({ isOpenCascadeInitialized: initialized }),
  
  geometryMode: 'Three.js',
  setGeometryMode: (mode) => set({ geometryMode: mode }),
  
  gridSize: 50,
  setGridSize: (size) => set({ gridSize: size }),
  
  cameraType: CameraType.PERSPECTIVE,
  setCameraType: (type) => set({ cameraType: type }),
  
  cameraPosition: [1000, 1000, 1000],
  setCameraPosition: (position) => set({ cameraPosition: position }),
  
  selectedObjectPosition: [0, 0, 0],
  setSelectedObjectPosition: (position) => set({ selectedObjectPosition: position }),
  
  measurementUnit: MeasurementUnit.MM,
  setMeasurementUnit: (unit) => set({ measurementUnit: unit }),
  
  scriptContent: defaultScript,
  setScriptContent: (content) => set({ scriptContent: content }),
  
  editingPolylineId: null,
  setEditingPolylineId: (id) => set({ editingPolylineId: id }),
  
  // Edit mode isolation
  isEditMode: false,
  setEditMode: (enabled) => set({ isEditMode: enabled }),
  
  editingShapeId: null,
  setEditingShapeId: (id) => set({ editingShapeId: id }),
  
  hiddenShapeIds: [],
  setHiddenShapeIds: (ids) => set({ hiddenShapeIds: ids }),
  
  // 🎯 NEW: View Mode State - Varsayılan olarak SOLID
  viewMode: ViewMode.SOLID,
  setViewMode: (mode) => {
    set({ viewMode: mode });
    console.log(`View mode changed to: ${mode}`);
  },
  
  // 🎯 NEW: Cycle through view modes - Sırayla geçiş
  cycleViewMode: () => {
    const { viewMode } = get();
    const nextMode = viewMode === ViewMode.SOLID ? ViewMode.WIREFRAME : ViewMode.SOLID;
    
    set({ viewMode: nextMode });
    console.log(`🎯 View mode cycled from ${viewMode} to ${nextMode}`);
  },
  
  // 🎯 NEW: Ortho Mode State - Varsayılan olarak KAPALI
  orthoMode: OrthoMode.OFF,
  setOrthoMode: (mode) => {
    set({ orthoMode: mode });
    console.log(`🎯 Ortho mode changed to: ${mode}`);
  },
  
  // 🎯 NEW: Toggle ortho mode
  toggleOrthoMode: () => {
    const { orthoMode } = get();
    const nextMode = orthoMode === OrthoMode.OFF ? OrthoMode.ON : OrthoMode.OFF;
    
    set({ orthoMode: nextMode });
    console.log(`🎯 Ortho mode toggled from ${orthoMode} to ${nextMode}`);
  },
  
  // Panel mode states
  isAddPanelMode: false,
  setIsAddPanelMode: (enabled) => set({ isAddPanelMode: enabled }),
  
  isPanelEditMode: false,
  setIsPanelEditMode: (enabled) => set({ isPanelEditMode: enabled }),
  
  // Snap settings - all enabled by default
  snapSettings: {
    [SnapType.ENDPOINT]: true,
    [SnapType.MIDPOINT]: true,
    [SnapType.CENTER]: true,
    [SnapType.QUADRANT]: true,
    [SnapType.PERPENDICULAR]: true,
    [SnapType.INTERSECTION]: true,
    [SnapType.NEAREST]: true,
  },
  
  setSnapSetting: (snapType, enabled) => 
    set((state) => ({
      snapSettings: {
        ...state.snapSettings,
        [snapType]: enabled,
      },
    })),
    
  toggleSnapSetting: (snapType) =>
    set((state) => ({
      snapSettings: {
        ...state.snapSettings,
        [snapType]: !state.snapSettings[snapType],
      },
    })),
    
  setSnapSettingsBatch: (settings) =>
    set((state) => ({
      snapSettings: {
        ...state.snapSettings,
        ...settings,
      },
    })),
    
  snapTolerance: 25, // Default snap tolerance in pixels
  
  // Point to Point Move state
  // Auto snap management
  autoSnapEnabled: false,
  setAutoSnapEnabled: (enabled) => set({ autoSnapEnabled: enabled }),
  
  enableAutoSnap: (tool) => {
    // Hiçbir şey yapma - snap ayarlarını değiştirme
    console.log(`🎯 Auto snap for ${tool} - no changes made`);
  },
  
  disableAutoSnap: () => {
    // Hiçbir şey yapma - snap ayarlarını değiştirme
    console.log('🎯 Auto snap disabled - no changes made');
  },
  
  pointToPointMoveState: {
    isActive: false,
    sourcePoint: null,
    targetPoint: null,
    selectedShapeId: null,
  },
  
  setPointToPointMoveState: (updates) =>
    set((state) => ({
      pointToPointMoveState: {
        ...state.pointToPointMoveState,
        ...updates,
      },
    })),
    
  resetPointToPointMove: () =>
    set({
      pointToPointMoveState: {
        isActive: false,
        sourcePoint: null,
        targetPoint: null,
        selectedShapeId: null,
      },
    }),

  convertToDisplayUnit: (value) => {
    const { measurementUnit } = get();
    return value / UNIT_CONVERSIONS[measurementUnit];
  },
  
  convertToBaseUnit: (value) => {
    const { measurementUnit } = get();
    return value * UNIT_CONVERSIONS[measurementUnit];
  },

  modifyShape: (id, params) => {
    const { shapes } = get();
    const shape = shapes.find(s => s.id === id);
    if (!shape) return;

    const newShapes: Shape[] = [...shapes];

    switch (params.type) {
      case ModificationType.MIRROR: {
        if (!params.mirror) return;
        const { axis, distance } = params.mirror;
        const mirroredShape: Shape = {
          ...shape,
          id: Math.random().toString(36).substr(2, 9),
          position: [...shape.position] as [number, number, number],
        };

        mirroredShape.position[axis === 'x' ? 0 : axis === 'y' ? 1 : 2] += distance;
        newShapes.push(mirroredShape);
        break;
      }

      case ModificationType.ARRAY: {
        if (!params.array) return;
        const { count, spacing, direction } = params.array;
        const dirIndex = direction === 'x' ? 0 : direction === 'y' ? 1 : 2;

        for (let i = 1; i < count; i++) {
          const newShape: Shape = {
            ...shape,
            id: Math.random().toString(36).substr(2, 9),
            position: [...shape.position] as [number, number, number],
          };
          newShape.position[dirIndex] += spacing * i;
          newShapes.push(newShape);
        }
        break;
      }

      case ModificationType.FILLET: {
        if (!params.fillet || shape.type !== 'box') return;
        const { radius } = params.fillet;
        const { width, height, depth } = shape.parameters;

        // Create new geometry with rounded corners
        const geometry = new THREE.BoxGeometry(
          width - radius * 2,
          height - radius * 2,
          depth - radius * 2
        );

        newShapes[shapes.indexOf(shape)] = {
          ...shape,
          geometry,
          parameters: {
            ...shape.parameters,
            radius,
          },
        };
        break;
      }

      case ModificationType.CHAMFER: {
        if (!params.chamfer || shape.type !== 'box') return;
        const { distance } = params.chamfer;
        const { width, height, depth } = shape.parameters;

        // Create new geometry with chamfered edges
        const geometry = new THREE.BoxGeometry(
          width - distance * 2,
          height - distance * 2,
          depth - distance * 2
        );

        newShapes[shapes.indexOf(shape)] = {
          ...shape,
          geometry,
          parameters: {
            ...shape.parameters,
            chamfer: distance,
          },
        };
        break;
      }
    }

    set({ shapes: newShapes });
  },
  
  shapes: [
    {
      id: '1',
      type: 'box',
      position: [-200, 250, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      geometry: new THREE.BoxGeometry(500, 500, 500),
      parameters: {
        width: 500,
        height: 500,
        depth: 500,
      },
    },
    {
      id: '2',
      type: 'box',
      position: [100, 250, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      geometry: new THREE.BoxGeometry(300, 300, 300),
      parameters: {
        width: 300,
        height: 300,
        depth: 300,
      },
    },
  ],
  
  addShape: (shape) => 
    set((state) => ({ 
      shapes: [...state.shapes, shape],
      selectedShapeId: shape.id,
    })),
    
  updateShape: (id, updates) =>
    set((state) => ({
      shapes: state.shapes.map((shape) =>
        shape.id === id ? { ...shape, ...updates } : shape
      ),
    })),
    
  deleteShape: (id) =>
    set((state) => ({
      shapes: state.shapes.filter((shape) => shape.id !== id),
      selectedShapeId: state.selectedShapeId === id ? null : state.selectedShapeId,
    })),
     
  performBooleanOperation: async (operation) => {
    const { shapes, selectedShapeId, updateShape, deleteShape } = get();
    if (!selectedShapeId) {
      console.warn('No shape selected for boolean operation');
      return;
    }
    
    const selectedShape = shapes.find(s => s.id === selectedShapeId);
    if (!selectedShape) {
      console.warn('Selected shape not found');
      return;
    }
    
    let success = false;
    if (operation === 'subtract') {
      success = await performBooleanSubtract(selectedShape, shapes, updateShape, deleteShape);
    } else if (operation === 'union') {
      success = await performBooleanUnion(selectedShape, shapes, updateShape, deleteShape);
    }
    
    if (success) {
      set({ selectedShapeId: null });
    }
  },
    
  selectedShapeId: null,
  selectShape: (id) => {
    const { activeTool, lastTransformTool } = get();
    
    // If selecting a shape while in SELECT mode, auto-switch to last transform tool
    if (id && activeTool === Tool.SELECT) {
      set({ 
        selectedShapeId: id,
        activeTool: lastTransformTool
      });
      console.log(`🎯 Auto-switched from SELECT to ${lastTransformTool} mode`);
    } else {
      set({ selectedShapeId: id });
    }
  },
  
  history: {
    past: [],
    future: [],
  },
  
  undo: () => 
    set((state) => {
      if (state.history.past.length === 0) return state;
      
      const newPast = [...state.history.past];
      const prevState = newPast.pop();
      
      if (!prevState) return state;
      
      return {
        ...prevState,
        history: {
          past: newPast,
          future: [
            {
              ...state,
              history: state.history,
            },
            ...state.history.future,
          ],
        },
      };
    }),
    
  redo: () =>
    set((state) => {
      if (state.history.future.length === 0) return state;
      
      const newFuture = [...state.history.future];
      const nextState = newFuture.shift();
      
      if (!nextState) return state;
      
      return {
        ...nextState,
        history: {
          past: [
            ...state.history.past,
            {
              ...state,
              history: state.history,
            },
          ],
          future: newFuture,
        },
      };
    }),
}));