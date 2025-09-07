import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Temizleme işlemi için bir geometriyi BufferGeometryUtils.mergeVertices ile işler.
 * Bu fonksiyon, birleştirme sonrası oluşabilecek kopuklukları da gidermek için
 * ek adımlar içerir.
 *
 * @param {THREE.BufferGeometry} geom - İşlenecek geometri.
 * @param {number} tolerance - Vertex birleştirme toleransı.
 * @returns {THREE.BufferGeometry} Temizlenmiş geometri.
 */
function weldAndClean(geom, tolerance) {
  let merged;
  try {
    merged = BufferGeometryUtils.mergeVertices(geom, tolerance);
  } catch (err) {
    console.warn('BufferGeometryUtils.mergeVertices başarısız oldu, orijinal geometri kullanılıyor:', err);
    return geom;
  }

  // mergeVertices sonrası bazı üçgenler geçerliliğini yitirebilir.
  // Bu durumda, geometriyi non-indexed yapıp tekrar işlemeyi deneyeceğiz.
  if (!merged.index || merged.index.count < 3) {
    console.warn('Birleştirme sonrası geçersiz indeks, non-indexed geometriye çevriliyor ve tekrar birleştiriliyor.');
    const nonIndexed = merged.toNonIndexed();
    merged.dispose();
    
    try {
      merged = BufferGeometryUtils.mergeVertices(nonIndexed, tolerance);
    } catch (err) {
      console.warn('İkinci birleştirme denemesi de başarısız oldu, non-indexed geometri kullanılıyor:', err);
      return nonIndexed;
    }
  }

  // Oluşan geometrinin normal ve sınırlarını yeniden hesapla
  merged.computeVertexNormals();
  merged.computeBoundingBox();
  merged.computeBoundingSphere();

  return merged;
}

/**
 * CSG işleminden sonra oluşan geometrinin temizlenmesi:
 * - Vertex'leri kaynaklar (weld).
 * - Dejenere üçgenleri (nokta veya çizgi halini almış) kaldırır.
 *
 * @param {THREE.BufferGeometry} geom - Temizlenecek BufferGeometry.
 * @param {number} tolerance - Kaynaklama toleransı.
 * @returns {THREE.BufferGeometry} Temizlenmiş ve optimize edilmiş BufferGeometry.
 */
