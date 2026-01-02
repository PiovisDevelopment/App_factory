/**
 * AiChatSettingsModal.tsx
 * =======================
 * Settings modal for AI App Chat per-scope configuration.
 * 
 * Features:
 * - Scope tabs (Backend / Frontend / Full)
 * - Provider dropdown (Gemini, OpenAI, Anthropic, Ollama)
 * - Model dropdown (dynamic based on provider)
 * - API Key status via apiKeyStore
 * - System prompt editor
 * - Temperature slider
 */

import React, { useState, useCallback } from 'react';
import { useAiChatStore, type AiChatScope } from '../../stores/aiChatStore';
import { MODEL_OPTIONS, type LLMProvider } from '../../stores/settingsStore';
import { DEFAULT_SYSTEM_PROMPTS, type AiChatProvider } from '../../services/aiChatLlmService';

/**
 * Close icon.
 */
const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

/**
 * Provider options for dropdown.
 */
const PROVIDER_OPTIONS: { id: AiChatProvider; label: string }[] = [
    { id: 'gemini', label: 'Google Gemini' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'anthropic', label: 'Anthropic' },
    { id: 'ollama', label: 'Ollama (Local)' },
];

/**
 * Scope labels.
 */
const SCOPE_LABELS: Record<AiChatScope, string> = {
    backend: 'Backend AI',
    frontend: 'Frontend AI',
    full: 'Full AI',
};

/**
 * AI Chat Settings Modal component.
 */
export const AiChatSettingsModal: React.FC = () => {
    const {
        backendConfig,
        frontendConfig,
        fullConfig,
        updateScopeConfig,
        setSettingsOpen,
    } = useAiChatStore();

    // Active tab for scope selection in settings
    const [activeTab, setActiveTab] = useState<AiChatScope>('full');

    // Get config for current tab
    const getCurrentTabConfig = () => {
        switch (activeTab) {
            case 'backend':
                return backendConfig;
            case 'frontend':
                return frontendConfig;
            case 'full':
                return fullConfig;
        }
    };

    const config = getCurrentTabConfig();

    // Handle provider change
    const handleProviderChange = useCallback((provider: AiChatProvider) => {
        // Reset model to first available for new provider
        const models = MODEL_OPTIONS[provider as LLMProvider] || [];
        const firstModel = models[0]?.id || '';
        updateScopeConfig(activeTab, { provider, model: firstModel });
    }, [activeTab, updateScopeConfig]);

    // Handle model change
    const handleModelChange = useCallback((model: string) => {
        updateScopeConfig(activeTab, { model });
    }, [activeTab, updateScopeConfig]);

    // Handle temperature change
    const handleTempChange = useCallback((temp: number) => {
        updateScopeConfig(activeTab, { temperature: Math.max(0, Math.min(2, temp)) });
    }, [activeTab, updateScopeConfig]);

    // Handle system prompt change
    const handlePromptChange = useCallback((systemPrompt: string) => {
        updateScopeConfig(activeTab, { systemPrompt });
    }, [activeTab, updateScopeConfig]);

    // Reset current scope to defaults
    const handleResetScope = useCallback(() => {
        updateScopeConfig(activeTab, {
            provider: 'gemini',
            model: 'gemini-2.5-flash',
            systemPrompt: DEFAULT_SYSTEM_PROMPTS[activeTab],
            temperature: activeTab === 'full' ? 0.2 : 0.3,
        });
    }, [activeTab, updateScopeConfig]);

    // Get models for current provider
    const models = MODEL_OPTIONS[config.provider as LLMProvider] || [];

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
            {/* Backdrop */}
            <div
                className="absolute inset-0 bg-black/50"
                onClick={() => setSettingsOpen(false)}
            />

            {/* Modal */}
            <div className="relative bg-white rounded-lg shadow-xl w-full max-w-lg mx-4 max-h-[80vh] overflow-hidden flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200">
                    <h2 className="text-lg font-semibold text-neutral-900">AI Chat Settings</h2>
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(false)}
                        className="p-1 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
                        aria-label="Close"
                    >
                        <CloseIcon className="h-5 w-5" />
                    </button>
                </div>

                {/* Scope Tabs */}
                <div className="flex border-b border-neutral-200">
                    {(['backend', 'frontend', 'full'] as AiChatScope[]).map((s) => (
                        <button
                            key={s}
                            type="button"
                            onClick={() => setActiveTab(s)}
                            className={[
                                'flex-1 px-4 py-2 text-sm font-medium transition-colors border-b-2',
                                activeTab === s
                                    ? 'text-primary-600 border-primary-500'
                                    : 'text-neutral-500 border-transparent hover:text-neutral-700 hover:bg-neutral-50',
                            ].join(' ')}
                        >
                            {SCOPE_LABELS[s]}
                        </button>
                    ))}
                </div>

                {/* Content */}
                <div className="flex-1 overflow-auto p-4 space-y-4">
                    {/* Provider */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                            AI Provider
                        </label>
                        <select
                            value={config.provider}
                            onChange={(e) => handleProviderChange(e.target.value as AiChatProvider)}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                        >
                            {PROVIDER_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Model */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                            Model
                        </label>
                        <select
                            value={config.model}
                            onChange={(e) => handleModelChange(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500"
                        >
                            {models.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {m.label}
                                </option>
                            ))}
                        </select>
                        {config.provider !== 'ollama' && (
                            <p className="mt-1 text-xs text-neutral-500">
                                API key configured in main Settings → API Keys
                            </p>
                        )}
                    </div>

                    {/* Temperature */}
                    <div>
                        <label className="block text-sm font-medium text-neutral-700 mb-1">
                            Temperature: {config.temperature.toFixed(1)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={config.temperature}
                            onChange={(e) => handleTempChange(parseFloat(e.target.value))}
                            className="w-full h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer"
                        />
                        <div className="flex justify-between text-xs text-neutral-500 mt-1">
                            <span>Precise (0)</span>
                            <span>Creative (2)</span>
                        </div>
                    </div>

                    {/* System Prompt */}
                    <div>
                        <div className="flex items-center justify-between mb-1">
                            <label className="block text-sm font-medium text-neutral-700">
                                System Prompt
                            </label>
                            <button
                                type="button"
                                onClick={handleResetScope}
                                className="text-xs text-primary-600 hover:text-primary-800"
                            >
                                Reset to default
                            </button>
                        </div>
                        <textarea
                            value={config.systemPrompt}
                            onChange={(e) => handlePromptChange(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md text-sm focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500 resize-none"
                            rows={8}
                            placeholder="Enter system instructions for this AI scope..."
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex justify-end gap-2 px-4 py-3 border-t border-neutral-200 bg-neutral-50">
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-neutral-700 bg-white border border-neutral-300 rounded-md hover:bg-neutral-50 transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={() => setSettingsOpen(false)}
                        className="px-4 py-2 text-sm font-medium text-white bg-primary-500 rounded-md hover:bg-primary-600 transition-colors"
                    >
                        Save
                    </button>
                </div>
            </div>
        </div>
    );
};

AiChatSettingsModal.displayName = 'AiChatSettingsModal';

export default AiChatSettingsModal;
