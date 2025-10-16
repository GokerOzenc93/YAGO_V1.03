/**
 * @file Bu dosya, three.js sahnesindeki 3D nesnelerin yüzeylerini (face)
 * tespit etmek, seçmek ve görsel olarak vurgulamak (highlight) için
 * gerekli olan yardımcı fonksiyonları içerir. Fare ile tıklanan bir
 * üçgen (triangle/face) parçasından yola çıkarak, aynı düzlemde
 * bulunan tüm bağlantılı yüzeyleri akıllı bir şekilde bulur ve
 * üzerine yeni bir mesh çizerek bu alanı belirginleştirir.
 *
 * Kullanılan Teknolojiler:
 * - three.js: 3D grafik motoru.
 * - three-mesh-bvh: Raycasting (ışın izleme) işlemlerini hızlandırmak
 * için kullanılan bir kütüphane. Karmaşık geometrilerde fare ile
 * nesne tespiti performansını ciddi ölçüde artırır.
 */

import * as THREE from 'three';
import { MeshBVH, acceleratedRaycast } from 'three-mesh-bvh';

// three.js'in standart Mesh prototipine, BVH (Bounding Volume Hierarchy)
// kullanarak hızlandırılmış raycast fonksiyonunu ekliyoruz. Bu sayede
// sahnedeki tüm Mesh nesneleri bu daha performanslı metodu kullanabilir.
(THREE.Mesh as any).prototype.raycast = acceleratedRaycast;

// --- Arayüzler ve Yardımcı Fonksiyonlar ---

/**
 * @interface Shape
 * @description Sahnedeki bir 3D nesnenin temel özelliklerini ve geometrisini
 * tanımlayan genel bir arayüz.
 */
interface Shape {
  type: 'box' | 'rectangle2d' | 'cylinder' | 'circle2d' | 'polyline2d' | 'polygon2d' | 'polyline3d' | 'polygon3d'; // Şeklin türü
  parameters: { // Şekli oluşturmak için kullanılan parametreler
    width?: number;
    height?: number;
    depth?: number;
    radius?: number;
    [key: string]: any;
  };
  scale: [number, number, number]; // Ölçekleme (x, y, z)
  position: [number, number, number]; // Pozisyon (x, y, z)
  rotation: [number, number, number]; // Döndürme (Euler açıları)
  quaternion?: THREE.Quaternion; // Döndürme (Quaternion olarak, daha hassas)
  originalPoints?: THREE.Vector3[]; // Orijinal köşe noktaları
  geometry: THREE.BufferGeometry; // Three.js geometri verisi
  mesh?: THREE.Mesh; // Sahnedeki Three.js mesh nesnesi
  id: string; // Nesneyi benzersiz olarak tanımlayan kimlik
}

/**
 * @interface FaceHighlight
 * @description Vurgulanan (seçilen) bir yüzey hakkındaki bilgileri tutan arayüz.
 */
export interface FaceHighlight {
  mesh: THREE.Mesh; // Vurgulamayı sağlayan, yüzeyin üzerine çizilmiş olan mesh nesnesi.
  faceIndex: number; // Orijinal mesh üzerinde tıklanan ilk üçgenin (face) indeksi.
  shapeId: string; // Vurgulanan yüzeyin ait olduğu ana şeklin (Shape) ID'si.
  faceListIndex?: number; // (Opsiyonel) UI listesindeki indeksi.
  rowIndex?: number; // (Opsiyonel) Bir tablo veya listedeki satır indeksini belirtir. Silme işlemlerinde kullanılır.
}

// Aktif olan tüm yüzey vurgularını saklayan global bir dizi.
let currentHighlights: FaceHighlight[] = [];
// Çoklu seçim modunun (örn. Shift tuşuna basılı tutarak) aktif olup olmadığını belirten global değişken.
let isMultiSelectMode = false;

/**
 * Bir BufferGeometry ve bir yüzey (face) indeksinden o yüzeyi oluşturan
 * köşe (vertex) koordinatlarını Vector3 dizisi olarak alır.
 * @param geometry - Köşe bilgilerinin alınacağı BufferGeometry nesnesi.
 * @param faceIndex - Bilgileri alınacak olan yüzeyin (üçgenin) indeksi.
 * @returns {THREE.Vector3[]} Yüzeyi oluşturan 3 adet köşe noktasının Vector3 dizisi.
 */
