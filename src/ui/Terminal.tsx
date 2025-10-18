import React, { useState, useRef, KeyboardEvent } from 'react';
import { Terminal as TerminalIcon } from 'lucide-react';

const Terminal: React.FC = () => {
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [currentCommand, setCurrentCommand] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  const handleCommandSubmit = () => {
    if (currentCommand.trim()) {
      setCommandHistory([...commandHistory, currentCommand]);
      setCurrentCommand('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleCommandSubmit();
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-stone-900 border-t border-stone-700 z-50 h-12">
      <div className="flex items-center h-full px-4 gap-3">
        <TerminalIcon size={16} className="text-stone-400 flex-shrink-0" />
        <div className="flex-1 flex items-center gap-2 font-mono text-sm">
          <span className="text-green-400">$</span>
          <input
            ref={inputRef}
            type="text"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command..."
            className="flex-1 bg-transparent text-stone-300 outline-none placeholder-stone-600"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
};

export default Terminal;
