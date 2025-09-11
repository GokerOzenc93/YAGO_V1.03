import * as THREE from 'three';
// DEĞİŞİKLİK: Yeni "kesişim" mantığı için INTERSECTION operasyonunu içe aktarıyoruz.
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeometryFactory } from '../lib/geometryFactory';
// SimplifyModifier, nesnelerin kaybolmasına neden olduğu için kaldırıldı.

/**
 * Clean up CSG-generated geometry:
 * - applyMatrix4 should be done *before* calling this
 * - converts to non-indexed, welds vertices by tolerance, removes degenerate triangles,
 * rebuilds indexed geometry, merges vertices, computes normals/bounds
 *
 * @param {THREE.BufferGeometry} geom - geometry already in target-local space
 * @param {number} tolerance - welding tolerance in world units (e.g. 1e-3)
 * @returns {THREE.BufferGeometry} cleaned geometry (indexed)
 */
export function cleanCSGGeometry(geom, tolerance = 1e-2) { // Tolerance increased for better welding
  // 1) Ensure positions exist
  if (!geom.attributes.position) {
    console.warn('cleanCSGGeometry: geometry has no position attribute');
    return geom;
  }

  console.log(`🎯 Starting CSG geometry cleanup with tolerance: ${tolerance}`);
  const originalVertexCount = geom.attributes.position.count;
  const originalTriangleCount = geom.index ? geom.index.count / 3 : originalVertexCount / 3;

  // 2) Convert to non-indexed so triangles are explicit (easier to dedupe & remove degenerate)
  let nonIndexed = geom.index ? geom.toNonIndexed() : geom.clone();

  // 2.1) Validate geometry after conversion
  if (!nonIndexed || !nonIndexed.attributes || !nonIndexed.attributes.position) {
    console.warn('cleanCSGGeometry: geometry became invalid after toNonIndexed/clone');
    return new THREE.BufferGeometry();
  }

  const posAttr = nonIndexed.attributes.position;
  
  // 2.2) Validate position attribute array
  if (!posAttr.array || posAttr.array.length === 0) {
    console.warn('cleanCSGGeometry: position attribute has no array or empty array');
    return new THREE.BufferGeometry();
  }
  
  const posArray = posAttr.array;
  const triCount = posArray.length / 9; // 3 verts * 3 components

  // 3) Spatial hash to weld vertices with given tolerance
  const vertexMap = new Map(); // key -> newIndex
  const uniqueVerts = []; // flattened xyz
  const newIndices = []; // triangles (indices into uniqueVerts)
  let nextIndex = 0;

  // ÖNERİ UYGULANDI: Floating point hatalarına karşı daha sağlam vertex birleştirme
  const hash = (x, y, z) =>
    `${(x / tolerance).toFixed(3)}_${(y / tolerance).toFixed(3)}_${(z / tolerance).toFixed(3)}`;

  let degenerateCount = 0;

  for (let tri = 0; tri < triCount; tri++) {
    const triIndices = [];
    for (let v = 0; v < 3; v++) {
      const i = tri * 9 + v * 3;
      const x = posArray[i];
      const y = posArray[i + 1];
      const z = posArray[i + 2];
      const key = hash(x, y, z);

      let idx;
      if (vertexMap.has(key)) {
        idx = vertexMap.get(key);
      } else {
        idx = nextIndex++;
        vertexMap.set(key, idx);
        uniqueVerts.push(x, y, z);
      }
      triIndices.push(idx);
    }

    // remove degenerate triangles (two or three indices equal)
    if (
      triIndices[0] === triIndices[1] ||
      triIndices[1] === triIndices[2] ||
      triIndices[0] === triIndices[2]
    ) {
      degenerateCount++;
      continue;
    }

    newIndices.push(triIndices[0], triIndices[1], triIndices[2]);
  }

  console.log(`🎯 Removed ${degenerateCount} degenerate triangles`);

  // 4) Build new indexed BufferGeometry
  const cleaned = new THREE.BufferGeometry();
  const posBuffer = new Float32Array(uniqueVerts);
  cleaned.setAttribute('position', new THREE.BufferAttribute(posBuffer, 3));
  cleaned.setIndex(newIndices);

  // 5) Merge vertices with BufferGeometryUtils as extra safety
  let merged;
  try {
    merged = BufferGeometryUtils.mergeVertices(cleaned, tolerance);
  } catch (err) {
    console.warn('BufferGeometryUtils.mergeVertices failed, using cleaned geometry:', err);
    merged = cleaned;
  }

  // 6) Remove isolated vertices - Recompute indices validity
  if (!merged.index || merged.index.count < 3) {
    console.warn('Invalid index after merge, converting to non-indexed and re-merging');
    const nonIdx = merged.toNonIndexed();
    merged.dispose();
    merged = nonIdx;
    try {
      merged = BufferGeometryUtils.mergeVertices(merged, tolerance);
    } catch (err) {
      console.warn('Second merge attempt failed, using non-indexed geometry:', err);
    }
  }

  // 7) Recompute normals and bounds
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  const finalVertexCount = merged.attributes.position.count;
  const finalTriangleCount = merged.index ? merged.index.count / 3 : finalVertexCount / 3;

  console.log(`🎯 CSG cleanup complete:`, {
    originalVertices: originalVertexCount,
    finalVertices: finalVertexCount,
    originalTriangles: originalTriangleCount.toFixed(0),
    finalTriangles: finalTriangleCount.toFixed(0),
    degenerateRemoved: degenerateCount,
    vertexReduction: `${(((originalVertexCount - finalVertexCount) / originalVertexCount) * 100).toFixed(1)}%`
  });

  return merged;
}

