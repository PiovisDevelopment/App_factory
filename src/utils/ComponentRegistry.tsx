/**
 * src/utils/ComponentRegistry.tsx
 * ===============================
 * Registry mapping string component types to actual React components.
 * Used by LivePreview to dynamically render the component tree.
 * Supports hot-loading by allowing dynamic registration/unregistration.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D045-D047 (Live preview requirements)
 */

import React from 'react';
import {
    Button,
    Input,
    Select,
    Checkbox,
    Modal,
    Panel,
    Tabs,
    ThemeCustomizationPanel,
    ThemePreview,
    WindowConfigPanel
} from '../components/ui';

// =============================================================================
// COMPONENT REGISTRY
// =============================================================================

/**
 * Component mapping registry.
 * Mutable to support dynamic registration for hot-loading.
 */
let componentRegistry: Record<string, React.ComponentType<any>> = {
    // Atoms
    'button': Button,
    'input': Input,
    'select': Select,
    'checkbox': Checkbox,

    // Containers / Molecules
    'panel': Panel,
    'modal': Modal,
    'tabs': Tabs,

    // Mapped/Aliased types (handling generic usage)
    'card': Panel,      // Map 'card' to Panel
    'container': Panel, // Map 'container' to Panel
    'form': Panel,      // Map 'form' to Panel
    'navigation': Tabs, // Map 'navigation' to Tabs

    // Specialized Panels
    'theme-customization': ThemeCustomizationPanel,
    'theme-preview': ThemePreview,
    'window-config': WindowConfigPanel
};

// =============================================================================
// REGISTRY ACCESS FUNCTIONS
// =============================================================================

/**
 * Get a React component by its string type.
 * Returns a fallback if not found.
 *
 * @param type - The component type string (e.g., 'button', 'panel')
 * @returns The React component or a fallback placeholder
 */
export const getComponent = (type: string): React.ComponentType<any> => {
    const Component = componentRegistry[type.toLowerCase()];

    if (!Component) {
        // Fallback for unknown components
        return ({ children, ...props }: any) => (
            <div className="p-2 border-2 border-dashed border-red-300 bg-red-50 text-red-700 rounded text-xs font-mono">
                <strong>Unknown Component: {type}</strong>
                <pre className="mt-1 opacity-75">{JSON.stringify(props, null, 2)}</pre>
                {children}
            </div>
        );
    }

    return Component;
};

// =============================================================================
// DYNAMIC REGISTRATION API (for hot-loading)
// =============================================================================

/**
 * Register a new component type at runtime.
 * Enables hot-loading of new components without restart.
 *
 * @param type - The component type string (will be lowercased)
 * @param component - The React component to register
 *
 * @example
 * ```tsx
 * import { registerComponent } from '@utils/ComponentRegistry';
 * registerComponent('custom-widget', MyCustomWidget);
 * ```
 */
export function registerComponent(type: string, component: React.ComponentType<any>): void {
    const normalizedType = type.toLowerCase();
    componentRegistry[normalizedType] = component;
    console.log(`[ComponentRegistry] Registered: ${normalizedType}`);
}

/**
 * Unregister a component type at runtime.
 *
 * @param type - The component type string to unregister
 * @returns true if component was found and removed, false otherwise
 */
export function unregisterComponent(type: string): boolean {
    const normalizedType = type.toLowerCase();
    if (componentRegistry[normalizedType]) {
        delete componentRegistry[normalizedType];
        console.log(`[ComponentRegistry] Unregistered: ${normalizedType}`);
        return true;
    }
    return false;
}

/**
 * Get all registered component type names.
 * Useful for introspection and debugging.
 *
 * @returns Array of registered type strings
 */
export function getRegisteredTypes(): string[] {
    return Object.keys(componentRegistry);
}

/**
 * Check if a component type is registered.
 *
 * @param type - The component type string to check
 * @returns true if registered, false otherwise
 */
export function isComponentRegistered(type: string): boolean {
    return type.toLowerCase() in componentRegistry;
}

/**
 * Get the raw registry object (for debugging).
 * REPLACE_WITH_PRODUCTION: Remove this function in production builds.
 */
export function getRegistry(): Record<string, React.ComponentType<any>> {
    return { ...componentRegistry };
}

