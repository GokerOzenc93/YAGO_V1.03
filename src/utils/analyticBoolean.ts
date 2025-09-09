@@ .. @@
 import * as THREE from 'three';
 import * as BufferGeometryUtils from 'three/examples/jsm/utils/BufferGeometryUtils.js';
 
-// Eksenlere hizalı bir sınırlayıcı kutuyu temsil eder (Axis-Aligned Bounding Box)
-type AABB = { min: THREE.Vector3; max: THREE.Vector3 };
+// Eksenlere hizalı bir sınırlayıcı kutuyu temsil eder (Axis-Aligned Bounding Box)
+interface AABB { 
+  min: THREE.Vector3; 
+  max: THREE.Vector3; 
+}
 
 /**
  * Bir şeklin dünya koordinatlarındaki AABB'sini alır.
@@ .. @@
  * @param shape Shape nesnesi
  * @returns {AABB} Şeklin AABB'si
  */
-function getAABBFromShape(shape): AABB {
+function getAABBFromShape(shape: any): AABB {
     const geometry = shape.geometry;
     geometry.computeBoundingBox();
     const bbox = geometry.boundingBox.clone();
@@ .. @@
  * @param targetShape - İçinden çıkarma yapılacak şekil.
  * @param subtractShape - Çıkarılacak şekil.
  * @returns {THREE.BufferGeometry | null} Sonuç geometri veya başarısız olursa null.
  */
-export function performAnalyticSubtract(targetShape, subtractShape): THREE.BufferGeometry | null {
+export function performAnalyticSubtract(targetShape: any, subtractShape: any): THREE.BufferGeometry | null {
     console.log("🎯 Analitik Çıkarma İşlemi Başlatıldı (AABB Yaklaşımı)");
     
     // Şekillerin dünya koordinatlarındaki AABB'lerini al.