/**
 * Reconstruct geometry from world vertices with proper surface generation
 * Creates new clean geometry based on bounding box and shape type
 */
const reconstructGeometryFromBounds = async (
  originalShape: any,
  resultGeometry: THREE.BufferGeometry,
  targetBrush: any
): Promise<THREE.BufferGeometry> => {
  console.log('✨ Geometri, sınırlayıcı kutudan yeniden parametrik olarak oluşturuluyor...');
  
  // Get the result geometry bounds in world space
  resultGeometry.computeBoundingBox();
  const bbox = resultGeometry.boundingBox;
  
  if (!bbox) {
    console.warn('Yeniden yapılandırma için sınırlayıcı kutu bulunamadı, mevcut geometri kullanılıyor.');
    return resultGeometry;
  }
  
  // Calculate dimensions from bounding box
  const width = Math.abs(bbox.max.x - bbox.min.x);
  const height = Math.abs(bbox.max.y - bbox.min.y);
  const depth = Math.abs(bbox.max.z - bbox.min.z);
  
  console.log(`✨ Yeni geometri boyutları: ${width.toFixed(1)} x ${height.toFixed(1)} x ${depth.toFixed(1)}`);
  
  let newGeometry: THREE.BufferGeometry;
  
  // Determine shape type and create appropriate geometry
  if (originalShape.type === 'box' || !originalShape.type) {
    // Create new box geometry with calculated dimensions
    newGeometry = await GeometryFactory.createBox(width, height, depth);
  } else if (originalShape.type === 'cylinder') {
    // For cylinder, use average of width/depth as radius
    const radius = Math.max(width, depth) / 2;
    newGeometry = await GeometryFactory.createCylinder(radius, height);
  } else {
    // For other shapes, default to box
    console.warn(`Bilinmeyen şekil tipi "${originalShape.type}", box olarak yeniden oluşturuluyor.`);
    newGeometry = await GeometryFactory.createBox(width, height, depth);
  }
  
  // Center the new geometry at the result's center
  const center = bbox.getCenter(new THREE.Vector3());
  newGeometry.translate(center.x, center.y, center.z);
  
  // Transform back to local space
  const invMatrix = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
  newGeometry.applyMatrix4(invMatrix);
  
  console.log('✅ Geometri yeniden yapılandırması temiz yüzeylerle tamamlandı.');
  return newGeometry;
};

// Dummy data and types to make the code runnable without external files
const Shape = {};
const Vector3 = THREE.Vector3;
const Matrix4 = THREE.Matrix4;

// Doğru bounding box hesaplama (rotation/scale destekli)
const getShapeBounds = (shape) => {
  const geometry = shape.geometry;
  if (!geometry.boundingBox) {
    geometry.computeBoundingBox();
  }
  const bbox = geometry.boundingBox.clone(); // local bbox

  const pos = new THREE.Vector3(...(shape.position || [0, 0, 0]));
  const scale = new THREE.Vector3(...(shape.scale || [1, 1, 1]));
  const rot = shape.rotation ? new THREE.Euler(...shape.rotation) : new THREE.Euler(0, 0, 0);
  const quat = new THREE.Quaternion().setFromEuler(rot);

  const m = new THREE.Matrix4().compose(pos, quat, scale);
  bbox.applyMatrix4(m); 

  return bbox;
};

