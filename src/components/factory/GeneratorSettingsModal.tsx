/**
 * GeneratorSettingsModal.tsx
 * ===========================
 * Settings modal for AI Component Generator.
 * Contains LLM configuration (Provider, Model, Temperature, System Prompt).
 * 
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useSettingsStore, MODEL_OPTIONS, type LLMProvider } from '../../stores/settingsStore';
import { testConnection } from '../../services/llmService';
import { listLocalModels } from '../../services/ollamaService';

interface GeneratorSettingsModalProps {
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

/**
 * Close icon.
 */
const CloseIcon: React.FC = () => (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="18" y1="6" x2="6" y2="18" />
        <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
);

export const GeneratorSettingsModal: React.FC<GeneratorSettingsModalProps> = ({ isOpen, onClose }) => {
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

    // Local state for system prompt editing
    const [localSystemPrompt, setLocalSystemPrompt] = useState(systemPrompt);
    const [promptSaved, setPromptSaved] = useState(true);

    // Default system prompt for Component Generator
    const DEFAULT_SYSTEM_PROMPT = `You are a strict code compiler. Return ONLY valid React/Tailwind code.

CRITICAL INSTRUCTIONS:
1. OUTPUT FORMAT: Return ONLY the raw component code. NO markdown fences, NO explanations, NO imports, NO comments.
2. ACCURACY: Implement EXACTLY what is requested. DO NOT hallucinate features.
3. NEGATIVE CONSTRAINTS (DO NOT DO):
   - DO NOT add background colors unless requested.
   - DO NOT add filler text (Lorem Ipsum) unless requested.
   - DO NOT add extra padding/margins unless necessary for layout.
   - DO NOT wrap the component in a centered div (the previewer handles centering).

ANIMATION RULES (Exact Implementation):
- "jelly" / "bouncy" -> YOU MUST USE: transition-transform duration-300 ease-[cubic-bezier(0.68,-0.55,0.265,1.55)] hover:scale-110 active:scale-90
- "spin" -> transition-transform duration-700 ease-in-out hover:rotate-[360deg]
- "squishy" -> transition-all duration-200 hover:scale-x-125 hover:scale-y-75 active:scale-x-75 active:scale-y-125

STYLING:
- Use Tailwind CSS for EVERYTHING.
- For "modern" look: use 'ring-1 ring-white/10' for borders in dark mode if needed.
- Interactive elements MUST have 'focus:ring-2 focus:outline-none'.

BROWNFIELD PATTERNS (MANDATORY overrides):
- If user says "HEXAGON" -> className="aspect-square bg-primary-500 [clip-path:polygon(25%_0%,75%_0%,100%_50%,75%_100%,25%_100%,0%_50%)]"
- If user says "SPARKLES" -> Use a wrapper div with 'relative'. Add absolute positioned spans for 'sparkles' with 'animate-ping' or 'animate-pulse'.
- If user says "NEOMORPHIC" -> DO NOT use 'shadow-lg'. YOU MUST USE: shadow-[6px_6px_10px_0px_rgba(0,0,0,0.1),-6px_-6px_10px_0px_rgba(255,255,255,0.8)]

FINAL CHECK:
- Did you add a background color? If user didn't ask, REMOVE IT.
- Did you add text inside the button? If user didn't ask, make it empty.`;

    // Sync local prompt with store when modal opens
    useEffect(() => {
        if (isOpen) {
            setLocalSystemPrompt(systemPrompt);
            setPromptSaved(true);
        }
    }, [isOpen, systemPrompt]);

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
                    setModel(models[0] ?? model);
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

    // Handle system prompt change (local only)
    const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        setLocalSystemPrompt(e.target.value);
        setPromptSaved(false);
    }, []);

    // Save system prompt to store
    const handleSavePrompt = useCallback(() => {
        setSystemPrompt(localSystemPrompt);
        setPromptSaved(true);
    }, [localSystemPrompt, setSystemPrompt]);

    // Load default system prompt
    const handleLoadDefault = useCallback(() => {
        setLocalSystemPrompt(DEFAULT_SYSTEM_PROMPT);
        setPromptSaved(false);
    }, [DEFAULT_SYSTEM_PROMPT]);

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-50 transition-opacity"
                onClick={onClose}
            />

            {/* Modal */}
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
                <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] flex flex-col pointer-events-auto">
                    {/* Header */}
                    <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                        <h2 className="text-lg font-semibold text-neutral-900">Generator Settings</h2>
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-2 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                        >
                            <CloseIcon />
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
                            <div className="flex items-center justify-between mb-1">
                                <label htmlFor="systemPrompt" className="block text-sm font-medium text-neutral-700">
                                    System Prompt
                                </label>
                                <button
                                    type="button"
                                    onClick={handleLoadDefault}
                                    className="text-xs text-primary-600 hover:text-primary-700 font-medium"
                                >
                                    Load Default
                                </button>
                            </div>
                            <textarea
                                id="systemPrompt"
                                value={localSystemPrompt}
                                onChange={handlePromptChange}
                                rows={6}
                                placeholder="Enter system instructions for the AI..."
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-colors resize-none text-sm"
                            />
                            <div className="flex items-center justify-between mt-2">
                                <span className={`text-xs ${promptSaved ? 'text-green-600' : 'text-amber-600'}`}>
                                    {promptSaved ? '✓ Saved' : '• Unsaved changes'}
                                </span>
                                <button
                                    type="button"
                                    onClick={handleSavePrompt}
                                    disabled={promptSaved}
                                    className="px-3 py-1 text-sm font-medium text-white bg-primary-500 rounded-md hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                    Save Prompt
                                </button>
                            </div>
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
            </div>
        </>
    );
};

GeneratorSettingsModal.displayName = 'GeneratorSettingsModal';

export default GeneratorSettingsModal;
