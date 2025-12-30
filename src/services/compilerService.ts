/**
 * src/services/compilerService.ts
 * ================================
 * Frontend wrapper for Tauri backend TSX compilation.
 * Uses SWC via Rust/Tauri for reliable TypeScript compilation,
 * with Sucrase fallback for browser-only development.
 *
 * Architecture: Option B (Backend Pre-Compilation)
 * Dependencies: D070 (ComponentGenerator), Tauri IPC
 */

import { invoke } from '@tauri-apps/api/tauri';
import { isTauri } from '../utils/tauriUtils';

// =============================================================================
// TYPES
// =============================================================================

export interface CompileResult {
    success: boolean;
    code: string | null;
    error: string | null;
}

// =============================================================================
// COMPILER SERVICE
// =============================================================================

/**
 * Compile TSX/TypeScript code to JavaScript.
 * 
 * Uses the backend SWC compiler in Tauri for reliable compilation.
 * Falls back to Sucrase in browser-only mode (e.g., during development).
 * 
 * @param code - Raw TSX/TypeScript code to compile
 * @returns Promise<CompileResult> - Compiled JavaScript or error
 * 
 * @example
 * ```typescript
 * const result = await compileTsx('const Button = () => <button>Hello</button>');
 * if (result.success) {
 *   console.log('Compiled:', result.code);
 * } else {
 *   console.error('Error:', result.error);
 * }
 * ```
 */
export async function compileTsx(code: string): Promise<CompileResult> {
    if (!isTauri()) {
        // Fallback for browser-only development
        console.log('[compilerService] Browser mode: Using Sucrase fallback');
        return compileTsxWithSucrase(code);
    }

    try {
        console.log('[compilerService] Tauri mode: Using backend SWC compiler');
        const result = await invoke<CompileResult>('compile_tsx', { code });
        return result;
    } catch (err) {
        // If backend compilation fails, log and return error
        const errorMessage = err instanceof Error ? err.message : String(err);
        console.error('[compilerService] Backend compilation failed:', errorMessage);
        return {
            success: false,
            code: null,
            error: `Backend compilation error: ${errorMessage}`,
        };
    }
}

/**
 * Fallback compiler using Sucrase for browser-only development.
 * This is used when the app is not running in Tauri.
 * 
 * @param code - Raw TSX/TypeScript code to compile
 * @returns Promise<CompileResult> - Compiled JavaScript or error
 */
async function compileTsxWithSucrase(code: string): Promise<CompileResult> {
    try {
        // Dynamic import to avoid bundling Sucrase in Tauri builds
        const { transform } = await import('sucrase');

        const result = transform(code, {
            transforms: ['typescript', 'jsx'],
            jsxRuntime: 'classic',
            production: true,
        });

        return {
            success: true,
            code: result.code,
            error: null,
        };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : String(err);
        return {
            success: false,
            code: null,
            error: `Sucrase compilation error: ${errorMessage}`,
        };
    }
}

/**
 * Pre-warm the backend compiler.
 * Call this on app startup to avoid cold-start delay on first component generation.
 */
export async function prewarmCompiler(): Promise<void> {
    if (!isTauri()) {
        console.log('[compilerService] Browser mode: Skipping compiler prewarm');
        return;
    }

    try {
        console.log('[compilerService] Prewarming backend compiler...');
        await invoke<CompileResult>('compile_tsx', { code: 'const X = () => null;' });
        console.log('[compilerService] Backend compiler prewarmed successfully');
    } catch (err) {
        console.warn('[compilerService] Compiler prewarm failed:', err);
    }
}
