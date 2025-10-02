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
  return v1.distanceToSquared(v2) < EPSILON; // Kareli mesafe kontrolü daha hızlıdır.
};

/**
 * Belirli bir yüzeye komşu olan (en az bir kenarı paylaşan) diğer yüzeyleri bulur.
 * Bu eski bir yöntemdir, daha gelişmiş olan `buildNeighborsWithWeld` fonksiyonu tercih edilir.
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
  
  // ... (Bu fonksiyonun içi artık aktif olarak kullanılmadığından detaylı açıklama atlanmıştır) ...
  return [];
};

/**
 * (ESKİ YÖNTEM) Verilen köşe noktalarından bir vurgulama (highlight) mesh'i oluşturur.
 * Bu fonksiyon, `buildFaceOverlayFromHit` ile değiştirilmiştir.
 */
export const createFaceHighlight = (/*...args*/): THREE.Mesh => {
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
    // Varsa metin nesnesini kaldır.
    if ((highlight.mesh as any).textMesh) {
      const textMesh = (highlight.mesh as any).textMesh;
      scene.remove(textMesh);
      textMesh.geometry.dispose();
      textMesh.material.dispose();
    }
    // Vurgu mesh'ini kaldır.
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
    // ... (Kaldırma ve dispose işlemleri) ...
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
      // ... (Kaldırma ve dispose işlemleri) ...
  });
  
  // `currentHighlights` dizisini güncelle (splice ile).
  currentHighlights = currentHighlights.filter(h => !highlightsToRemove.includes(h));


  sceneObjectsToRemove.forEach(object => {
    scene.remove(object);
    if (object instanceof THREE.Mesh) {
      if (object.geometry) object.geometry.dispose();
      // ... (materyal dispose işlemleri) ...
    }
  });

  // ... (loglama) ...
};

/**
 * Sahnedeki tüm kalıcı (persistent) vurguları temizler.
 * @param scene - Three.js sahnesi.
 */
export const clearAllPersistentHighlights = (scene: THREE.Scene) => {
    // ... (clearTemporaryHighlights ile benzer mantık, sadece `isPersistent` olanları hedefler) ...
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
  boundaryLoops: number[][]; // Bölgenin dış sınırlarını oluşturan vertex döngüleri.
  weldedToWorld: Map<number, THREE.Vector3>; // Kaynaklanmış vertex ID'sinden dünya koordinatına harita.
};

// --- Algoritma Parametreleri ---
const QUANT_EPS = 1e-4; // Vertex'leri kaynaklamak için kullanılacak mesafe toleransı.
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
  // ... (Indexed ve non-indexed geometri için index verisi hazırlığı) ...
  let index = geom.index || new THREE.BufferAttribute(new Uint32Array(geom.attributes.position.count).map((_, i) => i), 1);
  const pos = geom.getAttribute('position') as THREE.BufferAttribute;

  // 1. Adım: Vertex Kaynaklama (Welding)
  // Her vertex'i dünya koordinatlarına çevir, posKey ile anahtarını oluştur ve
  // aynı anahtara sahip olanları tek bir "kaynaklanmış vertex ID"si altında birleştir.
  const keyToId = new Map<string, number>();
  const weldedIdToWorld = new Map<number, THREE.Vector3>(); // Welded ID -> World Position
  const vertToWelded = new Map<number, number>(); // Orijinal Vertex Index -> Welded ID
  let nextId = 0;
  // ... (for döngüsü içinde her vertex'i işleme) ...

  // 2. Adım: Kenar Bazlı Komşuluk Grafiği Oluşturma
  // Her üçgenin kenarlarını (kaynaklanmış vertex ID'leri ile) dolaş.
  // Bir kenar (örn: "10_25") eğer daha önce başka bir üçgen tarafından
  // eklendiyse, bu iki üçgen komşudur.
  const edgeMap = new Map<string, number>(); // Kenar anahtarı -> Üçgen indeksi
  const neighbors = new Map<number, number[]>(); // Üçgen indeksi -> Komşu üçgenler dizisi
  // ... (for döngüsü içinde her üçgeni işleme ve kenarları edgeMap'e ekleme) ...

  return { neighbors, /* ...diğer veriler... */ };
};

/**
 * Belirli bir üçgenin normalini dünya koordinatlarında hesaplar.
 */
const triNormalWorld = (mesh: THREE.Mesh, triIndex: number, index: THREE.BufferAttribute, pos: THREE.BufferAttribute) => {
    // ... (getFaceNormal fonksiyonuna benzer, ama doğrudan dünya matrisini uygular) ...
    return new THREE.Vector3(); // Placeholder
};

/**
 * Tıklanan bir üçgenden başlayarak, düzlemsel bir bölgeyi "büyüten" ana algoritma.
 * @param mesh - Üzerinde çalışılan mesh.
 * @param seedTri - Başlangıç üçgeninin indeksi.
 * @returns {RegionResult} Bulunan bölgenin detaylı analizi.
 */