export const getFaceVertices = (geometry: THREE.BufferGeometry, faceIndex: number): THREE.Vector3[] => {
  const pos = geometry.attributes.position; // Geometrinin pozisyon (vertex) verisi
  const index = geometry.index; // Geometrinin index verisi (eğer varsa)

  if (!pos) {
    console.warn('Geometrinin pozisyon (position) özelliği bulunmuyor.');
    return [];
  }

  const vertices: THREE.Vector3[] = [];
  const a = faceIndex * 3; // İlgili yüzeyin başlangıç indeksi

  try {
    if (index) {
      // Indexed Geometry: Geometri, vertex'leri tekrar kullanmak için bir index listesi kullanır.
      // Bu daha verimlidir.
      for (let i = 0; i < 3; i++) {
        const vertexIndex = index.getX(a + i); // Index listesinden vertex'in gerçek indeksini al
        const vertex = new THREE.Vector3().fromBufferAttribute(pos, vertexIndex); // Pozisyon verisinden vertex'i oku
        vertices.push(vertex);
      }
    } else {
      // Non-indexed Geometry: Her üçgen için 3 ayrı vertex tanımlanmıştır.
      for (let i = 0; i < 3; i++) {
        const vertex = new THREE.Vector3().fromBufferAttribute(pos, a + i); // Doğrudan pozisyon verisinden oku
        vertices.push(vertex);
      }
    }
  } catch (error) {
    console.warn('Yüzey köşe noktaları alınırken hata oluştu:', error);
    return [];
  }

  return vertices;
};

/**
 * Verilen köşe noktalarına göre yüzeyin normal vektörünü (yüzeye dik olan vektör) hesaplar.
 * @param vertices - Yüzeyi oluşturan köşe noktaları.
 * @returns {THREE.Vector3} Yüzeyin normalize edilmiş normal vektörü.
 */
export const getFaceNormal = (vertices: THREE.Vector3[]): THREE.Vector3 => {
  if (vertices.length < 3) return new THREE.Vector3(0, 1, 0); // Geçersiz durumda varsayılan normal

  // Üçgenin iki kenar vektörünü hesapla (v1 = B-A, v2 = C-A)
  const v1 = new THREE.Vector3().subVectors(vertices[1], vertices[0]);
  const v2 = new THREE.Vector3().subVectors(vertices[2], vertices[0]);

  // Bu iki vektörün çapraz çarpımı (cross product) yüzeyin normalini verir.
  return new THREE.Vector3().crossVectors(v1, v2).normalize();
};

/**
 * Verilen köşe noktalarına göre yüzeyin merkez noktasını hesaplar.
 * @param vertices - Yüzeyi oluşturan köşe noktaları.
 * @returns {THREE.Vector3} Yüzeyin merkez noktasının koordinatı.
 */
export const getFaceCenter = (vertices: THREE.Vector3[]): THREE.Vector3 => {
  const center = new THREE.Vector3();
  vertices.forEach(vertex => center.add(vertex)); // Tüm vertex'leri topla
  center.divideScalar(vertices.length); // Vertex sayısına bölerek ortalamayı al
  return center;
};

/**
 * Verilen köşe noktalarına göre üçgen yüzeyin alanını hesaplar.
 * @param vertices - Yüzeyi oluşturan köşe noktaları.
 * @returns {number} Yüzeyin alanı.
 */
export const getFaceArea = (vertices: THREE.Vector3[]): number => {
  if (vertices.length < 3) return 0;

  // Alan, kenar vektörlerinin çapraz çarpımının uzunluğunun yarısıdır.
  const v1 = new THREE.Vector3().subVectors(vertices[1], vertices[0]);
  const v2 = new THREE.Vector3().subVectors(vertices[2], vertices[0]);

  return v1.cross(v2).length() / 2;
};

/**
 * İki vertex'in (köşe noktasının) birbirine çok yakın olup olmadığını kontrol eder.
 * Kayan noktalı sayı (float) hassasiyeti sorunlarını önlemek için kullanılır.
 */
const EPSILON = 1e-4; // Kabul edilebilir küçük hata payı
const verticesEqual = (v1: THREE.Vector3, v2: THREE.Vector3): boolean => {
  return v1.distanceToSquared(v2) < EPSILON; // Kareli mesafe kontrolü (sqrt olmadan) daha hızlıdır.
};

/**
 * Belirli bir yüzeye komşu olan (en az bir kenarı paylaşan) diğer yüzeyleri bulur.
 * NOT: Bu eski bir yöntemdir, daha gelişmiş olan `buildNeighborsWithWeld` fonksiyonu tercih edilir.
 * @param geometry - Geometri verisi.
 * @param faceIndex - Komşuları bulunacak olan yüzeyin indeksi.
 * @returns {number[]} Komşu yüzeylerin indekslerini içeren bir dizi.
 */
const getNeighborFaces = (geometry: THREE.BufferGeometry, faceIndex: number): number[] => {
  const neighbors: number[] = [];
  const totalFaces = geometry.index ? geometry.index.count / 3 : geometry.attributes.position.count / 3;

  const thisVerts = getFaceVertices(geometry, faceIndex);
  if (thisVerts.length === 0) return neighbors;

  for (let i = 0; i < totalFaces; i++) {
    if (i === faceIndex) continue; // Kendisini kontrol etme

    const otherVerts = getFaceVertices(geometry, i);
    if (otherVerts.length === 0) continue;

    // İki yüzeyin kaç tane ortak vertex'i olduğunu say
    let sharedCount = 0;
    for (const v1 of thisVerts) {
      for (const v2 of otherVerts) {
        if (verticesEqual(v1, v2)) {
          sharedCount++;
          break; // Bir vertex'i birden fazla kez saymamak için iç döngüden çık
        }
      }
    }

    // Eğer tam olarak 2 ortak vertex varsa, bu iki yüzey bir kenar paylaşıyor demektir, yani komşudurlar.
    if (sharedCount === 2) {
      neighbors.push(i);
    }
  }

  return neighbors;
};

