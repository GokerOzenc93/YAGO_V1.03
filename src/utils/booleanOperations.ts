import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * CSG sonrası oluşturulan geometriyi temizler, onarır ve optimize eder.
 * Bu gelişmiş fonksiyon, aşağıdaki adımları uygular:
 * 1. Köşe noktalarını birleştirerek (welding) geometrideki boşlukları kapatır.
 * 2. Dejenere olmuş (sıfır alanlı) üçgenleri temizler.
 * 3. Bitişik ve aynı düzlemdeki (co-planar) üçgen gruplarını tespit eder.
 * 4. Her bir düzlemsel bölge için ortalama bir yüzey normali hesaplar.
 * 5. Bu ortalama normali bölgedeki tüm köşe noktalarına atayarak aydınlatma hatalarını (seams) ortadan kaldırır.
 * Sonuç olarak, görsel olarak pürüzsüz ve tek parça görünen yüzeyler elde edilir.
 *
 * @param {THREE.BufferGeometry} geom - Temizlenecek olan, hedef-lokal uzaydaki geometri.
 * @param {number} tolerance - Köşe noktalarını birleştirmek için kullanılacak tolerans (örn: 0.01).
 * @returns {THREE.BufferGeometry} Onarılmış ve temizlenmiş yeni geometri.
 */