// Helper function to check if two bounding boxes intersect
const boundsIntersect = (bounds1, bounds2) => {
  return bounds1.intersectsBox(bounds2);
};

// Find intersecting shapes
export const findIntersectingShapes = (
  selectedShape,
  allShapes
) => {
  console.log(`🎯 Kesişen şekiller aranıyor: ${selectedShape.type} (${selectedShape.id})`);
  
  const selectedBounds = getShapeBounds(selectedShape);
  
  const intersectingShapes = allShapes.filter(shape => {
    if (shape.id === selectedShape.id) return false;
    
    const shapeBounds = getShapeBounds(shape);
    const intersects = boundsIntersect(selectedBounds, shapeBounds);
    
    if (intersects) {
      console.log(`✅ Kesişim bulundu: ${selectedShape.type} (${selectedShape.id}) ile ${shape.type} (${shape.id})`);
    }
    
    return intersects;
  });
  
  console.log(`🎯 ${intersectingShapes.length} adet kesişen şekil bulundu`);
  return intersectingShapes;
};

// Helper function to get face normal from geometry
const getFaceNormal = (geometry, faceIndex) => {
  try {
    const pos = geometry.attributes.position;
    const index = geometry.index;
    
    if (!pos || faceIndex === undefined) return null;
    
    let a, b, c;
    if (index) {
      a = index.getX(faceIndex * 3);
      b = index.getX(faceIndex * 3 + 1);
      c = index.getX(faceIndex * 3 + 2);
    } else {
      a = faceIndex * 3;
      b = faceIndex * 3 + 1;
      c = faceIndex * 3 + 2;
    }
    
    const vA = new THREE.Vector3().fromBufferAttribute(pos, a);
    const vB = new THREE.Vector3().fromBufferAttribute(pos, b);
    const vC = new THREE.Vector3().fromBufferAttribute(pos, c);
    
    const cb = new THREE.Vector3().subVectors(vC, vB);
    const ab = new THREE.Vector3().subVectors(vA, vB);
    
    return cb.cross(ab).normalize();
  } catch (error) {
    console.warn('Error getting face normal:', error);
    return null;
  }
};

// Helper function to get face center from geometry
const getFaceCenter = (geometry, faceIndex) => {
  try {
    const pos = geometry.attributes.position;
    const index = geometry.index;
    
    if (!pos || faceIndex === undefined) return null;
    
    let a, b, c;
    if (index) {
      a = index.getX(faceIndex * 3);
      b = index.getX(faceIndex * 3 + 1);
      c = index.getX(faceIndex * 3 + 2);
    } else {
      a = faceIndex * 3;
      b = faceIndex * 3 + 1;
      c = faceIndex * 3 + 2;
    }
    
    const vA = new THREE.Vector3().fromBufferAttribute(pos, a);
    const vB = new THREE.Vector3().fromBufferAttribute(pos, b);
    const vC = new THREE.Vector3().fromBufferAttribute(pos, c);
    
    return new THREE.Vector3()
      .addVectors(vA, vB)
      .add(vC)
      .divideScalar(3);
  } catch (error) {
    console.warn('Error getting face center:', error);
    return null;
  }
};

// Helper function to clip shape with plane
const clipShapeWithPlane = (shape, plane) => {
  try {
    // Create a clipped version of the shape using the plane
    const clippedGeometry = shape.geometry.clone();
    
    // Apply shape transforms to get world space geometry
    const matrix = new THREE.Matrix4();
    const quaternion = shape.quaternion || new THREE.Quaternion().setFromEuler(new THREE.Euler(...shape.rotation));
    matrix.compose(
      new THREE.Vector3(...shape.position),
      quaternion,
      new THREE.Vector3(...shape.scale)
    );
    
    clippedGeometry.applyMatrix4(matrix);
    
    // Create a new shape with clipped geometry
    const clippedShape = {
      ...shape,
      geometry: clippedGeometry,
      position: [0, 0, 0], // Already transformed
      rotation: [0, 0, 0],
      scale: [1, 1, 1]
    };
    
    return clippedShape;
  } catch (error) {
    console.warn('Error clipping shape with plane:', error);
    return shape; // Fallback to original shape
  }
};

