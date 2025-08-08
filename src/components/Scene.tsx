import React, { useRef, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import {
  OrbitControls,
  Grid,
  GizmoHelper,
  GizmoViewport,
  Environment,
  Stats,
  PerspectiveCamera,
  OrthographicCamera,
} from '@react-three/drei';
import {
  useAppStore,
  CameraType,
  Tool,
  MeasurementUnit,
  ViewMode,
} from '../store/appStore';
import OpenCascadeShape from './OpenCascadeShape';
import DrawingPlane from './drawing/DrawingPlane';
import ContextMenu from './ContextMenu';
import EditMode from './ui/EditMode';
import { createPortal } from 'react-dom';
import { Shape } from '../types/shapes';
import { fitCameraToShapes, fitCameraToShape } from '../utils/cameraUtils';
import { FaceSelectionOption } from './PanelManager';
import * as THREE from 'three';

const CameraPositionUpdater = () => {
  const { camera } = useThree();
  const { setCameraPosition } = useAppStore();

  useEffect(() => {
    const updatePosition = () => {
      setCameraPosition([
        camera.position.x,
        camera.position.y,
        camera.position.z,
      ]);
    };

    // Update position initially
    updatePosition();

    // Listen for camera changes
    const controls = (window as any).cameraControls;
    if (controls) {
      controls.addEventListener('change', updatePosition);
      return () => controls.removeEventListener('change', updatePosition);
    }
  }, [camera, setCameraPosition]);

  return null;
};

interface MeasurementOverlayProps {
  position: { x: number; y: number };
  value: string;
  unit: MeasurementUnit;
  onSubmit: (value: number) => void;
}

// NEW: Interface for face selection popup
interface FaceSelectionPopupProps {
  options: FaceSelectionOption[];
  position: { x: number; y: number };
  onSelect: (option: FaceSelectionOption) => void;
  onCancel: () => void;
}

// NEW: Face selection popup component
const FaceSelectionPopup: React.FC<FaceSelectionPopupProps> = ({
  options,
  position,
  onSelect,
  onCancel,
}) => {
  return (
    <div
      className="fixed bg-gray-800/95 backdrop-blur-sm rounded-lg border border-gray-600/50 shadow-2xl z-50 min-w-[320px] max-w-[450px]"
      style={{
        left: Math.min(position.x, window.innerWidth - 350),
        top: Math.min(position.y, window.innerHeight - 300),
      }}
    >
      {/* Header */}
      <div className="px-4 py-3 border-b border-gray-600/50">
        <h3 className="text-white font-medium text-sm">Karşı Taraf Seçimi</h3>
        <p className="text-gray-400 text-xs mt-1">Tıkladığınız yerin arkasındaki yüzeyi seçin</p>
      </div>

      {/* Face Options */}
      <div className="max-h-80 overflow-y-auto">
        <div className="space-y-0">
          {options.map((option, index) => (
            <button
              key={option.id}
              onClick={() => onSelect(option)}
              className="w-full px-4 py-3 text-left hover:bg-gray-700/50 transition-colors border-b border-gray-800/20 last:border-b-0"
            >
              <div className="flex items-center gap-3">
                {/* Face Icon */}
                <div className="flex-shrink-0 w-8 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center text-xs font-bold">
                  {option.faceIndex}
                </div>
                
                {/* Face Details */}
                <div className="flex-1">
                  <div className="text-white text-sm font-medium">{option.name}</div>
                  <div className="text-gray-400 text-xs">{option.description}</div>
                  <div className="flex items-center gap-4 mt-1">
                    <div className="text-blue-400 text-xs">
                      Area: {option.area.toFixed(0)}mm²
                    </div>
                    <div className="text-gray-500 text-xs">
                      Normal: [{option.normal.x}, {option.normal.y}, {option.normal.z}]
                    </div>
                  </div>
                </div>
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-gray-600/50 bg-gray-700/20">
        <div className="flex items-center justify-between">
          <span className="text-gray-400 text-xs">
            Karşı taraf yüzeyi
          </span>
          <button
            onClick={onCancel}
            className="px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white text-xs rounded transition-colors"
          >
            İptal
          </button>
        </div>
      </div>
    </div>
  );
};
interface CameraControllerProps {
  isAddPanelMode: boolean;
}

const CameraController: React.FC<CameraControllerProps> = ({
  isAddPanelMode,
}) => {
  const { camera } = useThree();
  const controlsRef = useRef<any>(null);
  const { shapes, cameraType, isEditMode, editingShapeId, hiddenShapeIds } =
    useAppStore();

  // Handle zoom fit events
  useEffect(() => {
    const handleZoomFit = (event: CustomEvent) => {
      if (!controlsRef.current) return;

      const visibleShapes =
        event.detail?.shapes ||
        shapes.filter((shape) => !hiddenShapeIds.includes(shape.id));
      fitCameraToShapes(camera, controlsRef.current, visibleShapes);
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (
        e.key.toLowerCase() === 'z' &&
        !e.ctrlKey &&
        !e.altKey &&
        !e.shiftKey
      ) {
        // Zoom fit shortcut
        const visibleShapes = shapes.filter(
          (shape) => !hiddenShapeIds.includes(shape.id)
        );
        fitCameraToShapes(camera, controlsRef.current, visibleShapes);
      }
    };

    window.addEventListener('zoomFit', handleZoomFit as EventListener);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('zoomFit', handleZoomFit as EventListener);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [camera, shapes, hiddenShapeIds]);

  // Auto zoom fit when entering edit mode - IMMEDIATE fit to screen
  useEffect(() => {
    if (isEditMode && editingShapeId && controlsRef.current) {
      const editedShape = shapes.find((s) => s.id === editingShapeId);
      if (editedShape) {
        // Immediate zoom fit without delay for better UX
        fitCameraToShape(camera, controlsRef.current, editedShape, 1.5);
        console.log('Edit mode: Auto zoom fit applied immediately');
      }
    }
  }, [isEditMode, editingShapeId, camera, shapes]);

  // Store controls ref globally for external access
  useEffect(() => {
    (window as any).cameraControls = controlsRef.current;
  }, []);

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enabled={true}
      enableDamping={false}
      minDistance={200}
      maxDistance={20000}
      maxPolarAngle={Math.PI}
      minPolarAngle={0}
      target={[0, 0, 0]}
      enablePan={true}
      enableRotate={true} // ✅ ALWAYS ENABLED - even in edit mode and panel mode
      enableZoom={true}
      panSpeed={1}
      rotateSpeed={0.8}
      zoomSpeed={1}
      screenSpacePanning={true}
      mouseButtons={{
        LEFT: -1, // Sol tık = DEVRE DIŞI (sadece seçim için)
        MIDDLE: THREE.MOUSE.ROTATE, // Orta tık BASILI TUTMA = Döndürme 🎯 (EDIT MODUNDA DA ÇALIŞIR!)
        RIGHT: THREE.MOUSE.PAN, // Sağ tık = Pan (kaydırma) 🎯
      }}
      touches={{
        ONE: THREE.TOUCH.ROTATE,
        TWO: THREE.TOUCH.DOLLY_PAN,
      }}
      onChange={() => {
        if (controlsRef.current) {
          const camera = controlsRef.current.object;
          useAppStore
            .getState()
            .setCameraPosition([
              camera.position.x,
              camera.position.y,
              camera.position.z,
            ]);
        }
      }}
    />
  );
};

const Scene: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    shapes,
    gridSize,
    selectShape,
    cameraType,
    activeTool,
    setActiveTool,
    setEditingPolylineId,
    isEditMode,
    setEditMode,
    editingShapeId,
    setEditingShapeId,
    hiddenShapeIds,
    setHiddenShapeIds,
    measurementUnit,
    convertToDisplayUnit,
    convertToBaseUnit,
    updateShape,
    viewMode, // 🎯 NEW: Get current view mode
  } = useAppStore();

  // 🎯 NEW: Handle view mode keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Prevent if user is typing in an input field
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // View mode shortcuts - 1, 2, 3
      if (e.key === '1') {
        const { setViewMode } = useAppStore.getState();
        setViewMode(ViewMode.SOLID);
        console.log('View mode: Solid (1)');
      } else if (e.key === '2') {
        const { setViewMode } = useAppStore.getState();
        setViewMode(ViewMode.WIREFRAME);
        console.log('View mode: Wireframe (2)');
      } else if (e.key === 'v' && !e.ctrlKey && !e.altKey && !e.shiftKey) {
        // V key cycles through view modes
        const { cycleViewMode } = useAppStore.getState();
        cycleViewMode();
        console.log('🎯 View mode toggled with V key');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const [measurementOverlay, setMeasurementOverlay] =
    useState<MeasurementOverlayProps | null>(null);
  const [measurementInput, setMeasurementInput] = useState('');
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    position: { x: number; y: number };
    shape: Shape | null;
  }>({ visible: false, position: { x: 0, y: 0 }, shape: null });

  // 🎯 PERSISTENT PANEL MANAGER STATE - Panels Mode kapansa bile paneller kalır
  // 🔴 NEW: Panel Edit Mode State
  const [isFaceEditMode, setIsFaceEditMode] = useState(false);

  // Face selection state
  const [selectedFaceIndex, setSelectedFaceIndex] = useState<number | null>(null);

  // Disable rotation when drawing polylines OR when panel mode is active
  const isDrawingPolyline = activeTool === 'Polyline';
  const isAddPanelMode = false; // Panel mode removed, always false

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        selectShape(null);
        // Exit edit mode when pressing Escape
        if (isEditMode) {
          exitEditMode();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectShape, isEditMode]);

  useEffect(() => {
    const handleDoubleClick = (e: MouseEvent) => {
      if (canvasRef.current && e.target === canvasRef.current)
        selectShape(null);
    };
    if (canvasRef.current) {
      canvasRef.current.addEventListener('dblclick', handleDoubleClick);
      return () =>
        canvasRef.current?.removeEventListener('dblclick', handleDoubleClick);
    }
  }, [selectShape]);

  useEffect(() => {
    const updateFPS = (fps: number) => {
      const fpsElement = document.getElementById('fps-value');
      if (fpsElement) {
        fpsElement.textContent = fps.toFixed(1);
      }
    };

    let lastTime = performance.now();
    let frames = 0;

    const animate = () => {
      const currentTime = performance.now();
      frames++;

      if (currentTime >= lastTime + 1000) {
        const fps = (frames * 1000) / (currentTime - lastTime);
        updateFPS(fps);
        frames = 0;
        lastTime = currentTime;
      }

      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  // Enhanced camera view controls with more options
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Camera shortcuts work in ALL modes - no restrictions
      const controls = (window as any).cameraControls;
      if (!controls) return;

      const distance = cameraType === CameraType.PERSPECTIVE ? 2000 : 1000;

      switch (e.key.toLowerCase()) {
        case 't':
          // Top view
          controls.object.position.set(0, distance, 0);
          controls.target.set(0, 0, 0);
          controls.update();
          console.log('Camera: Top view');
          break;
        case 'f':
          // Front view
          controls.object.position.set(0, 0, distance);
          controls.target.set(0, 0, 0);
          controls.update();
          console.log('Camera: Front view');
          break;
        case 'r':
          // Right view
          controls.object.position.set(distance, 0, 0);
          controls.target.set(0, 0, 0);
          controls.update();
          console.log('Camera: Right view');
          break;
        case 'l':
          // Left view
          controls.object.position.set(-distance, 0, 0);
          controls.target.set(0, 0, 0);
          controls.update();
          console.log('Camera: Left view');
          break;
        case 'b':
          // Back view
          controls.object.position.set(0, 0, -distance);
          controls.target.set(0, 0, 0);
          controls.update();
          console.log('Camera: Back view');
          break;
        case 'u':
          // Bottom view
          controls.object.position.set(0, -distance, 0);
          controls.target.set(0, 0, 0);
          controls.update();
          console.log('Camera: Bottom view');
          break;
        case 'i':
          // Isometric view - more front-facing with slight upward pan
          controls.object.position.set(
            distance * 0.5,
            distance * 0.8,
            distance * 0.9
          );
          controls.target.set(0, 100, 0); // Slightly elevated target for upward pan
          controls.update();
          console.log('Camera: Isometric view');
          break;
        case 'c':
          // Toggle camera type
          const newCameraType =
            cameraType === CameraType.PERSPECTIVE
              ? CameraType.ORTHOGRAPHIC
              : CameraType.PERSPECTIVE;
          useAppStore.getState().setCameraType(newCameraType);
          console.log(`Camera: Switched to ${newCameraType}`);
          break;
        case 'h':
          // Home/Reset view - more front-facing with slight upward pan
          controls.object.position.set(
            distance * 0.5,
            distance * 0.8,
            distance * 0.9
          );
          controls.target.set(0, 100, 0); // Slightly elevated target for upward pan
          controls.update();
          console.log('Camera: Home view');
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [cameraType, isAddPanelMode]);

  const handleShapeContextMenuRequest = (event: any, shape: Shape) => {
    // Mouse pozisyonunu al
    const x = event.nativeEvent.clientX;
    const y = event.nativeEvent.clientY;

    setContextMenu({
      visible: true,
      position: { x, y },
      shape,
    });

    console.log(
      `Context menu opened for shape: ${shape.type} (ID: ${shape.id})`
    );
  };

  const handleContextMenuClose = () => {
    setContextMenu({ visible: false, position: { x: 0, y: 0 }, shape: null });
  };

  const enterEditMode = (shapeId: string) => {
    console.log(`Entering edit mode for shape: ${shapeId}`);

    // Diğer tüm nesneleri gizle
    const otherShapeIds = shapes
      .filter((shape) => shape.id !== shapeId)
      .map((shape) => shape.id);

    setHiddenShapeIds(otherShapeIds);
    setEditingShapeId(shapeId);
    setEditMode(true);

    // 🎯 RESTORE PERSISTENT PANELS - Bu shape için kaydedilmiş panelleri geri yükle
    if (shapePanels[shapeId]) {
      setSelectedFaces(shapePanels[shapeId]);
      console.log(
        `Restored ${shapePanels[shapeId].length} panels for shape ${shapeId}`
      );
    } else {
      setSelectedFaces([]);
    }

    console.log(`Edit mode activated. Hidden shapes: ${otherShapeIds.length}`);
  };

  const exitEditMode = () => {
    console.log('Exiting edit mode');

    // 🎯 SAVE PERSISTENT PANELS - Mevcut panelleri kaydet
    if (editingShapeId && selectedFaces.length > 0) {
      setShapePanels((prev) => ({
        ...prev,
        [editingShapeId]: [...selectedFaces],
      }));
      console.log(
        `Saved ${selectedFaces.length} panels for shape ${editingShapeId}`
      );
    }

    // Tüm nesneleri tekrar göster
    setHiddenShapeIds([]);
    setEditingShapeId(null);
    setEditMode(false);
    setActiveTool(Tool.SELECT);

    // Reset panel manager state (but keep persistent panels)
    // Reset face edit mode
    setIsFaceEditMode(false);
    setSelectedFaceIndex(null);

    console.log('Edit mode deactivated. All shapes visible again');
  };

  const handleEdit = () => {
    if (!contextMenu.shape) return;

    console.log(
      `Editing shape: ${contextMenu.shape.type} (ID: ${contextMenu.shape.id})`
    );

    // Edit moduna gir
    enterEditMode(contextMenu.shape.id);

    // 2D şekiller için edit moduna geç
    if (contextMenu.shape.is2DShape && contextMenu.shape.originalPoints) {
      if (contextMenu.shape.type === 'polyline2d') {
        setActiveTool(Tool.POLYLINE_EDIT);
        setEditingPolylineId(contextMenu.shape.id);
        console.log('Switched to Polyline Edit mode');
      } else {
        console.log('Edit mode not yet implemented for this 2D shape type');
      }
    } else {
      // 3D şekiller için transform moduna geç
      setActiveTool(Tool.MOVE);
      console.log('Switched to Move mode for 3D shape editing');
    }

    handleContextMenuClose();
  };

  const handleCopy = () => {
    if (!contextMenu.shape) return;
    console.log(`Copy not yet implemented for shape: ${contextMenu.shape.id}`);
    handleContextMenuClose();
  };

  const handleMove = () => {
    if (!contextMenu.shape) return;
    console.log(`Move not yet implemented for shape: ${contextMenu.shape.id}`);
    handleContextMenuClose();
  };

  const handleRotate = () => {
    if (!contextMenu.shape) return;
    console.log(
      `Rotate not yet implemented for shape: ${contextMenu.shape.id}`
    );
    handleContextMenuClose();
  };

  const handleDelete = () => {
    if (!contextMenu.shape) return;
    console.log(
      `Delete not yet implemented for shape: ${contextMenu.shape.id}`
    );
    handleContextMenuClose();
  };

  const handleToggleVisibility = () => {
    if (!contextMenu.shape) return;
    console.log(
      `Toggle visibility not yet implemented for shape: ${contextMenu.shape.id}`
    );
    handleContextMenuClose();
  };

  const handleMeasurementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (measurementOverlay) {
      const value = parseFloat(measurementInput);
      if (!isNaN(value)) {
        measurementOverlay.onSubmit(value);
      }
      setMeasurementOverlay(null);
      setMeasurementInput('');
    }
  };

  useEffect(() => {
    if (measurementOverlay && inputRef.current) {
      inputRef.current.focus();
    }
  }, [measurementOverlay]);

  // 🎯 PERSISTENT PANEL FACE SELECTION - Paneller kalıcı olarak kaydedilir
  const handleFaceSelect = (faceIndex: number) => {
    setSelectedFaceIndex(faceIndex);
    console.log(`🎯 Face ${faceIndex} selected`);
  };

  // 🔴 NEW: Handle panel selection for editing

  // Global face detection functions for geometric calculations
  useEffect(() => {
    // Global function to find closest face to a clicked point
    (window as any).findClosestFaceToPoint = (worldPoint: THREE.Vector3, shape: Shape): number | null => {
      if (shape.type !== 'box') return null;
      
      const { width = 500, height = 500, depth = 500 } = shape.parameters;
      const hw = width / 2;
      const hh = height / 2;
      const hd = depth / 2;
      
      // Convert world point to shape's local coordinate system
      const shapePosition = new THREE.Vector3(...shape.position);
      const localPoint = worldPoint.clone().sub(shapePosition);
      
      console.log(`🎯 World point: [${worldPoint.x.toFixed(1)}, ${worldPoint.y.toFixed(1)}, ${worldPoint.z.toFixed(1)}]`);
      console.log(`🎯 Shape position: [${shapePosition.x.toFixed(1)}, ${shapePosition.y.toFixed(1)}, ${shapePosition.z.toFixed(1)}]`);
      console.log(`🎯 Local point: [${localPoint.x.toFixed(1)}, ${localPoint.y.toFixed(1)}, ${localPoint.z.toFixed(1)}]`);
      
      // Define face data with centers and normals
      const faces = [
        { index: 0, center: new THREE.Vector3(0, 0, hd), normal: new THREE.Vector3(0, 0, 1), name: 'Front' },
        { index: 1, center: new THREE.Vector3(0, 0, -hd), normal: new THREE.Vector3(0, 0, -1), name: 'Back' },
        { index: 2, center: new THREE.Vector3(0, hh, 0), normal: new THREE.Vector3(0, 1, 0), name: 'Top' },
        { index: 3, center: new THREE.Vector3(0, -hh, 0), normal: new THREE.Vector3(0, -1, 0), name: 'Bottom' },
        { index: 4, center: new THREE.Vector3(hw, 0, 0), normal: new THREE.Vector3(1, 0, 0), name: 'Right' },
        { index: 5, center: new THREE.Vector3(-hw, 0, 0), normal: new THREE.Vector3(-1, 0, 0), name: 'Left' },
      ];
      
      // Calculate distances from click point to all face centers and sort by distance
      const faceDistances = faces.map(face => {
        const distanceToCenter = localPoint.distanceTo(face.center);
        const pointToCenter = localPoint.clone().sub(face.center);
        const projectionDistance = Math.abs(pointToCenter.dot(face.normal));
        
        console.log(`🎯 Face ${face.index} (${face.name}): Distance to center: ${distanceToCenter.toFixed(1)}, Projection distance: ${projectionDistance.toFixed(1)}`);
        
        return {
          index: face.index,
          name: face.name,
          distance: distanceToCenter,
          projectionDistance: projectionDistance,
          isOnPlane: projectionDistance < 50 // 50mm threshold
        };
      }).sort((a, b) => a.distance - b.distance); // Sort by distance to center
      
      console.log(`🎯 Faces sorted by distance:`, faceDistances.map(f => 
        `${f.name}(${f.index}): ${f.distance.toFixed(1)}mm ${f.isOnPlane ? '✓' : '✗'}`
      ).join(', '));
      
      // First try to find a face that the point is actually on
      const faceOnPlane = faceDistances.find(f => f.isOnPlane);
      if (faceOnPlane) {
        console.log(`🎯 Point is on face: ${faceOnPlane.name} (${faceOnPlane.index})`);
        return faceOnPlane.index;
      }
      
      // If no face is directly under the point, return the closest one
      const closestFace = faceDistances[0];
      console.log(`🎯 Closest face: ${closestFace.name} (${closestFace.index}) at ${closestFace.distance.toFixed(1)}mm`);
      
      return closestFace.index;
    };
    
    // Global function to find next face based on distance to last click point
    (window as any).findNextAdjacentFace = (currentFace: number, shape: Shape): number => {
      // This function is now handled by PanelManager's findNextFace method
      // which uses the stored click position for distance-based sorting
      return (currentFace + 1) % 6; // Fallback
    };
    
    return () => {
      delete (window as any).findClosestFaceToPoint;
      delete (window as any).findNextAdjacentFace;
    };
  }, []);

  // Handle face cycle updates from OpenCascadeShape
  // Filter shapes based on edit mode
  const visibleShapes = shapes.filter(
    (shape) => !hiddenShapeIds.includes(shape.id)
  );

  // Get the currently edited shape for displaying dimensions
  const editedShape = editingShapeId
    ? shapes.find((s) => s.id === editingShapeId)
    : null;

  return (
    <div className="w-full h-full bg-gray-100">
      {/* WebGL Style Edit Mode Panel */}
      {isEditMode && editedShape && (
        <EditMode
          editedShape={editedShape}
          onExit={exitEditMode}
          hoveredFace={null}
          hoveredEdge={null}
          showEdges={true}
          setShowEdges={() => {}}
          showFaces={true}
          setShowFaces={() => {}}
          isFaceEditMode={isFaceEditMode}
          setIsFaceEditMode={setIsFaceEditMode}
        />
      )}

      <Canvas
        ref={canvasRef}
        dpr={[1.5, 2]} // 🎯 HIGH QUALITY DPR - Better rendering quality
        shadows
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          logarithmicDepthBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping, // 🎯 CINEMATIC TONE MAPPING
          toneMappingExposure: 1.2, // 🎯 ENHANCED EXPOSURE
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
          stencil: true,
          depth: true,
          precision: 'highp',
        }}
        camera={{
          near: 1,
          far: 50000,
        }}
      >
        <CameraPositionUpdater />
        <CameraController isAddPanelMode={isAddPanelMode} />
        <Stats className="hidden" />

        {cameraType === CameraType.PERSPECTIVE ? (
          <PerspectiveCamera
            makeDefault
            position={[1000, 1600, 1800]} // More front-facing with slight upward angle
            fov={45}
            near={1}
            far={50000}
          />
        ) : (
          <OrthographicCamera
            makeDefault
            position={[1000, 1600, 1800]} // More front-facing with slight upward angle
            zoom={0.25}
            near={-50000}
            far={50000}
          />
        )}

        {/* 🎯 HIGH QUALITY LIGHTING SYSTEM */}
        <Environment preset="city" intensity={0.6} blur={0.2} />

        <directionalLight
          position={[2000, 3000, 2000]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[4096, 4096]}
          shadow-bias={-0.0001}
          shadow-normalBias={0.02}
          shadow-radius={4}
          color="#ffffff"
        >
          <orthographicCamera
            attach="shadow-camera"
            args={[-4000, 4000, 4000, -4000, 1, 8000]}
          />
        </directionalLight>

        <directionalLight
          position={[-1500, 1500, -1500]}
          intensity={0.5}
          color="#e0f2fe"
        />

        <directionalLight
          position={[0, 2000, 1000]}
          intensity={0.4}
          color="#fef3c7"
        />

        <ambientLight intensity={0.3} color="#f1f5f9" />

        {/* 🎯 NEW: Additional fill lights for better quality */}
        <pointLight
          position={[1000, 1000, 1000]}
          intensity={0.3}
          color="#ffffff"
          decay={2}
          distance={3000}
        />

        <pointLight
          position={[-1000, 500, -1000]}
          intensity={0.2}
          color="#e0f2fe"
          decay={2}
          distance={2000}
        />

        <DrawingPlane
          onShowMeasurement={setMeasurementOverlay}
          onHideMeasurement={() => setMeasurementOverlay(null)}
        />

        <group position={[0, -0.001, 0]}>
          <Grid
            args={[50000, 50000]}
            cellSize={gridSize}
            cellThickness={2}
            cellColor="#666"
            sectionSize={gridSize * 5}
            sectionThickness={3}
            sectionColor="#444"
            fadeDistance={Infinity}
            fadeStrength={0}
            followCamera={false}
            infiniteGrid
            renderOrder={-1}
          >
            <meshBasicMaterial
              transparent
              opacity={0.6}
              depthWrite={false}
              toneMapped={false}
            />
          </Grid>
        </group>

        {/* 🎯 PERSISTENT PANELS - Render shapes with their persistent panels */}
        {visibleShapes.map((shape) => {
          const isCurrentlyEditing = editingShapeId === shape.id;

          return (
            <OpenCascadeShape
              key={shape.id}
              shape={shape}
              onContextMenuRequest={handleShapeContextMenuRequest}
              isEditMode={isEditMode}
              isBeingEdited={isCurrentlyEditing}
              // Face Edit Mode props
              isFaceEditMode={isFaceEditMode && isCurrentlyEditing}
              selectedFaceIndex={selectedFaceIndex}
              onFaceSelect={handleFaceSelect}
            />
          );
        })}

        {/* Moved gizmo higher to avoid terminal overlap */}
        <GizmoHelper alignment="bottom-right" margin={[80, 120]}>
          <GizmoViewport
            axisColors={['#f73', '#0af', '#0f3']}
            labelColor="black"
          />
        </GizmoHelper>
      </Canvas>

      {measurementOverlay &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            style={{
              position: 'fixed',
              left: measurementOverlay.position.x,
              top: measurementOverlay.position.y,
              transform: 'translate(-50%, -100%)',
              zIndex: 1000,
            }}
            className="bg-white rounded-md shadow-lg p-2"
          >
            <form
              onSubmit={handleMeasurementSubmit}
              className="flex items-center gap-2"
            >
              <input
                ref={inputRef}
                type="number"
                value={measurementInput}
                onChange={(e) => setMeasurementInput(e.target.value)}
                className="w-20 px-2 py-1 border rounded"
                placeholder="Length"
                step="any"
              />
              <span className="text-sm text-gray-600">
                {measurementOverlay.unit}
              </span>
            </form>
          </div>,
          document.body
        )}

      {/* Context Menu Portal - Rendered outside Canvas */}
      {contextMenu.visible &&
        contextMenu.shape &&
        typeof document !== 'undefined' &&
        createPortal(
          <ContextMenu
            position={contextMenu.position}
            shapeId={contextMenu.shape.id}
            shapeType={contextMenu.shape.type}
            onClose={handleContextMenuClose}
            onEdit={handleEdit}
            onCopy={handleCopy}
            onMove={handleMove}
            onRotate={handleRotate}
            onDelete={handleDelete}
            onToggleVisibility={handleToggleVisibility}
          />,
          document.body
        )}

      {/* Face Edit Mode Indicator */}
      {isFaceEditMode &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed top-32 right-4 bg-orange-600/90 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-lg z-40">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-orange-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Face Edit Mode</span>
            </div>
            <div className="text-xs text-orange-200 mt-1">
              Click on faces to select them
            </div>
          </div>,
          document.body
        )}

    </div>
  );
};

export default Scene;