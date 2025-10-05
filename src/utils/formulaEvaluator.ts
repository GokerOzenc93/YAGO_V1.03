export interface FormulaVariable {
  name: string;
  value: number;
}

export interface FormulaEvaluationResult {
  success: boolean;
  value: number | null;
  error?: string;
}

export class FormulaEvaluator {
  private variables: Map<string, number>;

  constructor(variables: FormulaVariable[] = []) {
    this.variables = new Map();
    variables.forEach(v => this.setVariable(v.name, v.value));
  }

  setVariable(name: string, value: number): void {
    if (!this.isValidVariableName(name)) {
      console.warn(`⚠️ Invalid variable name: ${name}`);
      return;
    }
    this.variables.set(name, value);
  }

  removeVariable(name: string): void {
    this.variables.delete(name);
  }

  clearVariables(): void {
    this.variables.clear();
  }

  getVariable(name: string): number | undefined {
    return this.variables.get(name);
  }

  getAllVariables(): FormulaVariable[] {
    return Array.from(this.variables.entries()).map(([name, value]) => ({
      name,
      value,
    }));
  }

  private isValidVariableName(name: string): boolean {
    return /^[a-zA-Z][a-zA-Z0-9_]*$/.test(name);
  }

  private escapeRegExp(str: string): string {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private replaceVariables(formula: string): string {
    let processed = formula;

    this.variables.forEach((value, name) => {
      const regex = new RegExp(`\\b${this.escapeRegExp(name)}\\b`, 'g');
      processed = processed.replace(regex, value.toString());
    });

    return processed;
  }

  evaluate(formula: string, debugLabel?: string): FormulaEvaluationResult {
    try {
      if (!formula || typeof formula !== 'string') {
        return {
          success: false,
          value: null,
          error: 'Invalid formula: must be a non-empty string',
        };
      }

      const trimmed = formula.trim();
      if (trimmed === '') {
        return {
          success: false,
          value: null,
          error: 'Formula is empty',
        };
      }

      const processed = this.replaceVariables(trimmed);

      if (!/^[0-9+\-*/().\s]+$/.test(processed)) {
        return {
          success: false,
          value: null,
          error: `Invalid characters in processed formula: ${processed}`,
        };
      }

      const result = eval(processed);

      if (typeof result !== 'number') {
        return {
          success: false,
          value: null,
          error: `Result is not a number: ${typeof result}`,
        };
      }

      if (!isFinite(result)) {
        return {
          success: false,
          value: null,
          error: `Result is not finite: ${result}`,
        };
      }

      if (result < 0) {
        return {
          success: false,
          value: null,
          error: `Result is negative: ${result}`,
        };
      }

      return {
        success: true,
        value: result,
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `❌ Formula evaluation error${debugLabel ? ` (${debugLabel})` : ''}:`,
        errorMessage,
        'Formula:',
        formula
      );
      return {
        success: false,
        value: null,
        error: errorMessage,
      };
    }
  }

  evaluateOrNull(formula: string, debugLabel?: string): number | null {
    const result = this.evaluate(formula, debugLabel);
    return result.success ? result.value : null;
  }

  evaluateOrDefault(formula: string, defaultValue: number, debugLabel?: string): number {
    const result = this.evaluate(formula, debugLabel);
    return result.success && result.value !== null ? result.value : defaultValue;
  }

  detectCircularDependency(formulas: Map<string, string>): {
    hasCircular: boolean;
    circularChain?: string[];
  } {
    const graph = new Map<string, Set<string>>();

    formulas.forEach((formula, varName) => {
      const dependencies = new Set<string>();
      this.variables.forEach((_, depName) => {
        const regex = new RegExp(`\\b${this.escapeRegExp(depName)}\\b`);
        if (regex.test(formula)) {
          dependencies.add(depName);
        }
      });
      graph.set(varName, dependencies);
    });

    const visited = new Set<string>();
    const recursionStack = new Set<string>();
    const path: string[] = [];

    const hasCycle = (node: string): boolean => {
      visited.add(node);
      recursionStack.add(node);
      path.push(node);

      const neighbors = graph.get(node);
      if (neighbors) {
        for (const neighbor of neighbors) {
          if (!visited.has(neighbor)) {
            if (hasCycle(neighbor)) {
              return true;
            }
          } else if (recursionStack.has(neighbor)) {
            path.push(neighbor);
            return true;
          }
        }
      }

      recursionStack.delete(node);
      path.pop();
      return false;
    };

    for (const node of graph.keys()) {
      if (!visited.has(node)) {
        if (hasCycle(node)) {
          return {
            hasCircular: true,
            circularChain: [...path],
          };
        }
      }
    }

    return { hasCircular: false };
  }
}

export function createFormulaEvaluator(variables: FormulaVariable[] = []): FormulaEvaluator {
  return new FormulaEvaluator(variables);
}