export function cleanCSGGeometry(geom, tolerance = 1e-2) {
  if (!geom.attributes.position) {
    console.warn('cleanCSGGeometry: geometrinin position özelliği bulunmuyor.');
    return geom;
  }

  console.log(`🎯 CSG geometri temizleme işlemi başladı, tolerans: ${tolerance}`);
  const originalVertexCount = geom.attributes.position.count;
  const originalTriangleCount = geom.index ? geom.index.count / 3 : originalVertexCount / 3;

  // 1) Geometry'yi non-indexed hale getir
  let nonIndexed = geom.index ? geom.toNonIndexed() : geom.clone();

  // 2) Dejenere üçgenleri kaldır
  const posAttr = nonIndexed.attributes.position;
  const posArray = posAttr.array;
  const newPositions: number[] = [];

  const triCount = posArray.length / 9;
  let degenerateCount = 0;

  for (let tri = 0; tri < triCount; tri++) {
    const i = tri * 9;
    const v1 = new THREE.Vector3(posArray[i], posArray[i + 1], posArray[i + 2]);
    const v2 = new THREE.Vector3(posArray[i + 3], posArray[i + 4], posArray[i + 5]);
    const v3 = new THREE.Vector3(posArray[i + 6], posArray[i + 7], posArray[i + 8]);

    // Üç vertex'in birbirinden farklı olup olmadığını kontrol et
    if (v1.distanceTo(v2) > 1e-6 && v2.distanceTo(v3) > 1e-6 && v3.distanceTo(v1) > 1e-6) {
      newPositions.push(...v1.toArray(), ...v2.toArray(), ...v3.toArray());
    } else {
      degenerateCount++;
    }
  }

  console.log(`🎯 ${degenerateCount} dejenere üçgen kaldırıldı.`);
  
  // 3) Yeni geometriyi oluştur
  const cleanedGeom = new THREE.BufferGeometry();
  cleanedGeom.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newPositions), 3));
  
  // 4) Vertexleri kaynakla (weld)
  const merged = weldAndClean(cleanedGeom, tolerance);

  const finalVertexCount = merged.attributes.position.count;
  const finalTriangleCount = merged.index ? merged.index.count / 3 : finalVertexCount / 3;

  console.log(`🎯 CSG temizleme tamamlandı:`, {
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
 * Aynı düzlemdeki yüzeyleri birleştirerek gereksiz vertex ve çizgileri kaldırır.
 * Bu fonksiyon, birleşik yüzeyin kenarlarını (boundary) doğru şekilde bulup yeniden üçgenler.
 *
 * @param {THREE.BufferGeometry} geometry - Girdi geometrisi.
 * @param {number} tolerance - Yüzeylerin aynı düzlemde olup olmadığını kontrol etmek için tolerans.
 * @returns {THREE.BufferGeometry} Birleştirilmiş yüzeylere sahip yeni geometri.
 */
function mergeCoplanarFaces(geometry, tolerance = 1e-2) {
  if (!geometry.index || !geometry.attributes.position) {
    console.warn('mergeCoplanarFaces: Geçersiz geometri.');
    return geometry;
  }

  const positions = geometry.attributes.position.array;
  const indices = geometry.index.array;
  const triangleCount = indices.length / 3;

  console.log(`🎯 Birleştirilecek ${triangleCount} üçgen analiz ediliyor...`);

  const faceNormals = [];
  const faceCenters = [];
  const indexToVertex = new Map();

  for (let i = 0; i < geometry.attributes.position.count; i++) {
    indexToVertex.set(i, new THREE.Vector3().fromBufferAttribute(geometry.attributes.position, i));
  }

  for (let i = 0; i < triangleCount; i++) {
    const i0 = indices[i * 3];
    const i1 = indices[i * 3 + 1];
    const i2 = indices[i * 3 + 2];

    const v0 = indexToVertex.get(i0);
    const v1 = indexToVertex.get(i1);
    const v2 = indexToVertex.get(i2);

    const edge1 = new THREE.Vector3().subVectors(v1, v0);
    const edge2 = new THREE.Vector3().subVectors(v2, v0);
    const normal = new THREE.Vector3().crossVectors(edge1, edge2).normalize();
    const center = new THREE.Vector3().addVectors(v0, v1).add(v2).divideScalar(3);

    faceNormals.push(normal);
    faceCenters.push(center);
  }

  const coplanarGroups = [];
  const processed = new Set();
  const normalTolerance = Math.cos(THREE.MathUtils.degToRad(1));
  const planeTolerance = tolerance;

  for (let i = 0; i < triangleCount; i++) {
    if (processed.has(i)) continue;

    const group = [i];
    const baseNormal = faceNormals[i];
    const baseCenter = faceCenters[i];
    processed.add(i);

    for (let j = i + 1; j < triangleCount; j++) {
      if (processed.has(j)) continue;

      const testNormal = faceNormals[j];
      const testCenter = faceCenters[j];

      if (Math.abs(baseNormal.dot(testNormal)) < normalTolerance) continue;

      const centerDiff = new THREE.Vector3().subVectors(testCenter, baseCenter);
      const distanceToPlane = Math.abs(centerDiff.dot(baseNormal));
      
      if (distanceToPlane < planeTolerance) {
        group.push(j);
        processed.add(j);
      }
    }

    if (group.length > 1) {
      coplanarGroups.push(group);
    }
  }

  console.log(`🎯 ${coplanarGroups.length} adet eş düzlemli (coplanar) yüzey grubu bulundu.`);

  if (coplanarGroups.length === 0) {
    return geometry;
  }

  const newPositions: number[] = [];
  const newIndices: number[] = [];
  const vertexToNewIndex = new Map();
  let newIndexCounter = 0;

  // Coplanar olmayan yüzeyleri olduğu gibi ekle
  const allGroupedFaces = new Set();
  coplanarGroups.forEach(group => group.forEach(faceIndex => allGroupedFaces.add(faceIndex)));

  for (let i = 0; i < triangleCount; i++) {
    if (allGroupedFaces.has(i)) continue;
    const i0 = indices[i * 3];
    const i1 = indices[i * 3 + 1];
    const i2 = indices[i * 3 + 2];
    [i0, i1, i2].forEach(oldIndex => {
      if (!vertexToNewIndex.has(oldIndex)) {
        const v = indexToVertex.get(oldIndex);
        newPositions.push(v.x, v.y, v.z);
        vertexToNewIndex.set(oldIndex, newIndexCounter++);
      }
    });
    newIndices.push(vertexToNewIndex.get(i0), vertexToNewIndex.get(i1), vertexToNewIndex.get(i2));
  }
  
  // Eş düzlemli yüzeyleri işle
  let mergedFaceCount = 0;
  coplanarGroups.forEach(group => {
    // Tüm vertexleri ve kenarları topla
    const edges = new Map();
    const groupVertices = new Map();

    group.forEach(faceIndex => {
        const i0 = indices[faceIndex * 3];
        const i1 = indices[faceIndex * 3 + 1];
        const i2 = indices[faceIndex * 3 + 2];
        const v0 = indexToVertex.get(i0);
        const v1 = indexToVertex.get(i1);
        const v2 = indexToVertex.get(i2);
        
        [v0, v1, v2].forEach(v => {
            const key = `${v.x.toFixed(6)}_${v.y.toFixed(6)}_${v.z.toFixed(6)}`;
            groupVertices.set(key, v);
        });

        const addEdge = (a, b) => {
            const key = [a, b].sort((vA, vB) => vA.x - vB.x || vA.y - vB.y || vA.z - vB.z).map(v => v.toArray().map(c => c.toFixed(6)).join('_')).join('|');
            edges.set(key, (edges.get(key) || 0) + 1);
        };
        addEdge(v0, v1);
        addEdge(v1, v2);
        addEdge(v2, v0);
    });

    // Sadece bir kez görünen kenarlar dış sınırdır (boundary)
    const boundaryEdges = [];
    for(const [key, count] of edges.entries()) {
        if (count === 1) {
            const [vA, vB] = key.split('|').map(str => {
                const [x, y, z] = str.split('_').map(Number);
                return new THREE.Vector3(x, y, z);
            });
            boundaryEdges.push(vA, vB);
        }
    }

    // Boundary vertexlerini bul ve sırala
    const boundaryVertices = [];
    const uniqueBoundaryVertices = new Set();
    boundaryEdges.forEach(v => {
        const key = `${v.x.toFixed(6)}_${v.y.toFixed(6)}_${v.z.toFixed(6)}`;
        if (!uniqueBoundaryVertices.has(key)) {
            uniqueBoundaryVertices.add(key);
            boundaryVertices.push(v);
        }
    });

    if (boundaryVertices.length < 3) {
      console.warn('Dış sınır oluşturulamadı, yüzey birleştirme atlandı.');
      return;
    }

    const normal = faceNormals[group[0]];
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(normal, boundaryVertices[0]);
    const up = new THREE.Vector3(0, 1, 0);
    if (Math.abs(up.dot(normal)) > 0.9) up.set(1, 0, 0);
    const right = new THREE.Vector3().crossVectors(up, normal).normalize();
    up.crossVectors(normal, right).normalize();
    
    // Vertexleri 2D'ye projekte et ve sırala (basit bir yaklaşım)
    const projected2D = boundaryVertices.map(v => new THREE.Vector2(v.dot(right), v.dot(up)));
    const center2D = projected2D.reduce((acc, v) => acc.add(v), new THREE.Vector2()).divideScalar(projected2D.length);
    projected2D.sort((a, b) => Math.atan2(a.y - center2D.y, a.x - center2D.x) - Math.atan2(b.y - center2D.y, b.x - center2D.x));

    const newShape = new THREE.Shape(projected2D);
    const geometry2d = new THREE.ShapeGeometry(newShape);
    
    const pos2d = geometry2d.attributes.position;
    
    for (let i = 0; i < pos2d.count; i++) {
      const x = pos2d.getX(i);
      const y = pos2d.getY(i);
      const z = pos2d.getZ(i);
      
      const v3d = right.clone().multiplyScalar(x).addScaledVector(up, y); // Z bileşeni artık normal eksen üzerinde
      v3d.addScaledVector(normal, plane.distanceToPoint(v3d)); // Düzleme geri yansıtma
      
      const newVertexKey = `${v3d.x.toFixed(6)}_${v3d.y.toFixed(6)}_${v3d.z.toFixed(6)}`;

      let newVertexIndex = vertexToNewIndex.get(newVertexKey);
      if (newVertexIndex === undefined) {
        newPositions.push(v3d.x, v3d.y, v3d.z);
        newVertexIndex = newIndexCounter++;
        vertexToNewIndex.set(newVertexKey, newVertexIndex);
      }
    }
    
    for(let i = 0; i < geometry2d.index.count; i++) {
        const oldIndex = geometry2d.index.getX(i);
        const v3d = right.clone().multiplyScalar(pos2d.getX(oldIndex)).addScaledVector(up, pos2d.getY(oldIndex));
        const newVertexKey = `${v3d.x.toFixed(6)}_${v3d.y.toFixed(6)}_${v3d.z.toFixed(6)}`;
        newIndices.push(vertexToNewIndex.get(newVertexKey));
    }
    
    mergedFaceCount++;
  });

  console.log(`🎯 ${coplanarGroups.length} grup, ${mergedFaceCount} basitleştirilmiş yüzeyde birleştirildi.`);

  const mergedGeometry = new THREE.BufferGeometry();
  mergedGeometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(newPositions), 3));
  mergedGeometry.setIndex(new THREE.BufferAttribute(new Uint32Array(newIndices), 1));
  
  mergedGeometry.computeVertexNormals();
  mergedGeometry.computeBoundingBox();
  mergedGeometry.computeBoundingSphere();
  
  return mergedGeometry;
}


