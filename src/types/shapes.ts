import * as THREE from 'three';

export interface EdgeFormula {
  edgeIndex: number;
  edgeId: string;
  formula: string;
  originalLength: number;
  parameterName?: string;
  currentValue?: number;
}

export interface Shape {
  id: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  geometry: THREE.BufferGeometry;
  parameters: {
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
    points?: number;
    area?: string;
    chamfer?: number;
    [key: string]: any;
  };
  quaternion?: THREE.Quaternion;
  originalPoints?: THREE.Vector3[];
  is2DShape?: boolean;
  isReference?: boolean;
  mesh?: THREE.Mesh;
  edgeFormulas?: EdgeFormula[];
}

export const SHAPE_COLORS = {
  box: '#2563eb',
  cylinder: '#0d9488',
  rectangle2d: '#7c3aed',
  circle2d: '#dc2626',
  polyline2d: '#059669',
  polygon2d: '#ea580c',
  polyline3d: '#0891b2',
  polygon3d: '#c2410c',
  REFERENCE_CUBE: '#6b7280'
};