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
    viewMode,
    setViewMode,
    cycleViewMode
  } = useAppStore();

  // Expose terminal input ref globally for external focus control
  useEffect(() => {
    (window as any).terminalInputRef = inputRef;
    return () => {
      delete (window as any).terminalInputRef;
    };
  }, []);

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

    // Handle commands
    const [cmd, ...args] = trimmedCommand.toLowerCase().split(' ');
    
    switch (cmd) {
      case 'help':
        addEntry('info', 'Available commands:', 'System help');
        addEntry('output', '• help - Show this help message');
        addEntry('output', '• clear - Clear terminal');
        addEntry('output', '• status - Show system status');
        addEntry('output', '• camera [perspective|orthographic] - Set camera type');
        addEntry('output', '• unit [mm|cm|m|in|ft] - Set measurement unit');
        addEntry('output', '• view [wireframe|solid|transparent] - Set view mode');
        addEntry('output', '• tool [select|measure|camera] - Set active tool');
        break;

      case 'clear':
        setEntries([]);
        addEntry('info', 'Terminal cleared', 'User action');
        break;

      case 'status':
        addEntry('info', 'System Status:', 'System information');
        addEntry('output', `Active Tool: ${activeTool}`);
        addEntry('output', `Camera Type: ${cameraType}`);
        addEntry('output', `Measurement Unit: ${measurementUnit}`);
        addEntry('output', `View Mode: ${viewMode}`);
        addEntry('output', `Selected Shape: ${selectedShapeId || 'None'}`);
        addEntry('output', `Total Shapes: ${shapes.length}`);
        if (cameraPosition) {
          addEntry('output', `Camera Position: (${cameraPosition.x.toFixed(2)}, ${cameraPosition.y.toFixed(2)}, ${cameraPosition.z.toFixed(2)})`);
        }
        break;

      case 'camera':
        if (args[0]) {
          const newCameraType = args[0] as CameraType;
          if (['perspective', 'orthographic'].includes(newCameraType)) {
            useAppStore.getState().setCameraType(newCameraType);
            addEntry('success', `Camera type set to: ${newCameraType}`, 'Camera configuration');
          } else {
            addEntry('error', 'Invalid camera type. Use: perspective or orthographic', 'Invalid parameter');
          }
        } else {
          addEntry('info', `Current camera type: ${cameraType}`, 'Camera status');
        }
        break;

      case 'unit':
        if (args[0]) {
          const newUnit = args[0];
          if (['mm', 'cm', 'm', 'in', 'ft'].includes(newUnit)) {
            useAppStore.getState().setMeasurementUnit(newUnit as any);
            addEntry('success', `Measurement unit set to: ${newUnit}`, 'Unit configuration');
          } else {
            addEntry('error', 'Invalid unit. Use: mm, cm, m, in, ft', 'Invalid parameter');
          }
        } else {
          addEntry('info', `Current measurement unit: ${measurementUnit}`, 'Unit status');
        }
        break;

      case 'view':
        if (args[0]) {
          const newViewMode = args[0] as ViewMode;
          if (['wireframe', 'solid', 'transparent'].includes(newViewMode)) {
            setViewMode(newViewMode);
            addEntry('success', `View mode set to: ${newViewMode}`, 'View configuration');
          } else {
            addEntry('error', 'Invalid view mode. Use: wireframe, solid, transparent', 'Invalid parameter');
          }
        } else {
          addEntry('info', `Current view mode: ${viewMode}`, 'View status');
        }
        break;

      case 'tool':
        if (args[0]) {
          const newTool = args[0] as Tool;
          if (['select', 'measure', 'camera'].includes(newTool)) {
            useAppStore.getState().setActiveTool(newTool);
            addEntry('success', `Active tool set to: ${newTool}`, 'Tool configuration');
          } else {
            addEntry('error', 'Invalid tool. Use: select, measure, camera', 'Invalid parameter');
          }
        } else {
          addEntry('info', `Current active tool: ${activeTool}`, 'Tool status');
        }
        break;

      default:
        addEntry('error', `Unknown command: ${cmd}`, 'Use "help" to see available commands');
        break;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
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

  // Auto-scroll to bottom when new entries are added
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [entries]);

  // Focus input when terminal is expanded
  useEffect(() => {
    if (isExpanded && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isExpanded]);

  const getEntryIcon = (type: TerminalEntry['type']) => {
    switch (type) {
      case 'info': return <Activity className="w-3 h-3 text-blue-400" />;
      case 'success': return <Activity className="w-3 h-3 text-green-400" />;
      case 'warning': return <Activity className="w-3 h-3 text-yellow-400" />;
      case 'error': return <Activity className="w-3 h-3 text-red-400" />;
      case 'command': return <Send className="w-3 h-3 text-purple-400" />;
      default: return <Activity className="w-3 h-3 text-gray-400" />;
    }
  };

  const getEntryColor = (type: TerminalEntry['type']) => {
    switch (type) {
      case 'info': return 'text-blue-300';
      case 'success': return 'text-green-300';
      case 'warning': return 'text-yellow-300';
      case 'error': return 'text-red-300';
      case 'command': return 'text-purple-300';
      case 'output': return 'text-gray-300';
      default: return 'text-gray-400';
    }
  };

  return (
    <div className={`fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 transition-all duration-300 z-50 ${
      isExpanded ? 'h-80' : 'h-10'
    }`}>
      {/* Header */}
      <div 
        className="flex items-center justify-between px-4 py-2 bg-gray-800 cursor-pointer hover:bg-gray-750 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-2">
          <TerminalIcon className="w-4 h-4 text-green-400" />
          <span className="text-sm font-medium text-gray-300">Terminal</span>
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <Cpu className="w-3 h-3" />
            <span>Ready</span>
          </div>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <Camera className="w-3 h-3" />
            <span>{cameraType}</span>
          </div>
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <Ruler className="w-3 h-3" />
            <span>{measurementUnit}</span>
          </div>
          <div className="flex items-center space-x-1 text-xs text-gray-500">
            <MapPin className="w-3 h-3" />
            <span>{activeTool}</span>
          </div>
          {isExpanded ? (
            <ChevronDown className="w-4 h-4 text-gray-400" />
          ) : (
            <ChevronUp className="w-4 h-4 text-gray-400" />
          )}
        </div>
      </div>

      {/* Terminal Content */}
      {isExpanded && (
        <div className="flex flex-col h-72">
          {/* Output Area */}
          <div 
            ref={terminalRef}
            className="flex-1 overflow-y-auto p-4 font-mono text-sm bg-gray-900"
          >
            {entries.length === 0 ? (
              <div className="text-gray-500 italic">
                Terminal ready. Type 'help' for available commands.
              </div>
            ) : (
              entries.map((entry) => (
                <div key={entry.id} className="mb-1 flex items-start space-x-2">
                  <div className="flex-shrink-0 mt-0.5">
                    {getEntryIcon(entry.type)}
                  </div>
                  <div className="flex-1">
                    <span className={`${getEntryColor(entry.type)} break-words`}>
                      {entry.message}
                    </span>
                    {entry.details && (
                      <div className="text-xs text-gray-500 mt-1">
                        {entry.details}
                      </div>
                    )}
                  </div>
                  <div className="flex-shrink-0 text-xs text-gray-600">
                    {entry.timestamp.toLocaleTimeString()}
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Input Area */}
          <div className="border-t border-gray-700 p-4 bg-gray-800">
            <div className="flex items-center space-x-2">
              <span className="text-green-400 font-mono text-sm">$</span>
              <input
                ref={inputRef}
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Enter command..."
                className="flex-1 bg-transparent text-gray-300 font-mono text-sm outline-none placeholder-gray-500"
              />
              <button
                onClick={() => executeCommand(commandInput)}
                className="px-3 py-1 bg-blue-600 hover:bg-blue-700 text-white text-xs rounded transition-colors"
              >
                <Send className="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Terminal;