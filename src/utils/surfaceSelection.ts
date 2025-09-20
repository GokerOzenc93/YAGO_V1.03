import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';
(THREE.Mesh as any).prototype.raycast = acceleratedRaycast;

// Enhanced surface selection system with color-based identification and persistence

export interface SurfaceSelection {
  id: string;
  shapeId: string;
  faceIndex: number;
  surfaceVertices: THREE.Vector3[];
  highlightMesh: THREE.Mesh;
  textMesh?: THREE.Mesh;
  color: number;
  isPersistent: boolean;
  label?: string;
  createdAt: number;
}

// Global state for surface selections
let activeSurfaceSelections: Map<string, SurfaceSelection> = new Map();
let isSelectionMode = false;
let currentHoverSelection: SurfaceSelection | null = null;

/**
 * Primary Surface Selection Function - Main entry point for surface selection
 * This is the reusable function that will be called throughout the application
 */
export const initializeSurfaceSelection = (
  scene: THREE.Scene,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  options: {
    onSurfaceSelected?: (selection: SurfaceSelection) => void;
    onSurfacePersisted?: (selection: SurfaceSelection) => void;
    defaultColor?: number;
    enableLabels?: boolean;
  } = {}
) => {
  const {
    onSurfaceSelected,
    onSurfacePersisted,
    defaultColor = 0xff6b35, // Orange color
    enableLabels = true
  } = options;

  console.log('🎯 Surface Selection System Initialized');

  // Left-click handler - Highlight surface
  const handleLeftClick = (event: MouseEvent) => {
    if (!isSelectionMode) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    const intersection = getMouseIntersection(event, camera, canvas, scene);
    if (!intersection) return;

    // Clear current hover selection if exists
    if (currentHoverSelection) {
      clearHoverSelection(scene);
    }

    // Create new surface selection
    const surfaceSelection = createSurfaceSelection(
      intersection,
      scene,
      defaultColor,
      false, // Not persistent yet
      enableLabels
    );

    if (surfaceSelection) {
      currentHoverSelection = surfaceSelection;
      console.log('🎯 Surface highlighted (left-click):', surfaceSelection.id);
      
      if (onSurfaceSelected) {
        onSurfaceSelected(surfaceSelection);
      }
    }
  };

  // Right-click handler - Persist surface
  const handleRightClick = (event: MouseEvent) => {
    if (!isSelectionMode) return;
    
    event.preventDefault();
    event.stopPropagation();
    
    // If we have a hover selection, make it persistent
    if (currentHoverSelection) {
      makeSurfacePersistent(currentHoverSelection, scene);
      
      // Add to active selections
      activeSurfaceSelections.set(currentHoverSelection.id, currentHoverSelection);
      
      console.log('🎯 Surface persisted (right-click):', currentHoverSelection.id);
      
      if (onSurfacePersisted) {
        onSurfacePersisted(currentHoverSelection);
      }
      
      // Clear hover selection reference (it's now persistent)
      currentHoverSelection = null;
    } else {
      // Try to create and immediately persist a new selection
      const intersection = getMouseIntersection(event, camera, canvas, scene);
      if (!intersection) return;

      const surfaceSelection = createSurfaceSelection(
        intersection,
        scene,
        defaultColor,
        true, // Immediately persistent
        enableLabels
      );

      if (surfaceSelection) {
        activeSurfaceSelections.set(surfaceSelection.id, surfaceSelection);
        console.log('🎯 Surface created and persisted (right-click):', surfaceSelection.id);
        
        if (onSurfacePersisted) {
          onSurfacePersisted(surfaceSelection);
        }
      }
    }
  };

  // Add event listeners
  canvas.addEventListener('click', handleLeftClick);
  canvas.addEventListener('contextmenu', handleRightClick);

  // Return cleanup function
  return () => {
    canvas.removeEventListener('click', handleLeftClick);
    canvas.removeEventListener('contextmenu', handleRightClick);
    clearAllSelections(scene);
  };
};

/**
 * Enable/Disable surface selection mode
 */
export const setSurfaceSelectionMode = (enabled: boolean) => {
  isSelectionMode = enabled;
  console.log(`🎯 Surface selection mode: ${enabled ? 'ENABLED' : 'DISABLED'}`);
};

/**
 * Get mouse intersection with 3D objects
 */
