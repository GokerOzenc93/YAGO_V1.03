import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useAppStore, Tool } from '../store/appStore';

const Terminal: React.FC = () => {
  const [commandInput, setCommandInput] = useState('');
  const { activeTool } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);

  // Expose terminal input ref globally for external focus control
  useEffect(() => {
    (window as any).terminalInputRef = inputRef;
    
    // 🎯 GLOBAL KEYBOARD CAPTURE - Tüm klavye girişlerini terminale yönlendir
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Eğer zaten bir input alanında yazıyorsa, yakalama
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Özel tuşları hariç tut (Ctrl, Alt, F1-F12, Arrow keys, etc.)
      if (e.ctrlKey || e.altKey || e.metaKey || 
          e.key.startsWith('F') || 
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Escape'].includes(e.key)) {
        return;
      }
      
      // Sayılar, harfler, nokta, virgül, +, -, *, /, parantez ve boşluk karakterlerini yakala
      if (/^[a-zA-Z0-9\.\,\+\-\*\/\(\)\s]$/.test(e.key) || e.key === 'Backspace') {
        e.preventDefault();
        
        // Terminal input'a odaklan
        if (inputRef.current) {
          inputRef.current.focus();
          
          // Backspace ise son karakteri sil
          if (e.key === 'Backspace') {
            setCommandInput(prev => prev.slice(0, -1));
          } else {
            // Karakteri ekle
            setCommandInput(prev => prev + e.key);
          }
          
          console.log(`🎯 Global key captured: "${e.key}" -> Terminal input`);
        }
      }
    };
    
    // Global event listener ekle
    window.addEventListener('keydown', handleGlobalKeyDown, true); // capture phase
    
    return () => {
      window.removeEventListener('keydown', handleGlobalKeyDown, true);
      delete (window as any).terminalInputRef;
    };
  }, []);

  // Handle command execution - simplified for input handling
  const executeCommand = (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    // Check if it's a measurement input (number)
    const numericValue = parseFloat(trimmedCommand);
    if (!isNaN(numericValue)) {
      // Handle measurement input
      if ((window as any).handlePolylineMeasurement) {
        (window as any).handlePolylineMeasurement(numericValue);
        setCommandInput('');
        return;
      }
      
      // Handle extrude height input
      if ((window as any).handleExtrudeHeight) {
        (window as any).handleExtrudeHeight(numericValue);
        setCommandInput('');
        return;
      }
    }

    console.log(`Command executed: ${trimmedCommand}`);
    setCommandInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      executeCommand(commandInput);
    }
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 z-30" style={{ height: '5mm' }}>
      <div className="flex items-center h-full px-2">
        <span className="text-green-400 font-mono text-xs mr-2">$</span>
        <input
          ref={inputRef}
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter command or value..."
          className="flex-1 bg-transparent text-white font-mono text-xs outline-none placeholder-gray-500"
        />
        <button
          onClick={() => executeCommand(commandInput)}
          className="ml-2 p-1 bg-blue-600 hover:bg-blue-700 text-white rounded transition-colors"
        >
          <Send className="w-2 h-2" />
        </button>
      </div>
    </div>
  );
};

export default Terminal;