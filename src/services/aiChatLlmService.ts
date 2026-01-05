/**
 * aiChatLlmService.ts
 * ===================
 * Multi-LLM instance service for AI App Chat feature.
 * Supports concurrent LLM instances with per-scope configurations.
 * 
 * Architecture: Extends existing llmService pattern to support
 * multiple independent LLM configurations (Backend/Frontend/Full scopes).
 */

import { GoogleGenAI } from '@google/genai';
import { useApiKeyStore, type ApiKeyService } from '../stores/apiKeyStore';
import { generateWithOllama } from './ollamaService';
import type { LLMResult } from './llmService';
import Anthropic from '@anthropic-ai/sdk';

/**
 * Supported LLM providers for AI Chat.
 */
export type AiChatProvider = 'gemini' | 'openai' | 'anthropic' | 'ollama';

/**
 * Configuration for a single LLM instance.
 */
export interface LLMInstanceConfig {
    /** LLM provider */
    provider: AiChatProvider;
    /** Model ID (e.g., 'gemini-2.5-flash', 'llama3.2') */
    model: string;
    /** API key ID from apiKeyStore (empty for Ollama) */
    apiKeyId: string;
    /** System prompt for this instance */
    systemPrompt: string;
    /** Temperature (0-2) */
    temperature: number;
}

/**
 * Chat message structure for conversation history.
 */
export interface ChatMessage {
    id: string;
    role: 'user' | 'assistant' | 'system';
    content: string;
    timestamp: Date;
    scope?: 'backend' | 'frontend' | 'full';
    /** Base64 encoded images (raw or data URI) */
    images?: string[];
}

/**
 * Get API key value for a provider from the apiKeyStore.
 */
async function getApiKeyValue(provider: AiChatProvider): Promise<string | null> {
    if (provider === 'ollama') {
        return null; // Ollama doesn't need API key
    }
    const store = useApiKeyStore.getState();
    return store.getActiveKeyValue(provider as ApiKeyService);
}

/**
 * Generate text using Google Gemini with specific config.
 */
async function generateWithGeminiConfig(
    apiKey: string,
    config: LLMInstanceConfig,
    prompt: string,
    conversationHistory?: ChatMessage[],
    images?: string[]
): Promise<LLMResult> {
    const ai = new GoogleGenAI({ apiKey });

    // Helper to strip data URI header from base64
    const stripBase64Header = (img: string) => img.replace(/^data:image\/\w+;base64,/, '');

    // Build current user message parts
    const currentParts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [
        { text: prompt }
    ];

    // Add images if provided (for multimodal Vision models)
    if (images && images.length > 0) {
        images.forEach(img => {
            currentParts.push({
                inlineData: {
                    mimeType: 'image/png',
                    data: stripBase64Header(img)
                }
            });
        });
    }

    // Build conversation contents if history provided
    type ContentPart = { text: string } | { inlineData: { mimeType: string; data: string } };
    type ContentMessage = { role: string; parts: ContentPart[] };
    let contents: string | ContentMessage[];

    if (conversationHistory && conversationHistory.length > 0) {
        contents = conversationHistory.map(msg => ({
            role: msg.role === 'assistant' ? 'model' : msg.role,
            parts: [{ text: msg.content }]
        }));
        // Add current user message with text and images
        contents.push({
            role: 'user',
            parts: currentParts
        });
    } else {
        // Single message with potential images
        contents = [{
            role: 'user',
            parts: currentParts
        }];
    }

    const response = await ai.models.generateContent({
        model: config.model,
        contents,
        config: {
            systemInstruction: config.systemPrompt,
            temperature: config.temperature,
        },
    });

    return { success: true, text: response.text };
}

/**
 * Generate text using Anthropic with specific config.
 */
async function generateWithAnthropicConfig(
    apiKey: string,
    config: LLMInstanceConfig,
    prompt: string,
    conversationHistory?: ChatMessage[],
    images?: string[]
): Promise<LLMResult> {
    const anthropic = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

    const messages: Anthropic.MessageParam[] = [];

    // Add history
    if (conversationHistory && conversationHistory.length > 0) {
        conversationHistory.forEach(msg => {
            if (msg.role === 'user' || msg.role === 'assistant') {
                messages.push({
                    role: msg.role,
                    content: msg.content
                });
            }
        });
    }

    // Prepare current message content
    const currentContent: Anthropic.ContentBlockParam[] = [];

    // Add images if present
    if (images && images.length > 0) {
        images.forEach(img => {
            // Strip header if present
            const base64Data = img.replace(/^data:image\/\w+;base64,/, '');
            currentContent.push({
                type: 'image',
                source: {
                    type: 'base64',
                    media_type: 'image/png', // Assuming PNG from html2canvas
                    data: base64Data
                }
            });
        });
    }

    // Add text prompt
    currentContent.push({ type: 'text', text: prompt });

    messages.push({
        role: 'user',
        content: currentContent
    });

    const response = await anthropic.messages.create({
        model: config.model || 'claude-3-opus-20240229',
        max_tokens: 4096,
        messages,
        system: config.systemPrompt,
        temperature: config.temperature,
    });

    // Extract text from response
    const textContent = response.content.find(c => c.type === 'text');
    return {
        success: true,
        text: textContent?.type === 'text' ? textContent.text : ''
    };
}

/**
 * Generate text using a specific LLM configuration.
 * Does NOT use global settings - uses provided config only.
 * 
 * @param config - The LLM instance configuration
 * @param prompt - User prompt to send
 * @param conversationHistory - Optional conversation history for context
 * @returns LLMResult with success status and text or error
 */
