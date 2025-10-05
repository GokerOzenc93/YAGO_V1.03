# Math.js Parameter System Documentation

## Overview

The project now uses **math.js** library for advanced mathematical expression evaluation and parameter management. This allows users to create variables, formulas, and dynamic calculations throughout the application.

## Features

### 1. Formula Evaluator with Math.js

The `FormulaEvaluator` class now uses math.js for:
- Safe mathematical expression evaluation
- Support for complex math operations (sin, cos, sqrt, etc.)
- Variable scope management
- Better error handling

### 2. Global Parameter Store

All parameters are stored globally in the app store and can be accessed anywhere:

```typescript
// Set a parameter
setParameterVariable('width', 500);

// Get a parameter
const width = getParameterVariable('width');

// Evaluate a formula
const result = evaluateFormula('width * 2 + 100');
```

### 3. Built-in Variables

When working with shapes, these variables are automatically available:
- `W` - Width
- `H` - Height
- `D` - Depth

### 4. Custom Parameters

Users can create custom parameters in the RefVolume panel:
1. Click the "+" button to add a new parameter
2. Enter a code name (e.g., `thickness`)
3. Enter a formula (e.g., `W / 10`)
4. Click the check button to apply

### 5. Edge/Line Parameters

Users can assign variables to edges:
1. Enable ruler mode
2. Click on edges to select them
3. Assign a label (e.g., `edge1`)
4. Assign a formula (e.g., `W - 50`)
5. The edge will dynamically update based on the formula

## Usage Examples

### Basic Arithmetic
```
500 + 100
W * 2
H / 2 + 50
```

### Using Math.js Functions
```
sqrt(W^2 + H^2)
sin(45 * pi / 180) * 100
max(W, H, D)
min(W, H) / 2
```

### Variable References
```
thickness * 2
edge1 + edge2
W - thickness
```

### Complex Expressions
```
(W + H) / 2 - 10
sqrt(W^2 + H^2) * 0.5
max(W, H) + min(W, H)
```

## How It Works

### 1. Parameter Storage
All parameters are stored in the global `FormulaEvaluator` instance in the app store.

### 2. Synchronization
When parameters are set in RefVolume:
- They are stored in the local evaluator
- They are synced to the global store
- Other components can access them

### 3. Dynamic Updates
When a parameter value changes:
1. All formulas using that parameter are re-evaluated
2. Dependent parameters are updated
3. Shape geometries are modified accordingly
4. The process repeats until all values stabilize (max 10 iterations)

### 4. Circular Dependency Detection
The system detects and prevents circular dependencies to avoid infinite loops.

## Benefits

1. **Math.js Integration**: Access to hundreds of math functions
2. **Global Access**: Parameters can be used anywhere in the application
3. **Dynamic Calculations**: Formulas update automatically when dependencies change
4. **Safe Evaluation**: No use of `eval()` - all expressions are parsed safely
5. **Better Error Handling**: Clear error messages for invalid formulas
6. **Parameter Visibility**: View all active variables in the status bar

## Status Bar Variables Display

Click on the "X vars" button in the status bar to see all active variables:
- Variable name (e.g., `W`, `H`, `thickness`)
- Current value
- Color-coded display for easy reading

## Technical Details

### FormulaEvaluator Class
- Uses math.js `create()` and `evaluate()` functions
- Maintains a Map of variables
- Provides safe evaluation with scope
- Logs all operations for debugging

### Store Integration
```typescript
interface AppState {
  formulaEvaluator: FormulaEvaluator;
  setParameterVariable: (name: string, value: number) => void;
  getParameterVariable: (name: string) => number | undefined;
  evaluateFormula: (formula: string) => number | null;
  clearParameterVariables: () => void;
}
```

## Best Practices

1. **Use Descriptive Names**: `thickness` instead of `t`
2. **Validate Formulas**: Always check for errors before applying
3. **Avoid Circular Dependencies**: Don't create formulas that reference each other
4. **Use Built-in Variables**: Prefer `W`, `H`, `D` for dimensions
5. **Test Complex Formulas**: Start simple and build up complexity

## Future Enhancements

- [ ] Parameter presets/templates
- [ ] Formula library with common calculations
- [ ] Unit conversion in formulas
- [ ] Export/import parameter sets
- [ ] Visual formula editor
- [ ] Parameter history/undo
