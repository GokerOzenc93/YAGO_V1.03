import * as THREE from 'three';
import { SnapType } from '../../store/appStore';

export interface EdgeParameter {
  edgeIndex: number;
  length: number;
  parameterCode?: string;
}

export interface CompletedShape {
  id: string;
  type: 'polyline' | 'polygon' | 'rectangle' | 'circle';
  points: THREE.Vector3[];
  dimensions: {
    width?: number;
    height?: number;
    radius?: number;
  };
  isClosed: boolean;
  edgeParameters?: EdgeParameter[];
}

export interface Dimension {
  id: string;
  position: THREE.Vector3;
  value: number;
  shapeId: string;
  offset: THREE.Vector3;
  type: 'width' | 'height' | 'radius';
}

export interface SnapPoint {
  point: THREE.Vector3;
  type: SnapType;
  shapeId?: string;
  distance: number;
}

export interface DrawingState {
  points: THREE.Vector3[];
  currentPoint: THREE.Vector3 | null;
  previewPoint: THREE.Vector3 | null;
  isDrawing: boolean;
  currentDirection: THREE.Vector3 | null;
  waitingForMeasurement: boolean;
  measurementApplied: boolean;
  snapPoint: SnapPoint | null;
}

export const INITIAL_DRAWING_STATE: DrawingState = {
  points: [],
  currentPoint: null,
  previewPoint: null,
  isDrawing: false,
  currentDirection: null,
  waitingForMeasurement: false,
  measurementApplied: false,
  snapPoint: null,
};