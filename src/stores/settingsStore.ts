/**
 * settingsStore.ts
 * ================
 * Zustand store for LLM and application settings.
 * Persisted to localStorage.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';

// Initial Data Constants (migrated from types)
const INITIAL_CATEGORIES: Record<string, string> = {
    llm: 'Large Language Model',
    stt: 'Speech to Text',
    tts: 'Text to Speech',
    vision: 'Vision',
    embedding: 'Embedding',
};

const INITIAL_PROVIDERS: Record<string, ProviderInfo[]> = {
    llm: [
        { id: 'gemini', label: 'Google Gemini', pluginId: 'llm_gemini', requiresApiKey: true },
        { id: 'openai', label: 'OpenAI', pluginId: 'llm_openai', requiresApiKey: true },
        { id: 'anthropic', label: 'Anthropic', pluginId: 'llm_anthropic', requiresApiKey: true },
        { id: 'ollama', label: 'Ollama (Local)', pluginId: 'llm_ollama', requiresApiKey: false },
    ],
    stt: [
        { id: 'whisper', label: 'Whisper (Local)', pluginId: 'stt_whisper', requiresApiKey: false },
    ],
    tts: [
        { id: 'kokoro', label: 'Kokoro (Local)', pluginId: 'tts_kokoro', requiresApiKey: false },
    ],
    vision: [
        { id: 'gemini', label: 'Google Gemini', pluginId: 'llm_gemini', requiresApiKey: true },
        { id: 'openai', label: 'OpenAI', pluginId: 'llm_openai', requiresApiKey: true },
    ],
    embedding: [
        { id: 'openai', label: 'OpenAI', pluginId: 'embedding_openai', requiresApiKey: true },
    ],
};


/**
 * Model options per provider.
 */
// Export needed type
export type ProviderInfo = {
    id: string;
    label: string;
    pluginId: string;
    requiresApiKey: boolean;
};

/**
 * Model options per provider.
 */
