import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Pin,
  PinOff,
  ChevronLeft,
  ChevronRight,
  Puzzle,
  MousePointer,
  Layers,
  Save,
  Edit3,
  Archive,
  PanelLeft,
  Ruler,
  BarChart3,
  Plus,
  Check,
  Target,
} from 'lucide-react';
import { Shape } from '../../types/shapes';
import Module from './Module';
import { getSelectedFaceCount, clearFaceHighlight } from '../../utils/faceSelection';
import { saveVolumeToProject, createVolumeDataFromShape, getSavedVolumes, loadVolumeFromProject, deleteVolumeFromProject } from '../../utils/fileSystem';
import { useAppStore } from '../../store/appStore';
import { GeometryFactory } from '../../lib/geometryFactory';
import * as THREE from 'three';

interface EditModeProps {
  editedShape: Shape;
  onExit: () => void;
  hoveredFace: number | null;
  hoveredEdge: number | null;
  showEdges: boolean;
  setShowEdges: (show: boolean) => void;
  showFaces: boolean;
  setShowFaces: (show: boolean) => void;
  isFaceEditMode: boolean;
  setIsFaceEditMode: (mode: boolean) => void;
}

const EditMode: React.FC<EditModeProps> = ({
  editedShape,
  onExit,
  hoveredFace,
  hoveredEdge,
  showEdges,
  setShowEdges,
  showFaces,
  setShowFaces,
  isFaceEditMode,
  setIsFaceEditMode,
}) => {
  const { addShape, selectShape, updateShape } = useAppStore();
  const [panelHeight, setPanelHeight] = useState('calc(100vh - 108px)');
  const [panelTop, setPanelTop] = useState('88px');
  const [activeMainSection, setActiveMainSection] = useState<'volume' | 'panel' | null>(null);
  const [activeVolumeSubSection, setActiveVolumeSubSection] = useState<'library' | 'surface' | 'parameters' | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Varsayılan olarak sabitlenmiş (pinned) gelsin
  const [isLocked, setIsLocked] = useState(true); 
  
  // Volume name editing state
  const [volumeName, setVolumeName] = useState('AD06072');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(volumeName);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  
  const MIN_WIDTH_PX = 170;
  const MAX_WIDTH_PX = 453;
  const [panelWidth, setPanelWidth] = useState(250);
  const [isResizing, setIsResizing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startWidth = useRef(0);
  const hoverTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const nameInputRef = useRef<HTMLInputElement>(null);
  
  // Multi-select face tracking
  const [selectedFaceCount, setSelectedFaceCount] = useState(0);
  
  // Face list with roles
  const [selectedFaces, setSelectedFaces] = useState<Array<{index: number, role: string}>>([]);
  
  // New face input state
  const [newFaceIndex, setNewFaceIndex] = useState('');
  const [pendingFaceSelection, setPendingFaceSelection] = useState<number | null>(null);
  
  // Update selected face count periodically
  useEffect(() => {
    const updateFaceCount = () => {
      setSelectedFaceCount(getSelectedFaceCount());
    };
    
    const interval = setInterval(updateFaceCount, 100);
    return () => clearInterval(interval);
  }, []);

  // Focus input when editing starts
  useEffect(() => {
    if (isEditingName && nameInputRef.current) {
      nameInputRef.current.focus();
      nameInputRef.current.select();
    }
  }, [isEditingName]);

  const handleNameEdit = () => {
    setTempName(volumeName);
    setIsEditingName(true);
  };

  const handleNameSave = () => {
    if (tempName.trim()) {
      setVolumeName(tempName.trim());
    }
    setIsEditingName(false);
  };

  const handleNameCancel = () => {
    setTempName(volumeName);
    setIsEditingName(false);
  };

  const handleNameKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleNameSave();
    } else if (e.key === 'Escape') {
      handleNameCancel();
    }
  };

  const handleSaveVolume = async () => {
    try {
      const volumeData = createVolumeDataFromShape(editedShape, volumeName);
      const success = await saveVolumeToProject(volumeName, volumeData);
      
      if (success) {
        console.log(`✅ Volume "${volumeName}" saved successfully`);
        alert(`✅ Volume "${volumeName}" saved to project!`);
      } else {
        console.error(`❌ Failed to save volume "${volumeName}"`);
        alert(`❌ Failed to save volume "${volumeName}"`);
      }
    } catch (error) {
      console.error('❌ Error saving volume:', error);
      alert(`❌ Error saving volume: ${error}`);
    }
  };

  const handleVolumeSelect = async (volumeName: string) => {
    try {
      console.log(`🎯 Loading volume: ${volumeName}`);
      const volumeData = await loadVolumeFromProject(volumeName);
      
      // Get current dimensions from edited shape
      const currentGeometry = editedShape.geometry;
      currentGeometry.computeBoundingBox();
      const bbox = currentGeometry.boundingBox;
      
      if (!bbox) {
        console.warn('Could not compute current dimensions, using default values');
        return;
      }
      
      // Calculate current actual dimensions (geometry * scale)
      const currentWidth = (bbox.max.x - bbox.min.x) * editedShape.scale[0];
      const currentHeight = (bbox.max.y - bbox.min.y) * editedShape.scale[1];
      const currentDepth = (bbox.max.z - bbox.min.z) * editedShape.scale[2];
      
      console.log(`🎯 Current dimensions: W=${currentWidth.toFixed(1)}, H=${currentHeight.toFixed(1)}, D=${currentDepth.toFixed(1)}`);
      
      // 🎯 COMPLEX GEOMETRY RECONSTRUCTION
      let geometry: THREE.BufferGeometry;
      let newParameters: any = {};
      
      // Check if we have complex geometry data (boolean operations, etc.)
      if (volumeData.geometryData && volumeData.geometryData.vertices.length > 0) {
        console.log(`🎯 Reconstructing complex geometry: ${volumeData.geometryData.vertexCount} vertices`);
        
        // Create BufferGeometry from stored vertex data
        geometry = new THREE.BufferGeometry();
        
        // Convert stored vertices back to Float32Array
        const positions = new Float32Array(volumeData.geometryData.vertices.length * 3);
        volumeData.geometryData.vertices.forEach((vertex, i) => {
          positions[i * 3] = vertex.x;
          positions[i * 3 + 1] = vertex.y;
          positions[i * 3 + 2] = vertex.z;
        });
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        // Add indices if available
        if (volumeData.geometryData.indices) {
          geometry.setIndex(volumeData.geometryData.indices);
        }
        
        // Compute normals and bounds
        geometry.computeVertexNormals();
        geometry.computeBoundingBox();
        geometry.computeBoundingSphere();
        
        newParameters = {
          width: currentWidth,
          height: currentHeight,
          depth: currentDepth,
          complexGeometry: true,
          originalVertexCount: volumeData.geometryData.vertexCount,
          originalTriangleCount: volumeData.geometryData.triangleCount
        };
        
        console.log(`✅ Complex geometry reconstructed: ${volumeData.geometryData.triangleCount} triangles`);
        
      } else if (volumeData.originalPoints && volumeData.originalPoints.length > 0) {
        // Reconstruct polyline/polygon geometry
        console.log(`🎯 Reconstructing polyline geometry: ${volumeData.originalPoints.length} points`);
        
        // Convert stored points back to THREE.Vector3
        const points = volumeData.originalPoints.map(p => new THREE.Vector3(p.x, p.y, p.z));
        
        // Use current height for extrusion
        geometry = await GeometryFactory.createPolyline(points, currentHeight);
        
        newParameters = {
          points: volumeData.originalPoints.length,
          height: currentHeight,
          area: 'calculated',
          originalPoints: points
        };
        
        console.log(`✅ Polyline geometry reconstructed with ${points.length} points`);
        
      } else {
        // Standard geometry types (box, cylinder)
        if (volumeData.type === 'box' || volumeData.type.includes('rectangle')) {
          geometry = await GeometryFactory.createBox(currentWidth, currentHeight, currentDepth);
          newParameters = {
            width: currentWidth,
            height: currentHeight,
            depth: currentDepth
          };
        } else if (volumeData.type === 'cylinder' || volumeData.type.includes('circle')) {
          const currentRadius = currentWidth / 2;
          geometry = await GeometryFactory.createCylinder(currentRadius, currentHeight);
          newParameters = {
            radius: currentRadius,
            height: currentHeight
          };
        } else {
          // Fallback to box
          geometry = await GeometryFactory.createBox(currentWidth, currentHeight, currentDepth);
          newParameters = {
            width: currentWidth,
            height: currentHeight,
            depth: currentDepth
          };
        }
      }
      
      // Replace current edited shape with loaded volume data
      // Keep the same position, rotation, and scale as current edited shape
      updateShape(editedShape.id, {
        type: volumeData.type,
        geometry: geometry,
        parameters: newParameters,
        originalPoints: volumeData.originalPoints ? volumeData.originalPoints.map(p => new THREE.Vector3(p.x, p.y, p.z)) : undefined,
        is2DShape: volumeData.is2DShape || false,
        // Explicitly keep current transform properties
        position: editedShape.position,
        rotation: editedShape.rotation,
        scale: editedShape.scale,
      });
      
      // Update volume name to loaded volume name
      setVolumeName(volumeName);
      
      console.log(`✅ Volume loaded successfully: ${volumeName}`);
      console.log(`🎯 Volume type changed to: ${volumeData.type} with current dimensions preserved`);
      console.log(`🎯 New parameters:`, newParameters);
      
    } catch (error) {
      console.error('❌ Error loading volume:', error);
      alert(`❌ Failed to load volume "${volumeName}": ${error}`);
    }
  };

  const handleVolumeDelete = (volumeName: string) => {
    // Confirmation dialog
    const confirmed = window.confirm(`Are you sure you want to delete volume "${volumeName}"?`);
    
    if (confirmed) {
      try {
        const success = deleteVolumeFromProject(volumeName);
        
        if (success) {
          console.log(`✅ Volume "${volumeName}" deleted successfully`);
          // Force re-render by updating refresh trigger
          setRefreshTrigger(prev => prev + 1);
        } else {
          console.error(`❌ Failed to delete volume "${volumeName}"`);
          alert(`❌ Failed to delete volume "${volumeName}"`);
        }
      } catch (error) {
        console.error('❌ Error deleting volume:', error);
        alert(`❌ Error deleting volume: ${error}`);
      }
    }
  };
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isResizing || !panelRef.current) return;
      const newWidth = Math.max(MIN_WIDTH_PX, Math.min(startWidth.current + (e.clientX - startX.current), MAX_WIDTH_PX));
      setPanelWidth(newWidth);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
    };

    if (isResizing) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isResizing]);

  useEffect(() => {
    const calculatePanelPositionAndHeight = () => {
      const toolbarElement = document.querySelector('.flex.flex-col.font-inter');
      const topOffset = toolbarElement ? toolbarElement.clientHeight : 88;

      const terminalElement = document.querySelector('.fixed.bottom-0.left-0.right-0.z-30');
      const statusBarElement = document.querySelector('.flex.items-center.justify-between.h-5.px-2.text-xs.bg-gray-800\\/80');

      let bottomOffset = 0;

      if (terminalElement) {
        bottomOffset = terminalElement.clientHeight;
      } else if (statusBarElement) {
        bottomOffset = statusBarElement.clientHeight;
      } else {
        bottomOffset = 20;
      }

      const availableHeight = window.innerHeight - topOffset - bottomOffset;
      const newHeight = Math.max(availableHeight, 200);
      const newTop = topOffset;

      setPanelHeight(`${newHeight}px`);
      setPanelTop(`${newTop}px`);
    };

    calculatePanelPositionAndHeight();

    let resizeTimeoutId: NodeJS.Timeout;
    const debouncedCalculate = () => {
      clearTimeout(resizeTimeoutId);
      resizeTimeoutId = setTimeout(calculatePanelPositionAndHeight, 50);
    };

    window.addEventListener('resize', debouncedCalculate);
    const observer = new MutationObserver(debouncedCalculate);
    observer.observe(document.body, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'style'],
    });

    return () => {
      clearTimeout(resizeTimeoutId);
      window.removeEventListener('resize', debouncedCalculate);
      observer.disconnect();
    };
  }, []);

  const handleClose = () => {
    setActiveMainSection(null);
    setActiveVolumeSubSection(null);
    setIsFaceEditMode(false);
    onExit();
  };

  const handleMainSectionClick = (section: 'volume' | 'panel') => {
    if (activeMainSection === section) {
      setActiveMainSection(null);
      setActiveVolumeSubSection(null);
    } else {
      setActiveMainSection(section);
      setActiveVolumeSubSection(null);
    }
  };

  const handleVolumeSubSectionClick = (subSection: 'library' | 'surface' | 'parameters') => {
    if (activeVolumeSubSection === subSection) {
      setActiveVolumeSubSection(null);
    } else {
      setActiveVolumeSubSection(subSection);
    }
  };

  const handleBackToMain = () => {
    if (activeVolumeSubSection) {
      setActiveVolumeSubSection(null);
    } else {
      setActiveMainSection(null);
    }
  };

  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
    }
    if (!isLocked && !isResizing) {
      setIsCollapsed(false);
    }
  };

  const handleMouseLeave = () => {
    if (!isLocked && !isResizing) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsCollapsed(true);
      }, 300);
    }
  };

  const toggleLock = () => {
    setIsLocked(!isLocked);
    if (!isLocked) {
      setIsCollapsed(false);
    }
  };

  const handleCollapse = () => {
    setIsCollapsed(true);
  };
  
  const handleExpand = () => {
    setIsCollapsed(false);
  };

  const handleResizeMouseDown = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    startX.current = e.clientX;
    startWidth.current = panelRef.current?.clientWidth || 250;
  };

  const getIconButtonColorClasses = (color: string, isActive: boolean) => {
    const baseClasses = 'relative flex items-center rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98] shadow-sm';

    if (isActive) {
      if (color === 'blue') {
        return `${baseClasses} bg-blue-600 text-white shadow-lg shadow-blue-500/25`;
      } else if (color === 'green') {
        return `${baseClasses} bg-green-600 text-white shadow-lg shadow-green-500/25`;
      } else {
        return `${baseClasses} bg-violet-600 text-white shadow-lg shadow-violet-500/25`;
      }
    } else {
      return `${baseClasses} bg-gray-50 text-gray-600 hover:bg-white hover:text-blue-600 border border-gray-200`;
    }
  };

  const toggleFaceEditMode = () => {
    const newMode = !isFaceEditMode;
    setIsFaceEditMode(newMode);
    
    if (newMode) {
      console.log('🎯 Face Edit Mode ACTIVATED - Click on faces to select them');
      console.log('🎯 Hold Shift to select multiple faces');
    } else {
      console.log('🎯 Face Edit Mode DEACTIVATED');
      // Clear all highlights when exiting face edit mode
      if (sceneRef) {
        clearFaceHighlight(sceneRef);
      }
    }
  };
  
  const clearAllFaceSelections = () => {
    if (sceneRef) {
      clearFaceHighlight(sceneRef);
      setSelectedFaceCount(0);
      setSelectedFaces([]);
      console.log('🎯 All face selections cleared');
    }
  };
  
  // Get scene reference
  const [sceneRef, setSceneRef] = useState<THREE.Scene | null>(null);
  
  useEffect(() => {
    // Try to get scene reference from Three.js context
    const scene = (window as any).currentScene;
    if (scene) {
      setSceneRef(scene);
    }
  }, []);

  const [activeComponent, setActiveComponent] = useState<string | null>(null);

  const renderComponentContent = () => {
    switch (activeComponent) {
      case 'volumeParameters':
        return <Module editedShape={editedShape} onClose={() => setActiveComponent(null)} />;
      default:
        return null;
    }
  };

  // Face role management functions
  const updateFaceRole = (faceListIndex: number, role: string) => {
    setSelectedFaces(prev => prev.map((face, index) => 
      index === faceListIndex ? { ...face, role } : face
    ));
  };

  const removeFaceFromList = (faceListIndex: number) => {
    setSelectedFaces(prev => prev.filter((_, index) => index !== faceListIndex));
  };

  const addFaceToList = (faceIndex: number) => {
    // Check if face already exists in list
    const exists = selectedFaces.some(face => face.index === faceIndex);
    if (!exists) {
      setSelectedFaces(prev => [...prev, { index: faceIndex, role: '' }]);
      console.log(`🎯 Face ${faceIndex} added to list`);
    }
  };

  const handleAddNewFace = () => {
    const index = parseInt(newFaceIndex);
    if (!isNaN(index) && index >= 0) {
      const exists = selectedFaces.some(face => face.index === index);
      if (!exists) {
        setSelectedFaces(prev => [...prev, { index: index, role: '' }]);
        setNewFaceIndex('');
        console.log(`🎯 Face ${index} manually added to list`);
      } else {
        console.log(`🎯 Face ${index} already exists in list`);
      }
    }
  };

  const handleFaceSelectionMode = (faceIndex: number) => {
    setPendingFaceSelection(faceIndex);
    setIsFaceEditMode(true);
    console.log(`🎯 Face selection mode activated for index ${faceIndex}`);
  };

  const handleConfirmFaceSelection = (faceIndex: number) => {
    if (pendingFaceSelection !== null) {
      // Update the face index in the list
      setSelectedFaces(prev => prev.map(face => 
        face.index === pendingFaceSelection ? { ...face, index: faceIndex } : face
      ));
      setPendingFaceSelection(null);
      setIsFaceEditMode(false);
      console.log(`🎯 Face ${pendingFaceSelection} updated to ${faceIndex}`);
    }
  };
  return (
    <div
      ref={panelRef}
      className={`fixed left-0 z-50 bg-white backdrop-blur-sm border-r border-gray-200 shadow-xl rounded-r-xl flex flex-col transition-all duration-300 ease-in-out group`}
      style={{
        top: panelTop,
        height: panelHeight,
        width: isCollapsed ? '4px' : `${panelWidth}px`,
      }}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onSelectStart={(e) => e.preventDefault()}
      onDragStart={(e) => e.preventDefault()}
    >
      {isCollapsed && (
        <button
          onClick={handleExpand}
          className="absolute top-1/2 -translate-y-1/2 left-full -translate-x-1/2 bg-white p-2 rounded-full shadow-lg border border-gray-200 transition-all duration-300 group-hover:left-1/2 group-hover:-translate-x-1/2"
          title="Paneli Genişlet"
        >
          <ChevronRight size={16} className="text-blue-600 group-hover:text-blue-700" />
        </button>
      )}

      {!isCollapsed && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-3 pt-4 border-b border-gray-200">
            <div className="flex items-center gap-2 flex-1">
              {isEditingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  onBlur={handleNameSave}
                  className="text-gray-900 font-inter text-base font-bold bg-transparent border-b border-blue-500 outline-none flex-1 min-w-0"
                  maxLength={20}
                />
              ) : (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="text-gray-900 font-inter text-base font-bold truncate">
                    {volumeName}
                  </span>
                  <button
                    onClick={handleNameEdit}
                    className="text-gray-500 hover:text-blue-600 p-0.5 rounded transition-colors flex-shrink-0"
                    title="Edit Name"
                  >
                    <Edit3 size={12} />
                  </button>
                </div>
              )}
              
              <button
                onClick={handleSaveVolume}
                className="text-gray-500 hover:text-green-600 p-1.5 rounded-lg transition-colors bg-gray-50 hover:bg-green-50 flex-shrink-0"
                title="Save Volume"
              >
                <Save size={14} />
              </button>
            </div>
            
            {/* Panel genişliği 200px'ten büyükse düğmeleri göster*/}
            {panelWidth > 200 && (
              <div className="flex items-center gap-1">
                {isLocked && (
                  <button
                    onClick={handleCollapse}
                    className="text-gray-500 hover:text-blue-600 p-1.5 rounded-lg transition-colors bg-gray-50 hover:bg-blue-50"
                    title="Arayüzü Küçült"
                  >
                    <ChevronLeft size={14} />
                  </button>
                )}
                
                <button
                  onClick={toggleLock}
                  className={`p-1 rounded transition-colors ${
                    isLocked ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-blue-600 bg-gray-50 hover:bg-blue-50'
                  }`}
                  title={isLocked ? 'Paneli Çöz' : 'Paneli Sabitle'}
                >
                  {isLocked ? <Pin size={14} /> : <PinOff size={14} />}
                </button>
                
                <button
                  onClick={handleClose}
                  className="text-gray-500 hover:text-red-600 p-1.5 rounded-lg transition-colors bg-gray-50 hover:bg-red-50"
                  title="Düzenleme Modundan Çık"
                >
                  <X size={14} />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Ana Menü - Volume ve Panel seçimi */}
            {!activeMainSection && (
              <div className="flex-1 p-4 space-y-3">
                {/* Volume Button */}
                <button
                  onClick={() => handleMainSectionClick('volume')}
                  className="w-full p-4 bg-white rounded-lg border border-stone-200 hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center group-hover:bg-orange-200 transition-colors">
                      <Puzzle size={20} className="text-orange-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-slate-800 group-hover:text-orange-700">Volume</h3>
                      <p className="text-sm text-slate-600">Manage volume properties and library</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-orange-600" />
                  </div>
                </button>

                {/* Panel Button */}
                <button
                  onClick={() => handleMainSectionClick('panel')}
                  className="w-full p-4 bg-white rounded-lg border border-stone-200 hover:border-blue-300 hover:bg-blue-50 transition-all duration-200 group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center group-hover:bg-blue-200 transition-colors">
                      <PanelLeft size={20} className="text-blue-600" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="font-semibold text-slate-800 group-hover:text-blue-700">Panel</h3>
                      <p className="text-sm text-slate-600">Panel management and configuration</p>
                    </div>
                    <ChevronRight size={16} className="text-slate-400 group-hover:text-blue-600" />
                  </div>
                </button>
              </div>
            )}

            {/* Volume Ana Menüsü */}
            {activeMainSection === 'volume' && !activeVolumeSubSection && (
              <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-3 bg-orange-50 border-b border-orange-200">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBackToMain}
                      className="p-1 hover:bg-orange-200 rounded transition-colors"
                    >
                      <ChevronLeft size={16} className="text-orange-600" />
                    </button>
                    <Puzzle size={16} className="text-orange-600" />
                    <span className="font-semibold text-orange-800">Volume</span>
                  </div>
                </div>

                {/* Volume Alt Menüleri */}
                <div className="flex-1 p-4 space-y-3">
                  {/* Volume Library */}
                  <button
                    onClick={() => handleVolumeSubSectionClick('library')}
                    className="w-full p-3 bg-white rounded-lg border border-stone-200 hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <Archive size={16} className="text-orange-600" />
                      <div className="flex-1 text-left">
                        <h4 className="font-medium text-slate-800">Volume Library</h4>
                        <p className="text-xs text-slate-600">Saved volumes and templates</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-400 group-hover:text-orange-600" />
                    </div>
                  </button>

                  {/* Surface Specification */}
                  <button
                    onClick={() => handleVolumeSubSectionClick('surface')}
                    className="w-full p-3 bg-white rounded-lg border border-stone-200 hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <MousePointer size={16} className="text-orange-600" />
                      <div className="flex-1 text-left">
                        <h4 className="font-medium text-slate-800">Surface Specification</h4>
                        <p className="text-xs text-slate-600">Select and edit surfaces</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-400 group-hover:text-orange-600" />
                    </div>
                  </button>

                  {/* Volume Parameters */}
                  <button
                    onClick={() => handleVolumeSubSectionClick('parameters')}
                    className="w-full p-3 bg-white rounded-lg border border-stone-200 hover:border-orange-300 hover:bg-orange-50 transition-all duration-200 group"
                  >
                    <div className="flex items-center gap-3">
                      <Ruler size={16} className="text-orange-600" />
                      <div className="flex-1 text-left">
                        <h4 className="font-medium text-slate-800">Volume Parameters</h4>
                        <p className="text-xs text-slate-600">Dimensions and properties</p>
                      </div>
                      <ChevronRight size={14} className="text-slate-400 group-hover:text-orange-600" />
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Volume Library İçeriği */}
            {activeMainSection === 'volume' && activeVolumeSubSection === 'library' && (
              <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-3 bg-orange-50 border-b border-orange-200">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBackToMain}
                      className="p-1 hover:bg-orange-200 rounded transition-colors"
                    >
                      <ChevronLeft size={16} className="text-orange-600" />
                    </button>
                    <Archive size={16} className="text-orange-600" />
                    <span className="font-semibold text-orange-800">Volume Library</span>
                  </div>
                </div>

                {/* Library Content */}
                <div className="flex-1 p-4">
                  <div className="space-y-2">
                    {getSavedVolumes().map((volumeName) => (
                      <div key={volumeName} className="flex items-center justify-between p-3 bg-white rounded-lg border border-stone-200">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-orange-100 rounded flex items-center justify-center">
                            <Archive size={14} className="text-orange-600" />
                          </div>
                          <span className="font-medium text-slate-800">{volumeName}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => handleVolumeSelect(volumeName)}
                            className="px-2 py-1 text-xs bg-orange-100 text-orange-700 rounded hover:bg-orange-200 transition-colors"
                          >
                            Load
                          </button>
                          <button
                            onClick={() => handleVolumeDelete(volumeName)}
                            className="px-2 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    ))}
                    {getSavedVolumes().length === 0 && (
                      <div className="text-center py-8 text-slate-500">
                        <Archive size={32} className="mx-auto mb-2 opacity-50" />
                        <p>No saved volumes</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Surface Specification İçeriği */}
            {activeMainSection === 'volume' && activeVolumeSubSection === 'surface' && (
              <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-3 bg-orange-50 border-b border-orange-200">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBackToMain}
                      className="p-1 hover:bg-orange-200 rounded transition-colors"
                    >
                      <ChevronLeft size={16} className="text-orange-600" />
                    </button>
                    <MousePointer size={16} className="text-orange-600" />
                    <span className="font-semibold text-orange-800">Surface Specification</span>
                  </div>
                </div>

                {/* Surface Content */}
                <div className="flex-1 p-4 space-y-4">
                  {/* Face Selection Button */}
                  <div className="bg-white rounded-lg border border-stone-200 p-4">
                    <button
                      onClick={toggleFaceEditMode}
                      className={`w-full px-4 py-2 rounded text-sm transition-colors ${
                        isFaceEditMode
                          ? 'bg-orange-600 text-white'
                          : 'bg-stone-100 text-slate-600 hover:bg-orange-100 hover:text-orange-700'
                      }`}
                    >
                      {isFaceEditMode ? 'Exit Face Selection' : 'Select Faces'}
                    </button>
                  </div>

                  {/* Add New Face */}
                  <div className="bg-white rounded-lg border border-stone-200 p-4">
                    <h4 className="font-medium text-slate-800 mb-3">Add Face Index</h4>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={newFaceIndex}
                        onChange={(e) => setNewFaceIndex(e.target.value)}
                        placeholder="Face index"
                        className="flex-1 text-sm bg-white border border-gray-300 rounded px-2 py-1"
                        min="0"
                      />
                      <button
                        onClick={handleAddNewFace}
                        className="px-3 py-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                        title="Add Face"
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                  {/* Face Index List with Roles */}
                  {selectedFaces.length > 0 && (
                    <div className="bg-white rounded-lg border border-stone-200 p-4">
                      <h4 className="font-medium text-slate-800 mb-3">Selected Faces</h4>
                      <div className="space-y-2">
                        {selectedFaces.map((face, index) => (
                          <div key={index} className="flex items-center gap-2 p-2 bg-gray-50 rounded">
                            <span className="text-sm font-mono text-slate-600">
                              Face {face.index}
                            </span>
                            <select
                              value={face.role}
                              onChange={(e) => updateFaceRole(index, e.target.value)}
                              className="flex-1 text-xs bg-white border border-gray-300 rounded px-2 py-1"
                            >
                              <option value="">Select Role</option>
                              <option value="left">Left Face</option>
                              <option value="right">Right Face</option>
                              <option value="top">Top Face</option>
                              <option value="bottom">Bottom Face</option>
                              <option value="front">Front Face</option>
                              <option value="back">Back Face</option>
                              <option value="door">Door Face</option>
                            </select>
                            <button
                              onClick={() => handleFaceSelectionMode(face.index)}
                              className={`p-1 rounded transition-colors ${
                                pendingFaceSelection === face.index
                                  ? 'bg-orange-600 text-white'
                                  : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                              }`}
                              title="Select Face on Surface"
                            >
                              <Target size={12} />
                            </button>
                            {pendingFaceSelection === face.index && (
                              <button
                                onClick={() => handleConfirmFaceSelection(face.index)}
                                className="p-1 bg-green-600 text-white rounded hover:bg-green-700 transition-colors"
                                title="Confirm Selection"
                              >
                                <Check size={12} />
                              </button>
                            )}
                            <button
                              onClick={() => removeFaceFromList(index)}
                              className="text-red-500 hover:text-red-700 p-1"
                              title="Remove Face"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button
                        onClick={clearAllFaceSelections}
                        className="mt-3 text-xs text-orange-600 hover:text-orange-800"
                      >
                        Clear All Faces
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Volume Parameters İçeriği */}
            {activeMainSection === 'volume' && activeVolumeSubSection === 'parameters' && (
              <Module editedShape={editedShape} onClose={handleBackToMain} />
            )}

            {/* Panel Ana Menüsü */}
            {activeMainSection === 'panel' && (
              <div className="flex-1 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-3 bg-blue-50 border-b border-blue-200">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleBackToMain}
                      className="p-1 hover:bg-blue-200 rounded transition-colors"
                    >
                      <ChevronLeft size={16} className="text-blue-600" />
                    </button>
                    <PanelLeft size={16} className="text-blue-600" />
                    <span className="font-semibold text-blue-800">Panel</span>
                  </div>
                </div>

                {/* Panel Content */}
                <div className="flex-1 p-4">
                  <div className="bg-white rounded-lg border border-stone-200 p-4 text-center">
                    <PanelLeft size={32} className="mx-auto mb-2 text-blue-400" />
                    <h4 className="font-medium text-slate-800 mb-2">Panel Management</h4>
                    <p className="text-sm text-slate-600">Panel features will be implemented here</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
      
      <div
        className={`absolute top-0 right-0 w-3 h-full cursor-ew-resize bg-transparent transition-colors ${isResizing ? 'bg-blue-500/20' : 'hover:bg-blue-500/20'}`}
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
};

export default EditMode;