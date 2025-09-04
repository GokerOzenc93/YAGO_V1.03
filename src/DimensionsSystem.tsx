@@ .. @@
 import React, { useState, useEffect, useMemo, useRef } from 'react';
 import * as THREE from 'three';
 import { Text, Billboard } from '@react-three/drei';
 import { useThree } from '@react-three/fiber';
-import { useAppStore, Tool, SnapType, SnapSettings, OrthoMode } from './store/appStore.ts';
-import { findSnapPoints, SnapPointIndicators } from './snapSystem.tsx';
-import { CompletedShape } from './types';
+import { useAppStore, Tool, SnapType, SnapSettings, OrthoMode } from './store/appStore';
+import { findSnapPoints, SnapPointIndicators } from './SnapSystem';
+import { CompletedShape } from './types/drawing';
 import { Shape } from './types/shapes';
-import { snapToGrid } from './utils.ts';
-import { applyDimensionOrthoConstraint } from './utils/orthoUtils.ts';