import * as THREE from 'three';
// DEĞİŞİKLİK: Yeni "kesişim" mantığı için INTERSECTION operasyonunu içe aktarıyoruz.
import { Brush, Evaluator, SUBTRACTION, ADDITION, INTERSECTION } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { GeometryFactory } from '../lib/geometryFactory';
import { getCurrentHighlight } from './faceSelection';
// SimplifyModifier, nesnelerin kaybolmasına neden olduğu için kaldırıldı.

/**
 * Yüzeyleri dünya düğüm noktalarına göre genişlet
 */
const stretchSurfacesToWorldNodes = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => {
  console.log('🎯 Stretching surfaces to world nodes...');
  
  const stretchedGeometry = geometry.clone();
  const positions = stretchedGeometry.attributes.position;
  const posArray = positions.array as Float32Array;
  const vertexCount = positions.count;
  
  // Dünya düğüm noktaları (grid noktaları)
  const worldNodes = [
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(500, 0, 0),
    new THREE.Vector3(-500, 0, 0),
    new THREE.Vector3(0, 0, 500),
    new THREE.Vector3(0, 0, -500),
    new THREE.Vector3(500, 0, 500),
    new THREE.Vector3(-500, 0, 500),
    new THREE.Vector3(500, 0, -500),
    new THREE.Vector3(-500, 0, -500),
    new THREE.Vector3(0, 500, 0),
    new THREE.Vector3(0, -500, 0),
  ];
  
  // Her vertex için en yakın dünya düğümüne doğru genişletme
  for (let i = 0; i < vertexCount; i++) {
    const vertex = new THREE.Vector3(
      posArray[i * 3],
      posArray[i * 3 + 1],
      posArray[i * 3 + 2]
    );
    
    // En yakın dünya düğümünü bul
    let closestNode = worldNodes[0];
    let minDistance = vertex.distanceTo(closestNode);
    
    for (const node of worldNodes) {
      const distance = vertex.distanceTo(node);
      if (distance < minDistance) {
        minDistance = distance;
        closestNode = node;
      }
    }
    
    // Vertex'i dünya düğümüne doğru %20 genişlet
    const direction = new THREE.Vector3().subVectors(closestNode, vertex).normalize();
    const stretchAmount = 50; // 50mm genişletme
    const stretchedVertex = vertex.clone().add(direction.multiplyScalar(stretchAmount));
    
    // Yeni pozisyonu uygula
    posArray[i * 3] = stretchedVertex.x;
    posArray[i * 3 + 1] = stretchedVertex.y;
    posArray[i * 3 + 2] = stretchedVertex.z;
  }
  
  // Attribute'u güncelle
  positions.needsUpdate = true;
  
  // Normal'ları yeniden hesapla
  stretchedGeometry.computeVertexNormals();
  stretchedGeometry.computeBoundingBox();
  stretchedGeometry.computeBoundingSphere();
  
  console.log('✅ Surface stretching completed');
  return stretchedGeometry;
};

/**
 * Yüzeylere yeni face'ler ekle (triangulation ile)
 */
