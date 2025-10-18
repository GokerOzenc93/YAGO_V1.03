import React, { useEffect, useState, useRef, useMemo } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

interface CatalogItem {
  id: string;
  code: string;
  description: string;
  tags: string[];
  geometry_data: any;
  created_at: string;
}

interface CatalogPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onLoad: (item: CatalogItem) => void;
  onDelete: (id: string) => void;
  items: CatalogItem[];
}

const StaticMesh: React.FC<{ geometry: THREE.BufferGeometry; color: string; rotation: [number, number, number]; position: [number, number, number]; scale: [number, number, number] }> = ({ geometry, color, rotation, position, scale }) => {
  return (
    <mesh geometry={geometry} position={position} rotation={rotation} scale={scale}>
      <meshStandardMaterial color={color} metalness={0.3} roughness={0.4} />
    </mesh>
  );
};

const GeometryPreview: React.FC<{ geometryData: any }> = ({ geometryData }) => {
  const createGeometry = () => {
    const params = geometryData.parameters || {};

    switch (geometryData.type) {
      case 'box':
        return new THREE.BoxGeometry(
          params.width || 100,
          params.height || 100,
          params.depth || 100
        );
      case 'cylinder':
        return new THREE.CylinderGeometry(
          params.radiusTop || 50,
          params.radiusBottom || 50,
          params.height || 100,
          32
        );
      case 'sphere':
        return new THREE.SphereGeometry(params.radius || 50, 32, 32);
      case 'cone':
        return new THREE.ConeGeometry(params.radius || 40, params.height || 100, 32);
      default:
        return new THREE.BoxGeometry(100, 100, 100);
    }
  };

  const geometry = useMemo(() => createGeometry(), [geometryData]);

  const color = geometryData.color || '#2563eb';
  const scale = geometryData.scale || [1, 1, 1];
  const actualSize = geometryData.actualSize;

  const { cameraDistance, normalizedScale } = useMemo(() => {
    let maxDim: number;

    if (actualSize) {
      maxDim = Math.max(actualSize.width, actualSize.height, actualSize.depth);
    } else {
      const bbox = new THREE.Box3().setFromObject(new THREE.Mesh(geometry));
      const size = new THREE.Vector3();
      bbox.getSize(size);
      maxDim = Math.max(size.x * scale[0], size.y * scale[1], size.z * scale[2]);
    }

    const targetSize = 120;
    const fitScale = targetSize / maxDim;

    return {
      cameraDistance: 250,
      normalizedScale: [scale[0] * fitScale, scale[1] * fitScale, scale[2] * fitScale] as [number, number, number]
    };
  }, [geometry, scale, actualSize]);

  return (
    <div className="w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-slate-100 to-slate-200">
      <Canvas
        dpr={[1, 2]}
        gl={{ alpha: false, antialias: true }}
      >
        <color attach="background" args={['#f8fafc']} />
        <PerspectiveCamera makeDefault position={[cameraDistance * 0.8, cameraDistance * 0.7, cameraDistance * 0.8]} fov={35} />
        <OrbitControls enableZoom={false} enablePan={false} enableRotate={false} target={[0, 0, 0]} />
        <ambientLight intensity={1.2} />
        <directionalLight position={[5, 10, 5]} intensity={1.4} />
        <directionalLight position={[-5, -5, -5]} intensity={0.5} />

        <StaticMesh
          geometry={geometry}
          color={color}
          rotation={[-Math.PI / 6, Math.PI / 4, 0]}
          position={[0, 0, 0]}
          scale={normalizedScale}
        />
      </Canvas>
    </div>
  );
};

const CatalogPanel: React.FC<CatalogPanelProps> = ({ isOpen, onClose, onLoad, onDelete, items }) => {
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const allTags = Array.from(new Set(items.flatMap(item => item.tags)));

  const filteredItems = items.filter(item => {
    const matchesTag = !selectedTag || item.tags.includes(selectedTag);
    return matchesTag;
  });

  useEffect(() => {
    if (isOpen) {
      setPosition({ x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 350 });
    }
  }, [isOpen]);

  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.drag-handle')) {
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y
      });
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (isDragging) {
        setPosition({
          x: e.clientX - dragOffset.x,
          y: e.clientY - dragOffset.y
        });
      }
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      document.addEventListener('mousemove', handleMouseMove);
      document.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, dragOffset]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 pointer-events-none">
      <div
        ref={panelRef}
        className="absolute bg-stone-50 rounded-2xl shadow-2xl w-full max-w-3xl h-[700px] border border-stone-300 flex flex-col pointer-events-auto"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="drag-handle flex items-center justify-between px-5 py-4 cursor-grab active:cursor-grabbing">
          <h1 className="text-xl font-bold text-slate-900">Geometry Catalog</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedItem) {
                  onLoad(selectedItem);
                  setSelectedItem(null);
                }
              }}
              disabled={!selectedItem}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                selectedItem
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed'
              }`}
            >
              <Plus size={14} strokeWidth={2} />
              Insert
            </button>
            <button
              onClick={() => {
                if (selectedItem && confirm(`Delete "${selectedItem.code}"?`)) {
                  onDelete(selectedItem.id);
                  setSelectedItem(null);
                }
              }}
              disabled={!selectedItem}
              className={`px-3 py-1.5 text-xs font-medium rounded transition-all flex items-center gap-1 ${
                selectedItem
                  ? 'bg-orange-400 text-white hover:bg-orange-500'
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed'
              }`}
            >
              <Trash2 size={14} strokeWidth={2} />
              Delete
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded hover:bg-stone-200 transition-colors ml-1"
            >
              <X size={16} className="text-slate-700" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-x-auto px-5 pb-5">
            <div className="flex gap-3">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`flex-shrink-0 w-44 rounded-lg p-3 transition-all cursor-pointer border-2 ${
                    selectedItem?.id === item.id
                      ? 'border-orange-500 bg-white shadow-lg'
                      : 'border-orange-300 bg-orange-50 hover:border-orange-400 hover:shadow-md'
                  }`}
                >
                  <GeometryPreview geometryData={item.geometry_data} />

                  <div className="mt-2">
                    <h3 className="font-semibold text-slate-900 text-xs leading-tight">
                      {item.code} / {item.description || 'No description'}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-48 bg-stone-100 flex flex-col">
            <div className="p-4">
              <h3 className="text-[10px] font-semibold text-slate-600 mb-3 uppercase tracking-wide">Categories</h3>
              <div className="space-y-1.5">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`w-full text-left px-3 py-2 text-xs font-medium rounded transition-colors flex items-center justify-between ${
                    !selectedTag
                      ? 'bg-orange-600 text-white'
                      : 'bg-white text-slate-700 hover:bg-stone-200'
                  }`}
                >
                  <span>All Items</span>
                  <span className="text-xs">{items.length}</span>
                </button>
                {allTags.map(tag => {
                  const count = items.filter(item => item.tags.includes(tag)).length;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className={`w-full text-left px-3 py-2 text-xs font-medium rounded transition-colors flex items-center justify-between uppercase ${
                        selectedTag === tag
                          ? 'bg-orange-600 text-white'
                          : 'bg-white text-slate-700 hover:bg-stone-200'
                      }`}
                    >
                      <span>{tag}</span>
                      <span className="text-xs">{count}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CatalogPanel;