const getMouseIntersection = (
  event: MouseEvent,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  scene: THREE.Scene
): THREE.Intersection | null => {
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2();
  
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  // Get all meshes in scene (excluding existing highlights)
  const meshes: THREE.Mesh[] = [];
  scene.traverse((object) => {
    if (object instanceof THREE.Mesh && 
        object.geometry && 
        !object.userData.isSurfaceHighlight) {
      meshes.push(object);
    }
  });
  
  const intersects = raycaster.intersectObjects(meshes, false);
  
  if (intersects.length > 0) {
    console.log('🎯 Surface intersection detected:', {
      faceIndex: intersects[0].faceIndex,
      distance: intersects[0].distance.toFixed(2)
    });
    return intersects[0];
  }
  
  return null;
};

/**
 * Create surface selection from intersection
 */
const createSurfaceSelection = (
  intersection: THREE.Intersection,
  scene: THREE.Scene,
  color: number,
  isPersistent: boolean,
  enableLabels: boolean
): SurfaceSelection | null => {
  if (!intersection.face || intersection.faceIndex === undefined) {
    console.warn('🎯 Invalid intersection for surface selection');
    return null;
  }

  const mesh = intersection.object as THREE.Mesh;
  const geometry = mesh.geometry as THREE.BufferGeometry;
  
  // Get surface vertices using flood-fill algorithm
  const surfaceVertices = getSurfaceVertices(geometry, intersection.faceIndex, mesh.matrixWorld);
  
  if (surfaceVertices.length === 0) {
    console.warn('🎯 No surface vertices found');
    return null;
  }

  // Create highlight mesh
  const highlightMesh = createHighlightMesh(surfaceVertices, color, isPersistent);
  highlightMesh.userData.isSurfaceHighlight = true;
  
  // Create text label if enabled
  let textMesh: THREE.Mesh | undefined;
  if (enableLabels) {
    const surfaceCenter = calculateSurfaceCenter(surfaceVertices);
    textMesh = createTextLabel(
      `Surface ${activeSurfaceSelections.size + 1}`,
      surfaceCenter,
      color
    );
    textMesh.userData.isSurfaceHighlight = true;
  }

  // Add to scene
  scene.add(highlightMesh);
  if (textMesh) {
    scene.add(textMesh);
  }

  const selection: SurfaceSelection = {
    id: generateSelectionId(),
    shapeId: mesh.userData.shapeId || mesh.uuid,
    faceIndex: intersection.faceIndex,
    surfaceVertices,
    highlightMesh,
    textMesh,
    color,
    isPersistent,
    createdAt: Date.now()
  };

  console.log('🎯 Surface selection created:', {
    id: selection.id,
    vertices: surfaceVertices.length,
    persistent: isPersistent
  });

  return selection;
};

/**
 * Make surface selection persistent
 */
const makeSurfacePersistent = (selection: SurfaceSelection, scene: THREE.Scene) => {
  selection.isPersistent = true;
  
  // Update highlight material for persistence
  const material = selection.highlightMesh.material as THREE.MeshBasicMaterial;
  material.opacity = 0.8; // Slightly more opaque for persistent selections
  material.color.setHex(selection.color);
  
  // Update text if exists
  if (selection.textMesh) {
    const textMaterial = selection.textMesh.material as THREE.MeshBasicMaterial;
    textMaterial.opacity = 1.0;
  }
  
  console.log('🎯 Surface made persistent:', selection.id);
};

/**
 * Get surface vertices using improved flood-fill algorithm
 */
