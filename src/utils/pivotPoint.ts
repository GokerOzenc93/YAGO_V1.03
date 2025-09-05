import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { useAppStore, SnapType } from '../store/appStore';

export interface PivotPoint {
  shapeId: string;
  position: THREE.Vector3;
  isCustom: boolean;
}

// Global pivot points storage
const pivotPoints = new Map<string, PivotPoint>();

/**
 * Get pivot point for a shape
 */
export const getPivotPoint = (shape: Shape): THREE.Vector3 => {
  const customPivot = pivotPoints.get(shape.id);
  if (customPivot) {
    return customPivot.position.clone();
  }
  
  // Default pivot point is shape center
  return new THREE.Vector3(...shape.position);
};

/**
 * Set custom pivot point for a shape
 */
export const setPivotPoint = (shapeId: string, worldPosition: THREE.Vector3): void => {
  pivotPoints.set(shapeId, {
    shapeId,
    position: worldPosition.clone(),
    isCustom: true
  });
  
  console.log(`🎯 Custom pivot point set for shape ${shapeId}:`, worldPosition.toArray().map(v => v.toFixed(1)));
};

/**
 * Reset pivot point to shape center
 */
export const resetPivotPoint = (shapeId: string): void => {
  pivotPoints.delete(shapeId);
  console.log(`🎯 Pivot point reset to center for shape ${shapeId}`);
};

/**
 * Check if shape has custom pivot point
 */
export const hasCustomPivotPoint = (shapeId: string): boolean => {
  return pivotPoints.has(shapeId);
};

/**
 * Get all pivot points (for debugging)
 */
export const getAllPivotPoints = (): Map<string, PivotPoint> => {
  return new Map(pivotPoints);
};

/**
 * Clear all pivot points
 */
export const clearAllPivotPoints = (): void => {
  pivotPoints.clear();
  console.log('🎯 All pivot points cleared');
};

/**
 * Enable snap settings for pivot point selection
 */
export const enablePivotSnapSettings = (): void => {
  const { setSnapSettingsBatch } = useAppStore.getState();
  
  // Enable all snap types for precise pivot point selection
  setSnapSettingsBatch({
    [SnapType.ENDPOINT]: true,
    [SnapType.MIDPOINT]: true,
    [SnapType.CENTER]: true,
    [SnapType.QUADRANT]: true,
    [SnapType.PERPENDICULAR]: true,
    [SnapType.INTERSECTION]: true,
    [SnapType.NEAREST]: true,
  });
  
  console.log('🎯 Snap settings enabled for pivot point selection');
};

/**
 * Pivot point selection state
 */
export interface PivotSelectionState {
  isActive: boolean;
  targetShapeId: string | null;
  originalSnapSettings: any;
}

let pivotSelectionState: PivotSelectionState = {
  isActive: false,
  targetShapeId: null,
  originalSnapSettings: null
};

/**
 * Start pivot point selection mode
 */
export const startPivotPointSelection = (shapeId: string): void => {
  const { snapSettings, setSnapSettingsBatch, setActiveTool } = useAppStore.getState();
  
  // Store original snap settings
  pivotSelectionState.originalSnapSettings = { ...snapSettings };
  pivotSelectionState.isActive = true;
  pivotSelectionState.targetShapeId = shapeId;
  
  // Enable all snap settings
  enablePivotSnapSettings();
  
  // Switch to SELECT tool for point selection
  setActiveTool('Select' as any);
  
  console.log(`🎯 Pivot point selection started for shape ${shapeId}`);
};

/**
 * End pivot point selection mode
 */
export const endPivotPointSelection = (): void => {
  if (!pivotSelectionState.isActive) return;
  
  const { setSnapSettingsBatch } = useAppStore.getState();
  
  // Restore original snap settings
  if (pivotSelectionState.originalSnapSettings) {
    setSnapSettingsBatch(pivotSelectionState.originalSnapSettings);
  }
  
  pivotSelectionState.isActive = false;
  pivotSelectionState.targetShapeId = null;
  pivotSelectionState.originalSnapSettings = null;
  
  console.log('🎯 Pivot point selection ended');
};

/**
 * Get current pivot selection state
 */
export const getPivotSelectionState = (): PivotSelectionState => {
  return { ...pivotSelectionState };
};

/**
 * Handle pivot point selection from world position
 */
export const handlePivotPointSelection = (worldPosition: THREE.Vector3): boolean => {
  if (!pivotSelectionState.isActive || !pivotSelectionState.targetShapeId) {
    return false;
  }
  
  // Set the new pivot point
  setPivotPoint(pivotSelectionState.targetShapeId, worldPosition);
  
  // End selection mode
  endPivotPointSelection();
  
  return true;
};

/**
 * Create visual indicator for pivot point
 */
export const createPivotPointIndicator = (position: THREE.Vector3): THREE.Group => {
  const group = new THREE.Group();
  
  // Main sphere
  const sphereGeometry = new THREE.SphereGeometry(8, 16, 16);
  const sphereMaterial = new THREE.MeshBasicMaterial({ 
    color: 0xff6b35, 
    transparent: true, 
    opacity: 0.8 
  });
  const sphere = new THREE.Mesh(sphereGeometry, sphereMaterial);
  group.add(sphere);
  
  // Cross lines
  const lineGeometry = new THREE.BufferGeometry();
  const linePositions = new Float32Array([
    -15, 0, 0,  15, 0, 0,  // X axis
    0, -15, 0,  0, 15, 0,  // Y axis
    0, 0, -15,  0, 0, 15   // Z axis
  ]);
  lineGeometry.setAttribute('position', new THREE.BufferAttribute(linePositions, 3));
  
  const lineMaterial = new THREE.LineBasicMaterial({ 
    color: 0xff6b35, 
    linewidth: 2 
  });
  const lines = new THREE.LineSegments(lineGeometry, lineMaterial);
  group.add(lines);
  
  group.position.copy(position);
  
  return group;
};