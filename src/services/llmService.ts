/**
 * llmService.ts
 * =============
 * Service for LLM API calls using the @google/genai SDK.
 * Supports Gemini 3 Flash and other Google Gemini models.
 * 
 * Updated for D079 (API Key Management) - now fetches API keys from .env via Tauri IPC.
 */

import { GoogleGenAI } from '@google/genai';
import { useSettingsStore } from '../stores/settingsStore';
import { useApiKeyStore } from '../stores/apiKeyStore';
import { generateWithOllama } from './ollamaService';

/**
 * Result of an LLM generation call.
 */
export interface LLMResult {
    success: boolean;
    text?: string | undefined;
    error?: string | undefined;
}

/**
 * Get the current settings from the store (non-reactive).
 */
function getSettings() {
    return useSettingsStore.getState();
}

/**
 * Get the active API key for a provider.
 * Uses the apiKeyStore which fetches from .env via Tauri IPC.
 */
async function getApiKey(provider: string): Promise<string | null> {
    const store = useApiKeyStore.getState();
    // Cast provider to ApiKeyService - validated at runtime via Tauri
    return store.getActiveKeyValue(provider as import('../stores/apiKeyStore').ApiKeyService);
}

/**
 * Generate text using the configured LLM.
 * @param prompt - The user prompt to send.
 * @returns LLMResult with success status and text or error.
 */
export async function generateText(prompt: string): Promise<LLMResult> {
    const { provider, model, temperature, systemPrompt } = getSettings();

    // Ollama doesn't require API key
    if (provider === 'ollama') {
        try {
            return await generateWithOllama(model, temperature, systemPrompt, prompt);
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown error occurred';
            return { success: false, error: message };
        }
    }

    // Get API key from .env via apiKeyStore
    const apiKey = await getApiKey(provider);

    if (!apiKey) {
        return {
            success: false,
            error: `No API key configured for ${provider}. Please add one in Settings > API Keys.`
        };
    }

    try {
        if (provider === 'gemini') {
            return await generateWithGemini(apiKey, model, temperature, systemPrompt, prompt);
        } else {
            // Placeholder for other providers (openai, anthropic)
            return { success: false, error: `Provider "${provider}" is not yet implemented.` };
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        return { success: false, error: message };
    }
}

/**
 * Generate text using Google Gemini via @google/genai SDK.
 */
async function generateWithGemini(
    apiKey: string,
    modelId: string,
    temperature: number,
    systemPrompt: string,
    userPrompt: string
): Promise<LLMResult> {
    // Initialize the GoogleGenAI client with the API key
    const ai = new GoogleGenAI({ apiKey });

    // Log the request for debugging
    console.log(`[LLM Service] Sending request to Gemini (${modelId})`);
    console.log(`[LLM Service] System Prompt:`, systemPrompt);
    console.log(`[LLM Service] User Prompt:`, userPrompt);

    // Generate content using the new SDK pattern
    const response = await ai.models.generateContent({
        model: modelId,
        contents: userPrompt,
        config: {
            systemInstruction: systemPrompt,
            temperature,
        },
    });

    // Extract text from response
    const text = response.text;
    console.log(`[LLM Service] Received response length: ${text?.length} chars`);

    return { success: true, text };
}

/**
 * Test the LLM connection with a simple prompt.
 * @returns LLMResult indicating success or failure.
 */
export async function testConnection(): Promise<LLMResult> {
    return generateText('Say "Connection successful!" in exactly those words.');
}
