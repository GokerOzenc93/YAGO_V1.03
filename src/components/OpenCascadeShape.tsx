import React, { useRef, useEffect, useMemo, useState, useCallback } from 'react';
import { useAppStore } from '../store/appStore';
import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
// Assuming Shape type is correctly imported from '../types/shapes'
// import { Shape } from '../types/shapes'; 
// import { SHAPE_COLORS } from '../types/shapes';
// import { ViewMode } from '../store/appStore';

// Placeholder interfaces/types if not available in the environment
interface Shape {
    type: 'box' | 'rectangle2d' | 'cylinder' | 'circle2d' | 'polyline2d' | 'polygon2d' | 'polyline3d' | 'polygon3d';
    parameters: {
        width?: number;
        height?: number;
        depth?: number;
        radius?: number;
        [key: string]: any;
    };
    scale: [number, number, number];
    position: [number, number, number];
    rotation: [number, number, number];
    quaternion?: THREE.Quaternion;
    originalPoints?: THREE.Vector3[];
    geometry: THREE.BufferGeometry;
    mesh?: THREE.Mesh; // Reference to the THREE.Mesh object in the scene
    id: string;
}

enum ViewMode {
    SOLID,
    WIREFRAME
}

const SHAPE_COLORS = {
    box: '#f87171',
    rectangle2d: '#f87171',
    cylinder: '#60a5fa',
    circle2d: '#60a5fa',
    polyline2d: '#34d399',
    polygon2d: '#34d399',
    polyline3d: '#a78bfa',
    polygon3d: '#a78bfa',
};

// Utility functions (copied from your provided `faceSelection.ts` and `volumeEdit.ts` logic)
// These would ideally be imported, but are included here for a self-contained example.

export interface FaceHighlight {
    mesh: THREE.Mesh;
    faceIndex: number;
    shapeId: string;
}

let currentHighlight: FaceHighlight | null = null; // Global state for highlight mesh

export const getFaceVertices = (geometry: THREE.BufferGeometry, faceIndex: number): THREE.Vector3[] => {
    const pos = geometry.attributes.position;
    const index = geometry.index;
    if (!pos) { console.warn('Geometry has no position attribute'); return []; }
    const a = faceIndex * 3;
    const vertices: THREE.Vector3[] = [];
    try {
        if (index) { for (let i = 0; i < 3; i++) { const vertexIndex = index.getX(a + i); const vertex = new THREE.Vector3().fromBufferAttribute(pos, vertexIndex); vertices.push(vertex); } }
        else { for (let i = 0; i < 3; i++) { const vertex = new THREE.Vector3().fromBufferAttribute(pos, a + i); vertices.push(vertex); } }
    } catch (error) { console.warn('Error getting face vertices:', error); return []; }
    return vertices;
};

export const getFaceNormal = (vertices: THREE.Vector3[]): THREE.Vector3 => {
    if (vertices.length < 3) return new THREE.Vector3(0, 1, 0);
    const v1 = new THREE.Vector3().subVectors(vertices[1], vertices[0]);
    const v2 = new THREE.Vector3().subVectors(vertices[2], vertices[0]);
    return new THREE.Vector3().crossVectors(v1, v2).normalize();
};

export const getFaceCenter = (vertices: THREE.Vector3[]): THREE.Vector3 => {
    const center = new THREE.Vector3();
    vertices.forEach(vertex => center.add(vertex));
    center.divideScalar(vertices.length);
    return center;
};

const EPSILON = 1e-4;
const verticesEqual = (v1: THREE.Vector3, v2: THREE.Vector3): boolean => v1.distanceToSquared(v2) < EPSILON;

const getNeighborFaces = (geometry: THREE.BufferGeometry, faceIndex: number): number[] => {
    const neighbors: number[] = [];
    const totalFaces = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
    const thisVerts = getFaceVertices(geometry, faceIndex);
    if (thisVerts.length === 0) return neighbors;
    for (let i = 0; i < totalFaces; i++) {
        if (i === faceIndex) continue;
        const otherVerts = getFaceVertices(geometry, i);
        if (otherVerts.length === 0) continue;
        let sharedCount = 0;
        for (const v1 of thisVerts) {
            for (const v2 of otherVerts) {
                if (verticesEqual(v1, v2)) { sharedCount++; break; }
            }
        }
        if (sharedCount === 2) { neighbors.push(i); }
    }
    return neighbors;
};

