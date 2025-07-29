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
import EditModePanel from './ui/EditModePanel';
import PanelEditor from './ui/PanelEditor'; // 🔴 NEW: Import Panel Editor
import { createPortal } from 'react-dom';
import { Shape } from '../types/shapes';
import { fitCameraToShapes, fitCameraToShape } from '../utils/cameraUtils';
import * as THREE from 'three';

interface MeasurementOverlayProps {
  position: { x: number; y: number };
  value: string;
  unit: MeasurementUnit;
  onSubmit: (value: number) => void;
}

const CameraPositionUpdater = () => {
  const { camera } = useThree();
  const { setCameraPosition } = useAppStore();

  useEffect(() => {
    const updateCameraPosition = () => {
      setCameraPosition([
        camera.position.x,
        camera.position.y,
        camera.position.z,
      ]);
    };

    updateCameraPosition();
    camera.addEventListener('change', updateCameraPosition);
    return () => camera.removeEventListener('change', updateCameraPosition);
  }, [camera, setCameraPosition]);

  return null;
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
  const [isAddPanelMode, setIsAddPanelMode] = useState(false);
  const [selectedFaces, setSelectedFaces] = useState<number[]>([]);
  const [hoveredFace, setHoveredFace] = useState<number | null>(null);
  const [hoveredEdge, setHoveredEdge] = useState<number | null>(null);
  const [showEdges, setShowEdges] = useState(true);
  const [showFaces, setShowFaces] = useState(true);

  // 🔴 NEW: Panel Edit Mode State
  const [isPanelEditMode, setIsPanelEditMode] = useState(false);
  const [selectedPanel, setSelectedPanel] = useState<{
    faceIndex: number;
    position: THREE.Vector3;
    size: THREE.Vector3;
    panelOrder: number;
  } | null>(null);
  const [isPanelEditorOpen, setIsPanelEditorOpen] = useState(false);

  // 🎯 PERSISTENT PANELS - Her shape için ayrı panel state'i
  const [shapePanels, setShapePanels] = useState<{
    [shapeId: string]: number[];
  }>({});

  // Face cycle indicator state - moved to Scene component
  const [faceCycleState, setFaceCycleState] = useState<{
    selectedFace: number | null;
    currentIndex: number;
    availableFaces: number[];
    mousePosition: { x: number; y: number } | null;
  }>({
    selectedFace: null,
    currentIndex: 0,
    availableFaces: [],
    mousePosition: null,
  });

  // Disable rotation when drawing polylines OR when panel mode is active
  const isDrawingPolyline = activeTool === 'Polyline';

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
    setIsAddPanelMode(false);
    setSelectedFaces([]);
    setHoveredFace(null);
    setHoveredEdge(null);

    // 🔴 NEW: Reset panel edit mode
    setIsPanelEditMode(false);
    setSelectedPanel(null);
    setIsPanelEditorOpen(false);

    // Reset face cycle state
    setFaceCycleState({
      selectedFace: null,
      currentIndex: 0,
      availableFaces: [],
      mousePosition: null,
    });

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
    setSelectedFaces((prev) => {
      const newFaces = prev.includes(faceIndex)
        ? prev.filter((f) => f !== faceIndex) // Remove if already selected
        : [...prev, faceIndex]; // Add to selection

      // 🎯 IMMEDIATE SAVE - Hemen kaydet
      if (editingShapeId) {
        setShapePanels((prevPanels) => ({
          ...prevPanels,
          [editingShapeId]: [...newFaces],
        }));
        console.log(
          `Panel ${faceIndex} ${
            prev.includes(faceIndex) ? 'removed from' : 'added to'
          } shape ${editingShapeId}`
        );
      }

      return newFaces;
    });
  };

  const handleFaceHover = (faceIndex: number | null) => {
    setHoveredFace(faceIndex);
  };

  // 🔴 NEW: Handle panel selection for editing
  const handlePanelSelect = (panelData: {
    faceIndex: number;
    position: THREE.Vector3;
    size: THREE.Vector3;
    panelOrder: number;
  }) => {
    setSelectedPanel(panelData);
    setIsPanelEditorOpen(true);
    console.log(`🔴 Panel selected for editing:`, {
      faceIndex: panelData.faceIndex,
      position: panelData.position.toArray().map((v) => v.toFixed(1)),
      size: panelData.size.toArray().map((v) => v.toFixed(1)),
      panelOrder: panelData.panelOrder,
    });
  };

  // 🔴 NEW: Handle panel updates from editor
  const handlePanelUpdate = (
    faceIndex: number,
    updates: Partial<{
      faceIndex: number;
      position: THREE.Vector3;
      size: THREE.Vector3;
      panelOrder: number;
    }>
  ) => {
    // Update the panel data in the system
    // This would typically update the panel in the PanelManager
    console.log(`🔴 Panel ${faceIndex} updated:`, updates);

    // Update selected panel if it's the same one
    if (selectedPanel && selectedPanel.faceIndex === faceIndex) {
      setSelectedPanel((prev) => (prev ? { ...prev, ...updates } : null));
    }
  };

  // Handle face cycle updates from OpenCascadeShape
  const handleFaceCycleUpdate = (cycleState: {
    selectedFace: number | null;
    currentIndex: number;
    availableFaces: number[];
    mousePosition: { x: number; y: number } | null;
  }) => {
    setFaceCycleState(cycleState);
  };

  // Filter shapes based on edit mode
  const visibleShapes = shapes.filter(
    (shape) => !hiddenShapeIds.includes(shape.id)
  );

  // Get the currently edited shape for displaying dimensions
  const editedShape = editingShapeId
    ? shapes.find((s) => s.id === editingShapeId)
    : null;

  // 🎯 GET PERSISTENT PANELS FOR CURRENT SHAPE - Mevcut shape için kaydedilmiş panelleri al
  const getCurrentShapePanels = (shapeId: string): number[] => {
    return shapePanels[shapeId] || [];
  };

  return (
    <div className="w-full h-full bg-gray-100">
      {/* WebGL Style Edit Mode Panel */}
      {isEditMode && editedShape && (
        <EditModePanel
          editedShape={editedShape}
          onExit={exitEditMode}
          isAddPanelMode={isAddPanelMode}
          setIsAddPanelMode={setIsAddPanelMode}
          selectedFaces={selectedFaces}
          setSelectedFaces={setSelectedFaces}
          hoveredFace={hoveredFace}
          hoveredEdge={hoveredEdge}
          showEdges={showEdges}
          setShowEdges={setShowEdges}
          showFaces={showFaces}
          setShowFaces={setShowFaces}
          isPanelEditMode={isPanelEditMode}
          setIsPanelEditMode={setIsPanelEditMode}
        />
      )}

      {/* 🔴 NEW: Panel Editor Modal */}
      <PanelEditor
        isOpen={isPanelEditorOpen}
        onClose={() => {
          setIsPanelEditorOpen(false);
          setSelectedPanel(null);
        }}
        selectedPanel={selectedPanel}
        onPanelUpdate={handlePanelUpdate}
        editingShapeId={editingShapeId}
      />

      <Canvas
        ref={canvasRef}
        dpr={[1, 1.5]} // 🎯 REDUCED DPR - Less intensive rendering
        shadows
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          logarithmicDepthBuffer: true,
          toneMapping: THREE.LinearToneMapping, // 🎯 LINEAR TONE MAPPING - No blooms
          toneMappingExposure: 1.0, // 🎯 NORMAL EXPOSURE - No overbrightness
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
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

        {/* 🎯 BALANCED LIGHTING SYSTEM - Bright but no blooms */}
        <Environment preset="apartment" intensity={0.4} blur={0.4} />

        <directionalLight
          position={[2000, 3000, 2000]}
          intensity={0.8}
          castShadow
          shadow-mapSize={[2048, 2048]}
          shadow-bias={-0.0001}
          color="#ffffff"
        >
          <orthographicCamera
            attach="shadow-camera"
            args={[-4000, 4000, 4000, -4000, 1, 8000]}
          />
        </directionalLight>

        <directionalLight
          position={[-1500, 1500, -1500]}
          intensity={0.3}
          color="#f8f9fa"
        />

        <ambientLight intensity={0.5} color="#ffffff" />

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
          // Her shape için kendi kaydedilmiş panellerini kullan
          const shapePersistentPanels = getCurrentShapePanels(shape.id);
          const isCurrentlyEditing = editingShapeId === shape.id;

          return (
            <OpenCascadeShape
              key={shape.id}
              shape={shape}
              onContextMenuRequest={handleShapeContextMenuRequest}
              isEditMode={isEditMode}
              isBeingEdited={isCurrentlyEditing}
              isAddPanelMode={isAddPanelMode && isCurrentlyEditing}
              selectedFaces={
                isCurrentlyEditing ? selectedFaces : shapePersistentPanels
              } // 🎯 PERSISTENT PANELS
              onFaceSelect={handleFaceSelect}
              onFaceHover={handleFaceHover}
              hoveredFace={hoveredFace}
              showEdges={showEdges}
              showFaces={showFaces}
              onFaceCycleUpdate={handleFaceCycleUpdate}
              // 🔴 NEW: Panel Edit Mode props
              isPanelEditMode={isPanelEditMode && isCurrentlyEditing}
              onPanelSelect={handlePanelSelect}
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

      {/* Face Cycle Indicator - Rendered outside Canvas using Portal */}
      {isAddPanelMode &&
        faceCycleState.selectedFace !== null &&
        faceCycleState.mousePosition &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            className="fixed bg-yellow-500/90 text-black px-2 py-1 rounded text-xs font-medium z-50 pointer-events-none"
            style={{
              left: faceCycleState.mousePosition.x + 10,
              top: faceCycleState.mousePosition.y - 30,
            }}
          >
            Face {faceCycleState.selectedFace} (
            {faceCycleState.currentIndex + 1}/
            {faceCycleState.availableFaces.length})
            <div className="text-[10px] mt-0.5">
              Left click: Next face | Right click: Confirm panel
            </div>
          </div>,
          document.body
        )}

      {/* 🔴 NEW: Panel Edit Mode Indicator */}
      {isPanelEditMode &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed top-32 right-4 bg-red-600/90 backdrop-blur-sm text-white px-3 py-2 rounded-lg shadow-lg z-40">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-red-400 rounded-full animate-pulse"></div>
              <span className="text-sm font-medium">Panel Edit Mode</span>
            </div>
            <div className="text-xs text-red-200 mt-1">
              Click on panels to edit dimensions
            </div>
          </div>,
          document.body
        )}

    </div>
  );
};

export default Scene;
