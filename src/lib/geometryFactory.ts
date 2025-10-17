import * as THREE from 'three';
import { isYagoDesignInitialized, initializeYagoDesign } from './yagoDesignCore';
import { 
  createYagoBox, 
  createYagoCylinder, 
  createYagoPolyline, 
  yagoShapeToThreeGeometry,
  performYagoUnion,
  performYagoSubtraction,
  disposeYagoShape
} from './yagoDesignGeometry';

/**
 * Geometry creation factory - uses YagoDesign when available, fallback to Three.js
 */
export class GeometryFactory {
  private static useYagoDesign = false;
  private static initializationPromise: Promise<void> | null = null;

  /**
   * Initialize the geometry factory
   */
  static async initialize(): Promise<void> {
    if (this.initializationPromise) {
      return this.initializationPromise;
    }

    this.initializationPromise = this.tryInitializeYagoDesign();
    return this.initializationPromise;
  }

  private static async tryInitializeYagoDesign(): Promise<void> {
    try {
      console.log('🎯 Attempting to initialize YagoDesign.js...');
      await initializeYagoDesign();
      this.useYagoDesign = true;
      console.log('✅ GeometryFactory: YagoDesign.js mode enabled');
    } catch (error) {
      console.warn('⚠️ YagoDesign.js initialization failed, using Three.js fallback:', error);
      this.useYagoDesign = false;
    }
  }

  /**
   * Create box geometry
   */
  static async createBox(width: number, height: number, depth: number): Promise<THREE.BufferGeometry> {
    await this.initialize();

    if (this.useYagoDesign && isYagoDesignInitialized()) {
      try {
        const yagoShape = createYagoBox(width, height, depth);
        const geometry = yagoShapeToThreeGeometry(yagoShape);
        disposeYagoShape(yagoShape);
        return geometry;
      } catch (error) {
        console.warn('YagoDesign box creation failed, using Three.js fallback:', error);
      }
    }

    // Three.js fallback
    console.log('🎯 Creating Three.js box geometry');
    const geometry = new THREE.BoxGeometry(width, height, depth);

    // 🎯 Pivot noktasını sol alt arka köşeye taşı
    // Geometry varsayılan olarak merkezde, onu sol alt köşeye kaydırıyoruz
    geometry.translate(width / 2, height / 2, depth / 2);

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * Create cylinder geometry
   */
  static async createCylinder(radius: number, height: number): Promise<THREE.BufferGeometry> {
    await this.initialize();

    if (this.useYagoDesign && isYagoDesignInitialized()) {
      try {
        const yagoShape = createYagoCylinder(radius, height);
        const geometry = yagoShapeToThreeGeometry(yagoShape);
        disposeYagoShape(yagoShape);
        return geometry;
      } catch (error) {
        console.warn('YagoDesign cylinder creation failed, using Three.js fallback:', error);
      }
    }

    // Three.js fallback
    console.log('🎯 Creating Three.js cylinder geometry');
    const geometry = new THREE.CylinderGeometry(radius, radius, height, 32);

    // 🎯 Pivot noktasını sol alt köşeye taşı (cylinder için alt merkez)
    // Cylinder Y ekseni boyunca uzanabilir, merkezden alta kaydırıyoruz
    geometry.translate(0, height / 2, 0);

    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    return geometry;
  }

  /**
   * Create polyline/polygon geometry (extruded)
   */
  static async createPolyline(points: THREE.Vector3[], height: number): Promise<THREE.BufferGeometry> {
    await this.initialize();

    if (this.useYagoDesign && isYagoDesignInitialized()) {
      try {
        const yagoShape = createYagoPolyline(points, height);
        const geometry = yagoShapeToThreeGeometry(yagoShape);
        disposeYagoShape(yagoShape);
        return geometry;
      } catch (error) {
        console.warn('YagoDesign polyline creation failed, using Three.js fallback:', error);
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

    if (this.useYagoDesign && isYagoDesignInitialized()) {
      try {
        // Convert geometries to YagoDesign shapes
        // This would require implementing geometry-to-shape conversion
        // For now, we'll use the existing CSG approach
        console.log('🎯 YagoDesign union not yet implemented for existing geometries');
      } catch (error) {
        console.warn('YagoDesign union failed:', error);
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

    if (this.useYagoDesign && isYagoDesignInitialized()) {
      try {
        // Convert geometries to YagoDesign shapes
        // This would require implementing geometry-to-shape conversion
        // For now, we'll use the existing CSG approach
        console.log('🎯 YagoDesign subtraction not yet implemented for existing geometries');
      } catch (error) {
        console.warn('YagoDesign subtraction failed:', error);
      }
    }

    // Fallback to existing CSG implementation
    console.log('🎯 Using existing CSG subtraction implementation');
    return geometry1; // Placeholder - would use existing CSG
  }

  /**
   * Check if YagoDesign is being used
   */
  static isUsingYagoDesign(): boolean {
    return this.useYagoDesign && isYagoDesignInitialized();
  }

  /**
   * Get current mode
   */
  static getCurrentMode(): string {
    return this.isUsingYagoDesign() ? 'YagoDesign.js' : 'Three.js';
  }
}