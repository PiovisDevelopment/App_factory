/**
 * src/components/factory/canvasTypes.ts
 * =====================================
 * Shared types for canvas editor and components.
 */

/**
 * Canvas element types.
 */
export type CanvasElementType = "component" | "container" | "text" | "image" | "spacer";

/**
 * Canvas element position and size.
 */
export interface ElementBounds {
    x: number;
    y: number;
    width: number;
    height: number;
}

/**
 * Canvas element definition.
 */
export interface CanvasElement {
    /** Unique element ID */
    id: string;
    /** Element type */
    type: CanvasElementType;
    /** Display name */
    name: string;
    /** Position and size */
    bounds: ElementBounds;
    /** Component reference ID (for component type) */
    componentId?: string;
    /** Child elements (for container type) */
    children?: CanvasElement[];
    /** Element props */
    props?: Record<string, unknown>;
    /** Whether element is locked */
    locked?: boolean;
    /** Whether element is visible */
    visible?: boolean;
    /** Z-index */
    zIndex?: number;
}
