import React, { useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { Shape } from '../types/shapes';
import { ViewMode, useAppStore } from '../store/appStore';
import { createExtrudedPanelGeometry } from '../utils/geometryUtils'; // Yeni yardımcı fonksiyonu import ettik

// NEW: Geometric face detection
interface GeometricFace {
  index: number;
  center: THREE.Vector3;
  normal: THREE.Vector3;
  area: number;
  vertices: THREE.Vector3[];
  bounds: THREE.Box3;
}

// NEW: Stored Panel data structure to hold detailed face info
interface StoredPanel {
  id: string; // Unique ID for the panel instance
  faceIndex: number;
  faceVertices: THREE.Vector3[]; // Vertices of the original face
  faceNormal: THREE.Vector3;    // Normal of the original face
  faceCenter: THREE.Vector3;    // Center of the original face
  panelOrder: number;
  // Panel'in kendi geometrisi ve transform bilgileri
  geometry: THREE.BufferGeometry;
  position: THREE.Vector3;
  rotation: THREE.Euler;
}

interface PanelManagerProps {
  shape: Shape;
  isAddPanelMode: boolean;
  selectedFaces: StoredPanel[]; // Artık sadece index değil, StoredPanel objeleri tutacak
  hoveredFace: number | null;
  showEdges: boolean;
  showFaces: boolean;
  onFaceSelect: (panelData: StoredPanel) => void; // Callback'i güncelledik
  onFaceHover: (faceIndex: number | null) => void;
  alwaysShowPanels?: boolean;
  isPanelEditMode?: boolean;
  onPanelSelect?: (panelData: {
    faceIndex: number;
    position: THREE.Vector3;
    size: THREE.Vector3;
    panelOrder: number;
  }) => void;
  onShowFaceSelection?: (faces: GeometricFace[], position: { x: number; y: number }) => void;
  onHideFaceSelection?: () => void;
  onSelectFace?: (faceIndex: number) => void;
  onDynamicFaceSelect?: (faceIndex: number) => void;
  selectedDynamicFace?: number | null;
  isDynamicSelectionMode?: boolean;
}

const PanelManager: React.FC<PanelManagerProps> = ({
  shape,
  isAddPanelMode,
  selectedFaces, // Artık StoredPanel dizisi
  hoveredFace,
  showEdges,
  showFaces,
  onFaceSelect,
  onFaceHover,
  alwaysShowPanels = false,
  isPanelEditMode = false,
  onPanelSelect,
  onShowFaceSelection,
  onHideFaceSelection,
  onSelectFace,
  onDynamicFaceSelect,
  selectedDynamicFace,
  isDynamicSelectionMode = false,
}) => {
  const panelThickness = 18; // 18mm panel thickness

  const { viewMode } = useAppStore();

  // NEW: Find closest face to a 3D point using geometric calculations
  // Bu fonksiyon artık dışarıdan çağrılmayacak, raycaster'dan gelen veriyi kullanacağız.
  // Ancak, face cycling için hala bir mantık tutabiliriz.

  const woodMaterials = useMemo(() => {
    const textureLoader = new THREE.TextureLoader();

    const woodTexture = textureLoader.load(
      'https://images.pexels.com/photos/6757411/pexels-photo-6757411.jpeg'
    );
    woodTexture.wrapS = THREE.RepeatWrapping;
    woodTexture.wrapT = THREE.RepeatWrapping;
    woodTexture.repeat.set(0.64, 0.64);
    woodTexture.anisotropy = 8;

    const woodNormalMap = textureLoader.load(
      'https://images.pexels.com/photos/6757411/pexels-photo-6757411.jpeg'
    );
    woodNormalMap.wrapS = THREE.RepeatWrapping;
    woodNormalMap.wrapT = THREE.RepeatWrapping;
    woodNormalMap.repeat.set(0.6, 0.6);
    woodNormalMap.anisotropy = 108;

    const baseMaterialProps = {
      metalness: 0.02,
      roughness: 1.1,
      clearcoat: 0.4,
      clearcoatRoughness: 0.1,
      reflectivity: 0.1,
      envMapIntensity: 0.4,
      emissive: new THREE.Color(0x000000),
      emissiveIntensity: 0.0,
      side: THREE.DoubleSide,
      map: woodTexture,
      normalMap: woodNormalMap,
      normalScale: new THREE.Vector2(0.4, 0.4),
      color: new THREE.Color(0xf3f6f4),
      transparent: false,
      opacity: 1.0,
      alphaTest: 0,
      depthWrite: true,
      depthTest: true,
      premultipliedAlpha: false,
      vertexColors: false,
      fog: true,
      flatShading: false,
      iridescence: 0.0,
      iridescenceIOR: 1.0,
      sheen: 0.1,
      sheenRoughness: 0.9,
      sheenColor: new THREE.Color(0xffffff),
      specularIntensity: 0.3,
      specularColor: new THREE.Color(0xffffff),
      transmission: 0.0,
      thickness: 0.0,
      attenuationDistance: Infinity,
      attenuationColor: new THREE.Color(0xffffff),
      ior: 1.2,
    };

    const verticalMaterial = new THREE.MeshPhysicalMaterial(baseMaterialProps);

    const horizontalMaterial = new THREE.MeshPhysicalMaterial({
      ...baseMaterialProps,
      map: woodTexture.clone(),
      normalMap: woodNormalMap.clone(),
    });
    horizontalMaterial.map!.rotation = Math.PI / 2;
    horizontalMaterial.normalMap!.rotation = Math.PI / 2;

    return {
      vertical: verticalMaterial,
      horizontal: horizontalMaterial,
    };
  }, []);

  // Panelleri StoredPanel verisine göre oluştur
  const smartPanelData = useMemo(() => {
    return selectedFaces.map((panelData) => {
      // createExtrudedPanelGeometry fonksiyonu, yüzeyin köşelerini alarak
      // panel geometrisini ve konum/dönüş bilgilerini döndürecek.
      const { geometry, position, rotation } = createExtrudedPanelGeometry(
        panelData.faceVertices,
        panelData.faceNormal,
        panelThickness
      );

      return {
        ...panelData, // StoredPanel'deki tüm bilgileri koru
        geometry,
        position,
        rotation,
      };
    });
  }, [selectedFaces, panelThickness]);

  const getPanelMaterial = (faceIndex: number) => {
    // Burada panelin yönüne göre materyal seçimi hala geçerli olabilir
    // Ancak daha dinamik paneller için bu mantık değişebilir veya kaldırılabilir.
    if (faceIndex === 2 || faceIndex === 3) { // Top/Bottom faces
      return woodMaterials.horizontal;
    }
    return woodMaterials.vertical; // Front/Back/Left/Right faces
  };

  const getPanelEdgeColor = () => {
    switch (viewMode) {
      case ViewMode.WIREFRAME:
        return '#ffffff'; // White edges in wireframe mode
      case ViewMode.TRANSPARENT:
        return '#000000'; // Black edges in transparent mode
      case ViewMode.SOLID:
        return '#2a2a2a'; // Dark gray in solid mode
      default:
        return '#2a2a2a';
    }
  };

  const getPanelEdgeLineWidth = () => {
    const screenWidth = window.innerWidth;
    if (screenWidth < 768) {
      return 1.0;
    } else if (screenWidth < 1024) {
      return 1.5;
    } else {
      return 2.0;
    }
  };

  // Dinamik yüzey seçimi ve panel ekleme mantığı
  const handleClick = useCallback((e: any, faceIndex: number, face: THREE.Face, object: THREE.Object3D) => {
    if (!isAddPanelMode) return;

    e.stopPropagation();

    // Raycaster'dan gelen yüzey bilgilerini kullanarak panel verisini oluştur
    const originalMesh = object as THREE.Mesh;
    const geometry = originalMesh.geometry as THREE.BufferGeometry;

    // Yüzeyin köşelerini al
    const positionAttribute = geometry.attributes.position;
    const vertices: THREE.Vector3[] = [];
    vertices.push(new THREE.Vector3().fromBufferAttribute(positionAttribute, face.a));
    vertices.push(new THREE.Vector3().fromBufferAttribute(positionAttribute, face.b));
    vertices.push(new THREE.Vector3().fromBufferAttribute(positionAttribute, face.c));

    // Eğer yüzey bir dörtgen ise (genellikle kutu geometrilerinde olduğu gibi)
    // d köşesini de eklememiz gerekebilir. Ancak Three.js face objeleri üçgenleri temsil eder.
    // Daha karmaşık şekiller için, yüzeyin tüm köşelerini doğru bir şekilde çıkarmak
    // için daha gelişmiş bir geometri işleme mantığı gerekebilir.
    // Şimdilik, üçgen yüzeyler için çalışacak şekilde tasarlayalım.

    // Yüzeyin normalini ve merkezini al
    const faceNormal = face.normal.clone();
    const faceCenter = new THREE.Vector3().addVectors(vertices[0], vertices[1]).add(vertices[2]).divideScalar(3);

    // Mesh'in dönüşünü ve konumunu uygulayarak dünya koordinatlarına çevir
    originalMesh.updateMatrixWorld(true); // Dünya matrisini güncelle
    faceNormal.applyQuaternion(originalMesh.quaternion).normalize();
    faceCenter.applyMatrix4(originalMesh.matrixWorld);
    vertices.forEach(v => v.applyMatrix4(originalMesh.matrixWorld));


    if (e.nativeEvent.button === 0) { // Sol click - Cycle through faces
      // Bu kısım, üst üste binen yüzeyler için döngüsel seçim mantığını içerir.
      // Şimdilik, sadece tıklanan yüzeyi seçelim.
      // Gerçek bir "cycle" için, tıklanan noktadaki tüm kesişimleri bulup
      // bunlar arasında geçiş yapma mantığına ihtiyaç vardır.
      // Basitlik adına, doğrudan seçilen yüzeyi işleyelim.
      const newPanel: StoredPanel = {
        id: THREE.MathUtils.generateUUID(), // Benzersiz ID
        faceIndex: faceIndex,
        faceVertices: vertices,
        faceNormal: faceNormal,
        faceCenter: faceCenter,
        panelOrder: selectedFaces.length, // Mevcut panel sayısına göre sıralama
        geometry: new THREE.BufferGeometry(), // Placeholder, useMemo'da oluşturulacak
        position: new THREE.Vector3(),
        rotation: new THREE.Euler(),
      };
      onFaceSelect(newPanel); // Seçilen yüzeyin detaylarını gönder
      console.log(`🎯 Panel added to face ${faceIndex} geometrically`);

    } else if (e.nativeEvent.button === 2) { // Sağ click - Confirm panel placement
      // Sağ tıklama ile panel ekleme mantığı, sol tıklama ile aynı olabilir
      // veya farklı bir onay mekanizması olarak kullanılabilir.
      // Şu an için sol tıklama ile doğrudan ekliyoruz.
      e.nativeEvent.preventDefault(); // Tarayıcının varsayılan sağ tık menüsünü engelle
      console.log(`🎯 Right click on face ${faceIndex}`);
    }
  }, [isAddPanelMode, onFaceSelect, selectedFaces.length]);


  // Panel edit modu için tıklama işleyicisi
  const handlePanelMeshClick = useCallback((e: any, panelData: StoredPanel) => {
    if (isPanelEditMode && onPanelSelect) {
      e.stopPropagation();
      // Panel'in gerçek boyutunu ve konumunu hesaplayıp gönder
      const bbox = new THREE.Box3().setFromBufferAttribute(panelData.geometry.attributes.position);
      const size = new THREE.Vector3();
      bbox.getSize(size);

      // Panel'in ana şekle göre göreceli konumu
      const relativePosition = panelData.position;

      onPanelSelect({
        faceIndex: panelData.faceIndex,
        position: relativePosition,
        size: size,
        panelOrder: panelData.panelOrder,
      });
      console.log(`🔴 Panel ${panelData.faceIndex} clicked for editing`);
    }
  }, [isPanelEditMode, onPanelSelect]);


  const handleFaceHover = (faceIndex: number | null) => {
    if ((isAddPanelMode || isPanelEditMode) && onFaceHover) {
      onFaceHover(faceIndex);
    }
  };

  const getFaceColor = (faceIndex: number) => {
    // Dinamik seçim vurgulama (her zaman panel modunda aktif)
    if (isAddPanelMode && selectedDynamicFace === faceIndex) {
      return '#fbbf24'; // Yellow for dynamically selected face
    }
    // selectedFaces artık StoredPanel objeleri içerdiğinden, faceIndex'i kontrol etmeliyiz
    if (selectedFaces.some(p => p.faceIndex === faceIndex)) return '#10b981'; // Green for confirmed selected
    if (hoveredFace === faceIndex) return '#eeeeee'; // Gray for hovered
    return '#3b82f6'; // Blue for default
  };

  const getFaceOpacity = (faceIndex: number) => {
    // Dinamik seçim görünürlüğü (her zaman panel modunda aktif)
    if (isAddPanelMode && selectedDynamicFace === faceIndex) {
      return 0.7; // More visible for selected face
    }
    // selectedFaces artık StoredPanel objeleri içerdiğinden, faceIndex'i kontrol etmeliyiz
    if (selectedFaces.some(p => p.faceIndex === faceIndex)) return 0.0;
    if (hoveredFace === faceIndex) return 0.0;
    return 0.001;
  };

  // Panelleri sadece isAddPanelMode veya isPanelEditMode aktifse göster
  // veya alwaysShowPanels true ise göster
  if (!isAddPanelMode && !alwaysShowPanels && !isPanelEditMode) {
    return null;
  }

  return (
    <group>
      {/* Individual face overlays for panel mode - ALL FACES VISIBLE */}
      {/* Bu kısım, raycaster'ın doğru yüzeyleri algılaması için hala gerekli olabilir.
          Ancak, eğer raycaster doğrudan ana mesh'in yüzeylerini algılayabiliyorsa,
          bu overlay'ler gereksiz hale gelebilir veya sadece görsel geri bildirim için kullanılabilir.
          Şimdilik, raycaster'ın ana mesh'in yüzeylerini algıladığını varsayarak
          bu overlay'leri sadece görsel işaretçi olarak tutuyoruz. */}
      {showFaces && shape.geometry && (
        <mesh
          geometry={shape.geometry}
          position={shape.position}
          rotation={shape.rotation}
          scale={shape.scale}
          onPointerMove={(e) => {
            e.stopPropagation();
            if (e.faceIndex !== undefined && e.faceIndex !== null) {
              handleFaceHover(e.faceIndex);
            } else {
              handleFaceHover(null);
            }
          }}
          onPointerLeave={() => handleFaceHover(null)}
          onClick={(e) => {
            if (e.face && e.faceIndex !== undefined && e.object) {
              handleClick(e, e.faceIndex, e.face, e.object);
            }
          }}
          onContextMenu={(e) => {
            // Sağ tık menüsünü engelle
            e.nativeEvent.preventDefault();
            if (e.face && e.faceIndex !== undefined && e.object) {
              handleClick(e, e.faceIndex, e.face, e.object); // Sağ tıkı da panel eklemek için kullanabiliriz
            }
          }}
          // Yüzeyleri görünmez yap ama tıklanabilir kalsın
          material={new THREE.MeshBasicMaterial({
            color: hoveredFace !== null ? getFaceColor(hoveredFace) : 0x3b82f6,
            transparent: true,
            opacity: hoveredFace !== null ? getFaceOpacity(hoveredFace) : 0.001,
            side: THREE.DoubleSide,
            depthTest: false,
          })}
        />
      )}


      {/* Dinamik olarak oluşturulan paneller */}
      {smartPanelData.map((panelData) => (
        <mesh
          key={panelData.id} // Benzersiz ID kullan
          geometry={panelData.geometry}
          position={[
            shape.position[0] + panelData.position.x,
            shape.position[1] + panelData.position.y,
            shape.position[2] + panelData.position.z,
          ]}
          rotation={panelData.rotation} // Panel'in kendi dönüşünü kullan
          scale={shape.scale} // Ana şeklin ölçeğini uygula
          castShadow
          receiveShadow
          visible={viewMode !== ViewMode.WIREFRAME}
          onClick={(e) => handlePanelMeshClick(e, panelData)}
        >
          {isPanelEditMode ? (
            <meshPhysicalMaterial
              color="#dc2626"
              roughness={0.6}
              metalness={0.02}
              transparent={viewMode === ViewMode.TRANSPARENT}
              opacity={viewMode === ViewMode.TRANSPARENT ? 0.3 : 1.0}
              depthWrite={viewMode === ViewMode.SOLID}
            />
          ) : (
            <meshPhysicalMaterial
              {...getPanelMaterial(panelData.faceIndex).parameters}
              transparent={viewMode === ViewMode.TRANSPARENT}
              opacity={viewMode === ViewMode.TRANSPARENT ? 0.3 : 1.0}
              depthWrite={viewMode === ViewMode.SOLID}
            />
          )}
        </mesh>
      ))}

      {/* Panel kenarları */}
      {smartPanelData.map((panelData) => (
        <lineSegments
          key={`panel-edges-${panelData.id}`} // Benzersiz ID kullan
          geometry={new THREE.EdgesGeometry(panelData.geometry)}
          position={[
            shape.position[0] + panelData.position.x,
            shape.position[1] + panelData.position.y,
            shape.position[2] + panelData.position.z,
          ]}
          rotation={panelData.rotation} // Panel'in kendi dönüşünü kullan
          scale={shape.scale}
          visible={
            viewMode === ViewMode.WIREFRAME ||
            isPanelEditMode ||
            selectedFaces.some(p => p.id === panelData.id) // ID'ye göre kontrol
          }
        >
          <lineBasicMaterial
            color={isPanelEditMode ? '#7f1d1d' : getPanelEdgeColor()}
            linewidth={getPanelEdgeLineWidth()}
            transparent={
              viewMode === ViewMode.TRANSPARENT ||
              viewMode === ViewMode.WIREFRAME
            }
            opacity={viewMode === ViewMode.TRANSPARENT ? 0.5 : 1.0}
            depthTest={viewMode === ViewMode.SOLID}
          />
        </lineSegments>
      ))}
    </group>
  );
};

export default PanelManager;