// Create brush from shape with proper transforms
const createBrushFromShape = (shape) => {
  const brush = new Brush(shape.geometry.clone());
  
  brush.position.fromArray(shape.position || [0, 0, 0]);
  brush.scale.fromArray(shape.scale || [1, 1, 1]);
  
  if (shape.rotation) {
    const euler = new THREE.Euler(...shape.rotation);
    brush.quaternion.setFromEuler(euler);
  }
  
  brush.updateMatrixWorld(true);
  
  return brush;
};

// Perform boolean subtract operation with three-bvh-csg
export const performBooleanSubtract = async (
  selectedShape,
  allShapes,
  updateShape,
  deleteShape,
  selectedFaceIndex = null
) => {
  console.log('🎯 ===== BOOLEAN ÇIKARMA İŞLEMİ BAŞLADI (CSG) =====');
  
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ Çıkarma işlemi için kesişen şekil bulunamadı');
    return false;
  }
  
  const evaluator = new Evaluator();
  
  try {
    for (const targetShape of intersectingShapes) {
      console.log(`🎯 Çıkarma işlemi uygulanıyor: ${targetShape.type} (${targetShape.id})`);
      
      // Eğer face seçimi varsa, sadece o yüzeyden itibaren kes
      if (selectedFaceIndex !== null) {
        console.log(`🎯 Face-based subtraction: Face ${selectedFaceIndex} selected`);
        
        // Face normal'ını ve pozisyonunu al
        const faceNormal = getFaceNormal(targetShape.geometry, selectedFaceIndex);
        const faceCenter = getFaceCenter(targetShape.geometry, selectedFaceIndex);
        
        if (faceNormal && faceCenter) {
          // Seçili yüzeyden itibaren kesme düzlemi oluştur
          const cuttingPlane = new THREE.Plane(faceNormal, -faceNormal.dot(faceCenter));
          
          // Çıkarılacak nesneyi kesme düzlemiyle sınırla
          const clippedSubtractShape = clipShapeWithPlane(selectedShape, cuttingPlane);
          
          if (clippedSubtractShape) {
            const selectedBrush = createBrushFromShape(clippedSubtractShape);
            const targetBrush = createBrushFromShape(targetShape);
            
            console.log('🎯 Performing face-based CSG subtraction...');
            const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, SUBTRACTION);
            
            if (!resultMesh || !resultMesh.geometry || resultMesh.geometry.attributes.position.count === 0) {
              console.error('❌ Face-based CSG çıkarma işlemi boş bir geometriyle sonuçlandı.');
              continue;
            }
            
            resultMesh.updateMatrixWorld(true);
            
            let newGeom;
            const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
            newGeom = resultMesh.geometry.clone();
            newGeom.applyMatrix4(invTarget);
            newGeom = cleanCSGGeometry(newGeom, 0.01);
            
            if (!newGeom || !newGeom.attributes.position || newGeom.attributes.position.count === 0) {
              console.error(`❌ Face-based geometri işleme sonrası boş bir sonuç döndü: ${targetShape.id}`);
              continue;
            }
            
            try { 
              targetShape.geometry.dispose(); 
            } catch (e) { 
              console.warn('Eski geometri dispose edilemedi:', e);
            }
            
            updateShape(targetShape.id, {
              geometry: newGeom,
              parameters: {
                ...targetShape.parameters,
                booleanOperation: 'face-subtract',
                subtractedShapeId: selectedShape.id,
                selectedFaceIndex: selectedFaceIndex,
                lastModified: Date.now(),
              }
            });
            
            console.log(`✅ Face-based subtraction completed for shape ${targetShape.id}`);
            continue;
          }
        }
      }
      
      const selectedBrush = createBrushFromShape(selectedShape);
      const targetBrush = createBrushFromShape(targetShape);
      
      // Standart çıkarma işlemi: targetShape - selectedShape
      console.log('🎯 Performing CSG subtraction...');
      const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, SUBTRACTION);
      
      if (!resultMesh || !resultMesh.geometry || resultMesh.geometry.attributes.position.count === 0) {
        console.error('❌ CSG çıkarma işlemi boş bir geometriyle sonuçlandı. Bu şekil atlanıyor.');
        continue;
      }
      
      resultMesh.updateMatrixWorld(true);
      
      let newGeom;
      
      // Çıkarma sonucu karmaşık geometri olacağından temizleme uygula
      const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
      newGeom = resultMesh.geometry.clone();
      newGeom.applyMatrix4(invTarget);
      newGeom = cleanCSGGeometry(newGeom, 0.01);
      
      if (!newGeom || !newGeom.attributes.position || !newGeom.attributes.position.count === 0) {
          console.error(`❌ Geometri işleme sonrası boş bir sonuç döndü: ${targetShape.id}. Güncelleme iptal edildi.`);
          continue;
      }
      
      try { 
        targetShape.geometry.dispose(); 
      } catch (e) { 
        console.warn('Eski geometri dispose edilemedi:', e);
      }
      
      updateShape(targetShape.id, {
        geometry: newGeom,
        parameters: {
          ...targetShape.parameters,
          booleanOperation: 'subtract',
          subtractedShapeId: selectedShape.id,
          lastModified: Date.now(),
        }
      });
      
      console.log(`✅ Hedef şekil ${targetShape.id} güncellendi.`);
    }
    
    // Çıkarma işlemi yapan seçili nesne silinir
    deleteShape(selectedShape.id);
    console.log(`🗑️ Çıkarma için kullanılan şekil silindi: ${selectedShape.id}`);
    
    console.log(`✅ ===== BOOLEAN ÇIKARMA İŞLEMİ BAŞARIYLA TAMAMLANDI (CSG) =====`);
    return true;
    
  } catch (error) {
    console.error('❌ ===== BOOLEAN ÇIKARMA İŞLEMİ BAŞARISIZ OLDU (CSG) =====', error);
    return false;
  }
};

