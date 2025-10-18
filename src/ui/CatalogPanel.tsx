import React, { useEffect, useState, useRef } from 'react';
import { X, Search, Tag, Download, Trash2, Ruler } from 'lucide-react';
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
        className="absolute bg-white rounded-xl shadow-2xl w-full max-w-4xl h-[80vh] border border-stone-200 flex flex-col pointer-events-auto"
        style={{
          left: `${position.x}px`,
          top: `${position.y}px`,
          cursor: isDragging ? 'grabbing' : 'default'
        }}
        onMouseDown={handleMouseDown}
      >
        <div className="drag-handle flex items-center justify-between px-6 py-4 border-b border-stone-200 cursor-grab active:cursor-grabbing">
          <h2 className="text-lg font-semibold text-slate-800">Geometry Catalog</h2>
          <button
            onClick={onClose}
            className="p-1 rounded-md hover:bg-stone-100 transition-colors"
          >
            <X size={18} className="text-slate-600" />
          </button>
        </div>

        <div className="px-6 py-3 border-b border-stone-200">
          <div className="relative">
            <Search size={16} className="absolute left-3 top-2.5 text-stone-500" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by code or description..."
              className="w-full pl-10 pr-3 py-2 border border-stone-300 rounded-lg focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 text-slate-800"
            />
          </div>
        </div>

        <div className="flex-1 flex overflow-hidden">
          <div className="flex-1 overflow-y-auto p-6">
            {filteredItems.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-stone-500">
                <Tag size={48} className="mb-3 opacity-30" />
                <p className="text-lg font-medium">No items found</p>
                <p className="text-sm">Save geometries to build your catalog</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredItems.map(item => (
                <div
                  key={item.id}
                  className="border border-stone-200 rounded-lg p-4 hover:border-orange-400 hover:shadow-md transition-all bg-white"
                >
                  <GeometryPreview geometryData={item.geometry_data} />

                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <h3 className="font-semibold text-slate-800 text-sm mb-1">{item.code}</h3>
                      <p className="text-xs text-stone-600 line-clamp-2">{item.description || 'No description'}</p>
                    </div>
                  </div>

                  {item.tags.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {item.tags.map(tag => (
                        <span
                          key={tag}
                          className="px-2 py-0.5 text-xs bg-orange-100 text-orange-700 rounded-md"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center gap-1 text-[11px] text-slate-600 mb-3 bg-slate-50 px-2 py-1.5 rounded border border-slate-200">
                    <Ruler size={12} className="text-slate-500" />
                    <span className="font-mono font-medium">{formatDimensions(item.geometry_data)}</span>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        onLoad(item);
                      }}
                      className="flex-1 px-3 py-1.5 text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 rounded-md transition-colors flex items-center justify-center gap-1"
                    >
                      <Download size={14} />
                      Load
                    </button>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        if (confirm(`Delete "${item.code}"?`)) {
                          onDelete(item.id);
                        }
                      }}
                      className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-stone-200 hover:bg-red-100 hover:text-red-700 rounded-md transition-colors"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>

                  <p className="text-[10px] text-stone-500 mt-2">
                    {new Date(item.created_at).toLocaleDateString()}
                  </p>
                </div>
              ))}
              </div>
            )}
          </div>

          <div className="w-64 border-l border-stone-200 bg-stone-50 overflow-y-auto">
            <div className="p-4">
              <h3 className="text-xs font-semibold text-slate-700 mb-3 uppercase tracking-wide">Categories</h3>
              <div className="space-y-1">
                <button
                  onClick={() => setSelectedTag(null)}
                  className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                    !selectedTag
                      ? 'bg-orange-600 text-white font-medium'
                      : 'text-slate-700 hover:bg-stone-200'
                  }`}
                >
                  All Items
                  <span className="float-right text-xs opacity-70">
                    {items.length}
                  </span>
                </button>
                {allTags.map(tag => {
                  const count = items.filter(item => item.tags.includes(tag)).length;
                  return (
                    <button
                      key={tag}
                      onClick={() => setSelectedTag(tag)}
                      className={`w-full text-left px-3 py-2 text-sm rounded-md transition-colors ${
                        selectedTag === tag
                          ? 'bg-orange-600 text-white font-medium'
                          : 'text-slate-700 hover:bg-stone-200'
                      }`}
                    >
                      {tag}
                      <span className="float-right text-xs opacity-70">
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
