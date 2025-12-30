/**
 * Tauri v1.8 Mock Layer
 * ======================
 * Simulates the Tauri backend environment for User Acceptance Testing (UAT)
 * in a standard browser environment.
 * 
 * Usage: Import this file before your app initializes.
 */

console.log("%c[Tauri Mock] Initializing...", "color: #8b5cf6; font-weight: bold;");

// Mock Data Store
const mockStore = {
    plugins: [
        {
            id: "tts_kokoro",
            name: "Kokoro TTS",
            version: "1.2.0",
            description: "High-quality text-to-speech engine",
            author: "Piovis",
            type: "plugin",
            status: "active",
            tags: ["audio", "ai"]
        }
    ],
    components: [],
    lifecycle: "running"
};

/**
 * Compile TSX code using Sucrase (browser-mode fallback).
 * Returns a CompileResult matching the Tauri backend interface.
 */
async function compileWithSucrase(code) {
    try {
        // Dynamic import Sucrase
        const { transform } = await import('sucrase');

        const result = transform(code, {
            transforms: ['typescript', 'jsx'],
            jsxRuntime: 'classic',
            production: true,
        });

        console.log('[Tauri Mock] compile_tsx: Success');
        return {
            success: true,
            code: result.code,
            error: null,
        };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[Tauri Mock] compile_tsx: Error -', errorMessage);
        return {
            success: false,
            code: null,
            error: `Sucrase compilation error: ${errorMessage}`,
        };
    }
}

// 1. Mock window.__TAURI__ if it doesn't exist
if (!window.__TAURI__) {
    window.__TAURI__ = {};
}

// 2. Mock invoke function
window.__TAURI__.invoke = async (cmd, args = {}) => {
    console.log(`%c[Tauri Mock] invoke('${cmd}')`, "color: #0ea5e9;", args);

    // Simulate network/processing delay
    await new Promise(resolve => setTimeout(resolve, 300));

    switch (cmd) {
        // --- Lifecycle ---
        case "ipc_start":
            mockStore.lifecycle = "running";
            return null;
        case "ipc_stop":
            mockStore.lifecycle = "stopped";
            return null;
        case "ipc_status":
            return {
                lifecycle_state: mockStore.lifecycle,
                health_status: {
                    is_healthy: true,
                    last_latency_ms: 5,
                    failure_count: 0
                },
                uptime_seconds: 120
            };

        // --- Plugin Management ---
        case "discover_plugins":
        case "scan_plugins":
            return {
                plugins: mockStore.plugins,
                paths: mockStore.plugins.reduce((acc, p) => ({ ...acc, [p.id]: `/plugins/${p.id}` }), {}),
                count: mockStore.plugins.length,
                errors: []
            };

        case "plugin_list":
            return mockStore.plugins.map(p => ({
                ...p,
                config: [],
                methods: []
            }));

        case "plugin_load":
            // Always succeed for UAT
            if (args.name === "example_component") {
                return {
                    methods: [],
                    config: []
                };
            }
            return { methods: [], config: [] };

        // --- Generic IPC Call ---
        case "ipc_call":
            return handleIpcCall(args.method, args.params);

        case "ping":
            return "pong";

        // --- TSX Compilation (Phase 1 Mock) ---
        case "compile_tsx":
            // Use Sucrase for browser-mode TSX compilation
            return await compileWithSucrase(args.code);

        default:
            console.warn(`[Tauri Mock] Unhandled command: ${cmd}`);
            return null;
    }
};

/**
 * Handle specific ipc_call methods
 */
async function handleIpcCall(method, params) {
    switch (method) {
        case "plugin/import":
            console.log("[Tauri Mock] Importing component:", params);
            // Add to mock store
            const newComponent = {
                id: "example_component",
                name: "Example Component",
                version: params.manifest?.version || "1.0.0",
                type: "component",
                status: "active",
                author: params.manifest?.author || "Unknown",
                description: params.manifest?.description || "Imported via Mock",
                tags: params.manifest?.tags || [],
                createdAt: new Date(),
                updatedAt: new Date()
            };
            mockStore.plugins.push(newComponent);
            return { success: true };

        case "plugin/list":
            return mockStore.plugins;

        default:
            console.log(`[Tauri Mock] Generic IPC call: ${method}`, params);
            return { success: true };
    }
}

// 3. Shim for @tauri-apps/api/tauri if using ESM imports in Vite
// This is tricky because imports are static. 
// We rely on the fact that `window.__TAURI_IPC__` or similar might be used by the bindings.
// However, since we use `invoke` from `@tauri-apps/api/tauri`, we might need to intercept that module resolution 
// or ensure the global `window.__TAURI__.invoke` is used if the library falls back to it.

// For the `invoke` exported by `@tauri-apps/api`, it typically uses `window.__TAURI_IPC__` internally 
// OR calls `window.__TAURI__.invoke` if available? 
// Actually current Tauri v1 adapter often looks like this.
// To ensure it works, we make sure the global invoke is our mock.
// AND we can try to patch the window if the app uses `window.invoke`.

window.invoke = window.__TAURI__.invoke;

console.log("%c[Tauri Mock] Ready", "color: #10b981; font-weight: bold;");
