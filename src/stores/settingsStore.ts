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
    systemPrompt: 'You are a helpful assistant.',
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
