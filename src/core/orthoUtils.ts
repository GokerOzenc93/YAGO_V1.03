import * as THREE from 'three';
import { OrthoMode } from './appStore';

/**
 * Ortho mode constraint function - hareket vektörünü dominant eksene kısıtlar
 */
export const applyOrthoConstraint = (
  newPosition: THREE.Vector3,
  originalPosition: THREE.Vector3,
  orthoMode: OrthoMode
): THREE.Vector3 => {
  if (orthoMode === OrthoMode.OFF) {
    return newPosition;
  }
  
  // Hareket vektörünü hesapla
  const delta = new THREE.Vector3().subVectors(newPosition, originalPosition);
  
  // Mutlak değerleri al
  const absX = Math.abs(delta.x);
  const absY = Math.abs(delta.y);
  const absZ = Math.abs(delta.z);
  
  // Dominant ekseni bul ve sadece o eksende hareket et
  if (absX >= absY && absX >= absZ) {
    // X ekseni dominant - sadece X'te hareket
    return new THREE.Vector3(newPosition.x, originalPosition.y, originalPosition.z);
  } else if (absY >= absX && absY >= absZ) {
    // Y ekseni dominant - sadece Y'de hareket
    return new THREE.Vector3(originalPosition.x, newPosition.y, originalPosition.z);
  } else {
    // Z ekseni dominant - sadece Z'de hareket
    return new THREE.Vector3(originalPosition.x, originalPosition.y, newPosition.z);
  }
};

/**
 * Polyline için ortho constraint - bir önceki noktaya göre 90 derece kısıtlama
 */
export const applyPolylineOrthoConstraint = (
  currentPoint: THREE.Vector3,
  previousPoint: THREE.Vector3,
  orthoMode: OrthoMode
): THREE.Vector3 => {
  if (orthoMode === OrthoMode.OFF) {
    return currentPoint;
  }
  
  // Önceki noktadan mevcut noktaya vektör
  const delta = new THREE.Vector3().subVectors(currentPoint, previousPoint);
  
  // Mutlak değerleri al (sadece XZ düzleminde - 2D çizim için)
  const absX = Math.abs(delta.x);
  const absZ = Math.abs(delta.z);
  
  // Dominant ekseni bul ve tam 90 derece yap
  if (absX >= absZ) {
    // X ekseni dominant - tam yatay çizgi
    return new THREE.Vector3(currentPoint.x, previousPoint.y, previousPoint.z);
  } else {
    // Z ekseni dominant - tam dikey çizgi
    return new THREE.Vector3(previousPoint.x, previousPoint.y, currentPoint.z);
  }
};

/**
 * Rectangle için ortho constraint - tam dikdörtgen oluştur
 */
export const applyRectangleOrthoConstraint = (
  endPoint: THREE.Vector3,
  startPoint: THREE.Vector3,
  orthoMode: OrthoMode
): THREE.Vector3 => {
  if (orthoMode === OrthoMode.OFF) {
    return endPoint;
  }
  
  // Rectangle her zaman tam dikdörtgen olmalı (ortho mode'da)
  // X ve Z koordinatlarını koru, Y'yi başlangıç noktasıyla aynı yap
  return new THREE.Vector3(endPoint.x, startPoint.y, endPoint.z);
};

/**
 * Dimension için ortho constraint - tam dik ölçülendirme
 */
export const applyDimensionOrthoConstraint = (
  point: THREE.Vector3,
  referencePoint: THREE.Vector3,
  orthoMode: OrthoMode
): THREE.Vector3 => {
  if (orthoMode === OrthoMode.OFF) {
    return point;
  }
  
  // Referans noktasından mevcut noktaya vektör
  const delta = new THREE.Vector3().subVectors(point, referencePoint);
  
  // 3D ortamda tüm eksenleri kontrol et
  const absX = Math.abs(delta.x);
  const absY = Math.abs(delta.y);
  const absZ = Math.abs(delta.z);
  
  // Dominant ekseni bul
  if (absX >= absY && absX >= absZ) {
    // X ekseni dominant
    return new THREE.Vector3(point.x, referencePoint.y, referencePoint.z);
  } else if (absY >= absX && absY >= absZ) {
    // Y ekseni dominant
    return new THREE.Vector3(referencePoint.x, point.y, referencePoint.z);
  } else {
    // Z ekseni dominant
    return new THREE.Vector3(referencePoint.x, referencePoint.y, point.z);
  }
};