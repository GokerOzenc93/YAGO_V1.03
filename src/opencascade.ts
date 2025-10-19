import type { OpenCascadeInstance, TopoDS_Shape } from './vite-env';
import * as THREE from 'three';

export interface OCGeometryParams {
  type: 'box' | 'sphere' | 'cylinder' | 'cone';
  width?: number;
  height?: number;
  depth?: number;
  radius?: number;
  radius2?: number;
}

export const createOCGeometry = (
  oc: OpenCascadeInstance,
  params: OCGeometryParams
): TopoDS_Shape => {
  switch (params.type) {
    case 'box': {
      const w = params.width || 600;
      const h = params.height || 600;
      const d = params.depth || 600;
      const box = new oc.BRepPrimAPI_MakeBox_2(w, d, h);
      return box.Shape();
    }

    case 'sphere': {
      const r = params.radius || 300;
      const sphere = new oc.BRepPrimAPI_MakeSphere_1(r);
      return sphere.Shape();
    }

    case 'cylinder': {
      const r = params.radius || 200;
      const h = params.height || 800;
      const cylinder = new oc.BRepPrimAPI_MakeCylinder_1(r, h);
      return cylinder.Shape();
    }

    case 'cone': {
      const r1 = params.radius || 300;
      const r2 = params.radius2 || 100;
      const h = params.height || 800;
      const cone = new oc.BRepPrimAPI_MakeCone_1(r1, r2, h);
      return cone.Shape();
    }

    default:
      throw new Error(`Unknown geometry type: ${params.type}`);
  }
};

export const convertOCShapeToThreeGeometry = (
  oc: OpenCascadeInstance,
  shape: TopoDS_Shape
): THREE.BufferGeometry => {
  const mesher = new oc.BRepMesh_IncrementalMesh_2(shape, 0.1, false, 0.5, false);
  mesher.Perform();

  if (!mesher.IsDone()) {
    throw new Error('Failed to mesh OpenCascade shape');
  }

  const vertices: number[] = [];
  const indices: number[] = [];

  const explorer = new oc.TopExp_Explorer_2(
    shape,
    oc.TopAbs_ShapeEnum.TopAbs_FACE as any,
    oc.TopAbs_ShapeEnum.TopAbs_SHAPE as any
  );

  let vertexOffset = 0;

  while (explorer.More()) {
    const face = oc.TopoDS.Face_1(explorer.Current());
    const location = new oc.TopLoc_Location_1();
    const triangulation = oc.BRep_Tool.Triangulation(face, location);

    if (triangulation.IsNull()) {
      explorer.Next();
      continue;
    }

    const transformation = location.Transformation();
    const numNodes = triangulation.get().NbNodes();
    const numTriangles = triangulation.get().NbTriangles();

    for (let i = 1; i <= numNodes; i++) {
      const node = triangulation.get().Node(i);
      const transformed = node.Transformed(transformation);
      vertices.push(transformed.X(), transformed.Y(), transformed.Z());
    }

    for (let i = 1; i <= numTriangles; i++) {
      const triangle = triangulation.get().Triangle(i);
      const idx1 = triangle.Value(1) - 1 + vertexOffset;
      const idx2 = triangle.Value(2) - 1 + vertexOffset;
      const idx3 = triangle.Value(3) - 1 + vertexOffset;

      if (face.Orientation_1() === oc.TopAbs_Orientation.TopAbs_REVERSED) {
        indices.push(idx1, idx3, idx2);
      } else {
        indices.push(idx1, idx2, idx3);
      }
    }

    vertexOffset += numNodes;
    explorer.Next();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();

  return geometry;
};

export const performOCBoolean = (
  oc: OpenCascadeInstance,
  shape1: TopoDS_Shape,
  shape2: TopoDS_Shape,
  operation: 'union' | 'subtract' | 'intersect'
): TopoDS_Shape => {
  console.log(`🔄 Performing boolean ${operation}...`);

  if (!oc) {
    throw new Error('OpenCascade instance is null');
  }

  if (!shape1 || !shape2) {
    throw new Error('One or both shapes are null');
  }

  try {
    let progressRange: any = null;
    try {
      if (oc.Message_ProgressRange_1) {
        progressRange = new oc.Message_ProgressRange_1();
      }
    } catch (e) {
      console.warn('⚠️ Message_ProgressRange_1 not available, using simpler API');
    }

    switch (operation) {
      case 'union': {
        let fuse: any;
        if (progressRange && oc.BRepAlgoAPI_Fuse_3) {
          fuse = new oc.BRepAlgoAPI_Fuse_3(shape1, shape2, progressRange);
          fuse.Build(progressRange);
        } else if (oc.BRepAlgoAPI_Fuse_2) {
          fuse = new oc.BRepAlgoAPI_Fuse_2(shape1, shape2);
          fuse.Build();
        } else if (oc.BRepAlgoAPI_Fuse_1) {
          fuse = new oc.BRepAlgoAPI_Fuse_1(shape1, shape2);
        } else {
          throw new Error('No BRepAlgoAPI_Fuse constructor available');
        }

        if (!fuse.IsDone()) {
          throw new Error('Boolean union failed - operation not done');
        }
        const result = fuse.Shape();
        console.log('✅ Boolean union completed');
        return result;
      }

      case 'subtract': {
        let cut: any;
        if (progressRange && oc.BRepAlgoAPI_Cut_3) {
          cut = new oc.BRepAlgoAPI_Cut_3(shape1, shape2, progressRange);
          cut.Build(progressRange);
        } else if (oc.BRepAlgoAPI_Cut_2) {
          cut = new oc.BRepAlgoAPI_Cut_2(shape1, shape2);
          cut.Build();
        } else if (oc.BRepAlgoAPI_Cut_1) {
          cut = new oc.BRepAlgoAPI_Cut_1(shape1, shape2);
        } else {
          throw new Error('No BRepAlgoAPI_Cut constructor available');
        }

        if (!cut.IsDone()) {
          throw new Error('Boolean subtract failed - operation not done');
        }
        const result = cut.Shape();
        console.log('✅ Boolean subtract completed');
        return result;
      }

      case 'intersect': {
        let common: any;
        if (progressRange && oc.BRepAlgoAPI_Common_3) {
          common = new oc.BRepAlgoAPI_Common_3(shape1, shape2, progressRange);
          common.Build(progressRange);
        } else if (oc.BRepAlgoAPI_Common_2) {
          common = new oc.BRepAlgoAPI_Common_2(shape1, shape2);
          common.Build();
        } else if (oc.BRepAlgoAPI_Common_1) {
          common = new oc.BRepAlgoAPI_Common_1(shape1, shape2);
        } else {
          throw new Error('No BRepAlgoAPI_Common constructor available');
        }

        if (!common.IsDone()) {
          throw new Error('Boolean intersect failed - operation not done');
        }
        const result = common.Shape();
        console.log('✅ Boolean intersect completed');
        return result;
      }

      default:
        throw new Error(`Unknown operation: ${operation}`);
    }
  } catch (error) {
    console.error(`❌ Boolean ${operation} failed:`, error);
    throw error;
  }
};
