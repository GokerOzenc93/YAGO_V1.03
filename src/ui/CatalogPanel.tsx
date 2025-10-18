import React, { useMemo, useRef, useState, useEffect } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";

// ===================================================
// 🔹 Tek tek kayıtlar için 3D önizleme bileşeni
// ===================================================
const GeometryPreview: React.FC<{ geometryData: any }> = ({ geometryData }) => {
  const meshRef = useRef<THREE.Mesh>(null);
  const [bounds, setBounds] = useState<THREE.Box3 | null>(null);

  // 🔹 Geometry oluşturucu
  const createGeometry = () => {
    const params = geometryData.parameters || {};
    switch (geometryData.type) {
      case "box":
        return new THREE.BoxGeometry(
          params.width || 100,
          params.height || 100,
          params.depth || 100
        );
      case "cylinder":
        return new THREE.CylinderGeometry(
          params.radiusTop || 50,
          params.radiusBottom || 50,
          params.height || 100,
          32
        );
      case "sphere":
        return new THREE.SphereGeometry(params.radius || 50, 32, 32);
      case "cone":
        return new THREE.ConeGeometry(params.radius || 40, params.height || 100, 32);
      default:
        return new THREE.BoxGeometry(100, 100, 100);
    }
  };

  const geometry = useMemo(() => createGeometry(), [geometryData]);

  // 🔹 Geometry boyutlarını ölç ve merkeze hizalama için sakla
  useEffect(() => {
    if (geometry) {
      const box = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
      setBounds(box);
    }
  }, [geometry]);

  // 🔹 Parametreler
  const color = geometryData.color || "#2563eb";
  const rotation = geometryData.rotation || [0, 0, 0];
  const position = geometryData.position || [0, 0, 0];
  const scale = geometryData.scale || [1, 1, 1];

  // 🔹 Kamera uzaklığı hesapla
  const cameraDistance = useMemo(() => {
    if (!bounds) return 250;
    const size = new THREE.Vector3();
    bounds.getSize(size);
    return Math.max(size.x, size.y, size.z) * 2.5;
  }, [bounds]);

  // 🔹 Döndürme animasyonu
  useFrame(() => {
    if (meshRef.current) {
      meshRef.current.rotation.y += 0.01;
    }
  });

  // 🔹 Merkezden hizalama
  const center = bounds ? bounds.getCenter(new THREE.Vector3()) : new THREE.Vector3(0, 0, 0);

  return (
    <div className="w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: false, antialias: true }}
        camera={{ position: [cameraDistance, cameraDistance, cameraDistance], fov: 35 }}
      >
        <color attach="background" args={["#f8fafc"]} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 10, 5]} intensity={1.4} />
        <directionalLight position={[-5, -5, -5]} intensity={0.5} />

        <group position={[-center.x, -center.y, -center.z]}>
          <mesh ref={meshRef} geometry={geometry} position={position} rotation={rotation} scale={scale}>
            <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
          </mesh>
        </group>

        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  );
};

// ===================================================
// 🔹 Katalog paneli
// ===================================================
interface CatalogItem {
  id: string;
  code: string;
  description: string;
  tags: string[];
  geometry_data: any;
  created_at: string;
}

interface CatalogPanelProps {
  items: CatalogItem[];
  onSelect: (item: CatalogItem) => void;
}

const CatalogPanel: React.FC<CatalogPanelProps> = ({ items, onSelect }) => {
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const handleSelect = (item: CatalogItem) => {
    setSelectedId(item.id);
    onSelect(item);
  };

  return (
    <div className="flex flex-col h-full bg-white border-l border-gray-200 overflow-y-auto">
      <div className="p-4 border-b">
        <h2 className="text-xl font-semibold text-gray-700">Mobilya Gövde Kataloğu</h2>
        <p className="text-sm text-gray-500 mt-1">
          Panel birleşim tipleri ve gövde seçenekleri
        </p>
      </div>

      <div className="p-4 grid grid-cols-2 gap-4">
        {items.map((item) => (
          <div
            key={item.id}
            className={`border rounded-xl shadow-sm hover:shadow-md transition-all cursor-pointer ${
              selectedId === item.id ? "ring-2 ring-blue-500" : ""
            }`}
            onClick={() => handleSelect(item)}
          >
            <GeometryPreview geometryData={item.geometry_data} />
            <div className="p-3">
              <h3 className="font-semibold text-gray-700 text-sm truncate">{item.code}</h3>
              <p className="text-xs text-gray-500 truncate">{item.description}</p>
              <div className="flex flex-wrap gap-1 mt-2">
                {item.tags.map((tag) => (
                  <span
                    key={tag}
                    className="bg-blue-50 text-blue-600 text-xs px-2 py-0.5 rounded-full"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default CatalogPanel;
