import * as THREE from 'three';
import { SnapType } from '../../store/appStore';

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

export interface EdgeInfo {
  startPoint: THREE.Vector3;
  endPoint: THREE.Vector3;
  midPoint: THREE.Vector3;
  length: number;
  direction: THREE.Vector3;
  edgeIndex: number;
  shapeId: string;
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
  selectedEdge: EdgeInfo | null;
  hoveredEdge: EdgeInfo | null;
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
  selectedEdge: null,
  hoveredEdge: null,
};