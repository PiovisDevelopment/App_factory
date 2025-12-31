/**
 * CanvasPreview.tsx
 * =================
 * Renders canvas elements in the Preview panel as a live preview.
 * This component takes canvas elements and renders them positioned
 * according to their bounds, with actual component rendering.
 * 
 * Theme Support: Uses ThemedCanvasWrapper to apply theme customizations.
 */

import React from 'react';
import { type CanvasElement } from './CanvasEditor';
import { getComponent, isComponentRegistered } from '../../utils/ComponentRegistry';
import { ThemedCanvasWrapper } from './ThemedCanvasWrapper';

interface CanvasPreviewProps {
    /** Canvas elements to render */
    elements: CanvasElement[];
    /** Canvas width for scaling */
    canvasWidth: number;
    /** Canvas height for scaling */
    canvasHeight: number;
    /** Function to get component rendering info by componentId */
    getComponentCode?: (componentId: string) => {
        code?: string;
        framework?: 'react' | 'vue' | 'svelte' | 'html';
        componentType?: string;
    } | null;
    /** Additional CSS classes */
    className?: string;
}

/**
 * Default props for built-in component types.
 */
const defaultComponentProps: Record<string, Record<string, unknown>> = {
    button: { children: 'Button', variant: 'primary', size: 'md' },
    input: { placeholder: 'Enter text...', size: 'md' },
    select: {
        options: [
            { value: '1', label: 'Option 1' },
            { value: '2', label: 'Option 2' },
        ],
        placeholder: 'Select...',
        size: 'md'
    },
    checkbox: { label: 'Checkbox', size: 'md' },
    panel: { children: 'Panel Content', className: 'p-4' },
    card: { children: 'Card Content', className: 'p-4' },
    tabs: {
        tabs: [
            { id: '1', label: 'Tab 1' },
            { id: '2', label: 'Tab 2' },
        ],
        activeTab: '1',
        size: 'md'
    },
};

/**
 * Renders a single canvas element preview.
 */
const ElementPreview: React.FC<{
    element: CanvasElement;
    getComponentCode?: CanvasPreviewProps['getComponentCode'];
}> = ({ element, getComponentCode }) => {
    // Get component info if this is a component-type element
    const componentData = element.componentId && getComponentCode
        ? getComponentCode(element.componentId)
        : null;

    // Try to render built-in component from registry
    if (componentData?.componentType && isComponentRegistered(componentData.componentType)) {
        const Component = getComponent(componentData.componentType);
        const props = defaultComponentProps[componentData.componentType.toLowerCase()] || {};

        try {
            return <Component {...props} />;
        } catch {
            // Fall through to placeholder
        }
    }

    // For containers/text/other types, show placeholder with children
    if (element.type === 'container') {
        return (
            <div className="w-full h-full border border-neutral-200 bg-neutral-50/50 rounded flex items-center justify-center">
                <span className="text-xs text-neutral-400">{element.name}</span>
            </div>
        );
    }

    if (element.type === 'text') {
        return (
            <div className="w-full h-full flex items-center">
                <span className="text-sm text-neutral-700">{element.name}</span>
            </div>
        );
    }

    // Default placeholder for unregistered components
    return (
        <div className="w-full h-full border border-dashed border-neutral-300 bg-neutral-50 rounded flex items-center justify-center">
            <span className="text-xs text-neutral-500">{element.name}</span>
        </div>
    );
};

/**
 * CanvasPreview component.
 * 
 * Renders all canvas elements as positioned components,
 * creating a true WYSIWYG preview of the canvas layout.
 */
export const CanvasPreview: React.FC<CanvasPreviewProps> = ({
    elements,
    canvasWidth,
    canvasHeight,
    getComponentCode,
    className = '',
}) => {
    if (elements.length === 0) {
        return (
            <div className="flex items-center justify-center h-full text-neutral-400">
                <p className="text-sm">No elements on canvas</p>
            </div>
        );
    }

    return (
        <ThemedCanvasWrapper
            className={`relative overflow-auto ${className}`}
            style={{ minHeight: '100%' }}
            applyBackground
        >
            {/* Scaled canvas container */}
            <div
                className="relative"
                style={{
                    width: canvasWidth,
                    height: canvasHeight,
                    transform: 'scale(0.5)',
                    transformOrigin: 'top left',
                }}
            >
                {elements
                    .filter(el => el.visible !== false)
                    .sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0))
                    .map((element) => (
                        <div
                            key={element.id}
                            className="absolute overflow-hidden"
                            style={{
                                left: element.bounds.x,
                                top: element.bounds.y,
                                width: element.bounds.width,
                                height: element.bounds.height,
                            }}
                        >
                            <ElementPreview
                                element={element}
                                getComponentCode={getComponentCode}
                            />
                        </div>
                    ))}
            </div>
        </ThemedCanvasWrapper>
    );
};

export default CanvasPreview;
