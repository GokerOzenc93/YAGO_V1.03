import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
// Güçlü onarım ve optimizasyon için GEREKLİ meshoptimizer modüllerini içe aktarıyoruz.
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

// Meshoptimizer, WebAssembly kullandığı için başlamadan önce hazır olmasını beklemeliyiz.
// Bu promise, kütüphanenin hazır olduğunu garanti eder ve sadece bir kez çalışır.
const meshoptimizerReady = MeshoptEncoder.ready;

/**
 * Boolean (CSG) işlemleri sonrası oluşan geometriyi Meshoptimizer ile temizler,
 * onarır ve optimize eder. Bu fonksiyon, "bozuk vertex" sorunlarını gidererek
 * işlem gören yüzeylerin tek parça ve seçilebilir olmasını hedefler.
 * * @param geom - CSG işlemi sonucu ortaya çıkan ham geometri.
 * @returns Temizlenmiş ve optimize edilmiş geometriyi içeren bir Promise.
 */
export async function cleanCSGGeometry(geom) {
  await meshoptimizerReady;

  console.log(`🦾 Meshoptimizer ile geometri onarımı ve optimizasyonu başlıyor...`);
  
  if (!geom.attributes.position || geom.attributes.position.count === 0) {
    console.warn('Geçersiz veya boş geometri, işlem atlanıyor.');
    return new THREE.BufferGeometry();
  }

  const originalVertexCount = geom.attributes.position.count;
  const originalTriangleCount = geom.index ? geom.index.count / 3 : originalVertexCount / 3;

  // Adım 1: Meshoptimizer için veriyi hazırla.
  const vertices = geom.attributes.position.array as Float32Array;
  let indices = geom.index ? geom.index.array : null;

  if (!indices) {
    // Eğer geometri non-indexed ise, index'leri oluştur.
    indices = new Uint32Array(vertices.length / 3);
    for (let i = 0; i < indices.length; i++) indices[i] = i;
  }
  
  // Veri tiplerinin meshoptimizer için uygun olduğundan emin ol.
  if (!(indices instanceof Uint32Array)) {
    indices = new Uint32Array(indices);
  }

  // --- Meshoptimizer Onarım ve Optimizasyon Pipeline ---

  // Adım 2: Vertex Kaynaklama (Welding) 🛠️
  // Birbirine çok yakın olan veya aynı pozisyondaki kopya vertex'leri birleştirir.
  const remap = new Uint32Array(vertices.length / 3);
  const uniqueVertexCount = MeshoptEncoder.generateVertexRemap(remap, indices, vertices, 3, Float32Array.BYTES_PER_ELEMENT);
  
  const remappedIndices = new Uint32Array(indices.length);
  MeshoptEncoder.remapIndexBuffer(remappedIndices, indices, remap);
  
  const remappedVertices = new Float32Array(uniqueVertexCount * 3);
  MeshoptEncoder.remapVertexBuffer(remappedVertices, vertices, remap, 3, Float32Array.BYTES_PER_ELEMENT);

  // Adım 3: Yüzeyleri Tek Parça Haline Getirme (Simplification) ✨
  // Bu adım, işlem gören yüzeylerdeki küçük ve gereksiz üçgenleri (face'leri)
  // birleştirerek daha büyük ve tek parça yüzeyler oluşturur.
  const targetTriangleCount = Math.floor((remappedIndices.length / 3) * 0.85); // %15 azaltma
  const simplificationError = 0.01; // Detay kaybını minimize etmek için hata payı

  const simplifiedIndicesResult = MeshoptSimplifier.simplify(
    remappedIndices,
    remappedVertices,
    3,
    targetTriangleCount,
    simplificationError
  );
  
  // Adım 4: GPU Performansı için Optimizasyon 🚀
  let finalIndices = simplifiedIndicesResult.slice(0); // Make a copy
  MeshoptEncoder.optimizeVertexCache(finalIndices, finalIndices, uniqueVertexCount);

  // Adım 5: Sonuç Geometrisini Oluştur
  const finalGeom = new THREE.BufferGeometry();
  finalGeom.setAttribute('position', new THREE.BufferAttribute(remappedVertices, 3));
  finalGeom.setIndex(new THREE.BufferAttribute(finalIndices, 1));
  
  finalGeom.computeVertexNormals();
  finalGeom.computeBoundingBox();
  finalGeom.computeBoundingSphere();
  
  const finalVertexCount = finalGeom.attributes.position.count;
  const finalTriangleCount = finalGeom.index ? finalGeom.index.count / 3 : 0;
  
  console.log(`✅ Onarım tamamlandı:`, {
    "Orijinal Vertex": originalVertexCount,
    "Son Vertex": finalVertexCount,
    "Orijinal Üçgen": originalTriangleCount.toFixed(0),
    "Son Üçgen": finalTriangleCount.toFixed(0),
  });

  return finalGeom;
}

