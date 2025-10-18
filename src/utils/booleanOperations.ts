import * as THREE from 'three';

const getShapeBounds = (shape: any) => {
  const geometry = shape.geometry;
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox.clone();

  const pos = new THREE.Vector3(...(shape.position || [0, 0, 0]));
  const scale = new THREE.Vector3(...(shape.scale || [1, 1, 1]));
  const rot = shape.rotation ? new THREE.Euler(...shape.rotation) : new THREE.Euler(0, 0, 0);
  const quat = new THREE.Quaternion().setFromEuler(rot);

  const m = new THREE.Matrix4().compose(pos, quat, scale);
  bbox.applyMatrix4(m);

  return bbox;
};

const boundsIntersect = (bounds1: THREE.Box3, bounds2: THREE.Box3) => {
  return bounds1.intersectsBox(bounds2);
};

export const findIntersectingShapes = (
  selectedShape: any,
  allShapes: any[]
) => {
  console.log(`🎯 Finding intersections for shape: ${selectedShape.type} (${selectedShape.id})`);

  const selectedBounds = getShapeBounds(selectedShape);

  const intersectingShapes = allShapes.filter(shape => {
    if (shape.id === selectedShape.id) return false;

    const shapeBounds = getShapeBounds(shape);
    const intersects = boundsIntersect(selectedBounds, shapeBounds);

    if (intersects) {
      console.log(`✅ Intersection found: ${selectedShape.type} with ${shape.type}`);
    }

    return intersects;
  });

  console.log(`🎯 Found ${intersectingShapes.length} intersecting shapes`);
  return intersectingShapes;
};

export const performBooleanSubtract = (
  selectedShape: any,
  allShapes: any[],
  updateShape: any,
  deleteShape: any
) => {
  console.log('🎯 Boolean subtract - OpenCascade integration required');
  console.log('ℹ️ Use OpenCascade performOCBoolean for actual CSG operations');
  return false;
};

export const performBooleanUnion = (
  selectedShape: any,
  allShapes: any[],
  updateShape: any,
  deleteShape: any
) => {
  console.log('🎯 Boolean union - OpenCascade integration required');
  console.log('ℹ️ Use OpenCascade performOCBoolean for actual CSG operations');
  return false;
};
