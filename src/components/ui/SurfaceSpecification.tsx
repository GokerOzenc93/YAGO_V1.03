import React, { useState, useEffect } from 'react';
import { ChevronLeft, MousePointer, Target, X, Plus, Calculator } from 'lucide-react';

interface SurfaceRow {
  id: string;
  faceIndex: number | null;
  role: string;
  formula: string;
  isActive: boolean;
  confirmed: boolean;
}

interface SurfaceSpecificationProps {
  onBack: () => void;
}

const SurfaceSpecification: React.FC<SurfaceSpecificationProps> = ({
  onBack
}) => {
  const [surfaceRows, setSurfaceRows] = useState<SurfaceRow[]>([]);
  const [isSelectionActive, setIsSelectionActive] = useState(false);
  const [activeRowId, setActiveRowId] = useState<string | null>(null);

  // Listen for face selection events from 3D scene
  useEffect(() => {
    const handleFaceSelected = (event: CustomEvent) => {
      const { faceIndex, shapeId } = event.detail;
      
      if (activeRowId) {
        // Update the active row with selected face
        setSurfaceRows(prev => prev.map(row => 
          row.id === activeRowId 
            ? { ...row, faceIndex, confirmed: true, isActive: false }
            : row
        ));
        
        // Create highlight for the selected face
        const highlightEvent = new CustomEvent('createSurfaceHighlight', {
          detail: {
            shapeId,
            faceIndex,
            rowId: activeRowId,
            color: 0xffb366, // Default orange
            confirmed: true
          }
        });
        window.dispatchEvent(highlightEvent);
        
        setIsSelectionActive(false);
        setActiveRowId(null);
        
        console.log(`🎯 Face ${faceIndex} assigned to row ${activeRowId}`);
      }
    };

    window.addEventListener('faceSelected', handleFaceSelected as EventListener);
    
    return () => {
      window.removeEventListener('faceSelected', handleFaceSelected as EventListener);
    };
  }, [activeRowId]);

  const handleSelectSurface = () => {
    // Create new row
    const newRowId = `row_${Date.now()}`;
    const newRow: SurfaceRow = {
      id: newRowId,
      faceIndex: null,
      role: '',
      formula: '',
      isActive: true,
      confirmed: false
    };
    
    setSurfaceRows(prev => [...prev, newRow]);
    setActiveRowId(newRowId);
    setIsSelectionActive(true);
    
    // Activate face selection mode in 3D scene
    const activateEvent = new CustomEvent('activateFaceSelection', {
      detail: { rowId: newRowId }
    });
    window.dispatchEvent(activateEvent);
    
    console.log(`🎯 Surface selection activated for row ${newRowId}`);
  };

  const handleRoleChange = (rowId: string, role: string) => {
    setSurfaceRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, role } : row
    ));
    
    const row = surfaceRows.find(r => r.id === rowId);
    if (row && row.faceIndex !== null) {
      // Update highlight color based on role
      const roleColors = {
        'left': 0x87ceeb,    // Light blue (açık mavi)
        'right': 0x87ceeb,   // Light blue (açık mavi)
        'top': 0x90ee90,     // Light green (açık yeşil)
        'bottom': 0x90ee90,  // Light green (açık yeşil)
        'front': 0xffff99,   // Light yellow (sarı)
        'back': 0xffff99,    // Light yellow (sarı)
        'door': 0xf38ba8,    // Rose
        '': 0xffb366         // Default orange
      };
      
      const color = roleColors[role as keyof typeof roleColors] || roleColors[''];
      const rowIndex = surfaceRows.findIndex(r => r.id === rowId);
      
      const updateEvent = new CustomEvent('updateSurfaceHighlight', {
        detail: {
          rowId,
          faceIndex: row.faceIndex,
          role,
          color,
          faceNumber: rowIndex + 1
        }
      });
      window.dispatchEvent(updateEvent);
      
      console.log(`🎯 Role updated for row ${rowId}: ${role}`);
    }
  };
  const handleFormulaChange = (rowId: string, formula: string) => {
    setSurfaceRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, formula } : row
    ));
    
    console.log(`🎯 Formula updated for row ${rowId}: ${formula}`);
  };

  const handleRemoveRow = (rowId: string) => {
    // Remove highlight from 3D scene
    const removeEvent = new CustomEvent('removeSurfaceHighlight', {
      detail: { rowId }
    });
    window.dispatchEvent(removeEvent);
    
    // Remove row from list
    setSurfaceRows(prev => prev.filter(row => row.id !== rowId));
    
    console.log(`🎯 Row ${rowId} removed`);
  };

  const handleClearAll = () => {
    // Clear all highlights from 3D scene
    const clearEvent = new CustomEvent('clearAllSurfaceHighlights');
    window.dispatchEvent(clearEvent);
    
    // Clear all rows
    setSurfaceRows([]);
    setIsSelectionActive(false);
    setActiveRowId(null);
    
    console.log('🎯 All surface selections cleared');
  };

  return (
    <div className="flex-1 flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between p-3 bg-orange-50 border-b border-orange-200">
        <div className="flex items-center gap-2">
          <button
            onClick={onBack}
            className="p-1 hover:bg-orange-200 rounded transition-colors"
          >
            <ChevronLeft size={16} className="text-orange-600" />
          </button>
          <MousePointer size={16} className="text-orange-600" />
          <span className="font-semibold text-orange-800">Surface Specification</span>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 p-4 space-y-4">
        
        {/* Select Surface Button */}
        <div className="bg-white rounded-lg border border-stone-200 p-4">
          <button
            onClick={handleSelectSurface}
            disabled={isSelectionActive}
            className={`w-full p-2 rounded-md border-2 border-dashed transition-all text-sm ${
              isSelectionActive 
                ? 'border-orange-300 bg-orange-50 text-orange-600 cursor-not-allowed'
                : 'border-gray-300 hover:border-orange-400 hover:bg-orange-50 text-gray-700 hover:text-orange-700'
            }`}
          >
            <div className="flex items-center justify-center gap-1">
              <Target size={14} />
              <span className="font-medium">
                {isSelectionActive ? 'Click on 3D surface to select...' : 'Select Surface'}
              </span>
            </div>
          </button>
          
          {isSelectionActive && (
            <div className="mt-1.5 text-center text-xs text-orange-600">
              Click on any surface in the 3D view to select it
            </div>
          )}
        </div>

        {/* Surface Rows */}
        {surfaceRows.length > 0 && (
          <div className="bg-white rounded-lg border border-stone-200 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="font-medium text-slate-800 text-sm">Selected Surfaces</h4>
              <button
                onClick={handleClearAll}
                className="text-xs text-red-600 hover:text-red-800 px-2 py-0.5 rounded hover:bg-red-50 transition-colors"
              >
                Clear All
              </button>
            </div>
            
            <div className="space-y-2">
              {surfaceRows.map((row, index) => (
                <div 
                  key={row.id} 
                  className={`flex flex-col gap-2 p-3 rounded-lg border transition-all duration-200 ${
                    row.isActive 
                      ? 'border-orange-300 bg-orange-50/50 shadow-sm' 
                      : row.confirmed 
                        ? 'border-green-300 bg-green-50/50 shadow-sm'
                        : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  {/* First Row: Number, Status, Remove */}
                  <div className="flex items-center gap-2">
                    {/* Surface Number - Turuncu-beyaz tema */}
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white text-xs font-bold flex items-center justify-center shadow-sm border border-orange-300">
                      {index + 1}
                    </div>
                    
                    {/* Status Info */}
                    <div className="flex-1 text-xs">
                      {row.faceIndex !== null ? (
                        <span className="text-green-600 font-medium px-2 py-0.5 bg-green-100 rounded-full">Selected</span>
                      ) : (
                        <span className="text-orange-600 px-2 py-0.5 bg-orange-100 rounded-full animate-pulse">Selecting...</span>
                      )}
                    </div>
                    
                    {/* Remove Button */}
                    <button
                      onClick={() => handleRemoveRow(row.id)}
                      className="flex-shrink-0 p-1 text-red-500 hover:text-red-700 hover:bg-red-100 rounded transition-colors"
                      title="Remove Surface"
                    >
                      <X size={12} />
                    </button>
                  </div>
                  
                  {/* Second Row: Role Selection */}
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-gray-500 w-8">Role:</span>
                    <select
                      value={row.role}
                      onChange={(e) => handleRoleChange(row.id, e.target.value)}
                      disabled={!row.confirmed}
                      className="w-16 text-xs bg-white border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400"
                    >
                      <option value="">Role</option>
                      <option value="left">L - Left</option>
                      <option value="right">R - Right</option>
                      <option value="top">T - Top</option>
                      <option value="bottom">B - Bottom</option>
                      <option value="front">F - Front</option>
                      <option value="back">BA - Back</option>
                      <option value="door">D - Door</option>
                    </select>
                    
                    {/* Show role abbreviation after selection */}
                    {row.role && (
                      <span className="text-xs font-medium text-slate-700 bg-gray-100 px-2 py-0.5 rounded">
                        {row.role === 'left' ? 'L' : 
                         row.role === 'right' ? 'R' : 
                         row.role === 'top' ? 'T' : 
                         row.role === 'bottom' ? 'B' : 
                         row.role === 'front' ? 'F' : 
                         row.role === 'back' ? 'BA' : 
                         row.role === 'door' ? 'D' : ''}
                      </span>
                    )}
                    
                    <span className="text-xs text-slate-700 font-medium">
                      Formula:
                    </span>
                    <input
                      type="text"
                      value={row.formula}
                      onChange={(e) => handleFormulaChange(row.id, e.target.value)}
                      disabled={!row.confirmed}
                      placeholder="Formula..."
                      className="flex-1 text-xs bg-white border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
        
        {/* Empty State */}
        {surfaceRows.length === 0 && (
          <div className="text-center py-6 text-slate-500">
            <Target size={32} className="mx-auto mb-2 opacity-50" />
            <p className="text-sm font-medium mb-1">No surfaces selected</p>
            <p className="text-sm">Click "Select Surface" to start selecting surfaces</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default SurfaceSpecification;