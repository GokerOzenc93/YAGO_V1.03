import React, { useRef, useEffect, useState, useMemo } from 'react';
import { useThree } from '@react-three/fiber';
import { Text, Billboard } from '@react-three/drei';
import { useAppStore, Tool, CameraType, SnapType } from '../../store/appStore';
import * as THREE from 'three';
import { CompletedShape, DrawingState, INITIAL_DRAWING_STATE } from './types';
import { snapToGrid } from './utils';
import { findSnapPoints, SnapPointIndicators } from './snapSystem.tsx';
import { 
  DimensionDisplay, 
  DimensionPreview, 
  createDimension, 
  DimensionLine,
  INITIAL_DIMENSIONS_STATE 
} from './dimensionsSystem';
import { convertTo3DShape, extrudeShape } from './shapeConverter';
import { createRectanglePoints, createCirclePoints } from './utils';

// Helper function to calculate angle between two vectors
const calculateAngle = (v1: THREE.Vector3, v2: THREE.Vector3): number => {
  const angle = v1.angleTo(v2);
  return THREE.MathUtils.radToDeg(angle);
};

// Helper function to get angle from previous segment
const getPreviousSegmentAngle = (points: THREE.Vector3[], currentDirection: THREE.Vector3): number | null => {
  if (points.length < 2) return null;
  
  const lastPoint = points[points.length - 1];
  const secondLastPoint = points[points.length - 2];
  const previousDirection = new THREE.Vector3().subVectors(lastPoint, secondLastPoint).normalize();
  
  return calculateAngle(previousDirection, currentDirection);
};

interface DrawingPlaneProps {
  onShowMeasurement?: (data: any) => void;
  onHideMeasurement?: () => void;
}