const getSurfaceVertices = (
  geometry: THREE.BufferGeometry,
  startFaceIndex: number,
  worldMatrix: THREE.Matrix4
): THREE.Vector3[] => {
  const positions = geometry.attributes.position;
  const index = geometry.index;
  
  if (!positions || !index) {
    console.warn('🎯 Invalid geometry for surface detection');
    return [];
  }

  // Enhanced flood-fill with relaxed tolerances
  const NORMAL_TOLERANCE = THREE.MathUtils.degToRad(8); // 8 degrees
  const DISTANCE_TOLERANCE = 50; // 50mm
  
  const visited = new Set<number>();
  const surfaceFaces: number[] = [];
  const queue = [startFaceIndex];
  
  // Get starting face normal and center
  const startVertices = getFaceVertices(geometry, startFaceIndex);
  const startNormal = getFaceNormal(startVertices).normalize();
  const startCenter = getFaceCenter(startVertices);
  
  // Create reference plane
  const planeNormal = startNormal.clone();
  const planeD = -planeNormal.dot(startCenter);
  
  // Flood-fill algorithm
  while (queue.length > 0) {
    const faceIndex = queue.shift()!;
    if (visited.has(faceIndex)) continue;
    
    visited.add(faceIndex);
    surfaceFaces.push(faceIndex);
    
    // Get neighbors
    const neighbors = getNeighborFaces(geometry, faceIndex);
    
    for (const neighborIndex of neighbors) {
      if (visited.has(neighborIndex)) continue;
      
      const neighborVertices = getFaceVertices(geometry, neighborIndex);
      const neighborNormal = getFaceNormal(neighborVertices).normalize();
      const neighborCenter = getFaceCenter(neighborVertices);
      
      // Check normal angle (bidirectional)
      const normalAngle = Math.min(
        neighborNormal.angleTo(startNormal),
        neighborNormal.angleTo(startNormal.clone().negate())
      );
      
      // Check plane distance
      const distanceToPlane = Math.abs(planeNormal.dot(neighborCenter) + planeD);
      
      if (normalAngle < NORMAL_TOLERANCE && distanceToPlane < DISTANCE_TOLERANCE) {
        queue.push(neighborIndex);
      }
    }
  }
  
  // Convert face vertices to world space
  const allVertices: THREE.Vector3[] = [];
  const uniqueVerticesMap = new Map<string, THREE.Vector3>();
  
  surfaceFaces.forEach(faceIndex => {
    const vertices = getFaceVertices(geometry, faceIndex);
    vertices.forEach(vertex => {
      const worldVertex = vertex.clone().applyMatrix4(worldMatrix);
      const key = `${worldVertex.x.toFixed(4)},${worldVertex.y.toFixed(4)},${worldVertex.z.toFixed(4)}`;
      if (!uniqueVerticesMap.has(key)) {
        uniqueVerticesMap.set(key, worldVertex);
        allVertices.push(worldVertex);
      }
    });
  });
  
  console.log(`🎯 Surface detection: ${surfaceFaces.length} faces, ${allVertices.length} vertices`);
  return allVertices;
};

/**
 * Helper functions for geometry processing
 */
const getFaceVertices = (geometry: THREE.BufferGeometry, faceIndex: number): THREE.Vector3[] => {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  
  if (!pos || !index) return [];
  
  const vertices: THREE.Vector3[] = [];
  const a = faceIndex * 3;
  
  for (let i = 0; i < 3; i++) {
    const vertexIndex = index.getX(a + i);
    const vertex = new THREE.Vector3().fromBufferAttribute(pos, vertexIndex);
    vertices.push(vertex);
  }
  
  return vertices;
};

const getFaceNormal = (vertices: THREE.Vector3[]): THREE.Vector3 => {
  if (vertices.length < 3) return new THREE.Vector3(0, 1, 0);
  
  const v1 = new THREE.Vector3().subVectors(vertices[1], vertices[0]);
  const v2 = new THREE.Vector3().subVectors(vertices[2], vertices[0]);
  
  return new THREE.Vector3().crossVectors(v1, v2).normalize();
};

const getFaceCenter = (vertices: THREE.Vector3[]): THREE.Vector3 => {
  const center = new THREE.Vector3();
  vertices.forEach(vertex => center.add(vertex));
  center.divideScalar(vertices.length);
  return center;
};

const getNeighborFaces = (geometry: THREE.BufferGeometry, faceIndex: number): number[] => {
  const neighbors: number[] = [];
  const totalFaces = geometry.index!.count / 3;
  const EPSILON = 1e-4;
  
  const thisVerts = getFaceVertices(geometry, faceIndex);
  if (thisVerts.length === 0) return neighbors;
  
  for (let i = 0; i < totalFaces; i++) {
    if (i === faceIndex) continue;
    
    const otherVerts = getFaceVertices(geometry, i);
    if (otherVerts.length === 0) continue;
    
    // Count shared vertices
    let sharedCount = 0;
    for (const v1 of thisVerts) {
      for (const v2 of otherVerts) {
        if (v1.distanceToSquared(v2) < EPSILON) {
          sharedCount++;
          break;
        }
      }
    }
    
    // Two shared vertices = adjacent faces
    if (sharedCount === 2) {
      neighbors.push(i);
    }
  }
  
  return neighbors;
};

/**
 * Create highlight mesh for surface
 */
