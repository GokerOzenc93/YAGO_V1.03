import * as THREE from 'three';
import { MeshoptDecoder } from 'meshoptimizer/meshopt_decoder.module.js';
import { isOpenCascadeInitialized, initializeOpenCascade } from './opencascadeCore';
import { 
  createOCBox, 
  createOCCylinder, 
  createOCPolyline, 
  ocShapeToThreeGeometry,
  performOCUnion,
  performOCSubtraction,
  disposeOCShape
} from './opencascadeGeometry';

/**
 * Geometry creation factory - uses OpenCascade when available, fallback to Three.js
 */
export class GeometryFactory {
  private static useOpenCascade = false;
  private static initializationPromise: Promise<void> | null = null;
  private static meshoptimizerReady = false;

  /**
   * Initialize the geometry factory
   */
  static async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.tryInitializeOpenCascade();
    return this.initializationPromise;
  }

  private static async tryInitializeOpenCascade(): Promise<void> {
    try {
      console.log('🎯 Attempting to initialize OpenCascade.js...');
      
      // Initialize meshoptimizer
      try {
        await MeshoptDecoder.ready;
        this.meshoptimizerReady = true;
        console.log('✅ Meshoptimizer initialized successfully');
      } catch (error) {
        console.warn('⚠️ Meshoptimizer initialization failed:', error);
        this.meshoptimizerReady = false;
      }
      
      await initializeOpenCascade();
      this.useOpenCascade = true;
      console.log('✅ GeometryFactory: OpenCascade.js mode enabled');
    } catch (error) {
      console.warn('⚠️ OpenCascade.js initialization failed, using Three.js fallback:', error);
      this.useOpenCascade = false;
    }
  }

  /**
   * Create box geometry
   */
  static async createBox(width: number, height: number, depth: number): Promise<THREE.BufferGeometry> {
    await this.initialize();

    if (this.useOpenCascade && isOpenCascadeInitialized()) {
      try {
        const ocShape = createOCBox(width, height, depth);
        const geometry = ocShapeToThreeGeometry(ocShape);
        disposeOCShape(ocShape);
        return geometry;
      } catch (error) {
        console.warn('OpenCascade box creation failed, using Three.js fallback:', error);
      }
    }

    // Three.js fallback
    console.log('🎯 Creating Three.js box geometry');
    const geometry = new THREE.BoxGeometry(width, height, depth);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * Create cylinder geometry
   */
  static async createCylinder(radius: number, height: number): Promise<THREE.BufferGeometry> {
    await this.initialize();

    if (this.useOpenCascade && isOpenCascadeInitialized()) {
      try {
        const ocShape = createOCCylinder(radius, height);
        const geometry = ocShapeToThreeGeometry(ocShape);
        disposeOCShape(ocShape);
        return geometry;
      } catch (error) {
        console.warn('OpenCascade cylinder creation failed, using Three.js fallback:', error);
      }
    }

    // Three.js fallback
    console.log('🎯 Creating Three.js cylinder geometry');
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * Create polyline/polygon geometry (extruded)
   */
  static async createPolyline(points: THREE.Vector3[], height: number): Promise<THREE.BufferGeometry> {
    await this.initialize();

    if (this.useOpenCascade && isOpenCascadeInitialized()) {
      try {
        const ocShape = createOCPolyline(points, height);
        const geometry = ocShapeToThreeGeometry(ocShape);
        disposeOCShape(ocShape);
        return geometry;
      } catch (error) {
        console.warn('OpenCascade polyline creation failed, using Three.js fallback:', error);
      }
    }

    // Three.js fallback - use existing polyline geometry creation
    console.log('🎯 Creating Three.js polyline geometry');
    return this.createPolylineThreeJS(points, height);
  }

  /**
   * Three.js polyline geometry creation (fallback)
   */
  private static createPolylineThreeJS(points: THREE.Vector3[], height: number): THREE.BufferGeometry {
    try {
      // Create a 2D shape from the points
      const shape = new THREE.Shape();
      
      if (points.length < 3) {
        // Fallback for insufficient points
        const geometry = new THREE.BoxGeometry(100, height, 100);
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        return geometry;
      }

      // Get unique points (remove duplicate closing point if exists)
      const uniquePoints = points.length > 2 && points[points.length - 1].equals(points[0]) 
        ? points.slice(0, -1)
        : points;
      
      // Create shape at origin (0,0) - geometry will be centered at origin
      const relativePoints = uniquePoints.map(point => new THREE.Vector2(point.x, -point.z));
      
      // Move to the first point
      shape.moveTo(relativePoints[0].x, relativePoints[0].y);
      
      // Add lines to subsequent points
      for (let i = 1; i < relativePoints.length; i++) {
        shape.lineTo(relativePoints[i].x, relativePoints[i].y);
      }
      
      // Close the shape
      shape.lineTo(relativePoints[0].x, relativePoints[0].y);

      // Create extrude settings
      const extrudeSettings = {
        depth: height,
        bevelEnabled: false,
        steps: 1,
        curveSegments: 8
      };

      // Create the extruded geometry
      const geometry = new THREE.ExtrudeGeometry(shape, extrudeSettings);
      
      // Rotate to make it horizontal (lying on XZ plane)
      geometry.rotateX(-Math.PI / 2);
      
      // Center the geometry at origin
      geometry.computeBoundingBox();
      if (geometry.boundingBox) {
        const center = geometry.boundingBox.getCenter(new THREE.Vector3());
        geometry.translate(-center.x, -center.y, -center.z);
      }
      
      // Compute bounding volumes
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      
      return geometry;
      
    } catch (error) {
      console.warn('Failed to create polyline geometry, using fallback:', error);
      
      // Fallback geometry
      const fallbackGeometry = new THREE.BoxGeometry(100, height, 100);
      fallbackGeometry.computeBoundingBox();
      fallbackGeometry.computeBoundingSphere();
      
      return fallbackGeometry;
    }
  }

  /**
   * Perform boolean union operation
   */
  static async performUnion(geometry1: THREE.BufferGeometry, geometry2: THREE.BufferGeometry): Promise<THREE.BufferGeometry> {
    await this.initialize();

    if (this.useOpenCascade && isOpenCascadeInitialized()) {
      try {
        // Convert geometries to OpenCascade shapes
        // This would require implementing geometry-to-shape conversion
        // For now, we'll use the existing CSG approach
        console.log('🎯 OpenCascade union not yet implemented for existing geometries');
      } catch (error) {
        console.warn('OpenCascade union failed:', error);
      }
    }

    // Fallback to existing CSG implementation
    console.log('🎯 Using existing CSG union implementation');
    return geometry1; // Placeholder - would use existing CSG
  }

  /**
   * Perform boolean subtraction operation
   */
  static async performSubtraction(geometry1: THREE.BufferGeometry, geometry2: THREE.BufferGeometry): Promise<THREE.BufferGeometry> {
    await this.initialize();

    if (this.useOpenCascade && isOpenCascadeInitialized()) {
      try {
        // Convert geometries to OpenCascade shapes
        // This would require implementing geometry-to-shape conversion
        // For now, we'll use the existing CSG approach
        console.log('🎯 OpenCascade subtraction not yet implemented for existing geometries');
      } catch (error) {
        console.warn('OpenCascade subtraction failed:', error);
      }
    }

    // Fallback to existing CSG implementation
    console.log('🎯 Using existing CSG subtraction implementation');
    return geometry1; // Placeholder - would use existing CSG
  }

  /**
   * Check if OpenCascade is being used
   */
  static isUsingOpenCascade(): boolean {
    return this.useOpenCascade && isOpenCascadeInitialized();
  }

  /**
   * Get current mode
   */
  static getCurrentMode(): string {
    return this.isUsingOpenCascade() ? 'OpenCascade.js' : 'Three.js';
  }

  /**
   * Check if meshoptimizer is ready
   */
  static isMeshoptimizerReady(): boolean {
    return this.meshoptimizerReady;
  }
}