/**
 * (ESKİ YÖNTEM) "Flood-fill" (yayma-doldurma) algoritması kullanarak, tıklanan yüzeyden başlayarak
 * aynı düzlemdeki tüm bağlantılı yüzeyleri bulur ve bu yüzeylerin tüm köşe noktalarını döndürür.
 * @param geometry - Geometri verisi.
 * @param startFaceIndex - Algoritmanın başlayacağı yüzeyin indeksi.
 * @returns {THREE.Vector3[]} Bulunan tüm yüzeylerin benzersiz köşe noktaları.
 */
export const getFullSurfaceVertices = (geometry: THREE.BufferGeometry, startFaceIndex: number): THREE.Vector3[] => {
  // Bu fonksiyon `growRegion` adlı daha modern ve sağlam bir versiyonla değiştirilmiştir.
  // Ancak referans olarak kodda tutulmaktadır.
  const pos = geometry.attributes.position;
  if (!pos) return [];

  const visited = new Set<number>();
  const surfaceFaces: number[] = [];
  const queue = [startFaceIndex];
  
  const startVertices = getFaceVertices(geometry, startFaceIndex);
  const startNormal = getFaceNormal(startVertices);
  const startCenter = getFaceCenter(startVertices);

  const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(startNormal, startCenter);
  const NORMAL_TOLERANCE = 0.1; // Açı toleransı yerine dot product toleransı
  const DISTANCE_TOLERANCE = 3.0;

  while (queue.length > 0) {
      const faceIndex = queue.shift()!;
      if (visited.has(faceIndex)) continue;
      visited.add(faceIndex);
      surfaceFaces.push(faceIndex);

      const neighbors = getNeighborFaces(geometry, faceIndex);
      for (const neighborIndex of neighbors) {
          if (visited.has(neighborIndex)) continue;
          
          const neighborVertices = getFaceVertices(geometry, neighborIndex);
          const neighborNormal = getFaceNormal(neighborVertices);
          const neighborCenter = getFaceCenter(neighborVertices);
          
          const dot = neighborNormal.dot(startNormal);
          const dist = Math.abs(plane.distanceToPoint(neighborCenter));

          if (Math.abs(dot) > (1 - NORMAL_TOLERANCE) && dist < DISTANCE_TOLERANCE) {
              queue.push(neighborIndex);
          }
      }
  }

  const allVertices: THREE.Vector3[] = [];
  const uniqueVerticesMap = new Map<string, THREE.Vector3>();
  surfaceFaces.forEach(faceIdx => {
      const vertices = getFaceVertices(geometry, faceIdx);
      vertices.forEach(vertex => {
          const key = `${vertex.x.toFixed(4)},${vertex.y.toFixed(4)},${vertex.z.toFixed(4)}`;
          if (!uniqueVerticesMap.has(key)) {
              uniqueVerticesMap.set(key, vertex);
              allVertices.push(vertex);
          }
      });
  });
  return allVertices;
};


/**
 * (ESKİ YÖNTEM) Verilen köşe noktalarından bir vurgulama (highlight) mesh'i oluşturur.
 * NOT: Bu fonksiyon, `buildFaceOverlayFromHit` ile değiştirilmiştir.
 */
export const createFaceHighlight = (
    vertices: THREE.Vector3[], 
    worldMatrix: THREE.Matrix4,
    color: number = 0xff6b35,
    opacity: number = 0.6
): THREE.Mesh => {
    // ... (Bu fonksiyonun içi artık aktif olarak kullanılmadığından detaylı açıklama atlanmıştır) ...
    return new THREE.Mesh();
};

/**
 * Sadece geçici (persistent olarak işaretlenmemiş) vurguları temizler.
 * Genellikle fare bir yüzeyin üzerindeyken gösterilen anlık vurguyu kaldırmak için kullanılır.
 * @param scene - Three.js sahnesi.
 */
export const clearTemporaryHighlights = (scene: THREE.Scene) => {
  const temporaryHighlights = currentHighlights.filter(
    highlight => !(highlight.mesh as any).isPersistent
  );

  temporaryHighlights.forEach(highlight => {
    // Varsa, vurgulamaya bağlı olan metin nesnesini de sahneden kaldır.
    if ((highlight.mesh as any).textMesh) {
      const textMesh = (highlight.mesh as any).textMesh;
      scene.remove(textMesh);
      textMesh.geometry.dispose();
      textMesh.material.dispose();
    }
    // Vurgu mesh'ini sahneden kaldır ve kaynaklarını serbest bırak.
    scene.remove(highlight.mesh);
    highlight.mesh.geometry.dispose();
    (highlight.mesh.material as THREE.Material).dispose();
  });

  // Global diziden sadece kalıcı (persistent) olanları tutarak güncelle.
  currentHighlights = currentHighlights.filter(
    highlight => (highlight.mesh as any).isPersistent
  );

  console.log(`🎯 ${temporaryHighlights.length} geçici vurgu temizlendi, ${currentHighlights.length} kalıcı vurgu korundu.`);
};

