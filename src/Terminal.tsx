import React, { useState, useRef, useEffect } from 'react';
import { Terminal as TerminalIcon, X, Minus, Square } from 'lucide-react';

interface TerminalCommand {
  id: string;
  command: string;
  output: string;
  timestamp: Date;
  type: 'success' | 'error' | 'info';
}

export default function Terminal() {
  const [isOpen, setIsOpen] = useState(false);
  const [commands, setCommands] = useState<TerminalCommand[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputRef = useRef<HTMLInputElement>(null);
  const terminalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [commands]);

  const executeCommand = (cmd: string) => {
    const trimmedCmd = cmd.trim();
    if (!trimmedCmd) return;

    // Add to history
    setCommandHistory(prev => [...prev, trimmedCmd]);
    setHistoryIndex(-1);

    // Create command entry
    const commandEntry: TerminalCommand = {
      id: Date.now().toString(),
      command: trimmedCmd,
      output: '',
      timestamp: new Date(),
      type: 'info'
    };

    // Simple command processing
    switch (trimmedCmd.toLowerCase()) {
      case 'help':
        commandEntry.output = `Available commands:
  help     - Show this help message
  clear    - Clear terminal
  version  - Show version info
  status   - Show application status
  shapes   - List current shapes
  grid     - Toggle grid display`;
        commandEntry.type = 'success';
        break;
      
      case 'clear':
        setCommands([]);
        setCurrentCommand('');
        return;
      
      case 'version':
        commandEntry.output = 'CAD Application v1.0.0\nBuilt with React + Three.js + OpenCascade';
        commandEntry.type = 'success';
        break;
      
      case 'status':
        commandEntry.output = 'Application Status: Running\nRenderer: WebGL\nShapes loaded: 0';
        commandEntry.type = 'success';
        break;
      
      case 'shapes':
        commandEntry.output = 'No shapes currently loaded';
        commandEntry.type = 'info';
        break;
      
      case 'grid':
        commandEntry.output = 'Grid display toggled';
        commandEntry.type = 'success';
        break;
      
      default:
        commandEntry.output = `Command not found: ${trimmedCmd}\nType 'help' for available commands`;
        commandEntry.type = 'error';
    }

    setCommands(prev => [...prev, commandEntry]);
    setCurrentCommand('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(currentCommand);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (commandHistory.length > 0) {
        const newIndex = historyIndex === -1 ? commandHistory.length - 1 : Math.max(0, historyIndex - 1);
        setHistoryIndex(newIndex);
        setCurrentCommand(commandHistory[newIndex]);
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex !== -1) {
        const newIndex = historyIndex + 1;
        if (newIndex >= commandHistory.length) {
          setHistoryIndex(-1);
          setCurrentCommand('');
        } else {
          setHistoryIndex(newIndex);
          setCurrentCommand(commandHistory[newIndex]);
        }
      }
    }
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-gray-800 hover:bg-gray-700 text-white p-3 rounded-lg shadow-lg transition-colors z-50"
        title="Open Terminal"
      >
        <TerminalIcon className="w-5 h-5" />
      </button>
    );
  }

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-900 border-t border-gray-700 z-40" style={{ height: '300px' }}>
      {/* Terminal Header */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-700">
        <div className="flex items-center space-x-2">
          <TerminalIcon className="w-4 h-4 text-gray-400" />
          <span className="text-sm text-gray-300">Terminal</span>
        </div>
        <div className="flex items-center space-x-1">
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Minimize"
          >
            <Minus className="w-4 h-4" />
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded hover:bg-gray-700 text-gray-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Terminal Content */}
      <div className="flex flex-col h-full">
        <div
          ref={terminalRef}
          className="flex-1 overflow-y-auto p-4 font-mono text-sm text-gray-300 bg-gray-900"
        >
          {commands.map((cmd) => (
            <div key={cmd.id} className="mb-2">
              <div className="text-green-400">
                <span className="text-blue-400">$</span> {cmd.command}
              </div>
              {cmd.output && (
                <div className={`mt-1 whitespace-pre-wrap ${
                  cmd.type === 'error' ? 'text-red-400' : 
                  cmd.type === 'success' ? 'text-green-400' : 'text-gray-300'
                }`}>
                  {cmd.output}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Command Input */}
        <div className="border-t border-gray-700 p-4 bg-gray-900">
          <div className="flex items-center space-x-2 font-mono text-sm">
            <span className="text-blue-400">$</span>
            <input
              ref={inputRef}
              type="text"
              value={currentCommand}
              onChange={(e) => setCurrentCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 bg-transparent text-gray-300 outline-none"
              placeholder="Type a command..."
            />
          </div>
        </div>
      </div>
    </div>
  );
}