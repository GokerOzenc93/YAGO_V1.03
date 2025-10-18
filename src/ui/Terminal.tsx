import React, { useState } from 'react';
import { Terminal as TerminalIcon, X, Minus } from 'lucide-react';

const Terminal: React.FC = () => {
  const [isVisible, setIsVisible] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);

  if (!isVisible) {
    return (
      <button
        onClick={() => setIsVisible(true)}
        className="fixed bottom-4 right-4 p-3 bg-stone-800 text-white rounded-lg shadow-lg hover:bg-stone-700 transition-colors z-50"
      >
        <TerminalIcon size={20} />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-0 left-0 right-0 bg-stone-900 border-t border-stone-700 z-50 ${
        isMinimized ? 'h-10' : 'h-64'
      } transition-all`}
    >
      <div className="flex items-center justify-between h-10 px-4 bg-stone-800 border-b border-stone-700">
        <div className="flex items-center gap-2">
          <TerminalIcon size={14} className="text-stone-400" />
          <span className="text-xs font-medium text-stone-300">Console</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="p-1 hover:bg-stone-700 rounded"
          >
            <Minus size={14} className="text-stone-400" />
          </button>
          <button
            onClick={() => setIsVisible(false)}
            className="p-1 hover:bg-stone-700 rounded"
          >
            <X size={14} className="text-stone-400" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <div className="p-4 font-mono text-xs text-stone-300 overflow-auto h-[calc(100%-2.5rem)]">
          <div className="text-green-400">$ YAGO CAD v1.0.0</div>
          <div className="text-stone-400">Ready for commands...</div>
        </div>
      )}
    </div>
  );
};

export default Terminal;
