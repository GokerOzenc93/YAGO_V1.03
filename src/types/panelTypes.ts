export interface PanelData {
  id: string;
  position: THREE.Vector3;
  rotation: THREE.Euler;
  size: THREE.Vector3;
  normal: THREE.Vector3;
}

export interface FaceCycleState {
  selectedFace: number | null;
  currentIndex: number;
  availableFaces: number[];
  mousePosition: { x: number; y: number } | null;
}