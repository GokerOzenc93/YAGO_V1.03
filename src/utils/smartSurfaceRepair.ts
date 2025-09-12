import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { detectFaceAtMouse, getFaceVertices, getFaceNormal, getFaceCenter, getFullSurfaceVertices } from './faceSelection';

/**
 * Akıllı Yüzey Onarımı - Smart Surface Repair System
 * Parçalı yüzeyleri tek parça haline getirir
 */

interface SurfaceRegion {
  faceIndices: number[];
  normal: THREE.Vector3;
  center: THREE.Vector3;
  area: number;
  vertices: THREE.Vector3[];
}

interface RepairResult {
  success: boolean;
  newGeometry: THREE.BufferGeometry;
  repairedRegions: number;
  message: string;
}

/**
 * Yüzey normal'larının benzerliğini kontrol et
 */
const areNormalsSimilar = (normal1: THREE.Vector3, normal2: THREE.Vector3, tolerance: number = 0.95): boolean => {
  return Math.abs(normal1.dot(normal2)) > tolerance;
};

/**
 * İki yüzeyin aynı düzlemde olup olmadığını kontrol et
 */
const areCoplanar = (center1: THREE.Vector3, center2: THREE.Vector3, normal: THREE.Vector3, tolerance: number = 2.0): boolean => {
  const diff = new THREE.Vector3().subVectors(center2, center1);
  const distance = Math.abs(diff.dot(normal));
  return distance < tolerance;
};

/**
 * Geometrideki tüm yüzeyleri analiz et ve benzer yüzeyleri grupla
 */
const analyzeSurfaceRegions = (geometry: THREE.BufferGeometry, worldMatrix: THREE.Matrix4): SurfaceRegion[] => {
  const regions: SurfaceRegion[] = [];
  const processedFaces = new Set<number>();
  
  const totalFaces = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;
  
  console.log(`🔍 Analyzing ${totalFaces} faces for surface regions...`);
  
  for (let faceIndex = 0; faceIndex < totalFaces; faceIndex++) {
    if (processedFaces.has(faceIndex)) continue;
    
    // Bu face'in bilgilerini al
    const vertices = getFaceVertices(geometry, faceIndex);
    if (vertices.length === 0) continue;
    
    // World space'e dönüştür
    const worldVertices = vertices.map(v => v.clone().applyMatrix4(worldMatrix));
    const normal = getFaceNormal(worldVertices).normalize();
    const center = getFaceCenter(worldVertices);
    
    // Bu face'le benzer olan diğer face'leri bul
    const similarFaces = [faceIndex];
    processedFaces.add(faceIndex);
    
    for (let otherIndex = faceIndex + 1; otherIndex < totalFaces; otherIndex++) {
      if (processedFaces.has(otherIndex)) continue;
      
      const otherVertices = getFaceVertices(geometry, otherIndex);
      if (otherVertices.length === 0) continue;
      
      const otherWorldVertices = otherVertices.map(v => v.clone().applyMatrix4(worldMatrix));
      const otherNormal = getFaceNormal(otherWorldVertices).normalize();
      const otherCenter = getFaceCenter(otherWorldVertices);
      
      // Normal benzerliği ve coplanar kontrolü
      if (areNormalsSimilar(normal, otherNormal) && areCoplanar(center, otherCenter, normal)) {
        similarFaces.push(otherIndex);
        processedFaces.add(otherIndex);
      }
    }
    
    // Eğer birden fazla face varsa, bu bir region
    if (similarFaces.length > 1) {
      // Tüm face'lerin vertex'lerini topla
      const allVertices: THREE.Vector3[] = [];
      const uniqueVerticesMap = new Map<string, THREE.Vector3>();
      
      similarFaces.forEach(fIdx => {
        const faceVerts = getFaceVertices(geometry, fIdx);
        faceVerts.forEach(vertex => {
          const worldVertex = vertex.clone().applyMatrix4(worldMatrix);
          const key = `${worldVertex.x.toFixed(4)},${worldVertex.y.toFixed(4)},${worldVertex.z.toFixed(4)}`;
          if (!uniqueVerticesMap.has(key)) {
            uniqueVerticesMap.set(key, worldVertex);
            allVertices.push(worldVertex);
          }
        });
      });
      
      // Alan hesapla (yaklaşık)
      let totalArea = 0;
      similarFaces.forEach(fIdx => {
        const faceVerts = getFaceVertices(geometry, fIdx);
        if (faceVerts.length >= 3) {
          const worldVerts = faceVerts.map(v => v.clone().applyMatrix4(worldMatrix));
          const v1 = new THREE.Vector3().subVectors(worldVerts[1], worldVerts[0]);
          const v2 = new THREE.Vector3().subVectors(worldVerts[2], worldVerts[0]);
          totalArea += v1.cross(v2).length() / 2;
        }
      });
      
      regions.push({
        faceIndices: similarFaces,
        normal: normal.clone(),
        center: center.clone(),
        area: totalArea,
        vertices: allVertices
      });
      
      console.log(`📊 Found surface region: ${similarFaces.length} faces, area: ${totalArea.toFixed(1)}mm²`);
    }
  }
  
  console.log(`✅ Analysis complete: ${regions.length} surface regions found`);
  return regions;
};