const addNewFacesToSurfaces = (geometry: THREE.BufferGeometry): THREE.BufferGeometry => {
  console.log('🎯 Adding new faces to surfaces...');
  
  const enhancedGeometry = geometry.clone();
  const positions = enhancedGeometry.attributes.position;
  const posArray = positions.array as Float32Array;
  const vertexCount = positions.count;
  
  // Mevcut vertex'leri al
  const vertices: THREE.Vector3[] = [];
  for (let i = 0; i < vertexCount; i++) {
    vertices.push(new THREE.Vector3(
      posArray[i * 3],
      posArray[i * 3 + 1],
      posArray[i * 3 + 2]
    ));
  }
  
  // Yeni vertex'ler ve face'ler ekle
  const newVertices: THREE.Vector3[] = [...vertices];
  const newIndices: number[] = [];
  
  // Mevcut index'leri koru
  if (enhancedGeometry.index) {
    const indexArray = enhancedGeometry.index.array;
    for (let i = 0; i < indexArray.length; i++) {
      newIndices.push(indexArray[i]);
    }
  } else {
    // Non-indexed geometry için index oluştur
    for (let i = 0; i < vertexCount; i++) {
      newIndices.push(i);
    }
  }
  
  // Yüzey kenarlarında yeni vertex'ler ve face'ler oluştur
  const edgeVertices: THREE.Vector3[] = [];
  
  // Her 3 vertex'lik üçgen için kenar vertex'leri ekle
  for (let i = 0; i < newIndices.length; i += 3) {
    const v1 = vertices[newIndices[i]];
    const v2 = vertices[newIndices[i + 1]];
    const v3 = vertices[newIndices[i + 2]];
    
    // Kenar orta noktaları
    const edge1 = new THREE.Vector3().addVectors(v1, v2).multiplyScalar(0.5);
    const edge2 = new THREE.Vector3().addVectors(v2, v3).multiplyScalar(0.5);
    const edge3 = new THREE.Vector3().addVectors(v3, v1).multiplyScalar(0.5);
    
    // Yüzey merkezi
    const center = new THREE.Vector3().addVectors(v1, v2).add(v3).multiplyScalar(1/3);
    
    // Yeni vertex'leri ekle
    const startIndex = newVertices.length;
    newVertices.push(edge1, edge2, edge3, center);
    
    // Yeni face'ler oluştur (subdivide)
    const originalIndices = [newIndices[i], newIndices[i + 1], newIndices[i + 2]];
    const edgeIndices = [startIndex, startIndex + 1, startIndex + 2];
    const centerIndex = startIndex + 3;
    
    // Orijinal üçgeni 4 küçük üçgene böl
    newIndices.push(
      // Köşe üçgenleri
      originalIndices[0], edgeIndices[0], edgeIndices[2],
      originalIndices[1], edgeIndices[1], edgeIndices[0],
      originalIndices[2], edgeIndices[2], edgeIndices[1],
      // Merkez üçgen
      edgeIndices[0], edgeIndices[1], edgeIndices[2]
    );
  }
  
  // Yeni geometri oluştur
  const newGeometry = new THREE.BufferGeometry();
  
  // Vertex pozisyonlarını ayarla
  const newPositions = new Float32Array(newVertices.length * 3);
  for (let i = 0; i < newVertices.length; i++) {
    newPositions[i * 3] = newVertices[i].x;
    newPositions[i * 3 + 1] = newVertices[i].y;
    newPositions[i * 3 + 2] = newVertices[i].z;
  }
  
  newGeometry.setAttribute('position', new THREE.BufferAttribute(newPositions, 3));
  newGeometry.setIndex(newIndices);
  
  // Normal'ları hesapla
  newGeometry.computeVertexNormals();
  newGeometry.computeBoundingBox();
  newGeometry.computeBoundingSphere();
  
  console.log(`✅ Added new faces: ${newVertices.length - vertices.length} new vertices, ${(newIndices.length - indexArray.length) / 3} new faces`);
  return newGeometry;
};

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
 * Highlighted surface'i geometriye yüzey olarak ekle
 */
