import * as THREE from 'three';

export interface VertexModification {
  vertexIndex: number;
  originalPosition: [number, number, number];
  offset: [number, number, number];
  direction: 'x' | 'y' | 'z';
}

export interface ShapeVertexData {
  shapeId: string;
  modifications: VertexModification[];
}

export type VertexEditMode = 'select' | 'direction' | 'input';

export interface VertexState {
  selectedVertexIndex: number | null;
  hoveredVertexIndex: number | null;
  currentDirection: 'x' | 'y' | 'z';
  editMode: VertexEditMode;
  pendingOffset: number;
}