export async function generateWithConfig(
    config: LLMInstanceConfig,
    prompt: string,
    conversationHistory?: ChatMessage[],
    images?: string[]
): Promise<LLMResult> {
    // Handle Ollama separately (no API key needed)
    if (config.provider === 'ollama') {
        try {
            return await generateWithOllama(
                config.model,
                config.temperature,
                config.systemPrompt,
                prompt,
                images
            );
        } catch (err) {
            const message = err instanceof Error ? err.message : 'Unknown Ollama error';
            return { success: false, error: message };
        }
    }

    // Get API key for the provider
    const apiKey = await getApiKeyValue(config.provider);

    if (!apiKey) {
        return {
            success: false,
            error: `No API key configured for ${config.provider}. Please add one in AI Chat Settings.`
        };
    }

    try {
        if (config.provider === 'gemini') {
            return await generateWithGeminiConfig(apiKey, config, prompt, conversationHistory, images);
        } else if (config.provider === 'anthropic') {
            return await generateWithAnthropicConfig(apiKey, config, prompt, conversationHistory, images);
        } else {
            // Placeholder for OpenAI
            // TODO: Implement when needed
            return {
                success: false,
                error: `Provider "${config.provider}" is not yet implemented.`
            };
        }
    } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown error occurred';
        return { success: false, error: message };
    }
}

/**
 * Generate text from multiple LLM instances concurrently.
 * Useful for orchestration (Full scope) where multiple AIs collaborate.
 * 
 * @param configs - Array of LLM configurations
 * @param prompt - User prompt to send to all instances
 * @returns Array of LLMResult in same order as configs
 */
export async function generateConcurrent(
    configs: LLMInstanceConfig[],
    prompt: string
): Promise<LLMResult[]> {
    const promises = configs.map(config => generateWithConfig(config, prompt));
    return Promise.all(promises);
}

/**
 * Test connection for a specific LLM configuration.
 */
export async function testConfigConnection(config: LLMInstanceConfig): Promise<LLMResult> {
    return generateWithConfig(
        config,
        'Respond with exactly: "Connection successful!"'
    );
}

/**
 * Default system prompts for each scope.
 */
export const DEFAULT_SYSTEM_PROMPTS = {
    backend: `You are a Backend AI expert for the App Factory.
Your scope: Plugins, services, contracts, configurations.
Rules:
- Use documented brownfield solutions from existing plugins
- Follow hotswappable plugin architecture patterns
- You CANNOT modify App Factory code - only loaded app files
- In Chat mode: Analyze and answer questions only
- In Change mode: Follow debugging-workflow (plan → approval → execute)`,

    frontend: `You are a Frontend UI expert following Apple Human Interface Guidelines (HIG).
Your scope: Canvas elements, themes, window config, FE component library.

CRITICAL: To modify canvas elements, you MUST use the EXACT element ID from CANVAS_CONTEXT.
Element IDs look like "element-1735934876543" - copy them EXACTLY, do not invent names.

Output format for changes:
\`\`\`json
{
  "changes": [
    {"elementId": "element-COPY_EXACT_ID_FROM_CONTEXT", "code": "const ComponentName = () => { return <div>...</div>; }"}
  ],
  "explanation": "Description of changes made"
}
\`\`\`

Rules:
- ALWAYS copy the exact elementId from the CANVAS_CONTEXT block
- Generate complete, self-contained React functional components
- Use Tailwind classes for styling
- In Chat mode: Analyze and answer questions only
- In Change mode: Output JSON with changes array`,

    full: `You are an Architect AI orchestrating Frontend and Backend solutions.
Your role: Coordinate between FE and BE scopes to create end-to-end solutions.
Your scope: All loaded app resources.

CRITICAL: To modify canvas elements, you MUST use the EXACT element ID from CANVAS_CONTEXT.
Element IDs look like "element-1735934876543" - copy them EXACTLY, do not invent names.

Output format for changes:
\`\`\`json
{
  "changes": [
    {"elementId": "element-COPY_EXACT_ID_FROM_CONTEXT", "code": "const ComponentName = () => { return <div>...</div>; }"}
  ],
  "explanation": "Description of changes made"
}
\`\`\`

Rules:
- ALWAYS copy the exact elementId from the CANVAS_CONTEXT block
- Delegate FE concerns to Frontend patterns, BE concerns to Backend patterns
- In Chat mode: Analyze and answer questions only
- In Change mode: Output JSON with changes array`,
};

/**
 * Default LLM configuration for each scope.
 */
export const DEFAULT_SCOPE_CONFIGS: Record<'backend' | 'frontend' | 'full', LLMInstanceConfig> = {
    backend: {
        provider: 'gemini',
        model: 'gemini-3-flash-preview',
        apiKeyId: '',
        systemPrompt: DEFAULT_SYSTEM_PROMPTS.backend,
        temperature: 0.3,
    },
    frontend: {
        provider: 'gemini',
        model: 'gemini-3-flash-preview',
        apiKeyId: '',
        systemPrompt: DEFAULT_SYSTEM_PROMPTS.frontend,
        temperature: 0.3,
    },
    full: {
        provider: 'gemini',
        model: 'gemini-3-flash-preview',
        apiKeyId: '',
        systemPrompt: DEFAULT_SYSTEM_PROMPTS.full,
        temperature: 0.2,
    },
};
