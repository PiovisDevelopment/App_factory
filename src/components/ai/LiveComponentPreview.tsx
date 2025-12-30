/**
 * src/components/ai/LiveComponentPreview.tsx
 * ==========================================
 * Live preview renderer for AI-generated React components.
 * Uses backend SWC compiler (Rust/Tauri) for reliable TypeScript compilation.
 * Falls back to Sucrase for browser-only development.
 *
 * Architecture: Option B (Backend Pre-Compilation)
 * Dependencies: D070 (ComponentGenerator), compilerService
 *
 * NOTICE TO AI ASSISTANTS:
 * ========================
 * This component dynamically compiles and renders user-generated JSX code.
 * Use caution when modifying the compilation or execution logic.
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import { compileTsx } from '../../services/compilerService';

// =============================================================================
// TYPES
// =============================================================================

interface LiveComponentPreviewProps {
    /** Raw React/TSX code to render */
    code: string;
    /** Target framework (only 'react' supported initially) */
    framework: 'react' | 'vue' | 'svelte' | 'html';
    /** Preview container className */
    className?: string;
}

interface PreviewState {
    Component: React.ComponentType | null;
    error: string | null;
    isCompiling: boolean;
}

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Extract the component name from generated code.
 * Looks for: const ComponentName = or function ComponentName
 */