export const getFullSurfaceVertices = (geometry: THREE.BufferGeometry, startFaceIndex: number): THREE.Vector3[] => {
    const pos = geometry.attributes.position;
    if (!pos) return [];
    const startVertices = getFaceVertices(geometry, startFaceIndex);
    const startNormal = getFaceNormal(startVertices).normalize();
    const startCenter = getFaceCenter(startVertices);
    const visited = new Set<number>();
    const surfaceFaces: number[] = [];
    const queue = [startFaceIndex];
    const NORMAL_TOLERANCE = THREE.MathUtils.degToRad(3);
    const DISTANCE_TOLERANCE = 2.0;
    const planeNormal = startNormal.clone();
    const planePoint = startCenter.clone();
    const planeD = -planeNormal.dot(planePoint);
    while (queue.length > 0) {
        const faceIndex = queue.shift()!;
        if (visited.has(faceIndex)) continue;
        visited.add(faceIndex);
        surfaceFaces.push(faceIndex);
        const neighbors = getNeighborFaces(geometry, faceIndex);
        for (const neighborIndex of neighbors) {
            if (visited.has(neighborIndex)) continue;
            const neighborVertices = getFaceVertices(geometry, neighborIndex);
            const neighborNormal = getFaceNormal(neighborVertices).normalize();
            const neighborCenter = getFaceCenter(neighborVertices);
            const normalAngle = Math.min(neighborNormal.angleTo(startNormal), neighborNormal.angleTo(startNormal.clone().negate()));
            const distanceToPlane = Math.abs(planeNormal.dot(neighborCenter) + planeD);
            if (normalAngle < NORMAL_TOLERANCE && distanceToPlane < DISTANCE_TOLERANCE) { queue.push(neighborIndex); }
        }
    }
    const allVertices: THREE.Vector3[] = [];
    const uniqueVerticesMap = new Map<string, THREE.Vector3>();
    surfaceFaces.forEach(faceIndex => {
        const vertices = getFaceVertices(geometry, faceIndex);
        vertices.forEach(vertex => {
            const key = `${vertex.x.toFixed(4)},${vertex.y.toFixed(4)},${vertex.z.toFixed(4)}`;
            if (!uniqueVerticesMap.has(key)) { uniqueVerticesMap.set(key, vertex); allVertices.push(vertex); }
        });
    });
    return allVertices;
};

export const createFaceHighlight = (vertices: THREE.Vector3[], worldMatrix: THREE.Matrix4, color: number = 0xff6b35, opacity: number = 0.6): THREE.Mesh => {
    const worldVertices = vertices.map(v => v.clone().applyMatrix4(worldMatrix));
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(worldVertices.length * 3);
    worldVertices.forEach((vertex, i) => { positions[i * 3] = vertex.x; positions[i * 3 + 1] = vertex.y; positions[i * 3 + 2] = vertex.z; });
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const indices: number[] = [];
    if (worldVertices.length >= 3) { for (let i = 1; i < worldVertices.length - 1; i++) { indices.push(0, i, i + 1); } }
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    const material = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: Math.min(opacity + 0.2, 0.9), side: THREE.DoubleSide, depthTest: true, depthWrite: false, wireframe: false });
    return new THREE.Mesh(geometry, material);
};

export const clearFaceHighlight = (scene: THREE.Scene) => {
    if (currentHighlight) {
        scene.remove(currentHighlight.mesh);
        currentHighlight.mesh.geometry.dispose();
        (currentHighlight.mesh.material as THREE.Material).dispose();
        currentHighlight = null;
    }
};

export const highlightFace = (scene: THREE.Scene, hit: THREE.Intersection, shape: Shape, color: number = 0xff6b35, opacity: number = 0.6): FaceHighlight | null => {
    clearFaceHighlight(scene);
    if (!hit.face || hit.faceIndex === undefined) { console.warn('No face data in intersection'); return null; }
    const mesh = hit.object as THREE.Mesh;
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const fullSurfaceVertices = getFullSurfaceVertices(geometry, hit.faceIndex);
    const surfaceVertices = fullSurfaceVertices.length >= 3 ? fullSurfaceVertices : getFaceVertices(geometry, hit.faceIndex);
    if (surfaceVertices.length < 3) { console.warn('Not enough vertices to create a highlight mesh.'); return null; }
    const worldMatrix = mesh.matrixWorld.clone();
    const highlightMesh = createFaceHighlight(surfaceVertices, worldMatrix, color, opacity);
    scene.add(highlightMesh);
    currentHighlight = { mesh: highlightMesh, faceIndex: hit.faceIndex, shapeId: shape.id };
    return currentHighlight;
};


