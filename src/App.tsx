import React from 'react';
import { useEffect } from 'react';
import Layout from './components/Layout';
import Scene from './components/Scene';
import Toolbar from './components/Toolbar';
import StatusBar from './components/StatusBar';
import Terminal from './components/Terminal';
import { GeometryFactory } from './lib/geometryFactory';
import { useAppStore } from './store/appStore';
import { initializeOpenCascade } from './lib/opencascadeCore';
import { createOCBox, createOCCylinder, ocShapeToThreeGeometry } from './lib/opencascadeGeometry';
import * as THREE from 'three';

function App() {
  const { setOpenCascadeInitialized, setGeometryMode, addShape } = useAppStore();

  useEffect(() => {
    // Initialize OpenCascade and create sample shapes
    const initializeGeometry = async () => {
      try {
        // Initialize OpenCascade.js
        await initializeOpenCascade();
        
        setOpenCascadeInitialized(true);
        setGeometryMode('OpenCascade.js');
        
        console.log('🎯 OpenCascade.js initialized, creating sample shapes...');
        
        // Create OpenCascade box (cube)
        const ocBox = createOCBox(400, 400, 400);
        const boxGeometry = ocShapeToThreeGeometry(ocBox);
        
        const cubeShape = {
          id: 'occ-cube-1',
          type: 'box',
          position: [-300, 200, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          scale: [1, 1, 1] as [number, number, number],
          geometry: boxGeometry,
          parameters: {
            width: 400,
            height: 400,
            depth: 400,
            isOpenCascadeShape: true,
          },
        };
        
        // Create OpenCascade cylinder (circle extruded)
        const ocCylinder = createOCCylinder(150, 300);
        const cylinderGeometry = ocShapeToThreeGeometry(ocCylinder);
        
        const circleShape = {
          id: 'occ-circle-1',
          type: 'cylinder',
          position: [300, 150, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          scale: [1, 1, 1] as [number, number, number],
          geometry: cylinderGeometry,
          parameters: {
            radius: 150,
            height: 300,
            isOpenCascadeShape: true,
          },
        };
        
        // Add shapes to store
        addShape(cubeShape);
        addShape(circleShape);
        
        console.log('✅ OpenCascade solid models added to scene');
        
      } catch (error) {
        console.error('❌ Failed to initialize OpenCascade:', error);
        setOpenCascadeInitialized(false);
        setGeometryMode('Three.js');
        
        // Fallback to Three.js shapes
        const fallbackCube = {
          id: 'fallback-cube-1',
          type: 'box',
          position: [-300, 200, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          scale: [1, 1, 1] as [number, number, number],
          geometry: new THREE.BoxGeometry(400, 400, 400),
          parameters: {
            width: 400,
            height: 400,
            depth: 400,
          },
        };
        
        const fallbackCylinder = {
          id: 'fallback-circle-1',
          type: 'cylinder',
          position: [300, 150, 0] as [number, number, number],
          rotation: [0, 0, 0] as [number, number, number],
          scale: [1, 1, 1] as [number, number, number],
          geometry: new THREE.CylinderGeometry(150, 150, 300),
          parameters: {
            radius: 150,
            height: 300,
          },
        };
        
        addShape(fallbackCube);
        addShape(fallbackCylinder);
        
        console.log('⚠️ Using Three.js fallback shapes');
      }
    };

    initializeGeometry();
  }, [setOpenCascadeInitialized, setGeometryMode, addShape]);

  return (
    <div className="flex flex-col h-screen bg-gray-900 text-gray-200">
      <Layout
        toolbar={<Toolbar />}
        content={<Scene />}
        statusBar={<StatusBar />}
      />
      <Terminal />
    </div>
  );
}

export default App;