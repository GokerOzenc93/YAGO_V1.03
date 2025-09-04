import React from 'react';
import { useAppStore, CameraType, MeasurementUnit, ViewMode } from '../system/appStore';
import { Camera, CameraOff, Eye, Monitor, Square, Circle, Box, ZoomIn, Frame as Wireframe, EyeOff, Cuboid as Cube } from 'lucide-react';

const StatusDisplay: React.FC = () => {
  const { 
    activeTool, 
    gridSize, 
    setGridSize, 
    cameraType, 
    setCameraType,
    cameraPosition,
    selectedShapeId,
    selectedObjectPosition,
    measurementUnit,
    setMeasurementUnit,
    convertToDisplayUnit,
    shapes,
    viewMode,
    setViewMode
  } = useAppStore();
  
  const formatValue = (value: number) => convertToDisplayUnit(value).toFixed(2);

  const handleGridSizeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = parseFloat(e.target.value);
    if (!isNaN(value) && value >= 0.5 && value <= 1000) {
      setGridSize(value);
    }
  };

  const handleCameraToggle = () => {
    setCameraType(
      cameraType === CameraType.PERSPECTIVE
        ? CameraType.ORTHOGRAPHIC
        : CameraType.PERSPECTIVE
    );
  };

  const handleViewModeToggle = () => {
    const nextMode = viewMode === ViewMode.SOLID ? ViewMode.WIREFRAME : ViewMode.SOLID;
    setViewMode(nextMode);
    console.log(`🎯 Status bar view mode toggle: ${viewMode} -> ${nextMode}`);
  };

  const getViewModeIcon = () => {
    switch (viewMode) {
      case ViewMode.WIREFRAME:
        return <Wireframe size={10} className="text-purple-400" />;
      case ViewMode.SOLID:
        return <Cube size={10} className="text-green-400" />;
      default:
        return <Cube size={10} className="text-green-400" />;
    }
  };

  const getViewModeLabel = () => {
    switch (viewMode) {
      case ViewMode.WIREFRAME:
        return 'Wire';
      case ViewMode.SOLID:
        return 'Solid';
      default:
        return 'Solid';
    }
  };

  const handleZoomFit = () => {
    const event = new CustomEvent('zoomFit', { 
      detail: { shapes: shapes.filter(shape => !useAppStore.getState().hiddenShapeIds.includes(shape.id)) }
    });
    window.dispatchEvent(event);
    console.log('Zoom fit triggered from status bar');
  };
  
  return (
    <div className="flex items-center justify-between h-5 px-2 text-xs bg-gray-800/80 backdrop-blur-sm border-t border-gray-700/50">
      <div className="flex items-center gap-4">
        <div id="fps-container" className="flex items-center">
          <span className="text-gray-400 mr-1">FPS:</span>
          <span id="fps-value"></span>
        </div>
      </div>
      <div className="flex items-center gap-4">
        <button
          onClick={handleCameraToggle}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors"
          title={`Switch to ${cameraType === CameraType.PERSPECTIVE ? 'Orthographic' : 'Perspective'} Camera (C)`}
        >
          {cameraType === CameraType.PERSPECTIVE ? (
            <Camera size={12} className="text-blue-400" />
          ) : (
            <CameraOff size={12} className="text-gray-400" />
          )}
          <span className="text-xs">{cameraType === CameraType.PERSPECTIVE ? 'Persp' : 'Ortho'}</span>
        </button>

        <button
          onClick={handleViewModeToggle}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-gray-700/50 hover:bg-gray-700 transition-colors"
          title={`Current: ${getViewModeLabel()} View - Click to cycle (1/2/3)`}
        >
          {getViewModeIcon()}
          <span className="text-xs">{getViewModeLabel()}</span>
        </button>

        <button
          onClick={handleZoomFit}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-600/90 hover:bg-green-500 transition-colors"
          title="Zoom Fit - Fit all objects to view (Z)"
        >
          <ZoomIn size={12} className="text-white" />
          <span className="text-xs text-white font-medium">Fit</span>
        </button>

        <div className="flex items-center gap-1">
          <span className="text-gray-400 text-xs">Views:</span>
          <div className="flex items-center gap-0.5">
            <button
              className="px-1 py-0.5 text-xs bg-gray-700/50 hover:bg-gray-600 rounded transition-colors"
              title="Top View (T)"
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 't' });
                window.dispatchEvent(event);
              }}
            >
              <Square size={10} />
            </button>
            <button
              className="px-1 py-0.5 text-xs bg-gray-700/50 hover:bg-gray-600 rounded transition-colors"
              title="Front View (F)"
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'f' });
                window.dispatchEvent(event);
              }}
            >
              <Circle size={10} />
            </button>
            <button
              className="px-1 py-0.5 text-xs bg-gray-700/50 hover:bg-gray-600 rounded transition-colors"
              title="Right View (R)"
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'r' });
                window.dispatchEvent(event);
              }}
            >
              <Box size={10} />
            </button>
            <button
              className="px-1 py-0.5 text-xs bg-gray-700/50 hover:bg-gray-600 rounded transition-colors"
              title="Isometric View (I)"
              onClick={() => {
                const event = new KeyboardEvent('keydown', { key: 'i' });
                window.dispatchEvent(event);
              }}
            >
              <Monitor size={10} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="text-gray-400">Grid:</span>
          <input
            type="number"
            value={gridSize}
            onChange={handleGridSizeChange}
            min={0.5}
            max={1000}
            step={0.5}
            className="w-16 bg-gray-700/50 border border-gray-600/50 rounded text-xs px-1.5 py-0 h-4"
          />
          <span className="text-gray-400">mm</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400">Unit:</span>
          <select
            value={measurementUnit}
            onChange={(e) => setMeasurementUnit(e.target.value as MeasurementUnit)}
            className="bg-gray-700/50 border border-gray-600/50 rounded text-xs px-1.5 py-0 h-4"
          >
            <option value={MeasurementUnit.MM}>mm</option>
            <option value={MeasurementUnit.CM}>cm</option>
            <option value={MeasurementUnit.INCH}>inch</option>
          </select>
        </div>
      </div>
    </div>
  );
};

export default StatusDisplay;