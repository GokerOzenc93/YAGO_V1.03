import * as THREE from 'three';

export interface CompletedShape {
  id: string;
  type: 'polyline' | 'rectangle' | 'circle' | 'polygon';
  points: THREE.Vector3[];
  center?: THREE.Vector3;
  radius?: number;
  dimensions?: {
    width?: number;
    height?: number;
    depth?: number;
  };
}

export interface DrawingState {
  points: THREE.Vector3[];
  previewPoint: THREE.Vector3 | null;
  isDrawing: boolean;
  snapPoint: any;
  hoveredSnapPoint: any;
  currentDimension: any;
}

export const INITIAL_DRAWING_STATE: DrawingState = {
  points: [],
  previewPoint: null,
  isDrawing: false,
  snapPoint: null,
  hoveredSnapPoint: null,
  currentDimension: null,
};