/**
 * Referans yüzeyine benzer tüm parçalı yüzeyleri birleştir
 */
const repairSimilarSurfaces = (
  geometry: THREE.BufferGeometry,
  worldMatrix: THREE.Matrix4,
  referenceNormal: THREE.Vector3,
  referenceCenter: THREE.Vector3
): THREE.BufferGeometry => {
  console.log('🔧 Starting surface repair process...');
  
  const regions = analyzeSurfaceRegions(geometry, worldMatrix);
  
  // Referans yüzeye benzer regionları bul
  const similarRegions = regions.filter(region => 
    areNormalsSimilar(region.normal, referenceNormal, 0.98) &&
    areCoplanar(region.center, referenceCenter, referenceNormal, 5.0)
  );
  
  if (similarRegions.length === 0) {
    console.log('❌ No similar surfaces found for repair');
    return geometry.clone();
  }
  
  console.log(`🎯 Found ${similarRegions.length} similar surface regions to repair`);
  
  // En büyük region'ı ana yüzey olarak seç
  const mainRegion = similarRegions.reduce((largest, current) => 
    current.area > largest.area ? current : largest
  );
  
  console.log(`🏆 Main surface selected: ${mainRegion.faceIndices.length} faces, area: ${mainRegion.area.toFixed(1)}mm²`);
  
  // Ana yüzeyin düzlemini hesapla
  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(mainRegion.normal, mainRegion.center);
  
  // Yeni geometri oluştur - ana yüzeyi genişletilmiş haliyle
  const newGeometry = geometry.clone();
  const positions = newGeometry.attributes.position;
  const posArray = positions.array as Float32Array;
  
  // Tüm benzer region'lardaki vertex'leri ana yüzeyin düzlemine projekte et
  const invMatrix = new THREE.Matrix4().copy(worldMatrix).invert();
  let repairedVertexCount = 0;
  
  similarRegions.forEach(region => {
    region.vertices.forEach(worldVertex => {
      // Vertex'i düzleme projekte et
      const projectedVertex = plane.projectPoint(worldVertex, new THREE.Vector3());
      
      // Local space'e geri dönüştür
      const localVertex = projectedVertex.applyMatrix4(invMatrix);
      
      // Geometrideki karşılık gelen vertex'i bul ve güncelle
      for (let i = 0; i < positions.count; i++) {
        const existingVertex = new THREE.Vector3().fromBufferAttribute(positions, i);
        if (existingVertex.distanceTo(localVertex) < 0.1) {
          posArray[i * 3] = localVertex.x;
          posArray[i * 3 + 1] = localVertex.y;
          posArray[i * 3 + 2] = localVertex.z;
          repairedVertexCount++;
          break;
        }
      }
    });
  });
  
  // Attribute'u güncelle
  positions.needsUpdate = true;
  
  // Normal'ları yeniden hesapla
  newGeometry.computeVertexNormals();
  newGeometry.computeBoundingBox();
  newGeometry.computeBoundingSphere();
  
  console.log(`✅ Surface repair complete: ${repairedVertexCount} vertices projected to main surface`);
  
  return newGeometry;
};

/**
 * Ana akıllı yüzey onarımı fonksiyonu
 */
