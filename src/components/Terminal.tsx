import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { useAppStore, Tool } from '../store/appStore';

const Terminal: React.FC = () => {
  const [commandInput, setCommandInput] = useState('');
  const { activeTool, isRulerMode } = useAppStore();
  const inputRef = useRef<HTMLInputElement>(null);
  const [polylineStatus, setPolylineStatus] = useState<{
    distance: number;
    angle?: number;
    unit: string;
  } | null>(null);
  const [selectedEdgeInfo, setSelectedEdgeInfo] = useState<{
    shapeId: string;
    edgeIndex: number;
    currentLength: number;
    edgeId: string;
  } | null>(null);

  // Expose terminal input ref globally for external focus control
  useEffect(() => {
    (window as any).terminalInputRef = inputRef;
    
    // Expose polyline status setter globally
    (window as any).setPolylineStatus = setPolylineStatus;

    // Listen for edge selection events
    const handleEdgeSelected = (e: CustomEvent) => {
      setSelectedEdgeInfo(e.detail);
      console.log(`Terminal: Edge selected - ${e.detail.currentLength.toFixed(2)} mm`);
    };

    window.addEventListener('edgeSelected', handleEdgeSelected as EventListener);
    
    // 🎯 GLOBAL KEYBOARD CAPTURE - Tüm klavye girişlerini terminale yönlendir
    const handleGlobalKeyDown = (e: KeyboardEvent) => {
      // Eğer zaten bir input alanında yazıyorsa, yakalama
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) {
        return;
      }
      
      // Çizim araçları ve kamera kısayollarını hariç tut
      const drawingToolKeys = ['t', 'f', 'r', 'l', 'b', 'u', 'i', 'c', 'h', 'v', 'z', '1', '2', '3'];
      if (drawingToolKeys.includes(e.key.toLowerCase())) {
        return; // Bu tuşları terminale yönlendirme
      }
      
      // Özel tuşları ve mouse event'lerini hariç tut (Ctrl, Alt, F1-F12, Arrow keys, etc.)
      if (e.ctrlKey || e.altKey || e.metaKey || 
          e.key.startsWith('F') || 
          ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab', 'Escape', 'Shift', 'CapsLock', 'Insert', 'Delete', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
        return;
      }
      
      // Mouse button'larını ve diğer özel karakterleri hariç tut
      if (e.key.length > 1 && !['Backspace', 'Enter', 'Space'].includes(e.key)) {
        return;
      }
      
      // Sadece gerçek klavye karakterlerini yakala (sayılar, harfler, nokta, virgül, +, -, *, /, parantez, boşluk)
      if (/^[a-zA-Z0-9\.\,\+\-\*\/\(\)]$/.test(e.key) || e.key === 'Backspace' || e.key === 'Space') {
        e.preventDefault();
        
        // Terminal input'a odaklan
        if (inputRef.current) {
          inputRef.current.focus();
          
          // Backspace ise son karakteri sil
          if (e.key === 'Backspace') {
            setCommandInput(prev => prev.slice(0, -1));
          } else if (e.key === 'Space') {
            // Space tuşu için boşluk ekle
            setCommandInput(prev => prev + ' ');
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
      window.removeEventListener('edgeSelected', handleEdgeSelected as EventListener);
      delete (window as any).terminalInputRef;
      delete (window as any).setPolylineStatus;
    };
  }, []);

  // Handle command execution - simplified for input handling
  const executeCommand = (command: string) => {
    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    // Handle edge measurement update
    if (selectedEdgeInfo) {
      const newValue = parseFloat(trimmedCommand);
      if (!isNaN(newValue) && newValue > 0) {
        // Dispatch event to update edge measurement
        const event = new CustomEvent('updateEdgeMeasurement', {
          detail: {
            shapeId: selectedEdgeInfo.shapeId,
            edgeIndex: selectedEdgeInfo.edgeIndex,
            newValue
          }
        });
        window.dispatchEvent(event);
        console.log(`Terminal: Updating edge to ${newValue} mm`);
        setSelectedEdgeInfo(null);
        setCommandInput('');
        return;
      }
    }

    // Handle pending extrude shape - öncelik ver
    if ((window as any).pendingExtrudeShape) {
      // Enter tuşu ile 2D nesne olarak ekle
      if (trimmedCommand === '' || trimmedCommand.toLowerCase() === 'enter') {
        if ((window as any).handleConvertTo2D) {
          (window as any).handleConvertTo2D();
          setCommandInput('');
          return;
        }
      }
      
      // Sayı girildiyse extrude et
      const extrudeValue = parseFloat(trimmedCommand);
      if (!isNaN(extrudeValue) && extrudeValue > 0) {
        if ((window as any).handleExtrudeHeight) {
          (window as any).handleExtrudeHeight(extrudeValue);
          setCommandInput('');
          return;
        }
      }
      
      console.log('Geçersiz extrude değeri. Pozitif bir sayı girin veya Enter ile 2D nesne olarak ekleyin.');
      return;
    }

    // Check if it's a measurement input (number, "number,number", or "number," format)
    if (/^[\d.,\s]+$/.test(trimmedCommand)) {
      // Handle measurement input
      if ((window as any).handlePolylineMeasurement) {
        (window as any).handlePolylineMeasurement(trimmedCommand);
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
    <>
      {/* InfoBar - Information display for polyline, ruler mode, etc. */}
      {polylineStatus && (
        <div className="fixed bottom-10 left-0 right-0 bg-stone-100/95 backdrop-blur-sm border-t border-b border-stone-300 z-50" style={{ height: '24px' }}>
          <div className="flex items-center justify-between h-full px-3">
            {/* Sol taraf - Tool bilgisi */}
            <div className="flex items-center gap-4 text-xs text-stone-600">
              <span className="font-medium">
                Tool: <span className="text-slate-800">{activeTool}</span>
              </span>
            </div>

            {/* Orta - Polyline ölçü bilgileri, Edge bilgisi veya Ruler mode mesajı */}
            <div className="flex items-center gap-4 text-xs">
              {isRulerMode && !selectedEdgeInfo ? (
                <span className="text-orange-600 font-medium animate-pulse">
                  📏 Ruler Mode Active - Hover over edges to measure, click to modify
                </span>
              ) : selectedEdgeInfo ? (
                <span className="text-blue-600 font-medium">
                  Edge Selected: <span className="text-blue-800 font-mono">{selectedEdgeInfo.currentLength.toFixed(2)} mm</span> - Enter new value in Terminal ↓
                </span>
              ) : (
                <>
                  <span className="text-gray-300">
                    Length: <span className="text-orange-600 font-mono font-medium">{polylineStatus.distance.toFixed(1)}{polylineStatus.unit}</span>
                  </span>
                  {polylineStatus.angle !== undefined && (
                    <span className="text-stone-600">
                      Angle: <span className="text-slate-700 font-mono font-medium">{polylineStatus.angle.toFixed(1)}°</span>
                    </span>
                  )}
                </>
              )}
            </div>

            {/* Sağ taraf - Durum bilgileri */}
            <div className="flex items-center gap-4 text-xs text-stone-600">
              <span>Ready</span>
            </div>
          </div>
        </div>
      )}

      {/* Terminal */}
      <div className="fixed bottom-0 left-0 right-0 bg-stone-100 border-t border-stone-300 z-50 h-8">
      <div className="flex items-center h-full px-3">
        <input
          ref={inputRef}
          type="text"
          value={commandInput}
          onChange={(e) => setCommandInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Enter commands or value..."
          className="flex-1 bg-transparent text-slate-800 text-xs font-medium outline-none placeholder-stone-500"
        />
        <button
          onClick={() => executeCommand(commandInput)}
          className="ml-3 p-1.5 bg-orange-500 hover:bg-orange-600 text-white rounded transition-colors"
        >
          <Send className="w-2.5 h-2.5" />
        </button>
      </div>
      </div>
    </>
  );
};

export default Terminal;