// Dummy data and types to make the code runnable without external files
const Shape = {};
const Vector3 = THREE.Vector3;
const Matrix4 = THREE.Matrix4;

// Doğru bounding box hesaplama (rotation/scale destekli)
const getShapeBounds = (shape) => {
  const geometry = shape.geometry;
  geometry.computeBoundingBox();
  const bbox = geometry.boundingBox.clone(); // local bbox

  const pos = new THREE.Vector3(...(shape.position || [0, 0, 0]));
  const scale = new THREE.Vector3(...(shape.scale || [1, 1, 1]));
  // shape.rotation olabilir; eğer yoksa 0,0,0 al
  const rot = shape.rotation ? new THREE.Euler(...shape.rotation) : new THREE.Euler(0, 0, 0);
  const quat = new THREE.Quaternion().setFromEuler(rot);

  const m = new THREE.Matrix4().compose(pos, quat, scale);
  bbox.applyMatrix4(m); // bbox'ı world/shape-space'e dönüştür

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
  console.log(`🎯 Şekil için kesişimleri bulunuyor: ${selectedShape.type} (${selectedShape.id})`);
  
  const selectedBounds = getShapeBounds(selectedShape);
  console.log(`🎯 Seçilen şekil sınırları:`, {
    min: [selectedBounds.min.x.toFixed(1), selectedBounds.min.y.toFixed(1), selectedBounds.min.z.toFixed(1)],
    max: [selectedBounds.max.x.toFixed(1), selectedBounds.max.y.toFixed(1), selectedBounds.max.z.toFixed(1)]
  });
  
  const intersectingShapes = allShapes.filter(shape => {
    if (shape.id === selectedShape.id) return false;
    
    const shapeBounds = getShapeBounds(shape);
    const intersects = boundsIntersect(selectedBounds, shapeBounds);
    
    if (intersects) {
      console.log(`✅ Kesişim bulundu: ${selectedShape.type} (${selectedShape.id}) ile ${shape.type} (${shape.id})`);
      console.log(`🎯 Hedef şekil sınırları:`, {
        min: [shapeBounds.min.x.toFixed(1), shapeBounds.min.y.toFixed(1), shapeBounds.min.z.toFixed(1)],
        max: [shapeBounds.max.x.toFixed(1), shapeBounds.max.y.toFixed(1), shapeBounds.max.z.toFixed(1)]
      });
    }
    
    return intersects;
  });
  
  console.log(`🎯 ${intersectingShapes.length} adet kesişen şekil bulundu.`);
  return intersectingShapes;
};

