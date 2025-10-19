import React, { useState } from 'react';
import { Tool, useAppStore, ModificationType, CameraType, SnapType, ViewMode, OrthoMode } from '../store';
import { MousePointer2, Move, RotateCcw, Maximize, FileDown, Upload, Save, FilePlus, Undo2, Redo2, Grid, Layers, Box, Cylinder, Settings, HelpCircle, Search, Copy, Scissors, ClipboardPaste, Square, Circle, FlipHorizontal, Copy as Copy1, Minus, Eraser, Plus, Eye, Monitor, Package, Edit, BarChart3, Cog, FileText, PanelLeft, GitBranch, Edit3, Camera, CameraOff, Target, Navigation, Crosshair, RotateCw, Zap, InspectionPanel as Intersection, MapPin, Frame as Wireframe, Cuboid as Cube, Ruler, FolderOpen } from 'lucide-react';
import { createBoxGeometry } from '../utils/geometry';
import { ParametersPanel } from './ParametersPanel';

interface ToolbarProps {
  onOpenCatalog: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ onOpenCatalog }) => {
  const {
    setActiveTool,
    activeTool,
    setLastTransformTool,
    addShape,
    selectedShapeId,
    modifyShape,
    performBooleanOperation,
    cameraType,
    setCameraType,
    snapSettings,
    toggleSnapSetting,
    viewMode,
    setViewMode,
    cycleViewMode,
    orthoMode,
    toggleOrthoMode,
    opencascadeInstance
  } = useAppStore();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showModifyMenu, setShowModifyMenu] = useState(false);
  const [showPolylineMenu, setShowPolylineMenu] = useState(false);
  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const [polylineMenuPosition, setPolylineMenuPosition] = useState({ x: 0, y: 0 });
  const [showParametersPanel, setShowParametersPanel] = useState(false);

  const shouldDisableSnap = ['Select', 'Move', 'Rotate', 'Scale'].includes(activeTool);

  const getViewModeLabel = () => {
    switch (viewMode) {
      case ViewMode.SOLID:
        return 'Solid';
      case ViewMode.WIREFRAME:
        return 'Wire';
      default:
        return 'Solid';
    }
  };

  const getViewModeIcon = () => {
    switch (viewMode) {
      case ViewMode.SOLID:
        return <Cube size={14} className="text-orange-600" />;
      case ViewMode.WIREFRAME:
        return <Wireframe size={14} className="text-orange-600" />;
      default:
        return <Cube size={14} className="text-orange-600" />;
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
  };

  const handleOrthoModeToggle = () => {
    toggleOrthoMode();
  };

  const handleTransformToolSelect = (tool: Tool) => {
    setActiveTool(tool);
    setLastTransformTool(tool);
  };

  const handleModify = (type: ModificationType) => {
    if (!selectedShapeId) return;

    switch (type) {
      case ModificationType.MIRROR:
        modifyShape(selectedShapeId, {
          type: ModificationType.MIRROR,
          mirror: { axis: 'x', distance: 1000 }
        });
        break;

      case ModificationType.ARRAY:
        modifyShape(selectedShapeId, {
          type: ModificationType.ARRAY,
          array: { count: 3, spacing: 750, direction: 'x' }
        });
        break;

      case ModificationType.FILLET:
        modifyShape(selectedShapeId, {
          type: ModificationType.FILLET,
          fillet: { radius: 50 }
        });
        break;

      case ModificationType.CHAMFER:
        modifyShape(selectedShapeId, {
          type: ModificationType.CHAMFER,
          chamfer: { distance: 50 }
        });
        break;
    }

    setShowModifyMenu(false);
  };

  const handlePolylineRightClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setPolylineMenuPosition({ x: e.clientX, y: e.clientY });
    setShowPolylineMenu(true);
  };

  const handlePolylineEdit = () => {
    setActiveTool(Tool.POLYLINE_EDIT);
    setShowPolylineMenu(false);
    console.log('Polyline edit mode activated');
  };

  const handleCameraToggle = () => {
    setCameraType(
      cameraType === CameraType.PERSPECTIVE
        ? CameraType.ORTHOGRAPHIC
        : CameraType.PERSPECTIVE
    );
    console.log(`Camera switched to: ${cameraType === CameraType.PERSPECTIVE ? 'Orthographic' : 'Perspective'}`);
  };

  const handleSnapToggle = (snapType: SnapType) => {
    toggleSnapSetting(snapType);
    console.log(`Snap ${snapType} ${snapSettings[snapType] ? 'disabled' : 'enabled'}`);
  };

  React.useEffect(() => {
    const handleClickOutside = () => {
      setShowPolylineMenu(false);
      setShowSnapMenu(false);
    };

    if (showPolylineMenu || showSnapMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [showPolylineMenu, showSnapMenu]);


  const transformTools = [
    { id: Tool.SELECT, icon: <MousePointer2 size={11} />, label: 'Select', shortcut: 'V' },
    { id: Tool.MOVE, icon: <Move size={11} />, label: 'Move', shortcut: 'M' },
    { id: Tool.POINT_TO_POINT_MOVE, icon: <Navigation size={11} />, label: 'Point to Point', shortcut: 'P2P' },
    { id: Tool.ROTATE, icon: <RotateCcw size={11} />, label: 'Rotate', shortcut: 'Ro' },
    { id: Tool.SCALE, icon: <Maximize size={11} />, label: 'Scale', shortcut: 'S' },
  ];

  const measurementTools = [
    { id: Tool.DIMENSION, icon: <Ruler size={11} />, label: 'Dimension', shortcut: 'D' },
  ];

  const menus = [
    {
      label: 'File',
      items: [
        { icon: <FilePlus size={11} />, label: 'New Project', shortcut: 'Ctrl+N' },
        { icon: <Upload size={11} />, label: 'Open Project...', shortcut: 'Ctrl+O' },
        { type: 'separator' },
        { icon: <Save size={11} />, label: 'Save', shortcut: 'Ctrl+S' },
        { icon: <FileDown size={11} />, label: 'Save As...', shortcut: 'Ctrl+Shift+S' },
        { type: 'separator' },
        { icon: <Upload size={11} />, label: 'Import...', shortcut: 'Ctrl+I' },
        { icon: <FileDown size={11} />, label: 'Export...', shortcut: 'Ctrl+E' },
      ]
    },
    {
      label: 'Edit',
      items: [
        { icon: <Undo2 size={11} />, label: 'Undo', shortcut: 'Ctrl+Z' },
        { icon: <Redo2 size={11} />, label: 'Redo', shortcut: 'Ctrl+Y' },
        { type: 'separator' },
        { icon: <Scissors size={11} />, label: 'Cut', shortcut: 'Ctrl+X' },
        { icon: <Copy size={11} />, label: 'Copy', shortcut: 'Ctrl+C' },
        { icon: <ClipboardPaste size={11} />, label: 'Paste', shortcut: 'Ctrl+V' },
        { type: 'separator' },
        { icon: <Eraser size={11} />, label: 'Delete', shortcut: 'Del' },
      ]
    },
    {
      label: 'View',
      items: [
        { icon: <Grid size={11} />, label: 'Show Grid', shortcut: 'G' },
        { icon: <Layers size={11} />, label: 'Show Layers', shortcut: 'L' },
        { icon: <Eye size={11} />, label: 'Visibility', shortcut: 'V' },
        { type: 'separator' },
        { icon: <Cube size={11} />, label: 'Solid View', shortcut: '1' },
        { icon: <Wireframe size={11} />, label: 'Wireframe View', shortcut: '2' },
        { type: 'separator' },
        { label: 'Zoom In', shortcut: 'Ctrl++' },
        { label: 'Zoom Out', shortcut: 'Ctrl+-' },
        { label: 'Fit to View', shortcut: 'F' },
      ]
    },
    {
      label: 'Place',
      items: [
        { icon: <Box size={11} />, label: 'Add Box', shortcut: 'B' },
        { icon: <Cylinder size={11} />, label: 'Add Cylinder', shortcut: 'C' },
        { icon: <Package size={11} />, label: '3D Objects', shortcut: '3' },
        { type: 'separator' },
        { icon: <Square size={11} />, label: '2D Shapes', shortcut: '2' },
        { icon: <GitBranch size={11} />, label: 'Drawing Tools', shortcut: 'L' },
      ]
    },
    {
      label: 'Modify',
      items: [
        { icon: <Move size={11} />, label: 'Move', shortcut: 'M' },
        { icon: <RotateCcw size={11} />, label: 'Rotate', shortcut: 'R' },
        { icon: <Maximize size={11} />, label: 'Scale', shortcut: 'S' },
        { type: 'separator' },
        { icon: <FlipHorizontal size={11} />, label: 'Mirror', shortcut: 'Mi' },
        { icon: <Copy1 size={11} />, label: 'Array', shortcut: 'Ar' },
        { icon: <Edit size={11} />, label: 'Edit', shortcut: 'E' },
      ]
    },
    {
      label: 'Snap',
      items: [
        { icon: <Target size={11} />, label: 'Endpoint Snap', shortcut: 'End' },
        { icon: <Navigation size={11} />, label: 'Midpoint Snap', shortcut: 'Mid' },
        { icon: <Crosshair size={11} />, label: 'Center Snap', shortcut: 'Cen' },
        { icon: <RotateCw size={11} />, label: 'Quadrant Snap', shortcut: 'Qua' },
        { icon: <Zap size={11} />, label: 'Perpendicular Snap', shortcut: 'Per' },
        { icon: <Intersection size={11} />, label: 'Intersection Snap', shortcut: 'Int' },
        { icon: <MapPin size={11} />, label: 'Nearest Snap', shortcut: 'Nea' },
        { type: 'separator' },
        { icon: <Settings size={11} />, label: 'Snap Settings', shortcut: 'Ctrl+Snap' },
      ]
    },
    {
      label: 'Measure',
      items: [
        { icon: <Layers size={11} />, label: 'Distance', shortcut: 'D' },
        { icon: <Layers size={11} />, label: 'Angle', shortcut: 'A' },
        { icon: <Layers size={11} />, label: 'Area', shortcut: 'Ar' },
        { type: 'separator' },
        { icon: <Layers size={11} />, label: 'Add Dimension', shortcut: 'Ctrl+D' },
        { icon: <Layers size={11} />, label: 'Dimension Style', shortcut: 'Ctrl+M' },
      ]
    },
    {
      label: 'Display',
      items: [
        { icon: <Monitor size={11} />, label: 'Render Settings', shortcut: 'R' },
        { icon: <Eye size={11} />, label: 'View Modes', shortcut: 'V' },
        { icon: <Layers size={11} />, label: 'Camera Settings', shortcut: 'C' },
        { type: 'separator' },
        { icon: <Layers size={11} />, label: 'Material Editor', shortcut: 'M' },
        { icon: <Settings size={11} />, label: 'Lighting', shortcut: 'L' },
      ]
    },
    {
      label: 'Settings',
      items: [
        { icon: <Cog size={11} />, label: 'General Settings', shortcut: 'Ctrl+,' },
        { icon: <Grid size={11} />, label: 'Grid Settings', shortcut: 'G' },
        { icon: <Layers size={11} />, label: 'Unit Settings', shortcut: 'U' },
        { type: 'separator' },
        { icon: <Settings size={11} />, label: 'Toolbar', shortcut: 'T' },
        { icon: <PanelLeft size={11} />, label: 'Panel Layout', shortcut: 'P' },
      ]
    },
    {
      label: 'Report',
      items: [
        { icon: <FileText size={11} />, label: 'Project Report', shortcut: 'Ctrl+R' },
        { icon: <BarChart3 size={11} />, label: 'Material List', shortcut: 'Ctrl+L' },
        { icon: <FileText size={11} />, label: 'Dimension Report', shortcut: 'Ctrl+M' },
        { type: 'separator' },
        { icon: <FileDown size={11} />, label: 'PDF Export', shortcut: 'Ctrl+P' },
        { icon: <FileDown size={11} />, label: 'Excel Export', shortcut: 'Ctrl+E' },
      ]
    },
    {
      label: 'Window',
      items: [
        { icon: <PanelLeft size={11} />, label: 'New Window', shortcut: 'Ctrl+N' },
        { icon: <Layers size={11} />, label: 'Window Layout', shortcut: 'Ctrl+W' },
        { type: 'separator' },
        { icon: <Monitor size={11} />, label: 'Full Screen', shortcut: 'F11' },
        { icon: <PanelLeft size={11} />, label: 'Hide Panels', shortcut: 'Tab' },
      ]
    },
    {
      label: 'Help',
      items: [
        { icon: <HelpCircle size={11} />, label: 'User Manual', shortcut: 'F1' },
        { icon: <HelpCircle size={11} />, label: 'Keyboard Shortcuts', shortcut: 'Ctrl+?' },
        { icon: <Layers size={11} />, label: 'Video Tutorials', shortcut: 'Ctrl+T' },
        { type: 'separator' },
        { icon: <HelpCircle size={11} />, label: 'About', shortcut: 'Ctrl+H' },
        { icon: <HelpCircle size={11} />, label: 'Check Updates', shortcut: 'Ctrl+U' },
      ]
    },
  ];

  const quickAccessButtons = [
    { icon: <FilePlus size={11} />, label: 'New', shortcut: 'Ctrl+N' },
    { icon: <Save size={11} />, label: 'Save', shortcut: 'Ctrl+S' },
    { icon: <FileDown size={11} />, label: 'Save As', shortcut: 'Ctrl+Shift+S' },
  ];

  const editButtons = [
    { icon: <Undo2 size={11} />, label: 'Undo', shortcut: 'Ctrl+Z' },
    { icon: <Redo2 size={11} />, label: 'Redo', shortcut: 'Ctrl+Y' },
  ];

  const handleAddGeometry = async () => {
    const w = 600, h = 600, d = 600;
    const geometry = createBoxGeometry(w, h, d);

    let ocShape = null;
    if (opencascadeInstance) {
      try {
        const { createOCGeometry } = await import('../opencascade');
        ocShape = createOCGeometry(opencascadeInstance, {
          type: 'box',
          width: w,
          height: h,
          depth: d
        });
        console.log('✅ OpenCascade shape created for box');
      } catch (error) {
        console.error('❌ Failed to create OpenCascade shape:', error);
      }
    } else {
      console.warn('⚠️ OpenCascade not loaded, adding box without OC shape');
    }

    addShape({
      id: `box-${Date.now()}`,
      type: 'box',
      geometry,
      position: [0, 0, 0],
      rotation: [0, 0, 0],
      scale: [1, 1, 1],
      color: '#2563eb',
      parameters: { width: w, height: h, depth: d },
      ocShape
    });
    console.log('✅ Box geometry added');
  };

  return (
    <div className="flex flex-col font-inter">
      <div className="flex items-center h-12 px-4 bg-stone-50 border-b border-stone-200 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <img
              src="/yago_logo.png"
              alt="YAGO Design Logo"
              className="h-8 w-auto object-contain"
            />
          </div>

          <div className="w-px h-6 bg-stone-300"></div>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-stone-600 font-medium">Company:</span>
            <span className="text-orange-600 font-semibold">Göker İnşaat</span>
          </div>

          <div className="w-px h-6 bg-stone-300"></div>

          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-stone-600 font-medium">Project:</span>
            <span className="text-slate-800 font-semibold">Drawing1</span>
          </div>
        </div>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={handleCameraToggle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-100 hover:bg-orange-200 transition-colors text-orange-800 font-medium"
            title={`Switch to ${cameraType === CameraType.PERSPECTIVE ? 'Orthographic' : 'Perspective'} Camera (C)`}
          >
            {cameraType === CameraType.PERSPECTIVE ? (
              <Camera size={14} className="text-orange-700" />
            ) : (
              <CameraOff size={14} className="text-orange-700" />
            )}
            <span className="text-sm font-semibold">
              {cameraType === CameraType.PERSPECTIVE ? 'Persp' : 'Ortho'}
            </span>
          </button>

          <button
            onClick={() => {
              const { cycleViewMode } = useAppStore.getState();
              cycleViewMode();
              console.log('🎯 View mode button clicked');
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-stone-200 hover:bg-stone-300 transition-colors text-slate-800 font-medium"
            title={`Current: ${getViewModeLabel()} View - Click to cycle (1/2/3 or V)`}
          >
            {getViewModeIcon()}
            <span className="text-sm font-semibold">
              {getViewModeLabel()}
            </span>
          </button>

          <button
            onClick={handleOrthoModeToggle}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-colors font-medium ${
              orthoMode === OrthoMode.ON
                ? 'bg-slate-800 text-white shadow-lg'
                : 'bg-stone-200 hover:bg-stone-300 text-slate-800'
            }`}
            title={`Linear Mode: ${orthoMode === OrthoMode.ON ? 'ON' : 'OFF'} - Snap to axis directions`}
          >
            <Grid size={14} className={orthoMode === OrthoMode.ON ? 'text-white' : 'text-slate-800'} />
            <span className="text-sm font-semibold">
              Linear
            </span>
          </button>

          <div className="w-px h-6 bg-stone-300"></div>

          <button
            onClick={onOpenCatalog}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-orange-600 hover:bg-orange-700 transition-colors text-white font-medium shadow-md"
            title="Open Geometry Catalog"
          >
            <FolderOpen size={14} />
            <span className="text-sm font-semibold">Catalog</span>
          </button>

          <div className="relative">
            <Search size={14} className="absolute left-3 top-2 text-stone-500" />
            <input
              type="text"
              placeholder="Search..."
              className="w-40 h-8 pl-10 pr-3 text-sm bg-white rounded-lg border border-stone-300 focus:outline-none focus:border-orange-400 focus:ring-1 focus:ring-orange-400 transition-colors placeholder-stone-500 text-slate-800"
            />
          </div>
          <button className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <Settings size={14} className="text-stone-600 hover:text-slate-800" />
          </button>
          <button className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <HelpCircle size={14} className="text-stone-600 hover:text-slate-800" />
          </button>
        </div>
      </div>

      <div className="flex items-center h-8 px-2 bg-stone-50 border-b border-stone-200">
        <div className="flex items-center h-full">
          {menus.map((menu) => (
            <div key={menu.label} className="relative h-full">
              <button
                className={`h-full px-3 text-xs font-medium hover:bg-stone-100 transition-colors flex items-center ${
                  activeMenu === menu.label ? 'bg-stone-100 text-slate-800' : 'text-slate-700'
                }`}
                onClick={() => setActiveMenu(activeMenu === menu.label ? null : menu.label)}
                onMouseEnter={() => activeMenu && setActiveMenu(menu.label)}
              >
                {menu.label}
              </button>
              {activeMenu === menu.label && (
                <div
                  className="absolute left-0 top-full mt-1 w-52 bg-white backdrop-blur-sm rounded-lg border border-stone-200 py-1 z-50 shadow-xl"
                  onMouseLeave={() => setActiveMenu(null)}
                >
                  {menu.items.map((item, i) => (
                    item.type === 'separator' ? (
                      <div key={i} className="border-t border-stone-100 my-1"></div>
                    ) : (
                      <button
                        key={i}
                        className="flex items-center justify-between w-full h-8 px-3 text-sm hover:bg-stone-50 transition-colors text-slate-700 hover:text-slate-800"
                        onClick={() => {
                          if (item.label === 'Solid View') handleViewModeChange(ViewMode.SOLID);
                          else if (item.label === 'Wireframe View') handleViewModeChange(ViewMode.WIREFRAME);
                          setActiveMenu(null);
                        }}
                      >
                        <div className="flex items-center gap-1.5">
                          {item.icon}
                          <span className="font-medium">{item.label}</span>
                        </div>
                        {item.shortcut && (
                          <span className="text-stone-500 text-xs font-medium">{item.shortcut}</span>
                        )}
                      </button>
                    )
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div className="flex items-center h-12 gap-3 px-4 bg-stone-50 border-b border-stone-200">
        <div className="flex items-center gap-0.5 bg-white rounded-lg p-1 shadow-sm border border-stone-200">
          {quickAccessButtons.map((button, index) => (
            <button
              key={index}
              className="p-1.5 rounded text-stone-600 hover:bg-stone-50 hover:text-slate-800 transition-colors"
              title={`${button.label} (${button.shortcut})`}
            >
              {button.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-7 bg-stone-300"></div>

        <div className="flex items-center gap-0.5 bg-white rounded-lg p-1 shadow-sm border border-stone-200">
          {editButtons.map((button, index) => (
            <button
              key={index}
              className="p-1.5 rounded text-stone-600 hover:bg-stone-50 hover:text-slate-800 transition-colors"
              title={`${button.label} (${button.shortcut})`}
            >
              {button.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-7 bg-stone-300"></div>

        <div className="flex items-center gap-0.5 bg-white rounded-lg p-1 shadow-sm border border-stone-200">
          {transformTools.map((tool) => (
            <button
              key={tool.id}
              className={`p-1.5 rounded transition-all ${
                activeTool === tool.id
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : (tool.id === Tool.SELECT || selectedShapeId)
                  ? 'hover:bg-stone-50 text-stone-600 hover:text-slate-800'
                  : 'opacity-50 cursor-not-allowed text-stone-400'
              }`}
              onClick={() => {
                if (tool.id === Tool.SELECT) {
                  setActiveTool(tool.id);
                } else if (selectedShapeId) {
                  handleTransformToolSelect(tool.id);
                }
              }}
              disabled={tool.id !== Tool.SELECT && !selectedShapeId}
              title={`${tool.label} (${tool.shortcut})`}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-7 bg-stone-300"></div>

        <div className="flex items-center gap-0.5 bg-white rounded-lg p-1 shadow-sm border border-stone-200">
          <button
            onClick={() => handleSnapToggle(SnapType.ENDPOINT)}
            className={`p-1.5 rounded transition-all ${
              snapSettings[SnapType.ENDPOINT]
                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                : 'hover:bg-stone-50 text-stone-600 hover:text-slate-800'
            }`}
            title="Endpoint Snap"
          >
            <Target size={11} />
          </button>
          <button
            onClick={() => handleSnapToggle(SnapType.MIDPOINT)}
            className={`p-1.5 rounded transition-all ${
              snapSettings[SnapType.MIDPOINT]
                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                : 'hover:bg-stone-50 text-stone-600 hover:text-slate-800'
            }`}
            title="Midpoint Snap"
          >
            <Navigation size={11} />
          </button>
          <button
            onClick={() => handleSnapToggle(SnapType.CENTER)}
            className={`p-1.5 rounded transition-all ${
              snapSettings[SnapType.CENTER]
                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                : 'hover:bg-stone-50 text-stone-600 hover:text-slate-800'
            }`}
            title="Center Snap"
          >
            <Crosshair size={11} />
          </button>
          <button
            onClick={() => handleSnapToggle(SnapType.PERPENDICULAR)}
            className={`p-1.5 rounded transition-all ${
              snapSettings[SnapType.PERPENDICULAR]
                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                : 'hover:bg-stone-50 text-stone-600 hover:text-slate-800'
            }`}
            title="Perpendicular Snap"
          >
            <Zap size={11} />
          </button>
          <button
            onClick={() => handleSnapToggle(SnapType.INTERSECTION)}
            className={`p-1.5 rounded transition-all ${
              snapSettings[SnapType.INTERSECTION]
                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                : 'hover:bg-stone-50 text-stone-600 hover:text-slate-800'
            }`}
            title="Intersection Snap"
          >
            <Intersection size={11} />
          </button>
          <button
            onClick={() => handleSnapToggle(SnapType.NEAREST)}
            className={`p-1.5 rounded transition-all ${
              snapSettings[SnapType.NEAREST]
                ? 'bg-orange-100 text-orange-700 border border-orange-300'
                : 'hover:bg-stone-50 text-stone-600 hover:text-slate-800'
            }`}
            title="Nearest Snap"
          >
            <MapPin size={11} />
          </button>
        </div>

        <div className="w-px h-7 bg-stone-300"></div>

        <div className="flex items-center gap-0.5 bg-white rounded-lg p-1 shadow-sm border border-stone-200">
          {measurementTools.map((tool) => (
            <button
              key={tool.id}
              className={`p-1.5 rounded transition-all ${
                activeTool === tool.id
                  ? 'bg-orange-100 text-orange-700 border border-orange-300'
                  : 'hover:bg-stone-50 text-stone-600 hover:text-slate-800'
              }`}
              onClick={() => {
                if (activeTool === tool.id) {
                  setActiveTool(Tool.SELECT);
                  console.log(`${tool.label} tool deactivated`);
                } else {
                  setActiveTool(tool.id);
                  console.log(`${tool.label} tool activated`);
                }
              }}
              title={`${tool.label} (${tool.shortcut})`}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        <div className="w-px h-7 bg-stone-300"></div>

        <div className="flex items-center gap-0.5 bg-white rounded-lg p-1 shadow-sm border border-stone-200">
          <button
            onClick={handleAddGeometry}
            className="p-1.5 rounded transition-all hover:bg-stone-50 text-stone-600 hover:text-slate-800"
            title="Add Geometry (B)"
          >
            <Package size={11} />
          </button>
          <button
            onClick={() => {
              if (selectedShapeId) {
                setShowParametersPanel(!showParametersPanel);
              } else {
                console.log('⚠️ No shape selected - cannot open parameters panel');
              }
            }}
            className={`p-1.5 rounded transition-all ${
              selectedShapeId
                ? 'hover:bg-stone-50 text-stone-600 hover:text-slate-800'
                : 'text-stone-300 cursor-not-allowed'
            }`}
            title={selectedShapeId ? "Parameters" : "Select a shape first"}
            disabled={!selectedShapeId}
          >
            <Settings size={11} />
          </button>
          <button
            className="p-1.5 rounded transition-all hover:bg-stone-50 text-stone-600 hover:text-slate-800"
            title="Panel"
          >
            <PanelLeft size={11} />
          </button>
        </div>
      </div>

      {showPolylineMenu && (
        <div
          className="fixed bg-white backdrop-blur-sm rounded-lg border border-stone-200 py-1 z-50 shadow-xl"
          style={{
            left: polylineMenuPosition.x,
            top: polylineMenuPosition.y,
          }}
        >
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-stone-50 flex items-center gap-2 text-slate-700 hover:text-slate-800"
            onClick={handlePolylineEdit}
          >
            <Edit3 size={14} />
            <span className="font-medium">Edit Polyline</span>
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-stone-50 flex items-center gap-2 text-slate-700 hover:text-slate-800"
            onClick={() => {
              setActiveTool(Tool.POLYLINE);
              setShowPolylineMenu(false);
            }}
          >
            <GitBranch size={14} />
            <span className="font-medium">Draw Polyline</span>
          </button>
        </div>
      )}

      <ParametersPanel
        isOpen={showParametersPanel}
        onClose={() => setShowParametersPanel(false)}
      />
    </div>
  );
};

export default Toolbar;
