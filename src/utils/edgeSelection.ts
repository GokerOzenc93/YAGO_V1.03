import * as THREE from 'three';

export interface EdgeInfo {
  start: THREE.Vector3;
  end: THREE.Vector3;
  midpoint: THREE.Vector3;
  length: number;
  shapeId: string;
  vertexIndex1?: number;
  vertexIndex2?: number;
}

export function detectEdgeFromIntersection(
  intersection: THREE.Intersection,
  shapeId: string
): EdgeInfo | null {
  const point = intersection.point;
  const geometry = (intersection.object as THREE.Mesh).geometry;

  if (!geometry || !geometry.isBufferGeometry) {
    return null;
  }

  const positionAttribute = geometry.attributes.position;
  if (!positionAttribute) return null;

  const worldMatrix = (intersection.object as THREE.Mesh).matrixWorld;

  let closestEdge: EdgeInfo | null = null;
  let minDistance = Infinity;
  const threshold = 20;

  const index = geometry.index;
  const vertices: THREE.Vector3[] = [];

  for (let i = 0; i < positionAttribute.count; i++) {
    const vertex = new THREE.Vector3(
      positionAttribute.getX(i),
      positionAttribute.getY(i),
      positionAttribute.getZ(i)
    );
    vertex.applyMatrix4(worldMatrix);
    vertices.push(vertex);
  }

  const processEdge = (v1: THREE.Vector3, v2: THREE.Vector3, idx1: number, idx2: number) => {
    const edgeVector = new THREE.Vector3().subVectors(v2, v1);
    const edgeLength = edgeVector.length();

    if (edgeLength < 0.001) return;

    const pointVector = new THREE.Vector3().subVectors(point, v1);
    const t = pointVector.dot(edgeVector) / (edgeLength * edgeLength);

    if (t >= 0 && t <= 1) {
      const closestPoint = new THREE.Vector3()
        .copy(v1)
        .add(edgeVector.multiplyScalar(t));

      const distance = point.distanceTo(closestPoint);

      if (distance < threshold && distance < minDistance) {
        minDistance = distance;
        closestEdge = {
          start: v1.clone(),
          end: v2.clone(),
          midpoint: new THREE.Vector3().lerpVectors(v1, v2, 0.5),
          length: edgeLength,
          shapeId,
          vertexIndex1: idx1,
          vertexIndex2: idx2
        };
      }
    }
  };

  if (index) {
    for (let i = 0; i < index.count; i += 3) {
      const a = index.getX(i);
      const b = index.getX(i + 1);
      const c = index.getX(i + 2);

      processEdge(vertices[a], vertices[b], a, b);
      processEdge(vertices[b], vertices[c], b, c);
      processEdge(vertices[c], vertices[a], c, a);
    }
  } else {
    for (let i = 0; i < vertices.length; i += 3) {
      if (i + 2 < vertices.length) {
        processEdge(vertices[i], vertices[i + 1], i, i + 1);
        processEdge(vertices[i + 1], vertices[i + 2], i + 1, i + 2);
        processEdge(vertices[i + 2], vertices[i], i + 2, i);
      }
    }
  }

  return closestEdge;
}

export function calculateDistanceBetweenEdges(edge1: EdgeInfo, edge2: EdgeInfo): number {
  const distance = edge1.midpoint.distanceTo(edge2.midpoint);
  return distance;
}