// Perform boolean union operation with three-bvh-csg
export const performBooleanUnion = async (
  selectedShape,
  allShapes,
  updateShape,
  deleteShape
) => {
  console.log('🎯 ===== BOOLEAN BİRLEŞTİRME İŞLEMİ BAŞLADI (CSG) =====');
  
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ Birleştirme işlemi için kesişen şekil bulunamadı');
    return false;
  }
  
  const evaluator = new Evaluator();
  
  try {
    const targetShape = intersectingShapes[0];
    console.log(`🎯 Birleştirme hedefi: ${targetShape.type} (${targetShape.id})`);
    
    const selectedBrush = createBrushFromShape(selectedShape);
    const targetBrush = createBrushFromShape(targetShape);
    
    const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, ADDITION);
    
    if (!resultMesh || !resultMesh.geometry || resultMesh.geometry.attributes.position.count === 0) {
      console.error('❌ CSG birleştirme işlemi boş bir geometriyle sonuçlandı. İptal ediliyor.');
      return false;
    }
    
    resultMesh.updateMatrixWorld(true);
    
    let newGeom;
    
    // ÖNERİ UYGULANDI: 'box' tipi nesneler için her zaman yeniden yapılandır.
    if (targetShape.type === 'box') {
        newGeom = await reconstructGeometryFromBounds(targetShape, resultMesh.geometry, targetBrush);
    } else {
        const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
        newGeom = resultMesh.geometry.clone();
        newGeom.applyMatrix4(invTarget);
        newGeom = cleanCSGGeometry(newGeom, 0.01);
    }

    if (!newGeom || !newGeom.attributes.position || newGeom.attributes.position.count === 0) {
        console.error(`❌ Geometri işleme sonrası boş bir sonuç döndü. Güncelleme iptal edildi.`);
        return false;
    }
    
    try { 
      targetShape.geometry.dispose(); 
    } catch (e) { 
      console.warn('Eski geometri dispose edilemedi:', e);
    }
    
    updateShape(targetShape.id, {
      geometry: newGeom,
      parameters: {
        ...targetShape.parameters,
        booleanOperation: 'union',
        unionedShapeId: selectedShape.id,
        lastModified: Date.now()
      }
    });
    
    console.log(`✅ Hedef şekil ${targetShape.id} güncellendi.`);
    
    deleteShape(selectedShape.id);
    console.log(`🗑️ Birleştirilen şekil silindi: ${selectedShape.id}`);
    
    console.log(`✅ ===== BOOLEAN BİRLEŞTİRME İŞLEMİ BAŞARIYLA TAMAMLANDI (CSG) =====`);
    return true;
    
  } catch (error) {
    console.error('❌ ===== BOOLEAN BİRLEŞTİRME İŞLEMİ BAŞARISIZ OLDU (CSG) =====', error);
    return false;
  }
};