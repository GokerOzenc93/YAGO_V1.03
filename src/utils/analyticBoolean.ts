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
    
    // Şeklin dünya matrisini uygula
    bbox.applyMatrix4(shape.matrixWorld);
    
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
    
    // Kesişen bölgeyi hesapla
    const intersectionAABB: AABB = {
        min: new THREE.Vector3(
            Math.max(targetAABB.min.x, subtractAABB.min.x),
            Math.max(targetAABB.min.y, subtractAABB.min.y),
            Math.max(targetAABB.min.z, subtractAABB.min.z)
        ),
        max: new THREE.Vector3(
            Math.min(targetAABB.max.x, subtractAABB.max.x),
            Math.min(targetAABB.max.y, subtractAABB.max.y),
            Math.min(targetAABB.max.z, subtractAABB.max.z)
        )
    };
    
    console.log("Kesişen bölge AABB:", intersectionAABB);
    
    // Basit yaklaşım: Target geometriyi döndür (gerçek çıkarma işlemi burada yapılacak)
    // Bu kısım daha karmaşık geometri işlemleri gerektirir
    console.log("🔄 Basit yaklaşım: Orijinal geometri döndürülüyor");
    
    return targetShape.geometry.clone();
}