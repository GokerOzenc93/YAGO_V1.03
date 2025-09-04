@@ .. @@
 import * as THREE from 'three';
-import { CompletedShape, SnapPoint } from './types';
+import { CompletedShape, SnapPoint } from './types/drawing';
 import { SnapType, SnapSettings } from './store/appStore';
 import { Shape } from './types/shapes';
-import { findLineIntersection } from './utils';
+import { findLineIntersection } from './utils/drawing';
 import { Billboard } from '@react-three/drei';
 import * as React from 'react';