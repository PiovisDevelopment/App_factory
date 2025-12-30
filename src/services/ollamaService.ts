/**
 * ollamaService.ts
 * ================
 * Service for interacting with the local Ollama instance.
 * Uses the official 'ollama' SDK.
 */

import ollama from 'ollama/browser';
import { LLMResult } from './llmService';

/**
 * List all models installed on the local Ollama instance.
 * @returns Array of model names (e.g., 'llama3.2', 'mistral')
 */
export async function listLocalModels(): Promise<string[]> {
    try {
        const response = await ollama.list();
        return response.models.map((m) => m.name);
    } catch (error) {
        console.error('Failed to list Ollama models:', error);
        return [];
    }
}

/**
 * Generate text using a local Ollama model.
 * @param modelId - The model to use (e.g., 'llama3.2')
 * @param temperature - Temperature setting
 * @param systemPrompt - System instruction
 * @param userPrompt - User's message
 */
export async function generateWithOllama(
    modelId: string,
    temperature: number,
    systemPrompt: string,
    userPrompt: string
): Promise<LLMResult> {
    try {
        const response = await ollama.chat({
            model: modelId,
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userPrompt },
            ],
            options: {
                temperature,
            },
        });

        return { success: true, text: response.message.content };
    } catch (error) {
        const message = error instanceof Error ? error.message : 'Unknown Ollama error';
        return { success: false, error: `Ollama Error: ${message}` };
    }
}

/**
 * Test connectivity to the local Ollama instance.
 */
export async function testOllamaConnection(): Promise<LLMResult> {
    try {
        await ollama.list();
        return { success: true, text: 'Ollama is running and accessible.' };
    } catch (error) {
        return {
            success: false,
            error: 'Could not connect to Ollama. Make sure it is running at http://localhost:11434',
        };
    }
}
