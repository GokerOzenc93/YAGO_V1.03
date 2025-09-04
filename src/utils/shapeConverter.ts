@@ .. @@
 import * as THREE from 'three';
-import { CompletedShape } from './types';
+import { CompletedShape } from '../types/drawing';
 import { Shape } from '../types/shapes';
 import { createPolylineGeometry } from './geometryCreator';
-import { calculatePolylineCenter } from './utils';
import { calculatePolylineCenter } from './drawing';