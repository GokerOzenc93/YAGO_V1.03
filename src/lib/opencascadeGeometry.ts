import * as THREE from 'three';
import { getOpenCascade } from './opencascadeCore';

/**
 * Convert OpenCascade shape to Three.js BufferGeometry
 */
export const ocShapeToThreeGeometry = (shape: any): THREE.BufferGeometry => {
  const oc = getOpenCascade();
  
  try {
    // Create mesh from shape
    const mesh = new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, false);
    
    if (!mesh.IsDone()) {
      throw new Error('Failed to create mesh from OpenCascade shape');
    }

    // Get triangulation data
    const triangulation = oc.BRep_Tool.Triangulation(oc.TopExp_Explorer.Current(), oc.TopLoc_Location.constructor());
    
    if (!triangulation) {
      throw new Error('No triangulation data available');
    }

    // Extract vertices and faces
    const vertices: number[] = [];
    const indices: number[] = [];
    
    // Get vertex count and triangle count
    const vertexCount = triangulation.NbNodes();
    const triangleCount = triangulation.NbTriangles();
    
    console.log(`🎯 OpenCascade mesh: ${vertexCount} vertices, ${triangleCount} triangles`);
    
    // Extract vertices
    for (let i = 1; i <= vertexCount; i++) {
      const vertex = triangulation.Node(i);
      vertices.push(vertex.X(), vertex.Y(), vertex.Z());
    }
    
    // Extract triangle indices
    for (let i = 1; i <= triangleCount; i++) {
      const triangle = triangulation.Triangle(i);
      let n1: number, n2: number, n3: number;
      triangle.Get(n1, n2, n3);
      
      // OpenCascade uses 1-based indexing, Three.js uses 0-based
      indices.push(n1 - 1, n2 - 1, n3 - 1);
    }
    
    // Create Three.js BufferGeometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    
    // Compute normals and bounds
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    
    console.log('✅ OpenCascade shape converted to Three.js geometry');
    return geometry;
    
  } catch (error) {
    console.error('❌ Failed to convert OpenCascade shape to geometry:', error);
    
    // Fallback to simple box geometry
    const fallbackGeometry = new THREE.BoxGeometry(100, 100, 100);
    fallbackGeometry.computeBoundingBox();
    fallbackGeometry.computeBoundingSphere();
    
    return fallbackGeometry;
  }
};

/**
 * Create OpenCascade box shape
 */
export const createOCBox = (width: number, height: number, depth: number): any => {
  const oc = getOpenCascade();
  
  try {
    console.log(`🎯 Creating OpenCascade box: ${width}x${height}x${depth}mm`);
    
    // Create box centered at origin
    const box = new oc.BRepPrimAPI_MakeBox_2(
      new oc.gp_Pnt_3(-width/2, -height/2, -depth/2),
      new oc.gp_Pnt_3(width/2, height/2, depth/2)
    );
    
    if (!box.IsDone()) {
      throw new Error('Failed to create OpenCascade box');
    }
    
    const shape = box.Shape();
    console.log('✅ OpenCascade box created successfully');
    
    return shape;
    
  } catch (error) {
    console.error('❌ Failed to create OpenCascade box:', error);
    throw error;
  }
};

/**
 * Create OpenCascade cylinder shape
 */
export const createOCCylinder = (radius: number, height: number): any => {
  const oc = getOpenCascade();
  
  try {
    console.log(`🎯 Creating OpenCascade cylinder: radius=${radius}mm, height=${height}mm`);
    
    // Create cylinder axis (Z-axis)
    const axis = new oc.gp_Ax2_2(
      new oc.gp_Pnt_3(0, 0, -height/2), // Bottom center
      new oc.gp_Dir_3(0, 0, 1)          // Z direction
    );
    
    const cylinder = new oc.BRepPrimAPI_MakeCylinder_2(axis, radius, height);
    
    if (!cylinder.IsDone()) {
      throw new Error('Failed to create OpenCascade cylinder');
    }
    
    const shape = cylinder.Shape();
    console.log('✅ OpenCascade cylinder created successfully');
    
    return shape;
    
  } catch (error) {
    console.error('❌ Failed to create OpenCascade cylinder:', error);
    throw error;
  }
};