export const detectFaceAtMouse = (event: MouseEvent, camera: THREE.Camera, mesh: THREE.Mesh, canvas: HTMLCanvasElement): THREE.Intersection | null => {
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(mesh, false);
    if (intersects.length > 0) { return intersects[0]; }
    return null;
};

export const getWorldPositionFromMouse = (event: MouseEvent, camera: THREE.Camera, canvas: HTMLCanvasElement, constraintPlane?: THREE.Plane): THREE.Vector3 | null => {
    const rect = canvas.getBoundingClientRect();
    const mouse = new THREE.Vector2();
    mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(mouse, camera);
    if (constraintPlane) {
        const intersection = new THREE.Vector3();
        const intersected = raycaster.ray.intersectPlane(constraintPlane, intersection);
        return intersected;
    } else {
        const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
        const intersection = new THREE.Vector3();
        const intersected = raycaster.ray.intersectPlane(plane, intersection);
        return intersected;
    }
};

export const visualizeFaceVertices = (scene: THREE.Scene, mesh: THREE.Mesh, faceIndex: number, color: number = 0x000000, size: number = 12): THREE.Group => {
    const group = new THREE.Group();
    const geometry = mesh.geometry as THREE.BufferGeometry;
    const position = geometry.attributes.position;
    const index = geometry.index;
    if (!position) return group;
    const worldMatrix = mesh.matrixWorld;
    const allFaceVertices = new Set<number>();
    const tolerance = 0.1;
    const selectedFaceVertices: number[] = [];
    if (index) {
        const a = faceIndex * 3;
        selectedFaceVertices.push(index.getX(a), index.getX(a + 1), index.getX(a + 2));
    } else {
        const a = faceIndex * 3;
        selectedFaceVertices.push(a, a + 1, a + 2);
    }
    const v1 = new THREE.Vector3().fromBufferAttribute(position, selectedFaceVertices[0]);
    const v2 = new THREE.Vector3().fromBufferAttribute(position, selectedFaceVertices[1]);
    const v3 = new THREE.Vector3().fromBufferAttribute(position, selectedFaceVertices[2]);
    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    const faceNormal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
    const planeD = -faceNormal.dot(v1);
    const totalFaces = index ? index.count / 3 : position.count / 3;
    for (let f = 0; f < totalFaces; f++) {
        const faceVerts: number[] = [];
        if (index) {
            const a = f * 3;
            faceVerts.push(index.getX(a), index.getX(a + 1), index.getX(a + 2));
        } else {
            const a = f * 3;
            faceVerts.push(a, a + 1, a + 2);
        }
        let onSamePlane = true;
        for (const vertexIndex of faceVerts) {
            const vertex = new THREE.Vector3().fromBufferAttribute(position, vertexIndex);
            const distanceToPlane = Math.abs(faceNormal.dot(vertex) + planeD);
            if (distanceToPlane > tolerance) { onSamePlane = false; break; }
        }
        if (onSamePlane) { faceVerts.forEach(v => allFaceVertices.add(v)); }
    }
    Array.from(allFaceVertices).forEach((vertexIndex, i) => {
        const vertex = new THREE.Vector3().fromBufferAttribute(position, vertexIndex);
        const worldVertex = vertex.clone().applyMatrix4(worldMatrix);
        const highlight = new THREE.Mesh(new THREE.SphereGeometry(size, 8, 6), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1.0, depthTest: false }));
        highlight.position.copy(worldVertex);
        highlight.renderOrder = 1000;
        group.add(highlight);
    });
    scene.add(group);
    return group;
};

export const clearVertexVisualization = (scene: THREE.Scene, group: THREE.Group) => {
    scene.remove(group);
    group.traverse((child) => {
        if (child instanceof THREE.Mesh) { child.geometry.dispose(); (child.material as THREE.Material).dispose(); }
        else if (child instanceof THREE.Sprite) { (child.material as THREE.SpriteMaterial).map?.dispose(); (child.material as THREE.Material).dispose(); }
    });
    group.clear();
};

