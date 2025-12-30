/**
 * tauriUtils.ts
 * =============
 * Utility functions for detecting and working with the Tauri environment.
 */

/**
 * Check if the application is running inside a Tauri webview.
 * 
 * This function checks for the presence of the Tauri IPC bridge,
 * which is only available when running as a Tauri desktop application.
 * 
 * @returns true if running in Tauri, false if running in a browser
 */
export function isTauri(): boolean {
    return (
        typeof window !== 'undefined' &&
        ('__TAURI__' in window || '__TAURI_IPC__' in window)
    );
}

/**
 * Safely invoke a Tauri command, returning undefined if not in Tauri environment.
 * 
 * @param command - The Tauri command to invoke
 * @param args - Arguments to pass to the command
 * @returns The result of the command, or undefined if not in Tauri
 */
export async function safeInvoke<T>(
    command: string,
    args?: Record<string, unknown>
): Promise<T | undefined> {
    if (!isTauri()) {
        console.warn(`[safeInvoke] Skipping "${command}" - not in Tauri environment`);
        return undefined;
    }

    const { invoke } = await import('@tauri-apps/api/tauri');
    return invoke<T>(command, args);
}