function extractComponentName(code: string): string | null {
    // Match: const ComponentName: React.FC = 
    const constMatch = code.match(/const\s+([A-Z][a-zA-Z0-9]*)\s*[:=]/);
    if (constMatch) return constMatch[1];

    // Match: function ComponentName(
    const funcMatch = code.match(/function\s+([A-Z][a-zA-Z0-9]*)\s*\(/);
    if (funcMatch) return funcMatch[1];

    // Match: export const ComponentName
    const exportMatch = code.match(/export\s+(?:const|function)\s+([A-Z][a-zA-Z0-9]*)/);
    if (exportMatch) return exportMatch[1];

    return null;
}

/**
 * Normalize AI-generated code for runtime compilation.
 * Strips imports, interfaces, TypeScript annotations, and simplifies patterns.
 * 
 * This function handles patterns that Sucrase cannot process at runtime:
 * - Import statements (React is injected)
 * - Interface/type definitions
 * - Type annotations on parameters and return values
 * - Generic type parameters
 * - Type assertions (as, satisfies)
 * - Markdown code fences from LLM output
 */
function normalizeCode(code: string): string {
    let normalized = code;

    // Remove markdown code fences (LLMs often wrap code in ```)
    normalized = normalized.replace(/^```(?:tsx?|jsx?|typescript|javascript|react)?\s*\n?/gm, '');
    normalized = normalized.replace(/```\s*$/gm, '');

    // Remove import statements (React is provided at runtime)
    normalized = normalized.replace(/^import\s+.*?from\s+['"][^'"]*['"];?\s*$/gm, '');
    normalized = normalized.replace(/^import\s+['"][^'"]*['"];?\s*$/gm, '');
    normalized = normalized.replace(/^import\s+type\s+.*?from\s+['"][^'"]*['"];?\s*$/gm, '');

    // Remove interface definitions with their content (multi-line aware)
    // Handle nested braces by being more conservative
    normalized = normalized.replace(/interface\s+\w+(?:\s+extends\s+[^{]+)?\s*\{[\s\S]*?\n\}/gm, '');

    // Remove type definitions (including multi-line)
    normalized = normalized.replace(/^type\s+\w+\s*=\s*[\s\S]*?;\s*$/gm, '');
    normalized = normalized.replace(/\btype\s+\w+\s*=\s*[^;]+;/g, '');

    // Remove export keywords (we'll access the component directly)
    normalized = normalized.replace(/^export\s+default\s+/gm, '');
    normalized = normalized.replace(/^export\s+/gm, '');

    // Remove React.FC and FC type annotations
    normalized = normalized.replace(/:\s*React\.FC<[^>]*>/g, '');
    normalized = normalized.replace(/:\s*React\.FC/g, '');
    normalized = normalized.replace(/:\s*FC<[^>]*>/g, '');
    normalized = normalized.replace(/:\s*FC\b/g, '');

    // Remove generic type parameters from function/const declarations: <T, U>
    normalized = normalized.replace(/(<[A-Z][^>]*>)\s*(?=\()/g, '');

    // Remove return type annotations: ): Type => or ): Type {
    normalized = normalized.replace(/\)\s*:\s*[\w<>[\]|&\s,]+(?=\s*[=>{])/g, ')');

    // Remove parameter type annotations in arrow functions and regular functions
    // Match: (param: Type) or (param: Type, param2: Type)
    normalized = normalized.replace(/\(([^)]*)\)/g, (match, params: string) => {
        if (!params.includes(':')) return match;
        const cleanedParams = params
            .split(',')
            .map((p: string) => {
                // Handle destructuring: { prop }: Type => { prop }
                const destructMatch = p.match(/^(\s*\{[^}]+\})\s*:\s*.+$/);
                if (destructMatch) return destructMatch[1];
                // Handle regular params: param: Type => param
                const parts = p.split(':');
                return parts[0].trim();
            })
            .filter((p: string) => p.length > 0)
            .join(', ');
        return `(${cleanedParams})`;
    });

    // Remove 'as Type' assertions
    normalized = normalized.replace(/\s+as\s+[\w<>[\]|&]+/g, '');

    // Remove 'satisfies Type' expressions
    normalized = normalized.replace(/\s+satisfies\s+[\w<>[\]|&]+/g, '');

    // Remove type annotations on const/let/var: const x: Type = 
    normalized = normalized.replace(/(const|let|var)\s+(\w+)\s*:\s*[\w<>[\]|&\s,]+\s*=/g, '$1 $2 =');

    // Remove useState type parameters: useState<Type>() => useState()
    normalized = normalized.replace(/useState<[^>]+>/g, 'useState');
    normalized = normalized.replace(/useRef<[^>]+>/g, 'useRef');
    normalized = normalized.replace(/useCallback<[^>]+>/g, 'useCallback');
    normalized = normalized.replace(/useMemo<[^>]+>/g, 'useMemo');

    // Remove consecutive empty lines
    normalized = normalized.replace(/\n\s*\n\s*\n/g, '\n\n');

    return normalized.trim();
}

/**
 * Compile TSX code to executable JavaScript using backend SWC compiler.
 * Falls back to Sucrase in browser-only mode.
 */
async function compileCode(code: string): Promise<{ compiledCode: string; error: string | null }> {
    try {
        // Normalize code first to strip imports and complex types
        const normalizedCode = normalizeCode(code);

        // Use compilerService (Tauri SWC backend or Sucrase fallback)
        const result = await compileTsx(normalizedCode);

        if (!result.success || !result.code) {
            return { compiledCode: '', error: result.error || 'Compilation failed' };
        }

        return { compiledCode: result.code, error: null };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown compilation error';
        return { compiledCode: '', error: `Compilation Error: ${errorMessage}` };
    }
}

/**
 * Create a React component from compiled code string.
 */
function createComponent(
    compiledCode: string,
    componentName: string
): { Component: React.ComponentType | null; error: string | null } {
    try {
        // Create a function that returns the component
        // We provide React as a dependency
        const createFn = new Function(
            'React',
            `
      ${compiledCode}
      return ${componentName};
      `
        );

        const Component = createFn(React);

        if (typeof Component !== 'function') {
            return { Component: null, error: `${componentName} is not a valid React component` };
        }

        return { Component, error: null };
    } catch (err) {
        const errorMessage = err instanceof Error ? err.message : 'Unknown runtime error';
        return { Component: null, error: `Runtime Error: ${errorMessage}` };
    }
}

// =============================================================================
// ERROR BOUNDARY
// =============================================================================

interface ErrorBoundaryProps {
    children: React.ReactNode;
    fallback: React.ReactNode;
    onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
}

class PreviewErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo): void {
        this.props.onError?.(error, errorInfo);
    }

    render(): React.ReactNode {
        if (this.state.hasError) {
            return this.props.fallback;
        }
        return this.props.children;
    }
}

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * LiveComponentPreview component.
 *
 * Dynamically compiles and renders React components from TSX code strings.
 * Includes error boundary for graceful failure handling.
 */
