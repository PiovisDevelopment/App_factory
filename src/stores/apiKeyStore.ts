/**
 * apiKeyStore.ts
 * ==============
 * Zustand store for API key management.
 * Communicates with Rust backend via Tauri IPC for persistent .env storage.
 * 
 * D079 - API Key Management (EUR-1.2.6)
 */

import { create } from 'zustand';
import { invoke } from '@tauri-apps/api/tauri';

// ============================================
// TYPES
// ============================================

/**
 * Supported services for API keys.
 */
export type ApiKeyService =
    | 'gemini'
    | 'openai'
    | 'anthropic'
    | 'ollama'
    | 'tts'
    | 'stt'
    | 'vision'
    | 'embedding';

/**
 * API key entry from backend.
 * Note: keyMasked shows only first 3 + last 3 characters.
 */
export interface ApiKeyEntry {
    id: string;
    service: string;
    name: string;
    keyMasked: string;
    isActive: boolean;
    createdAt: string;
}

/**
 * Response from Rust backend (snake_case).
 */
interface ApiKeyEntryRaw {
    id: string;
    service: string;
    name: string;
    key_masked: string;
    is_active: boolean;
    created_at: string;
}

/**
 * Convert raw backend response to camelCase.
 */
function mapApiKeyEntry(raw: ApiKeyEntryRaw): ApiKeyEntry {
    return {
        id: raw.id,
        service: raw.service,
        name: raw.name,
        keyMasked: raw.key_masked,
        isActive: raw.is_active,
        createdAt: raw.created_at,
    };
}

// ============================================
// STORE STATE & ACTIONS
// ============================================

interface ApiKeyState {
    /** Keys grouped by service */
    keys: Record<string, ApiKeyEntry[]>;
    /** Currently selected service in UI */
    selectedService: ApiKeyService;
    /** Loading state */
    isLoading: boolean;
    /** Error message */
    error: string | null;
}

interface ApiKeyActions {
    /** Set the selected service for UI filtering */
    setSelectedService: (service: ApiKeyService) => void;

    /** Fetch all keys for a service from backend */
    fetchKeys: (service: ApiKeyService) => Promise<void>;

    /** Add a new API key */
    addKey: (service: ApiKeyService, name: string, key: string) => Promise<ApiKeyEntry>;

    /** Update an existing key */
    updateKey: (service: ApiKeyService, id: string, name?: string, key?: string) => Promise<void>;

    /** Delete a key */
    deleteKey: (service: ApiKeyService, id: string) => Promise<void>;

    /** Set the active key for a service */
    setActiveKey: (service: ApiKeyService, id: string) => Promise<void>;

    /** Get the active key for a service (from local cache) */
    getActiveKey: (service: ApiKeyService) => ApiKeyEntry | undefined;

    /** Get the actual API key value for API calls (from backend) */
    getActiveKeyValue: (service: ApiKeyService) => Promise<string | null>;

    /** Clear error state */
    clearError: () => void;
}

// ============================================
// TAURI-SAFE INVOKE WRAPPER
// ============================================

/**
 * Check if we're running in Tauri environment.
 */
function isTauriEnv(): boolean {
    return typeof window !== 'undefined' &&
        '__TAURI__' in window &&
        typeof (window as unknown as { __TAURI_IPC__?: unknown }).__TAURI_IPC__ === 'function';
}

/**
 * Safe invoke that returns null in browser environment.
 */
