/**
 * SettingsPanel.tsx
 * =================
 * Slide-over panel for configuring LLM and application settings.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSettingsStore, MODEL_OPTIONS, type LLMProvider } from '../../stores/settingsStore';
import { testConnection } from '../../services/llmService';
import { listLocalModels } from '../../services/ollamaService';
import { ApiKeyManager } from './ApiKeyManager';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Provider options for the dropdown.
 */
const PROVIDER_OPTIONS: { id: LLMProvider; label: string }[] = [
    { id: 'gemini', label: 'Google Gemini' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'anthropic', label: 'Anthropic' },
    { id: 'ollama', label: 'Ollama (Local)' },
];

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
    // Settings store
    const {
        provider,
        model,
        temperature,
        systemPrompt,
        ollamaModels,
        setProvider,
        setModel,
        setTemperature,
        setSystemPrompt,
        setOllamaModels,
    } = useSettingsStore();

    // Local state for test connection
    const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'error'>('idle');
    const [testMessage, setTestMessage] = useState('');
    const [isLoadingModels, setIsLoadingModels] = useState(false);

    // Fetch Ollama models when provider is ollama
    useEffect(() => {
        if (provider === 'ollama' && isOpen) {
            const fetchModels = async () => {
                setIsLoadingModels(true);
                const models = await listLocalModels();
                setOllamaModels(models);
                setIsLoadingModels(false);

                // Auto-select first model if current model is not valid
                if (models.length > 0 && !models.includes(model)) {
                    setModel(models[0]);
                }
            };

            fetchModels();
        }
    }, [provider, isOpen, setOllamaModels, setModel, model]);

    // Get available models for current provider
    const availableModels = provider === 'ollama'
        ? ollamaModels.map(m => ({ id: m, label: m }))
        : MODEL_OPTIONS[provider] || [];

    // Handlers
    const handleProviderChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            setProvider(e.target.value as LLMProvider);
        },
        [setProvider]
    );

    const handleModelChange = useCallback(
        (e: React.ChangeEvent<HTMLSelectElement>) => {
            setModel(e.target.value);
        },
        [setModel]
    );

    const handleTemperatureChange = useCallback(
        (e: React.ChangeEvent<HTMLInputElement>) => {
            const value = parseFloat(e.target.value);
            if (!isNaN(value)) {
                setTemperature(value);
            }
        },
        [setTemperature]
    );

    const handleTestConnection = useCallback(async () => {
        setTestStatus('testing');
        setTestMessage('');

        const result = await testConnection();

        if (result.success) {
            setTestStatus('success');
            setTestMessage(result.text || 'Connection successful!');
        } else {
            setTestStatus('error');
            setTestMessage(result.error || 'Connection failed.');
        }
    }, []);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                    <h2 className="text-lg font-semibold text-neutral-900">Settings</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* LLM Provider */}
                    <div>
                        <label htmlFor="provider" className="block text-sm font-medium text-neutral-700 mb-1">
                            LLM Provider
                        </label>
                        <select
                            id="provider"
                            value={provider}
                            onChange={handleProviderChange}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                        >
                            {PROVIDER_OPTIONS.map((opt) => (
                                <option key={opt.id} value={opt.id}>
                                    {opt.label}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* API Keys Manager (D079) */}
                    <ApiKeyManager />

                    {/* LLM Model */}
                    <div>
                        <label htmlFor="model" className="block text-sm font-medium text-neutral-700 mb-1">
                            Model
                            {isLoadingModels && <span className="ml-2 text-xs text-primary-500 font-normal">Loading available models...</span>}
                        </label>
                        <select
                            id="model"
                            value={model}
                            onChange={handleModelChange}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors"
                        >
                            {availableModels.length === 0 && provider === 'ollama' ? (
                                <option value="" disabled>No models found or ensure Ollama is running</option>
                            ) : (
                                availableModels.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </option>
                                ))
                            )}
                        </select>
                        {provider === 'ollama' && availableModels.length === 0 && !isLoadingModels && (
                            <p className="mt-1 text-xs text-red-500">
                                Ensure Ollama is running at http://localhost:11434
                            </p>
                        )}
                    </div>

                    {/* Temperature */}
                    <div>
                        <label htmlFor="temperature" className="block text-sm font-medium text-neutral-700 mb-1">
                            Temperature
                        </label>
                        <div className="flex items-center gap-3">
                            <input
                                id="temperature"
                                type="range"
                                min="0"
                                max="2"
                                step="0.1"
                                value={temperature}
                                onChange={handleTemperatureChange}
                                className="flex-1 h-2 bg-neutral-200 rounded-lg appearance-none cursor-pointer accent-primary-500"
                            />
                            <span className="w-12 text-center text-sm font-mono text-neutral-700">
                                {temperature.toFixed(1)}
                            </span>
                        </div>
                        <p className="mt-1 text-xs text-neutral-500">
                            0.0 = deterministic, 2.0 = highly creative
                        </p>
                    </div>

                    {/* System Prompt */}
                    <div>
                        <label htmlFor="systemPrompt" className="block text-sm font-medium text-neutral-700 mb-1">
                            System Prompt
                        </label>
                        <textarea
                            id="systemPrompt"
                            value={systemPrompt}
                            onChange={(e) => setSystemPrompt(e.target.value)}
                            rows={4}
                            placeholder="Enter system instructions for the AI..."
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none"
                        />
                    </div>

                    {/* Test Connection */}
                    <div className="pt-4 border-t border-neutral-200">
                        <button
                            type="button"
                            onClick={handleTestConnection}
                            disabled={testStatus === 'testing'}
                            className="w-full flex items-center justify-center gap-2 px-4 py-2 bg-neutral-100 text-neutral-700 font-medium rounded-lg hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                        >
                            {testStatus === 'testing' ? (
                                <>
                                    <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
                                        <circle
                                            className="opacity-25"
                                            cx="12"
                                            cy="12"
                                            r="10"
                                            stroke="currentColor"
                                            strokeWidth="4"
                                        />
                                        <path
                                            className="opacity-75"
                                            fill="currentColor"
                                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                                        />
                                    </svg>
                                    Testing...
                                </>
                            ) : (
                                <>
                                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                                        <polyline points="22 4 12 14.01 9 11.01" />
                                    </svg>
                                    Test Connection
                                </>
                            )}
                        </button>

                        {testStatus !== 'idle' && testStatus !== 'testing' && (
                            <div
                                className={`mt-3 p-3 rounded-lg text-sm ${testStatus === 'success'
                                    ? 'bg-green-50 text-green-800 border border-green-200'
                                    : 'bg-red-50 text-red-800 border border-red-200'
                                    }`}
                            >
                                {testMessage}
                            </div>
                        )}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>
        </>
    );
};
