@@ .. @@
 import React, { useRef, useEffect, useState, useMemo } from 'react';
 import { useThree } from '@react-three/fiber';
 import { Text, Billboard } from '@react-three/drei';
 import { useAppStore, Tool, CameraType, SnapType, OrthoMode } from './store/appStore';
 import * as THREE from 'three';
-import { CompletedShape, DrawingState, INITIAL_DRAWING_STATE } from './types';
-import { snapToGrid } from './utils';
-import { findSnapPoints, SnapPointIndicators } from './snapSystem.tsx';
-import { convertTo3DShape, extrudeShape } from './shapeConverter';
-import { createRectanglePoints, createCirclePoints } from './utils';
-import { DimensionsManager } from './dimensionsSystem';
+import { CompletedShape, DrawingState, INITIAL_DRAWING_STATE } from './types/drawing';
+import { snapToGrid } from './utils/drawing';
+import { findSnapPoints, SnapPointIndicators } from './SnapSystem';
+import { convertTo3DShape, extrudeShape } from './utils/shapeConverter';
+import { createRectanglePoints, createCirclePoints } from './utils/drawing';
+import { DimensionsManager } from './DimensionsSystem';
 import { applyPolylineOrthoConstraint, applyRectangleOrthoConstraint } from './utils/orthoUtils';