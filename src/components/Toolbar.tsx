import React, { useState } from 'react';
import { Tool, useAppStore, ModificationType, CameraType, SnapType, ViewMode } from '../store/appStore';
import { MousePointer2, Move, RotateCcw, Maximize, FileDown, Upload, Save, FilePlus, Undo2, Redo2, Grid, Layers, Box, Cylinder, Settings, HelpCircle, Search, Copy, Scissors, ClipboardPaste, Square, Circle, Pentagon, FlipHorizontal, Copy as Copy1, Radius, Minus, ArrowBigRightDash, Eraser, Plus, Layers2, Eye, Monitor, Package, Edit, BarChart3, Cog, FileText, PanelLeft, GitBranch, Edit3, Camera, CameraOff, Target, Navigation, Crosshair, RotateCw, Zap, InspectionPanel as Intersection, MapPin, Frame as Wireframe, EyeOff, Cuboid as Cube } from 'lucide-react';
import * as THREE from 'three';

const Toolbar: React.FC = () => {
  const { 
    setActiveTool, 
    activeTool, 
    addShape, 
    selectedShapeId, 
    modifyShape, 
    cameraType, 
    setCameraType, 
    snapSettings, 
    toggleSnapSetting,
    viewMode, // 🎯 NEW: Get current view mode
    setViewMode, // 🎯 NEW: Set view mode
    cycleViewMode // 🎯 NEW: Cycle through view modes
  } = useAppStore();
  const [activeMenu, setActiveMenu] = useState<string | null>(null);
  const [showModifyMenu, setShowModifyMenu] = useState(false);
  const [showPolylineMenu, setShowPolylineMenu] = useState(false);
  const [showSnapMenu, setShowSnapMenu] = useState(false);
  const [polylineMenuPosition, setPolylineMenuPosition] = useState({ x: 0, y: 0 });

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
        return <Cube size={10} className="text-blue-400" />;
      case ViewMode.WIREFRAME:
        return <Wireframe size={10} className="text-purple-400" />;
      default:
        return <Cube size={10} className="text-blue-400" />;
    }
  };

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode);
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
    { id: Tool.POLYGON, icon: <Pentagon size={12} />, label: 'Polygon', shortcut: 'P' },
  ];

  const modifyTools = [
    { id: ModificationType.MIRROR, icon: <FlipHorizontal size={12} />, label: 'Mirror', shortcut: 'Mi' },
    { id: ModificationType.ARRAY, icon: <Copy1 size={12} />, label: 'Array', shortcut: 'Ar' },
    { id: ModificationType.FILLET, icon: <Radius size={12} />, label: 'Fillet', shortcut: 'F' },
    { id: ModificationType.CHAMFER, icon: <Minus size={12} />, label: 'Chamfer', shortcut: 'Ch' },
    { id: Tool.TRIM, icon: <Scissors size={12} />, label: 'Trim', shortcut: 'Tr' },
    { id: Tool.EXTEND, icon: <ArrowBigRightDash size={12} />, label: 'Extend', shortcut: 'Ex' },
  ];

  const transformTools = [
    { id: Tool.SELECT, icon: <MousePointer2 size={12} />, label: 'Select', shortcut: 'V' },
    { id: Tool.MOVE, icon: <Move size={12} />, label: 'Move', shortcut: 'M' },
    { id: Tool.ROTATE, icon: <RotateCcw size={12} />, label: 'Rotate', shortcut: 'Ro' },
    { id: Tool.SCALE, icon: <Maximize size={12} />, label: 'Scale', shortcut: 'S' },
  ];

  const snapTools = [
    { id: SnapType.ENDPOINT, icon: <Target size={12} />, label: 'Endpoint', shortcut: 'End' },
    { id: SnapType.MIDPOINT, icon: <Navigation size={12} />, label: 'Midpoint', shortcut: 'Mid' },
    { id: SnapType.CENTER, icon: <Crosshair size={12} />, label: 'Center', shortcut: 'Cen' },
    { id: SnapType.QUADRANT, icon: <RotateCw size={12} />, label: 'Quadrant', shortcut: 'Qua' },
    { id: SnapType.PERPENDICULAR, icon: <Zap size={12} />, label: 'Perpendicular', shortcut: 'Per' },
    { id: SnapType.INTERSECTION, icon: <Intersection size={12} />, label: 'Intersection', shortcut: 'Int' },
    { id: SnapType.NEAREST, icon: <MapPin size={12} />, label: 'Nearest', shortcut: 'Nea' },
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
      {/* Top app bar - Consistent with terminal styling */}
      <div className="flex items-center h-7 px-2 bg-gradient-to-r from-gray-800 to-gray-900 border-b border-gray-700/50 shadow-sm">
        <div className="flex items-center gap-3">
          {/* Logo and app name */}
          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-center w-6 h-6 bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 rounded-lg shadow-lg border border-blue-400/30">
              {/* Professional Furniture CAD Icon */}
              <svg width="16" height="16" viewBox="0 0 24 24" className="text-white">
                {/* Cabinet/Furniture outline */}
                <rect x="3" y="4" width="18" height="16" rx="1" fill="none" stroke="currentColor" strokeWidth="1.5"/>
                {/* Vertical divider */}
                <line x1="12" y1="4" x2="12" y2="20" stroke="currentColor" strokeWidth="1"/>
                {/* Horizontal shelves */}
                <line x1="3" y1="9" x2="21" y2="9" stroke="currentColor" strokeWidth="1"/>
                <line x1="3" y1="15" x2="21" y2="15" stroke="currentColor" strokeWidth="1"/>
                {/* Door handles */}
                <circle cx="9" cy="12" r="0.8" fill="currentColor"/>
                <circle cx="15" cy="12" r="0.8" fill="currentColor"/>
                {/* CAD dimension lines */}
                <line x1="1" y1="4" x2="1" y2="20" stroke="currentColor" strokeWidth="0.5" opacity="0.7"/>
                <line x1="0.5" y1="4" x2="1.5" y2="4" stroke="currentColor" strokeWidth="0.5" opacity="0.7"/>
                <line x1="0.5" y1="20" x2="1.5" y2="20" stroke="currentColor" strokeWidth="0.5" opacity="0.7"/>
                {/* Top dimension line */}
                <line x1="3" y1="2" x2="21" y2="2" stroke="currentColor" strokeWidth="0.5" opacity="0.7"/>
                <line x1="3" y1="1.5" x2="3" y2="2.5" stroke="currentColor" strokeWidth="0.5" opacity="0.7"/>
                <line x1="21" y1="1.5" x2="21" y2="2.5" stroke="currentColor" strokeWidth="0.5" opacity="0.7"/>
              </svg>
            </div>
            <div className="flex flex-col">
              <span className="font-bold text-sm text-white tracking-wide leading-none">YagoDesign</span>
              <span className="font-medium text-[9px] text-blue-200/80 tracking-wider leading-none">FURNITURE CAD</span>
            </div>
          </div>

          {/* Separator */}
          <div className="w-px h-3 bg-gray-600"></div>

          {/* Company info */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-400 font-medium">Company:</span>
            <span className="text-gray-100 font-medium">Göker İnşaat</span>
          </div>

          {/* Separator */}
          <div className="w-px h-3 bg-gray-600"></div>

          {/* Project info */}
          <div className="flex items-center gap-1.5 text-xs">
            <span className="text-gray-400 font-medium">Project:</span>
            <span className="text-gray-100 font-medium">Drawing1</span>
          </div>
        </div>

        {/* Right side controls */}
        <div className="ml-auto flex items-center gap-2">
          {/* Camera Toggle Button */}
          <button
            onClick={handleCameraToggle}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-700/50 hover:bg-gray-600 transition-colors"
            title={`Switch to ${cameraType === CameraType.PERSPECTIVE ? 'Orthographic' : 'Perspective'} Camera (C)`}
          >
            {cameraType === CameraType.PERSPECTIVE ? (
              <Camera size={10} className="text-blue-400" />
            ) : (
              <CameraOff size={10} className="text-gray-400" />
            )}
            <span className="text-xs font-medium text-gray-200">
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
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-gray-700/50 hover:bg-gray-600 transition-colors"
            title={`Current: ${getViewModeLabel()} View - Click to cycle (1/2/3 or V)`}
          >
            {getViewModeIcon()}
            <span className="text-xs font-medium text-gray-200">
              {getViewModeLabel()}
            </span>
          </button>

          {/* Separator */}
          <div className="w-px h-3 bg-gray-600"></div>

          <div className="relative">
            <Search size={10} className="absolute left-1.5 top-1 text-gray-400" />
            <input
              type="text"
              placeholder="Search..."
              className="w-32 h-5 pl-6 pr-1.5 text-xs bg-gray-700/50 rounded border border-gray-600/50 focus:outline-none focus:border-blue-500/50 focus:bg-gray-700/75 transition-colors"
            />
          </div>
          <button className="p-1 hover:bg-gray-700/50 rounded transition-colors">
            <Settings size={10} className="text-gray-300" />
          </button>
          <button className="p-1 hover:bg-gray-700/50 rounded transition-colors">
            <HelpCircle size={10} className="text-gray-300" />
          </button>
        </div>
      </div>

      {/* Menu bar - Slightly increased height */}
      <div className="flex items-center h-6 px-1 bg-gray-800/90 border-b border-gray-600/50">
        <div className="flex items-center h-full">
          {menus.map((menu) => (
            <div key={menu.label} className="relative h-full">
              <button
                className={`h-full px-1.5 text-xs font-medium hover:bg-gray-700/50 transition-colors flex items-center ${
                  activeMenu === menu.label ? 'bg-gray-700/50' : ''
                }`}
                onClick={() => setActiveMenu(activeMenu === menu.label ? null : menu.label)}
                onMouseEnter={() => activeMenu && setActiveMenu(menu.label)}
              >
                {menu.label}
              </button>
              {activeMenu === menu.label && (
                <div 
                  className="absolute left-0 top-full mt-0.5 w-48 bg-gray-800/95 backdrop-blur-sm rounded border border-gray-600/50 py-0.5 z-50 shadow-lg"
                  onMouseLeave={() => setActiveMenu(null)}
                >
                  {menu.items.map((item, i) => (
                    item.type === 'separator' ? (
                      <div key={i} className="border-t border-gray-600/50 my-0.5"></div>
                    ) : (
                      <button 
                        key={i}
                        className="flex items-center justify-between w-full h-6 px-2 text-xs hover:bg-gray-700/50 transition-colors"
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
                          <span className="text-gray-400 text-[10px] font-medium">{item.shortcut}</span>
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
      <div className="flex items-center h-8 gap-1 px-1 bg-gray-700/90 backdrop-blur-sm border-b border-gray-600/50">
        {/* Quick access buttons */}
        <div className="flex items-center gap-px bg-gray-800/50 rounded shadow-sm">
          {quickAccessButtons.map((button, index) => (
            <button
              key={index}
              className="p-1 rounded text-gray-300 hover:bg-gray-600/50 hover:text-gray-100 transition-colors"
              title={`${button.label} (${button.shortcut})`}
            >
              {button.icon}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-gray-600/50 mx-0.5"></div>


        {/* Edit buttons */}
        <div className="flex items-center gap-px bg-gray-800/50 rounded shadow-sm">
          {editButtons.map((button, index) => (
            <button
              key={index}
              className="p-1 rounded text-gray-300 hover:bg-gray-600/50 hover:text-gray-100 transition-colors"
              title={`${button.label} (${button.shortcut})`}
            >
              {button.icon}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-gray-600/50 mx-0.5"></div>

        {/* Transform tools (with Select moved to front) */}
        <div className="flex items-center gap-px bg-gray-800/50 rounded shadow-sm">
          {transformTools.map((tool) => (
            <button
              key={tool.id}
              className={`p-1 rounded transition-all ${
                activeTool === tool.id
                  ? 'bg-blue-600/90 text-white shadow-sm'
                  : 'hover:bg-gray-600/50 text-gray-300 hover:text-gray-100'
              }`}
              onClick={() => setActiveTool(tool.id)}
              title={`${tool.label} (${tool.shortcut})`}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-gray-600/50 mx-0.5"></div>

        {/* Drawing tools */}
        <div className="flex items-center gap-px bg-gray-800/50 rounded shadow-sm">
          {drawingTools.map((tool) => (
            <button
              key={tool.id}
              className={`p-1 rounded transition-all ${
                activeTool === tool.id
                  ? 'bg-blue-600/90 text-white shadow-sm'
                  : 'hover:bg-gray-600/50 text-gray-300 hover:text-gray-100'
              }`}
              onClick={() => setActiveTool(tool.id)}
              onContextMenu={tool.hasContextMenu ? handlePolylineRightClick : undefined}
              title={`${tool.label} (${tool.shortcut})`}
            >
              {tool.icon}
            </button>
          ))}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-gray-600/50 mx-0.5"></div>

        {/* Snap Tools */}
        <div className="flex items-center gap-px bg-gray-800/50 rounded shadow-sm">
          <button
            className="p-1 rounded text-gray-300 hover:bg-gray-600/50 hover:text-gray-100 transition-colors"
            onClick={() => setShowSnapMenu(!showSnapMenu)}
            title="Snap Settings"
          >
            <Target size={12} />
          </button>
        </div>

        <div className="relative">
          {/* Snap Menu Dropdown */}
          {showSnapMenu && (
            <div className="absolute top-full left-0 mt-1 bg-gray-800/95 backdrop-blur-sm rounded border border-gray-600/50 py-1 z-50 shadow-lg min-w-[180px]">
              {snapTools.map((snap) => (
                <button
                  key={snap.id}
                  className={`w-full px-3 py-1.5 text-left text-xs hover:bg-gray-700/50 flex items-center justify-between transition-colors ${
                    snapSettings[snap.id] ? 'bg-green-600/20 text-green-300' : 'text-gray-300'
                  }`}
                  onClick={() => handleSnapToggle(snap.id)}
                >
                  <div className="flex items-center gap-1.5">
                    {snap.icon}
                    <span className="font-medium">{snap.label}</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <span className="text-[10px] text-gray-400">{snap.shortcut}</span>
                    <div className={`w-2 h-2 rounded-full ${snapSettings[snap.id] ? 'bg-green-500' : 'bg-gray-600'}`} />
                  </div>
                </button>
              ))}
              <div className="border-t border-gray-600/50 my-1"></div>
              <div className="px-3 py-1 text-[10px] text-gray-400">
                Click to toggle snap modes
              </div>
            </div>
          )}
        </div>

        {/* Separator */}
        <div className="w-px h-5 bg-gray-600/50 mx-0.5"></div>

        {/* Modify tools */}
        <div className="flex items-center gap-px bg-gray-800/50 rounded shadow-sm">
          {modifyTools.map((tool) => (
            <button
              key={tool.id}
              className={`p-1 rounded transition-all hover:bg-gray-600/50 text-gray-300 hover:text-gray-100 ${
                !selectedShapeId ? 'opacity-50 cursor-not-allowed' : ''
              }`}
              onClick={() => selectedShapeId && handleModify(tool.id)}
              title={`${tool.label} (${tool.shortcut})`}
              disabled={!selectedShapeId}
            >
              {tool.icon}
            </button>
          ))}
        </div>
      </div>

      {/* Polyline Context Menu */}
      {showPolylineMenu && (
        <div
          className="fixed bg-gray-800/95 backdrop-blur-sm rounded border border-gray-600/50 py-1 z-50 shadow-lg"
          style={{
            left: polylineMenuPosition.x,
            top: polylineMenuPosition.y,
          }}
        >
          <button
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-700/50 flex items-center gap-1.5"
            onClick={handlePolylineEdit}
          >
            <Edit3 size={11} />
            <span className="font-medium">Edit Polyline</span>
          </button>
          <button
            className="w-full px-3 py-1.5 text-left text-xs hover:bg-gray-700/50 flex items-center gap-1.5"
            onClick={() => {
              setActiveTool(Tool.POLYLINE);
              setShowPolylineMenu(false);
            }}
          >
            <GitBranch size={11} />
            <span className="font-medium">Draw Polyline</span>
          </button>
        </div>
      )}
    </div>
  );
};

export default Toolbar;