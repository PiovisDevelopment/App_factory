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
 * Build LLM prompt for component generation.
 * 
 * The prompt is designed to produce code that can be compiled at runtime
 * by Sucrase. Key requirements:
 * - No complex TypeScript syntax (generics, type assertions)
 * - Simple parameter types or none at all
 * - Tailwind for styling
 * - Self-contained components
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
    vue: "Generate a Vue 3 component using the Composition API.",
    svelte: "Generate a Svelte component.",
    html: "Generate HTML with CSS styling.",
  };

  return `You are a UI component generator. Create a ${type} component based on this description:

"${userPrompt}"

CRITICAL REQUIREMENTS:
1. ${frameworkInstructions[framework]}
2. Use INLINE STYLES (style={{ }}) for ALL styling - do NOT use CSS classes or Tailwind
3. Do NOT include any import statements - React is available globally
4. Do NOT wrap code in markdown code fences
5. Make the component self-contained and immediately executable
6. For React: use React.useState, React.useCallback directly (not destructured imports)
7. Give the component a clear, descriptive PascalCase name
8. For hover effects, use onMouseEnter/onMouseLeave with React.useState to toggle styles

Generate ONLY the component code. No explanations, no imports, no markdown.`;
}

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
