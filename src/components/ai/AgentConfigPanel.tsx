/**
 * AgentConfigPanel.tsx
 * ====================
 * Collapsible accordion panel for configuring individual agents.
 * 
 * Features:
 * - Agent enable/disable toggle in header
 * - LLM Provider dropdown (integrates with ApiKeyManager)
 * - LLM Model selection
 * - Temperature slider
 * - System prompt editor
 * - Tools toggle section
 * - Config validation with inline errors
 * 
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 */

import React, { useState, useCallback, useMemo } from 'react';
import { useAiTeamStore, type AgentConfiguration } from '../../stores/aiTeamStore';
import { validateAgentConfig, type ApiKeyInfo } from './ConfigValidator';
import { MODEL_OPTIONS } from '../../stores/settingsStore';

// Provider options matching SettingsPanel
const PROVIDER_OPTIONS = [
    { id: 'gemini', label: 'Google Gemini' },
    { id: 'openai', label: 'OpenAI' },
    { id: 'anthropic', label: 'Anthropic' },
    { id: 'ollama', label: 'Ollama (Local)' },
];

interface AgentConfigAccordionProps {
    agent: AgentConfiguration;
    apiKeys: ApiKeyInfo[];
    isExpanded: boolean;
    onToggleExpand: () => void;
    disabled?: boolean;
}

/**
 * Single agent configuration accordion item.
 */