// Dummy data and types to make the code runnable without external files
const Shape = {};
const Vector3 = THREE.Vector3;
const Matrix4 = THREE.Matrix4;

// Doğru bounding box hesaplama (rotation/scale destekli)
const getShapeBounds = (shape) => {
  const geometry = shape.geometry;
  if (!geometry.boundingBox) { // Ensure bounding box exists
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

// cleanCSGGeometry asenkron olduğu için, bu fonksiyonlar da 'async' olmalı.
export const performBooleanSubtract = async (
  selectedShape,
  allShapes,
  updateShape,
  deleteShape
) => {
  console.log('🎯 ===== BOOLEAN ÇIKARMA İŞLEMİ BAŞLADI (CSG) =====');
  
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ Çıkarma işlemi için kesişen şekil bulunamadı');
    return false;
  }
  
  const evaluator = new Evaluator();
  
  try {
    // forEach async/await ile iyi çalışmaz, bu yüzden for...of döngüsü kullanıyoruz.
    for (const targetShape of intersectingShapes) {
      console.log(`🎯 Çıkarma işlemi uygulanıyor: ${targetShape.type} (${targetShape.id})`);
      
      const selectedBrush = createBrushFromShape(selectedShape);
      const targetBrush = createBrushFromShape(targetShape);
      
      const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, SUBTRACTION);
      
      if (!resultMesh || !resultMesh.geometry || resultMesh.geometry.attributes.position.count === 0) {
        console.error('❌ CSG çıkarma işlemi boş bir geometriyle sonuçlandı. Bu şekil atlanıyor.');
        continue;
      }
      
      resultMesh.updateMatrixWorld(true);
      
      const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
      let newGeom = resultMesh.geometry.clone();
      newGeom.applyMatrix4(invTarget);
      
      console.log('🎯 Meshoptimizer temizliği ve onarımı uygulanıyor...');
      newGeom = await cleanCSGGeometry(newGeom);
      
      if (!newGeom || !newGeom.attributes.position || newGeom.attributes.position.count === 0) {
          console.error(`❌ Onarım sonrası hedef şekilde boş geometri oluştu: ${targetShape.id}. Güncelleme iptal edildi.`);
          continue;
      }
      
      try { targetShape.geometry.dispose(); } catch (e) { console.warn('Eski geometri dispose edilemedi:', e); }
      
      updateShape(targetShape.id, {
        geometry: newGeom,
        parameters: {
          ...targetShape.parameters,
          booleanOperation: 'subtract',
          subtractedShapeId: selectedShape.id,
          lastModified: Date.now(),
        }
      });
      console.log(`✅ Hedef şekil ${targetShape.id} CSG sonucuyla güncellendi`);
    }
    
    deleteShape(selectedShape.id);
    console.log(`🗑️ Çıkarılan şekil silindi: ${selectedShape.id}`);
    
    console.log(`✅ ===== BOOLEAN ÇIKARMA İŞLEMİ BAŞARIYLA TAMAMLANDI (CSG) =====`);
    return true;
    
  } catch (error) {
    console.error('❌ ===== BOOLEAN ÇIKARMA İŞLEMİ BAŞARISIZ OLDU (CSG) =====', error);
    return false;
  }
};

// cleanCSGGeometry asenkron olduğu için, bu fonksiyon da 'async' olmalı.
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
    
    const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
    let newGeom = resultMesh.geometry.clone();
    newGeom.applyMatrix4(invTarget);
    
    console.log('🎯 Meshoptimizer temizliği ve onarımı uygulanıyor...');
    newGeom = await cleanCSGGeometry(newGeom);

    if (!newGeom || !newGeom.attributes.position || newGeom.attributes.position.count === 0) {
        console.error(`❌ Onarım sonrası birleştirme işleminde boş geometri oluştu. Güncelleme iptal edildi.`);
        return false;
    }
    
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
    
    console.log(`✅ Hedef şekil ${targetShape.id} birleştirme sonucuyla güncellendi`);
    
    deleteShape(selectedShape.id);
    console.log(`🗑️ Birleştirilen şekil silindi: ${selectedShape.id}`);
    
    console.log(`✅ ===== BOOLEAN BİRLEŞTİRME İŞLEMİ BAŞARIYLA TAMAMLANDI (CSG) =====`);
    return true;
    
  } catch (error) {
    console.error('❌ ===== BOOLEAN BİRLEŞTİRME İŞLEMİ BAŞARISIZ OLDU (CSG) =====', error);
    return false;
  }
};