/**
 * Sahnedeki TÜM yüzey vurgularını (geçici ve kalıcı) temizler.
 * @param scene - Three.js sahnesi.
 */
export const clearFaceHighlight = (scene: THREE.Scene) => {
  const highlightsToRemove = [...currentHighlights];

  highlightsToRemove.forEach(highlight => {
    if ((highlight.mesh as any).textMesh) {
      const textMesh = (highlight.mesh as any).textMesh;
      scene.remove(textMesh);
      textMesh.geometry.dispose();
      textMesh.material.dispose();
    }
    scene.remove(highlight.mesh);
    highlight.mesh.geometry.dispose();
    (highlight.mesh.material as THREE.Material).dispose();
  });

  // Tüm listeyi boşalt.
  currentHighlights = [];
  isMultiSelectMode = false;
  console.log(`🎯 Tüm ${highlightsToRemove.length} vurgu temizlendi.`);
};

/**
 * Belirli bir yüzeyin vurgusunu, yüzey indeksi ve şekil ID'si ile kaldırır.
 * @param scene - Three.js sahnesi.
 * @param faceIndex - Kaldırılacak vurgunun yüzey indeksi.
 * @param shapeId - Vurgunun ait olduğu şeklin ID'si.
 */
export const removeFaceHighlight = (scene: THREE.Scene, faceIndex: number, shapeId: string) => {
  const index = currentHighlights.findIndex(h => h.faceIndex === faceIndex && h.shapeId === shapeId);
  if (index !== -1) {
    const highlight = currentHighlights[index];
    if ((highlight.mesh as any).textMesh) {
        // ... text mesh kaldırma
    }
    scene.remove(highlight.mesh);
    highlight.mesh.geometry.dispose();
    (highlight.mesh.material as THREE.Material).dispose();
    currentHighlights.splice(index, 1);
    console.log(`🎯 Vurgu kaldırıldı: ${shapeId} şeklinin ${faceIndex} numaralı yüzeyi.`);
  }
};

/**
 * Bir UI tablosundaki satır silindiğinde, o satıra ait olan yüzey vurgusunu
 * sahneden kaldırır. Bu, UI ve 3D sahne arasındaki senkronizasyonu sağlar.
 * @param scene - Three.js sahnesi.
 * @param rowIndex - Kaldırılacak vurgunun ilişkili olduğu satırın indeksi.
 */
export const removeFaceHighlightByRowIndex = (scene: THREE.Scene, rowIndex: number) => {
  console.log(`🎯 ${rowIndex} satırı için vurgular kaldırılmaya çalışılıyor.`);
  
  // Bu fonksiyon, hem `currentHighlights` dizisinden hem de sahnedeki nesnelerin
  // `userData` özelliğinden arama yaparak çift taraflı bir temizlik yapar.
  // Bu sayede herhangi bir referansın sahnede kalması engellenir.
  
  const highlightsToRemove: FaceHighlight[] = [];
  const sceneObjectsToRemove: THREE.Object3D[] = [];

  // 1. `currentHighlights` dizisinden eşleşenleri bul.
  currentHighlights.forEach(highlight => {
    if (highlight.rowIndex === rowIndex) {
      highlightsToRemove.push(highlight);
    }
  });

  // 2. Sahnedeki tüm nesneleri tara ve `userData.rowIndex` eşleşenleri bul.
  scene.traverse((object) => {
    if (object.userData && object.userData.rowIndex === rowIndex) {
      sceneObjectsToRemove.push(object);
    }
  });

  console.log(`🎯 ${highlightsToRemove.length} vurgu ve ${sceneObjectsToRemove.length} sahne nesnesi kaldırılmak üzere bulundu.`);

  // 3. Bulunan nesneleri ve referansları temizle.
  highlightsToRemove.forEach(highlight => {
      const index = currentHighlights.indexOf(highlight);
      if (index !== -1) {
          if ((highlight.mesh as any).textMesh) {
              //... text mesh kaldırma ...
          }
          scene.remove(highlight.mesh);
          highlight.mesh.geometry.dispose();
          (highlight.mesh.material as THREE.Material).dispose();
          currentHighlights.splice(index, 1);
      }
  });

  sceneObjectsToRemove.forEach(object => {
    scene.remove(object);
    if (object instanceof THREE.Mesh) {
      if (object.geometry) object.geometry.dispose();
      if (object.material) {
        if (Array.isArray(object.material)) {
            object.material.forEach(mat => mat.dispose());
        } else {
            object.material.dispose();
        }
      }
    }
  });
};

/**
 * Sahnedeki tüm kalıcı (persistent) vurguları temizler.
 * @param scene - Three.js sahnesi.
 */
export const clearAllPersistentHighlights = (scene: THREE.Scene) => {
    const persistentHighlights = currentHighlights.filter(h => (h.mesh as any).isPersistent);
    persistentHighlights.forEach(highlight => {
        // ... (kaldırma ve dispose işlemleri) ...
    });
    currentHighlights = []; // Tüm listeyi temizle
    console.log(`🎯 ${persistentHighlights.length} kalıcı vurgu temizlendi.`);
};