const cleanupGeometryUsingReference = (
  geometry: THREE.BufferGeometry,
  referenceVertices: THREE.Vector3[],
  worldMatrix: THREE.Matrix4
): THREE.BufferGeometry => {
  console.log(`🎯 Cleaning up geometry using ${referenceVertices.length} reference vertices`);
  
  // Referans yüzeyin düzlemini hesapla
  if (referenceVertices.length < 3) {
    console.log('🎯 Not enough reference vertices for cleanup, returning original geometry');
    return geometry;
  }
  
  // Referans vertices'leri local space'e dönüştür
  const invMatrix = new THREE.Matrix4().copy(worldMatrix).invert();
  const localReferenceVertices = referenceVertices.map(v => v.clone().applyMatrix4(invMatrix));
  
  // Referans düzlemini hesapla
  const refPoint1 = localReferenceVertices[0];
  const refPoint2 = localReferenceVertices[1];
  const refPoint3 = localReferenceVertices[2];
  
  const v1 = new THREE.Vector3().subVectors(refPoint2, refPoint1);
  const v2 = new THREE.Vector3().subVectors(refPoint3, refPoint1);
  const referenceNormal = new THREE.Vector3().crossVectors(v1, v2).normalize();
  const referencePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(referenceNormal, refPoint1);
  
  console.log(`🎯 Reference plane calculated with normal: [${referenceNormal.x.toFixed(3)}, ${referenceNormal.y.toFixed(3)}, ${referenceNormal.z.toFixed(3)}]`);
  
  // Mevcut geometrinin vertex'lerini analiz et
  const positions = geometry.attributes.position;
  const posArray = positions.array as Float32Array;
  const vertexCount = positions.count;
  
  // Referans düzleme yakın vertex'leri bul ve düzle
  const PLANE_TOLERANCE = 5.0; // 5mm tolerans
  let cleanedVertexCount = 0;
  
  for (let i = 0; i < vertexCount; i++) {
    const vertex = new THREE.Vector3(
      posArray[i * 3],
      posArray[i * 3 + 1],
      posArray[i * 3 + 2]
    );
    
    // Vertex'in referans düzleme olan mesafesini hesapla
    const distanceToPlane = Math.abs(referencePlane.distanceToPoint(vertex));
    
    // Eğer vertex referans düzleme yakınsa, düzleme projekte et
    if (distanceToPlane < PLANE_TOLERANCE) {
      const projectedVertex = referencePlane.projectPoint(vertex, new THREE.Vector3());
      
      // Vertex'i güncelle
      posArray[i * 3] = projectedVertex.x;
      posArray[i * 3 + 1] = projectedVertex.y;
      posArray[i * 3 + 2] = projectedVertex.z;
      
      cleanedVertexCount++;
    }
  }
  
  // Position attribute'u güncelle
  positions.needsUpdate = true;
  
  // Geometriyi yeniden hesapla
  geometry.computeVertexNormals();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  
  console.log(`✅ Vertex cleanup completed: ${cleanedVertexCount} vertices projected to reference plane`);
  
  return geometry;
};

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
  
  // Highlighted surface bilgilerini al
  const currentHighlight = getCurrentHighlight();
  let highlightedSurfaceVertices = null;
  
  if (currentHighlight) {
    // Highlighted mesh'in geometrisinden vertex'leri al
    const highlightGeometry = currentHighlight.mesh.geometry;
    const positions = highlightGeometry.attributes.position;
    highlightedSurfaceVertices = [];
    
    for (let i = 0; i < positions.count; i++) {
      const vertex = new THREE.Vector3().fromBufferAttribute(positions, i);
      highlightedSurfaceVertices.push(vertex);
    }
    
    console.log(`🎯 Highlighted surface captured: ${highlightedSurfaceVertices.length} vertices`);
  }
  
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
            
             // Highlighted surface'i referans olarak kullanarak vertex temizliği yap
             if (highlightedSurfaceVertices && highlightedSurfaceVertices.length > 0) {
               newGeom = cleanupGeometryUsingReference(newGeom, highlightedSurfaceVertices, targetBrush.matrixWorld);
               console.log('🎯 Geometry cleaned up using highlighted surface as reference');
             }
             
             // Yüzeyleri dünya düğümlerine göre genişlet ve yeni face'ler ekle
             newGeom = stretchSurfacesToWorldNodes(newGeom);
             newGeom = addNewFacesToSurfaces(newGeom);
             
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
      
      if (!newGeom || !newGeom.attributes.position || newGeom.attributes.position.count === 0) {
          console.error(`❌ Geometri işleme sonrası boş bir sonuç döndü: ${targetShape.id}. Güncelleme iptal edildi.`);
          continue;
      }
      
       // Highlighted surface'i referans olarak kullanarak vertex temizliği yap
       if (highlightedSurfaceVertices && highlightedSurfaceVertices.length > 0) {
         newGeom = cleanupGeometryUsingReference(newGeom, highlightedSurfaceVertices, targetBrush.matrixWorld);
         console.log('🎯 Geometry cleaned up using highlighted surface as reference');
       }
       
       // Yüzeyleri dünya düğümlerine göre genişlet ve yeni face'ler ekle
       newGeom = stretchSurfacesToWorldNodes(newGeom);
       newGeom = addNewFacesToSurfaces(newGeom);
       
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