async function safeInvoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T | null> {
    if (!isTauriEnv()) {
        console.warn(`[apiKeyStore] Tauri not available, skipping: ${cmd}`);
        return null;
    }
    return invoke<T>(cmd, args);
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useApiKeyStore = create<ApiKeyState & ApiKeyActions>()((set, get) => ({
    // Initial state
    keys: {},
    selectedService: 'gemini',
    isLoading: false,
    error: null,

    setSelectedService: (service) => {
        set({ selectedService: service, error: null });
        // Auto-fetch keys for the selected service
        get().fetchKeys(service);
    },

    fetchKeys: async (service) => {
        set({ isLoading: true, error: null });

        try {
            const result = await safeInvoke<ApiKeyEntryRaw[]>('get_api_keys', { service });

            if (result === null) {
                // Browser environment - no keys available
                set((state) => ({
                    keys: { ...state.keys, [service]: [] },
                    isLoading: false,
                }));
                return;
            }

            const entries = result.map(mapApiKeyEntry);

            set((state) => ({
                keys: { ...state.keys, [service]: entries },
                isLoading: false,
            }));
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[apiKeyStore] fetchKeys error:', message);
            set({ error: message, isLoading: false });
        }
    },

    addKey: async (service, name, key) => {
        set({ isLoading: true, error: null });

        try {
            const result = await safeInvoke<ApiKeyEntryRaw>('add_api_key', { service, name, key });

            if (result === null) {
                throw new Error('Tauri not available - cannot add keys in browser mode');
            }

            const entry = mapApiKeyEntry(result);

            set((state) => {
                const existing = state.keys[service] || [];
                // If this is the first key, it becomes active
                const updated = entry.isActive
                    ? [...existing.map(k => ({ ...k, isActive: false })), entry]
                    : [...existing, entry];

                return {
                    keys: { ...state.keys, [service]: updated },
                    isLoading: false,
                };
            });

            return entry;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[apiKeyStore] addKey error:', message);
            set({ error: message, isLoading: false });
            throw err;
        }
    },

    updateKey: async (service, id, name, key) => {
        set({ isLoading: true, error: null });

        try {
            const result = await safeInvoke<ApiKeyEntryRaw>('update_api_key', { service, id, name, key });

            if (result === null) {
                throw new Error('Tauri not available');
            }

            const entry = mapApiKeyEntry(result);

            set((state) => {
                const existing = state.keys[service] || [];
                const updated = existing.map(k => k.id === id ? entry : k);
                return {
                    keys: { ...state.keys, [service]: updated },
                    isLoading: false,
                };
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[apiKeyStore] updateKey error:', message);
            set({ error: message, isLoading: false });
            throw err;
        }
    },

    deleteKey: async (service, id) => {
        set({ isLoading: true, error: null });

        try {
            await safeInvoke('delete_api_key', { service, id });

            set((state) => {
                const existing = state.keys[service] || [];
                const updated = existing.filter(k => k.id !== id);
                return {
                    keys: { ...state.keys, [service]: updated },
                    isLoading: false,
                };
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[apiKeyStore] deleteKey error:', message);
            set({ error: message, isLoading: false });
            throw err;
        }
    },

    setActiveKey: async (service, id) => {
        set({ isLoading: true, error: null });

        try {
            await safeInvoke('set_active_api_key', { service, id });

            set((state) => {
                const existing = state.keys[service] || [];
                const updated = existing.map(k => ({
                    ...k,
                    isActive: k.id === id,
                }));
                return {
                    keys: { ...state.keys, [service]: updated },
                    isLoading: false,
                };
            });
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            console.error('[apiKeyStore] setActiveKey error:', message);
            set({ error: message, isLoading: false });
            throw err;
        }
    },

    getActiveKey: (service) => {
        const serviceKeys = get().keys[service] || [];
        return serviceKeys.find(k => k.isActive);
    },

    getActiveKeyValue: async (service) => {
        try {
            const result = await safeInvoke<string | null>('get_active_api_key_value', { service });
            return result;
        } catch (err) {
            console.error('[apiKeyStore] getActiveKeyValue error:', err);
            return null;
        }
    },

    clearError: () => set({ error: null }),
}));

// ============================================
// SERVICE LABELS
// ============================================

/**
 * Human-readable labels for API key services.
 */
export const API_KEY_SERVICE_LABELS: Record<ApiKeyService, string> = {
    gemini: 'Google Gemini',
    openai: 'OpenAI',
    anthropic: 'Anthropic',
    ollama: 'Ollama (Local)',
    tts: 'Text-to-Speech',
    stt: 'Speech-to-Text',
    vision: 'Vision',
    embedding: 'Embedding',
};
