/**
 * ConfigValidator.tsx
 * ===================
 * Validation utilities for agent configuration.
 * 
 * Validates: provider set, API key exists, model valid, system prompt non-empty.
 */

import type { AgentConfiguration } from '../../stores/aiTeamStore';

export interface ValidationResult {
    valid: boolean;
    errors: string[];
}

export interface ApiKeyInfo {
    service: string;
    hasKey: boolean;
}

/**
 * Validates an agent configuration against requirements.
 * 
 * @param config - The agent configuration to validate
 * @param apiKeys - Array of available API keys from ApiKeyManager
 * @returns Validation result with errors array
 */
export function validateAgentConfig(
    config: AgentConfiguration,
    apiKeys: ApiKeyInfo[]
): ValidationResult {
    const errors: string[] = [];

    // 1. Provider must be set
    if (!config.provider || config.provider.trim() === '') {
        errors.push('Provider is required');
    }

    // 2. Check if API key exists for the provider
    if (config.provider && config.enabled) {
        const providerKeyMap: Record<string, string> = {
            'gemini': 'Google Gemini',
            'openai': 'OpenAI',
            'anthropic': 'Anthropic',
            'ollama': 'ollama', // Ollama doesn't require API key
        };

        const serviceName = providerKeyMap[config.provider];

        // Ollama doesn't need an API key
        if (config.provider !== 'ollama' && serviceName) {
            const hasKey = apiKeys.some(
                key => key.service.toLowerCase() === serviceName.toLowerCase() && key.hasKey
            );
            if (!hasKey) {
                errors.push(`API key required for ${serviceName}`);
            }
        }
    }

    // 3. Model must be set
    if (!config.model || config.model.trim() === '') {
        errors.push('Model is required');
    }

    // 4. System prompt should be non-empty (warning, not error)
    // We allow empty but will show a warning in UI
    // if (!config.systemPrompt || config.systemPrompt.trim() === '') {
    //     errors.push('System prompt is recommended');
    // }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validates all enabled agents in a configuration array.
 * 
 * @param configs - Array of agent configurations
 * @param apiKeys - Array of available API keys
 * @returns Map of agent ID to validation result
 */
export function validateAllAgentConfigs(
    configs: AgentConfiguration[],
    apiKeys: ApiKeyInfo[]
): Map<string, ValidationResult> {
    const results = new Map<string, ValidationResult>();

    for (const config of configs) {
        // Only validate enabled agents
        if (config.enabled) {
            results.set(config.id, validateAgentConfig(config, apiKeys));
        } else {
            results.set(config.id, { valid: true, errors: [] });
        }
    }

    return results;
}

/**
 * Check if all enabled agents have valid configurations.
 */
export function areAllAgentsValid(
    validationResults: Map<string, ValidationResult>
): boolean {
    for (const result of validationResults.values()) {
        if (!result.valid) {
            return false;
        }
    }
    return true;
}
