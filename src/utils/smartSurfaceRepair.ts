import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Akıllı Yüzey Onarımı - Smart Surface Repair
 * Parçalanmış yüzeyleri referans yüzeye göre birleştirir ve onarır
 */

interface RepairResult {
  repairedGeometry: THREE.BufferGeometry;
  repairedFaceCount: number;
  originalFaceCount: number;
}

/**
 * Face vertices'lerini al
 */
const getFaceVertices = (geometry: THREE.BufferGeometry, faceIndex: number): THREE.Vector3[] => {
  const pos = geometry.attributes.position;
  const index = geometry.index;
  
  if (!pos) return [];
  
  const vertices: THREE.Vector3[] = [];
  const a = faceIndex * 3;
  
  try {
    if (index) {
      for (let i = 0; i < 3; i++) {
        const vertexIndex = index.getX(a + i);
        const vertex = new THREE.Vector3().fromBufferAttribute(pos, vertexIndex);
        vertices.push(vertex);
      }
    } else {
      for (let i = 0; i < 3; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(pos, a + i);
        vertices.push(vertex);
      }
    }
  } catch (error) {
    console.warn('Error getting face vertices:', error);
    return [];
  }
  
  return vertices;
};

/**
 * Face normal'ını hesapla
 */
const getFaceNormal = (vertices: THREE.Vector3[]): THREE.Vector3 => {
  if (vertices.length < 3) return new THREE.Vector3(0, 1, 0);
  
  const v1 = new THREE.Vector3().subVectors(vertices[1], vertices[0]);
  const v2 = new THREE.Vector3().subVectors(vertices[2], vertices[0]);
  
  return new THREE.Vector3().crossVectors(v1, v2).normalize();
};

/**
 * Face center'ını hesapla
 */
const getFaceCenter = (vertices: THREE.Vector3[]): THREE.Vector3 => {
  const center = new THREE.Vector3();
  vertices.forEach(vertex => center.add(vertex));
  center.divideScalar(vertices.length);
  return center;
};

/**
 * Coplanar face'leri bul (aynı düzlemde olan yüzeyler)
 */
const findCoplanarFaces = (
  geometry: THREE.BufferGeometry, 
  referenceFaceIndex: number
): number[] => {
  console.log('🔍 Coplanar face\'ler aranıyor...');
  )
  
  const referenceVertices = getFaceVertices(geometry, referenceFaceIndex);
  if (referenceVertices.length === 0) return [];
  
  const referenceNormal = getFaceNormal(referenceVertices).normalize();
  const referenceCenter = getFaceCenter(referenceVertices);
  const referencePlane = new THREE.Plane().setFromNormalAndCoplanarPoint(referenceNormal, referenceCenter);
  
  const coplanarFaces: number[] = [referenceFaceIndex];
  const totalFaces = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
  
  // Toleranslar - mobilya panelleri için optimize edilmiş
  const NORMAL_TOLERANCE = THREE.MathUtils.degToRad(2); // 2° normal toleransı
  const PLANE_TOLERANCE = 1.0; // 1mm düzlem mesafesi toleransı
  
  for (let i = 0; i < totalFaces; i++) {
    if (i === referenceFaceIndex) continue;
    
    const vertices = getFaceVertices(geometry, i);
    if (vertices.length === 0) continue;
    
    const normal = getFaceNormal(vertices).normalize();
    const center = getFaceCenter(vertices);
    
    // Normal açısı kontrolü (iki yönü de kontrol et)
    const normalAngle = Math.min(
      normal.angleTo(referenceNormal),
      normal.angleTo(referenceNormal.clone().negate())
    );
    
    // Düzlem mesafesi kontrolü
    const distanceToPlane = Math.abs(referencePlane.distanceToPoint(center));
    
    // Coplanar kontrolü
    if (normalAngle < NORMAL_TOLERANCE && distanceToPlane < PLANE_TOLERANCE) {
      coplanarFaces.push(i);
    }
  }
  
  console.log(`✅ ${coplanarFaces.length} coplanar face bulundu`);
  return coplanarFaces;
};

/**
 * Coplanar face'lerin boundary'sini hesapla
 */
