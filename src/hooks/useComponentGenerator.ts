/**
 * src/hooks/useComponentGenerator.ts
 * ===================================
 * React hook for AI-powered component generation using the configured LLM provider.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D078, D079, D070
 *
 * Traceability: Satisfies GAP-03 (Orphaned AI Backend), GAP-04 (Preview Wiring)
 *
 * NOTE: This hook uses llmService.generateText() which respects user settings
 * (provider, model, API key) from settingsStore.
 */

import { useState, useCallback } from "react";
import type {
  ComponentType,
  FrameworkTarget,
  GeneratedComponent,
} from "../components/ai/ComponentGenerator";
import { generateText } from "../services/llmService";

/**
 * Generation state.
 */
export interface GenerationState {
  /** Whether generation is in progress */
  isGenerating: boolean;
  /** Last generated component */
  generatedComponent: GeneratedComponent | null;
  /** Error message if generation failed */
  error: string | null;
}

/**
 * Hook return type.
 */
export interface UseComponentGeneratorReturn {
  /** Current generation state */
  state: GenerationState;
  /** Generate a component from prompt */
  generate: (
    prompt: string,
    type: ComponentType,
    framework: FrameworkTarget
  ) => Promise<GeneratedComponent>;
  /** Clear the generated component */
  clearGenerated: () => void;
  /** Clear error */
  clearError: () => void;
}

/**
 * Design System Token Reference (D006 - design_tokens.css)
 * =========================================================
 * This constant provides LLM with available Tailwind classes that map to
 * the App Factory design system tokens. All generated components MUST use
 * these classes to satisfy C2 (Strict FE Design System).
 * 
 * Traceability: EUR-1.1.3a, D070, C2
 */
const DESIGN_TOKEN_REFERENCE = `
DESIGN SYSTEM TOKENS - Use ONLY these Tailwind classes for styling:

COLORS (use shade 50-950):
- Primary: bg-primary-[shade], text-primary-[shade], border-primary-[shade]
  Examples: bg-primary-600, hover:bg-primary-700, text-primary-50, border-primary-500
- Neutral: bg-neutral-[shade], text-neutral-[shade], border-neutral-[shade]
  Examples: bg-neutral-100, text-neutral-900, border-neutral-300
- Success: bg-success-[shade], text-success-[shade] (use 50, 500-700)
- Warning: bg-warning-[shade], text-warning-[shade] (use 50, 500-700)
- Error: bg-error-[shade], text-error-[shade] (use 50, 500-700)

SPACING (4px grid):
- Padding: p-1 to p-12, px-1 to px-8, py-1 to py-4
- Margin: m-1 to m-12, mx-auto, my-4
- Gap: gap-1 to gap-8

TYPOGRAPHY:
- Size: text-xs, text-sm, text-base, text-lg, text-xl, text-2xl
- Weight: font-normal, font-medium, font-semibold, font-bold
- Font: font-sans (default), font-mono

BORDERS & RADIUS:
- Radius: rounded-sm, rounded-md, rounded-lg, rounded-xl, rounded-full
- Border: border, border-2, border-neutral-200, border-primary-500

SHADOWS:
- shadow-sm, shadow-md, shadow-lg, shadow-xl

EFFECTS:
- Focus: focus:outline-none, focus:ring-2, focus:ring-primary-500, focus:ring-offset-2
- Transitions: transition-all, transition-colors, duration-150, duration-200
- Opacity: opacity-50, opacity-75

LAYOUT:
- Flex: flex, flex-col, items-center, justify-center, justify-between
- Width: w-full, w-auto, min-w-0, max-w-md
- Display: inline-flex, block, hidden
`;

/**
 * Build LLM prompt for component generation.
 * 
 * The prompt is designed to produce code that can be compiled at runtime
 * by Sucrase. Key requirements:
 * - No complex TypeScript syntax (generics, type assertions)
 * - Simple parameter types or none at all
 * - Tailwind classes referencing design tokens (C2 compliance)
 * - Self-contained components
 * 
 * Traceability: EUR-1.1.3a, D070, C2
 */