export const getAllVerticesOnPlane = (geometry: THREE.BufferGeometry, faceIndex: number): THREE.Vector3[] => {
    const pos = geometry.attributes.position;
    const index = geometry.index;
    if (!pos) return [];

    const allVertices: THREE.Vector3[] = [];
    const uniqueVerticesMap = new Map<string, THREE.Vector3>();

    const tolerance = 0.1; // Düzlem toleransı

    // Önce seçilen face'in bilgilerini al
    const selectedFaceVerticesIndices: number[] = [];
    if (index) {
        const a = faceIndex * 3;
        selectedFaceVerticesIndices.push(index.getX(a), index.getX(a + 1), index.getX(a + 2));
    } else {
        const a = faceIndex * 3;
        selectedFaceVerticesIndices.push(a, a + 1, a + 2);
    }

    // Seçilen face'in düzlemini hesapla
    const v1 = new THREE.Vector3().fromBufferAttribute(pos, selectedFaceVerticesIndices[0]);
    const v2 = new THREE.Vector3().fromBufferAttribute(pos, selectedFaceVerticesIndices[1]);
    const v3 = new THREE.Vector3().fromBufferAttribute(pos, selectedFaceVerticesIndices[2]);

    const edge1 = new THREE.Vector3().subVectors(v2, v1);
    const edge2 = new THREE.Vector3().subVectors(v3, v1);
    const faceNormal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
    const planeD = -faceNormal.dot(v1);

    // Tüm vertex'leri kontrol et ve aynı düzlemde olanları topla
    const totalVertices = pos.count;
    for (let i = 0; i < totalVertices; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(pos, i);
        const distanceToPlane = Math.abs(faceNormal.dot(vertex) + planeD);

        if (distanceToPlane <= tolerance) {
            const key = `${vertex.x.toFixed(4)},${vertex.y.toFixed(4)},${vertex.z.toFixed(4)}`;
            if (!uniqueVerticesMap.has(key)) {
                uniqueVerticesMap.set(key, vertex);
                allVertices.push(vertex);
            }
        }
    }
    return allVertices;
};


interface Props {
  shape: Shape;
  onContextMenuRequest?: (event: any, shape: Shape) => void;
  isEditMode?: boolean;
  isBeingEdited?: boolean;
  isFaceEditMode?: boolean;
  selectedFaceIndex?: number | null;
  onFaceSelect?: (faceIndex: number) => void;
  isVolumeEditMode?: boolean;
}