const DrawingPlane: React.FC<DrawingPlaneProps> = ({ onShowMeasurement, onHideMeasurement }) => {
  const { 
    activeTool, 
    gridSize, 
    measurementUnit, 
    convertToDisplayUnit, 
    convertToBaseUnit, 
    addShape, 
    setActiveTool, 
    selectShape, 
    cameraType, 
    setCameraType,
    snapSettings,
    snapTolerance,
    shapes,
    editingPolylineId,
    setEditingPolylineId,
    pointToPointMoveState,
    setPointToPointMoveState,
    resetPointToPointMove,
    updateShape,
    enableAutoSnap,
    disableAutoSnap
  } = useAppStore();
  
  // Drawing state
  const [drawingState, setDrawingState] = useState<DrawingState>(INITIAL_DRAWING_STATE);
  const [completedShapes, setCompletedShapes] = useState<CompletedShape[]>([]);
  const [hoveredShapeId, setHoveredShapeId] = useState<string | null>(null);
  const [draggedNodeIndex, setDraggedNodeIndex] = useState<number | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [previousCameraType, setPreviousCameraType] = useState<CameraType | null>(null);
  const [showExtrudeInput, setShowExtrudeInput] = useState(false);
  const [extrudeHeight, setExtrudeHeight] = useState('');
  const [pendingExtrudeShape, setPendingExtrudeShape] = useState<CompletedShape | null>(null);
  
  // Dimensions state
  const [dimensionsState, setDimensionsState] = useState(INITIAL_DIMENSIONS_STATE);
  
  const planeRef = useRef<THREE.Mesh>(null);
  const { camera, raycaster, gl } = useThree();

  // Helper function to update drawing state
  const updateDrawingState = (updates: Partial<DrawingState>) => {
    setDrawingState(prev => ({ ...prev, ...updates }));
  };

  // Update polyline status when drawing state changes
  useEffect(() => {
    if ((activeTool === Tool.POLYLINE || activeTool === Tool.POLYGON) && 
        drawingState.isDrawing && 
        drawingState.currentPoint && 
        drawingState.previewPoint) {
      
      const distance = drawingState.currentPoint.distanceTo(drawingState.previewPoint);
      const direction = new THREE.Vector3().subVectors(drawingState.previewPoint, drawingState.currentPoint);
      
      // Calculate angle from X-axis
      let angle = Math.atan2(direction.z, direction.x) * 180 / Math.PI;
      if (angle < 0) angle += 360;
      
      // Update terminal status
      if ((window as any).setPolylineStatus) {
        (window as any).setPolylineStatus({
          distance: convertToDisplayUnit(distance),
          angle: angle,
          unit: measurementUnit
        });
      }
    } else if (!drawingState.isDrawing && (window as any).setPolylineStatus) {
      // Clear status when not drawing
      (window as any).setPolylineStatus(null);
    }
  }, [activeTool, drawingState.isDrawing, drawingState.currentPoint, drawingState.previewPoint, convertToDisplayUnit, measurementUnit]);

  // Auto-switch to top view and orthographic camera when starting drawing tools
  useEffect(() => {
    const drawingTools = [Tool.POLYLINE, Tool.POLYGON, Tool.RECTANGLE, Tool.CIRCLE];
    
    // Kamera otomatik değişimi tamamen kaldırıldı - kullanıcı hangi açıdaysa o açıda çizim yapar
    
    if (![Tool.POLYLINE, Tool.POLYGON, Tool.RECTANGLE, Tool.CIRCLE, Tool.POLYLINE_EDIT].includes(activeTool) && previousCameraType !== null) {
      setCameraType(previousCameraType);
      setPreviousCameraType(null);
      console.log(`Restored camera type to: ${previousCameraType}`);
    }
  }, [activeTool, drawingState.isDrawing, cameraType, setCameraType, previousCameraType]);

  // Reset drawing state when tool changes
  useEffect(() => {
    // Auto snap kontrolü
    if (activeTool === Tool.POLYLINE || activeTool === Tool.POLYGON) {
      enableAutoSnap(activeTool);
    } else if (activeTool === Tool.POINT_TO_POINT_MOVE) {
      enableAutoSnap(activeTool);
    } else if (activeTool === Tool.DIMENSION) {
      enableAutoSnap(activeTool);
    } else {
      disableAutoSnap();
    }
    
    if (![Tool.POLYLINE, Tool.POLYGON, Tool.RECTANGLE, Tool.CIRCLE, Tool.POLYLINE_EDIT, Tool.POINT_TO_POINT_MOVE, Tool.DIMENSION].includes(activeTool)) {
      setDrawingState(INITIAL_DRAWING_STATE);
      setDimensionsState(INITIAL_DIMENSIONS_STATE);
      
      // Polyline status'u temizle
      if ((window as any).setPolylineStatus) {
        (window as any).setPolylineStatus(null);
      }
      
      if (activeTool !== Tool.POLYLINE_EDIT) {
        setEditingPolylineId(null);
        setDraggedNodeIndex(null);
        setIsDragging(false);
      }
      
      // Point to Point Move'u temizle
      if (activeTool !== Tool.POINT_TO_POINT_MOVE) {
        resetPointToPointMove();
      }
    }
  }, [activeTool, setEditingPolylineId, resetPointToPointMove]);

  const getIntersectionPoint = (event: PointerEvent): THREE.Vector3 | null => {
    if (!planeRef.current) return null;

    const rect = gl.domElement.getBoundingClientRect();
    const x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    
    // Store mouse screen position for snap calculations
    const mouseScreenPos = new THREE.Vector2(event.clientX - rect.left, event.clientY - rect.top);

    raycaster.setFromCamera({ x, y }, camera);
    
    // 🎯 ROBUST WORLD COORDINATE CALCULATION
    // Ray'i Y=0 düzlemiyle kesiştirir (2D çizim için)
    const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const worldPoint = new THREE.Vector3();
    const intersectionSuccess = raycaster.ray.intersectPlane(plane, worldPoint);
    
    if (!intersectionSuccess) {
      console.warn('🎯 Ray plane intersection failed');
      return null;
    }
    
    console.log(`🎯 WORLD POINT: [${worldPoint.x.toFixed(1)}, ${worldPoint.y.toFixed(1)}, ${worldPoint.z.toFixed(1)}]`);
    
    // 🎯 SNAP DETECTION with increased tolerance for perspective
    const perspectiveTolerance = snapTolerance * (camera instanceof THREE.PerspectiveCamera ? 3 : 1);
    
    const snapPoints = findSnapPoints(
      worldPoint,
      completedShapes, 
      shapes, 
      snapSettings, 
      perspectiveTolerance,
      drawingState.currentPoint,
      drawingState.currentDirection,
      camera,
      gl.domElement,
      mouseScreenPos
    );
    
    let finalPoint: THREE.Vector3;
    
    if (snapPoints.length > 0) {
      const closestSnap = snapPoints[0];
      updateDrawingState({ snapPoint: closestSnap });
      finalPoint = closestSnap.point;
      console.log(`✅ SNAPPED to ${closestSnap.type} at [${finalPoint.x.toFixed(1)}, ${finalPoint.z.toFixed(1)}] (distance: ${closestSnap.distance.toFixed(1)})`);
    } else {
      updateDrawingState({ snapPoint: null });
      finalPoint = new THREE.Vector3(
        snapToGrid(worldPoint.x, gridSize),
        0,
        snapToGrid(worldPoint.z, gridSize)
      );
      console.log(`🎯 GRID SNAP: [${finalPoint.x.toFixed(1)}, ${finalPoint.z.toFixed(1)}]`);
    }
    
    return finalPoint;
  };

  const updatePolylinePoint = (shapeId: string, pointIndex: number, newPosition: THREE.Vector3) => {
    setCompletedShapes(prev => prev.map(shape => {
      if (shape.id === shapeId && shape.type === 'polyline') {
        const newPoints = [...shape.points];
        newPoints[pointIndex] = newPosition;
        
        if (shape.isClosed && pointIndex === 0) {
          newPoints[newPoints.length - 1] = newPosition;
        } else if (shape.isClosed && pointIndex === newPoints.length - 1) {
          newPoints[0] = newPosition;
        }
        
        return { ...shape, points: newPoints };
      }
      return shape;
    }));
  };

  
// helper: terminal input'a odaklan
const focusTerminalForMeasurement = () => {
  setTimeout(() => {
    if ((window as any).terminalInputRef?.current) {
      (window as any).terminalInputRef.current.focus();
      (window as any).terminalInputRef.current.select();
      console.log('Terminal input auto-focused for polyline measurement');
    } else {
      console.warn('Terminal input ref not found for focusing');
    }
  }, 80);
};

  // Handle measurement input from terminal
  const handleMeasurementInput = (input: string | number) => {
    if (!drawingState.currentPoint || !drawingState.isDrawing) {
      console.log('🎯 Cannot apply measurement: missing context');
      return;
    }

    // Handle Rectangle input (width,height format)
    if (activeTool === Tool.RECTANGLE && typeof input === 'string' && input.includes(',')) {
      const parts = input.split(',').map(s => s.trim());
      const width = parseFloat(parts[0]);
      const height = parseFloat(parts[1]);
      
      if (isNaN(width) || isNaN(height) || width <= 0 || height <= 0) {
        console.log('🎯 Invalid rectangle dimensions');
        return;
      }
      
      // Fare yönüne göre dikdörtgen oluştur
      if (!drawingState.previewPoint) {
        console.log('🎯 No preview point for direction reference');
        return;
      }
      
      // Fare yönünü hesapla
      const mouseDirection = new THREE.Vector3()
        .subVectors(drawingState.previewPoint, drawingState.currentPoint)
        .normalize();
      
      // Fare yönüne göre width ve height'ı uygula
      const deltaX = mouseDirection.x >= 0 ? width : -width;
      const deltaZ = mouseDirection.z >= 0 ? height : -height;
      
      const newPoint = new THREE.Vector3(
        drawingState.currentPoint.x + deltaX,
        0,
        drawingState.currentPoint.z + deltaZ
      );
      
      newPoint.x = snapToGrid(newPoint.x, gridSize);
      newPoint.z = snapToGrid(newPoint.z, gridSize);
      
      // Complete the rectangle
      const shapeId = Math.random().toString(36).substr(2, 9);
      const rectPoints = createRectanglePoints(drawingState.currentPoint, newPoint);
      const newShape: CompletedShape = {
        id: shapeId,
        type: 'rectangle',
        points: rectPoints,
        dimensions: { width, height },
        isClosed: true
      };
      
      setCompletedShapes(prev => [...prev, newShape]);
      console.log(`Rectangle completed via TERMINAL: ${width}x${height}mm`);
      
      convertAndCleanup(newShape);
      finishDrawing();
      return;
    }
    
    // Handle Polyline/Polygon input (existing logic)
    if (!drawingState.currentDirection || ![Tool.POLYLINE, Tool.POLYGON].includes(activeTool)) {
      console.log('🎯 Cannot apply measurement: missing direction or wrong tool');
      return;
    }

    let distance: number;
    let angle: number | null = null;
    
    if (typeof input === 'string' && input.includes(',')) {
      // Format: "uzunluk,açı" (örn: "100,45")
      const parts = input.split(',').map(s => s.trim());
      distance = parseFloat(parts[0]);
      if (parts[1] && parts[1] !== '') {
        angle = parseFloat(parts[1]);
      }
    } else {
      // Sadece uzunluk
      distance = typeof input === 'string' ? parseFloat(input) : input;
    }
    
    if (isNaN(distance) || distance <= 0) {
      console.log('🎯 Invalid distance value');
      return;
    }
    
    let direction = drawingState.currentDirection.clone();
    
    // Eğer açı belirtildiyse, yönü açıya göre ayarla
    if (angle !== null && !isNaN(angle)) {
      // Açıyı radyana çevir
      const angleRad = THREE.MathUtils.degToRad(angle);
      
      // İlk çizgi için X ekseninden açı hesapla
      if (drawingState.points.length === 1) {
        direction = new THREE.Vector3(Math.cos(angleRad), 0, Math.sin(angleRad));
      } else {
        // Sonraki çizgiler için önceki segmente göre açı hesapla
        const lastPoint = drawingState.points[drawingState.points.length - 1];
        const secondLastPoint = drawingState.points[drawingState.points.length - 2];
        const previousDirection = lastPoint.clone().sub(secondLastPoint).normalize();
        
        // Önceki yönden belirtilen açı kadar döndür
        const rotationMatrix = new THREE.Matrix4().makeRotationY(angleRad);
        direction = previousDirection.clone().applyMatrix4(rotationMatrix);
      }
      
      console.log(`🎯 Direction set by angle: ${angle}°`);
    }
    
    const newPoint = drawingState.currentPoint.clone().add(direction.multiplyScalar(distance));
    
    newPoint.x = snapToGrid(newPoint.x, gridSize);
    newPoint.z = snapToGrid(newPoint.z, gridSize);

    updateDrawingState({
      points: [...drawingState.points, newPoint],
      currentPoint: newPoint,
      waitingForMeasurement: false,
      measurementApplied: true
    });
    
    const angleText = angle !== null ? ` at ${angle}°` : '';
    console.log(`🎯 ${activeTool} segment added via TERMINAL: ${distance.toFixed(1)}mm${angleText}`);
  };

  // Handle extrude height input from terminal
  const handleExtrudeInput = (height: number) => {
    if (!pendingExtrudeShape) {
      console.log('No pending shape to extrude');
      return;
    }
    
    const heightInMm = convertToBaseUnit(height);
    if (isNaN(heightInMm) || heightInMm <= 0) {
      console.log('Invalid extrude height');
      return;
    }
    
    // Create extruded 3D shape
    extrudeShape(pendingExtrudeShape, addShape, heightInMm, gridSize);
    
    // Cleanup
    setCompletedShapes(prev => prev.filter(s => s.id !== pendingExtrudeShape.id));
    setPendingExtrudeShape(null);
    
    console.log(`${pendingExtrudeShape.type} extruded with height: ${heightInMm}mm`);
  };

  // Handle converting to 2D selectable object
  const handleConvertTo2D = () => {
    if (!pendingExtrudeShape) {
      console.log('No pending shape to convert');
      return;
    }
    
    // Simply remove the pending shape without creating any object
    console.log(`${pendingExtrudeShape.type} drawing cancelled - no object created`);
    
    // Cleanup
    setCompletedShapes(prev => prev.filter(s => s.id !== pendingExtrudeShape.id));
    setPendingExtrudeShape(null);
    
    // Clear terminal status
    if ((window as any).setPolylineStatus) {
      (window as any).setPolylineStatus(null);
    }
  };
  // Expose measurement input handler globally
  // Handle extrude submit
  const handleExtrudeSubmit = () => {
    if (!extrudeHeight || !pendingExtrudeShape) return;
    
    const height = parseFloat(extrudeHeight);
    if (!isNaN(height) && height > 0) {
      handleExtrudeInput(height);
      setExtrudeHeight('');
    }
  };

  // Handle extrude cancel
  const handleExtrudeCancel = () => {
    setPendingExtrudeShape(null);
    setExtrudeHeight('');
    console.log('Extrude operation cancelled');
  };

  useEffect(() => {
    (window as any).handlePolylineMeasurement = handleMeasurementInput;
    
    // Expose extrude height handler globally  
    (window as any).handleExtrudeHeight = handleExtrudeInput;
    
    // Expose convert to 2D handler globally
    (window as any).handleConvertTo2D = handleConvertTo2D;
    
    // Expose pending extrude shape globally for terminal access
    (window as any).pendingExtrudeShape = pendingExtrudeShape;
    
    return () => {
      delete (window as any).handlePolylineMeasurement;
      delete (window as any).handleExtrudeHeight;
      delete (window as any).handleConvertTo2D;
      delete (window as any).pendingExtrudeShape;
    };
  }, [handleMeasurementInput, handleExtrudeInput, handleConvertTo2D, pendingExtrudeShape]);

  // Auto-focus terminal input when extrude dialog shows
  useEffect(() => {
    if (pendingExtrudeShape) {
      // Focus terminal input after a short delay
      setTimeout(() => {
        const terminalInput = document.querySelector('input[placeholder*="Enter extrude height"]') as HTMLInputElement;
        if (terminalInput) {
          terminalInput.focus();
          terminalInput.select();
          console.log('Terminal input auto-focused for extrude height');
        }
      }, 100);
    }
  }, [pendingExtrudeShape]);

  // Handle keyboard input for extrude height
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (pendingExtrudeShape) {
        if (event.key === 'Enter' && extrudeHeight) {
          handleExtrudeSubmit();
        } else if (event.key === 'Escape') {
          handleExtrudeCancel();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [pendingExtrudeShape, extrudeHeight, handleExtrudeSubmit, handleExtrudeCancel]);

  // UNIFIED: Convert to 3D and cleanup function
  const convertAndCleanup = (shape: CompletedShape) => {
    // Extrude için bekleyen şekil olarak kaydet
    setPendingExtrudeShape(shape);
    
    // Terminal'e odaklan ve extrude yüksekliği iste
    setTimeout(() => {
      if ((window as any).terminalInputRef?.current) {
        (window as any).terminalInputRef.current.focus();
        console.log(`${shape.type} tamamlandı. Terminal'e extrude yüksekliği girin (örn: 500) veya Enter ile 2D nesne olarak ekleyin`);
        
        // Terminal'de extrude mesajını göster
        if ((window as any).setPolylineStatus) {
          (window as any).setPolylineStatus({
            distance: 0,
            unit: 'Extrude yüksekliği girin (örn: 500) veya Enter ile iptal'
          });
        }
      }
    }, 100);
  };

  // UNIFIED: Finish drawing function
  const finishDrawing = () => {
    setDrawingState(INITIAL_DRAWING_STATE);
    setActiveTool(Tool.SELECT);
    console.log('Drawing completed, switched to Select tool');
  };

  // UNIFIED: Handle polyline/polygon drawing
  const handlePolylinePolygonDrawing = (point: THREE.Vector3) => {
    if (!drawingState.isDrawing) {
      setDrawingState({
        isDrawing: true,
        points: [point],
        currentPoint: point,
        previewPoint: point,
        waitingForMeasurement: false,
        measurementApplied: false
      });
      console.log(`Started drawing ${activeTool.toLowerCase()}`);
    } else {
      const firstPoint = drawingState.points[0];
      const isClosing = firstPoint && point.distanceTo(firstPoint) < gridSize;
      
      if (isClosing && drawingState.points.length >= 3) {
        const shapeId = Math.random().toString(36).substr(2, 9);
        const allPoints = [...drawingState.points, firstPoint];
        
        const newShape: CompletedShape = {
          id: shapeId,
          type: activeTool === Tool.POLYGON ? 'polygon' : 'polyline',
          points: allPoints,
          isClosed: true
        };
        
        setCompletedShapes(prev => [...prev, newShape]);
        console.log(`${activeTool} closed with ${allPoints.length} points`);
        
        convertAndCleanup(newShape);
        finishDrawing();
      } else {
        updateDrawingState({
        points: [...drawingState.points, point],
        currentPoint: point,
        waitingForMeasurement: true,
        measurementApplied: false
        });
      focusTerminalForMeasurement();
      console.log(`${activeTool} point added: ${drawingState.points.length + 1} points total`);
      }
    }
  };

  // UNIFIED: Handle rectangle/circle drawing
  const handleShapeDrawing = (point: THREE.Vector3) => {
    if (!drawingState.isDrawing) {
      setDrawingState({
        isDrawing: true,
        points: [point],
        currentPoint: point,
        previewPoint: point,
        waitingForMeasurement: true
      });
      focusTerminalForMeasurement();
      console.log(`Started drawing ${activeTool.toLowerCase()}`);
    } else {
      const shapeId = Math.random().toString(36).substr(2, 9);
      let newShape: CompletedShape;

      switch (activeTool) {
        case Tool.RECTANGLE: {
          // Fare yönüne göre dikdörtgen oluştur
          const startPoint = drawingState.points[0];
          const endPoint = point;
          const rectPoints = createRectanglePoints(startPoint, endPoint);
          
          // Gerçek boyutları hesapla (işaret dahil)
          const actualWidth = endPoint.x - startPoint.x;
          const actualHeight = endPoint.z - startPoint.z;
          
          newShape = {
            id: shapeId,
            type: 'rectangle',
            points: rectPoints,
            dimensions: { width: Math.abs(actualWidth), height: Math.abs(actualHeight) },
            isClosed: true
          };
          console.log(`Rectangle completed: ${Math.abs(actualWidth).toFixed(1)}x${Math.abs(actualHeight).toFixed(1)}mm`);
          break;
        }
        case Tool.CIRCLE: {
          const radius = drawingState.points[0].distanceTo(point);
          const circlePoints = createCirclePoints(drawingState.points[0], radius);
          newShape = {
            id: shapeId,
            type: 'circle',
            points: circlePoints,
            dimensions: { radius },
            isClosed: true
          };
          console.log(`Circle completed: radius ${radius.toFixed(1)}mm`);
          break;
        }
        default:
          return;
      }

      setCompletedShapes(prev => [...prev, newShape]);
      console.log(`Shape completed with ID: ${shapeId}`);
      
      convertAndCleanup(newShape);
      finishDrawing();
    }
  };

  const handlePointerDown = (event: THREE.Event<PointerEvent>) => {
    // Handle Dimension tool
    if (activeTool === Tool.DIMENSION) {
      if (event.nativeEvent.button !== 0) return;
      
      const point = getIntersectionPoint(event.nativeEvent);
      if (!point) return;
      
      event.stopPropagation();
      
      if (!dimensionsState.firstPoint) {
        // İlk nokta seçimi
        setDimensionsState({
          ...dimensionsState,
          isActive: true,
          firstPoint: point,
        });
        console.log(`🎯 Dimension: First point selected at [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`);
      } else {
        // İkinci nokta seçimi - dimension oluştur
        const newDimension = createDimension(dimensionsState.firstPoint, point);
        
        setDimensionsState({
          ...dimensionsState,
          dimensions: [...dimensionsState.dimensions, newDimension],
          firstPoint: null,
          previewPoint: null,
          isActive: false,
        });
        
        console.log(`🎯 Dimension created: ${newDimension.distance.toFixed(1)}mm between two points`);
        
        // Dimension tool'da kal, yeni ölçüm için hazır ol
      }
      return;
    }

    // Handle Point to Point Move
    if (activeTool === Tool.POINT_TO_POINT_MOVE && pointToPointMoveState.isActive) {
      if (event.nativeEvent.button !== 0) return;
      
      const point = getIntersectionPoint(event.nativeEvent);
      if (!point) return;
      
      event.stopPropagation();
      
      if (!pointToPointMoveState.sourcePoint) {
        // İlk nokta seçimi - kaynak snap noktası
        setPointToPointMoveState({
          sourcePoint: point,
        });
        console.log(`🎯 Point to Point Move: Source point selected at [${point.x.toFixed(1)}, ${point.y.toFixed(1)}, ${point.z.toFixed(1)}]`);
      } else {
        // İkinci nokta seçimi - hedef snap noktası ve taşıma işlemi
        const sourcePoint = pointToPointMoveState.sourcePoint;
        const targetPoint = point;
        const shapeId = pointToPointMoveState.selectedShapeId;
        
        if (shapeId) {
          const shape = shapes.find(s => s.id === shapeId);
          if (shape) {
            // Taşıma vektörünü hesapla
            const moveVector = new THREE.Vector3().subVectors(targetPoint, sourcePoint);
            
            // Yeni pozisyonu hesapla
            const newPosition = new THREE.Vector3(...shape.position).add(moveVector);
            
            // Grid'e snap yap
            const snappedPosition: [number, number, number] = [
              snapToGrid(newPosition.x, gridSize),
              snapToGrid(newPosition.y, gridSize),
              snapToGrid(newPosition.z, gridSize),
            ];
            
            // Shape'i güncelle
            updateShape(shapeId, { position: snappedPosition });
            
            console.log(`🎯 Point to Point Move completed: Shape ${shapeId} moved from [${sourcePoint.x.toFixed(1)}, ${sourcePoint.y.toFixed(1)}, ${sourcePoint.z.toFixed(1)}] to [${targetPoint.x.toFixed(1)}, ${targetPoint.y.toFixed(1)}, ${targetPoint.z.toFixed(1)}]`);
          }
        }
        
        // Point to Point Move'u bitir
        resetPointToPointMove();
        setActiveTool(Tool.SELECT);
      }
      return;
    }

    // Handle polyline editing mode
    if (activeTool === Tool.POLYLINE_EDIT) {
      if (event.nativeEvent.button !== 0) return;
      
      const point = getIntersectionPoint(event.nativeEvent);
      if (!point) return;

      let foundNode = false;
      completedShapes.forEach((shape) => {
        if (shape.type === 'polyline') {
          shape.points.forEach((shapePoint, pointIndex) => {
            const distance = point.distanceTo(shapePoint);
            if (distance < gridSize) {
              setEditingPolylineId(shape.id);
              setDraggedNodeIndex(pointIndex);
              setIsDragging(true);
              foundNode = true;
              console.log(`Started dragging node ${pointIndex} of polyline ${shape.id}`);
            }
          });
        }
      });

      if (!foundNode) {
        setEditingPolylineId(null);
        setActiveTool(Tool.SELECT);
        console.log('Exited polyline edit mode');
      }
      return;
    }

    if (![Tool.POLYLINE, Tool.POLYGON, Tool.RECTANGLE, Tool.CIRCLE].includes(activeTool)) return;
    if (event.nativeEvent.button !== 0) return;
    
    event.stopPropagation();

    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;

    console.log(`Drawing ${activeTool.toLowerCase()}: Point clicked at [${point.x.toFixed(1)}, ${point.z.toFixed(1)}]`);

    // Handle different drawing tools
    if (activeTool === Tool.POLYLINE || activeTool === Tool.POLYGON) {
      handlePolylinePolygonDrawing(point);
    } else {
      handleShapeDrawing(point);
    }
  };

  const handlePointerMove = (event: THREE.Event<PointerEvent>) => {
    const point = getIntersectionPoint(event.nativeEvent);
    if (!point) return;

    // Handle Dimension tool preview
    if (activeTool === Tool.DIMENSION && dimensionsState.firstPoint) {
      setDimensionsState({
        ...dimensionsState,
        previewPoint: point,
      });
      return;
    }

    // Handle Point to Point Move preview
    if (activeTool === Tool.POINT_TO_POINT_MOVE && pointToPointMoveState.isActive) {
      // Snap detection for target point
      const rect = gl.domElement.getBoundingClientRect();
      const mouseScreenPos = new THREE.Vector2(
        event.nativeEvent.clientX - rect.left, 
        event.nativeEvent.clientY - rect.top
      );
      
      const perspectiveTolerance = snapTolerance * (camera instanceof THREE.PerspectiveCamera ? 5 : 1);
      
      const snapPoints = findSnapPoints(
        point,
        completedShapes, 
        shapes, 
        snapSettings, 
        perspectiveTolerance,
        null,
        null,
        camera,
        gl.domElement,
        mouseScreenPos
      );
      
      if (snapPoints.length > 0) {
        updateDrawingState({ snapPoint: snapPoints[0] });
      } else {
        updateDrawingState({ snapPoint: null });
      }
      return;
    }
    // Handle polyline editing mode
    if (activeTool === Tool.POLYLINE_EDIT && isDragging && draggedNodeIndex !== null && editingPolylineId) {
      updatePolylinePoint(editingPolylineId, draggedNodeIndex, point);
      return;
    }

    if (!drawingState.isDrawing || ![Tool.POLYLINE, Tool.POLYGON, Tool.RECTANGLE, Tool.CIRCLE].includes(activeTool)) return;

    updateDrawingState({ previewPoint: point });
    
    // Handle direction and measurement for POLYLINE and POLYGON
    if ((activeTool === Tool.POLYLINE || activeTool === Tool.POLYGON) && drawingState.currentPoint) {
      const direction = point.clone().sub(drawingState.currentPoint).normalize();
      updateDrawingState({ currentDirection: direction });
      
      if (!drawingState.waitingForMeasurement && !drawingState.measurementApplied && direction.length() > 0) {
        updateDrawingState({ waitingForMeasurement: true });
        console.log('Ready for measurement input - move mouse to set direction, then type distance in terminal');
      }
    }
  };

  const handlePointerUp = () => {
    if (activeTool === Tool.POLYLINE_EDIT && isDragging) {
      setIsDragging(false);
      setDraggedNodeIndex(null);
      console.log('Finished dragging polyline node');
    }
  };

  // Create preview geometry
  const previewGeometry = useMemo(() => {
    if (!drawingState.isDrawing || !drawingState.currentPoint || !drawingState.previewPoint) return null;

    switch (activeTool) {
      case Tool.RECTANGLE: {
        const rectPoints = createRectanglePoints(drawingState.currentPoint, drawingState.previewPoint);
        return new THREE.BufferGeometry().setFromPoints(rectPoints);
      }
      case Tool.CIRCLE: {
        const radius = drawingState.currentPoint.distanceTo(drawingState.previewPoint);
        const circlePoints = createCirclePoints(drawingState.currentPoint, radius);
        return new THREE.BufferGeometry().setFromPoints(circlePoints);
      }
      case Tool.POLYLINE:
      case Tool.POLYGON: {
        const polylinePoints = [...drawingState.points, drawingState.previewPoint];
        return new THREE.BufferGeometry().setFromPoints(polylinePoints);
      }
      default:
        return null;
    }
  }, [activeTool, drawingState.isDrawing, drawingState.currentPoint, drawingState.previewPoint, drawingState.points]);

  // Keyboard event handlers
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawingState(INITIAL_DRAWING_STATE);
        setEditingPolylineId(null);
        setDraggedNodeIndex(null);
        setIsDragging(false);
        resetPointToPointMove();
        console.log('Drawing cancelled');
      }
      
      // Handle Enter key for POLYLINE and POLYGON
      if (event.key === 'Enter' && (activeTool === Tool.POLYLINE || activeTool === Tool.POLYGON) && drawingState.isDrawing && drawingState.points.length >= 2 && !drawingState.waitingForMeasurement) {
      }
      
      // Handle Enter key for pending extrude shape - convert to 2D selectable object
      if (event.key === 'Enter' && pendingExtrudeShape && !drawingState.isDrawing) {
        handleConvertTo2D();
      }
      
      if (event.key === 'Enter' && activeTool === Tool.POLYLINE_EDIT) {
        setEditingPolylineId(null);
        setDraggedNodeIndex(null);
        setIsDragging(false);
        setActiveTool(Tool.SELECT);
        console.log('Exited polyline edit mode with Enter');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTool, drawingState, pendingExtrudeShape, setEditingPolylineId, setActiveTool, addShape, selectShape, gridSize]);

  return (
    <>
      <mesh
        ref={planeRef}
        position={[0, 0, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
      >
        <planeGeometry args={[100000, 100000]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Completed Shapes - These will be automatically removed when converted to 3D */}
      {completedShapes.map(shape => (
        <group key={shape.id}>
          <line geometry={new THREE.BufferGeometry().setFromPoints(shape.points)}>
            <lineBasicMaterial 
              color={
                editingPolylineId === shape.id ? "#f59e0b" : 
                hoveredShapeId === shape.id ? "#333333" : "#000000"
              } 
              linewidth={2}
            />
          </line>
          
          {/* Polyline Edit Nodes */}
          {activeTool === Tool.POLYLINE_EDIT && (shape.type === 'polyline' || shape.type === 'polygon') && (
            <>
              {shape.points.map((point, index) => (
                <mesh 
                  key={index} 
                  position={point}
                  onClick={(e) => {
                    e.stopPropagation();
                    setEditingPolylineId(shape.id);
                    setActiveTool(Tool.POLYLINE_EDIT);
                  }}
                >
                  <sphereGeometry args={[gridSize / 8]} />
                  <meshBasicMaterial 
                    color={editingPolylineId === shape.id ? "#f59e0b" : "#2563eb"} 
                  />
                </mesh>
              ))}
              
              {hoveredShapeId === shape.id && (shape.type === 'polyline' || shape.type === 'polygon') && (
                <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
                  <mesh
                    position={[shape.points[0].x, 1, shape.points[0].z]}
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingPolylineId(shape.id);
                      setActiveTool(Tool.POLYLINE_EDIT);
                    }}
                  >
                    <planeGeometry args={[gridSize * 2, gridSize]} />
                    <meshBasicMaterial color="#f59e0b" />
                    <Text
                      position={[0, 0, 0.1]}
                      fontSize={gridSize / 2}
                      color="white"
                      anchorX="center"
                      anchorY="middle"
                    >
                      Edit
                    </Text>
                  </mesh>
                </Billboard>
              )}
            </>
          )}
          
          {/* Convert to 3D Button for Closed Shapes */}
          {false && shape.isClosed && hoveredShapeId === shape.id && activeTool !== Tool.POLYLINE_EDIT && (
            <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
              <mesh
                position={[shape.points[0].x, 1, shape.points[0].z]}
                onClick={(e) => {
                  e.stopPropagation();
                  convertTo3DShape(shape, addShape, selectShape, gridSize);
                  setCompletedShapes(prev => prev.filter(s => s.id !== shape.id));
                }}
              >
                <planeGeometry args={[gridSize * 3, gridSize]} />
                <meshBasicMaterial color="#10b981" />
                <Text
                  position={[0, 0, 0.1]}
                  fontSize={gridSize / 2}
                  color="white"
                  anchorX="center"
                  anchorY="middle"
                >
                  Select
                </Text>
              </mesh>
            </Billboard>
          )}
          
          {/* Extrude Button for Closed Shapes */}
          {shape.isClosed && hoveredShapeId === shape.id && activeTool !== Tool.POLYLINE_EDIT && (
            <Billboard follow={true} lockX={false} lockY={false} lockZ={false}>
              <mesh
                position={[shape.points[0].x + gridSize * 3.5, 1, shape.points[0].z]}
                onClick={(e) => {
                  e.stopPropagation();
                  extrudeShape(shape, addShape, 500, gridSize);
                  setCompletedShapes(prev => prev.filter(s => s.id !== shape.id));
                }}
              >
                <planeGeometry args={[gridSize * 2, gridSize]} />
                <meshBasicMaterial color="#2563eb" />
                <Text
                  position={[0, 0, 0.1]}
                  fontSize={gridSize / 2}
                  color="white"
                  anchorX="center"
                  anchorY="middle"
                >
                  Extrude
                </Text>
              </mesh>
            </Billboard>
          )}
        </group>
      ))}

      {/* Preview Shape */}
      {previewGeometry && (
        <line geometry={previewGeometry}>
          <lineBasicMaterial color="#000000" opacity={0.8} transparent linewidth={2} />
        </line>
      )}

      {/* Points */}
      {drawingState.points.map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[gridSize / 15]} />
          <meshBasicMaterial color="#2563eb" />
        </mesh>
      ))}

      {drawingState.previewPoint && (
        <mesh position={drawingState.previewPoint}>
          <sphereGeometry args={[gridSize / 15]} />
          <meshBasicMaterial color="#2563eb" opacity={0.5} transparent />
        </mesh>
      )}

      {/* Snap Point Indicator */}
      <SnapPointIndicators snapPoint={drawingState.snapPoint} />

      {/* Dimension Display */}
      <DimensionDisplay
        dimensions={dimensionsState.dimensions}
        measurementUnit={measurementUnit}
        convertToDisplayUnit={convertToDisplayUnit}
      />

      {/* Dimension Preview */}
      {activeTool === Tool.DIMENSION && 
       dimensionsState.firstPoint && 
       dimensionsState.previewPoint && (
        <DimensionPreview
          firstPoint={dimensionsState.firstPoint}
          previewPoint={dimensionsState.previewPoint}
          measurementUnit={measurementUnit}
          convertToDisplayUnit={convertToDisplayUnit}
        />
      )}

      {/* Point to Point Move Indicators */}
      {activeTool === Tool.POINT_TO_POINT_MOVE && pointToPointMoveState.isActive && (
        <>
          {/* Source Point Indicator */}
          {pointToPointMoveState.sourcePoint && (
            <Billboard position={pointToPointMoveState.sourcePoint}>
              <mesh>
                <sphereGeometry args={[25]} />
                <meshBasicMaterial color="#10b981" transparent opacity={0.8} />
              </mesh>
              <Text
                position={[0, 50, 0]}
                fontSize={20}
                color="#10b981"
                anchorX="center"
                anchorY="middle"
              >
                SOURCE
              </Text>
            </Billboard>
          )}
          
          {/* Current Snap Point Indicator for Point to Point Move */}
        </>
      )}
      {/* Preview Shape */}
      {previewGeometry && (
        <line geometry={previewGeometry}>
          <lineBasicMaterial color="#000000" opacity={0.8} transparent linewidth={2} />
        </line>
      )}

      {/* Points */}
      {drawingState.points.map((point, index) => (
        <mesh key={index} position={point}>
          <sphereGeometry args={[gridSize / 15]} />
          <meshBasicMaterial color="#2563eb" />
        </mesh>
      ))}

      {drawingState.previewPoint && (
        <mesh position={drawingState.previewPoint}>
          <sphereGeometry args={[gridSize / 15]} />
          <meshBasicMaterial color="#2563eb" opacity={0.5} transparent />
        </mesh>
      )}

    </>
  );
};

export default DrawingPlane;