// Create brush from shape with proper transforms
const createBrushFromShape = (shape) => {
  const brush = new Brush(shape.geometry.clone());
  
  // Apply transforms
  brush.position.fromArray(shape.position || [0, 0, 0]);
  brush.scale.fromArray(shape.scale || [1, 1, 1]);
  
  if (shape.rotation) {
    const euler = new THREE.Euler(...shape.rotation);
    brush.quaternion.setFromEuler(euler);
  }
  
  // CRITICAL: Update matrix world
  brush.updateMatrixWorld(true);
  
  console.log(`🎯 Fırça (brush) oluşturuldu:`, {
    position: brush.position.toArray().map(v => v.toFixed(1)),
    scale: brush.scale.toArray().map(v => v.toFixed(1)),
    rotation: shape.rotation?.map(v => (v * 180 / Math.PI).toFixed(1)) || [0, 0, 0]
  });
  
  return brush;
};

// Perform boolean subtract operation with three-bvh-csg
export const performBooleanSubtract = (
  selectedShape,
  allShapes,
  updateShape,
  deleteShape
) => {
  console.log('🎯 ===== BOOLEAN ÇIKARMA İŞLEMİ BAŞLATILDI (CSG) =====');
  console.log(`🎯 Çıkarma işlemi için seçilen şekil: ${selectedShape.type} (${selectedShape.id})`);
  
  // Kesişen şekilleri bul
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ Çıkarma işlemi için kesişen şekil bulunamadı.');
    return false;
  }
  
  console.log(`🎯 ${intersectingShapes.length} adet kesişen şekil ile çıkarma işlemi yapılıyor (CSG).`);
  
  const evaluator = new Evaluator();
  
  try {
    // Kesişen her bir şekli işle
    intersectingShapes.forEach((targetShape, index) => {
      console.log(`🎯 Çıkarma işlemi ${index + 1}/${intersectingShapes.length}: ${targetShape.type} (${targetShape.id})`);
      
      // Fırçaları oluştur
      const selectedBrush = createBrushFromShape(selectedShape);
      const targetBrush = createBrushFromShape(targetShape);
      
      console.log('🎯 CSG çıkarma işlemi uygulanıyor...');
      
      // A - B (çıkarma)
      const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, SUBTRACTION);
      
      if (!resultMesh || !resultMesh.geometry || resultMesh.geometry.attributes.position.count === 0) {
        console.error('❌ CSG çıkarma işlemi başarısız oldu veya boş geometri döndü. İşlem iptal edildi.');
        return;
      }
      
      resultMesh.updateMatrixWorld(true);
      
      console.log('✅ CSG çıkarma işlemi tamamlandı, sonuç yerel alana dönüştürülüyor...');
      
      // Sonuç geometrisini hedef şeklin YEREL alanına geri dönüştür
      const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
      let newGeom = resultMesh.geometry.clone();
      newGeom.applyMatrix4(invTarget);
      
      // 🎯 GELİŞTİRİLMİŞ CSG TEMİZLEME - Gelişmiş geometri temizleme
      console.log('🎯 Çıkarma sonucuna gelişmiş CSG temizleme uygulanıyor...');
      newGeom = cleanCSGGeometry(newGeom, 0.05);
      newGeom = mergeCoplanarFaces(newGeom, 0.05); // Yüzeyleri birleştir
      
      // Eski geometriyi temizle
      try {  
        targetShape.geometry.dispose();  
      } catch (e) {  
        console.warn('Eski geometri temizlenemedi:', e);
      }
      
      // Hedef şekli güncelle
      updateShape(targetShape.id, {
        geometry: newGeom,
        parameters: {
          ...targetShape.parameters,
          booleanOperation: 'subtract',
          subtractedShapeId: selectedShape.id,
          lastModified: Date.now(),
        }
      });
      
      console.log(`✅ Hedef şekil ${targetShape.id}, CSG sonucuyla güncellendi.`);
    });
    
    // Seçilen şekli sil (çıkarılacak olan)
    deleteShape(selectedShape.id);
    console.log(`🗑️ Çıkarılan şekil silindi: ${selectedShape.id}`);
    
    console.log(`✅ ===== BOOLEAN ÇIKARMA İŞLEMİ BAŞARIYLA TAMAMLANDI (CSG) =====`);
    console.log(`📊 Özet: ${intersectingShapes.length} şekil CSG ile düzenlendi, 1 şekil silindi.`);
    
    return true;
    
  } catch (error) {
    console.error('❌ ===== BOOLEAN ÇIKARMA İŞLEMİ BAŞARISIZ OLDU (CSG) =====');
    console.error('CSG Hata detayları:', error);
    return false;
  }
};