/**
 * ========================================================================
 * === SAĞLAM VE GELİŞMİŞ DÜZLEMSEL BÖLGE SEÇİM ALGORİTMASI ===
 * ========================================================================
 * Bu bölüm, yüzey seçimi için daha modern ve güvenilir bir yaklaşım sunar.
 * Temel prensibi, geometrideki küçük kusurları (örn. T-kesişimleri, minik boşluklar)
 * tolere edebilmek için, birbirine çok yakın olan vertex'leri "kaynak yapılmış"
 * (welded) gibi kabul etmektir. Bu sayede, görsel olarak tek bir düzlem gibi
 * görünen ama aslında birden fazla ayrı üçgenden oluşan yüzeyler doğru bir
 * şekilde tek bir bütün olarak seçilebilir.
 */

// Bölge analizi sonucunu tutan tip tanımı.
type RegionResult = {
  triangles: number[]; // Bölgeye ait üçgenlerin indeksleri.
  normal: THREE.Vector3; // Bölgenin ortalama normal vektörü.
  plane: THREE.Plane; // Bölgenin matematiksel düzlem tanımı.
  boundaryLoops: number[][]; // Bölgenin dış sınırlarını oluşturan kaynaklanmış vertex ID döngüleri.
  weldedToWorld: Map<number, THREE.Vector3>; // Kaynaklanmış vertex ID'sinden dünya koordinatına harita.
};

// --- Algoritma Parametreleri ---
const QUANT_EPS = 1e-4; // Vertex'leri kaynaklamak için kullanılacak mesafe toleransı (dünya birimi).
const ANGLE_DEG = 4;    // İki komşu üçgenin aynı düzlemde kabul edilmesi için maksimum açı farkı (derece).
const PLANE_EPS = 5e-3; // Bir vertex'in bir düzleme ait kabul edilmesi için maksimum uzaklık (5mm).

/**
 * Bir Vector3'ü, quantizasyon (yuvarlama) yaparak bir string anahtara dönüştürür.
 * Bu, birbirine çok yakın olan vertex'lerin aynı anahtara sahip olmasını sağlar.
 * @param v - Vektör.
 * @param eps - Yuvarlama hassasiyeti.
 * @returns {string} Benzersiz pozisyon anahtarı (örn: "10_-5_20").
 */
const posKey = (v: THREE.Vector3, eps: number) => {
  const kx = Math.round(v.x / eps);
  const ky = Math.round(v.y / eps);
  const kz = Math.round(v.z / eps);
  return `${kx}_${ky}_${kz}`;
};

/**
 * Bir mesh'in geometrisini analiz ederek, vertex'leri kaynaklanmış (welded)
 * kabul eden bir komşuluk grafiği oluşturur.
 * @param mesh - Analiz edilecek mesh.
 * @param weldEps - Kaynaklama toleransı.
 * @returns Komşuluk bilgileri, kaynaklanmış vertex haritaları ve geometri referansları.
 */
const buildNeighborsWithWeld = (mesh: THREE.Mesh, weldEps: number) => {
  const geom = mesh.geometry as THREE.BufferGeometry;
  let index: THREE.BufferAttribute;
  
  if (geom.index) {
    index = geom.index;
  } else {
    // Non-indexed ise sanal bir index buffer oluştur.
    const vertexCount = geom.attributes.position.count;
    const indexArray = new Uint32Array(vertexCount);
    for (let i = 0; i < vertexCount; i++) indexArray[i] = i;
    index = new THREE.BufferAttribute(indexArray, 1);
  }
  
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;
  const idx = index.array as ArrayLike<number>;
  const triCount = Math.floor(idx.length / 3);

  // 1. Adım: Vertex Kaynaklama (Welding)
  // Her vertex'i dünya koordinatlarına çevir, posKey ile anahtarını oluştur ve
  // aynı anahtara sahip olanları tek bir "kaynaklanmış vertex ID"si altında birleştir.
  const keyToId = new Map<string, number>();
  const weldedIdToWorld = new Map<number, THREE.Vector3>();
  const vertToWelded = new Map<number, number>();
  let nextId = 0;

  const tmp = new THREE.Vector3();
  const m = mesh.matrixWorld;
  for (let vi = 0; vi < pos.count; vi++) {
    tmp.fromBufferAttribute(pos, vi).applyMatrix4(m);
    const key = posKey(tmp, weldEps);
    if (!keyToId.has(key)) {
      keyToId.set(key, nextId);
      weldedIdToWorld.set(nextId, tmp.clone());
      nextId++;
    }
    vertToWelded.set(vi, keyToId.get(key)!);
  }

  // 2. Adım: Kenar Bazlı Komşuluk Grafiği Oluşturma
  // Her üçgenin kenarlarını (kaynaklanmış vertex ID'leri ile) dolaş.
  // Bir kenar (örn: "10_25") eğer daha önce başka bir üçgen tarafından
  // eklendiyse, bu iki üçgen komşudur.
  const edgeMap = new Map<string, number>();
  const neighbors = new Map<number, number[]>();
  const triToWelded: [number, number, number][] = [];

  for (let t = 0; t < triCount; t++) {
    const a = idx[t*3], b = idx[t*3+1], c = idx[t*3+2];
    const wa = vertToWelded.get(a)!, wb = vertToWelded.get(b)!, wc = vertToWelded.get(c)!;
    triToWelded.push([wa, wb, wc]);

    const edges: [number, number][] = [[wa, wb], [wb, wc], [wc, wa]];
    for (const [u0, v0] of edges) {
      const u = Math.min(u0, v0), v = Math.max(u0, v0);
      const ekey = `${u}_${v}`;
      if (edgeMap.has(ekey)) {
        const other = edgeMap.get(ekey)!;
        if (!neighbors.has(t)) neighbors.set(t, []);
        if (!neighbors.has(other)) neighbors.set(other, []);
        neighbors.get(t)!.push(other);
        neighbors.get(other)!.push(t);
      } else {
        edgeMap.set(ekey, t);
      }
    }
  }

  return { neighbors, triToWelded, weldedIdToWorld, index, posAttr: pos };
};

