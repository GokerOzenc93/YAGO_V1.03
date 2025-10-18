import { create } from 'zustand';
import * as THREE from 'three';
import type { OpenCascadeInstance } from './vite-env';

export interface Shape {
  id: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  geometry: THREE.BufferGeometry;
  color?: string;
  parameters: Record<string, any>;
  ocShape?: any;
  isolated?: boolean;
}

export enum CameraType {
  PERSPECTIVE = 'perspective',
  ORTHOGRAPHIC = 'orthographic'
}

export enum Tool {
  SELECT = 'Select',
  MOVE = 'Move',
  ROTATE = 'Rotate',
  SCALE = 'Scale'
}

export enum ViewMode {
  WIREFRAME = 'wireframe',
  SOLID = 'solid'
}

interface AppState {
  shapes: Shape[];
  addShape: (shape: Shape) => void;
  updateShape: (id: string, updates: Partial<Shape>) => void;
  deleteShape: (id: string) => void;
  subtractShape: (targetId: string, subtractId: string) => void;
  copyShape: (id: string) => void;
  isolateShape: (id: string) => void;
  exitIsolation: () => void;

  selectedShapeId: string | null;
  selectShape: (id: string | null) => void;

  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;

  cameraType: CameraType;
  setCameraType: (type: CameraType) => void;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  opencascadeInstance: OpenCascadeInstance | null;
  opencascadeLoading: boolean;
  setOpenCascadeInstance: (instance: OpenCascadeInstance | null) => void;
  setOpenCascadeLoading: (loading: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  shapes: [],
  addShape: (shape) => set((state) => ({ shapes: [...state.shapes, shape] })),
  updateShape: (id, updates) =>
    set((state) => ({
      shapes: state.shapes.map((s) => (s.id === id ? { ...s, ...updates } : s))
    })),
  deleteShape: (id) =>
    set((state) => ({
      shapes: state.shapes.filter((s) => s.id !== id),
      selectedShapeId: state.selectedShapeId === id ? null : state.selectedShapeId
    })),
  subtractShape: async (targetId: string, subtractId: string) => {
    const state = get();
    const target = state.shapes.find((s) => s.id === targetId);
    const subtract = state.shapes.find((s) => s.id === subtractId);
    const oc = state.opencascadeInstance;

    if (!target || !subtract || !oc || !target.ocShape || !subtract.ocShape) {
      console.error('Cannot perform subtraction: missing shapes or OpenCascade');
      return;
    }

    try {
      const { performOCBoolean, convertOCShapeToThreeGeometry } = await import('./opencascade');

      const resultShape = performOCBoolean(oc, target.ocShape, subtract.ocShape, 'subtract');
      const resultGeometry = convertOCShapeToThreeGeometry(oc, resultShape);

      set((state) => ({
        shapes: state.shapes
          .filter((s) => s.id !== subtractId)
          .map((s) =>
            s.id === targetId
              ? {
                  ...s,
                  geometry: resultGeometry,
                  ocShape: resultShape,
                  parameters: { ...s.parameters, modified: true }
                }
              : s
          ),
        selectedShapeId: targetId
      }));

      console.log('✅ Boolean subtraction completed');
    } catch (error) {
      console.error('❌ Boolean subtraction failed:', error);
    }
  },

  copyShape: (id) => {
    const state = get();
    const shapeToCopy = state.shapes.find((s) => s.id === id);
    if (shapeToCopy) {
      const newShape = {
        ...shapeToCopy,
        id: `${shapeToCopy.type}-${Date.now()}`,
        position: [
          shapeToCopy.position[0] + 100,
          shapeToCopy.position[1],
          shapeToCopy.position[2] + 100
        ] as [number, number, number]
      };
      set((state) => ({ shapes: [...state.shapes, newShape] }));
    }
  },

  isolateShape: (id) =>
    set((state) => ({
      shapes: state.shapes.map((s) => ({
        ...s,
        isolated: s.id !== id ? false : undefined
      }))
    })),

  exitIsolation: () =>
    set((state) => ({
      shapes: state.shapes.map((s) => ({ ...s, isolated: undefined }))
    })),

  selectedShapeId: null,
  selectShape: (id) => set({ selectedShapeId: id }),

  activeTool: Tool.SELECT,
  setActiveTool: (tool) => set({ activeTool: tool }),

  cameraType: CameraType.PERSPECTIVE,
  setCameraType: (type) => set({ cameraType: type }),

  viewMode: ViewMode.WIREFRAME,
  setViewMode: (mode) => set({ viewMode: mode }),

  opencascadeInstance: null,
  opencascadeLoading: true,
  setOpenCascadeInstance: (instance) => set({ opencascadeInstance: instance }),
  setOpenCascadeLoading: (loading) => set({ opencascadeLoading: loading })
}));
