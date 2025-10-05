import * as THREE from 'three';

export interface EdgePoint {
  point: THREE.Vector3;
  edgeIndex: number;
  position: 'start' | 'end' | 'mid';
}

const rulerPointMarkers: THREE.Mesh[] = [];

export function getEdgePoints(geometry: THREE.BufferGeometry): EdgePoint[] {
  const edgePoints: EdgePoint[] = [];
  const positionAttribute = geometry.getAttribute('position');

  if (!positionAttribute) return edgePoints;

  const edges = new THREE.EdgesGeometry(geometry);
  const edgePositions = edges.getAttribute('position');

  for (let i = 0; i < edgePositions.count; i += 2) {
    const start = new THREE.Vector3(
      edgePositions.getX(i),
      edgePositions.getY(i),
      edgePositions.getZ(i)
    );

    const end = new THREE.Vector3(
      edgePositions.getX(i + 1),
      edgePositions.getY(i + 1),
      edgePositions.getZ(i + 1)
    );

    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);

    edgePoints.push(
      { point: start, edgeIndex: i / 2, position: 'start' },
      { point: end, edgeIndex: i / 2, position: 'end' },
      { point: mid, edgeIndex: i / 2, position: 'mid' }
    );
  }

  return edgePoints;
}

export function findClosestEdgePoint(
  mousePosition: THREE.Vector2,
  camera: THREE.Camera,
  geometry: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4,
  threshold: number = 0.05
): EdgePoint | null {
  const edgePoints = getEdgePoints(geometry);
  let closestPoint: EdgePoint | null = null;
  let minDistance = threshold;

  for (const edgePoint of edgePoints) {
    const worldPoint = edgePoint.point.clone().applyMatrix4(worldMatrix);
    const screenPoint = worldPoint.project(camera);

    const distance = mousePosition.distanceTo(
      new THREE.Vector2(screenPoint.x, screenPoint.y)
    );

    if (distance < minDistance) {
      minDistance = distance;
      closestPoint = {
        ...edgePoint,
        point: worldPoint
      };
    }
  }

  return closestPoint;
}

export function createRulerPointMarker(
  point: THREE.Vector3,
  scene: THREE.Scene,
  index: number
): THREE.Mesh {
  const geometry = new THREE.SphereGeometry(10, 16, 16);
  const material = new THREE.MeshBasicMaterial({
    color: index === 0 ? 0x3b82f6 : 0x10b981,
    depthTest: false,
    transparent: true,
    opacity: 0.8
  });

  const marker = new THREE.Mesh(geometry, material);
  marker.position.copy(point);
  marker.renderOrder = 1000;
  marker.userData.type = 'rulerMarker';
  marker.userData.index = index;
  scene.add(marker);

  rulerPointMarkers.push(marker);

  return marker;
}

export function clearRulerPointMarkers(scene: THREE.Scene): void {
  rulerPointMarkers.forEach(marker => {
    scene.remove(marker);
    marker.geometry.dispose();
    (marker.material as THREE.Material).dispose();
  });
  rulerPointMarkers.length = 0;
}

export function createDistanceLine(
  point1: THREE.Vector3,
  point2: THREE.Vector3,
  scene: THREE.Scene
): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints([point1, point2]);
  const material = new THREE.LineBasicMaterial({
    color: 0x3b82f6,
    linewidth: 2,
    depthTest: false
  });

  const line = new THREE.Line(geometry, material);
  line.renderOrder = 999;
  scene.add(line);

  return line;
}