const calculateCoplanarBoundary = (
  geometry: THREE.BufferGeometry,
  coplanarFaces: number[]
): THREE.Vector3[] => {
  console.log('📐 Coplanar boundary hesaplanıyor...');
  
  // Tüm coplanar face'lerin edge'lerini topla
  const edgeMap = new Map<string, number>();
  
  coplanarFaces.forEach(faceIndex => {
    const vertices = getFaceVertices(geometry, faceIndex);
    if (vertices.length < 3) return;
    
    // Face'in edge'lerini ekle
    for (let i = 0; i < 3; i++) {
      const v1 = vertices[i];
      const v2 = vertices[(i + 1) % 3];
      
      // Edge key oluştur (küçük koordinat önce)
      const key1 = `${v1.x.toFixed(3)},${v1.y.toFixed(3)},${v1.z.toFixed(3)}`;
      const key2 = `${v2.x.toFixed(3)},${v2.y.toFixed(3)},${v2.z.toFixed(3)}`;
      const edgeKey = key1 < key2 ? `${key1}-${key2}` : `${key2}-${key1}`;
      
      edgeMap.set(edgeKey, (edgeMap.get(edgeKey) || 0) + 1);
    }
  });
  
  // Boundary edge'leri bul (sadece 1 kez kullanılan edge'ler)
  const boundaryEdges: [THREE.Vector3, THREE.Vector3][] = [];
  
  edgeMap.forEach((count, edgeKey) => {
    if (count === 1) {
      const [key1, key2] = edgeKey.split('-');
      const [x1, y1, z1] = key1.split(',').map(Number);
      const [x2, y2, z2] = key2.split(',').map(Number);
      
      boundaryEdges.push([
        new THREE.Vector3(x1, y1, z1),
        new THREE.Vector3(x2, y2, z2)
      ]);
    }
  });
  
  console.log(`🔗 ${boundaryEdges.length} boundary edge bulundu`);
  
  // Boundary edge'lerini sıralı bir loop haline getir
  if (boundaryEdges.length === 0) return [];
  
  const orderedBoundary: THREE.Vector3[] = [];
  const usedEdges = new Set<number>();
  
  // İlk edge ile başla
  let currentEdge = boundaryEdges[0];
  orderedBoundary.push(currentEdge[0], currentEdge[1]);
  usedEdges.add(0);
  
  let currentPoint = currentEdge[1];
  
  // Diğer edge'leri bağla
  while (usedEdges.size < boundaryEdges.length) {
    let found = false;
    
    for (let i = 0; i < boundaryEdges.length; i++) {
      if (usedEdges.has(i)) continue;
      
      const edge = boundaryEdges[i];
      const tolerance = 0.001;
      
      if (currentPoint.distanceTo(edge[0]) < tolerance) {
        orderedBoundary.push(edge[1]);
        currentPoint = edge[1];
        usedEdges.add(i);
        found = true;
        break;
      } else if (currentPoint.distanceTo(edge[1]) < tolerance) {
        orderedBoundary.push(edge[0]);
        currentPoint = edge[0];
        usedEdges.add(i);
        found = true;
        break;
      }
    }
    
    if (!found) break;
  }
  
  console.log(`📏 ${orderedBoundary.length} noktalı boundary oluşturuldu`);
  return orderedBoundary;
};

/**
 * Boundary'den tek bir büyük yüzey oluştur
 */
const createUnifiedSurface = (
  boundaryPoints: THREE.Vector3[],
  referenceNormal: THREE.Vector3
): THREE.BufferGeometry => {
  console.log('🔨 Unified surface oluşturuluyor...');
  
  if (boundaryPoints.length < 3) {
    console.warn('Insufficient boundary points for surface creation');
    return new THREE.BufferGeometry();
  }
  
  // Boundary'yi 2D'ye project et
  const up = Math.abs(referenceNormal.y) < 0.9 ? new THREE.Vector3(0, 1, 0) : new THREE.Vector3(1, 0, 0);
  const tangent = new THREE.Vector3().crossVectors(up, referenceNormal).normalize();
  const bitangent = new THREE.Vector3().crossVectors(referenceNormal, tangent).normalize();
  
  // Boundary center'ını hesapla
  const center = new THREE.Vector3();
  boundaryPoints.forEach(p => center.add(p));
  center.divideScalar(boundaryPoints.length);
  
  // 2D koordinatlara dönüştür
  const points2D: THREE.Vector2[] = [];
  boundaryPoints.forEach(point => {
    const relative = point.clone().sub(center);
    const x = relative.dot(tangent);
    const y = relative.dot(bitangent);
    points2D.push(new THREE.Vector2(x, y));
  });
  
  // Triangulation yap
  const triangles = THREE.ShapeUtils.triangulateShape(points2D, []);
  
  // 3D geometry oluştur
  const vertices: number[] = [];
  const indices: number[] = [];
  
  // Vertices
  boundaryPoints.forEach(point => {
    vertices.push(point.x, point.y, point.z);
  });
  
  // Indices
  triangles.forEach(triangle => {
    indices.push(triangle[0], triangle[1], triangle[2]);
  });
  
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  
  console.log(`✅ Unified surface oluşturuldu: ${triangles.length} triangle`);
  return geometry;
};

