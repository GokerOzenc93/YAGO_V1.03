import * as THREE from 'three';
import { getOpenCascade, isOpenCascadeInitialized } from './opencascadeCore';

/**
 * Convert OpenCascade shape to Three.js BufferGeometry
 */
export const ocShapeToThreeGeometry = (shape: any): THREE.BufferGeometry => {
  if (!isOpenCascadeInitialized()) {
    throw new Error('OpenCascade.js not initialized');
  }

  const oc = getOpenCascade();
  
  try {
    // Create a mesh from the shape
    const mesh = new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.1, false);
    mesh.Perform();
    
    if (!mesh.IsDone()) {
      throw new Error('Failed to create mesh from OpenCascade shape');
    }

    // Get triangulation data
    const vertices: number[] = [];
    const indices: number[] = [];
    const normals: number[] = [];

    // Iterate through faces
    const explorer = new oc.TopExp_Explorer_2(shape, oc.TopAbs_ShapeEnum.TopAbs_FACE, oc.TopAbs_ShapeEnum.TopAbs_SHAPE);
    
    while (explorer.More()) {
      const face = oc.TopoDS.Face_1(explorer.Current());
      const location = new oc.TopLoc_Location_1();
      const triangulation = oc.BRep_Tool.Triangulation(face, location);
      
      if (!triangulation.IsNull()) {
        const transform = location.Transformation();
        const nodeCount = triangulation.get().NbNodes();
        const triangleCount = triangulation.get().NbTriangles();
        
        // Get vertices
        for (let i = 1; i <= nodeCount; i++) {
          const node = triangulation.get().Node(i);
          const transformedNode = node.Transformed(transform);
          vertices.push(transformedNode.X(), transformedNode.Y(), transformedNode.Z());
        }
        
        // Get triangles
        const baseIndex = vertices.length / 3 - nodeCount;
        for (let i = 1; i <= triangleCount; i++) {
          const triangle = triangulation.get().Triangle(i);
          const [n1, n2, n3] = [triangle.Value(1), triangle.Value(2), triangle.Value(3)];
          
          // Check face orientation
          const orientation = face.Orientation_1();
          if (orientation === oc.TopAbs_Orientation.TopAbs_REVERSED) {
            indices.push(baseIndex + n1 - 1, baseIndex + n3 - 1, baseIndex + n2 - 1);
          } else {
            indices.push(baseIndex + n1 - 1, baseIndex + n2 - 1, baseIndex + n3 - 1);
          }
        }
      }
      
      explorer.Next();
    }

    // Create Three.js geometry
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setIndex(indices);
    geometry.computeVertexNormals();
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();

    console.log(`✅ OpenCascade shape converted to Three.js geometry: ${vertices.length / 3} vertices, ${indices.length / 3} triangles`);
    
    return geometry;
    
  } catch (error) {
    console.error('❌ Failed to convert OpenCascade shape to geometry:', error);
    throw error;
  }
};

/**
 * Create OpenCascade box shape
 */
export const createOCBox = (width: number, height: number, depth: number): any => {
  if (!isOpenCascadeInitialized()) {
    throw new Error('OpenCascade.js not initialized');
  }

  const oc = getOpenCascade();
  
  try {
    const boxMaker = new oc.BRepPrimAPI_MakeBox_3(width, height, depth);
    const shape = boxMaker.Shape();
    
    console.log(`✅ OpenCascade box created: ${width}x${height}x${depth}`);
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
  if (!isOpenCascadeInitialized()) {
    throw new Error('OpenCascade.js not initialized');
  }

  const oc = getOpenCascade();
  
  try {
    const cylinderMaker = new oc.BRepPrimAPI_MakeCylinder_2(radius, height);
    const shape = cylinderMaker.Shape();
    
    console.log(`✅ OpenCascade cylinder created: radius=${radius}, height=${height}`);
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
  if (!isOpenCascadeInitialized()) {
    throw new Error('OpenCascade.js not initialized');
  }

  const oc = getOpenCascade();
  
  try {
    // Create wire from points
    const wireBuilder = new oc.BRepBuilderAPI_MakeWire_1();
    
    for (let i = 0; i < points.length - 1; i++) {
      const p1 = new oc.gp_Pnt_3(points[i].x, points[i].y, points[i].z);
      const p2 = new oc.gp_Pnt_3(points[i + 1].x, points[i + 1].y, points[i + 1].z);
      
      const edgeMaker = new oc.BRepBuilderAPI_MakeEdge_2(p1, p2);
      wireBuilder.Add(edgeMaker.Edge());
    }
    
    const wire = wireBuilder.Wire();
    
    // Create face from wire
    const faceMaker = new oc.BRepBuilderAPI_MakeFace_2(wire, true);
    const face = faceMaker.Face();
    
    // Extrude face
    const extrudeVector = new oc.gp_Vec_4(0, height, 0);
    const prismMaker = new oc.BRepPrimAPI_MakePrism_1(face, extrudeVector, false, true);
    const shape = prismMaker.Shape();
    
    console.log(`✅ OpenCascade polyline created: ${points.length} points, height=${height}`);
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
  if (!isOpenCascadeInitialized()) {
    throw new Error('OpenCascade.js not initialized');
  }

  const oc = getOpenCascade();
  
  try {
    const fuseMaker = new oc.BRepAlgoAPI_Fuse_2(shape1, shape2);
    fuseMaker.Build();
    
    if (!fuseMaker.IsDone()) {
      throw new Error('Boolean union operation failed');
    }
    
    const result = fuseMaker.Shape();
    console.log('✅ OpenCascade boolean union completed');
    return result;
    
  } catch (error) {
    console.error('❌ Failed to perform OpenCascade union:', error);
    throw error;
  }
};

/**
 * Perform OpenCascade boolean subtraction
 */
export const performOCSubtraction = (shape1: any, shape2: any): any => {
  if (!isOpenCascadeInitialized()) {
    throw new Error('OpenCascade.js not initialized');
  }

  const oc = getOpenCascade();
  
  try {
    const cutMaker = new oc.BRepAlgoAPI_Cut_2(shape1, shape2);
    cutMaker.Build();
    
    if (!cutMaker.IsDone()) {
      throw new Error('Boolean subtraction operation failed');
    }
    
    const result = cutMaker.Shape();
    console.log('✅ OpenCascade boolean subtraction completed');
    return result;
    
  } catch (error) {
    console.error('❌ Failed to perform OpenCascade subtraction:', error);
    throw error;
  }
};

/**
 * Dispose OpenCascade shape resources
 */
export const disposeOCShape = (shape: any): void => {
  if (shape && typeof shape.delete === 'function') {
    shape.delete();
    console.log('🎯 OpenCascade shape disposed');
  }
};