const AgentConfigAccordion: React.FC<AgentConfigAccordionProps> = ({
    agent,
    apiKeys,
    isExpanded,
    onToggleExpand,
    disabled = false,
}) => {
    const {
        updateAgentConfig,
        toggleAgent,
        toggleAgentTool,
        isWorkflowRunning,
        saveConfigToDisk,
    } = useAiTeamStore();

    // Validate current config
    const validation = useMemo(() =>
        validateAgentConfig(agent, apiKeys),
        [agent, apiKeys]
    );

    const isDisabled = disabled || isWorkflowRunning;

    // Get available models for selected provider
    const availableModels = useMemo(() => {
        const models = MODEL_OPTIONS[agent.provider as keyof typeof MODEL_OPTIONS];
        return models || [];
    }, [agent.provider]);

    // Handlers - each saves after update
    const handleToggleEnabled = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        if (!isDisabled) {
            toggleAgent(agent.id, e.target.checked);
            saveConfigToDisk();
        }
    }, [agent.id, toggleAgent, isDisabled, saveConfigToDisk]);

    const handleProviderChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        updateAgentConfig(agent.id, { provider: e.target.value });
        saveConfigToDisk();
    }, [agent.id, updateAgentConfig, saveConfigToDisk]);

    const handleModelChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        updateAgentConfig(agent.id, { model: e.target.value });
        saveConfigToDisk();
    }, [agent.id, updateAgentConfig, saveConfigToDisk]);

    const handleTemperatureChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const value = parseFloat(e.target.value);
        if (!isNaN(value)) {
            updateAgentConfig(agent.id, { temperature: value });
            // Note: Not saving on every slider move to avoid excessive writes
            // Could add debouncing or save on mouse up for production
        }
    }, [agent.id, updateAgentConfig]);

    const handlePromptChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
        updateAgentConfig(agent.id, { systemPrompt: e.target.value });
        // Note: Not saving on every keystroke to avoid excessive writes
        // Could add debouncing or save on blur for production
    }, [agent.id, updateAgentConfig]);

    const handleToolToggle = useCallback((toolId: string, enabled: boolean) => {
        toggleAgentTool(agent.id, toolId, enabled);
        saveConfigToDisk();
    }, [agent.id, toggleAgentTool, saveConfigToDisk]);

    return (
        <div className={`
            border rounded-lg overflow-hidden transition-colors
            ${agent.enabled
                ? 'border-neutral-600 bg-neutral-800/50'
                : 'border-neutral-700 bg-neutral-900/50 opacity-60'
            }
        `}>
            {/* Header */}
            <div
                className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-neutral-700/30 transition-colors"
                onClick={onToggleExpand}
            >
                <div className="flex items-center gap-3">
                    {/* Expand/Collapse Icon */}
                    <svg
                        className={`w-4 h-4 text-neutral-400 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="2"
                    >
                        <polyline points="9 18 15 12 9 6" />
                    </svg>

                    {/* Agent Name */}
                    <span className={`font-medium ${agent.enabled ? 'text-neutral-100' : 'text-neutral-400'}`}>
                        {agent.name}
                    </span>

                    {/* Validation indicator */}
                    {agent.enabled && !validation.valid && (
                        <span className="text-xs text-red-400 flex items-center gap-1">
                            <svg className="w-3 h-3" viewBox="0 0 24 24" fill="currentColor">
                                <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
                            </svg>
                            Config error
                        </span>
                    )}
                </div>

                {/* Enable/Disable Toggle */}
                <label
                    className="relative inline-flex items-center cursor-pointer"
                    onClick={(e) => e.stopPropagation()}
                >
                    <input
                        type="checkbox"
                        checked={agent.enabled}
                        onChange={handleToggleEnabled}
                        disabled={isDisabled}
                        className="sr-only peer"
                    />
                    <div className={`
                        w-9 h-5 bg-neutral-700 rounded-full peer 
                        peer-checked:bg-primary-500
                        peer-disabled:opacity-50 peer-disabled:cursor-not-allowed
                        after:content-[''] after:absolute after:top-0.5 after:left-[2px] 
                        after:bg-white after:rounded-full after:h-4 after:w-4 
                        after:transition-all peer-checked:after:translate-x-full
                    `} />
                </label>
            </div>

            {/* Expandable Content */}
            {isExpanded && agent.enabled && (
                <div className="px-4 pb-4 space-y-4 border-t border-neutral-700">
                    {/* Validation Errors */}
                    {!validation.valid && (
                        <div className="mt-3 p-2 bg-red-900/30 border border-red-700/50 rounded text-xs text-red-300">
                            <ul className="list-disc list-inside space-y-1">
                                {validation.errors.map((error, i) => (
                                    <li key={i}>{error}</li>
                                ))}
                            </ul>
                        </div>
                    )}

                    {/* LLM Provider */}
                    <div className="mt-3">
                        <label className="block text-xs font-medium text-neutral-400 mb-1">
                            LLM Provider
                        </label>
                        <select
                            value={agent.provider}
                            onChange={handleProviderChange}
                            disabled={isDisabled}
                            className="w-full px-2 py-1.5 text-sm bg-neutral-900 border border-neutral-600 rounded text-neutral-100 focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
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
                        <label className="block text-xs font-medium text-neutral-400 mb-1">
                            Model
                        </label>
                        <select
                            value={agent.model}
                            onChange={handleModelChange}
                            disabled={isDisabled}
                            className="w-full px-2 py-1.5 text-sm bg-neutral-900 border border-neutral-600 rounded text-neutral-100 focus:ring-1 focus:ring-primary-500 disabled:opacity-50"
                        >
                            {availableModels.length > 0 ? (
                                availableModels.map((opt) => (
                                    <option key={opt.id} value={opt.id}>
                                        {opt.label}
                                    </option>
                                ))
                            ) : (
                                <option value={agent.model}>{agent.model}</option>
                            )}
                        </select>
                    </div>

                    {/* Temperature */}
                    <div>
                        <label className="block text-xs font-medium text-neutral-400 mb-1">
                            Temperature: {agent.temperature.toFixed(1)}
                        </label>
                        <input
                            type="range"
                            min="0"
                            max="2"
                            step="0.1"
                            value={agent.temperature}
                            onChange={handleTemperatureChange}
                            disabled={isDisabled}
                            className="w-full h-1.5 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-primary-500 disabled:opacity-50"
                        />
                    </div>

                    {/* System Prompt (collapsed by default) */}
                    <details className="group">
                        <summary className="text-xs font-medium text-neutral-400 cursor-pointer hover:text-neutral-300 flex items-center gap-1">
                            <svg className="w-3 h-3 transition-transform group-open:rotate-90" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <polyline points="9 18 15 12 9 6" />
                            </svg>
                            System Prompt
                        </summary>
                        <textarea
                            value={agent.systemPrompt}
                            onChange={handlePromptChange}
                            disabled={isDisabled}
                            rows={4}
                            className="mt-2 w-full px-2 py-1.5 text-xs bg-neutral-900 border border-neutral-600 rounded text-neutral-100 focus:ring-1 focus:ring-primary-500 disabled:opacity-50 resize-none"
                            placeholder="Enter system instructions..."
                        />
                    </details>

                    {/* Tools */}
                    {agent.tools.length > 0 && (
                        <div>
                            <label className="block text-xs font-medium text-neutral-400 mb-2">
                                Tools
                            </label>
                            <div className="space-y-2">
                                {agent.tools.map((tool) => (
                                    <label
                                        key={tool.id}
                                        className="flex items-center gap-2 text-sm text-neutral-300 cursor-pointer"
                                    >
                                        <input
                                            type="checkbox"
                                            checked={tool.enabled}
                                            onChange={(e) => handleToolToggle(tool.id, e.target.checked)}
                                            disabled={isDisabled}
                                            className="w-4 h-4 rounded border-neutral-600 bg-neutral-800 text-primary-500 focus:ring-primary-500 disabled:opacity-50"
                                        />
                                        {tool.name}
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface AgentConfigPanelProps {
    className?: string;
    /** API keys from ApiKeyManager for validation */
    apiKeys?: ApiKeyInfo[];
}

/**
 * Right panel containing all agent configuration accordions.
 */
export const AgentConfigPanel: React.FC<AgentConfigPanelProps> = ({
    className = '',
    apiKeys = [],
}) => {
    const { agentConfigs } = useAiTeamStore();

    // Track which agent is expanded
    const [expandedAgentId, setExpandedAgentId] = useState<string | null>('orchestrator');

    const handleToggleExpand = useCallback((agentId: string) => {
        setExpandedAgentId((current) => current === agentId ? null : agentId);
    }, []);

    return (
        <div className={`h-full flex flex-col bg-neutral-900 ${className}`}>
            {/* Header */}
            <div className="px-4 py-3 border-b border-neutral-700">
                <h3 className="text-sm font-semibold text-neutral-100">Agent Configuration</h3>
                <p className="text-xs text-neutral-500 mt-0.5">Configure LLM and tools for each agent</p>
            </div>

            {/* Scrollable list of agents */}
            <div className="flex-1 overflow-y-auto p-3 space-y-2 custom-scrollbar">
                {agentConfigs.map((agent) => (
                    <AgentConfigAccordion
                        key={agent.id}
                        agent={agent}
                        apiKeys={apiKeys}
                        isExpanded={expandedAgentId === agent.id}
                        onToggleExpand={() => handleToggleExpand(agent.id)}
                    />
                ))}
            </div>
        </div>
    );
};

AgentConfigPanel.displayName = 'AgentConfigPanel';

export default AgentConfigPanel;
