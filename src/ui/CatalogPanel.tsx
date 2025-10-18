import React, { useEffect, useState, useRef } from 'react';
import { X, Search, Tag, Download, Trash2, Ruler, Plus } from 'lucide-react';
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
    const dims = geometryData.dimensions;

    switch (geometryData.type) {
      case 'box':
        return new THREE.BoxGeometry(
          dims?.width || 100,
          dims?.height || 100,
          dims?.depth || 100
        );
      case 'cylinder':
        return new THREE.CylinderGeometry(
          dims?.radiusTop || 50,
          dims?.radiusBottom || 50,
          dims?.height || 100,
          32
        );
      case 'sphere':
        return new THREE.SphereGeometry(dims?.radius || 50, 32, 32);
      default:
        return new THREE.BoxGeometry(100, 100, 100);
    }
  };

  const geometry = createGeometry();

  return (
    <div className="w-full h-32 bg-stone-50 rounded-md overflow-hidden mb-3 border border-stone-200">
      <Canvas>
        <PerspectiveCamera makeDefault position={[150, 150, 150]} fov={50} />
        <ambientLight intensity={0.5} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <mesh geometry={geometry}>
          <meshStandardMaterial color={geometryData.color || '#2563eb'} />
          <lineSegments>
            <edgesGeometry args={[geometry]} />
            <lineBasicMaterial color="#1a1a1a" linewidth={1} />
          </lineSegments>
        </mesh>
        <OrbitControls enableZoom={false} enablePan={false} />
      </Canvas>
    </div>
  );
};

const CatalogPanel: React.FC<CatalogPanelProps> = ({ isOpen, onClose, onLoad, onDelete, items }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedItem, setSelectedItem] = useState<CatalogItem | null>(null);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const panelRef = useRef<HTMLDivElement>(null);

  const allTags = Array.from(new Set(items.flatMap(item => item.tags)));

  const filteredItems = items.filter(item => {
    const matchesSearch = item.code.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         item.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesTag = !selectedTag || item.tags.includes(selectedTag);
    return matchesSearch && matchesTag;
  });

  useEffect(() => {
    if (isOpen) {
      setPosition({ x: window.innerWidth / 2 - 400, y: window.innerHeight / 2 - 300 });
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
        className="absolute bg-white rounded-xl shadow-2xl w-full max-w-3xl h-[80vh] border border-stone-200 flex flex-col pointer-events-auto"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="drag-handle flex items-center justify-between px-4 py-3 border-b border-stone-200 cursor-grab active:cursor-grabbing">
          <h2 className="text-base font-semibold text-slate-800">Geometry Catalog</h2>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                if (selectedItem) {
                  onLoad(selectedItem);
                  setSelectedItem(null);
                }
              }}
              disabled={!selectedItem}
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                selectedItem
                  ? 'bg-orange-600 text-white hover:bg-orange-700'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <Plus size={14} />
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
              className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors flex items-center gap-1 ${
                selectedItem
                  ? 'bg-red-600 text-white hover:bg-red-700'
                  : 'bg-stone-200 text-stone-400 cursor-not-allowed'
              }`}
            >
              <Trash2 size={14} />
              Delete
            </button>
            <button
              onClick={onClose}
              className="p-1 rounded-md hover:bg-stone-100 transition-colors"
            >
              <X size={16} className="text-slate-600" />
            </button>
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-4">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-stone-500">
                <Tag size={48} className="mb-3 opacity-30" />
                <p className="text-lg font-medium">No items found</p>
                <p className="text-sm">Save geometries to build your catalog</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  onClick={() => setSelectedItem(item)}
                  className={`border rounded-lg p-3 hover:shadow-md transition-all cursor-pointer ${
                    selectedItem?.id === item.id
                      ? 'border-orange-500 bg-orange-50 shadow-md'
                      : 'border-stone-200 bg-white hover:border-orange-400'
                  }`}
                >
                  <GeometryPreview geometryData={item.geometry_data} />

                  <div className="mt-2">
                    <h3 className="font-semibold text-slate-800 text-xs mb-0.5">{item.code}</h3>
                    <p className="text-[10px] text-stone-600 line-clamp-1">{item.description || 'No description'}</p>
                  </div>

                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mt-2">
                      {item.tags.slice(0, 2).map(tag => (
                        <span
                          key={tag}
                          className="px-1.5 py-0.5 text-[10px] bg-orange-100 text-orange-700 rounded"
                        >
                          {tag}
                        </span>
                      ))}
                      {item.tags.length > 2 && (
                        <span className="px-1.5 py-0.5 text-[10px] bg-stone-100 text-stone-600 rounded">
                          +{item.tags.length - 2}
                        </span>
                      )}
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-[10px] text-slate-600 mt-2 bg-slate-50 px-2 py-1 rounded">
                    <Ruler size={10} className="text-slate-500" />
                    <span className="font-mono font-medium">{formatDimensions(item.geometry_data)}</span>
                  </div>
                </div>
              ))}
              </div>
            )}
          </div>

          <div className="w-56 border-l border-stone-200 bg-stone-50 overflow-y-auto flex flex-col">
            <div className="p-3 border-b border-stone-200">
              <div className="relative">
                <Search size={14} className="absolute left-2 top-2 text-stone-500" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search..."
                  className="w-full pl-8 pr-2 py-1.5 text-xs border border-stone-300 rounded focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 text-slate-800"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3">
              <h3 className="text-[10px] font-semibold text-slate-700 mb-2 uppercase tracking-wide">Categories</h3>
              <div className="space-y-0.5">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                    !selectedTag
                      ? 'bg-orange-600 text-white font-medium'
                      : 'text-slate-700 hover:bg-stone-200'
                  }`}
                >
                  All Items
                  <span className="float-right text-[10px] opacity-70">
                    {items.length}
                  </span>
                </button>
                {allTags.map(tag => {
                  const count = items.filter(item => item.tags.includes(tag)).length;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className={`w-full text-left px-2 py-1.5 text-xs rounded transition-colors ${
                        selectedTag === tag
                          ? 'bg-orange-600 text-white font-medium'
                          : 'text-slate-700 hover:bg-stone-200'
                      }`}
                    >
                      {tag}
                      <span className="float-right text-[10px] opacity-70">
                        {count}
                      </span>
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
