import React, { useState } from 'react';
import { Send } from 'lucide-react';

const Terminal: React.FC = () => {
  const [commandInput, setCommandInput] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      console.log('Command:', commandInput);
      setCommandInput('');
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-stone-100 border-t border-stone-300 z-30" style={{ height: '5mm' }}>
      <div className="flex items-center h-full px-2">
        <span className="text-stone-500 font-mono text-xs mr-2">$</span>
        <input
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command or value..."
          className="flex-1 bg-transparent text-slate-800 font-mono text-xs outline-none placeholder-stone-500"
        />
        <button
          onClick={() => {
            console.log('Command:', commandInput);
            setCommandInput('');
          }}
          className="ml-2 p-1 bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
        >
          <Send className="w-2 h-2" />
        </button>
      </div>
    </div>
  );
};

export default Terminal;
