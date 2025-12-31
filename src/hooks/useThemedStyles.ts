/**
 * useThemedStyles.ts
 * ==================
 * Hook that generates inline style objects from the current theme.
 * Used to apply theme customizations to canvas and preview components.
 *
 * Dependencies: D016 (ThemeProvider.tsx)
 */

import { useMemo } from 'react';
import { useThemeStore, type ThemeConfig } from '../context/ThemeProvider';

/**
 * Themed CSS custom properties that can be applied as inline styles.
 * Uses Record type to allow CSS custom property keys.
 */
export type ThemedCSSProperties = Record<string, string | number | undefined>;

/**
 * Generate CSS custom properties from a theme configuration.
 * These can be applied as inline styles to create a themed context.
 *
 * @param theme - The theme configuration to convert
 * @returns Object containing CSS custom properties
 */
export function generateThemeCSSProperties(theme: ThemeConfig): ThemedCSSProperties {
    const properties: ThemedCSSProperties = {};

    // Inject colors
    Object.entries(theme.colors).forEach(([category, scale]) => {
        Object.entries(scale).forEach(([shade, value]) => {
            properties[`--color-${category}-${shade}`] = value as string;
        });
    });

    // Inject typography
    properties['--font-family-sans'] = theme.typography.fontFamily.sans;
    properties['--font-family-mono'] = theme.typography.fontFamily.mono;

    Object.entries(theme.typography.fontSize).forEach(([key, value]) => {
        properties[`--font-size-${key}`] = value;
    });

    // Inject spacing
    Object.entries(theme.spacing).forEach(([key, value]) => {
        properties[`--spacing-${key}`] = value;
    });

    // Inject radius
    Object.entries(theme.radius).forEach(([key, value]) => {
        properties[`--radius-${key}`] = value;
    });

    // Inject shadows
    Object.entries(theme.shadows).forEach(([key, value]) => {
        properties[`--shadow-${key}`] = value;
    });

    // Set background and text based on mode
    if (theme.mode === 'dark') {
        properties.backgroundColor = theme.colors.neutral[50]; // Dark background
        properties.color = theme.colors.neutral[950]; // Light text
    } else {
        properties.backgroundColor = theme.colors.neutral[50]; // Light background
        properties.color = theme.colors.neutral[950]; // Dark text
    }

    // Set font family
    properties.fontFamily = theme.typography.fontFamily.sans;

    return properties;
}

/**
 * Hook that returns themed styles from the current theme store.
 * 
 * @example
 * ```tsx
 * const { themedStyles, theme, cssVariables } = useThemedStyles();
 * 
 * return (
 *   <div style={themedStyles}>
 *     Content with theme applied
 *   </div>
 * );
 * ```
 */
export function useThemedStyles() {
    const theme = useThemeStore((state) => state.theme);

    const themedStyles = useMemo(() => {
        return generateThemeCSSProperties(theme);
    }, [theme]);

    // Generate primary color for common use cases
    const primaryColor = theme.colors.primary[500];
    const primaryColorLight = theme.colors.primary[50];
    const primaryColorDark = theme.colors.primary[700];

    // Generate semantic colors
    const semanticColors = useMemo(() => ({
        primary: theme.colors.primary[500],
        primaryBg: theme.colors.primary[50],
        neutral: theme.colors.neutral[500],
        neutralBg: theme.colors.neutral[50],
        success: theme.colors.success[500] || '#22c55e',
        successBg: theme.colors.success[50] || '#f0fdf4',
        warning: theme.colors.warning[500] || '#f59e0b',
        warningBg: theme.colors.warning[50] || '#fffbeb',
        error: theme.colors.error[500] || '#ef4444',
        errorBg: theme.colors.error[50] || '#fef2f2',
        info: theme.colors.info[500] || '#3b82f6',
        infoBg: theme.colors.info[50] || '#eff6ff',
    }), [theme.colors]);

    return {
        /** Full themed inline styles including CSS custom properties */
        themedStyles,
        /** Current theme configuration */
        theme,
        /** Primary color value */
        primaryColor,
        primaryColorLight,
        primaryColorDark,
        /** Semantic color shortcuts */
        semanticColors,
        /** Whether dark mode is active */
        isDarkMode: theme.mode === 'dark',
    };
}

export default useThemedStyles;
