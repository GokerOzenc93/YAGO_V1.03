import React, { useEffect, useState, useRef } from 'react';
import { X, Ruler, Plus, Trash2 } from 'lucide-react';
import { Canvas } from '@react-three/fiber';
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

const formatDimensions = (geometryData: any): string => {
  const params = geometryData.parameters || {};

  switch (geometryData.type) {
    case 'box':
      return `${params.width || 0} × ${params.height || 0} × ${params.depth || 0} mm`;
    case 'cylinder':
      return `Ø${(params.radiusTop || 0) * 2} × H${params.height || 0} mm`;
    case 'sphere':
      return `Ø${(params.radius || 0) * 2} mm`;
    default:
      return 'N/A';
  }
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
      default:
        return new THREE.BoxGeometry(100, 100, 100);
    }
  };

  return (
    <div className="w-full aspect-square rounded-lg overflow-hidden bg-gradient-to-br from-slate-50 to-slate-100">
      <Canvas dpr={[1, 2]} gl={{ alpha: false, antialias: true }}>
        <color attach="background" args={['#f8fafc']} />
        <PerspectiveCamera makeDefault position={[250, 250, 250]} fov={35} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={1} />
        <ambientLight intensity={1.5} />
        <directionalLight position={[10, 10, 10]} intensity={1.2} />
        <directionalLight position={[-10, -10, -10]} intensity={0.6} />
        <spotLight position={[0, 20, 0]} intensity={0.5} />
        <mesh geometry={createGeometry()}>
          <meshStandardMaterial color="#2563eb" metalness={0.1} roughness={0.3} />
        </mesh>
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