/**
 * Belirli bir üçgenin normalini dünya koordinatlarında hesaplar.
 */
const triNormalWorld = (mesh: THREE.Mesh, triIndex: number, index: THREE.BufferAttribute, pos: THREE.BufferAttribute) => {
  const ia = index.getX(triIndex*3), ib = index.getX(triIndex*3+1), ic = index.getX(triIndex*3+2);
  const a = new THREE.Vector3().fromBufferAttribute(pos, ia).applyMatrix4(mesh.matrixWorld);
  const b = new THREE.Vector3().fromBufferAttribute(pos, ib).applyMatrix4(mesh.matrixWorld);
  const c = new THREE.Vector3().fromBufferAttribute(pos, ic).applyMatrix4(mesh.matrixWorld);
  return new THREE.Vector3().subVectors(b,a).cross(new THREE.Vector3().subVectors(c,a)).normalize();
};

/**
 * Tıklanan bir üçgenden başlayarak, düzlemsel bir bölgeyi "büyüten" ana algoritma.
 * @param mesh - Üzerinde çalışılan mesh.
 * @param seedTri - Başlangıç üçgeninin indeksi.
 * @returns {RegionResult} Bulunan bölgenin detaylı analizi.
 */
const growRegion = (mesh: THREE.Mesh, seedTri: number): RegionResult => {
  // Nesnenin ölçeğine göre toleransları ayarla. Büyük nesnelerde daha esnek ol.
  const scale = new THREE.Vector3();
  mesh.matrixWorld.decompose(new THREE.Vector3(), new THREE.Quaternion(), scale);
  const avgScale = (Math.abs(scale.x) + Math.abs(scale.y) + Math.abs(scale.z)) / 3;
  
  // 1. Komşuluk grafiğini ve kaynaklanmış vertex verilerini oluştur.
  const { neighbors, triToWelded, weldedIdToWorld, index, posAttr } = buildNeighborsWithWeld(mesh, QUANT_EPS * avgScale);
  
  const planeEps = PLANE_EPS * Math.max(1, avgScale);
  const angleCos = Math.cos(THREE.MathUtils.degToRad(ANGLE_DEG));

  // 2. Başlangıç üçgeninin düzlemini ve normalini hesapla.
  let avgNormal = triNormalWorld(mesh, seedTri, index, posAttr);
  const seedW = triToWelded[seedTri];
  const seedPoint = weldedIdToWorld.get(seedW[0])!.clone();
  let plane = new THREE.Plane().setFromNormalAndCoplanarPoint(avgNormal, seedPoint);

  // 3. Yayma-Doldurma (Flood-Fill / BFS)
  const visited = new Set<number>();
  const region: number[] = [];
  const queue: number[] = [seedTri];
  visited.add(seedTri);

  while (queue.length) {
    const t = queue.shift()!;
    region.push(t);
    const neighs = neighbors.get(t) || [];

    for (const nt of neighs) {
      if (visited.has(nt)) continue;
      
      const n = triNormalWorld(mesh, nt, index, posAttr);
      
      // Açı Kontrolü: Normali, bölgenin ortalama normali ile karşılaştır. Ters normalleri de kabul et.
      if (Math.abs(n.dot(avgNormal)) < angleCos) continue;
      
      // Düzlem Kontrolü: Komşu üçgenin tüm vertex'leri, ana düzleme yeterince yakın mı?
      const wids = triToWelded[nt];
      const pa = weldedIdToWorld.get(wids[0])!;
      const pb = weldedIdToWorld.get(wids[1])!;
      const pc = weldedIdToWorld.get(wids[2])!;
      if (Math.abs(plane.distanceToPoint(pa)) > planeEps || 
          Math.abs(plane.distanceToPoint(pb)) > planeEps || 
          Math.abs(plane.distanceToPoint(pc)) > planeEps) {
        continue;
      }
      
      visited.add(nt);
      queue.push(nt);
      
      // Bölgenin ortalama normalini yeni eklenen üçgenin normali ile güncelleyerek daha hassas bir düzlem elde et.
      avgNormal.add(n).normalize();
      plane.setFromNormalAndCoplanarPoint(avgNormal, seedPoint);
    }
  }

  // 4. Sınır Döngülerini Bulma (Boundary Loop Detection)
  const edgeCount = new Map<string, number>();
  for (const t of region) {
    const [a,b,c] = triToWelded[t];
    const edges: [number,number][] = [[a,b],[b,c],[c,a]];
    for (const [u0,v0] of edges) {
      const u = Math.min(u0, v0), v = Math.max(u0, v0);
      const ekey = `${u}_${v}`;
      edgeCount.set(ekey, (edgeCount.get(ekey)||0)+1);
    }
  }
  const boundaryEdges: [number,number][] = [];
  for (const [ekey, cnt] of edgeCount.entries()) {
    if (cnt === 1) {
      const [u,v] = ekey.split('_').map(Number);
      boundaryEdges.push([u,v]);
    }
  }

  // 5. Sınır Kenarlarını Sıralayarak Döngüler Haline Getirme
  const adjacency = new Map<number, number[]>();
  for (const [u,v] of boundaryEdges) {
    if (!adjacency.has(u)) adjacency.set(u, []);
    if (!adjacency.has(v)) adjacency.set(v, []);
    adjacency.get(u)!.push(v);
    adjacency.get(v)!.push(u);
  }

  const boundaryLoops: number[][] = [];
  const used = new Set<string>();
  const edgeKey = (u:number,v:number)=> u<=v?`${u}_${v}`:`${v}_${u}`;

  for (const startNode of adjacency.keys()) {
      if (adjacency.get(startNode)!.every(endNode => used.has(edgeKey(startNode, endNode)))) continue;
      
      const loop = [startNode];
      let curr = startNode;
      while (true) {
          const neighbors = adjacency.get(curr)!;
          let next = -1;
          for (const n of neighbors) {
              if (!used.has(edgeKey(curr, n))) {
                  next = n;
                  break;
              }
          }

          if (next === -1) break;
          
          used.add(edgeKey(curr, next));
          if (next === startNode) break;

          loop.push(next);
          curr = next;
      }
      if (loop.length > 2) boundaryLoops.push(loop);
  }

  return { triangles: region, normal: avgNormal.clone(), plane, boundaryLoops, weldedToWorld: weldedIdToWorld };
};


