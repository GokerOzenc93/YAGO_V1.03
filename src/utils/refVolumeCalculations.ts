import * as THREE from 'three';

interface EdgeLine {
  id: string;
  value: number;
  label: string;
  shapeId: string;
  edgeIndex: number;
  startVertex: [number, number, number];
  endVertex: [number, number, number];
  formula?: string;
}

interface Shape {
  id: string;
  geometry: THREE.BufferGeometry;
}

interface GeometryUpdate {
  geometry: THREE.BufferGeometry;
  vertexMoves: Array<{
    oldVertex: [number, number, number];
    newVertex: [number, number, number];
  }>;
  lineUpdates: Array<{
    lineId: string;
    newValue: number;
    newEndVertex: [number, number, number];
  }>;
}

export function calculateEdgeDirection(
  startVertex: [number, number, number],
  endVertex: [number, number, number]
): { fixedVertex: [number, number, number]; movingVertex: [number, number, number]; axis: 'x' | 'y' | 'z' } {
  const dx = Math.abs(endVertex[0] - startVertex[0]);
  const dy = Math.abs(endVertex[1] - startVertex[1]);
  const dz = Math.abs(endVertex[2] - startVertex[2]);

  if (dy > dx && dy > dz) {
    return {
      fixedVertex: startVertex[1] < endVertex[1] ? startVertex : endVertex,
      movingVertex: startVertex[1] < endVertex[1] ? endVertex : startVertex,
      axis: 'y'
    };
  } else if (dx > dy && dx > dz) {
    return {
      fixedVertex: startVertex[0] > endVertex[0] ? startVertex : endVertex,
      movingVertex: startVertex[0] > endVertex[0] ? endVertex : startVertex,
      axis: 'x'
    };
  } else {
    return {
      fixedVertex: startVertex[2] < endVertex[2] ? startVertex : endVertex,
      movingVertex: startVertex[2] < endVertex[2] ? endVertex : startVertex,
      axis: 'z'
    };
  }
}

export function calculateNewVertex(
  fixedVertex: [number, number, number],
  movingVertex: [number, number, number],
  newLength: number
): [number, number, number] {
  const direction = new THREE.Vector3(
    movingVertex[0] - fixedVertex[0],
    movingVertex[1] - fixedVertex[1],
    movingVertex[2] - fixedVertex[2]
  ).normalize();

  if (direction.length() === 0) {
    console.warn('⚠️ Zero-length direction vector');
    return movingVertex;
  }

  return [
    fixedVertex[0] + direction.x * newLength,
    fixedVertex[1] + direction.y * newLength,
    fixedVertex[2] + direction.z * newLength
  ];
}

export function applyGeometryUpdates(
  updateData: GeometryUpdate,
  updateShape: (shapeId: string, updates: Partial<Shape>) => void,
  shapeId: string
): void {
  const positions = updateData.geometry.attributes.position.array as Float32Array;

  updateData.vertexMoves.forEach(move => {
    for (let i = 0; i < positions.length; i += 3) {
      const dist = Math.sqrt(
        Math.pow(positions[i] - move.oldVertex[0], 2) +
        Math.pow(positions[i + 1] - move.oldVertex[1], 2) +
        Math.pow(positions[i + 2] - move.oldVertex[2], 2)
      );

      if (dist < 0.01) {
        positions[i] = move.newVertex[0];
        positions[i + 1] = move.newVertex[1];
        positions[i + 2] = move.newVertex[2];
      }
    }
  });

  updateData.geometry.attributes.position.needsUpdate = true;
  updateData.geometry.computeBoundingBox();
  updateData.geometry.computeVertexNormals();

  updateShape(shapeId, { geometry: updateData.geometry });
}

export function findClosestVertices(
  geometry: THREE.BufferGeometry,
  startVertex: [number, number, number],
  endVertex: [number, number, number]
): { closestStart: number[] | null; closestEnd: number[] | null } {
  const positions = geometry.attributes.position.array;
  let closestStart: number[] | null = null;
  let closestEnd: number[] | null = null;
  let minDistStart = Infinity;
  let minDistEnd = Infinity;

  for (let i = 0; i < positions.length; i += 3) {
    const v = [positions[i], positions[i + 1], positions[i + 2]];
    const distToStart = Math.sqrt(
      Math.pow(v[0] - startVertex[0], 2) +
      Math.pow(v[1] - startVertex[1], 2) +
      Math.pow(v[2] - startVertex[2], 2)
    );
    const distToEnd = Math.sqrt(
      Math.pow(v[0] - endVertex[0], 2) +
      Math.pow(v[1] - endVertex[1], 2) +
      Math.pow(v[2] - endVertex[2], 2)
    );

    if (distToStart < minDistStart) {
      minDistStart = distToStart;
      closestStart = v;
    }
    if (distToEnd < minDistEnd) {
      minDistEnd = distToEnd;
      closestEnd = v;
    }
  }

  return { closestStart, closestEnd };
}
