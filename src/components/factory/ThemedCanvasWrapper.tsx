/**
 * ThemedCanvasWrapper.tsx
 * =======================
 * A wrapper component that applies the current theme's CSS custom properties
 * to its children. This enables canvas and preview components to reflect
 * theme customizations made in the ThemeCustomizationPanel.
 *
 * Dependencies: useThemedStyles hook, ThemeProvider
 */

import React, { type ReactNode, type CSSProperties } from 'react';
import { useThemedStyles } from '../../hooks/useThemedStyles';

export interface ThemedCanvasWrapperProps {
    /** Child content to render within themed context */
    children: ReactNode;
    /** Additional CSS class names */
    className?: string;
    /** Additional inline styles to merge */
    style?: CSSProperties;
    /** Whether to apply background color from theme */
    applyBackground?: boolean;
    /** HTML element to render (defaults to 'div') */
    as?: 'div' | 'section' | 'article' | 'main';
}

/**
 * ThemedCanvasWrapper component.
 *
 * Wraps content with CSS custom properties from the current theme,
 * enabling child components using Tailwind utility classes to reflect
 * theme customizations.
 *
 * @example
 * ```tsx
 * <ThemedCanvasWrapper applyBackground>
 *   <Button variant="primary">Themed Button</Button>
 * </ThemedCanvasWrapper>
 * ```
 */
export const ThemedCanvasWrapper: React.FC<ThemedCanvasWrapperProps> = ({
    children,
    className = '',
    style = {},
    applyBackground = true,
    as: Component = 'div',
}) => {
    const { themedStyles, isDarkMode } = useThemedStyles();

    // Merge themed styles with any additional styles
    const mergedStyles: CSSProperties = {
        ...themedStyles,
        // Only apply background if requested
        ...(applyBackground ? {} : { backgroundColor: 'transparent' }),
        // Merge in any additional styles
        ...style,
    };

    // Add dark mode class for Tailwind dark: variants if needed
    const wrapperClassName = [
        'themed-canvas-wrapper',
        isDarkMode ? 'dark' : '',
        className,
    ].filter(Boolean).join(' ');

    return (
        <Component className={wrapperClassName} style={mergedStyles}>
            {children}
        </Component>
    );
};

ThemedCanvasWrapper.displayName = 'ThemedCanvasWrapper';

export default ThemedCanvasWrapper;