export const performSmartSurfaceRepair = (
  shape: Shape,
  referencePoint: THREE.Vector3,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement
): RepairResult => {
  console.log('🎯 ===== AKILLI YÜZEY ONARIMI BAŞLADI =====');
  
  try {
    // Shape'in mesh'ini oluştur
    const tempMesh = new THREE.Mesh(shape.geometry);
    tempMesh.position.fromArray(shape.position);
    tempMesh.scale.fromArray(shape.scale);
    if (shape.rotation) {
      tempMesh.rotation.fromArray(shape.rotation);
    }
    tempMesh.updateMatrixWorld(true);
    
    // Referans noktasından ray cast yaparak yüzeyi bul
    const raycaster = new THREE.Raycaster();
    const direction = new THREE.Vector3().subVectors(referencePoint, camera.position).normalize();
    raycaster.set(camera.position, direction);
    
    const intersects = raycaster.intersectObject(tempMesh);
    
    if (intersects.length === 0) {
      return {
        success: false,
        newGeometry: shape.geometry,
        repairedRegions: 0,
        message: 'Referans yüzey bulunamadı'
      };
    }
    
    const hit = intersects[0];
    if (!hit.face || hit.faceIndex === undefined) {
      return {
        success: false,
        newGeometry: shape.geometry,
        repairedRegions: 0,
        message: 'Geçerli yüzey bulunamadı'
      };
    }
    
    // Referans yüzeyin bilgilerini al
    const referenceVertices = getFaceVertices(shape.geometry, hit.faceIndex);
    const worldVertices = referenceVertices.map(v => v.clone().applyMatrix4(tempMesh.matrixWorld));
    const referenceNormal = getFaceNormal(worldVertices).normalize();
    const referenceCenter = getFaceCenter(worldVertices);
    
    console.log(`🎯 Reference surface found: Face ${hit.faceIndex}`);
    console.log(`📐 Reference normal: [${referenceNormal.x.toFixed(3)}, ${referenceNormal.y.toFixed(3)}, ${referenceNormal.z.toFixed(3)}]`);
    
    // Yüzey onarımını gerçekleştir
    const repairedGeometry = repairSimilarSurfaces(
      shape.geometry,
      tempMesh.matrixWorld,
      referenceNormal,
      referenceCenter
    );
    
    // Sonuçları analiz et
    const regions = analyzeSurfaceRegions(shape.geometry, tempMesh.matrixWorld);
    const repairedRegions = regions.filter(region => 
      areNormalsSimilar(region.normal, referenceNormal, 0.98)
    ).length;
    
    console.log('✅ ===== AKILLI YÜZEY ONARIMI TAMAMLANDI =====');
    
    return {
      success: true,
      newGeometry: repairedGeometry,
      repairedRegions: repairedRegions,
      message: `${repairedRegions} yüzey bölgesi onarıldı`
    };
    
  } catch (error) {
    console.error('❌ Akıllı yüzey onarımı hatası:', error);
    return {
      success: false,
      newGeometry: shape.geometry,
      repairedRegions: 0,
      message: `Onarım hatası: ${error.message}`
    };
  }
};

/**
 * Yüzey onarımı için mouse event handler
 */
export const handleSurfaceRepairClick = (
  event: MouseEvent,
  camera: THREE.Camera,
  canvas: HTMLCanvasElement,
  selectedShape: Shape,
  updateShape: (id: string, updates: Partial<Shape>) => void
): boolean => {
  if (!selectedShape) {
    console.log('❌ Yüzey onarımı için nesne seçilmedi');
    return false;
  }
  
  // Mouse pozisyonunu world koordinatına çevir
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2();
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  
  const raycaster = new THREE.Raycaster();
  raycaster.setFromCamera(mouse, camera);
  
  // Düzlem ile kesişim noktasını bul
  const plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const intersectionPoint = new THREE.Vector3();
  const hasIntersection = raycaster.ray.intersectPlane(plane, intersectionPoint);
  
  if (!hasIntersection) {
    console.log('❌ Referans nokta bulunamadı');
    return false;
  }
  
  // Yüzey onarımını gerçekleştir
  const result = performSmartSurfaceRepair(selectedShape, intersectionPoint, camera, canvas);
  
  if (result.success) {
    // Eski geometriyi dispose et
    try {
      selectedShape.geometry.dispose();
    } catch (e) {
      console.warn('Eski geometri dispose edilemedi:', e);
    }
    
    // Shape'i güncelle
    updateShape(selectedShape.id, {
      geometry: result.newGeometry,
      parameters: {
        ...selectedShape.parameters,
        surfaceRepair: true,
        repairedRegions: result.repairedRegions,
        lastRepaired: Date.now()
      }
    });
    
    console.log(`✅ ${result.message}`);
    return true;
  } else {
    console.log(`❌ ${result.message}`);
    return false;
  }
};