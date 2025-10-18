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
    <div className="w-full h-40 bg-orange-50 rounded-lg overflow-hidden border-2 border-orange-200">
      <Canvas dpr={[1, 2]} gl={{ preserveDrawingBuffer: true }}>
        <PerspectiveCamera makeDefault position={[200, 200, 200]} fov={50} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={2} />
        <ambientLight intensity={0.8} />
        <directionalLight position={[10, 10, 5]} intensity={1} castShadow />
        <directionalLight position={[-10, -10, -5]} intensity={0.5} />
        <mesh geometry={createGeometry()} castShadow receiveShadow>
          <meshStandardMaterial color="#0044cc" metalness={0.3} roughness={0.4} />
        </mesh>
        <gridHelper args={[500, 10, '#cccccc', '#eeeeee']} position={[0, -75, 0]} />
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
      setPosition({ x: window.innerWidth / 2 - 500, y: window.innerHeight / 2 - 350 });
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
        className="absolute bg-stone-50 rounded-2xl shadow-2xl w-full max-w-5xl h-[700px] border border-stone-300 flex flex-col pointer-events-auto"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="drag-handle flex items-center justify-between px-6 py-5 cursor-grab active:cursor-grabbing">
          <h1 className="text-2xl font-bold text-slate-900">Geometry Catalog</h1>
          <div className="flex items-center gap-3">
            <button
              onClick={() => {
                if (selectedItem) {
                  onLoad(selectedItem);
                  setSelectedItem(null);
                }
              }}
              disabled={!selectedItem}
              className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-md ${
                selectedItem
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed'
              }`}
            >
              <Plus size={18} strokeWidth={2.5} />
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
              className={`px-6 py-2.5 text-sm font-bold rounded-lg transition-all flex items-center gap-2 shadow-md ${
                selectedItem
                  ? 'bg-orange-400 text-white hover:bg-orange-500'
                  : 'bg-stone-300 text-stone-500 cursor-not-allowed'
              }`}
            >
              <Trash2 size={18} strokeWidth={2.5} />
              Delete
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-md hover:bg-stone-200 transition-colors ml-2"
            >
              <X size={20} className="text-slate-700" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto px-6 pb-6">
            <div className="grid grid-cols-2 gap-4">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`rounded-xl p-4 transition-all cursor-pointer border-2 ${
                    selectedItem?.id === item.id
                      ? 'border-orange-500 bg-white shadow-lg'
                      : 'border-orange-300 bg-orange-50 hover:border-orange-400 hover:shadow-md'
                  }`}
                >
                  <GeometryPreview geometryData={item.geometry_data} />

                  <div className="mt-4">
                    <h3 className="font-bold text-slate-900 text-base leading-tight">
                      {item.code} / {item.description || 'No description'}
                    </h3>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="w-64 bg-stone-100 flex flex-col">
            <div className="p-6">
              <h3 className="text-xs font-bold text-slate-900 mb-4 uppercase tracking-wider">CATEGORIES</h3>
              <div className="space-y-2">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`w-full text-left px-4 py-3 text-sm font-bold rounded-lg transition-colors flex items-center justify-between ${
                    !selectedTag
                      ? 'bg-orange-600 text-white shadow-md'
                      : 'bg-white text-slate-700 hover:bg-stone-200'
                  }`}
                >
                  <span>All Items</span>
                  <span className="text-sm font-bold">{items.length}</span>
                </button>
                {allTags.map(tag => {
                  const count = items.filter(item => item.tags.includes(tag)).length;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className={`w-full text-left px-4 py-3 text-sm font-bold rounded-lg transition-colors flex items-center justify-between uppercase ${
                        selectedTag === tag
                          ? 'bg-orange-600 text-white shadow-md'
                          : 'bg-white text-slate-700 hover:bg-stone-200'
                      }`}
                    >
                      <span>{tag}</span>
                      <span className="text-sm font-bold">{count}</span>
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
