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

  selectedShapeId: string | null;
  selectShape: (id: string | null) => void;

  activeTool: Tool;
  setActiveTool: (tool: Tool) => void;

  cameraType: CameraType;
  setCameraType: (type: CameraType) => void;

  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;

  opencascadeInstance: OpenCascadeInstance | null;
  setOpenCascadeInstance: (instance: OpenCascadeInstance | null) => void;
}

export const useAppStore = create<AppState>((set) => ({
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

  selectedShapeId: null,
  selectShape: (id) => set({ selectedShapeId: id }),

  activeTool: Tool.SELECT,
  setActiveTool: (tool) => set({ activeTool: tool }),

  cameraType: CameraType.PERSPECTIVE,
  setCameraType: (type) => set({ cameraType: type }),

  viewMode: ViewMode.WIREFRAME,
  setViewMode: (mode) => set({ viewMode: mode }),

  opencascadeInstance: null,
  setOpenCascadeInstance: (instance) => set({ opencascadeInstance: instance })
}));