export const MODEL_OPTIONS: Record<string, { id: string; label: string }[]> = {
    gemini: [
        { id: 'gemini-3-flash-preview', label: 'Gemini 3 Flash (Preview)' },
        { id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash' },
        { id: 'gemini-2.5-flash-preview-09-2025', label: 'Gemini 2.5 Flash Preview (09-2025)' },
        { id: 'gemini-2.5-flash-image', label: 'Gemini 2.5 Flash Image' },
        { id: 'gemini-2.5-flash-native-audio-preview-12-2025', label: 'Gemini 2.5 Flash Live (Audio)' },
    ],
    openai: [
        { id: 'gpt-4o', label: 'GPT-4o' },
        { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
        { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
        { id: 'o1', label: 'o1' },
        { id: 'o1-mini', label: 'o1 Mini' },
        { id: 'gpt-5-mini', label: 'GPT-5 Mini' },
        { id: 'gpt-5-nano', label: 'GPT-5 Nano' },
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
    // LLM Settings (existing)
    provider: string; // Dynamic provider ID
    apiKey: string;
    model: string;
    temperature: number;
    systemPrompt: string;
    ollamaModels: string[];

    // Dynamic Data (Persisted)
    categories: Record<string, string>; // id -> label
    providersByCategory: Record<string, ProviderInfo[]>;
    customSchemas: Record<string, Record<string, unknown>>; // pluginId -> schema override

    // Selection State
    selectedCategory: string;
    selectedProviderByCategory: Record<string, string>;
    pluginConfigs: Record<string, Record<string, unknown>>;
    configSchemas: Record<string, Record<string, unknown>>; // Runtime loaded schemas
    isLoadingSchema: boolean;
}

/**
 * Settings actions interface.
 */
export interface SettingsActions {
    // LLM Actions
    setProvider: (provider: string) => void;
    setApiKey: (apiKey: string) => void;
    setModel: (model: string) => void;
    setTemperature: (temperature: number) => void;
    setSystemPrompt: (systemPrompt: string) => void;
    setOllamaModels: (models: string[]) => void;
    resetToDefaults: () => void;

    // Selection & Config
    setSelectedCategory: (category: string) => void;
    setSelectedProvider: (category: string, providerId: string) => void;
    setPluginConfig: (pluginId: string, config: Record<string, unknown>) => void;
    setConfigSchema: (pluginId: string, schema: Record<string, unknown>) => void;
    setIsLoadingSchema: (isLoading: boolean) => void;
    getActivePluginId: () => string | null;

    // Dynamic Editing Actions
    addCategory: (id: string, label: string) => void;
    updateCategory: (id: string, label: string) => void;
    deleteCategory: (id: string) => void;
    saveSchemaOverride: (pluginId: string, schema: Record<string, unknown>) => void;
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

    // Dynamic Data
    categories: INITIAL_CATEGORIES,
    providersByCategory: INITIAL_PROVIDERS,
    customSchemas: {},

    // Selection State
    selectedCategory: 'llm',
    selectedProviderByCategory: {
        llm: 'gemini',
        stt: 'whisper',
        tts: 'kokoro',
        vision: 'gemini',
        embedding: 'openai',
    },
    pluginConfigs: {},
    configSchemas: {},
    isLoadingSchema: false,
};

/**
 * Zustand store for settings with persistence.
 */
export const useSettingsStore = create<SettingsState & SettingsActions>()(
    persist(
        (set, get) => ({
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

            // Category/Provider Actions (new)
            setSelectedCategory: (category) => set({ selectedCategory: category }),

            setSelectedProvider: (category, providerId) =>
                set((state) => ({
                    selectedProviderByCategory: {
                        ...state.selectedProviderByCategory,
                        [category]: providerId,
                    },
                })),

            setPluginConfig: (pluginId, config) =>
                set((state) => ({
                    pluginConfigs: {
                        ...state.pluginConfigs,
                        [pluginId]: config,
                    },
                })),

            setConfigSchema: (pluginId, schema) =>
                set((state) => {
                    // Check for override
                    const override = state.customSchemas[pluginId];
                    return {
                        configSchemas: {
                            ...state.configSchemas,
                            [pluginId]: override || schema,
                        },
                    };
                }),

            setIsLoadingSchema: (isLoading) => set({ isLoadingSchema: isLoading }),

            getActivePluginId: () => {
                const state = get();
                const category = state.selectedCategory;
                const providerId = state.selectedProviderByCategory[category];
                const providers = state.providersByCategory[category];
                if (!providers) return null;
                const provider = providers.find(p => p.id === providerId);
                return provider?.pluginId ?? null;
            },

            // Dynamic Editing Actions
            addCategory: (id, label) => set(state => ({
                categories: { ...state.categories, [id]: label },
                providersByCategory: { ...state.providersByCategory, [id]: [] }
            })),

            updateCategory: (id, label) => set(state => ({
                categories: { ...state.categories, [id]: label }
            })),

            deleteCategory: (id) => set(state => {
                if ((state.providersByCategory[id]?.length ?? 0) > 0) {
                    throw new Error('Cannot delete category with existing providers');
                }
                const newCategories = { ...state.categories };
                delete newCategories[id];
                const newProviders = { ...state.providersByCategory };
                delete newProviders[id];
                const remainingKeys = Object.keys(newCategories);
                return {
                    categories: newCategories,
                    providersByCategory: newProviders,
                    selectedCategory: state.selectedCategory === id ? (remainingKeys[0] ?? '') : state.selectedCategory
                };
            }),

            saveSchemaOverride: (pluginId, schema) => set(state => ({
                customSchemas: { ...state.customSchemas, [pluginId]: schema },
                configSchemas: { ...state.configSchemas, [pluginId]: schema }
            })),
        }),
        {
            name: 'app-factory-settings',
            merge: (persistedState, currentState) => {
                const saved = persistedState as SettingsState;
                return {
                    ...currentState,
                    ...saved,
                    categories: saved.categories || currentState.categories,
                    providersByCategory: saved.providersByCategory || currentState.providersByCategory,
                    customSchemas: saved.customSchemas || {},
                };
            },
        }
    )
);

