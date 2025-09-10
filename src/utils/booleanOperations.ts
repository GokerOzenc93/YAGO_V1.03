import * as THREE from 'three';
import { Brush, Evaluator, SUBTRACTION, ADDITION } from 'three-bvh-csg';
// Hata düzeltmesi: Optimizasyon için doğru modülleri (Encoder ve Simplifier) içe aktarıyoruz.
import { MeshoptEncoder, MeshoptSimplifier } from 'meshoptimizer';

// Meshoptimizer, WebAssembly kullandığı için başlamadan önce hazır olmasını beklemeliyiz.
// Bu promise, kütüphanenin hazır olduğunu garanti eder.
const meshoptimizerReady = MeshoptEncoder.ready;

/**
 * Clean and optimize CSG-generated geometry using Meshoptimizer.
 * This function performs vertex welding, simplification, and performance optimization.
 *
 * @param {THREE.BufferGeometry} geom - The raw geometry from the CSG operation.
 * @returns {Promise<THREE.BufferGeometry>} A promise that resolves to the cleaned and optimized geometry.
 */
export async function cleanCSGGeometry(geom) {
  // Kütüphanenin WASM modülünün yüklenmesini bekle
  await meshoptimizerReady;

  console.log(`🚀 Starting geometry cleanup with Meshoptimizer...`);
  const originalVertexCount = geom.attributes.position.count;

  // 1. Meshoptimizer'ın anlayacağı formatlara veriyi dönüştür
  const vertices = geom.attributes.position.array as Float32Array;
  // Meshoptimizer index'li geometri ile çalışır. Eğer yoksa, oluştur.
  let indices = geom.index ? geom.index.array : new Uint32Array(vertices.length / 3);
  if (!geom.index) {
    for (let i = 0; i < indices.length; i++) indices[i] = i;
  }
  
  // Veri tiplerinin doğru olduğundan emin ol
  if (!(indices instanceof Uint32Array)) indices = new Uint32Array(indices);

  // --- Meshoptimizer Optimizasyon Adımları ---

  // Adım 2: Vertex'leri Kaynakla (Weld)
  // Birbirine çok yakın vertex'leri bularak geometriyi yeniden index'ler.
  const remap = new Uint32Array(vertices.length / 3);
  const uniqueVertexCount = MeshoptEncoder.generateVertexRemap(remap, indices, vertices, 3, Float32Array.BYTES_PER_ELEMENT);
  
  const remappedIndices = new Uint32Array(indices.length);
  const remappedVertices = new Float32Array(uniqueVertexCount * 3);
  
  MeshoptEncoder.remapIndexBuffer(remappedIndices, indices, remap);
  MeshoptEncoder.remapVertexBuffer(remappedVertices, vertices, remap, 3, Float32Array.BYTES_PER_ELEMENT);

  // Adım 3: Yüzeyi İyileştir ve Basitleştir 🧚‍♀️
  // "Bozuk vertex" görünümüne neden olan küçük, gereksiz üçgenleri hedefler.
  // %25'lik bir azaltma oranı, yüzeyi temizlerken ana formu korur.
  const targetTriangleCount = Math.floor((remappedIndices.length / 3) * 0.75);
  const simplificationError = 0.02; // Detay kaybını önlemek için hata payı

  const simplifiedIndices = new Uint32Array(targetTriangleCount * 3);
  const simplifiedCount = MeshoptSimplifier.simplify(
    simplifiedIndices, remappedIndices, remappedVertices, 3, targetTriangleCount, simplificationError
  );

  // Adım 4: Rendering Performansı için Optimize Et
  // GPU'nun verimli çalışması için index'leri yeniden sıralar.
  let finalIndices = simplifiedIndices.slice(0, simplifiedCount);
  // HATA DÜZELTMESİ: Doğru modül olan MeshoptEncoder'ı kullanıyoruz.
  MeshoptEncoder.optimizeVertexCache(finalIndices, finalIndices, uniqueVertexCount);

  // 5. Optimize edilmiş verilerle yeni bir Three.js geometrisi oluştur
  const finalGeom = new THREE.BufferGeometry();
  finalGeom.setAttribute('position', new THREE.BufferAttribute(remappedVertices, 3));
  finalGeom.setIndex(new THREE.BufferAttribute(finalIndices, 1));
  finalGeom.computeVertexNormals();
  finalGeom.computeBoundingBox();
  finalGeom.computeBoundingSphere();
  
  console.log(`✅ Meshoptimizer cleanup complete:`, {
    originalVertices: originalVertexCount,
    finalVertices: finalGeom.attributes.position.count,
    vertexReduction: `${(((originalVertexCount - finalGeom.attributes.position.count) / originalVertexCount) * 100).toFixed(1)}%`
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
  console.log(`🎯 Finding intersections for shape: ${selectedShape.type} (${selectedShape.id})`);
  
  const selectedBounds = getShapeBounds(selectedShape);
  
  const intersectingShapes = allShapes.filter(shape => {
    if (shape.id === selectedShape.id) return false;
    
    const shapeBounds = getShapeBounds(shape);
    const intersects = boundsIntersect(selectedBounds, shapeBounds);
    
    return intersects;
  });
  
  console.log(`🎯 Found ${intersectingShapes.length} intersecting shapes`);
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
  console.log('🎯 ===== BOOLEAN SUBTRACT OPERATION STARTED (CSG) =====');
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ No intersecting shapes found for subtract operation');
    return false;
  }
  
  const evaluator = new Evaluator();
  
  try {
    // forEach async/await ile iyi çalışmaz, bu yüzden for...of döngüsü kullanıyoruz.
    for (const targetShape of intersectingShapes) {
      console.log(`🎯 Subtract operation on: ${targetShape.type} (${targetShape.id})`);
      
      const selectedBrush = createBrushFromShape(selectedShape);
      const targetBrush = createBrushFromShape(targetShape);
      
      const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, SUBTRACTION);
      
      if (!resultMesh || !resultMesh.geometry || resultMesh.geometry.attributes.position.count === 0) {
        console.error('❌ CSG subtraction resulted in an empty mesh. Skipping this shape.');
        continue; // Sonraki shape ile devam et
      }
      
      resultMesh.updateMatrixWorld(true);
      
      const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
      let newGeom = resultMesh.geometry.clone();
      newGeom.applyMatrix4(invTarget);
      
      console.log('🎯 Applying Meshoptimizer cleanup to subtraction result...');
      newGeom = await cleanCSGGeometry(newGeom); // 'await' ile bekliyoruz
      
      if (!newGeom || !newGeom.attributes.position || newGeom.attributes.position.count === 0) {
          console.error(`❌ Cleanup resulted in an empty geometry for target shape ${targetShape.id}. Aborting update.`);
          continue;
      }
      
      try { targetShape.geometry.dispose(); } catch (e) { console.warn('Could not dispose old geometry:', e); }
      
      updateShape(targetShape.id, {
        geometry: newGeom,
        parameters: { ...targetShape.parameters, booleanOperation: 'subtract' }
      });
      console.log(`✅ Target shape ${targetShape.id} updated with CSG result`);
    }
    
    deleteShape(selectedShape.id);
    console.log(`🗑️ Subtracted shape deleted: ${selectedShape.id}`);
    console.log(`✅ ===== BOOLEAN SUBTRACT COMPLETED SUCCESSFULLY (CSG) =====`);
    return true;
    
  } catch (error) {
    console.error('❌ ===== BOOLEAN SUBTRACT FAILED (CSG) =====', error);
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
  console.log('🎯 ===== BOOLEAN UNION OPERATION STARTED (CSG) =====');
  const intersectingShapes = findIntersectingShapes(selectedShape, allShapes);
  
  if (intersectingShapes.length === 0) {
    console.log('❌ No intersecting shapes found for union operation');
    return false;
  }
  
  const evaluator = new Evaluator();
  
  try {
    const targetShape = intersectingShapes[0];
    
    const selectedBrush = createBrushFromShape(selectedShape);
    const targetBrush = createBrushFromShape(targetShape);
    
    const resultMesh = evaluator.evaluate(targetBrush, selectedBrush, ADDITION);
    
    if (!resultMesh || !resultMesh.geometry || resultMesh.geometry.attributes.position.count === 0) {
      console.error('❌ CSG union resulted in an empty mesh. Aborting.');
      return false;
    }
    
    resultMesh.updateMatrixWorld(true);
    
    const invTarget = new THREE.Matrix4().copy(targetBrush.matrixWorld).invert();
    let newGeom = resultMesh.geometry.clone();
    newGeom.applyMatrix4(invTarget);
    
    console.log('🎯 Applying Meshoptimizer cleanup to union result...');
    newGeom = await cleanCSGGeometry(newGeom); // 'await' ile bekliyoruz

    if (!newGeom || !newGeom.attributes.position || newGeom.attributes.position.count === 0) {
        console.error(`❌ Cleanup resulted in an empty geometry for union operation. Aborting update.`);
        return false;
    }
    
    try { targetShape.geometry.dispose(); } catch (e) { console.warn('Could not dispose old geometry:', e); }
    
    updateShape(targetShape.id, {
      geometry: newGeom,
      parameters: { ...targetShape.parameters, booleanOperation: 'union' }
    });
    
    deleteShape(selectedShape.id);
    console.log(`🗑️ Merged shape deleted: ${selectedShape.id}`);
    console.log(`✅ ===== BOOLEAN UNION COMPLETED SUCCESSFULLY (CSG) =====`);
    return true;
    
  } catch (error) {
    console.error('❌ ===== BOOLEAN UNION FAILED (CSG) =====', error);
    return false;
  }
};