const growRegion = (mesh: THREE.Mesh, seedTri: number): RegionResult => {
  // 1. Komşuluk grafiğini ve kaynaklanmış vertex verilerini oluştur.
  const { neighbors, triToWelded, weldedIdToWorld, index, posAttr } = buildNeighborsWithWeld(mesh, /*...*/);
  
  // 2. Başlangıç üçgeninin düzlemini ve normalini hesapla.
  let avgNormal = triNormalWorld(mesh, seedTri, index, posAttr);
  const seedPoint = weldedIdToWorld.get(triToWelded[seedTri][0])!;
  let plane = new THREE.Plane().setFromNormalAndCoplanarPoint(avgNormal, seedPoint);

  // 3. Yayma-Doldurma (Flood-Fill / BFS)
  // Bir kuyruk (queue) yapısı kullanarak başlangıç üçgeninden itibaren komşuları gez.
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
      
      // Komşu üçgenin normalini al.
      const n = triNormalWorld(mesh, nt, index, posAttr);
      
      // Açı Kontrolü: Normali, bölgenin ortalama normali ile karşılaştır. Açı farkı tolerans içindeyse devam et.
      if (n.dot(avgNormal) < Math.cos(THREE.MathUtils.degToRad(ANGLE_DEG))) continue;
      
      // Düzlem Kontrolü: Komşu üçgenin tüm vertex'leri, ana düzleme yeterince yakın mı?
      const wids = triToWelded[nt];
      const pa = weldedIdToWorld.get(wids[0])!;
      // ... (pb, pc) ...
      const distA = Math.abs(plane.distanceToPoint(pa));
      // ... (distB, distC) ...
      if (distA > PLANE_EPS || distB > PLANE_EPS || distC > PLANE_EPS) continue;
      
      // Eğer kontrollerden geçtiyse, bu üçgeni de bölgeye dahil et ve kuyruğa ekle.
      visited.add(nt);
      queue.push(nt);
      
      // Bölgenin ortalama normalini yeni eklenen üçgenin normali ile güncelleyerek daha hassas bir düzlem elde et.
      avgNormal.add(n).normalize();
      plane.setFromNormalAndCoplanarPoint(avgNormal, seedPoint);
    }
  }

  // 4. Sınır Döngülerini Bulma (Boundary Loop Detection)
  // Bölgedeki tüm üçgenlerin kenarlarını say. Sadece bir kez sayılan kenarlar, bölgenin dış sınırını oluşturur.
  // ... (kenar sayma ve sınır kenarlarını bulma mantığı) ...

  // 5. Sınır Kenarlarını Sıralayarak Döngüler Haline Getirme
  // Bulunan sınır kenarlarını uç uca ekleyerek sıralı bir veya daha fazla kapalı döngü (loop) oluştur.
  // ... (döngü oluşturma mantığı) ...

  return { triangles: region, normal: avgNormal, plane, boundaryLoops, weldedToWorld };
};

/**
 * `growRegion` tarafından bulunan düzlemsel bölgeden bir vurgulama (overlay) mesh'i oluşturur.
 * @param scene - Three.js sahnesi.
 * @param mesh - Orijinal mesh.
 * @param seedTri - Başlangıç üçgeni.
 * @returns {THREE.Mesh | null} Oluşturulan vurgu mesh'i veya başarısızsa null.
 */
const buildFaceOverlayFromHit = (/*...args*/): THREE.Mesh | null => {
  // 1. `growRegion` ile düzlemsel bölgeyi analiz et.
  const res = growRegion(mesh, seedTri);
  if (res.boundaryLoops.length === 0) return null;

  // 2. Bölgenin 3D sınır döngülerini 2D bir düzleme yansıt.
  // Bunun için bölgenin normaline dik olan `tangent` ve `bitangent` vektörleri kullanılır.
  // ... (2D'ye yansıtma mantığı) ...

  // 3. `THREE.ShapeUtils.triangulateShape` kullanarak 2D çokgeni (ve varsa içindeki delikleri) üçgenle.
  // Bu, karmaşık şekilli yüzeylerin bile doğru bir şekilde doldurulmasını sağlar.
  const triangles = THREE.ShapeUtils.triangulateShape(outerLoop2D, holeLoops2D);

  // 4. Üçgenlenmiş 2D şekli tekrar 3D'ye dönüştür ve yeni bir BufferGeometry oluştur.
  // Z-fighting (iki yüzeyin aynı yerde titremesi) sorununu önlemek için
  // vurgu mesh'i, orijinal yüzeyden çok az bir miktar (örn: 0.5 birim) dışarıda konumlandırılır.
  // ... (3D'ye dönüştürme ve geometri oluşturma) ...

  // 5. Yarı saydam bir materyal ile yeni mesh'i oluştur ve sahneye ekle.
  const mat = new THREE.MeshBasicMaterial({ /* ... */ });
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

  console.log(`🎯 Gelişmiş yüzey seçimi başlatıldı: yüzey ${hit.faceIndex}`);

  // Gelişmiş algoritmayı kullanarak tüm düzlemsel bölge için TEK bir vurgu mesh'i oluştur.
  const overlay = buildFaceOverlayFromHit(scene, mesh, hit.faceIndex, color, opacity, rowIndex, shape.id);
  if (!overlay) return null;
  
  // Vurgu mesh'inin `userData` özelliğine, onu daha sonra bulup silebilmek için
  // gerekli olan bilgileri (rowIndex, shapeId vb.) ekle. Bu çok önemlidir.
  overlay.userData = {
    rowIndex: rowIndex,
    faceIndex: hit.faceIndex,
    shapeId: shape.id,
    isPersistent: faceNumber !== undefined // Eğer bir yüzey numarası atanmışsa, bu kalıcı bir seçimdir.
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
  
  // ... (loglama) ...

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
  if (!geom.boundsTree) {
    geom.computeBoundsTree();
  }
  raycaster.setFromCamera(mouse, camera);

  // Kesişim testini yap.
  const intersects = raycaster.intersectObject(mesh, false);

  if (intersects.length > 0) {
    console.log('🎯 Yüzey tespit edildi:', { faceIndex: intersects[0].faceIndex });
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
