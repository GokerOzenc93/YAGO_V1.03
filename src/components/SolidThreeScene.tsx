import { createSignal, onMount, onCleanup } from 'solid-js';
import { Canvas, useThree } from 'solid-three';
import { OrbitControls, Grid, Environment } from 'solid-three/primitives';
import { useAppStore, ViewMode } from '../store/appStore';
import * as THREE from 'three';

const SolidThreeObjects = () => {
  const { shapes, viewMode, selectedShapeId, selectShape } = useAppStore();

  const handleShapeClick = (shapeId: string) => {
    selectShape(shapeId);
    console.log(`Shape clicked: ${shapeId}`);
  };

  const getShapeColor = (shape: any) => {
    if (selectedShapeId === shape.id) return '#60a5fa'; // Blue for selected
    
    // Shape type based colors
    if (shape.type === 'box') return '#2563eb';
    if (shape.type === 'cylinder') return '#0d9488';
    
    return '#94a3b8'; // Default gray
  };

  const getOpacity = () => {
    return viewMode === ViewMode.WIREFRAME ? 0.1 : 0.8;
  };

  const shouldShowEdges = () => {
    return true; // Always show edges
  };

  const getEdgeColor = () => {
    return viewMode === ViewMode.SOLID ? '#000000' : '#000000';
  };

  return (
    <>
      {shapes.map((shape) => (
        <group key={shape.id}>
          {/* Main shape mesh */}
          <mesh
            position={shape.position}
            rotation={shape.rotation}
            scale={shape.scale}
            onClick={() => handleShapeClick(shape.id)}
            castShadow
            receiveShadow
          >
            <primitive object={shape.geometry} />
            <meshPhysicalMaterial
              color={getShapeColor(shape)}
              transparent
              opacity={getOpacity()}
            />
          </mesh>

          {/* Edges */}
          {shouldShowEdges() && (
            <lineSegments
              position={shape.position}
              rotation={shape.rotation}
              scale={shape.scale}
            >
              <edgesGeometry args={[shape.geometry]} />
              <lineBasicMaterial
                color={getEdgeColor()}
                transparent
                opacity={1.0}
                linewidth={1.0}
              />
            </lineSegments>
          )}
        </group>
      ))}
    </>
  );
};

const SolidThreeScene = () => {
  const { gridSize, cameraType } = useAppStore();
  let canvasRef: HTMLCanvasElement | undefined;

  onMount(() => {
    console.log('🎯 Solid-Three Scene mounted');
  });

  onCleanup(() => {
    console.log('🎯 Solid-Three Scene cleanup');
  });

  return (
    <div class="w-full h-full bg-gray-100">
      <Canvas
        ref={canvasRef}
        dpr={[1.5, 2]}
        shadows
        gl={{
          antialias: true,
          alpha: true,
          preserveDrawingBuffer: true,
          logarithmicDepthBuffer: true,
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.2,
          outputColorSpace: THREE.SRGBColorSpace,
          powerPreference: 'high-performance',
        }}
        camera={{
          position: [1000, 1600, 1800],
          fov: 45,
          near: 1,
          far: 50000,
        }}
      >
        {/* Lighting */}
        <Environment preset="city" intensity={0.6} />
        
        <directionalLight
          position={[2000, 3000, 2000]}
          intensity={1.2}
          castShadow
          shadow-mapSize={[4096, 4096]}
          color="#ffffff"
        />

        <directionalLight
          position={[-1500, 1500, -1500]}
          intensity={0.5}
          color="#e0f2fe"
        />

        <ambientLight intensity={0.3} color="#f1f5f9" />

        {/* Grid */}
        <Grid
          args={[50000, 50000]}
          cellSize={gridSize}
          cellThickness={2}
          cellColor="#666"
          sectionSize={gridSize * 5}
          sectionThickness={3}
          sectionColor="#444"
          position={[0, -0.001, 0]}
        />

        {/* Camera Controls */}
        <OrbitControls
          makeDefault
          enabled={true}
          dampingFactor={0.05}
          screenSpacePanning={true}
          maxDistance={20000}
        />

        {/* 3D Objects */}
        <SolidThreeObjects />
      </Canvas>
    </div>
  );
};

export default SolidThreeScene;