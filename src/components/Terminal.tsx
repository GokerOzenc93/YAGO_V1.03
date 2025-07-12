import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, ChevronUp, ChevronDown, Activity, Cpu, HardDrive, Camera, Ruler, MapPin, Send } from 'lucide-react';
import { useAppStore, CameraType, Tool, ViewMode } from '../store/appStore';

interface TerminalEntry {
  id: string;
  type: 'info' | 'success' | 'warning' | 'error' | 'input' | 'output' | 'command';
  message: string;
  details?: string;
  timestamp: Date;
}

const Terminal: React.FC = () => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [commandInput, setCommandInput] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const terminalRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const { 
    activeTool, 
    selectedShapeId, 
    shapes, 
    cameraType, 
    measurementUnit, 
    cameraPosition, 
    convertToDisplayUnit, 
    convertToBaseUnit,
    viewMode, // 🎯 NEW: Get current view mode
    setViewMode, // 🎯 NEW: Set view mode
    cycleViewMode // 🎯 NEW: Cycle view mode
  } = useAppStore();

  const addEntry = (type: TerminalEntry['type'], message: string, details?: string) => {
    const newEntry: TerminalEntry = {
      id: Math.random().toString(36).substr(2, 9),
      type,
      message,
      details,
      timestamp: new Date()
    };
    
    setEntries(prev => [...prev.slice(-49), newEntry]); // Keep last 50 entries
  };

  // Handle command execution
  const executeCommand = (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    // Add command to history
    setCommandHistory(prev => [...prev.slice(-19), trimmedCommand]); // Keep last 20 commands
    setHistoryIndex(-1);

    // Log the command
    addEntry('command', `> ${trimmedCommand}`, 'User command executed');

    // Handle other commands
    const [cmd, ...args] = trimmedCommand.toLowerCase().split(' ');
    
    switch (cmd) {
      case 'help':
      case '?':
        addEntry('info', 'Available commands:', 
          'help - Show this help\nclear - Clear terminal\nstatus - Show system status\nview [t|f|r|l|b|u|i|h] - Change camera view\ncamera [persp|ortho] - Change camera type\nviewmode [solid|transparent|wireframe] - Change view mode\n[number] - Set polyline/polygon distance (while drawing)');
        break;
        
      case 'clear':
      case 'cls':
        setEntries([]);
        addEntry('info', 'Terminal cleared', 'Command history preserved');
        break;
        
      case 'status':
        addEntry('info', 'System Status:', 
          `Tool: ${activeTool}\nShapes: ${shapes.length}\nCamera: ${cameraType}\nView Mode: ${viewMode}\nUnit: ${measurementUnit}\nSelected: ${selectedShapeId ? 'Yes' : 'No'}`);
        break;

      case 'view':
        if (args.length > 0) {
          const viewType = args[0].toLowerCase();
          const viewMap: { [key: string]: string } = {
            't': 't', 'top': 't',
            'f': 'f', 'front': 'f',
            'r': 'r', 'right': 'r',
            'l': 'l', 'left': 'l',
            'b': 'b', 'back': 'b', 'bottom': 'b',
            'u': 'u', 'under': 'u',
            'i': 'i', 'iso': 'i', 'isometric': 'i',
            'h': 'h', 'home': 'h', 'reset': 'h'
          };
          
          if (viewMap[viewType]) {
            const event = new KeyboardEvent('keydown', { key: viewMap[viewType] });
            window.dispatchEvent(event);
            addEntry('success', `Camera view changed to: ${viewType}`, 'View updated');
          } else {
            addEntry('error', 'Invalid view type', 'Available views: t(op), f(ront), r(ight), l(eft), b(ack), u(nder), i(sometric), h(ome)');
          }
        } else {
          addEntry('info', 'Camera view commands:', 
            'view t - Top view\nview f - Front view\nview r - Right view\nview l - Left view\nview b - Back view\nview u - Bottom view\nview i - Isometric view\nview h - Home view');
        }
        break;

      // 🎯 NEW: View mode commands
      case 'viewmode':
      case 'vm':
        if (args.length > 0) {
          const mode = args[0].toLowerCase();
          if (mode === 'solid' || mode === 's' || mode === '1') {
            setViewMode(ViewMode.SOLID);
            addEntry('success', 'View mode set to Solid', 'Objects are now fully opaque');
          } else if (mode === 'wireframe' || mode === 'wire' || mode === 'w' || mode === '2') {
            setViewMode(ViewMode.WIREFRAME);
            addEntry('success', 'View mode set to Wireframe', 'Only edges are visible');
          } else if (mode === 'cycle' || mode === 'c') {
            cycleViewMode();
            const newMode = useAppStore.getState().viewMode;
            addEntry('success', `View mode cycled to: ${newMode}`, 'View mode changed');
          } else {
            addEntry('error', 'Invalid view mode', 'Available modes: solid, wireframe, cycle');
          }
        } else {
          addEntry('info', `Current view mode: ${viewMode}`, 'Use "viewmode [solid|wireframe|cycle]" to change');
        }
        break;
        
      case 'grid':
        if (args.length > 0) {
          const gridValue = parseFloat(args[0]);
          if (!isNaN(gridValue) && gridValue > 0) {
            useAppStore.getState().setGridSize(gridValue);
            addEntry('success', `Grid size set to ${gridValue}mm`, 'Grid updated');
          } else {
            addEntry('error', 'Invalid grid size', 'Please provide a positive number');
          }
        } else {
          addEntry('info', `Current grid size: ${useAppStore.getState().gridSize}mm`, 'Use "grid [size]" to change');
        }
        break;
        
      case 'unit':
        if (args.length > 0) {
          const unit = args[0].toUpperCase();
          if (['MM', 'CM', 'INCH'].includes(unit)) {
            useAppStore.getState().setMeasurementUnit(unit as any);
            addEntry('success', `Unit changed to ${unit}`, 'All measurements updated');
          } else {
            addEntry('error', 'Invalid unit', 'Available units: mm, cm, inch');
          }
        } else {
          addEntry('info', `Current unit: ${measurementUnit}`, 'Use "unit [mm|cm|inch]" to change');
        }
        break;
        
      case 'camera':
        if (args.length > 0) {
          const mode = args[0].toLowerCase();
          if (mode === 'perspective' || mode === 'persp') {
            useAppStore.getState().setCameraType(CameraType.PERSPECTIVE);
            addEntry('success', 'Camera set to Perspective', 'View mode updated');
          } else if (mode === 'orthographic' || mode === 'ortho') {
            useAppStore.getState().setCameraType(CameraType.ORTHOGRAPHIC);
            addEntry('success', 'Camera set to Orthographic', 'View mode updated');
          } else {
            addEntry('error', 'Invalid camera mode', 'Use: perspective, persp, orthographic, ortho');
          }
        } else {
          addEntry('info', `Current camera: ${cameraType}`, 'Use "camera [perspective|orthographic]" to change');
        }
        break;
        
      case 'tool':
        if (args.length > 0) {
          const toolName = args.join(' ').toLowerCase();
          const toolMap: { [key: string]: Tool } = {
            'select': Tool.SELECT,
            'move': Tool.MOVE,
            'rotate': Tool.ROTATE,
            'scale': Tool.SCALE,
            'polyline': Tool.POLYLINE,
            'polygon': Tool.POLYGON,
            'rectangle': Tool.RECTANGLE,
            'circle': Tool.CIRCLE
          };
          
          if (toolMap[toolName]) {
            useAppStore.getState().setActiveTool(toolMap[toolName]);
            addEntry('success', `Tool changed to ${toolMap[toolName]}`, 'Active tool updated');
          } else {
            addEntry('error', 'Invalid tool name', 'Available tools: select, move, rotate, scale, polyline, polygon, rectangle, circle');
          }
        } else {
          addEntry('info', `Current tool: ${activeTool}`, 'Use "tool [name]" to change');
        }
        break;
        
      default:
        addEntry('error', `Unknown command: ${cmd}`, 'Type "help" for available commands');
        break;
    }
  };

  // Handle input key events
  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      // Check if we're in polyline/polygon mode and have a numeric input
      if ((activeTool === Tool.POLYLINE || activeTool === Tool.POLYGON) && commandInput.trim()) {
        const numericValue = parseFloat(commandInput.trim());
        if (!isNaN(numericValue)) {
          // Convert from display unit to base unit (mm)
          const distanceInMm = convertToBaseUnit(numericValue);
          
          // Call the global measurement handler if it exists
          if ((window as any).handlePolylineMeasurement) {
            (window as any).handlePolylineMeasurement(distanceInMm);
            addEntry('success', `${activeTool} segment: ${numericValue} ${measurementUnit}`, 
              `Distance set to ${distanceInMm.toFixed(1)}mm`);
            setCommandInput('');
            return; // Don't execute as regular command
          } else {
            addEntry('warning', `No active ${activeTool.toLowerCase()} drawing`, `Start drawing a ${activeTool.toLowerCase()} first`);
            setCommandInput('');
            return;
          }
        }
      }
      
      // Execute regular command only if it's not a polyline/polygon measurement
      executeCommand(commandInput);
      setCommandInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCommandInput(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCommandInput('');
        } else {
          setHistoryIndex(newIndex);
          setCommandInput(commandHistory[newIndex]);
        }
      }
    }
  };

  // Monitor tool changes
  useEffect(() => {
    addEntry('info', `Tool changed to: ${activeTool}`, `Active tool is now ${activeTool}`);
  }, [activeTool]);

  // 🎯 NEW: Monitor view mode changes
  useEffect(() => {
    addEntry('info', `View mode changed to: ${viewMode}`, 
      `Objects are now displayed in ${viewMode} mode`);
  }, [viewMode]);

  // Monitor shape selection
  useEffect(() => {
    if (selectedShapeId) {
      const shape = shapes.find(s => s.id === selectedShapeId);
      addEntry('success', `Shape selected: ${shape?.type || 'Unknown'}`, 
        `ID: ${selectedShapeId}, Position: [${shape?.position.map(p => p.toFixed(1)).join(', ')}]`);
    } else {
      addEntry('info', 'Shape deselected', 'No shape is currently selected');
    }
  }, [selectedShapeId, shapes]);

  // Monitor shape additions/modifications
  useEffect(() => {
    const shapeCount = shapes.length;
    addEntry('output', `Scene updated: ${shapeCount} shapes`, 
      `Total objects in scene: ${shapeCount}`);
  }, [shapes.length]);

  // Monitor camera type changes
  useEffect(() => {
    addEntry('info', `Camera changed to: ${cameraType}`, 
      `Camera projection is now ${cameraType === CameraType.PERSPECTIVE ? 'Perspective' : 'Orthographic'}`);
  }, [cameraType]);

  // Monitor measurement unit changes
  useEffect(() => {
    addEntry('info', `Measurement unit changed to: ${measurementUnit}`, 
      `All measurements will be displayed in ${measurementUnit}`);
  }, [measurementUnit]);

  // Monitor camera position changes
  useEffect(() => {
    const [x, y, z] = cameraPosition.map(pos => convertToDisplayUnit(pos));
    addEntry('info', `Camera moved to: [${x.toFixed(1)}, ${y.toFixed(1)}, ${z.toFixed(1)}] ${measurementUnit}`, 
      `Camera position updated in ${cameraType} mode`);
  }, [cameraPosition, convertToDisplayUnit, measurementUnit, cameraType]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [entries]);

  // Add initial welcome message
  useEffect(() => {
    addEntry('success', 'YagoDesign initialized', 'Ready for CAD operations');
    addEntry('info',   'System status: Online', 'All systems operational');
    addEntry('info', 'Type "help" for commands', 'Terminal ready for input');
    addEntry('info', 'Camera shortcuts: T(op), F(ront), R(ight), I(so), C(amera toggle)', 'Use keyboard shortcuts for quick camera control');
    addEntry('info', 'View modes: 1(Solid), 2(Wireframe), V(toggle)', '🎯 NEW: View mode shortcuts added'); // 🎯 NEW
    addEntry('info', 'Drawing measurement: Type distance in terminal while drawing', 'Move mouse to set direction, then type distance');
  }, []);

  const getEntryColor = (type: TerminalEntry['type']) => {
    switch (type) {
      case 'success': return 'text-green-400';
      case 'error': return 'text-red-400';
      case 'warning': return 'text-yellow-400';
      case 'input': return 'text-blue-400';
      case 'output': return 'text-purple-400';
      case 'command': return 'text-cyan-400';
      default: return 'text-gray-300';
    }
  };

  const getEntryPrefix = (type: TerminalEntry['type']) => {
    switch (type) {
      case 'success': return '[OK]';
      case 'error': return '[ERR]';
      case 'warning': return '[WARN]';
      case 'input': return '[IN]';
      case 'output': return '[OUT]';
      case 'command': return '[CMD]';
      default: return '[INFO]';
    }
  };

  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('tr-TR', { 
      hour: '2-digit', 
      minute: '2-digit', 
      second: '2-digit' 
    });
  };

  const formatCameraPosition = () => {
    const [x, y, z] = cameraPosition.map(pos => convertToDisplayUnit(pos));
    return `${x.toFixed(0)},${y.toFixed(0)},${z.toFixed(0)}`;
  };

  // 🎯 NEW: Get view mode indicator
  const getViewModeIndicator = () => {
    switch (viewMode) {
      case ViewMode.WIREFRAME:
        return { icon: '🔗', label: 'Wire', color: 'text-purple-400' };
      case ViewMode.SOLID:
        return { icon: '🧊', label: 'Solid', color: 'text-green-400' };
      default:
        return { icon: '🧊', label: 'Solid', color: 'text-green-400' };
    }
  };

  const viewModeInfo = getViewModeIndicator();

  return (
    <div className="fixed bottom-0 left-0 right-0 z-30 bg-gray-900/95 backdrop-blur-sm border-t border-gray-700">
      {/* Status Bar Header */}
      <div className="flex items-center justify-between px-2 py-1 bg-gradient-to-r from-gray-800 to-gray-750 border-b border-gray-600">
        {/* Left side - System status indicators */}
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1.5">
            <div className="flex items-center justify-center w-2.5 h-2.5 bg-gradient-to-br from-green-500 to-green-600 rounded-full">
              <div className="w-1 h-1 bg-white rounded-full"></div>
            </div>
            <span className="text-xs text-gray-300 font-medium">Online</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Activity size={10} className="text-blue-400" />
            <span className="text-xs text-gray-300 font-medium">{activeTool}</span>
          </div>
          
          <div className="flex items-center gap-1.5">
            <Cpu size={10} className="text-purple-400" />
            <span className="text-xs text-gray-300 font-medium">{shapes.length}</span>
          </div>
          
          {selectedShapeId && (
            <div className="flex items-center gap-1.5">
              <HardDrive size={10} className="text-yellow-400" />
              <span className="text-xs text-gray-300 font-medium">{shapes.find(s => s.id === selectedShapeId)?.type}</span>
            </div>
          )}

          {/* Camera Type Indicator */}
          <div className="flex items-center gap-1.5">
            <Camera size={10} className="text-cyan-400" />
            <span className="text-xs text-gray-300 font-medium">
              {cameraType === CameraType.PERSPECTIVE ? 'Persp' : 'Ortho'}
            </span>
          </div>

          {/* 🎯 NEW: View Mode Indicator */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs">{viewModeInfo.icon}</span>
            <span className={`text-xs font-medium ${viewModeInfo.color}`}>
              {viewModeInfo.label}
            </span>
          </div>

          {/* Camera Position Indicator */}
          <div className="flex items-center gap-1.5">
            <MapPin size={10} className="text-indigo-400" />
            <span className="text-xs text-gray-300 font-mono font-medium">
              [{formatCameraPosition()}]
            </span>
          </div>

          {/* Measurement Unit Indicator */}
          <div className="flex items-center gap-1.5">
            <Ruler size={10} className="text-orange-400" />
            <span className="text-xs text-gray-300 font-medium">{measurementUnit}</span>
          </div>
        </div>
        
        {/* Right side - Collapse button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="p-1 hover:bg-gray-700/50 rounded transition-colors"
          title={isExpanded ? "Collapse" : "Expand"}
        >
          {isExpanded ? <ChevronDown size={12} className="text-gray-300" /> : <ChevronUp size={12} className="text-gray-300" />}
        </button>
      </div>

      {/* Terminal Content - Expanded */}
      {isExpanded && (
        <div className="bg-gray-900/90">
          {/* Terminal Output */}
          <div 
            ref={terminalRef}
            className="h-32 overflow-y-auto p-2 font-mono text-xs"
            style={{ scrollbarWidth: 'thin' }}
          >
            {entries.length === 0 ? (
              <div className="text-gray-500 italic">System ready...</div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="mb-1 group">
                  <div className="flex items-start gap-2">
                    <span className="text-gray-500 text-[10px] min-w-[45px]">
                      {formatTime(entry.timestamp)}
                    </span>
                    <span className={`${getEntryColor(entry.type)} font-semibold min-w-[40px] text-[10px]`}>
                      {getEntryPrefix(entry.type)}
                    </span>
                    <span className="text-gray-200 flex-1 text-xs">
                      {entry.message}
                    </span>
                  </div>
                  {entry.details && (
                    <div className="ml-[87px] text-gray-400 text-[10px] mt-0.5 whitespace-pre-line">
                      {entry.details}
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Command Input - Always Visible */}
      <div className="flex items-center gap-2 px-2 py-1.5 bg-gray-800/50 border-t border-gray-700/50">
        <span className="text-cyan-400 font-mono text-xs font-semibold">$</span>
        <input
          ref={inputRef}
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={handleInputKeyDown}
          placeholder={
            (activeTool === Tool.POLYLINE || activeTool === Tool.POLYGON) 
              ? "Enter distance or command..." 
              : "Enter command..."
          }
          className="flex-1 bg-transparent text-gray-200 text-xs font-mono outline-none placeholder-gray-500"
        />
        <button
          onClick={() => {
            if ((activeTool === Tool.POLYLINE || activeTool === Tool.POLYGON) && commandInput.trim()) {
              const numericValue = parseFloat(commandInput.trim());
              if (!isNaN(numericValue)) {
                const distanceInMm = convertToBaseUnit(numericValue);
                if ((window as any).handlePolylineMeasurement) {
                  (window as any).handlePolylineMeasurement(distanceInMm);
                  addEntry('success', `${activeTool} segment: ${numericValue} ${measurementUnit}`, 
                    `Distance set to ${distanceInMm.toFixed(1)}mm`);
                  setCommandInput('');
                  return;
                }
              }
            }
            executeCommand(commandInput);
            setCommandInput('');
          }}
          className="p-1 hover:bg-gray-700/50 rounded transition-colors"
          title="Execute command"
        >
          <Send size={10} className="text-gray-400" />
        </button>
      </div>
    </div>
  );
};

export default Terminal;