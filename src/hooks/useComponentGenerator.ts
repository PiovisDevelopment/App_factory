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
═══════════════════════════════════════════════════════════════════
DESIGN SYSTEM - EXACT TOKENS (Use ONLY these - others will NOT render)
═══════════════════════════════════════════════════════════════════

COLOR MAPPING (User words → Tailwind classes):
┌─────────────┬────────────────────────────────────────────────────┐
│ User says   │ Use these EXACT classes                            │
├─────────────┼────────────────────────────────────────────────────┤
│ blue        │ bg-primary-500, bg-primary-600 (bright blue)       │
│ yellow      │ bg-amber-400, bg-amber-500, bg-yellow-400          │
│ orange      │ bg-warning-500, bg-warning-600 (#f59e0b)           │
│ red         │ bg-error-500, bg-error-600                         │
│ green       │ bg-success-500, bg-success-600                     │
│ gray/grey   │ bg-neutral-400, bg-neutral-500                     │
│ white       │ bg-white, bg-neutral-50                            │
│ black       │ bg-neutral-900, bg-neutral-950                     │
│ purple      │ bg-purple-500, bg-purple-600                       │
│ pink        │ bg-pink-500, bg-pink-600                           │
└─────────────┴────────────────────────────────────────────────────┘

AVAILABLE COLOR SCALES:
- primary: 50,100,200,300,400,500,600,700,800,900,950 (blue)
- neutral: 50,100,200,300,400,500,600,700,800,900,950 (gray)
- success: 50,500,600,700 (green)
- warning: 50,500,600,700 (orange/amber)
- error: 50,500,600,700 (red)
- Standard Tailwind: amber, yellow, purple, pink, etc. all work

TEXT ON COLORS:
- On dark bg (500+): use text-white
- On light bg (50-200): use text-neutral-900

SIZING:
- Small: w-8 h-8, w-10 h-10
- Medium: w-12 h-12, w-16 h-16
- Large: w-20 h-20, w-24 h-24

SHAPES:
- Circle/round: rounded-full
- Rounded square: rounded-lg, rounded-xl
- Square: rounded-none

SHADOWS & DEPTH:
- Flat: (no shadow)
- Subtle: shadow-sm
- Elevated: shadow-md, shadow-lg
- Dramatic: shadow-xl, shadow-2xl
- Neumorphic: shadow-lg + border + slightly lighter bg

ANIMATIONS (for hover/interaction requests):
- Spin: transition-transform duration-500 hover:rotate-[360deg]
- Pulse: hover:animate-pulse
- Bounce: transition-transform duration-300 hover:animate-bounce
- Jelly/bouncy: transition-all duration-300 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)] hover:scale-110 active:scale-90
- Scale up: transition-transform duration-200 hover:scale-110
- Scale down (press): active:scale-95
- Squish/squishy: transition-transform duration-150 hover:scale-110 active:scale-90

STATES (always include):
- Hover: hover:bg-{color}-700, hover:scale-105
- Focus: focus:outline-none focus:ring-2 focus:ring-{color}-500 focus:ring-offset-2
- Active: active:scale-95
- Disabled: disabled:opacity-50 disabled:cursor-not-allowed

ACCESSIBILITY (MANDATORY):
- Buttons: aria-label="description of what button does"
- Good contrast: dark text on light bg, light text on dark bg
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

  return `You are a world-class UI component generator. Your output is used in a live preview - it must be PIXEL PERFECT and FULLY FUNCTIONAL.

REQUEST: "${userPrompt}"

═══════════════════════════════════════════════════════════════════
STEP 1: PARSE THE REQUEST (extract ALL requirements)
═══════════════════════════════════════════════════════════════════
Before generating, identify:
- SHAPE: round/circle → rounded-full, square → rounded-none, rounded → rounded-lg
- COLOR: yellow → bg-yellow-400/bg-amber-400, blue → bg-primary-600, etc.
- SIZE: small/large/specific dimensions
- BEHAVIOR: hover effects, click actions, animations
- CONTENT: text label, icon, etc.

═══════════════════════════════════════════════════════════════════
STEP 2: APPLY THESE NON-NEGOTIABLE RULES
═══════════════════════════════════════════════════════════════════

RULE 1 - SINGLE ELEMENT OUTPUT:
Return ONLY the requested component. NO wrapper divs, containers, headers, descriptions, or demo UI.
If user says "button" → return just a <button>
If user says "card" → return just the card element

RULE 2 - LITERAL IMPLEMENTATION:
Every word in the request MUST be reflected in the output:
- "yellow" → bg-yellow-400 or bg-amber-400 (NOT warning - use actual yellow)
- "round/circle" → rounded-full
- "spins on hover" → transition-transform duration-500 hover:rotate-[360deg]
- "squishy/squish" → transition-transform duration-150 hover:scale-110 active:scale-90
- "pulses" → hover:animate-pulse
- "on click says X" → onClick={() => alert('X')}
- "neomorphic/neumorphic" → shadow-lg bg-neutral-100 border border-neutral-200

RULE 3 - TECHNICAL:
- ${frameworkInstructions[framework]}
- Tailwind CSS classes ONLY (no inline styles)
- No imports (React is global)
- No markdown code fences
- Use React.useState, React.useCallback, React.useEffect directly

RULE 4 - ACCESSIBILITY:
- All buttons: aria-label="descriptive text"
- Focus ring: focus:outline-none focus:ring-2 focus:ring-offset-2

RULE 5 - NO UNWANTED ELEMENTS:
- If user does NOT mention text/label → button must be EMPTY (no children, self-closing or empty)
- If user does NOT mention background color → use the color they DID mention
- ONLY add what is EXPLICITLY requested - nothing more
- "jelly" or "bouncy" → MUST use elastic cubic-bezier: ease-[cubic-bezier(0.68,-0.55,0.265,1.55)]

${DESIGN_TOKEN_REFERENCE}

═══════════════════════════════════════════════════════════════════
EXAMPLES (study the pattern)
═══════════════════════════════════════════════════════════════════

REQUEST: "yellow neomorphic button that bounces like jelly on hover"
const JellyNeomorphicButton = () => {
  return (
    <button
      aria-label="Jelly neomorphic button"
      className="w-16 h-16 rounded-xl bg-yellow-400 shadow-lg border border-yellow-300 transition-all duration-300 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)] hover:scale-110 active:scale-90 focus:outline-none focus:ring-2 focus:ring-yellow-500 focus:ring-offset-2"
    />
  );
};

REQUEST: "small red circle"
const SmallRedCircle = () => {
  return (
    <div
      aria-label="Small red circle"
      className="w-8 h-8 rounded-full bg-red-500"
    />
  );
};

REQUEST: "blue button that spins on hover, on click alerts hello"
const SpinningBlueButton = () => {
  return (
    <button
      aria-label="Click to say hello"
      onClick={() => alert('hello')}
      className="px-6 py-3 rounded-lg bg-primary-600 text-white font-semibold transition-transform duration-500 hover:rotate-[360deg] focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
    >
      HELLO
    </button>
  );
};

═══════════════════════════════════════════════════════════════════
NOW GENERATE (code only, no explanation)
═══════════════════════════════════════════════════════════════════`;
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
