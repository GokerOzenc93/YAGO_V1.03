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
} from 'lucide-react';
import { Shape } from '../../types/shapes';
import Module from './Module';
import { getSelectedFaceCount, clearFaceHighlight } from '../../utils/faceSelection';
import { saveVolumeToProject, createVolumeDataFromShape, getSavedVolumes, loadVolumeFromProject } from '../../utils/fileSystem';
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
  const [activeComponent, setActiveComponent] = useState<string | null>(null);
  const [isCollapsed, setIsCollapsed] = useState(false);
  // Varsayılan olarak sabitlenmiş (pinned) gelsin
  const [isLocked, setIsLocked] = useState(true); 
  
  // Volume name editing state
  const [volumeName, setVolumeName] = useState('AD06072');
  const [isEditingName, setIsEditingName] = useState(false);
  const [tempName, setTempName] = useState(volumeName);
  
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
          // Force re-render by updating a state that triggers component refresh
          setActiveComponent('volumeType'); // This will trigger a re-render and refresh the list
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
    setActiveComponent(null);
    setIsFaceEditMode(false);
    onExit();
  };

  const handleComponentClick = (componentType: string) => {
    if (activeComponent === componentType) {
      setActiveComponent(null);
    } else {
      setActiveComponent(componentType);
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
    const baseClasses = 'relative flex items-center rounded-lg transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]';

    if (isActive) {
      if (color === 'blue') {
        return `${baseClasses} bg-blue-600/90 text-white shadow-lg shadow-blue-500/25 border border-blue-400/30`;
      } else if (color === 'green') {
        return `${baseClasses} bg-green-600/90 text-white shadow-lg shadow-green-500/25 border border-green-400/30`;
      } else {
        return `${baseClasses} bg-violet-600/90 text-white shadow-lg shadow-violet-500/25 border border-violet-400/30`;
      }
    } else {
      return `${baseClasses} bg-gray-800/50 text-gray-300 hover:bg-gray-600/50 border border-gray-500/30 hover:border-gray-400/50`;
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

  const renderComponentContent = () => {
    switch (activeComponent) {
      case 'volumeParameters':
        return <Module editedShape={editedShape} onClose={() => setActiveComponent(null)} />;
      case 'faceSelect':
        return (
          <>
            <div className="flex items-center justify-between px-3 py-2 bg-blue-600/20 border-b border-blue-500/30">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 bg-blue-600/30 rounded">
                  <MousePointer size={12} className="text-blue-300" />
                </div>
                <span className="text-white font-medium text-sm">Face Select</span>
              </div>
              <button
                onClick={() => setActiveComponent(null)}
                className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                title="Geri"
              >
                <X size={12} />
              </button>
            </div>

            <div className="flex-1 p-3 space-y-3">
              <div className="h-px bg-gradient-to-r from-transparent via-blue-400/60 to-transparent mb-3"></div>

              <div className="space-y-2">
                {selectedFaceCount > 0 && (
                  <div className="text-xs text-gray-300 mb-2">
                    Selected Faces: <span className="text-blue-400 font-medium">{selectedFaceCount}</span>
                  </div>
                )}
                
                {selectedFaceCount > 0 && (
                  <button
                    onClick={clearAllFaceSelections}
                    className="w-full flex items-center gap-2 px-2 py-1 rounded text-xs bg-red-600/50 text-red-200 hover:bg-red-600/70 transition-colors"
                  >
                    <Layers size={10} />
                    Clear All ({selectedFaceCount})
                  </button>
                )}
                
                {selectedFaceCount === 0 && (
                  <div className="text-xs text-gray-400 p-2 bg-gray-800/30 rounded">
                    Click on faces to select them
                  </div>
                )}
              </div>
            </div>
          </>
        );
      case 'volumeType':
        return (
          <>
            <div className="flex items-center justify-between px-3 py-2 bg-green-600/20 border-b border-green-500/30">
              <div className="flex items-center gap-2">
                <div className="flex items-center justify-center w-6 h-6 bg-green-600/30 rounded">
                  <Archive size={12} className="text-green-300" />
                </div>
                <span className="text-white font-medium text-sm">Volume Type</span>
              </div>
              <button
                onClick={() => setActiveComponent(null)}
                className="text-gray-400 hover:text-white p-1 rounded transition-colors"
                title="Back"
              >
                <X size={12} />
              </button>
            </div>

            <div className="flex-1 p-3 space-y-3">
              <div className="h-px bg-gradient-to-r from-transparent via-green-400/60 to-transparent mb-3"></div>

              <div className="space-y-2">
                {(() => {
                  const savedVolumes = getSavedVolumes();
                  return savedVolumes.length > 0 ? (
                    <>
                      <div className="text-xs text-gray-300 mb-2">
                        Saved Volumes: <span className="text-green-400 font-medium">{savedVolumes.length}</span>
                      </div>
                      <div className="space-y-1 max-h-40 overflow-y-auto">
                        {savedVolumes.map((volumeName, index) => (
                          <div
                            key={index}
                            className="flex items-center gap-2 w-full p-2 bg-gray-800/30 hover:bg-gray-700/50 rounded border border-gray-700/50 transition-colors"
                          >
                            <button
                              onClick={() => handleVolumeSelect(volumeName)}
                              className="flex-1 text-left text-xs text-gray-200 font-mono hover:text-white transition-colors"
                              title={`Load volume: ${volumeName}`}
                            >
                              {volumeName}
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleVolumeDelete(volumeName);
                              }}
                              className="flex-shrink-0 p-1 text-gray-400 hover:text-red-400 hover:bg-red-500/20 rounded transition-colors"
                              title={`Delete volume: ${volumeName}`}
                            >
                              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="3,6 5,6 21,6"></polyline>
                                <path d="m19,6v14a2,2 0 0,1 -2,2H7a2,2 0 0,1 -2,-2V6m3,0V4a2,2 0 0,1 2,-2h4a2,2 0 0,1 2,2v2"></path>
                                <line x1="10" y1="11" x2="10" y2="17"></line>
                                <line x1="14" y1="11" x2="14" y2="17"></line>
                              </svg>
                            </button>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : (
                    <div className="text-xs text-gray-400 p-2 bg-gray-800/30 rounded">
                      No saved volumes found
                    </div>
                  );
                })()}
              </div>
            </div>
          </>
        );
      default:
        return (
          <div className="flex flex-col w-full bg-gray-700/50 flex-shrink-0 py-2">
            {(editedShape.type === 'box' || 
              editedShape.type === 'cylinder' || 
              editedShape.type === 'polyline2d' || 
              editedShape.type === 'polygon2d' || 
              editedShape.type === 'polyline3d' || 
              editedShape.type === 'polygon3d' || 
              editedShape.type === 'rectangle2d' || 
              editedShape.type === 'circle2d') && (
              <div className="flex flex-col gap-1 px-2">
                <button
                  onClick={() => handleComponentClick('volumeParameters')}
                  className={`${getIconButtonColorClasses('violet', activeComponent === 'volumeParameters')} w-full justify-start gap-2 px-2 py-1.5 text-left`}
                  title="Volume Parameters"
                >
                  <div className="flex-shrink-0">
                    <Puzzle size={12} />
                  </div>
                  <span className="text-xs font-medium truncate">Volume Parameters</span>
                  {activeComponent === 'volumeParameters' && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    </div>
                  )}
                </button>
                
                <div className="h-px bg-gradient-to-r from-transparent via-gray-500/60 to-transparent my-1"></div>
                
                <button
                  onClick={() => {
                    if (activeComponent === 'faceSelect') {
                      setActiveComponent(null);
                      setIsFaceEditMode(false);
                    } else {
                      handleComponentClick('faceSelect');
                      setIsFaceEditMode(true);
                    }
                  }}
                  className={`${getIconButtonColorClasses('blue', activeComponent === 'faceSelect')} w-full justify-start gap-2 px-2 py-1.5 text-left`}
                  title="Face Select"
                >
                  <div className="flex-shrink-0">
                    <MousePointer size={12} />
                  </div>
                  <span className="text-xs font-medium truncate">Face Select</span>
                  {selectedFaceCount > 0 && (
                    <span className="ml-auto bg-blue-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                      {selectedFaceCount}
                    </span>
                  )}
                  {activeComponent === 'faceSelect' && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    </div>
                  )}
                </button>
                
                <button
                  onClick={() => handleComponentClick('volumeType')}
                  className={`${getIconButtonColorClasses('green', activeComponent === 'volumeType')} w-full justify-start gap-2 px-2 py-1.5 text-left`}
                  title="Volume Type"
                >
                  <div className="flex-shrink-0">
                    <Archive size={12} />
                  </div>
                  <span className="text-xs font-medium truncate">Volume Type</span>
                  {(() => {
                    const savedCount = getSavedVolumes().length;
                    return savedCount > 0 && (
                      <span className="ml-auto bg-green-500 text-white text-xs px-1.5 py-0.5 rounded-full">
                        {savedCount}
                      </span>
                    );
                  })()}
                  {activeComponent === 'volumeType' && (
                    <div className="absolute top-0 right-0 w-3 h-3 bg-white rounded-full flex items-center justify-center">
                      <div className="w-1.5 h-1.5 bg-green-500 rounded-full"></div>
                    </div>
                  )}
                </button>
              </div>
            )}
          </div>
        );
    }
  };

  return (
    <div
      ref={panelRef}
      className={`fixed left-0 z-50 bg-gray-800/95 backdrop-blur-sm border-r border-blue-500/50 shadow-xl rounded-r-xl flex flex-col transition-all duration-300 ease-in-out group`}
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
          className="absolute top-1/2 -translate-y-1/2 left-full -translate-x-1/2 bg-gray-700/80 p-2 rounded-full shadow-lg border border-blue-500/50 transition-all duration-300 group-hover:left-1/2 group-hover:-translate-x-1/2"
          title="Paneli Genişlet"
        >
          <ChevronRight size={16} className="text-white group-hover:text-blue-300" />
        </button>
      )}

      {!isCollapsed && (
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="flex items-center justify-between p-2 pt-4 border-b border-gray-700">
            <div className="flex items-center gap-2 flex-1">
              {isEditingName ? (
                <input
                  ref={nameInputRef}
                  type="text"
                  value={tempName}
                  onChange={(e) => setTempName(e.target.value)}
                  onKeyDown={handleNameKeyDown}
                  onBlur={handleNameSave}
                  className="text-white font-inter text-base font-bold bg-transparent border-b border-blue-400 outline-none flex-1 min-w-0"
                  maxLength={20}
                />
              ) : (
                <div className="flex items-center gap-1 flex-1 min-w-0">
                  <span className="text-white font-inter text-base font-bold opacity-90 truncate">
                    {volumeName}
                  </span>
                  <button
                    onClick={handleNameEdit}
                    className="text-gray-400 hover:text-blue-400 p-0.5 rounded transition-colors flex-shrink-0"
                    title="Edit Name"
                  >
                    <Edit3 size={10} />
                  </button>
                </div>
              )}
              
              <button
                onClick={handleSaveVolume}
                className="text-gray-400 hover:text-green-400 p-1 rounded transition-colors bg-gray-800/80 backdrop-blur-sm flex-shrink-0"
                title="Save Volume"
              >
                <Save size={12} />
              </button>
            </div>
            
            {/* Panel genişliği 200px'ten büyükse düğmeleri göster*/}
            {panelWidth > 200 && (
              <div className="flex items-center gap-1">
                {isLocked && (
                  <button
                    onClick={handleCollapse}
                    className="text-gray-400 hover:text-white p-1 rounded transition-colors bg-gray-800/80 backdrop-blur-sm"
                    title="Arayüzü Küçült"
                  >
                    <ChevronLeft size={12} />
                  </button>
                )}
                
                <button
                  onClick={toggleLock}
                  className={`p-1 rounded transition-colors ${
                    isLocked ? 'bg-blue-600/90 text-white' : 'text-gray-400 hover:text-blue-400'
                  } bg-gray-800/80 backdrop-blur-sm`}
                  title={isLocked ? 'Paneli Çöz' : 'Paneli Sabitle'}
                >
                  {isLocked ? <Pin size={12} /> : <PinOff size={12} />}
                </button>
                
                <button
                  onClick={handleClose}
                  className="text-gray-400 hover:text-red-400 p-1 rounded transition-colors bg-gray-800/80 backdrop-blur-sm"
                  title="Düzenleme Modundan Çık"
                >
                  <X size={12} />
                </button>
              </div>
            )}
          </div>
          
          <div className="flex-1 flex flex-col overflow-hidden">
            {renderComponentContent()}
          </div>
        </div>
      )}
      
      <div
        className={`absolute top-0 right-0 w-3 h-full cursor-ew-resize bg-transparent transition-colors ${isResizing ? 'bg-blue-500/30' : 'hover:bg-blue-500/30'}`}
        onMouseDown={handleResizeMouseDown}
      />
    </div>
  );
};

export default EditMode;