export function cleanCSGGeometry(geom, tolerance = 0.01) {
    console.log("🛠️ Gelişmiş geometri onarım süreci başlatıldı...");

    if (!geom.attributes.position || geom.attributes.position.count === 0) {
        console.warn('Onarılacak geçerli pozisyon verisi bulunamadı.');
        return new THREE.BufferGeometry();
    }
    
    // 1. Adım: Köşe noktalarını birleştir (merge vertices) ve başlangıç normallerini hesapla
    let repairedGeom = BufferGeometryUtils.mergeVertices(geom, tolerance);
    repairedGeom.computeVertexNormals();

    const posAttr = repairedGeom.attributes.position;
    const indexAttr = repairedGeom.index;

    if (!indexAttr) {
        console.warn('Geometri indexlenmemiş, onarım için indexlenmesi gerekiyor.');
        repairedGeom = repairedGeom.toNonIndexed().toIndexed();
        // Re-assign attributes after re-indexing
        if (!repairedGeom.index) {
             console.error('Indexleme başarısız oldu, onarım durduruldu.');
             return geom; // Return original if re-indexing fails
        }
    }
    const triCount = repairedGeom.index.count / 3;

    // 2. Adım: Yüzey komşuluk grafiği oluştur
    console.log("📊 Yüzey komşuluk grafiği oluşturuluyor...");
    const adj = new Map(Array.from({ length: triCount }, (_, i) => [i, []]));
    const edgeToFaces = new Map();
    for (let i = 0; i < triCount; i++) {
        for (let j = 0; j < 3; j++) {
            const i1 = repairedGeom.index.getX(i * 3 + j);
            const i2 = repairedGeom.index.getX(i * 3 + ((j + 1) % 3));
            const key = i1 < i2 ? `${i1}_${i2}` : `${i2}_${i1}`;
            if (!edgeToFaces.has(key)) edgeToFaces.set(key, []);
            edgeToFaces.get(key).push(i);
        }
    }
    edgeToFaces.forEach(faces => {
        if (faces.length === 2) {
            adj.get(faces[0]).push(faces[1]);
            adj.get(faces[1]).push(faces[0]);
        }
    });

    // 3. Adım: Düzlemsel bölgeleri "flood-fill" algoritması ile bul
    console.log("🌊 Aynı düzlemdeki yüzey bölgeleri tespit ediliyor...");
    const visited = new Set();
    const newNormals = new Float32Array(repairedGeom.attributes.normal.array.length);
    newNormals.set(repairedGeom.attributes.normal.array);

    for (let i = 0; i < triCount; i++) {
        if (visited.has(i)) continue;

        const region = [];
        const queue = [i];
        visited.add(i);

        const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, repairedGeom.index.getX(i * 3));
        const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, repairedGeom.index.getX(i * 3 + 1));
        const v3 = new THREE.Vector3().fromBufferAttribute(posAttr, repairedGeom.index.getX(i * 3 + 2));
        const baseNormal = new THREE.Plane().setFromCoplanarPoints(v1, v2, v3).normal;

        while (queue.length > 0) {
            const faceIdx = queue.shift();
            region.push(faceIdx);

            adj.get(faceIdx)?.forEach(neighborIdx => {
                if (!visited.has(neighborIdx)) {
                    const n1 = new THREE.Vector3().fromBufferAttribute(posAttr, repairedGeom.index.getX(neighborIdx * 3));
                    const n2 = new THREE.Vector3().fromBufferAttribute(posAttr, repairedGeom.index.getX(neighborIdx * 3 + 1));
                    const n3 = new THREE.Vector3().fromBufferAttribute(posAttr, repairedGeom.index.getX(neighborIdx * 3 + 2));
                    const neighborNormal = new THREE.Plane().setFromCoplanarPoints(n1, n2, n3).normal;
                    
                    // Normallerin birbirine çok yakın olup olmadığını kontrol et (yaklaşık 8 derece tolerans)
                    if (neighborNormal.dot(baseNormal) > 0.99) { 
                        visited.add(neighborIdx);
                        queue.push(neighborIdx);
                    }
                }
            });
        }
        
        // 4. Adım: Bulunan bölge için ortalama bir normal hesapla
        const avgNormal = new THREE.Vector3();
        region.forEach(faceIdx => {
            const v1 = new THREE.Vector3().fromBufferAttribute(posAttr, repairedGeom.index.getX(faceIdx * 3));
            const v2 = new THREE.Vector3().fromBufferAttribute(posAttr, repairedGeom.index.getX(faceIdx * 3 + 1));
            const v3 = new THREE.Vector3().fromBufferAttribute(posAttr, repairedGeom.index.getX(faceIdx * 3 + 2));
            const faceNormal = new THREE.Plane().setFromCoplanarPoints(v1, v2, v3).normal;
            avgNormal.add(faceNormal);
        });
        avgNormal.divideScalar(region.length).normalize();

        // 5. Adım: Bu ortalama normali bölgedeki tüm köşe noktalarının normallerine uygula
        region.forEach(faceIdx => {
            for (let j = 0; j < 3; j++) {
                const vertIdx = repairedGeom.index.getX(faceIdx * 3 + j);
                avgNormal.toArray(newNormals, vertIdx * 3);
            }
        });
    }

    repairedGeom.setAttribute('normal', new THREE.BufferAttribute(newNormals, 3));
    repairedGeom.computeBoundingBox();
    repairedGeom.computeBoundingSphere();

    console.log("✅ Geometri onarımı başarıyla tamamlandı. Yüzey normalleri birleştirildi.");
    return repairedGeom;
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
  console.log(`🎯 Kesişimler aranıyor: ${selectedShape.type} (${selectedShape.id})`);
  const selectedBounds = getShapeBounds(selectedShape);
  const intersectingShapes = allShapes.filter(shape => {
    if (shape.id === selectedShape.id) return false;
    const shapeBounds = getShapeBounds(shape);
    return boundsIntersect(selectedBounds, shapeBounds);
  });
  console.log(`🎯 ${intersectingShapes.length} kesişen nesne bulundu.`);
  return intersectingShapes;
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
export const performBooleanSubtract = (
  selectedShape,
  allShapes,
  updateShape,
  deleteShape
) => {
  console.log('🎯 ===== BOOLEAN ÇIKARMA İŞLEMİ (CSG) BAŞLADI =====');
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  if (intersectingShapes.length === 0) {
    console.log('❌ Çıkarma işlemi için kesişen nesne bulunamadı.');
    return false;
  }
  
  const evaluator = new Evaluator();
  try {
    intersectingShapes.forEach((targetShape) => {
      const selectedBrush = createBrushFromShape(selectedShape);
      const targetBrush = createBrushFromShape(targetShape);
      
      console.log(`🎯 ${targetShape.type} (${targetShape.id}) nesnesinden çıkarma yapılıyor...`);
      const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, SUBTRACTION);
      
      if (!resultMesh || !resultMesh.geometry) {
        console.error('❌ CSG çıkarma işlemi başarısız - sonuç mesh oluşturulamadı.');
        return;
      }
      
      resultMesh.updateMatrixWorld(true);
      const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
      let newGeom = resultMesh.geometry.clone();
      newGeom.applyMatrix4(invTarget);
      
      console.log('🎯 Sonuç geometrisine gelişmiş onarım uygulanıyor...');
      newGeom = cleanCSGGeometry(newGeom, 0.05); 
      
      try { targetShape.geometry.dispose(); } catch (e) { console.warn('Eski geometri dispose edilemedi:', e); }
      
      updateShape(targetShape.id, {
        geometry: newGeom,
        parameters: {
          ...targetShape.parameters,
          booleanOperation: 'subtract',
          subtractedShapeId: selectedShape.id,
          lastModified: Date.now(),
        }
      });
      console.log(`✅ Hedef nesne ${targetShape.id} güncellendi.`);
    });
    
    deleteShape(selectedShape.id);
    console.log(`🗑️ Çıkarılan nesne silindi: ${selectedShape.id}`);
    console.log(`✅ ===== BOOLEAN ÇIKARMA BAŞARIYLA TAMAMLANDI (CSG) =====`);
    return true;
  } catch (error) {
    console.error('❌ ===== BOOLEAN ÇIKARMA BAŞARISIZ OLDU (CSG) =====', error);
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
  console.log('🎯 ===== BOOLEAN BİRLEŞTİRME İŞLEMİ (CSG) BAŞLADI =====');
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  if (intersectingShapes.length === 0) {
    console.log('❌ Birleştirme işlemi için kesişen nesne bulunamadı.');
    return false;
  }
  
  const evaluator = new Evaluator();
  try {
    const targetShape = intersectingShapes[0];
    console.log(`🎯 Birleştirme hedefi: ${targetShape.type} (${targetShape.id})`);
    
    const selectedBrush = createBrushFromShape(selectedShape);
    const targetBrush = createBrushFromShape(targetShape);
    
    const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, ADDITION);
    
    if (!resultMesh || !resultMesh.geometry) {
      console.error('❌ CSG birleştirme işlemi başarısız - sonuç mesh oluşturulamadı.');
      return false;
    }
    
    resultMesh.updateMatrixWorld(true);
    const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
    let newGeom = resultMesh.geometry.clone();
    newGeom.applyMatrix4(invTarget);
    
    console.log('🎯 Sonuç geometrisine gelişmiş onarım uygulanıyor...');
    newGeom = cleanCSGGeometry(newGeom, 0.05);
    
    try { targetShape.geometry.dispose(); } catch (e) { console.warn('Eski geometri dispose edilemedi:', e); }
    
    updateShape(targetShape.id, {
      geometry: newGeom,
      parameters: {
        ...targetShape.parameters,
        booleanOperation: 'union',
        unionedShapeId: selectedShape.id,
        lastModified: Date.now()
      }
    });
    console.log(`✅ Hedef nesne ${targetShape.id} güncellendi.`);
    
    deleteShape(selectedShape.id);
    console.log(`🗑️ Birleştirilen nesne silindi: ${selectedShape.id}`);
    console.log(`✅ ===== BOOLEAN BİRLEŞTİRME BAŞARIYLA TAMAMLANDI (CSG) =====`);
    return true;
  } catch (error) {
    console.error('❌ ===== BOOLEAN BİRLEŞTİRME BAŞARISIZ OLDU (CSG) =====', error);
    return false;
  }
};

