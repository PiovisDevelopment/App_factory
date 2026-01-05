/**
 * src/components/factory/LivePreview.tsx
 * ======================================
 * Recursive component renderer for Live Preview.
 * Connects to projectStore to render the current state of UI components.
 * Supports hot-loading by reacting to store updates.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D045-D047 (Live preview panel requirements)
 */

import React, { useMemo, useCallback } from 'react';
import { useProjectStore, type ProjectComponent } from '../../stores/projectStore';
import { getComponent } from '../../utils/ComponentRegistry';
import { mockSelectOptions, mockTabItems, mockEventHandler } from '../../mocks/previewMocks';
import { demoScreen, demoComponents } from '../../mocks/demoPreviewData';
import { ThemedCanvasWrapper } from './ThemedCanvasWrapper';

// =============================================================================
// TYPES
// =============================================================================

interface LivePreviewProps {
    /** Screen ID to preview from projectStore */
    screenId?: string;
    /** Direct component ID to preview from projectStore */
    componentId?: string;
    /** 
     * Enable demo mode: renders demo components when no screenId/componentId provided.
     * REPLACE_WITH_PRODUCTION: Set to false when using real project data.
     */
    useDemoMode?: boolean;
    /** Callback when user interacts with a preview component */
    onInteract?: (eventName: string, componentId: string, args: unknown[]) => void;
    /** Additional CSS classes */
    className?: string;
}

interface LivePreviewChildProps {
    componentId: string;
    components: Record<string, ProjectComponent>;
    onInteract: (eventName: string, componentId: string, args: unknown[]) => void;
}

// =============================================================================
// CHILD COMPONENT (Internal recursive renderer)
// =============================================================================

/**
 * Internal child renderer for recursion.
 * Uses passed components instead of connecting to store for each child.
 */
const LivePreviewChild: React.FC<LivePreviewChildProps> = ({
    componentId,
    components,
    onInteract
}) => {
    const component = components[componentId];
    if (!component) {
        return (
            <div className="text-xs text-error-500">
                Missing: {componentId}
            </div>
        );
    }

    const Component = getComponent(component.type);

    // Build props - spread component.props directly
    // This preserves all original props like label, placeholder, etc.
    const props: Record<string, unknown> = { ...component.props };

    // DUMMY_DATA_START: Mock data injection for preview
    // Inject Mock Data if needed based on component type
    if (component.type === 'select' && !props.options) {
        props.options = mockSelectOptions;
    }
    if (component.type === 'tabs' && !props.items) {
        props.items = mockTabItems;
    }
    // DUMMY_DATA_END

    // For buttons, add a click handler that logs interaction
    if (component.type === 'button') {
        const originalOnClick = props.onClick as (() => void) | undefined;
        props.onClick = () => {
            onInteract('click', component.id, []);
            originalOnClick?.();
        };
    }

    // Render children recursively
    const children = component.children?.map(childId => (
        <LivePreviewChild
            key={childId}
            componentId={childId}
            components={components}
            onInteract={onInteract}
        />
    ));

    // Use children prop for text content (like button text)
    const childrenProp = props.children;

    return (
        <Component {...props}>
            {children && children.length > 0 ? children : childrenProp}
        </Component>
    );
};

// =============================================================================
// MAIN COMPONENT
// =============================================================================

/**
 * LivePreview component.
 * 
 * Recursively renders components from the project store or demo data.
 * Fully interactive - all components are functional (inputs accept text, 
 * buttons are clickable, etc.)
 * 
 * @example
 * ```tsx
 * // Render from project store
 * <LivePreview screenId="main-screen" />
 * 
 * // Render demo content
 * <LivePreview useDemoMode />
 * 
 * // Render specific component
 * <LivePreview componentId="my-component" />
 * ```
 */
export const LivePreview: React.FC<LivePreviewProps> = ({
    screenId,
    componentId,
    useDemoMode = false,
    onInteract,
    className = ''
}) => {
    // Connect to store
    const storeScreens = useProjectStore((state) => state.screens);
    const storeComponents = useProjectStore((state) => state.components);

    // Determine data source: store or demo
    const screens = useDemoMode && Object.keys(storeScreens).length === 0
        ? { [demoScreen.id]: demoScreen }
        : storeScreens;

    const components: Record<string, ProjectComponent> = useDemoMode && Object.keys(storeComponents).length === 0
        ? demoComponents
        : storeComponents;

    // Determine root component ID
    const rootId = useMemo(() => {
        if (componentId) return componentId;
        if (screenId && screens[screenId]) return screens[screenId].rootComponentId;
        // In demo mode with no ID, use demo screen's root
        if (useDemoMode && !screenId && !componentId) {
            return demoScreen.rootComponentId;
        }
        return null;
    }, [screenId, componentId, screens, useDemoMode]);

    // Create interaction handler
    const handleInteract = useCallback((eventName: string, compId: string, args: unknown[]) => {
        // Log to console for preview debugging
        mockEventHandler(eventName, compId, ...args);
        // Call external handler if provided
        onInteract?.(eventName, compId, args);
    }, [onInteract]);

    // If no root, show appropriate message
    if (!rootId) {
        if (screenId && screens[screenId] && !screens[screenId].rootComponentId) {
            return (
                <div className="flex items-center justify-center p-8 text-neutral-400 border-2 border-dashed border-neutral-200 rounded-lg">
                    Empty Screen (No Root Component)
                </div>
            );
        }
        if (!useDemoMode) {
            return (
                <div className="flex flex-col items-center justify-center p-8 text-neutral-400 border-2 border-dashed border-neutral-200 rounded-lg">
                    <p className="text-sm">No content to preview</p>
                    <p className="text-xs mt-1">Select a screen or enable demo mode</p>
                </div>
            );
        }
        return null;
    }

    // Get component data
    const component = components[rootId];
    if (!component) {
        return (
            <div className="p-4 text-error-500 bg-error-50 rounded-lg border border-error-200">
                Component not found: <code className="font-mono">{rootId}</code>
            </div>
        );
    }

    // Render the component tree with theme applied
    return (
        <ThemedCanvasWrapper className={className} applyBackground={false} data-ui-ref="component-live-preview">
            <LivePreviewChild
                componentId={rootId}
                components={components}
                onInteract={handleInteract}
            />
        </ThemedCanvasWrapper>
    );
};

export default LivePreview;
