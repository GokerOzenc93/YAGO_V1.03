import React, { useRef, useEffect, useMemo } from 'react';
import { useAppStore } from '../store/appStore';
import { TransformControls } from '@react-three/drei';
import { useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { SHAPE_COLORS } from '../types/shapes';
import { ViewMode, OrthoMode } from '../store/appStore';
import { applyOrthoConstraint } from '../utils/orthoUtils';
import {
  detectFaceAtMouse,
  highlightFace,
  clearFaceHighlight
} from '../utils/faceSelection';

interface Props {
  shape: Shape;
  onContextMenuRequest?: (event: any, shape: Shape) => void;
  isEditMode?: boolean;
  isBeingEdited?: boolean;
  // Face Edit Mode props
  isFaceEditMode?: boolean;
  onFaceSelect?: (faceIndex: number) => void;
}

const YagoDesignShape: React.FC<Props> = ({
  shape,
  onContextMenuRequest,
  isEditMode = false,
  isBeingEdited = false,
  // Face Edit Mode props
  isFaceEditMode = false,
  onFaceSelect,
}) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const transformRef = useRef<any>(null);
  const { scene, camera, gl } = useThree();
  const persistentHighlights = useRef<Map<number, { mesh: THREE.Mesh; textMesh?: THREE.Mesh }>>(new Map());
  const {
    activeTool,
    selectedShapeId,
    gridSize,
    setSelectedObjectPosition,
    viewMode,
    updateShape,
    orthoMode, // 🎯 NEW: Get ortho mode
  } = useAppStore();
  const isSelected = selectedShapeId === shape.id;
  const faceCycleRef = useRef<{
    mouse: { x: number; y: number };
    hits: THREE.Intersection[];
    index: number;
  } | null>(null);

  // Create geometry from shape
  const shapeGeometry = useMemo(() => {
    return shape.geometry;
  }, [shape.geometry]);

  // Create edges geometry
  const edgesGeometry = useMemo(() => {
    return new THREE.EdgesGeometry(shapeGeometry);
  }, [shapeGeometry]);

  // Debug: Log shape information when selected
  useEffect(() => {
    if (isSelected && meshRef.current) {
      const worldPos = meshRef.current.getWorldPosition(new THREE.Vector3());
      const localPos = meshRef.current.position;
      
      console.log('🎯 GIZMO DEBUG - Selected shape:', {
        id: shape.id,
        type: shape.type,
        shapePosition: shape.position,
        meshLocalPosition: localPos.toArray().map(v => v.toFixed(1)),
        meshWorldPosition: worldPos.toArray().map(v => v.toFixed(1)),
        geometryBoundingBox: shape.geometry.boundingBox,
        is2DShape: shape.is2DShape,
        positionMatch: localPos.toArray().map((v, i) => Math.abs(v - shape.position[i]) < 0.1)
      });
      
      // Check if mesh position matches shape position
      const positionDiff = localPos.toArray().map((v, i) => Math.abs(v - shape.position[i]));
      if (positionDiff.some(diff => diff > 0.1)) {
        console.warn('🚨 POSITION MISMATCH - Mesh position does not match shape position!', {
          shapePosision: shape.position,
          meshPosition: localPos.toArray(),
          difference: positionDiff
        });
      }
    }
  }, [isSelected, shape]);

  // Handle transform controls
  useEffect(() => {
    if (!transformRef.current || !isSelected) return;

    const controls = transformRef.current;
    
    // 🎯 NEW: Ortho mode constraint function
    const applyOrthoConstraint = (position: THREE.Vector3, originalPosition: THREE.Vector3) => {
      if (orthoMode === OrthoMode.OFF) return position;
      
      // Calculate movement delta
      const delta = new THREE.Vector3().subVectors(position, originalPosition);
      
      // Find the axis with maximum movement
      const absX = Math.abs(delta.x);
      const absY = Math.abs(delta.y);
      const absZ = Math.abs(delta.z);
      
      // Constrain to the dominant axis
      if (absX >= absY && absX >= absZ) {
        // X axis dominant
        return new THREE.Vector3(position.x, originalPosition.y, originalPosition.z);
      } else if (absY >= absX && absY >= absZ) {
        // Y axis dominant
        return new THREE.Vector3(originalPosition.x, position.y, originalPosition.z);
      } else {
        // Z axis dominant
        return new THREE.Vector3(originalPosition.x, originalPosition.y, position.z);
      }
    };
    
    let originalPosition = new THREE.Vector3(...shape.position);
    let originalRotation = new THREE.Euler(...shape.rotation);
    let originalScale = new THREE.Vector3(...shape.scale);
    
    const handleObjectChange = () => {
      if (!meshRef.current) return;

      if (activeTool === 'Move') {
        let position = meshRef.current.position.clone();
        
        // 🎯 NEW: Apply ortho mode constraint
        position = applyOrthoConstraint(position, originalPosition, orthoMode);
        meshRef.current.position.copy(position);
        
        const snappedPosition = [
          Math.round(position.x / gridSize) * gridSize,
          Math.round(position.y / gridSize) * gridSize,
          Math.round(position.z / gridSize) * gridSize,
        ] as [number, number, number];

        meshRef.current.position.set(...snappedPosition);
        setSelectedObjectPosition(snappedPosition);
        
        // 🎯 UPDATE SHAPE POSITION IN STORE
        updateShape(shape.id, {
          position: snappedPosition
        });
        
        console.log(`🎯 Shape ${shape.id} position updated:`, snappedPosition);
      } else if (activeTool === 'Rotate') {
        const rotation = meshRef.current.rotation.toArray().slice(0, 3) as [number, number, number];
        
        // 🎯 UPDATE SHAPE ROTATION IN STORE
        updateShape(shape.id, {
          rotation: rotation
        });
        
        console.log(`🎯 Shape ${shape.id} rotation updated:`, rotation);
      } else if (activeTool === 'Scale') {
        const scale = meshRef.current.scale.toArray() as [number, number, number];
        
        // 🎯 UPDATE SHAPE SCALE IN STORE
        updateShape(shape.id, {
          scale: scale
        });
        
        console.log(`🎯 Shape ${shape.id} scale updated:`, scale);
      }
    };
    
    const handleMouseDown = () => {
      // Store original position when starting to drag
      originalPosition = new THREE.Vector3(...shape.position);
      originalRotation = new THREE.Euler(...shape.rotation);
      originalScale = new THREE.Vector3(...shape.scale);
    };

    const handleObjectChangeEnd = () => {
      if (!meshRef.current) return;
      
      // Final update based on active tool
      if (activeTool === 'Move') {
        const finalPosition = meshRef.current.position.toArray() as [number, number, number];
        updateShape(shape.id, {
          position: finalPosition
        });
        console.log(`🎯 Shape ${shape.id} final position:`, finalPosition);
      } else if (activeTool === 'Rotate') {
        const finalRotation = meshRef.current.rotation.toArray().slice(0, 3) as [number, number, number];
        updateShape(shape.id, {
          rotation: finalRotation
        });
        console.log(`🎯 Shape ${shape.id} final rotation:`, finalRotation);
      } else if (activeTool === 'Scale') {
        const finalScale = meshRef.current.scale.toArray() as [number, number, number];
        updateShape(shape.id, {
          scale: finalScale
        });
        console.log(`🎯 Shape ${shape.id} final scale:`, finalScale);
      }
    };
    
    controls.addEventListener('mouseDown', handleMouseDown);
    controls.addEventListener('objectChange', handleObjectChange);
    controls.addEventListener('mouseUp', handleObjectChangeEnd);
    
    return () => {
      controls.removeEventListener('mouseDown', handleMouseDown);
      controls.removeEventListener('objectChange', handleObjectChange);
      controls.removeEventListener('mouseUp', handleObjectChangeEnd);
    };
  }, [shape.id, gridSize, isSelected, setSelectedObjectPosition, updateShape, orthoMode, shape.position, shape.rotation, shape.scale, activeTool]);

  useEffect(() => {
    if (isSelected && meshRef.current) {
      setSelectedObjectPosition(
        meshRef.current.position.toArray() as [number, number, number]
      );
      console.log(
        `🎯 GIZMO SELECTION - Shape ${shape.id} selected:`,
        {
          meshPosition: meshRef.current.position.toArray().map((p) => p.toFixed(1)),
          worldPosition: meshRef.current.getWorldPosition(new THREE.Vector3()).toArray().map((p) => p.toFixed(1)),
          shapePosition: shape.position.map((p) => p.toFixed(1))
        }
      );
    }
  }, [isSelected, setSelectedObjectPosition, shape.id, shape.position]);

  const handleClick = (e: any) => {
    // Face Edit mode - handle face selection
    if (isFaceEditMode && e.nativeEvent.button === 0) {
      e.stopPropagation();
      
      // Shift tuşu kontrolü
      const isShiftPressed = e.nativeEvent.shiftKey;
      
      const hits = detectFaceAtMouse(
        e.nativeEvent,
        camera,
        meshRef.current!,
        gl.domElement
      );

      if (hits.length === 0) {
        console.warn('🎯 No face detected');
        return;
      }

      const { clientX, clientY } = e.nativeEvent;
      let cycle = faceCycleRef.current;

      if (
        !cycle ||
        Math.abs(cycle.mouse.x - clientX) > 2 ||
        Math.abs(cycle.mouse.y - clientY) > 2
      ) {
        cycle = { mouse: { x: clientX, y: clientY }, hits, index: 0 };
      } else {
        cycle.hits = hits;
        cycle.index = (cycle.index + 1) % hits.length;
      }

      faceCycleRef.current = cycle;

      const hit = cycle.hits[cycle.index];
      if (hit.faceIndex === undefined) {
        console.warn('🎯 No face index');
        return;
      }

      const highlight = highlightFace(scene, hit, shape, isShiftPressed, 0xff6b35, 0.6);
      if (highlight && onFaceSelect) {
        onFaceSelect(hit.faceIndex);
        console.log(`🎯 Face ${hit.faceIndex} selected and highlighted ${isShiftPressed ? '(Multi-select)' : ''}`);
      } else if (!highlight && isShiftPressed) {
        console.log(`🎯 Face ${hit.faceIndex} deselected (Shift+Click)`);
      }
      return;
    }
    
    // Normal selection mode - only left click
    if (e.nativeEvent.button === 0) {
      e.stopPropagation();
      useAppStore.getState().selectShape(shape.id);
      console.log(`Shape clicked: ${shape.type} (ID: ${shape.id})`);
    }
  };

  const handleContextMenu = (e: any) => {
    // Face Edit mode - prevent context menu
    if (isFaceEditMode) {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      
      // Add face to list on right click in face edit mode
      const hits = detectFaceAtMouse(
        e.nativeEvent,
        camera,
        meshRef.current!,
        gl.domElement
      );

      if (hits.length > 0 && hits[0].faceIndex !== undefined) {
        // Add face to list via right-click
        const faceIndex = hits[0].faceIndex;
        if (onFaceSelect) {
          onFaceSelect(faceIndex);
          console.log(`🎯 Face ${faceIndex} added to list via right-click`);
        }
      }
      return;
    }
    
    // Normal context menu - only show for selected shapes
    if (isSelected && onContextMenuRequest) {
      e.stopPropagation();
      e.nativeEvent.preventDefault();
      onContextMenuRequest(e, shape);
      console.log(
        `Context menu requested for shape: ${shape.type} (ID: ${shape.id})`
      );
    }
  };

  // Face Edit mode'dan çıkıldığında highlight'ı temizle
  useEffect(() => {
    if (!isFaceEditMode) {
      clearFaceHighlight(scene);
    }
  }, [isFaceEditMode, scene]);
  
  // Listen for confirmed face highlight events
  useEffect(() => {
    const handleConfirmedFaceHighlight = (event: CustomEvent) => {
      const { shapeId, faceIndex, faceNumber, faceRole, color, confirmed, persistent } = event.detail;
      
      if (shapeId === shape.id && meshRef.current) {
        console.log(`🎯 Creating persistent highlight for face ${faceIndex} with number ${faceNumber} and role ${faceRole}`);
        
        // Create persistent highlight geometry
        const geometry = meshRef.current.geometry as THREE.BufferGeometry;
        const positions = geometry.attributes.position;
        
        // Get face vertices (simplified - using first 3 vertices for demo)
        const faceVertices = [];
        for (let i = 0; i < 3; i++) {
          const vertex = new THREE.Vector3().fromBufferAttribute(positions, faceIndex * 3 + i);
          // Apply shape transforms
          vertex.applyMatrix4(meshRef.current.matrixWorld);
          faceVertices.push(vertex);
        }
        
        // Create highlight plane geometry
        const highlightGeometry = new THREE.BufferGeometry();
        const highlightPositions = new Float32Array(9); // 3 vertices * 3 components
        
        faceVertices.forEach((vertex, i) => {
          highlightPositions[i * 3] = vertex.x;
          highlightPositions[i * 3 + 1] = vertex.y;
          highlightPositions[i * 3 + 2] = vertex.z;
        });
        
        highlightGeometry.setAttribute('position', new THREE.BufferAttribute(highlightPositions, 3));
        highlightGeometry.computeVertexNormals();
        
        // Create highlight material
        const highlightMaterial = new THREE.MeshBasicMaterial({
          color: color,
          transparent: true,
          opacity: 0.7,
          side: THREE.DoubleSide,
          depthTest: false,
          depthWrite: false
        });
        
        // Create highlight mesh
        const highlightMesh = new THREE.Mesh(highlightGeometry, highlightMaterial);
        highlightMesh.renderOrder = 999;
        
        // Calculate face center for text positioning
        const faceCenter = new THREE.Vector3();
        faceVertices.forEach(vertex => faceCenter.add(vertex));
        faceCenter.divideScalar(faceVertices.length);
        
        // Create text label
        const canvas = document.createElement('canvas');
        const context = canvas.getContext('2d');
        if (context) {
          canvas.width = 256;
          canvas.height = 128;
          
          // Clear canvas
          context.clearRect(0, 0, canvas.width, canvas.height);
          
          // Set text properties
          context.font = 'bold 24px Arial';
          context.fillStyle = '#ffffff';
          context.strokeStyle = '#000000';
          context.lineWidth = 3;
          context.textAlign = 'center';
          context.textBaseline = 'middle';
          
          // Draw text with outline
          const text = `${faceNumber}: ${faceRole}`;
          context.strokeText(text, canvas.width / 2, canvas.height / 2);
          context.fillText(text, canvas.width / 2, canvas.height / 2);
          
          // Create texture from canvas
          const texture = new THREE.CanvasTexture(canvas);
          texture.needsUpdate = true;
          
          // Create text material
          const textMaterial = new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false
          });
          
          // Create text plane geometry
          const textGeometry = new THREE.PlaneGeometry(150, 75);
          const textMesh = new THREE.Mesh(textGeometry, textMaterial);
          
          // Position text at face center, slightly above
          textMesh.position.copy(faceCenter);
          textMesh.position.y += 50; // Offset above the face
          textMesh.lookAt(camera.position);
          textMesh.renderOrder = 1000;
          
          scene.add(textMesh);
          
          // Store both highlight and text mesh
          persistentHighlights.current.set(faceNumber, { 
            mesh: highlightMesh, 
            textMesh: textMesh 
          });
        }
        
        scene.add(highlightMesh);
        
        console.log(`✅ Persistent highlight created for face ${faceNumber} with role ${faceRole}`);
      }
    };
    
    const handleClearAllFaceHighlights = (event: CustomEvent) => {
      const { shapeId } = event.detail;
      
      if (shapeId === shape.id) {
        console.log(`🧹 Clearing all persistent highlights for shape ${shapeId}`);
        
        // Remove all persistent highlights
        persistentHighlights.current.forEach(({ mesh, textMesh }) => {
          scene.remove(mesh);
          if (textMesh) {
            scene.remove(textMesh);
            textMesh.geometry.dispose();
            (textMesh.material as THREE.Material).dispose();
          }
          mesh.geometry.dispose();
          (mesh.material as THREE.Material).dispose();
        });
        
        persistentHighlights.current.clear();
        console.log(`✅ All persistent highlights cleared for shape ${shapeId}`);
      }
    };
    
    window.addEventListener('highlightConfirmedFace', handleConfirmedFaceHighlight as EventListener);
    window.addEventListener('clearAllFaceHighlights', handleClearAllFaceHighlights as EventListener);
    
    return () => {
      window.removeEventListener('highlightConfirmedFace', handleConfirmedFaceHighlight as EventListener);
      window.removeEventListener('clearAllFaceHighlights', handleClearAllFaceHighlights as EventListener);
      
      // Cleanup persistent highlights on unmount
      persistentHighlights.current.forEach(({ mesh, textMesh }) => {
        scene.remove(mesh);
        if (textMesh) {
          scene.remove(textMesh);
          textMesh.geometry.dispose();
          (textMesh.material as THREE.Material).dispose();
        }
        mesh.geometry.dispose();
        (mesh.material as THREE.Material).dispose();
      });
      persistentHighlights.current.clear();
    };
  }, [scene, shape.id, shape, camera]);

  // Original face highlight event listener (kept for compatibility)
  useEffect(() => {
    const handleConfirmedFaceHighlight = (event: CustomEvent) => {
      const { shapeId, faceIndex, faceNumber, color, confirmed } = event.detail;
      
      if (shapeId === shape.id && meshRef.current && !event.detail.persistent) {
        // This is for temporary highlights only
        console.log(`🎯 Temporary highlight for face ${faceIndex}`);
      }
    };
    
    window.addEventListener('highlightConfirmedFace', handleConfirmedFaceHighlight as EventListener);
    
    return () => {
      window.removeEventListener('highlightConfirmedFace', handleConfirmedFaceHighlight as EventListener);
    };

  // Listen for face selection mode activation
  useEffect(() => {
    const handleFaceSelectionMode = () => {
      if (isFaceEditMode) {
        console.log(`🎯 Face selection mode activated for shape ${shape.id}`);
      }
    };
    
    handleFaceSelectionMode();
  }, [isFaceEditMode, shape.id]);
  // Calculate shape center for transform controls positioning
  // 🎯 NEW: Get appropriate color based on view mode
  const getShapeColor = () => {
    if (isBeingEdited) return '#ff6b35'; // Orange for being edited
    if (isSelected) return '#60a5fa'; // Blue for selected
    if (isEditMode && !isBeingEdited) return '#6b7280'; // Gray for other objects in edit mode
    
    // Extrude edilmiş şekiller için normal renkler
    if (shape.type === 'box') return '#2563eb'; // Mavi
    if (shape.type === 'cylinder') return '#0d9488'; // Teal
    
    return SHAPE_COLORS[shape.type as keyof typeof SHAPE_COLORS] || '#94a3b8';
  };

  // 🎯 NEW: Get opacity based on view mode
  const getOpacity = () => {
    if (shape.type === 'REFERENCE_CUBE' || shape.isReference) return 0.2;

    // 🎯 EDIT MODE: Normal sahnedeki gibi şeffaf
    return 0.0; // Tüm şekiller tamamen şeffaf (sadece çizgiler görünür)
  };

  // 🎯 NEW: Get edge visibility based on view mode
  const shouldShowEdges = () => {
    if (viewMode === ViewMode.SOLID) {
      // Solid mode: Only show outline edges
      return true;
    } else {
      // Wireframe mode: Show all edges
      return true;
    }
  };

  // 🎯 NEW: Get edge opacity based on view mode
  const getEdgeOpacity = () => {
    // Always full opacity
    return 1.0;
  };

  // 🎯 NEW: Get edge color based on view mode
  const getEdgeColor = () => {
    if (viewMode === ViewMode.SOLID) {
      // Solid mode: Black outline edges
      return '#000000';
    } else {
      // Wireframe mode: Black edges
      return '#000000';
    }
  };

  // 🎯 RESPONSIVE LINE WIDTH - Tablet ve küçük ekranlar için optimize edildi
  const getEdgeLineWidth = () => {
    const screenWidth = window.innerWidth;

    if (screenWidth < 768) {
      // Mobile/Tablet
      return 0.4; // Çok ince çizgiler
    } else if (screenWidth < 1024) {
      // Small desktop
      return 0.7; // Orta kalınlık
    } else {
      // Large desktop
      return 1.0; // Normal kalınlık
    }
  };

  // 🎯 NEW: Get material properties based on view mode
  const getMaterialProps = () => {
    const opacityValue = getOpacity(); // 👈 Dinamik opacity

    return {
      color: getShapeColor(),
      transparent: true, // 👈 Şeffaflık aktif
      opacity: opacityValue,
      visible: true, // 👈 2D şekiller için görünür (gizmo etkileşimi için)
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
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        castShadow
        receiveShadow
        visible={true} // 👈 2D şekiller için her zaman görünür (gizmo etkileşimi için)
      >
        <meshPhysicalMaterial {...getMaterialProps()} />
      </mesh>

      {/* 🎯 VIEW MODE BASED EDGES - Görünüm moduna göre çizgiler */}
      {shouldShowEdges() && (
        <lineSegments
          geometry={edgesGeometry}
          position={shape.position}
          rotation={shape.rotation}
          scale={shape.scale}
          visible={true} // Always show edges
        >
          <lineBasicMaterial
            color={getEdgeColor()}
            transparent
            opacity={getEdgeOpacity()}
            depthTest={viewMode === ViewMode.SOLID} // 🎯 Her yerden görünür
            linewidth={getEdgeLineWidth()}
          />
        </lineSegments>
      )}

      {/* 🎯 TRANSFORM CONTROLS - 2D ve 3D şekiller için aktif */}
      {isSelected &&
        meshRef.current &&
        !isEditMode &&
        !isFaceEditMode && (
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
            showX={true}
            showY={shape.is2DShape ? false : true} // 2D şekillerde Y ekseni gizli
            showZ={true}
            enabled={true}
            space="local"
            onObjectChange={() => {
              console.log('🎯 GIZMO CHANGE - Transform controls object changed');
            }}
          />
        )}
    </group>
  );
};

export default React.memo(YagoDesignShape);