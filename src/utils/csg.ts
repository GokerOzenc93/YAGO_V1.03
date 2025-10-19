import * as THREE from 'three';
import { SUBTRACTION, Brush, Evaluator } from 'three-bvh-csg';
import { Shape } from '../store';

export function subtractReferenceGeometry(
  targetShape: Shape,
  referenceShapes: Shape[]
): THREE.BufferGeometry {
  console.log('🔧 subtractReferenceGeometry called');
  console.log('  Target:', targetShape.id, targetShape.type);
  console.log('  References:', referenceShapes.map(r => r.id));

  const evaluator = new Evaluator();

  const targetBrush = new Brush(targetShape.geometry);
  targetBrush.position.set(...targetShape.position);
  targetBrush.rotation.set(...targetShape.rotation);
  targetBrush.scale.set(...targetShape.scale);
  targetBrush.updateMatrixWorld();

  console.log('  Target brush created and positioned');

  let result = targetBrush;

  for (const refShape of referenceShapes) {
    if (!refShape.isReference) continue;

    console.log('  Processing reference:', refShape.id);

    const refBrush = new Brush(refShape.geometry);
    refBrush.position.set(...refShape.position);
    refBrush.rotation.set(...refShape.rotation);
    refBrush.scale.set(...refShape.scale);
    refBrush.updateMatrixWorld();

    console.log('  Calling evaluator.evaluate with SUBTRACTION');
    const tempResult = evaluator.evaluate(result, refBrush, SUBTRACTION);
    console.log('  Evaluation complete, result:', tempResult);
    result = tempResult;
  }

  console.log('  Returning geometry');
  return result.geometry;
}

export function checkIntersection(shape1: Shape, shape2: Shape): boolean {
  const box1 = new THREE.Box3();
  const box2 = new THREE.Box3();

  const mesh1 = new THREE.Mesh(shape1.geometry);
  mesh1.position.set(...shape1.position);
  mesh1.rotation.set(...shape1.rotation);
  mesh1.scale.set(...shape1.scale);
  mesh1.updateMatrixWorld();
  box1.setFromObject(mesh1);

  const mesh2 = new THREE.Mesh(shape2.geometry);
  mesh2.position.set(...shape2.position);
  mesh2.rotation.set(...shape2.rotation);
  mesh2.scale.set(...shape2.scale);
  mesh2.updateMatrixWorld();
  box2.setFromObject(mesh2);

  return box1.intersectsBox(box2);
}
