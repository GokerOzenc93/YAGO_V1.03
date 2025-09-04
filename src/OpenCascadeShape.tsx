@@ .. @@
 import React, { useRef, useEffect, useMemo } from 'react';
 import { useAppStore } from './store/appStore';
 import { TransformControls } from '@react-three/drei';
 import { useThree } from '@react-three/fiber';
 import * as THREE from 'three';
 import { Shape } from './types/shapes';
 import { SHAPE_COLORS } from './types/shapes';
 import { ViewMode, OrthoMode } from './store/appStore';
 import { applyOrthoConstraint } from './utils/orthoUtils';
 import {
   detectFaceAtMouse,
   highlightFace,
   clearFaceHighlight
 } from './utils/faceSelection';