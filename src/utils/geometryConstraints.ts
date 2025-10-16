import * as THREE from 'three';
import { EdgeConstraint } from '../types/shapes';

export function applyEdgeConstraints(
  geometry: THREE.BufferGeometry,
  constraints: EdgeConstraint[],
  evaluateFormula: (formula: string) => number | null
): THREE.BufferGeometry {
  if (!constraints || constraints.length === 0) {
    console.log('⚠️ No constraints to apply');
    return geometry;
  }

  console.log(`🔧 Applying ${constraints.length} constraints...`);

  const newGeometry = geometry.clone();
  const positions = newGeometry.attributes.position.array as Float32Array;

  const edges = extractEdges(positions);
  console.log(`📊 Found ${edges.length} edges in geometry`);

  const appliedEdges = new Set<string>();

  for (const constraint of constraints) {
    console.log(`🔍 Processing constraint for edge ${constraint.edgeId}, formula: ${constraint.formula}`);

    const targetLength = evaluateFormula(constraint.formula);

    if (targetLength === null || targetLength <= 0) {
      console.warn(`⚠️ Invalid constraint formula "${constraint.formula}" → ${targetLength}`);
      continue;
    }

    console.log(`✓ Target length evaluated: ${targetLength}mm`);

    let edge = edges.find(e => e.id === constraint.edgeId);

    if (!edge) {
      console.log(`🔄 Edge ID not found, searching by closest match...`);
      const targetCoords = constraint.edgeId.split('-').slice(1);

      for (const e of edges) {
        const edgeCoords = e.id.split('-').slice(1);
        if (areCoordsClose(targetCoords, edgeCoords)) {
          edge = e;
          console.log(`✓ Found matching edge: ${e.id}`);
          break;
        }
      }
    }

    if (!edge) {
      console.warn(`⚠️ Edge ${constraint.edgeId} not found in ${edges.length} edges`);
      continue;
    }

    if (appliedEdges.has(edge.id)) {
      console.log(`⏭️ Edge ${edge.id} already constrained, skipping`);
      continue;
    }

    const currentLength = edge.start.distanceTo(edge.end);
    const scale = targetLength / currentLength;

    const axis = getEdgeAxis(edge.start, edge.end);
    const fixed = edge.start.clone();
    const moving = edge.end.clone();

    if (axis === 'x') {
      const newX = fixed.x + (moving.x - fixed.x) * scale;
      updateVertices(positions, moving, new THREE.Vector3(newX, moving.y, moving.z));
    } else if (axis === 'y') {
      const newY = fixed.y + (moving.y - fixed.y) * scale;
      updateVertices(positions, moving, new THREE.Vector3(moving.x, newY, moving.z));
    } else {
      const newZ = fixed.z + (moving.z - fixed.z) * scale;
      updateVertices(positions, moving, new THREE.Vector3(moving.x, moving.y, newZ));
    }

    appliedEdges.add(edge.id);
    console.log(`✅ Applied constraint: edge ${edge.id} = ${targetLength.toFixed(2)}mm`);
  }

  newGeometry.attributes.position.needsUpdate = true;
  newGeometry.computeBoundingBox();
  newGeometry.computeVertexNormals();

  return newGeometry;
}

function extractEdges(positions: Float32Array): Array<{ id: string; start: THREE.Vector3; end: THREE.Vector3 }> {
  const edges: Array<{ id: string; start: THREE.Vector3; end: THREE.Vector3 }> = [];

  for (let i = 0; i < positions.length; i += 9) {
    const v1 = new THREE.Vector3(positions[i], positions[i + 1], positions[i + 2]);
    const v2 = new THREE.Vector3(positions[i + 3], positions[i + 4], positions[i + 5]);
    const v3 = new THREE.Vector3(positions[i + 6], positions[i + 7], positions[i + 8]);

    edges.push(
      {
        id: makeEdgeId(v1, v2),
        start: v1,
        end: v2
      },
      {
        id: makeEdgeId(v2, v3),
        start: v2,
        end: v3
      },
      {
        id: makeEdgeId(v3, v1),
        start: v3,
        end: v1
      }
    );
  }

  return edges;
}

function makeEdgeId(v1: THREE.Vector3, v2: THREE.Vector3): string {
  const p1 = `${v1.x.toFixed(3)},${v1.y.toFixed(3)},${v1.z.toFixed(3)}`;
  const p2 = `${v2.x.toFixed(3)},${v2.y.toFixed(3)},${v2.z.toFixed(3)}`;

  if (p1 < p2) {
    return `edge-${p1}-${p2}`;
  } else {
    return `edge-${p2}-${p1}`;
  }
}

function areCoordsClose(coords1: string[], coords2: string[], tolerance = 0.1): boolean {
  if (coords1.length !== coords2.length) return false;

  for (let i = 0; i < coords1.length; i++) {
    const parts1 = coords1[i].split(',').map(Number);
    const parts2 = coords2[i].split(',').map(Number);

    if (parts1.length !== parts2.length) return false;

    const allClose = parts1.every((val, idx) => {
      const ratio = parts2[idx] === 0 ? 1 : val / parts2[idx];
      return Math.abs(ratio - 1) < tolerance || Math.abs(val - parts2[idx]) < 1;
    });

    if (!allClose) return false;
  }

  return true;
}

function getEdgeAxis(start: THREE.Vector3, end: THREE.Vector3): 'x' | 'y' | 'z' {
  const delta = new THREE.Vector3().subVectors(end, start);
  const absX = Math.abs(delta.x);
  const absY = Math.abs(delta.y);
  const absZ = Math.abs(delta.z);

  if (absX > absY && absX > absZ) return 'x';
  if (absY > absX && absY > absZ) return 'y';
  return 'z';
}

function updateVertices(positions: Float32Array, oldPos: THREE.Vector3, newPos: THREE.Vector3) {
  const tolerance = 0.001;

  for (let i = 0; i < positions.length; i += 3) {
    const vx = positions[i];
    const vy = positions[i + 1];
    const vz = positions[i + 2];

    if (Math.abs(vx - oldPos.x) < tolerance &&
        Math.abs(vy - oldPos.y) < tolerance &&
        Math.abs(vz - oldPos.z) < tolerance) {
      positions[i] = newPos.x;
      positions[i + 1] = newPos.y;
      positions[i + 2] = newPos.z;
    }
  }
}
