import React, { useState } from 'react';
import { Tool, useAppStore, ModificationType, CameraType, SnapType, ViewMode, OrthoMode } from '../store/appStore';
import { MousePointer2, Move, RotateCcw, Maximize, FileDown, Upload, Save, FilePlus, Undo2, Redo2, Grid, Layers, Box, Cylinder, Settings, HelpCircle, Search, Copy, Scissors, ClipboardPaste, Square, Circle, Pentagon, FlipHorizontal, Copy as Copy1, Radius, Minus, ArrowBigRightDash, Eraser, Plus, Layers2, Eye, Monitor, Package, Edit, BarChart3, Cog, FileText, PanelLeft, GitBranch, Edit3, Camera, CameraOff, Target, Navigation, Crosshair, RotateCw, Zap, InspectionPanel as Intersection, MapPin, Frame as Wireframe, EyeOff, Cuboid as Cube, Ruler } from 'lucide-react';
import * as THREE from 'three';

const Toolbar: React.FC = () => {
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
    viewMode, // 🎯 NEW: Get current view mode
    setViewMode, // 🎯 NEW: Set view mode
    cycleViewMode, // 🎯 NEW: Cycle through view modes
    orthoMode, // 🎯 NEW: Get current ortho mode
    toggleOrthoMode // 🎯 NEW: Toggle ortho mode
  } = useAppStore();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showModifyMenu, setShowModifyMenu] = useState(false);
  const [showPolylineMenu, setShowPolylineMenu] = useState(false);
  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const [polylineMenuPosition, setPolylineMenuPosition] = useState({ x: 0, y: 0 });

  // Check if current tool should have snap disabled
  const shouldDisableSnap = ['Select', 'Move', 'Rotate', 'Scale'].includes(activeTool);

  // Helper functions for view mode
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

  // 🎯 NEW: Handle ortho mode toggle
  const handleOrthoModeToggle = () => {
    toggleOrthoMode();
  };

  // Handle transform tool selection
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

  // Close context menus when clicking outside
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

  const drawingTools = [
    { id: Tool.POLYLINE, icon: <GitBranch size={12} />, label: 'Polyline', shortcut: 'PL', hasContextMenu: true },
    { id: Tool.RECTANGLE, icon: <Square size={12} />, label: 'Rectangle', shortcut: 'R' },
    { id: Tool.CIRCLE, icon: <Circle size={12} />, label: 'Circle', shortcut: 'C' },
  ];

  const booleanTools = [
    { id: Tool.BOOLEAN_UNION, icon: <Plus size={12} />, label: 'Union', shortcut: 'U' },
    { id: Tool.BOOLEAN_SUBTRACT, icon: <Minus size={12} />, label: 'Subtract', shortcut: 'S' },
  ];

  const transformTools = [
    { id: Tool.SELECT, icon: <MousePointer2 size={12} />, label: 'Select', shortcut: 'V' },
    { id: Tool.MOVE, icon: <Move size={12} />, label: 'Move', shortcut: 'M' },
    { id: Tool.POINT_TO_POINT_MOVE, icon: <Navigation size={12} />, label: 'Point to Point', shortcut: 'P2P' },
    { id: Tool.ROTATE, icon: <RotateCcw size={12} />, label: 'Rotate', shortcut: 'Ro' },
    { id: Tool.SCALE, icon: <Maximize size={12} />, label: 'Scale', shortcut: 'S' },
  ];

  const measurementTools = [
    { id: Tool.DIMENSION, icon: <Ruler size={12} />, label: 'Dimension', shortcut: 'D' },
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
        { icon: <Cube size={11} />, label: 'Solid View', shortcut: '1' }, // 🎯 NEW
        { icon: <Wireframe size={11} />, label: 'Wireframe View', shortcut: '2' }, // 🎯 NEW
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
    { icon: <FilePlus size={12} />, label: 'New', shortcut: 'Ctrl+N' },
    { icon: <Save size={12} />, label: 'Save', shortcut: 'Ctrl+S' },
    { icon: <FileDown size={12} />, label: 'Save As', shortcut: 'Ctrl+Shift+S' },
  ];

  const editButtons = [
    { icon: <Undo2 size={12} />, label: 'Undo', shortcut: 'Ctrl+Z' },
    { icon: <Redo2 size={12} />, label: 'Redo', shortcut: 'Ctrl+Y' },
  ];

  const clipboardButtons = [
    { icon: <Scissors size={12} />, label: 'Cut', shortcut: 'Ctrl+X' },
    { icon: <Copy size={12} />, label: 'Copy', shortcut: 'Ctrl+C' },
    { icon: <ClipboardPaste size={12} />, label: 'Paste', shortcut: 'Ctrl+V' },
  ];

  return (
    <div className="flex flex-col font-inter">
      {/* Top app bar - Antrasit mavi professional header */}
      <div className="flex items-center h-8 px-3 bg-gray-900 border-b border-gray-800 shadow-lg">
        <div className="flex items-center gap-3">
          {/* Logo and app name */}
          <div className="flex items-center gap-1.5">
            <img 
              src="/image.png" 
              alt="YAGO Design Logo" 
              className="w-27 h-16 object-contain"
            />
            <div className="flex flex-col">
              <span className="font-medium text-[10px] text-white/80 tracking-wider leading-none">FURNITURE CAD</span>
            </div>
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-white/30"></div>

          {/* Company info */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-white/70 font-medium">Company:</span>
            <span className="text-white font-medium">Göker İnşaat</span>
          </div>

          {/* Separator */}
          <div className="w-px h-4 bg-white/30"></div>

          {/* Project info */}
          <div className="flex items-center gap-1.5 text-sm">
            <span className="text-white/70 font-medium">Project:</span>
            <span className="text-white font-medium">Drawing1</span>
          </div>
        </div>

        {/* Right side controls */}
        <div className="ml-auto flex items-center gap-2">
          {/* Camera Toggle Button */}
          <button
            onClick={handleCameraToggle}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-white/20 hover:bg-white/30 transition-colors backdrop-blur-sm"
            title={`Switch to ${cameraType === CameraType.PERSPECTIVE ? 'Orthographic' : 'Perspective'} Camera (C)`}
          >
            {cameraType === CameraType.PERSPECTIVE ? (
              <Camera size={12} className="text-white" />
            ) : (
              <CameraOff size={12} className="text-white/70" />
            )}
            <span className="text-sm font-medium text-white">
              {cameraType === CameraType.PERSPECTIVE ? 'Persp' : 'Ortho'}
            </span>
          </button>

          {/* 🎯 NEW: View Mode Indicator - Moved from Scene */}
          <button
            onClick={() => {
              const { cycleViewMode } = useAppStore.getState();
              cycleViewMode();
              console.log('🎯 View mode button clicked');
            }}
            className="flex items-center gap-1.5 px-3 py-1 rounded-lg bg-orange-500/20 hover:bg-orange-500/30 transition-colors backdrop-blur-sm border border-orange-400/30"
            title={`Current: ${getViewModeLabel()} View - Click to cycle (1/2/3 or V)`}
          >
            {getViewModeIcon()}
            <span className="text-sm font-medium text-orange-100">
              {getViewModeLabel()}
            </span>
          </button>

          {/* 🎯 NEW: Ortho Mode Toggle */}
          <button
            onClick={handleOrthoModeToggle}
            className={`flex items-center gap-1 px-2 py-0.5 rounded transition-colors ${
              orthoMode === OrthoMode.ON
                ? 'bg-orange-500 text-white shadow-lg border border-orange-400'
                : 'bg-orange-500/20 hover:bg-orange-500/30 text-orange-100 border border-orange-400/30'
            }`}
            title={`Ortho Mode: ${orthoMode === OrthoMode.ON ? 'ON' : 'OFF'} - Snap to axis directions`}
          >
            <Grid size={12} className={orthoMode === OrthoMode.ON ? 'text-white' : 'text-orange-100'} />
            <span className="text-sm font-medium">
              Ortho
            </span>
          </button>

          {/* Separator */}
          <div className="w-px h-4 bg-white/30"></div>

          <div className="relative">
            <Search size={12} className="absolute left-2 top-1.5 text-white/70" />
            <input
              type="text"
              placeholder="Search..."
              className="w-36 h-7 pl-8 pr-2 text-sm bg-white/20 rounded-lg border border-white/30 focus:outline-none focus:border-white/50 focus:bg-white/30 transition-colors placeholder-white/70 text-white backdrop-blur-sm"
            />
          </div>
          <button className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <Settings size={12} className="text-white" />
          </button>
          <button className="p-1.5 hover:bg-white/20 rounded-lg transition-colors">
            <HelpCircle size={12} className="text-white" />
          </button>
        </div>
      </div>

      {/* Menu bar - Slightly increased height */}
      <div className="flex items-center h-6 px-1 bg-white border-b border-gray-200">
        <div className="flex items-center h-full">
          {menus.map((menu) => (
            <div key={menu.label} className="relative h-full">
              <button
                className={`h-full px-2 text-xs font-medium hover:bg-gray-100 transition-colors flex items-center ${
                  activeMenu === menu.label ? 'bg-gray-100 text-gray-800' : 'text-gray-700'
                }`}
                onClick={() => setActiveMenu(activeMenu === menu.label ? null : menu.label)}
                onMouseEnter={() => activeMenu && setActiveMenu(menu.label)}
              >
                {menu.label}
              </button>
              {activeMenu === menu.label && (
                <div 
                  className="absolute left-0 top-full mt-1 w-52 bg-white backdrop-blur-sm rounded-lg border border-gray-200 py-1 z-50 shadow-xl"
                  onMouseLeave={() => setActiveMenu(null)}
                >
                  {menu.items.map((item, i) => (
                    item.type === 'separator' ? (
                      <div key={i} className="border-t border-gray-100 my-1"></div>
                    ) : (
                      <button 
                        key={i}
                        className="flex items-center justify-between w-full h-7 px-3 text-xs hover:bg-gray-100 transition-colors text-gray-700 hover:text-gray-800"
                        onClick={() => {
                          // 🎯 NEW: Handle view mode menu items
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
                          <span className="text-gray-500 text-xs font-medium">{item.shortcut}</span>
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

      {/* Main toolbar - Consistent styling */}
      <div className="flex items-center h-10 gap-2 px-3 bg-white border-b border-gray-200">
        {/* Quick access buttons */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 shadow-sm">
          {quickAccessButtons.map((button, index) => (
            <button
              key={index}
              className="p-1 rounded-md text-gray-600 hover:bg-white hover:text-gray-800 transition-colors shadow-sm"
              title={`${button.label} (${button.shortcut})`}
            >
              {React.cloneElement(button.icon, { size: 12 })}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300 mx-1"></div>


        {/* Edit buttons */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 shadow-sm">
          {editButtons.map((button, index) => (
            <button
              key={index}
              className="p-1 rounded-md text-gray-600 hover:bg-white hover:text-gray-800 transition-colors shadow-sm"
              title={`${button.label} (${button.shortcut})`}
            >
              {React.cloneElement(button.icon, { size: 12 })}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Transform tools (with Select moved to front) */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 shadow-sm">
          {transformTools.map((tool) => (
            <button
              key={tool.id}
              className={`p-1.5 rounded-md transition-all ${
                activeTool === tool.id
                  ? 'bg-gray-700 text-white shadow-md'
                  : (tool.id === Tool.SELECT || selectedShapeId)
                  ? 'hover:bg-white text-gray-600 hover:text-gray-800 shadow-sm'
                  : 'opacity-50 cursor-not-allowed text-gray-400'
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
              {React.cloneElement(tool.icon, { size: 12 })}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Individual Snap Buttons */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 shadow-sm">
          <button
            onClick={() => handleSnapToggle(SnapType.ENDPOINT)}
            className={`p-1.5 rounded-md transition-all ${
              snapSettings[SnapType.ENDPOINT]
                ? 'bg-gray-700 text-white shadow-md'
                : 'hover:bg-white text-gray-600 hover:text-gray-800 shadow-sm'
            }`}
            title="Endpoint Snap"
          >
            <Target size={12} />
          </button>
          <button
            onClick={() => handleSnapToggle(SnapType.MIDPOINT)}
            className={`p-1.5 rounded-md transition-all ${
              snapSettings[SnapType.MIDPOINT]
                ? 'bg-gray-700 text-white shadow-md'
                : 'hover:bg-white text-gray-600 hover:text-gray-800 shadow-sm'
            }`}
            title="Midpoint Snap"
          >
            <Navigation size={12} />
          </button>
          <button
            onClick={() => handleSnapToggle(SnapType.CENTER)}
            className={`p-1.5 rounded-md transition-all ${
              snapSettings[SnapType.CENTER]
                ? 'bg-gray-700 text-white shadow-md'
                : 'hover:bg-white text-gray-600 hover:text-gray-800 shadow-sm'
            }`}
            title="Center Snap"
          >
            <Crosshair size={12} />
          </button>
          <button
            onClick={() => handleSnapToggle(SnapType.PERPENDICULAR)}
            className={`p-1.5 rounded-md transition-all ${
              snapSettings[SnapType.PERPENDICULAR]
                ? 'bg-gray-700 text-white shadow-md'
                : 'hover:bg-white text-gray-600 hover:text-gray-800 shadow-sm'
            }`}
            title="Perpendicular Snap"
          >
            <Zap size={12} />
          </button>
          <button
            onClick={() => handleSnapToggle(SnapType.INTERSECTION)}
            className={`p-1.5 rounded-md transition-all ${
              snapSettings[SnapType.INTERSECTION]
                ? 'bg-gray-700 text-white shadow-md'
                : 'hover:bg-white text-gray-600 hover:text-gray-800 shadow-sm'
            }`}
            title="Intersection Snap"
          >
            <Intersection size={12} />
          </button>
          <button
            onClick={() => handleSnapToggle(SnapType.NEAREST)}
            className={`p-1.5 rounded-md transition-all ${
              snapSettings[SnapType.NEAREST]
                ? 'bg-gray-700 text-white shadow-md'
                : 'hover:bg-white text-gray-600 hover:text-gray-800 shadow-sm'
            }`}
            title="Nearest Snap"
          >
            <MapPin size={12} />
          </button>
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Drawing tools */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 shadow-sm">
          {drawingTools.map((tool) => (
            <button
              key={tool.id}
              className={`p-1.5 rounded-md transition-all ${
                activeTool === tool.id
                  ? 'bg-gray-700 text-white shadow-md'
                  : 'hover:bg-white text-gray-600 hover:text-gray-800 shadow-sm'
              }`}
              onClick={() => setActiveTool(tool.id)}
              onContextMenu={tool.hasContextMenu ? handlePolylineRightClick : undefined}
              title={`${tool.label} (${tool.shortcut})`}
            >
              {React.cloneElement(tool.icon, { size: 12 })}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Measurement Tools */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 shadow-sm">
          {measurementTools.map((tool) => (
            <button
              key={tool.id}
              className={`p-1.5 rounded-md transition-all ${
                activeTool === tool.id
                  ? 'bg-slate-700 text-white shadow-md border border-slate-600'
                  : 'hover:bg-white text-slate-600 hover:text-slate-800 shadow-sm border border-gray-200'
              }`}
              onClick={() => {
                if (activeTool === tool.id) {
                  // If already active, deactivate and switch to Select
                  setActiveTool(Tool.SELECT);
                  console.log(`${tool.label} tool deactivated`);
                } else {
                  // Activate the tool
                  setActiveTool(tool.id);
                  console.log(`${tool.label} tool activated`);
                }
              }}
              title={`${tool.label} (${tool.shortcut})`}
            >
              {React.cloneElement(tool.icon, { size: 12 })}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300 mx-1"></div>

        {/* Boolean Operations */}
        <div className="flex items-center gap-1 bg-gray-50 rounded-lg p-1 shadow-sm">
          {booleanTools.map((tool) => (
            <button
              key={tool.id}
              className={`p-1.5 rounded-md transition-all ${
                activeTool === tool.id
                  ? 'bg-gray-700 text-white shadow-md'
                  : !selectedShapeId
                  ? 'opacity-50 cursor-not-allowed text-gray-400'
                  : 'hover:bg-white text-gray-600 hover:text-gray-800 shadow-sm'
              }`}
              onClick={() => {
                if (selectedShapeId) {
                  if (tool.id === Tool.BOOLEAN_UNION) {
                    performBooleanOperation('union');
                  } else if (tool.id === Tool.BOOLEAN_SUBTRACT) {
                    performBooleanOperation('subtract');
                  }
                }
              }}
              disabled={!selectedShapeId}
              title={`${tool.label} (${tool.shortcut})`}
            >
              {React.cloneElement(tool.icon, { size: 12 })}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-6 bg-gray-300 mx-1"></div>
      </div>

      {/* Polyline Context Menu */}
      {showPolylineMenu && (
        <div
          className="fixed bg-white backdrop-blur-sm rounded-lg border border-gray-200 py-1 z-50 shadow-xl"
          style={{
            left: polylineMenuPosition.x,
            top: polylineMenuPosition.y,
          }}
        >
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-700 hover:text-gray-800"
            onClick={handlePolylineEdit}
          >
            <Edit3 size={14} />
            <span className="font-medium">Edit Polyline</span>
          </button>
          <button
            className="w-full px-3 py-2 text-left text-sm hover:bg-gray-100 flex items-center gap-2 text-gray-700 hover:text-gray-800"
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
      {/* Snap Settings Menu */}
    </div>
  );
};

export default Toolbar;