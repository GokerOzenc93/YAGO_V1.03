import * as THREE from 'three';

interface CSGVertex {
  pos: THREE.Vector3;
  normal: THREE.Vector3;
  uv?: THREE.Vector2;
}

interface CSGPolygon {
  vertices: CSGVertex[];
  shared?: any;
}

class CSGNode {
  plane: THREE.Plane | null = null;
  front: CSGNode | null = null;
  back: CSGNode | null = null;
  polygons: CSGPolygon[] = [];

  constructor(polygons?: CSGPolygon[]) {
    if (polygons) this.build(polygons);
  }

  build(polygons: CSGPolygon[]) {
    if (!polygons.length) return;
    if (!this.plane) this.plane = this.planeFromPolygon(polygons[0]);

    const front: CSGPolygon[] = [];
    const back: CSGPolygon[] = [];

    for (const polygon of polygons) {
      this.plane.splitPolygon(polygon, this.polygons, this.polygons, front, back);
    }

    if (front.length) {
      if (!this.front) this.front = new CSGNode();
      this.front.build(front);
    }
    if (back.length) {
      if (!this.back) this.back = new CSGNode();
      this.back.build(back);
    }
  }

  planeFromPolygon(polygon: CSGPolygon): THREE.Plane {
    const v0 = polygon.vertices[0].pos;
    const v1 = polygon.vertices[1].pos;
    const v2 = polygon.vertices[2].pos;

    const n = new THREE.Vector3()
      .subVectors(v1, v0)
      .cross(new THREE.Vector3().subVectors(v2, v0))
      .normalize();

    return new THREE.Plane().setFromNormalAndCoplanarPoint(n, v0);
  }

  allPolygons(): CSGPolygon[] {
    let polygons = this.polygons.slice();
    if (this.front) polygons = polygons.concat(this.front.allPolygons());
    if (this.back) polygons = polygons.concat(this.back.allPolygons());
    return polygons;
  }

  invert() {
    for (const polygon of this.polygons) {
      polygon.vertices.reverse();
      for (const vertex of polygon.vertices) {
        vertex.normal.multiplyScalar(-1);
      }
    }
    if (this.plane) this.plane.negate();
    if (this.front) this.front.invert();
    if (this.back) this.back.invert();
    [this.front, this.back] = [this.back, this.front];
  }

  clipPolygons(polygons: CSGPolygon[]): CSGPolygon[] {
    if (!this.plane) return polygons.slice();
    let front: CSGPolygon[] = [];
    let back: CSGPolygon[] = [];

    for (const polygon of polygons) {
      this.plane.splitPolygon(polygon, front, back, front, back);
    }

    if (this.front) front = this.front.clipPolygons(front);
    if (this.back) back = this.back.clipPolygons(back);
    else back = [];

    return front.concat(back);
  }

  clipTo(bsp: CSGNode) {
    this.polygons = bsp.clipPolygons(this.polygons);
    if (this.front) this.front.clipTo(bsp);
    if (this.back) this.back.clipTo(bsp);
  }
}