const createHighlightMesh = (
  vertices: THREE.Vector3[],
  color: number,
  isPersistent: boolean
): THREE.Mesh => {
  const geometry = new THREE.BufferGeometry();
  const positions = new Float32Array(vertices.length * 3);
  
  vertices.forEach((vertex, i) => {
    positions[i * 3] = vertex.x;
    positions[i * 3 + 1] = vertex.y;
    positions[i * 3 + 2] = vertex.z;
  });
  
  geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
  
  // Create triangulation
  const indices: number[] = [];
  if (vertices.length >= 3) {
    for (let i = 1; i < vertices.length - 1; i++) {
      indices.push(0, i, i + 1);
    }
  }
  
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  const material = new THREE.MeshBasicMaterial({
    color: color,
    transparent: true,
    opacity: isPersistent ? 0.8 : 0.6,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false
  });
  
  const mesh = new THREE.Mesh(geometry, material);
  mesh.renderOrder = isPersistent ? 1001 : 1000;
  
  return mesh;
};

/**
 * Create text label for surface
 */
const createTextLabel = (
  text: string,
  position: THREE.Vector3,
  color: number
): THREE.Mesh => {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d')!;
  
  canvas.width = 256;
  canvas.height = 128;
  
  // Clear canvas
  context.clearRect(0, 0, canvas.width, canvas.height);
  
  // Set text properties
  context.font = 'bold 32px Arial';
  context.fillStyle = '#ffffff';
  context.strokeStyle = '#000000';
  context.lineWidth = 4;
  context.textAlign = 'center';
  context.textBaseline = 'middle';
  
  // Draw text with outline
  context.strokeText(text, canvas.width / 2, canvas.height / 2);
  context.fillText(text, canvas.width / 2, canvas.height / 2);
  
  // Create texture and material
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  
  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false
  });
  
  // Create plane geometry
  const geometry = new THREE.PlaneGeometry(100, 50);
  const mesh = new THREE.Mesh(geometry, material);
  
  // Position above surface
  mesh.position.copy(position);
  mesh.position.y += 75;
  mesh.renderOrder = 1002;
  
  return mesh;
};

/**
 * Calculate surface center
 */
const calculateSurfaceCenter = (vertices: THREE.Vector3[]): THREE.Vector3 => {
  const center = new THREE.Vector3();
  vertices.forEach(vertex => center.add(vertex));
  center.divideScalar(vertices.length);
  return center;
};

/**
 * Generate unique selection ID
 */
const generateSelectionId = (): string => {
  return `surface_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Clear hover selection
 */
const clearHoverSelection = (scene: THREE.Scene) => {
  if (currentHoverSelection && !currentHoverSelection.isPersistent) {
    scene.remove(currentHoverSelection.highlightMesh);
    if (currentHoverSelection.textMesh) {
      scene.remove(currentHoverSelection.textMesh);
    }
    
    // Dispose resources
    currentHoverSelection.highlightMesh.geometry.dispose();
    (currentHoverSelection.highlightMesh.material as THREE.Material).dispose();
    
    if (currentHoverSelection.textMesh) {
      currentHoverSelection.textMesh.geometry.dispose();
      (currentHoverSelection.textMesh.material as THREE.Material).dispose();
    }
    
    currentHoverSelection = null;
  }
};

/**
 * Clear all selections
 */
export const clearAllSelections = (scene: THREE.Scene) => {
  // Clear hover selection
  clearHoverSelection(scene);
  
  // Clear persistent selections
  activeSurfaceSelections.forEach(selection => {
    scene.remove(selection.highlightMesh);
    if (selection.textMesh) {
      scene.remove(selection.textMesh);
    }
    
    // Dispose resources
    selection.highlightMesh.geometry.dispose();
    (selection.highlightMesh.material as THREE.Material).dispose();
    
    if (selection.textMesh) {
      selection.textMesh.geometry.dispose();
      (selection.textMesh.material as THREE.Material).dispose();
    }
  });
  
  activeSurfaceSelections.clear();
  console.log('🎯 All surface selections cleared');
};

/**
 * Get all active selections
 */
export const getActiveSelections = (): SurfaceSelection[] => {
  return Array.from(activeSurfaceSelections.values());
};

/**
 * Remove specific selection
 */
export const removeSelection = (selectionId: string, scene: THREE.Scene): boolean => {
  const selection = activeSurfaceSelections.get(selectionId);
  if (!selection) return false;
  
  scene.remove(selection.highlightMesh);
  if (selection.textMesh) {
    scene.remove(selection.textMesh);
  }
  
  // Dispose resources
  selection.highlightMesh.geometry.dispose();
  (selection.highlightMesh.material as THREE.Material).dispose();
  
  if (selection.textMesh) {
    selection.textMesh.geometry.dispose();
    (selection.textMesh.material as THREE.Material).dispose();
  }
  
  activeSurfaceSelections.delete(selectionId);
  console.log('🎯 Surface selection removed:', selectionId);
  
  return true;
};