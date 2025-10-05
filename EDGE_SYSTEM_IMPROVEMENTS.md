# Edge System Improvements

## Overview
This document outlines the improvements made to the edge dynamic update system to make it more robust, scalable, and maintainable.

## Problems Solved

### 0. State Synchronization Race Condition ✅ **[CRITICAL FIX]**
**Problem:** Edge formulas were "one step behind" - updates only took effect on the next formula change.

**Root Cause:** Two separate `useEffect` hooks created a race condition where variable updates and calculations happened asynchronously without guaranteed order.

**Solution:**
- Created `syncFormulaVariables()` function to synchronously update all variables
- Call `syncFormulaVariables()` BEFORE every calculation
- Single `useEffect` that syncs then calculates
- Added `clearVariables()` to prevent ghost variables
- Used `requestAnimationFrame()` for post-state-update calculations

**Result:** Formulas now react immediately with correct values!

See [SYNC_FIX.md](./SYNC_FIX.md) for detailed explanation.

---

### 1. Batch Update System ✅
**Problem:** Geometry updates were applied immediately, causing cascading issues when multiple edges needed updates.

**Solution:**
- Implemented `geometryUpdatesByShape` map to collect all vertex changes per shape
- Apply all changes in a single batch after calculation
- Prevents intermediate states from corrupting subsequent calculations

### 2. Formula Evaluation Error Handling ✅
**Problem:** Invalid formulas crashed the app with no clear error messages.

**Solution:**
- Created dedicated `FormulaEvaluator` class in `/src/utils/formulaEvaluator.ts`
- Comprehensive validation:
  - Check for empty/invalid input
  - Validate result type (must be number)
  - Ensure finite results
  - Prevent negative values
  - Escape special regex characters
- Detailed error logging with debug labels
- Safe fallback to `null` on any error

### 3. Circular Dependency Detection ✅
**Problem:** Circular formulas caused infinite loops.

**Solution:**
- Track value history for each edge using `lineValueHistory` map
- Detect when a value repeats (circular dependency)
- Max iteration limit (10) with clear warning
- Early termination when no changes detected

### 4. Variable Synchronization ✅
**Problem:** Custom parameters and edge labels weren't automatically synced with formula evaluator.

**Solution:**
- Added `useEffect` hook to sync all variables:
  - Dimension variables (W, H, D)
  - Custom parameters
  - Edge labels
- Automatic updates when any dependency changes
- Single source of truth via `FormulaEvaluator` instance

### 5. Interaction Manager Separation ✅
**Problem:** Edge selection logic was tightly coupled with UI component.

**Solution:**
- Created `useEdgeInteraction` hook in `/src/hooks/useEdgeInteraction.ts`
- Clean separation of concerns:
  - State management
  - Edge CRUD operations
  - Selection mode handling
  - Fast lookups via internal Map
- Ready for future 3D raycaster integration

## Architecture Improvements

### Before
```
RefVolume Component
├── Direct geometry manipulation
├── Inline formula evaluation with eval()
├── No circular dependency protection
└── Mixed UI and business logic
```

### After
```
RefVolume Component
├── Uses FormulaEvaluator utility
├── Uses useEdgeInteraction hook (ready for integration)
├── Batch geometry updates
└── Clear separation of concerns

New Utilities:
├── /src/utils/formulaEvaluator.ts
│   ├── Variable management
│   ├── Safe evaluation
│   ├── Circular dependency detection
│   └── Comprehensive error handling
│
└── /src/hooks/useEdgeInteraction.ts
    ├── Edge state management
    ├── CRUD operations
    └── Selection mode handling
```

## Key Features

### Dynamic Edge Updates
- Multiple edges can reference each other via formulas
- Automatic recalculation in correct order
- Iterative convergence with safety limits
- Real-time geometry updates

### Formula System
- Built-in variables: `W` (width), `H` (height), `D` (depth)
- Custom parameters with any name
- Edge labels as variables
- Mathematical expressions: `+`, `-`, `*`, `/`, `()`

### Example Usage
```typescript
// Edge 1: label = "A", formula = "100"
// Edge 2: label = "B", formula = "A + 50"
// Edge 3: label = "C", formula = "B * 2"
// Result: A=100, B=150, C=300

// When A changes to 200:
// System automatically updates: A=200, B=250, C=500
```

### Error Handling
All errors are caught and logged with context:
- Formula syntax errors
- Invalid variable names
- Type mismatches
- Circular dependencies
- Negative/infinite results

## Performance Considerations

1. **Batch Updates**: Single geometry update per shape per iteration
2. **Early Termination**: Stops when no changes detected
3. **Map-based Lookups**: O(1) edge finding by ID or label
4. **History Tracking**: Prevents infinite loops efficiently

## Future Enhancements

1. **3D Raycaster Integration**: Click edges directly in 3D scene
2. **Undo/Redo System**: Command pattern for all changes
3. **Better Formula Parser**: Replace `eval()` with safe parser
4. **Dependency Graph Visualization**: Show formula relationships
5. **Constraint Solver**: Bidirectional constraints between edges

## Testing Recommendations

1. Test circular formulas: `A = B + 10`, `B = A + 10`
2. Test long dependency chains: `A -> B -> C -> D -> E`
3. Test invalid formulas: Division by zero, undefined variables
4. Test concurrent edge updates: Multiple formulas changing simultaneously
5. Test edge cases: Empty formulas, negative values, very large numbers

## Migration Notes

Existing code continues to work without changes. The new utilities are drop-in replacements that can be adopted incrementally.

For new features, prefer:
- `FormulaEvaluator` over inline `eval()`
- `useEdgeInteraction` hook over local state management
- Batch updates over immediate geometry changes