/**
 * `growRegion` tarafından bulunan düzlemsel bölgeden bir vurgulama (overlay) mesh'i oluşturur.
 * @param scene - Three.js sahnesi.
 * @param mesh - Orijinal mesh.
 * @param seedTri - Başlangıç üçgeni.
 * @returns {THREE.Mesh | null} Oluşturulan vurgu mesh'i veya başarısızsa null.
 */
const buildFaceOverlayFromHit = (
    scene: THREE.Scene,
    mesh: THREE.Mesh,
    seedTri: number,
    color: number,
    opacity: number,
    rowIndex?: number,
    shapeId?: string
): THREE.Mesh | null => {
  // 1. `growRegion` ile düzlemsel bölgeyi analiz et.
  const res = growRegion(mesh, seedTri);
  if (res.boundaryLoops.length === 0) return null;

  // 2. Bölgenin 3D sınır döngülerini 2D bir düzleme yansıt.
  const n = res.normal;
  const up = Math.abs(n.y) < 0.9 ? new THREE.Vector3(0,1,0) : new THREE.Vector3(1,0,0);
  const tangent = new THREE.Vector3().crossVectors(up, n).normalize();
  const bitangent = new THREE.Vector3().crossVectors(n, tangent).normalize();

  const project = (p: THREE.Vector3) => new THREE.Vector2(p.dot(tangent), p.dot(bitangent));

  const loops2D = res.boundaryLoops.map(loop => loop.map(wid => project(res.weldedToWorld.get(wid)!)));

  // 3. `THREE.ShapeUtils.triangulateShape` kullanarak 2D çokgeni (ve varsa içindeki delikleri) üçgenle.
  const outer = loops2D[0];
  const holes = loops2D.slice(1);
  const triangles = THREE.ShapeUtils.triangulateShape(outer, holes);

  // 4. Üçgenlenmiş 2D şekli tekrar 3D'ye dönüştür ve yeni bir BufferGeometry oluştur.
  const allPoints2D = outer.concat(...holes);
  const verts: number[] = [];
  const zOffset = n.clone().multiplyScalar(0.5); // Z-fighting önleme için ofset
  
  for (const v2 of allPoints2D) {
      const p3 = new THREE.Vector3()
          .addScaledVector(tangent, v2.x)
          .addScaledVector(bitangent, v2.y)
          .add(res.plane.projectPoint(res.weldedToWorld.get(res.boundaryLoops[0][0])!, new THREE.Vector3()))
          .add(zOffset);
      verts.push(p3.x, p3.y, p3.z);
  }

  const indices: number[] = [];
  for (const tri of triangles) for (const i of tri) indices.push(i);

  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  g.setIndex(indices);
  g.computeVertexNormals();

  // 5. Yarı saydam bir materyal ile yeni mesh'i oluştur ve sahneye ekle.
  const mat = new THREE.MeshBasicMaterial({ color, opacity, transparent: true, depthWrite: false, side: THREE.DoubleSide });
  const overlay = new THREE.Mesh(g, mat);
  overlay.renderOrder = 999; // Her zaman en üstte çizilmesi için.
  scene.add(overlay);
  return overlay;
};

