import * as THREE from 'three';

export interface VertexModification {
  vertexIndex: number;
  originalPosition: [number, number, number];
  newPosition: [number, number, number];
  direction: 'x+' | 'x-' | 'y+' | 'y-' | 'z+' | 'z-';
  expression?: string;
  description?: string;
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
