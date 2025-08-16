import * as THREE from 'three';

export interface Shape {
  id: string;
  type: string;
  position: [number, number, number];
  rotation: [number, number, number];
  scale: [number, number, number];
  // HATA DÜZELTMESİ: Geometri artık opsiyonel. Bileşen içinde oluşturulacak.
  geometry?: THREE.BufferGeometry;
  parameters: Record<string, any>;
  originalPoints?: THREE.Vector3[]; // For 2D shapes converted to 3D
  is2DShape?: boolean; // Mark if this is a converted 2D shape
  quaternion?: THREE.Quaternion; // For accurate face calculations
}

export interface BoxParameters {
  width: number;
  height: number;
  depth: number;
}

export interface CylinderParameters {
  radius: number;
  height: number;
}

export const SHAPE_COLORS = {
  box: "#2563eb",
  cylinder: "#0d9488",
  rectangle2d: "#10b981",
  circle2d: "#8b5cf6",
  polyline2d: "#f59e0b",
  polyline3d: "#ef4444",
  polygon2d: "#06b6d4",
  polygon3d: "#8b5cf6",
};