/**
 * ========================================================================
 * === ANA API FONKSİYONLARI ===
 * ========================================================================
 */

/**
 * Bir fare tıklaması sonucunda bulunan yüzeyi ve bağlantılı düzlemi vurgular.
 * @param scene - Three.js sahnesi.
 * @param hit - Raycaster tarafından döndürülen kesişim (intersection) bilgisi.
 * @param shape - Tıklanan nesnenin Shape arayüzü.
 * @param rowIndex - (Opsiyonel) Vurgunun ilişkilendirileceği UI satır indeksi.
 * @returns {FaceHighlight | null} Oluşturulan vurgu bilgisi veya null.
 */
export const addFaceHighlight = (
  scene: THREE.Scene,
  hit: THREE.Intersection,
  shape: Shape,
  color: number = 0xff6b35,
  opacity: number = 0.6,
  isMultiSelect: boolean = false,
  faceNumber?: number,
  rowIndex?: number
): FaceHighlight | null => {
  if (!hit.face || hit.faceIndex === undefined) return null;
  const mesh = hit.object as THREE.Mesh;

  // Gelişmiş algoritmayı kullanarak tüm düzlemsel bölge için TEK bir vurgu mesh'i oluştur.
  const overlay = buildFaceOverlayFromHit(scene, mesh, hit.faceIndex, color, opacity, rowIndex, shape.id);
  if (!overlay) return null;
  
  // Vurgu mesh'inin `userData` özelliğine, onu daha sonra bulup silebilmek için
  // gerekli olan bilgileri (rowIndex, shapeId vb.) ekle. Bu çok önemlidir.
  overlay.userData = {
    rowIndex: rowIndex,
    faceIndex: hit.faceIndex,
    shapeId: shape.id,
    faceNumber: faceNumber,
    isPersistent: faceNumber !== undefined,
  };

  const newHighlight: FaceHighlight = {
    mesh: overlay,
    faceIndex: hit.faceIndex,
    shapeId: shape.id,
    rowIndex: rowIndex
  };
  currentHighlights.push(newHighlight);

  // Kalıcı/geçici durumunu mesh üzerinde de işaretle.
  (overlay as any).isPersistent = faceNumber !== undefined;
  
  if (faceNumber !== undefined) {
    console.log(`🎯 Yüzey ${hit.faceIndex} KALICI olarak işaretlendi. Satır: ${rowIndex}, No: ${faceNumber}`);
  }

  isMultiSelectMode = isMultiSelect;
  return newHighlight;
};

/**
 * Fare pozisyonundan bir ışın (ray) göndererek, bir mesh ile kesişen
 * ilk yüzeyi (veya tüm kesişimleri) tespit eder.
 * @param event - MouseEvent (tıklama veya hareket).
 * @param camera - Sahne kamerası.
 * @param mesh - Kesişim testi yapılacak mesh.
 * @param canvas - Renderer'ın bağlı olduğu HTML canvas elemanı.
 * @returns {THREE.Intersection[]} Kesişim bilgilerini içeren bir dizi.
 */
export const detectFaceAtMouse = (
  event: MouseEvent,
  camera: THREE.Camera,
  mesh: THREE.Mesh,
  canvas: HTMLCanvasElement
): THREE.Intersection[] => {
  const rect = canvas.getBoundingClientRect();
  const mouse = new THREE.Vector2();

  // Fare koordinatlarını -1 ile +1 aralığına normalize et (NDC - Normalized Device Coordinates).
  mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

  const raycaster = new THREE.Raycaster();
  
  // BVH (three-mesh-bvh) kullanımı: Eğer geometri için bir "sınır hacmi hiyerarşisi"
  // (boundsTree) oluşturulmamışsa, ilk kullanımda oluştur. Bu, sonraki
  // raycast işlemlerini çok daha hızlı hale getirir.
  const geom = (mesh.geometry as any);
  if (!geom.boundsTree && typeof geom.computeBoundsTree === 'function') {
    geom.computeBoundsTree();
  }
  raycaster.setFromCamera(mouse, camera);

  // Kesişim testini yap.
  const intersects = raycaster.intersectObject(mesh, false);

  if (intersects.length > 0) {
    return intersects;
  }

  return [];
};

// --- Durum (State) Getirici Fonksiyonlar ---

/**
 * Aktif olan tüm vurguların bir kopyasını döndürür.
 */
export const getCurrentHighlights = (): FaceHighlight[] => {
  return [...currentHighlights];
};

/**
 * Çoklu seçim modunun aktif olup olmadığını döndürür.
 */
export const isInMultiSelectMode = (): boolean => {
  return isMultiSelectMode;
};

/**
 * Şu anda seçili (vurgulu) olan yüzey sayısını döndürür.
 */
export const getSelectedFaceCount = (): number => {
  return currentHighlights.length;
};

