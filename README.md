# YAGO CAD

Modern 3D CAD application built with OpenCascade.js for BREP-based solid modeling.

## Project Structure

```
src/
├── ui/                  # UI Components
│   ├── Layout.tsx       # Main layout wrapper
│   ├── Toolbar.tsx      # Top toolbar with tools
│   ├── StatusBar.tsx    # Bottom status bar
│   └── Terminal.tsx     # Console/terminal overlay
│
├── App.tsx              # Main application
├── Scene.tsx            # 3D scene with Three.js/Fiber
├── store.ts             # Zustand state management
├── opencascade.ts       # OpenCascade BREP utilities
├── main.tsx             # Entry point
└── index.css            # Global styles
```

## Features

- **BREP Geometry**: All geometry created using OpenCascade.js
- **3D Viewport**: Real-time 3D rendering with Three.js
- **Wireframe Display**: Clean edge visualization
- **Camera Controls**:
  - Perspective/Orthographic toggle
  - Orbit controls with damping
- **Gizmo**: Visual axis helper
- **Grid**: Infinite grid for reference
- **Terminal**: Built-in console for debugging

## Tech Stack

- **React 18** - UI framework
- **Three.js** - 3D rendering
- **@react-three/fiber** - React renderer for Three.js
- **@react-three/drei** - Useful helpers (OrbitControls, Grid, Gizmo)
- **OpenCascade.js** - CAD kernel for BREP geometry
- **Zustand** - State management
- **TailwindCSS** - Styling
- **TypeScript** - Type safety
- **Vite** - Build tool

## Getting Started

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

## OpenCascade Integration

OpenCascade.js is loaded dynamically to avoid build issues with WebAssembly modules. If OpenCascade fails to load, the application falls back to Three.js primitives.

### Creating Geometry

```typescript
import { createOCGeometry, convertOCShapeToThreeGeometry } from './opencascade';

const ocShape = createOCGeometry(opencascadeInstance, {
  type: 'box',
  width: 600,
  height: 600,
  depth: 600
});

const geometry = convertOCShapeToThreeGeometry(opencascadeInstance, ocShape);
```

### Boolean Operations

```typescript
import { performOCBoolean } from './opencascade';

const result = performOCBoolean(
  opencascadeInstance,
  shape1,
  shape2,
  'subtract' // or 'union', 'intersect'
);
```

## State Management

Global state is managed with Zustand:

```typescript
const { shapes, addShape, selectShape, opencascadeInstance } = useAppStore();
```

## Development Notes

- OpenCascade.js is marked as external in Vite config
- All geometry is BREP-based for precision
- Wireframe-only display (opacity: 0 on meshes)
- Two-level file structure for simplicity
- UI components isolated in `/ui` folder

## License

Proprietary - YAGO Design
