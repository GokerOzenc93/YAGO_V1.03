import * as THREE from 'three';
import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';

// Eksenlere hizalı bir sınırlayıcı kutuyu temsil eder (Axis-Aligned Bounding Box)
interface AABB { 
  min: THREE.Vector3; 
  max: THREE.Vector3; 
}

/**
 * Bir şeklin dünya koordinatlarındaki AABB'sini alır.
 * @param shape Shape nesnesi
 * @returns {AABB} Şeklin AABB'si
 */
function getAABBFromShape(shape: any): AABB {
    const geometry = shape.geometry;
    geometry.computeBoundingBox();
    const bbox = geometry.boundingBox.clone();
    
    // Şeklin transform bilgilerinden dünya matrisini oluştur
    const matrix = new THREE.Matrix4();
    
    // Position, rotation ve scale bilgilerini kullanarak matrix oluştur
    const position = shape.position || new THREE.Vector3(0, 0, 0);
    const rotation = shape.rotation || shape.quaternion || new THREE.Euler(0, 0, 0);
    const scale = shape.scale || new THREE.Vector3(1, 1, 1);
    
    // Matrix'i compose et
    if (shape.quaternion) {
        matrix.compose(position, shape.quaternion, scale);
    } else {
        matrix.makeRotationFromEuler(rotation);
        matrix.scale(scale);
        matrix.setPosition(position);
    }
    
    // Oluşturulan matrisi bounding box'a uygula
    bbox.applyMatrix4(matrix);
    
    return {
        min: bbox.min,
        max: bbox.max
    };
}

/**
 * İki AABB'nin kesişip kesişmediğini kontrol eder.
 * @param aabb1 - İlk AABB.
 * @param aabb2 - İkinci AABB.
 * @returns {boolean} Kesişiyorsa true, aksi halde false.
 */
function aabbIntersects(aabb1: AABB, aabb2: AABB): boolean {
    return (
        aabb1.min.x <= aabb2.max.x && aabb1.max.x >= aabb2.min.x &&
        aabb1.min.y <= aabb2.max.y && aabb1.max.y >= aabb2.min.y &&
        aabb1.min.z <= aabb2.max.z && aabb1.max.z >= aabb2.min.z
    );
}

/**
 * Analitik çıkarma işlemi gerçekleştirir (AABB yaklaşımı).
 * @param targetShape - İçinden çıkarma yapılacak şekil.
 * @param subtractShape - Çıkarılacak şekil.
 * @returns {THREE.BufferGeometry | null} Sonuç geometri veya başarısız olursa null.
 */
export function performAnalyticSubtract(targetShape: any, subtractShape: any): THREE.BufferGeometry | null {
    console.log("🎯 Analitik Çıkarma İşlemi Başlatıldı (AABB Yaklaşımı)");
    
    // Şekillerin dünya koordinatlarındaki AABB'lerini al.
    const targetAABB = getAABBFromShape(targetShape);
    const subtractAABB = getAABBFromShape(subtractShape);
    
    console.log("Target AABB:", targetAABB);
    console.log("Subtract AABB:", subtractAABB);
    
    // AABB'lerin kesişip kesişmediğini kontrol et.
    if (!aabbIntersects(targetAABB, subtractAABB)) {
        console.log("⚠️ AABB'ler kesişmiyor, çıkarma işlemi yapılmayacak.");
        return targetShape.geometry.clone();
    }
    
    console.log("✅ AABB'ler kesişiyor, çıkarma işlemi devam ediyor.");
    
    // Analitik çıkarma sadece basit durumlar için çalışır
    // Karmaşık geometriler için null döndür ki CSG kullanılsın
    console.log("⚠️ Analitik çıkarma henüz tam olarak implement edilmedi, CSG'ye geçiliyor");
    return null;
}