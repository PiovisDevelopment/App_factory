/**
 * settingsStore.ts
 * ================
 * Zustand store for LLM and application settings.
 * Persisted to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Supported LLM providers.
 */
export type LLMProvider = 'gemini' | 'openai' | 'anthropic' | 'ollama';

/**
 * Model options per provider.
 */
export const MODEL_OPTIONS: Record<LLMProvider, { id: string; label: string }[]> = {
    gemini: [
        { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.0-flash', label: 'Gemini 2.0 Flash' },
        { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    ],
    openai: [
        { id: 'gpt-4o', label: 'GPT-4o' },
        { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    ],
    anthropic: [
        { id: 'claude-3-5-sonnet-20241022', label: 'Claude 3.5 Sonnet' },
        { id: 'claude-3-opus-20240229', label: 'Claude 3 Opus' },
    ],
    ollama: [
        { id: 'llama3.2', label: 'Llama 3.2' },
        { id: 'mistral', label: 'Mistral' },
        { id: 'codellama', label: 'Code Llama' },
    ],
};

/**
 * Settings state interface.
 */
export interface SettingsState {
    provider: LLMProvider;
    apiKey: string;
    model: string;
    temperature: number;
    systemPrompt: string;
    ollamaModels: string[]; // Dynamically fetched models
}

/**
 * Settings actions interface.
 */
export interface SettingsActions {
    setProvider: (provider: LLMProvider) => void;
    setApiKey: (apiKey: string) => void;
    setModel: (model: string) => void;
    setTemperature: (temperature: number) => void;
    setSystemPrompt: (systemPrompt: string) => void;
    setOllamaModels: (models: string[]) => void;
    resetToDefaults: () => void;
}

/**
 * Default settings values.
 */
const DEFAULT_SETTINGS: SettingsState = {
    provider: 'gemini',
    apiKey: '',
    model: 'gemini-3-flash-preview',
    temperature: 0.0,
    systemPrompt: `You are an expert Frontend Engineer and strict code compiler. Return ONLY valid React/Tailwind code.

CRITICAL INSTRUCTIONS:
1. OUTPUT FORMAT: Return ONLY the raw component code. NO markdown fences, NO explanations, NO imports, NO comments.
2. ACCURACY: Implement EXACTLY what is requested. DO NOT hallucinate features.
3. NEGATIVE CONSTRAINTS (DO NOT DO):
   - DO NOT add background colors unless requested.
   - DO NOT add filler text (Lorem Ipsum) unless requested.
   - DO NOT add extra padding/margins to the root element. It must be reflowable.
   - DO NOT wrap the component in a centered div (the previewer handles centering).
   - DO NOT use <button> tags for "Shapes" (Sphere, Square, Box) unless explicitly asked. Use <div>.
   - DO NOT use absolute positioning on the root element.

DESIGN SYSTEM (Apple HIG & Platform Agnostic Best Practices):
- TYPOGRAPHY: Use 'font-sans' (Inter/system-ui). distinct weights (medium/semibold for interactive).
- SPACING: Use standard Tailwind spacing (p-4, gap-2).
- INTERACTION: All interactive elements MUST have:
  - hover states (brightness-105 or bg-opacity changes)
  - active states (scale-95 or brightness-90)
  - focus states (ring-2 ring-primary-500 ring-offset-2)
  - cursor-pointer

ANIMATION RULES (Exact Implementation):
- "jelly" / "bouncy" -> transition-transform duration-300 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)] hover:scale-110 active:scale-90
- "spin" -> transition-transform duration-700 ease-in-out hover:rotate-[360deg]
- "squishy" -> transition-all duration-200 hover:scale-x-125 hover:scale-y-75 active:scale-x-75 active:scale-y-125
- "neomorphic" -> shadow-[5px_5px_10px_rgba(0,0,0,0.1),-5px_-5px_10px_rgba(255,255,255,0.8)]

STYLING:
- Use Tailwind CSS for EVERYTHING.
- Borders: 'ring-1 ring-white/10' for dark mode subtlety.
- Colors: Use 'bg-primary-500', 'text-neutral-900' unless specific colors requested.

BROWNFIELD PATTERNS (MANDATORY overrides):
- If user says "HEXAGON" -> className="aspect-square bg-primary-500 [clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]"
- If user says "SPARKLES" -> Use a wrapper div with 'relative'. Add absolute positioned spans for 'sparkles'.

FINAL CHECK:
- Did you add a background color? If user didn't ask, REMOVE IT.
- Did you add text? If user didn't ask, make it empty.
- Is the root element margin-free? Yes.`,
    ollamaModels: [],
};

/**
 * Zustand store for settings with persistence.
 */
export const useSettingsStore = create<SettingsState & SettingsActions>()(
    persist(
        (set) => ({
            ...DEFAULT_SETTINGS,

            setProvider: (provider) =>
                set((state) => {
                    // When provider changes, reset model to first option of new provider
                    let newModel = state.model;
                    if (provider === 'gemini') newModel = 'gemini-3-flash-preview';
                    else if (provider === 'ollama') newModel = state.ollamaModels[0] || 'llama3.2';
                    else newModel = MODEL_OPTIONS[provider]?.[0]?.id || '';

                    return { provider, model: newModel };
                }),

            setApiKey: (apiKey) => set({ apiKey }),

            setModel: (model) => set({ model }),

            setTemperature: (temperature) => {
                // Round to 1 decimal place and clamp between 0 and 2
                const rounded = Math.round(Math.max(0, Math.min(2, temperature)) * 10) / 10;
                set({ temperature: rounded });
            },

            setSystemPrompt: (systemPrompt) => set({ systemPrompt }),

            setOllamaModels: (models) => set({ ollamaModels: models }),

            resetToDefaults: () => set(DEFAULT_SETTINGS),
        }),
        {
            name: 'app-factory-settings',
        }
    )
);