export const LiveComponentPreview: React.FC<LiveComponentPreviewProps> = ({
    code,
    framework,
    className = '',
}) => {
    const [state, setState] = useState<PreviewState>({
        Component: null,
        error: null,
        isCompiling: false,
    });

    // Track mounted state to avoid state updates after unmount
    const isMountedRef = useRef(true);

    useEffect(() => {
        isMountedRef.current = true;
        return () => { isMountedRef.current = false; };
    }, []);

    // Compile and create component when code changes
    useEffect(() => {
        if (!code.trim()) {
            setState({ Component: null, error: 'No code provided', isCompiling: false });
            return;
        }

        // Only support React for now
        if (framework !== 'react') {
            setState({
                Component: null,
                error: `Live preview is not yet available for ${framework}. Only React is currently supported.`,
                isCompiling: false,
            });
            return;
        }

        setState(prev => ({ ...prev, isCompiling: true }));

        // Async compilation function
        const compileAsync = async () => {
            // Extract component name
            const componentName = extractComponentName(code);
            if (!componentName) {
                if (isMountedRef.current) {
                    setState({
                        Component: null,
                        error: 'Could not find a React component in the generated code.',
                        isCompiling: false,
                    });
                }
                return;
            }

            // Compile code using backend SWC compiler
            const { compiledCode, error: compileError } = await compileCode(code);
            if (!isMountedRef.current) return;

            if (compileError) {
                setState({ Component: null, error: compileError, isCompiling: false });
                return;
            }

            // Create component
            const { Component, error: createError } = createComponent(compiledCode, componentName);
            if (!isMountedRef.current) return;

            if (createError) {
                setState({ Component: null, error: createError, isCompiling: false });
                return;
            }

            setState({ Component, error: null, isCompiling: false });
        };

        compileAsync();
    }, [code, framework]);

    // Memoize error fallback
    const errorFallback = useMemo(() => (
        <div className="p-4 bg-error-50 border border-error-200 rounded-lg text-center">
            <p className="text-error-700 font-medium">Component Render Error</p>
            <p className="text-error-600 text-sm mt-1">
                The component crashed during rendering.
            </p>
        </div>
    ), []);

    // Container styles
    const containerStyles = [
        'relative',
        'min-h-[200px]',
        'border',
        'border-neutral-200',
        'rounded-lg',
        'overflow-hidden',
        className,
    ].filter(Boolean).join(' ');

    const previewAreaStyles = [
        'p-6',
        'flex',
        'items-center',
        'justify-center',
        'bg-white',
        'min-h-[200px]',
    ].join(' ');

    // Loading state
    if (state.isCompiling) {
        return (
            <div className={containerStyles}>
                <div className={previewAreaStyles}>
                    <div className="flex items-center gap-2 text-neutral-500">
                        <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                        </svg>
                        <span>Compiling preview...</span>
                    </div>
                </div>
            </div>
        );
    }

    // Error state
    if (state.error) {
        return (
            <div className={containerStyles}>
                <div className="p-4 bg-error-50 text-error-700">
                    <p className="font-medium mb-1">Preview Error</p>
                    <p className="text-sm font-mono whitespace-pre-wrap">{state.error}</p>
                </div>
            </div>
        );
    }

    // No component state
    if (!state.Component) {
        return (
            <div className={containerStyles}>
                <div className={previewAreaStyles}>
                    <p className="text-neutral-400 text-sm">No component to preview</p>
                </div>
            </div>
        );
    }

    // Render component
    const { Component } = state;

    return (
        <div className={containerStyles}>
            {/* Preview label */}
            <div className="absolute top-2 right-2 px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded z-10">
                Live Preview
            </div>

            {/* Preview area */}
            <div className={previewAreaStyles}>
                <PreviewErrorBoundary fallback={errorFallback}>
                    <Component />
                </PreviewErrorBoundary>
            </div>
        </div>
    );
};

LiveComponentPreview.displayName = 'LiveComponentPreview';

export default LiveComponentPreview;
