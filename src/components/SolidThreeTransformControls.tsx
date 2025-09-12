import { createEffect, createSignal } from 'solid-js';
import { useThree } from 'solid-three';
import { TransformControls } from '@react-three/drei';
import { useAppStore } from '../store/appStore';
import * as THREE from 'three';

const SolidThreeTransformControls = () => {
  const { 
    selectedShapeId, 
    activeTool, 
    shapes, 
    updateShape, 
    gridSize,
    orthoMode,
    setSelectedObjectPosition 
  } = useAppStore();

  const [transformRef, setTransformRef] = createSignal<any>(null);
  const { scene } = useThree();

  // Get selected shape
  const selectedShape = () => shapes.find(s => s.id === selectedShapeId);

  // Apply ortho constraint
  const applyOrthoConstraint = (position: THREE.Vector3, originalPosition: THREE.Vector3) => {
    if (orthoMode === 'off') return position;
    
    const delta = new THREE.Vector3().subVectors(position, originalPosition);
    const absX = Math.abs(delta.x);
    const absY = Math.abs(delta.y);
    const absZ = Math.abs(delta.z);
    
    if (absX >= absY && absX >= absZ) {
      return new THREE.Vector3(position.x, originalPosition.y, originalPosition.z);
    } else if (absY >= absX && absY >= absZ) {
      return new THREE.Vector3(originalPosition.x, position.y, originalPosition.z);
    } else {
      return new THREE.Vector3(originalPosition.x, originalPosition.y, position.z);
    }
  };

  createEffect(() => {
    const controls = transformRef();
    const shape = selectedShape();
    
    if (!controls || !shape) return;

    let originalPosition = new THREE.Vector3(...shape.position);

    const handleObjectChange = () => {
      if (!controls.object) return;

      if (activeTool === 'Move') {
        let position = controls.object.position.clone();
        
        // Apply ortho constraint
        position = applyOrthoConstraint(position, originalPosition);
        controls.object.position.copy(position);
        
        // Snap to grid
        const snappedPosition: [number, number, number] = [
          Math.round(position.x / gridSize) * gridSize,
          Math.round(position.y / gridSize) * gridSize,
          Math.round(position.z / gridSize) * gridSize,
        ];

        controls.object.position.set(...snappedPosition);
        setSelectedObjectPosition(snappedPosition);
        
        // Update shape in store
        updateShape(shape.id, { position: snappedPosition });
        
      } else if (activeTool === 'Rotate') {
        const rotation = controls.object.rotation.toArray().slice(0, 3) as [number, number, number];
        updateShape(shape.id, { rotation });
        
      } else if (activeTool === 'Scale') {
        const scale = controls.object.scale.toArray() as [number, number, number];
        updateShape(shape.id, { scale });
      }
    };

    const handleMouseDown = () => {
      originalPosition = new THREE.Vector3(...shape.position);
    };

    controls.addEventListener('mouseDown', handleMouseDown);
    controls.addEventListener('objectChange', handleObjectChange);

    return () => {
      controls.removeEventListener('mouseDown', handleMouseDown);
      controls.removeEventListener('objectChange', handleObjectChange);
    };
  });

  return (
    <>
      {selectedShape() && (
        <TransformControls
          ref={setTransformRef}
          object={scene().getObjectByName(selectedShapeId)}
          mode={
            activeTool === 'Move' ? 'translate' :
            activeTool === 'Rotate' ? 'rotate' :
            activeTool === 'Scale' ? 'scale' : 'translate'
          }
          size={0.8}
          showX={true}
          showY={selectedShape()?.is2DShape ? false : true}
          showZ={true}
          enabled={true}
          space="local"
        />
      )}
    </>
  );
};

export default SolidThreeTransformControls;