const OpenCascadeShape: React.FC<Props> = ({
  shape,
  onContextMenuRequest,
  isEditMode = false,
  isBeingEdited = false,
  isFaceEditMode = false,
  selectedFaceIndex,
  onFaceSelect,
  isVolumeEditMode = false,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const transformRef = useRef<any>(null);
  const { scene, camera, gl } = useThree();
  const {
    activeTool,
    selectedShapeId,
    gridSize,
    setSelectedObjectPosition,
    viewMode,
  } = useAppStore();
  const isSelected = selectedShapeId === shape.id;

  // Volume Edit State
  const [vertexEditMeshes, setVertexEditMeshes] = useState<THREE.Mesh[]>([]);
  const [activeVertex, setActiveVertex] = useState<{ mesh: THREE.Mesh; shape: Shape; pointIndex: number; offset: THREE.Vector3; dragPlane: THREE.Plane; } | null>(null);
  const [isDraggingVertex, setIsDraggingVertex] = useState(false);
  const [hoveredVertexMesh, setHoveredVertexMesh] = useState<THREE.Mesh | null>(null);

  // --- Utility Functions (moved inside component or memoized where appropriate) ---

  const createAndVisualizeEditableVertices = useCallback((targetShape: Shape, faceIndex: number) => {
    // Clear existing nodes first
    vertexEditMeshes.forEach(vMesh => {
      scene.remove(vMesh);
      vMesh.geometry.dispose();
      (vMesh.material as THREE.Material).dispose();
    });
    setVertexEditMeshes([]);
    setActiveVertex(null);
    setIsDraggingVertex(false);
    if (hoveredVertexMesh) {
      (hoveredVertexMesh.material as THREE.MeshBasicMaterial).color.copy(hoveredVertexMesh.userData.originalColor);
      setHoveredVertexMesh(null);
    }

    if (!targetShape.mesh) return;

    const vertexMaterial = new THREE.MeshBasicMaterial({ color: 0x0000ff }); // Blue node point
    const vertexGeometry = new THREE.SphereGeometry(20, 16, 16); // Small sphere

    // Ensure mesh's world matrix is up-to-date
    targetShape.mesh.updateMatrixWorld(true);
    const shapeWorldMatrix = targetShape.mesh.matrixWorld;

    // Get all vertices on the selected face's plane
    const verticesOnPlane = getAllVerticesOnPlane(targetShape.mesh.geometry as THREE.BufferGeometry, faceIndex);
    
    const newVertexMeshes: THREE.Mesh[] = [];
    verticesOnPlane.forEach((localVertex, index) => {
        const worldPoint = localVertex.clone().applyMatrix4(shapeWorldMatrix);
        const vertexMesh = new THREE.Mesh(vertexGeometry, vertexMaterial.clone());
        vertexMesh.position.copy(worldPoint);
        vertexMesh.userData = { 
            isEditableVertex: true, 
            shape: targetShape, 
            // Store the original local vertex position and its index in the geometry's position attribute
            // We need to find the actual index in the geometry's position attribute for updateVertexPosition
            originalLocalPosition: localVertex.clone(), // Store the local position of the vertex
            geometryVertexIndex: findGeometryVertexIndex(targetShape.mesh!.geometry as THREE.BufferGeometry, localVertex),
            originalColor: vertexMaterial.color.clone() 
        }; 
        scene.add(vertexMesh);
        newVertexMeshes.push(vertexMesh);
    });
    setVertexEditMeshes(newVertexMeshes);
    console.log(`✨ ${newVertexMeshes.length} düzenlenebilir düğüm noktası oluşturuldu for ${targetShape.id} on face ${faceIndex}`);
  }, [scene, hoveredVertexMesh, vertexEditMeshes]);

  // Helper to find the index of a vertex in the geometry's position attribute
  const findGeometryVertexIndex = (geometry: THREE.BufferGeometry, localVertex: THREE.Vector3): number => {
    const positionAttribute = geometry.attributes.position;
    const tempVertex = new THREE.Vector3();
    for (let i = 0; i < positionAttribute.count; i++) {
        tempVertex.fromBufferAttribute(positionAttribute, i);
        if (tempVertex.distanceTo(localVertex) < EPSILON) { // Use EPSILON for comparison
            return i;
        }
    }
    return -1; // Should not happen if vertex is found on plane
  };


  const clearEditableVertices = useCallback(() => {
    vertexEditMeshes.forEach(vMesh => {
      scene.remove(vMesh);
      vMesh.geometry.dispose();
      (vMesh.material as THREE.Material).dispose();
    });
    setVertexEditMeshes([]);
    setActiveVertex(null);
    setIsDraggingVertex(false);
    if (hoveredVertexMesh) {
      (hoveredVertexMesh.material as THREE.MeshBasicMaterial).color.copy(hoveredVertexMesh.userData.originalColor);
      setHoveredVertexMesh(null);
    }
    document.body.style.cursor = 'default'; // Reset cursor
  }, [scene, hoveredVertexMesh, vertexEditMeshes]);

  const updateShapeFromVertexDrag = useCallback((node: typeof activeVertex) => {
    if (!node || !node.shape.mesh) return;

    const targetShape = node.shape;
    const draggedVisualVertexMesh = node.mesh; // The actual sphere mesh
    const newWorldPosition = draggedVisualVertexMesh.position;

    targetShape.mesh.updateMatrixWorld(true);
    const inverseShapeWorldMatrix = targetShape.mesh.matrixWorld.clone().invert();
    const newLocalPosition = newWorldPosition.clone().applyMatrix4(inverseShapeWorldMatrix);

    const geometry = targetShape.mesh.geometry as THREE.BufferGeometry;
    const positionAttribute = geometry.attributes.position;

    if (!positionAttribute) {
        console.warn('Geometry has no position attribute to update.');
        return;
    }

    // Find all occurrences of the original vertex in the geometry's position attribute
    // and update them. This handles shared vertices across faces.
    const originalLocalPosition = node.mesh.userData.originalLocalPosition; 
    
    for (let i = 0; i < positionAttribute.count; i++) {
        const currentVertex = new THREE.Vector3().fromBufferAttribute(positionAttribute, i);
        if (currentVertex.distanceTo(originalLocalPosition) < EPSILON) { 
            positionAttribute.setXYZ(i, newLocalPosition.x, newLocalPosition.y, newLocalPosition.z);
        }
    }

    positionAttribute.needsUpdate = true;
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    // Update the shape in the global store to trigger re-render
    const updatedGeometry = geometry.clone(); 
    useAppStore.getState().updateShape(targetShape.id, {
        geometry: updatedGeometry,
        // For polygon3d, also update originalPoints if it's the case
        originalPoints: targetShape.type === 'polygon3d' && targetShape.originalPoints 
                        ? targetShape.originalPoints.map((p, idx) => {
                            // Find the corresponding localVertex from verticesOnPlane that was used to create this visual node
                            const visualNodeIndex = vertexEditMeshes.findIndex(vMesh => vMesh.uuid === node.mesh.uuid);
                            if (visualNodeIndex !== -1 && idx === node.pointIndex) { // Check if it's the specific originalPoint for this visual node
                                return newLocalPosition.clone().setY(0);
                            }
                            return p.clone();
                          })
                        : undefined,
    });

    // Re-create editable vertices for the updated shape and face
    if (currentHighlight) {
        createAndVisualizeEditableVertices(targetShape, currentHighlight.faceIndex);
    }
    
    // Update highlight mesh if active
    if (currentHighlight && currentHighlight.shapeId === targetShape.id) {
        const tempIntersection = {
            point: newWorldPosition,
            face: { normal: getFaceNormal(getFaceVertices(geometry, currentHighlight!.faceIndex)).applyQuaternion(targetShape.mesh.quaternion) },
            faceIndex: currentHighlight!.faceIndex,
            object: targetShape.mesh
        } as THREE.Intersection; 
        highlightFace(scene, tempIntersection, targetShape, 0xFFA500, 0.6);
    }

    console.log(`✅ Shape ${targetShape.id} updated after vertex drag.`);
  }, [scene, createAndVisualizeEditableVertices, vertexEditMeshes]);


  // --- Event Handlers ---

  const onMeshClick = useCallback((e: any) => {
    e.stopPropagation(); 
    e.nativeEvent.preventDefault();

    if (!meshRef.current) return;

    const mouseLocal = new THREE.Vector2();
    mouseLocal.x = (e.nativeEvent.clientX / window.innerWidth) * 2 - 1;
    mouseLocal.y = -(e.nativeEvent.clientY / window.innerHeight) * 2 + 1;
    raycaster.setFromCamera(mouseLocal, camera);

    // --- Volume Edit mode ---
    if (isVolumeEditMode && e.nativeEvent.button === 0) {
      // 1. Check if an editable vertex was clicked
      const intersectsVertices = raycaster.intersectObjects(vertexEditMeshes);

      if (intersectsVertices.length > 0) {
        const clickedVertexMesh = intersectsVertices[0].object as THREE.Mesh;
        const vertexData = clickedVertexMesh.userData;

        if (vertexData.isEditableVertex) {
            setIsDraggingVertex(true);
            const intersectionPoint = intersectsVertices[0].point;
            const offset = new THREE.Vector3().subVectors(intersectionPoint, clickedVertexMesh.position);

            const targetShape = vertexData.shape;
            targetShape.mesh!.updateMatrixWorld(true); 
            const localPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0); 
            const worldPlane = localPlane.clone().applyMatrix4(targetShape.mesh!.matrixWorld);

            setActiveVertex({
                mesh: clickedVertexMesh,
                shape: targetShape,
                pointIndex: vertexData.pointIndex, 
                offset: offset,
                dragPlane: worldPlane
            });
            console.log(`🎯 Volume Edit: Vertex selected for dragging.`);
            document.body.style.cursor = 'grabbing';
            return; 
        }
      }
      
      // 2. If no vertex was clicked, proceed with face selection
      const hit = detectFaceAtMouse(e.nativeEvent, camera, meshRef.current, gl.domElement);
      
      if (hit && hit.faceIndex !== undefined) {
        highlightFace(scene, hit, shape, 0xcccccc, 0.4); // Highlight in light gray
        createAndVisualizeEditableVertices(shape, hit.faceIndex); // Create draggable vertices for the face
        console.log(`🎯 Volume Edit: Face ${hit.faceIndex} selected.`);
      } else {
        console.log('🎯 Volume Edit: No face or vertex found at mouse position.');
        clearFaceHighlight(scene);
        clearEditableVertices();
      }
      return; 
    }

    // --- Face Edit mode ---
    if (isFaceEditMode && e.nativeEvent.button === 0) {
      const hit = detectFaceAtMouse(e.nativeEvent, camera, meshRef.current, gl.domElement);
      if (!hit || hit.faceIndex === undefined) {
        console.warn('🎯 No face detected');
        clearFaceHighlight(scene);
        if (onFaceSelect) onFaceSelect(null);
        return;
      }
      highlightFace(scene, hit, shape, 0xff6b35, 0.6); 
      if (onFaceSelect) {
        onFaceSelect(hit.faceIndex);
        console.log(`🎯 Face ${hit.faceIndex} selected and highlighted`);
      }
      return; 
    }
    
    // --- Normal selection mode ---
    if (e.nativeEvent.button === 0) {
      useAppStore.getState().selectShape(shape.id);
      console.log(`Shape clicked: ${shape.type} (ID: ${shape.id})`);
    }
  }, [isFaceEditMode, isVolumeEditMode, camera, gl.domElement, meshRef, scene, shape, onFaceSelect, vertexEditMeshes, createAndVisualizeEditableVertices, clearEditableVertices]);


  const handleContextMenu = useCallback((e: any) => {
    if (isFaceEditMode || isVolumeEditMode) {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      return;
    }
    if (isSelected && onContextMenuRequest) {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      onContextMenuRequest(e, shape);
    }
  }, [isFaceEditMode, isVolumeEditMode, isSelected, onContextMenuRequest, shape]);

  const handleMouseMove = useCallback((event: MouseEvent) => {
    // Handle vertex dragging
    if (isDraggingVertex && activeVertex) {
        const raycasterLocal = new THREE.Raycaster(); 
        const mouseLocal = new THREE.Vector2();
        mouseLocal.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouseLocal.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycasterLocal.setFromCamera(mouseLocal, camera);

        const intersectionPoint = new THREE.Vector3();
        const intersected = raycasterLocal.ray.intersectPlane(activeVertex.dragPlane, intersectionPoint);
        
        if (intersected) {
            activeVertex.mesh.position.copy(intersectionPoint.sub(activeVertex.offset));
        }
        return; 
    }

    // Handle vertex hover effect (only if not dragging)
    if (isVolumeEditMode && meshRef.current) {
        const raycasterLocal = new THREE.Raycaster();
        const mouseLocal = new THREE.Vector2();
        mouseLocal.x = (event.clientX / window.innerWidth) * 2 - 1;
        mouseLocal.y = -(event.clientY / window.innerHeight) * 2 + 1;
        raycasterLocal.setFromCamera(mouseLocal, camera);

        const intersectsVertices = raycasterLocal.intersectObjects(vertexEditMeshes);

        if (intersectsVertices.length > 0) {
            const newHoveredMesh = intersectsVertices[0].object as THREE.Mesh;
            if (newHoveredMesh !== hoveredVertexMesh) {
                if (hoveredVertexMesh && hoveredVertexMesh.userData.originalColor) {
                    (hoveredVertexMesh.material as THREE.MeshBasicMaterial).color.copy(hoveredVertexMesh.userData.originalColor);
                }
                setHoveredVertexMesh(newHoveredMesh);
                newHoveredMesh.userData.originalColor = (newHoveredMesh.material as THREE.MeshBasicMaterial).color.clone();
                (newHoveredMesh.material as THREE.MeshBasicMaterial).color.set(0xff0000); // Red
                document.body.style.cursor = 'grab';
            }
        } else {
            if (hoveredVertexMesh) {
                if (hoveredVertexMesh.userData.originalColor) {
                    (hoveredVertexMesh.material as THREE.MeshBasicMaterial).color.copy(hoveredVertexMesh.userData.originalColor);
                }
                setHoveredVertexMesh(null);
            }
            document.body.style.cursor = 'default';
        }
    }
  }, [isDraggingVertex, activeVertex, camera, vertexEditMeshes, hoveredVertexMesh, isVolumeEditMode, meshRef]);


  const handleMouseUp = useCallback(() => {
    if (isDraggingVertex && activeVertex) {
        setIsDraggingVertex(false);
        updateShapeFromVertexDrag(activeVertex); // Update shape geometry
        setActiveVertex(null);
        document.body.style.cursor = 'default'; // Reset cursor
        console.log('🎯 Volume Edit: Dragging finished.');
    }
  }, [isDraggingVertex, activeVertex, updateShapeFromVertexDrag]);


  // Add/remove global mouse event listeners for dragging
  useEffect(() => {
    if (isVolumeEditMode) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
      return () => {
        document.removeEventListener('mousemove', handleMouseMove);
        document.removeEventListener('mouseup', handleMouseUp);
      };
    }
  }, [isVolumeEditMode, handleMouseMove, handleMouseUp]);

  // Clean up on mode change
  useEffect(() => {
    if (!isFaceEditMode) {
      clearFaceHighlight(scene);
      if (onFaceSelect) onFaceSelect(null); // Deselect face
    }
    
    if (!isVolumeEditMode) {
      clearEditableVertices(); // Clear all vertex meshes
      clearFaceHighlight(scene); // Clear any face highlight
    } else {
        // If entering volume edit mode and shape is selected, create vertices for its current face highlight
        if (isSelected && currentHighlight && currentHighlight.shapeId === shape.id) {
            createAndVisualizeEditableVertices(shape, currentHighlight.faceIndex);
        }
    }
  }, [isFaceEditMode, isVolumeEditMode, scene, onFaceSelect, clearEditableVertices, createAndVisualizeEditableVertices, shape, isSelected]);


  // Debug: Log shape information when selected
  useEffect(() => {
    if (isSelected && meshRef.current) {
        // ... (existing debug logs) ...
    }
  }, [isSelected, shape]);

  // Transform Controls setup
  useEffect(() => {
    const controls = transformRef.current;
    if (!controls) return;

    controls.translationSnap = gridSize;
    controls.rotationSnap = Math.PI / 12;
    controls.scaleSnap = 0.25;

    const handleObjectChange = () => {
        const mesh = meshRef.current;
        if (!mesh) return;

        const position = mesh.position.toArray();
        const rotation = mesh.rotation.toArray().slice(0, 3);
        const scale = mesh.scale.toArray();

        useAppStore.getState().updateShape(shape.id, {
            position: position,
            rotation: rotation,
            scale: scale,
        });

        if (isSelected) {
            setSelectedObjectPosition(position as [number, number, number]);
        }
        // Update vertex meshes if in volume edit mode and it's a polygon
        if (isVolumeEditMode && isSelected && currentHighlight && currentHighlight.shapeId === shape.id) {
            createAndVisualizeEditableVertices(shape, currentHighlight.faceIndex);
        }
    };

    controls.addEventListener('objectChange', handleObjectChange);
    return () => controls.removeEventListener('objectChange', handleObjectChange);
  }, [shape.id, gridSize, isSelected, setSelectedObjectPosition, isVolumeEditMode, createAndVisualizeEditableVertices, shape]);

  useEffect(() => {
    if (isSelected && meshRef.current) {
      setSelectedObjectPosition(
        meshRef.current.position.toArray() as [number, number, number]
      );
    }
  }, [isSelected, setSelectedObjectPosition, shape.id]);


  const shapeGeometry = useMemo(() => shape.geometry, [shape.geometry]);
  const edgesGeometry = useMemo(() => new THREE.EdgesGeometry(shapeGeometry), [shapeGeometry]);

  const getShapeColor = () => {
    if (isBeingEdited) return '#ff6b35';
    if (isSelected) return '#60a5fa';
    if (isEditMode && !isBeingEdited) return '#6b7280';
    return SHAPE_COLORS[shape.type as keyof typeof SHAPE_COLORS] || '#94a3b8';
  };

  const getOpacity = () => {
    if (shape.type === 'REFERENCE_CUBE' || shape.isReference) return 0.2;
    return 0;
  };

  const shouldShowEdges = () => true; // Always show edges for now

  const getEdgeOpacity = () => 1.0;

  const getEdgeColor = () => '#000000';

  const getEdgeLineWidth = () => {
    const screenWidth = window.innerWidth;
    if (screenWidth < 768) return 0.4;
    if (screenWidth < 1024) return 0.7;
    return 1.0;
  };

  const getMaterialProps = () => {
    const opacityValue = 0.05;
    return {
      color: getShapeColor(),
      transparent: true,
      opacity: opacityValue,
      visible: false,
    };
  };

  return (
    <group>
      {/* Main shape mesh */}
      <mesh
        ref={meshRef}
        geometry={shapeGeometry}
        position={shape.position}
        rotation={shape.rotation}
        scale={shape.scale}
        onClick={onMeshClick}
        onContextMenu={handleContextMenu}
        castShadow
        receiveShadow
        visible={viewMode === ViewMode.SOLID}
      >
        <meshPhysicalMaterial {...getMaterialProps()} />
      </mesh>

      {/* Edges */}
      {shouldShowEdges() && (
        <lineSegments
          geometry={edgesGeometry}
          position={shape.position}
          rotation={shape.rotation}
          scale={shape.scale}
          visible={true}
        >
          <lineBasicMaterial
            color={getEdgeColor()}
            transparent
            opacity={getEdgeOpacity()}
            depthTest={viewMode === ViewMode.SOLID}
            linewidth={getEdgeLineWidth()}
          />
        </lineSegments>
      )}

      {/* Transform controls */}
      {isSelected && meshRef.current && !isEditMode && !isFaceEditMode && !isVolumeEditMode && (
        <TransformControls
          ref={transformRef}
          object={meshRef.current}
          mode={
            activeTool === 'Move'
              ? 'translate'
              : activeTool === 'Rotate'
              ? 'rotate'
              : activeTool === 'Scale'
              ? 'scale'
              : 'translate'
          }
          size={0.8}
          onObjectChange={() => {
            console.log('🎯 GIZMO CHANGE - Transform controls object changed');
          }}
        />
      )}

      {/* Render editable vertex meshes */}
      {vertexEditMeshes.map((vMesh) => (
        <primitive key={vMesh.uuid} object={vMesh} />
      ))}
    </group>
  );
};

export default React.memo(OpenCascadeShape);