function buildPrompt(
  userPrompt: string,
  type: ComponentType,
  framework: FrameworkTarget
): string {
  const frameworkInstructions: Record<FrameworkTarget, string> = {
    react: `Generate a React functional component using JavaScript.
IMPORTANT: Do NOT include any TypeScript syntax such as:
- Type annotations (: string, : number, : Props)
- Interface or type definitions
- Generic type parameters (<T>, useState<number>)
- "as" type assertions
Use plain JavaScript that works directly in the browser.`,
    vue: "Generate a Vue 3 component using the Composition API with Tailwind classes.",
    svelte: "Generate a Svelte component with Tailwind classes.",
    html: "Generate HTML with Tailwind CSS classes.",
  };

  return `You are a UI component generator for the App Factory design system.

Create a ${type} component based on this description:
"${userPrompt}"

CRITICAL REQUIREMENTS:
1. ${frameworkInstructions[framework]}
2. Use Tailwind CSS classes for ALL styling - NO inline styles
3. Use ONLY the design token classes listed below - this ensures visual consistency
4. Do NOT include any import statements - React is available globally
5. Do NOT wrap code in markdown code fences
6. Make the component self-contained and immediately executable
7. For React: use React.useState, React.useCallback directly (not destructured imports)
8. Give the component a clear, descriptive PascalCase name
9. For hover effects, use Tailwind hover: prefix (e.g., hover:bg-primary-700)

${DESIGN_TOKEN_REFERENCE}

EXAMPLE COMPONENT (Button):
const PrimaryButton = () => {
  return (
    <button
      className="inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white font-medium rounded-md hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 transition-all duration-150 disabled:opacity-60 disabled:cursor-not-allowed"
    >
      Click Me
    </button>
  );
};

Generate ONLY the component code. No explanations, no imports, no markdown.`;
}

/**
 * Exported design token reference for use in refinement prompts.
 * This ensures consistency between initial generation and refinements.
 */
export { DESIGN_TOKEN_REFERENCE };

/**
 * Parse component name from generated code.
 */
function parseComponentName(code: string): string {
  // Try to find exported component name
  const exportMatch = code.match(
    /export\s+(?:const|function)\s+(\w+)/
  );
  if (exportMatch) {
    return exportMatch[1];
  }

  // Try to find function/const declaration
  const declMatch = code.match(
    /(?:const|function)\s+(\w+)\s*(?::|=|<)/
  );
  if (declMatch) {
    return declMatch[1];
  }

  return "GeneratedComponent";
}

/**
 * Extract error message from various error types.
 * Handles Error instances, Tauri CommandError objects, and unknown types.
 */
function extractErrorMessage(err: unknown): string {
  // Standard Error instance
  if (err instanceof Error) {
    return err.message;
  }

  // Tauri CommandError object: { code: string, message: string }
  if (typeof err === "object" && err !== null && "message" in err) {
    const msg = (err as { message: string }).message;
    if (typeof msg === "string" && msg.length > 0) {
      return msg;
    }
  }

  // String error
  if (typeof err === "string" && err.length > 0) {
    return err;
  }

  return "Failed to generate component";
}

/**
 * Hook for AI-powered component generation.
 *
 * Uses the configured LLM provider (Gemini, Ollama, etc.) from settings
 * to generate UI components from natural language descriptions.
 *
 * @example
 * ```tsx
 * const { state, generate } = useComponentGenerator();
 *
 * const handleGenerate = async () => {
 *   const result = await generate("A blue submit button", "button", "react");
 *   console.log(result.code);
 * };
 * ```
 */
export function useComponentGenerator(): UseComponentGeneratorReturn {
  const [state, setState] = useState<GenerationState>({
    isGenerating: false,
    generatedComponent: null,
    error: null,
  });

  /**
   * Generate a component from prompt.
   */
  const generate = useCallback(
    async (
      prompt: string,
      type: ComponentType,
      framework: FrameworkTarget
    ): Promise<GeneratedComponent> => {
      if (!prompt.trim()) {
        throw new Error("Prompt cannot be empty");
      }

      setState((prev) => ({
        ...prev,
        isGenerating: true,
        error: null,
      }));

      try {
        let code: string;

        // Build the LLM prompt
        const llmPrompt = buildPrompt(prompt, type, framework);

        // Use the settings-based LLM service (supports Gemini, Ollama, etc.)
        const result = await generateText(llmPrompt);

        if (!result.success || !result.text) {
          // If LLM call fails, throw with the actual error message
          throw new Error(result.error || "LLM generation failed - no response received");
        }

        code = result.text;

        const name = parseComponentName(code);

        const generated: GeneratedComponent = {
          name,
          type,
          framework,
          code,
          generatedAt: new Date(),
          prompt,
        };

        setState({
          isGenerating: false,
          generatedComponent: generated,
          error: null,
        });

        return generated;
      } catch (err) {
        const errorMsg = extractErrorMessage(err);

        setState((prev) => ({
          ...prev,
          isGenerating: false,
          error: errorMsg,
        }));

        throw new Error(errorMsg);
      }
    },
    []
  );

  /**
   * Clear the generated component.
   */
  const clearGenerated = useCallback(() => {
    setState((prev) => ({
      ...prev,
      generatedComponent: null,
    }));
  }, []);

  /**
   * Clear error.
   */
  const clearError = useCallback(() => {
    setState((prev) => ({
      ...prev,
      error: null,
    }));
  }, []);

  return {
    state,
    generate,
    clearGenerated,
    clearError,
  };
}

export default useComponentGenerator;
