import React, { useState, useEffect } from 'react';
import { ChevronLeft, MousePointer, Target, X, Plus, Calculator, Check, CreditCard as Edit3 } from 'lucide-react';

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

  // Listen for face selection events from 3D scene - only when selection is active
  useEffect(() => {
    if (!isSelectionActive) return;
    
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
           opacity: 0.15, // Very transparent
            faceNumber: surfaceRows.length // Use current row count as face number
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
  }, [activeRowId, isSelectionActive, surfaceRows.length]);

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

  const handleAddSurface = () => {
    // Same as handleSelectSurface but with different styling/approach
    handleSelectSurface();
  };

  const handleExitSelection = () => {
    setIsSelectionActive(false);
    setActiveRowId(null);
    
    // Remove the last incomplete row if it exists
    setSurfaceRows(prev => prev.filter(row => row.faceIndex !== null || row.confirmed));
    
    console.log('🎯 Exited surface selection mode');
  };

  const handleRoleChange = (rowId: string, role: string) => {
    setSurfaceRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, role, confirmed: false } : row
    ));
    
    const row = surfaceRows.find(r => r.id === rowId);
    if (row && row.faceIndex !== null) {
      // Update highlight color based on role
      const roleColors = {
        'left': 0xffd99f,    // Light orange (açık turuncu) - toolbar tonu
        'right': 0xffd99f,   // Light orange (açık turuncu) - toolbar tonu
        'top': 0xffd99f,     // Light orange (açık turuncu) - toolbar tonu
        'bottom': 0xffd99f,  // Light orange (açık turuncu) - toolbar tonu
        'front': 0xffd99f,   // Light orange (açık turuncu) - toolbar tonu
        'back': 0xffff00,    // Yellow (sarı) - Ba
        'door': 0xceffce,    // Blue (mavi) - D
        '': 0xffb6b6         // Default light orange
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

  const handleConfirmSurface = (rowId: string) => {
    const row = surfaceRows.find(r => r.id === rowId);
    if (!row || !row.role || row.faceIndex === null) {
      console.warn('🎯 Cannot confirm surface: missing role or face selection');
      return;
    }

    // Mark surface as confirmed
    setSurfaceRows(prev => prev.map(r => 
      r.id === rowId ? { ...r, confirmed: true } : r
    ));

    console.log(`✅ Surface confirmed: row ${rowId}, role: ${row.role}, face: ${row.faceIndex}`);
  };

  const handleEditSurface = (rowId: string) => {
    // Make the row editable again
    setSurfaceRows(prev => prev.map(r => 
      r.id === rowId ? { ...r, confirmed: false } : r
    ));
    
    console.log(`✏️ Surface row ${rowId} set to editable mode`);
  };
  const handleFormulaChange = (rowId: string, formula: string) => {
    setSurfaceRows(prev => prev.map(row => 
      row.id === rowId ? { ...row, formula, confirmed: false } : row
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
        <div className="bg-white rounded-lg border border-stone-200 p-2">
          <div className="flex items-center justify-between h-8">
            <div className="flex items-center gap-2">
            {/* Add Surface Button */}
            <button
              onClick={handleSelectSurface}
              disabled={isSelectionActive}
              className={`p-1.5 rounded-md transition-colors ${
                isSelectionActive 
                  ? 'bg-orange-300 text-white cursor-not-allowed'
                  : 'bg-green-600 hover:bg-green-700 text-white'
              }`}
              title="Add Surface"
            >
              <Plus size={14} />
            </button>
            
            {/* Exit Selection Button */}
            {isSelectionActive && (
              <button
                onClick={handleExitSelection}
                className="p-1.5 bg-red-600 hover:bg-red-700 text-white rounded-md transition-colors"
                title="Exit Surface Selection"
              >
                <X size={14} />
              </button>
            )}
            
            {/* Add Surface Label */}
            <span className={`text-sm font-medium ${
              isSelectionActive ? 'text-orange-600' : 'text-gray-700'
            }`}>
              Add Surface
            </span>
            </div>
            
            {/* Clear All Button - moved to right */}
            {surfaceRows.length > 0 && (
              <button
                onClick={handleClearAll}
                className="text-xs text-red-600 hover:text-red-800 px-2 py-1 rounded hover:bg-red-50 transition-colors h-6"
              >
                Clear All
              </button>
            )}
          </div>
          
          {isSelectionActive && (
            <div></div>
          )}
        </div>

        {/* Surface Rows */}
        {surfaceRows.length > 0 && (
          <div className="bg-white rounded-lg border border-stone-200 p-2">
            <div className="mb-2">
              <h4 className="font-medium text-slate-800 text-xs">Surfaces</h4>
            </div>
            
            <div className="space-y-2">
              {surfaceRows.map((row, index) => (
                <div 
                  key={row.id} 
                  className={`flex items-center gap-2 p-2 rounded-lg border transition-all duration-200 ${
                    row.isActive 
                      ? 'border-orange-300 bg-orange-50/50 shadow-sm' 
                      : row.confirmed 
                        ? 'border-green-300 bg-green-50/50 shadow-sm'
                        : 'border-gray-200 bg-gray-50/50'
                  }`}
                >
                  {/* Surface Number - Turuncu-beyaz tema */}
                  <div className="flex-shrink-0 w-6 h-6 rounded-full bg-gradient-to-br from-orange-400 to-orange-500 text-white text-xs font-bold flex items-center justify-center shadow-sm border border-orange-300">
                    {index + 1}
                  </div>
                  
                  {/* Role Selection */}
                  <select
                    value={row.role}
                    onChange={(e) => handleRoleChange(row.id, e.target.value)}
                    disabled={!row.confirmed}
                    className="w-12 text-xs bg-white border border-gray-300 rounded px-1 py-1 disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 text-black font-medium"
                  >
                    <option value="">Role</option>
                    <option value="left">L</option>
                    <option value="right">R</option>
                    <option value="top">T</option>
                    <option value="bottom">B</option>
                    <option value="front">F</option>
                    <option value="back">BA</option>
                    <option value="door">D</option>
                  </select>
                  
                  {/* Formula Input */}
                  <input
                    type="text"
                    value={row.formula}
                    onChange={(e) => handleFormulaChange(row.id, e.target.value)}
                    disabled={false}
                    placeholder="Description..."
                    className="flex-1 min-w-0 text-xs bg-white border border-gray-300 rounded px-2 py-1 disabled:bg-gray-100 disabled:text-gray-500 focus:outline-none focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 placeholder-gray-400 mr-2 text-black font-medium"
                  />
                  
                  {/* Apply Button */}
                  <div className="flex items-center gap-1">
                    {/* Apply/Check Icon */}
                    <button
                      onClick={() => handleConfirmSurface(row.id)}
                      disabled={!row.role || !row.role.trim() || row.faceIndex === null}
                      className={`flex-shrink-0 p-1 rounded transition-all ${
                        row.confirmed && row.role && row.role.trim()
                          ? 'bg-green-600 text-white cursor-default' 
                          : (!row.role || !row.role.trim() || row.faceIndex === null || row.confirmed)
                            ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                            : 'bg-white text-green-600 border border-green-600 cursor-pointer hover:bg-green-50'
                      }`}
                      title={
                        row.confirmed && row.role && row.role.trim()
                          ? "Applied" 
                          : (!row.role || !row.role.trim())
                            ? "Select a role first"
                            : row.faceIndex === null
                              ? "Select a surface first"
                              : "Click to apply surface"
                      }
                    >
                      <Check size={12} />
                    </button>
                    
                    {/* Remove Row Button */}
                    <button
                      onClick={() => handleRemoveRow(row.id)}
                      className="flex-shrink-0 p-1 bg-red-100 hover:bg-red-200 text-red-600 rounded transition-colors"
                      title="Remove this surface"
                    >
                      <X size={12} />
                    </button>
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