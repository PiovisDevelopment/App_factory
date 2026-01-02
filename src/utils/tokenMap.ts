/**
 * src/utils/tokenMap.ts
 * =====================
 * Maps hex color values to CSS design token variables.
 * 
 * This is the enforcement layer that converts any hardcoded hex colors
 * to their design token equivalents at runtime.
 * 
 * Usage:
 *   import { resolveColor, resolveBorder } from '../utils/tokenMap';
 *   style={{ backgroundColor: resolveColor(props.backgroundColor) }}
 */

/**
 * Maps hex colors to CSS variable tokens.
 * 
 * IMPORTANT: Sidebar/dark colors map to PRIMARY shades (not neutral)
 * so they reflect the user's selected theme color.
 */
export const HEX_TO_TOKEN: Record<string, string> = {
    // Dark backgrounds (sidebars) -> Use PRIMARY dark shades for theme consistency
    "#1e1e2e": "var(--color-primary-950)",
    "#18181b": "var(--color-primary-950)",
    "#1a1a2e": "var(--color-primary-950)",
    "#16213e": "var(--color-primary-950)",
    "#1e1e1e": "var(--color-primary-900)",
    "#27272a": "var(--color-primary-800)",

    // Light backgrounds
    "#ffffff": "var(--bg-primary)",
    "#fff": "var(--bg-primary)",
    "#fafafa": "var(--color-neutral-50)",
    "#f9fafb": "var(--color-neutral-50)",
    "#f8fafc": "var(--color-neutral-50)",
    "#f4f4f5": "var(--color-neutral-100)",
    "#f3f4f6": "var(--color-neutral-100)",

    // Borders
    "#e5e5e5": "var(--border-primary)",
    "#e4e4e7": "var(--border-primary)",
    "#e2e8f0": "var(--border-primary)",
    "#d4d4d8": "var(--border-secondary)",

    // Primary/Accent colors
    "#6366f1": "var(--color-primary-500)",
    "#3b82f6": "var(--color-primary-500)",
    "#2563eb": "var(--color-primary-600)",
    "#1d4ed8": "var(--color-primary-700)",

    // Text colors
    "#71717a": "var(--text-tertiary)",
    "#52525b": "var(--text-secondary)",
    "#3f3f46": "var(--color-neutral-700)",

    // Status colors
    "#22c55e": "var(--color-success-500)",
    "#ef4444": "var(--color-error-500)",
    "#f59e0b": "var(--color-warning-500)",
};

/**
 * Semantic color tokens that templates should use instead of hex values.
 * These map directly to CSS variables in design_tokens.css
 */
export const SEMANTIC_TOKENS: Record<string, string> = {
    // Backgrounds
    "bg-primary": "var(--bg-primary)",
    "bg-secondary": "var(--bg-secondary)",
    "bg-tertiary": "var(--bg-tertiary)",
    "bg-inverse": "var(--bg-inverse)",

    // Sidebar/Dark
    "neutral-900": "var(--color-neutral-900)",
    "neutral-950": "var(--color-neutral-950)",
    "neutral-800": "var(--color-neutral-800)",

    // Light
    "neutral-50": "var(--color-neutral-50)",
    "neutral-100": "var(--color-neutral-100)",

    // Borders
    "border-primary": "var(--border-primary)",
    "border-secondary": "var(--border-secondary)",

    // Primary
    "primary-500": "var(--color-primary-500)",
    "primary-600": "var(--color-primary-600)",
};

/**
 * Resolve a color value to a CSS variable.
 * Accepts hex colors, semantic tokens, or CSS variables.
 * 
 * @param color - The color to resolve (hex, semantic token, or CSS var)
 * @param fallback - Fallback value if resolution fails
 * @returns CSS variable string
 */
export function resolveColor(
    color: string | undefined,
    fallback: string = "var(--bg-primary)"
): string {
    if (!color) return fallback;

    // Already a CSS variable
    if (color.startsWith("var(")) return color;

    // Check semantic tokens first
    const semantic = SEMANTIC_TOKENS[color];
    if (semantic) return semantic;

    // Check hex mapping
    const normalized = color.toLowerCase();
    const token = HEX_TO_TOKEN[normalized];
    if (token) return token;

    // Return original if no mapping found (allows gradual migration)
    return color;
}

/**
 * Resolve a border value to use CSS variable for color.
 * Parses border shorthand like "1px solid #e5e5e5"
 * 
 * @param border - Border shorthand string
 * @returns Border string with resolved color
 */
export function resolveBorder(border: string | undefined): string | undefined {
    if (!border) return undefined;

    // Match pattern: "Xpx solid #color"
    const match = border.match(/^(\d+px)\s+(solid|dashed|dotted)\s+(#[0-9a-fA-F]{3,6})$/i);
    if (match) {
        const [, size, style, color] = match;
        const resolvedColor = resolveColor(color, "var(--border-primary)");
        return `${size} ${style} ${resolvedColor}`;
    }

    return border;
}

/**
 * Resolve box shadow to use CSS variable.
 * 
 * @param shadow - Shadow string or undefined
 * @returns CSS variable for shadow
 */
export function resolveShadow(shadow: string | undefined): string | undefined {
    if (!shadow) return undefined;

    // Map common shadows to tokens
    if (shadow.includes("0 4px 20px") || shadow.includes("0 10px 40px")) {
        return "var(--shadow-lg)";
    }
    if (shadow.includes("0 4px 6px")) {
        return "var(--shadow-md)";
    }
    if (shadow.includes("0 1px 2px")) {
        return "var(--shadow-sm)";
    }

    return shadow;
}
