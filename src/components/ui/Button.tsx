/**
 * D010 - src/components/ui/Button.tsx
 * ====================================
 * Atomic button component using design tokens only.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing tokens
 *   - Fully typed props with TypeScript
 *   - Accessible by default (ARIA, keyboard navigation)
 */

import React, {
  forwardRef,
  type ButtonHTMLAttributes,
  type ReactNode,
} from "react";

/**
 * Button variant styles mapped to Tailwind classes.
 * All colors reference semantic token aliases from design_tokens.css.
 */
const variants = {
  primary: [
    "bg-primary-600",
    "text-white",
    "hover:bg-primary-700",
    "focus:ring-primary-500",
    "active:bg-primary-800",
    "disabled:bg-primary-300",
  ].join(" "),

  secondary: [
    "bg-neutral-100",
    "text-neutral-800",
    "hover:bg-neutral-200",
    "focus:ring-neutral-400",
    "active:bg-neutral-300",
    "border",
    "border-neutral-300",
    "disabled:bg-neutral-50",
    "disabled:text-neutral-400",
  ].join(" "),

  outline: [
    "bg-transparent",
    "text-primary-600",
    "border",
    "border-primary-600",
    "hover:bg-primary-50",
    "focus:ring-primary-500",
    "active:bg-primary-100",
    "disabled:text-primary-300",
    "disabled:border-primary-300",
  ].join(" "),

  ghost: [
    "bg-transparent",
    "text-neutral-700",
    "hover:bg-neutral-100",
    "focus:ring-neutral-400",
    "active:bg-neutral-200",
    "disabled:text-neutral-400",
  ].join(" "),

  danger: [
    "bg-error-600",
    "text-white",
    "hover:bg-error-700",
    "focus:ring-error-500",
    "active:bg-error-800",
    "disabled:bg-error-300",
  ].join(" "),

  success: [
    "bg-success-600",
    "text-white",
    "hover:bg-success-700",
    "focus:ring-success-500",
    "active:bg-success-800",
    "disabled:bg-success-300",
  ].join(" "),
} as const;

/**
 * Button size styles mapped to Tailwind classes.
 * Uses spacing tokens from design system.
 */
const sizes = {
  xs: "px-2 py-1 text-xs gap-1",
  sm: "px-3 py-1.5 text-sm gap-1.5",
  md: "px-4 py-2 text-base gap-2",
  lg: "px-5 py-2.5 text-lg gap-2.5",
  xl: "px-6 py-3 text-xl gap-3",
} as const;

/**
 * Icon-only button sizes (square aspect ratio).
 */
const iconSizes = {
  xs: "p-1 text-xs",
  sm: "p-1.5 text-sm",
  md: "p-2 text-base",
  lg: "p-2.5 text-lg",
  xl: "p-3 text-xl",
} as const;

/**
 * Button component props.
 */
export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Visual variant */
  variant?: keyof typeof variants;
  /** Size preset */
  size?: keyof typeof sizes;
  /** Render as icon-only button (square) */
  iconOnly?: boolean;
  /** Loading state - shows spinner and disables interaction */
  loading?: boolean;
  /** Full width button */
  fullWidth?: boolean;
  /** Icon on the left side of text */
  leftIcon?: ReactNode;
  /** Icon on the right side of text */
  rightIcon?: ReactNode;
  /** Pill-shaped corners */
  pill?: boolean;
}

/**
 * Button component.
 *
 * A fully accessible button with multiple variants, sizes, and states.
 * Uses design tokens exclusively for consistent theming.
 *
 * @example
 * ```tsx
 * <Button variant="primary" size="md">
 *   Click me
 * </Button>
 *
 * <Button variant="outline" leftIcon={<PlusIcon />}>
 *   Add item
 * </Button>
 *
 * <Button loading>
 *   Saving...
 * </Button>
 * ```
 */
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      iconOnly = false,
      loading = false,
      fullWidth = false,
      leftIcon,
      rightIcon,
      pill = false,
      disabled,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    // Base styles applied to all buttons
    const baseStyles = [
      "inline-flex",
      "items-center",
      "justify-center",
      "font-medium",
      "transition-all",
      "duration-150",
      "focus:outline-none",
      "focus:ring-2",
      "focus:ring-offset-2",
      "disabled:cursor-not-allowed",
      "disabled:opacity-60",
    ].join(" ");

    // Determine border radius
    const radiusStyles = pill ? "rounded-full" : "rounded-md";

    // Determine size styles based on iconOnly mode
    const sizeStyles = iconOnly ? iconSizes[size] : sizes[size];

    // Compose final class string
    const buttonClasses = [
      baseStyles,
      variants[variant],
      sizeStyles,
      radiusStyles,
      fullWidth ? "w-full" : "",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <button
        ref={ref}
        className={buttonClasses}
        disabled={disabled || loading}
        aria-disabled={disabled || loading}
        aria-busy={loading}
        {...props}
      >
        {/* Loading spinner - replaces left icon when loading */}
        {loading && (
          <svg
            className="animate-spin h-4 w-4 shrink-0"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <circle
              className="opacity-25"
              cx="12"
              cy="12"
              r="10"
              stroke="currentColor"
              strokeWidth="4"
            />
            <path
              className="opacity-75"
              fill="currentColor"
              d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
            />
          </svg>
        )}

        {/* Left icon - hidden when loading */}
        {!loading && leftIcon && (
          <span className="shrink-0" aria-hidden="true">
            {leftIcon}
          </span>
        )}

        {/* Button text content */}
        {children && <span>{children}</span>}

        {/* Right icon */}
        {rightIcon && (
          <span className="shrink-0" aria-hidden="true">
            {rightIcon}
          </span>
        )}
      </button>
    );
  }
);

Button.displayName = "Button";

export default Button;
