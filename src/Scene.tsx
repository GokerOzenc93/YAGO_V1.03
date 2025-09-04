@@ .. @@
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
 } from './store/appStore';
-import OpenCascadeShape from './components/OpenCascadeShape';
-import DrawingPlane from './components/drawing/DrawingPlane';
-import ContextMenu from './components/ContextMenu';
-import EditMode from './components/ui/EditMode';
-import { DimensionsManager } from './components/drawing/dimensionsSystem';
+import OpenCascadeShape from './OpenCascadeShape';
+import DrawingPlane from './DrawingPlane';
+import ContextMenu from './ContextMenu';
+import EditMode from './EditMode';
+import { DimensionsManager } from './DimensionsSystem';
 import { createPortal } from 'react-dom';
 import { Shape } from './types/shapes';
 import { fitCameraToShapes, fitCameraToShape } from './utils/cameraUtils';
 import { clearFaceHighlight } from './utils/faceSelection';
 import * as THREE from 'three';