/**
 * Create OpenCascade polyline/polygon shape (extruded)
 */
export const createOCPolyline = (points: THREE.Vector3[], height: number): any => {
  const oc = getOpenCascade();
  
  try {
    console.log(`🎯 Creating OpenCascade polyline: ${points.length} points, height=${height}mm`);
    
    if (points.length < 3) {
      throw new Error('Polyline needs at least 3 points');
    }
    
    // Create wire from points
    const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
    
    for (let i = 0; i < points.length; i++) {
      const currentPoint = points[i];
      const nextPoint = points[(i + 1) % points.length];
      
      // Skip if points are too close
      if (currentPoint.distanceTo(nextPoint) < 0.1) continue;
      
      const p1 = new oc.gp_Pnt_3(currentPoint.x, 0, currentPoint.z);
      const p2 = new oc.gp_Pnt_3(nextPoint.x, 0, nextPoint.z);
      
      const edge = new oc.BRepBuilderAPI_MakeEdge_2(p1, p2);
      if (edge.IsDone()) {
        wireBuilder.Add(edge.Edge());
      }
    }
    
    if (!wireBuilder.IsDone()) {
      throw new Error('Failed to create wire from polyline points');
    }
    
    const wire = wireBuilder.Wire();
    
    // Create face from wire
    const faceBuilder = new oc.BRepBuilderAPI_MakeFace_2(wire, true);
    if (!faceBuilder.IsDone()) {
      throw new Error('Failed to create face from wire');
    }
    
    const face = faceBuilder.Face();
    
    // Extrude face to create solid
    const extrudeVector = new oc.gp_Vec_3(0, height, 0);
    const prism = new oc.BRepPrimAPI_MakePrism_1(face, extrudeVector, false, true);
    
    if (!prism.IsDone()) {
      throw new Error('Failed to extrude polyline');
    }
    
    const shape = prism.Shape();
    console.log('✅ OpenCascade polyline created successfully');
    
    return shape;
    
  } catch (error) {
    console.error('❌ Failed to create OpenCascade polyline:', error);
    throw error;
  }
};

/**
 * Perform OpenCascade boolean union
 */
export const performOCUnion = (shape1: any, shape2: any): any => {
  const oc = getOpenCascade();
  
  try {
    console.log('🎯 Performing OpenCascade boolean union...');
    
    const union = new oc.BRepAlgoAPI_Fuse_2(shape1, shape2);
    union.Build();
    
    if (!union.IsDone()) {
      throw new Error('OpenCascade union operation failed');
    }
    
    const result = union.Shape();
    console.log('✅ OpenCascade union completed successfully');
    
    return result;
    
  } catch (error) {
    console.error('❌ OpenCascade union failed:', error);
    throw error;
  }
};

/**
 * Perform OpenCascade boolean subtraction
 */
export const performOCSubtraction = (shape1: any, shape2: any): any => {
  const oc = getOpenCascade();
  
  try {
    console.log('🎯 Performing OpenCascade boolean subtraction...');
    
    const cut = new oc.BRepAlgoAPI_Cut_2(shape1, shape2);
    cut.Build();
    
    if (!cut.IsDone()) {
      throw new Error('OpenCascade subtraction operation failed');
    }
    
    const result = cut.Shape();
    console.log('✅ OpenCascade subtraction completed successfully');
    
    return result;
    
  } catch (error) {
    console.error('❌ OpenCascade subtraction failed:', error);
    throw error;
  }
};

/**
 * Dispose OpenCascade shape resources
 */
export const disposeOCShape = (shape: any): void => {
  try {
    if (shape && typeof shape.delete === 'function') {
      shape.delete();
    }
  } catch (error) {
    console.warn('Warning: Could not dispose OpenCascade shape:', error);
  }
};