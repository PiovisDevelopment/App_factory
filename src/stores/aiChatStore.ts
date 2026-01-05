/**
 * aiChatStore.ts
 * ==============
 * Zustand store for AI App Chat feature.
 * Manages per-scope LLM configurations, chat history, and operational modes.
 * Persisted to localStorage for session continuity.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import {
    type LLMInstanceConfig,
    type ChatMessage,
    DEFAULT_SCOPE_CONFIGS,
} from '../services/aiChatLlmService';

/**
 * Operational modes for AI Chat.
 */
export type AiChatMode = 'chat' | 'change';

/**
 * Scope selection for AI Chat.
 */
export type AiChatScope = 'backend' | 'frontend' | 'full';

/**
 * AI Chat state interface.
 */
export interface AiChatState {
    /** Current operational mode */
    mode: AiChatMode;
    /** Current scope selection */
    scope: AiChatScope;

    /** LLM configuration for Backend scope */
    backendConfig: LLMInstanceConfig;
    /** LLM configuration for Frontend scope */
    frontendConfig: LLMInstanceConfig;
    /** LLM configuration for Full scope */
    fullConfig: LLMInstanceConfig;

    /** Chat history per scope */
    chatHistory: Record<AiChatScope, ChatMessage[]>;

    /** Generation loading state */
    isGenerating: boolean;
    /** Last error message */
    error: string | null;

    /** Settings modal visibility */
    isSettingsOpen: boolean;
}

/**
 * AI Chat actions interface.
 */
export interface AiChatActions {
    /** Set operational mode */
    setMode: (mode: AiChatMode) => void;
    /** Set scope selection */
    setScope: (scope: AiChatScope) => void;

    /** Update config for a specific scope */
    updateScopeConfig: (scope: AiChatScope, config: Partial<LLMInstanceConfig>) => void;
    /** Get config for current scope */
    getCurrentConfig: () => LLMInstanceConfig;

    /** Add message to current scope's history */
    addMessage: (message: Omit<ChatMessage, 'id' | 'timestamp'>) => void;
    /** Clear chat history for current scope */
    clearHistory: () => void;
    /** Clear all chat history */
    clearAllHistory: () => void;

    /** Set generating state */
    setIsGenerating: (isGenerating: boolean) => void;
    /** Set error message */
    setError: (error: string | null) => void;

    /** Toggle settings modal */
    toggleSettings: () => void;
    /** Set settings modal visibility */
    setSettingsOpen: (isOpen: boolean) => void;

    /** Reset all settings to defaults */
    resetToDefaults: () => void;
}

/**
 * Generate unique ID for messages.
 */
function generateId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Default state values.
 */
const DEFAULT_STATE: AiChatState = {
    mode: 'chat',
    scope: 'full',
    backendConfig: DEFAULT_SCOPE_CONFIGS.backend,
    frontendConfig: DEFAULT_SCOPE_CONFIGS.frontend,
    fullConfig: DEFAULT_SCOPE_CONFIGS.full,
    chatHistory: {
        backend: [],
        frontend: [],
        full: [],
    },
    isGenerating: false,
    error: null,
    isSettingsOpen: false,
};

/**
 * Zustand store for AI Chat with persistence.
 */
export const useAiChatStore = create<AiChatState & AiChatActions>()(
    persist(
        (set, get) => ({
            ...DEFAULT_STATE,

            setMode: (mode) => set({ mode }),

            setScope: (scope) => set({ scope }),

            updateScopeConfig: (scope, config) => {
                const configKey = `${scope}Config` as keyof Pick<AiChatState, 'backendConfig' | 'frontendConfig' | 'fullConfig'>;
                set((state) => ({
                    [configKey]: { ...state[configKey], ...config },
                }));
            },

            getCurrentConfig: () => {
                const state = get();
                switch (state.scope) {
                    case 'backend':
                        return state.backendConfig;
                    case 'frontend':
                        return state.frontendConfig;
                    case 'full':
                        return state.fullConfig;
                }
            },

            addMessage: (message) => {
                const { scope } = get();
                const newMessage: ChatMessage = {
                    ...message,
                    id: generateId(),
                    timestamp: new Date(),
                    scope,
                };
                set((state) => ({
                    chatHistory: {
                        ...state.chatHistory,
                        [scope]: [...state.chatHistory[scope], newMessage],
                    },
                }));
            },

            clearHistory: () => {
                const { scope } = get();
                set((state) => ({
                    chatHistory: {
                        ...state.chatHistory,
                        [scope]: [],
                    },
                }));
            },

            clearAllHistory: () => {
                set({
                    chatHistory: {
                        backend: [],
                        frontend: [],
                        full: [],
                    },
                });
            },

            setIsGenerating: (isGenerating) => set({ isGenerating }),

            setError: (error) => set({ error }),

            toggleSettings: () => set((state) => ({ isSettingsOpen: !state.isSettingsOpen })),

            setSettingsOpen: (isOpen) => set({ isSettingsOpen: isOpen }),

            resetToDefaults: () => set(DEFAULT_STATE),
        }),
        {
            name: 'ai-chat-store',
            version: 3, // Increment when system prompts change
            // Only persist configs and history, not transient state
            partialize: (state) => ({
                mode: state.mode,
                scope: state.scope,
                backendConfig: state.backendConfig,
                frontendConfig: state.frontendConfig,
                fullConfig: state.fullConfig,
                chatHistory: state.chatHistory,
            }),
            // Migrate old versions to apply updated system prompts
            migrate: (persistedState: unknown, version: number) => {
                const state = persistedState as AiChatState;
                if (version < 3) {
                    // Force update system prompts to new defaults
                    console.log('[aiChatStore] Migrating to v3: updating system prompts with exact ID emphasis');
                    return {
                        ...state,
                        backendConfig: { ...state.backendConfig, systemPrompt: DEFAULT_SCOPE_CONFIGS.backend.systemPrompt },
                        frontendConfig: { ...state.frontendConfig, systemPrompt: DEFAULT_SCOPE_CONFIGS.frontend.systemPrompt },
                        fullConfig: { ...state.fullConfig, systemPrompt: DEFAULT_SCOPE_CONFIGS.full.systemPrompt },
                    };
                }
                return state;
            },
        }
    )
);