/**
 * Ana Smart Surface Repair fonksiyonu
 */
export const performSmartSurfaceRepair = async (
  originalGeometry: THREE.BufferGeometry,
  referenceFaceIndex: number
): Promise<THREE.BufferGeometry | null> => {
  console.log('🔧 ===== SMART SURFACE REPAIR BAŞLADI =====');
  
  try {
    // 1. Coplanar face'leri bul
    const coplanarFaces = findCoplanarFaces(originalGeometry, referenceFaceIndex);
    
    if (coplanarFaces.length <= 1) {
      console.log('❌ Onarılacak coplanar face bulunamadı');
      return null;
    }
    
    console.log(`🎯 ${coplanarFaces.length} coplanar face onarılacak`);
    
    // 2. Referans face bilgilerini al
    const referenceVertices = getFaceVertices(originalGeometry, referenceFaceIndex);
    const referenceNormal = getFaceNormal(referenceVertices);
    
    // 3. Coplanar boundary hesapla
    const boundaryPoints = calculateCoplanarBoundary(originalGeometry, coplanarFaces);
    
    if (boundaryPoints.length < 3) {
      console.log('❌ Geçerli boundary oluşturulamadı');
      return null;
    }
    
    // 4. Unified surface oluştur
    const unifiedSurface = createUnifiedSurface(boundaryPoints, referenceNormal);
    
    if (!unifiedSurface.attributes.position) {
      console.log('❌ Unified surface oluşturulamadı');
      return null;
    }
    
    // 5. Orijinal geometriden coplanar face'leri çıkar
    const originalPositions = originalGeometry.attributes.position;
    const originalIndex = originalGeometry.index;
    
    if (!originalIndex) {
      console.log('❌ Indexed geometry gerekli');
      return null;
    }
    
    // Coplanar olmayan face'leri topla
    const keepFaces: number[] = [];
    const totalFaces = originalIndex.count / 3;
    
    for (let i = 0; i < totalFaces; i++) {
      if (!coplanarFaces.includes(i)) {
        keepFaces.push(i);
      }
    }
    
    // Yeni geometry oluştur
    const newPositions: number[] = [];
    const newIndices: number[] = [];
    const vertexMap = new Map<string, number>();
    let nextVertexIndex = 0;
    
    // Korunacak face'leri ekle
    keepFaces.forEach(faceIndex => {
      const faceVertices = getFaceVertices(originalGeometry, faceIndex);
      const faceIndices: number[] = [];
      
      faceVertices.forEach(vertex => {
        const key = `${vertex.x.toFixed(6)},${vertex.y.toFixed(6)},${vertex.z.toFixed(6)}`;
        
        if (!vertexMap.has(key)) {
          vertexMap.set(key, nextVertexIndex);
          newPositions.push(vertex.x, vertex.y, vertex.z);
          nextVertexIndex++;
        }
        
        faceIndices.push(vertexMap.get(key)!);
      });
      
      newIndices.push(...faceIndices);
    });
    
    // Unified surface'i ekle
    const unifiedPositions = unifiedSurface.attributes.position;
    const unifiedIndex = unifiedSurface.index;
    
    if (unifiedIndex) {
      const startIndex = nextVertexIndex;
      
      // Unified surface vertices'lerini ekle
      for (let i = 0; i < unifiedPositions.count; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(unifiedPositions, i);
        newPositions.push(vertex.x, vertex.y, vertex.z);
      }
      
      // Unified surface indices'lerini ekle
      for (let i = 0; i < unifiedIndex.count; i++) {
        newIndices.push(unifiedIndex.getX(i) + startIndex);
      }
    }
    
    // Final geometry oluştur
    const repairedGeometry = new THREE.BufferGeometry();
    repairedGeometry.setAttribute('position', new THREE.Float32BufferAttribute(newPositions, 3));
    repairedGeometry.setIndex(newIndices);
    repairedGeometry.computeVertexNormals();
    repairedGeometry.computeBoundingBox();
    repairedGeometry.computeBoundingSphere();
    
    console.log('✅ ===== SMART SURFACE REPAIR TAMAMLANDI =====');
    console.log(`📊 Onarım Sonuçları:`);
    console.log(`   - Orijinal face sayısı: ${totalFaces}`);
    console.log(`   - Onarılan face sayısı: ${coplanarFaces.length}`);
    console.log(`   - Kalan face sayısı: ${keepFaces.length}`);
    console.log(`   - Yeni unified surface: 1 büyük yüzey`);
    
    return repairedGeometry;
    
  } catch (error) {
    console.error('❌ Smart Surface Repair hatası:', error);
    return null;
  }
};