THREE.Plane.prototype.splitPolygon = function(
  polygon: CSGPolygon,
  coplanarFront: CSGPolygon[],
  coplanarBack: CSGPolygon[],
  front: CSGPolygon[],
  back: CSGPolygon[]
) {
  const EPSILON = 1e-5;
  const COPLANAR = 0;
  const FRONT = 1;
  const BACK = 2;
  const SPANNING = 3;

  let polygonType = 0;
  const types: number[] = [];

  for (const vertex of polygon.vertices) {
    const t = this.normal.dot(vertex.pos) - this.constant;
    const type = t < -EPSILON ? BACK : t > EPSILON ? FRONT : COPLANAR;
    polygonType |= type;
    types.push(type);
  }

  switch (polygonType) {
    case COPLANAR:
      (this.normal.dot((polygon.vertices[0].normal)) > 0 ? coplanarFront : coplanarBack).push(polygon);
      break;
    case FRONT:
      front.push(polygon);
      break;
    case BACK:
      back.push(polygon);
      break;
    case SPANNING:
      const f: CSGVertex[] = [];
      const b: CSGVertex[] = [];

      for (let i = 0; i < polygon.vertices.length; i++) {
        const j = (i + 1) % polygon.vertices.length;
        const ti = types[i];
        const tj = types[j];
        const vi = polygon.vertices[i];
        const vj = polygon.vertices[j];

        if (ti !== BACK) f.push(vi);
        if (ti !== FRONT) b.push(vi);

        if ((ti | tj) === SPANNING) {
          const t = (this.constant - this.normal.dot(vi.pos)) / this.normal.dot(new THREE.Vector3().subVectors(vj.pos, vi.pos));
          const v: CSGVertex = {
            pos: new THREE.Vector3().lerpVectors(vi.pos, vj.pos, t),
            normal: new THREE.Vector3().lerpVectors(vi.normal, vj.normal, t).normalize(),
          };
          if (vi.uv && vj.uv) {
            v.uv = new THREE.Vector2().lerpVectors(vi.uv, vj.uv, t);
          }
          f.push(v);
          b.push(v);
        }
      }

      if (f.length >= 3) front.push({ vertices: f, shared: polygon.shared });
      if (b.length >= 3) back.push({ vertices: b, shared: polygon.shared });
      break;
  }
};

function meshToPolygons(mesh: THREE.Mesh): CSGPolygon[] {
  const geometry = mesh.geometry;
  const posAttr = geometry.attributes.position;
  const normalAttr = geometry.attributes.normal;
  const uvAttr = geometry.attributes.uv;
  const index = geometry.index;

  const polygons: CSGPolygon[] = [];
  const vertexCount = index ? index.count : posAttr.count;

  for (let i = 0; i < vertexCount; i += 3) {
    const vertices: CSGVertex[] = [];

    for (let j = 0; j < 3; j++) {
      const idx = index ? index.getX(i + j) : i + j;

      const vertex: CSGVertex = {
        pos: new THREE.Vector3(
          posAttr.getX(idx),
          posAttr.getY(idx),
          posAttr.getZ(idx)
        ).applyMatrix4(mesh.matrixWorld),
        normal: new THREE.Vector3(
          normalAttr.getX(idx),
          normalAttr.getY(idx),
          normalAttr.getZ(idx)
        ).applyMatrix3(new THREE.Matrix3().getNormalMatrix(mesh.matrixWorld))
      };

      if (uvAttr) {
        vertex.uv = new THREE.Vector2(uvAttr.getX(idx), uvAttr.getY(idx));
      }

      vertices.push(vertex);
    }

    polygons.push({ vertices });
  }

  return polygons;
}

function polygonsToGeometry(polygons: CSGPolygon[]): THREE.BufferGeometry {
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];

  for (const polygon of polygons) {
    for (let i = 2; i < polygon.vertices.length; i++) {
      const v0 = polygon.vertices[0];
      const v1 = polygon.vertices[i - 1];
      const v2 = polygon.vertices[i];

      positions.push(v0.pos.x, v0.pos.y, v0.pos.z);
      positions.push(v1.pos.x, v1.pos.y, v1.pos.z);
      positions.push(v2.pos.x, v2.pos.y, v2.pos.z);

      normals.push(v0.normal.x, v0.normal.y, v0.normal.z);
      normals.push(v1.normal.x, v1.normal.y, v1.normal.z);
      normals.push(v2.normal.x, v2.normal.y, v2.normal.z);

      if (v0.uv) {
        uvs.push(v0.uv.x, v0.uv.y);
        uvs.push(v1.uv.x, v1.uv.y);
        uvs.push(v2.uv.x, v2.uv.y);
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));

  if (uvs.length > 0) {
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  }

  return geometry;
}

export function subtract(meshA: THREE.Mesh, meshB: THREE.Mesh): THREE.BufferGeometry {
  meshA.updateMatrixWorld();
  meshB.updateMatrixWorld();

  const a = new CSGNode(meshToPolygons(meshA));
  const b = new CSGNode(meshToPolygons(meshB));

  a.invert();
  a.clipTo(b);
  b.clipTo(a);
  b.invert();
  b.clipTo(a);
  b.invert();
  a.build(b.allPolygons());
  a.invert();

  return polygonsToGeometry(a.allPolygons());
}
