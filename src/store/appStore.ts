import { create } from 'zustand';
import { Shape } from '../types/shapes';
import * as THREE from 'three';

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

export enum ViewMode {
  WIREFRAME = 'wireframe',
  SOLID = 'solid'
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
  initialized: boolean; // OCC'nin yüklenip yüklenmediğini kontrol eder
  setInitialized: (initialized: boolean) => void;
  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;
  shapes: Shape[];
  setShapes: (shapes: Shape[]) => void; // Şekilleri toplu güncellemek için
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  selectedShapeId: string | null;
  selectShape: (id: string | null) => void;
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
  snapTolerance: number;
  setSnapTolerance: (tolerance: number) => void;
  editingPolylineId: string | null;
  setEditingPolylineId: (id: string | null) => void;
  isEditMode: boolean;
  setEditMode: (enabled: boolean) => void;
  editingShapeId: string | null;
  setEditingShapeId: (id: string | null) => void;
  hiddenShapeIds: string[];
  setHiddenShapeIds: (ids: string[]) => void;
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  cycleViewMode: () => void;
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
  initialized: false,
  setInitialized: (initialized) => set({ initialized }),
  activeTool: Tool.SELECT,
  setActiveTool: (tool) => set({ activeTool: tool }),
  
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
  
  isEditMode: false,
  setEditMode: (enabled) => set({ isEditMode: enabled }),
  
  editingShapeId: null,
  setEditingShapeId: (id) => set({ editingShapeId: id }),
  
  hiddenShapeIds: [],
  setHiddenShapeIds: (ids) => set({ hiddenShapeIds: ids }),
  
  viewMode: ViewMode.SOLID,
  setViewMode: (mode) => {
    set({ viewMode: mode });
    console.log(`View mode changed to: ${mode}`);
  },
  
  cycleViewMode: () => {
    const { viewMode } = get();
    const nextMode = viewMode === ViewMode.SOLID ? ViewMode.WIREFRAME : ViewMode.SOLID;
    
    set({ viewMode: nextMode });
    console.log(`🎯 View mode cycled from ${viewMode} to ${nextMode}`);
  },
  
  isAddPanelMode: false,
  setIsAddPanelMode: (enabled) => set({ isAddPanelMode: enabled }),
  
  isPanelEditMode: false,
  setIsPanelEditMode: (enabled) => set({ isPanelEditMode: enabled }),
  
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
    
  snapTolerance: 25,
  setSnapTolerance: (tolerance) => set({ snapTolerance: tolerance }),
  
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

    // ... (modifyShape içeriği aynı kalır)
  },
  
  shapes: [], // Başlangıçta boş bir dizi
  setShapes: (shapes) => set({ shapes }), // Yeni eklenen fonksiyon
  
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
    
  selectedShapeId: null,
  selectShape: (id) => set({ selectedShapeId: id }),
  
  history: {
    past: [],
    future: [],
  },
  
  undo: () => set((state) => { /* ... */ }),
  redo: () => set((state) => { /* ... */ }),
}));
