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
    <div className="fixed bottom-0 left-0 right-0 bg-stone-50 border-t border-stone-200 z-50 h-8">
      <div className="flex items-center h-full px-3 gap-2">
        <TerminalIcon size={12} className="text-stone-500 flex-shrink-0" />
        <div className="flex-1 flex items-center gap-1.5 font-mono text-xs">
          <span className="text-blue-600 font-semibold">$</span>
          <input
            ref={inputRef}
            type="text"
            value={currentCommand}
            onChange={(e) => setCurrentCommand(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Enter command..."
            className="flex-1 bg-transparent text-slate-800 outline-none placeholder-stone-400"
            autoFocus
          />
        </div>
      </div>
    </div>
  );
};

export default Terminal;