// Perform boolean union operation with three-bvh-csg
export const performBooleanUnion = (
  selectedShape,
  allShapes,
  updateShape,
  deleteShape
) => {
  console.log('🎯 ===== BOOLEAN BİRLEŞTİRME İŞLEMİ BAŞLATILDI (CSG) =====');
  console.log(`🎯 Birleştirme işlemi için seçilen şekil: ${selectedShape.type} (${selectedShape.id})`);
  
  // Kesişen şekilleri bul
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ Birleştirme işlemi için kesişen şekil bulunamadı.');
    return false;
  }
  
  console.log(`🎯 ${intersectingShapes.length} adet kesişen şekil ile birleştirme işlemi yapılıyor (CSG).`);
  
  const evaluator = new Evaluator();
  
  try {
    // Birleştirme için, ilk kesişen şekil ile birleştir
    const targetShape = intersectingShapes[0];
    
    console.log(`🎯 Birleştirme hedefi: ${targetShape.type} (${targetShape.id})`);
    
    // Fırçaları oluştur
    const selectedBrush = createBrushFromShape(selectedShape);
    const targetBrush = createBrushFromShape(targetShape);
    
    console.log('🎯 CSG birleştirme işlemi uygulanıyor...');
    
    // A + B (birleştirme)
    const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, ADDITION);
    
    if (!resultMesh || !resultMesh.geometry || resultMesh.geometry.attributes.position.count === 0) {
      console.error('❌ CSG birleştirme işlemi başarısız oldu veya boş geometri döndü. İşlem iptal edildi.');
      return false;
    }
    
    resultMesh.updateMatrixWorld(true);
    
    console.log('✅ CSG birleştirme işlemi tamamlandı, sonuç yerel alana dönüştürülüyor...');
    
    // Sonuç geometrisini hedef şeklin YEREL alanına geri dönüştür
    const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
    let newGeom = resultMesh.geometry.clone();
    newGeom.applyMatrix4(invTarget);
    
    // 🎯 GELİŞTİRİLMİŞ CSG TEMİZLEME - Gelişmiş geometri temizleme
    console.log('🎯 Birleştirme sonucuna gelişmiş CSG temizleme uygulanıyor...');
    newGeom = cleanCSGGeometry(newGeom, 0.05); // Yüksek tolerans değeri ile daha iyi kaynaklama
    newGeom = mergeCoplanarFaces(newGeom, 0.05); // Yüzeyleri birleştir
    
    // Eski geometriyi temizle
    try {  
      targetShape.geometry.dispose();  
    } catch (e) {  
      console.warn('Eski geometri temizlenemedi:', e);
    }
    
    // Hedef şekli güncelle
    updateShape(targetShape.id, {
      geometry: newGeom,
      parameters: {
        ...targetShape.parameters,
        booleanOperation: 'union',
        unionedShapeId: selectedShape.id,
        lastModified: Date.now()
      }
    });
    
    console.log(`✅ Hedef şekil ${targetShape.id}, birleştirme geometrisiyle güncellendi.`);
    
    // Seçilen şekli sil (artık birleştirildiği için)
    deleteShape(selectedShape.id);
    console.log(`🗑️ Birleştirilen şekil silindi: ${selectedShape.id}`);
    
    console.log(`✅ ===== BOOLEAN BİRLEŞTİRME İŞLEMİ BAŞARIYLA TAMAMLANDI (CSG) =====`);
    return true;
    
  } catch (error) {
    console.error('❌ ===== BOOLEAN BİRLEŞTİRME İŞLEMİ BAŞARISIZ OLDU (CSG) =====');
    console.error('CSG Hata detayları:', error);
    return false;
  }
};
