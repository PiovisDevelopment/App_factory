/**
 * D011 - src/components/ui/Input.tsx
 * ===================================
 * Atomic input component using design tokens only.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing tokens
 *   - Fully typed props with TypeScript
 *   - Accessible by default (ARIA, labels, error states)
 */

import {
  forwardRef,
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

/**
 * Input size styles mapped to Tailwind classes.
 */
const sizes = {
  xs: "px-2 py-1 text-xs",
  sm: "px-3 py-1.5 text-sm",
  md: "px-4 py-2 text-base",
  lg: "px-4 py-2.5 text-lg",
  xl: "px-5 py-3 text-xl",
} as const;

/**
 * Input variant styles.
 */
const variants = {
  default: [
    "border-neutral-300",
    "focus:border-primary-500",
    "focus:ring-primary-500",
  ].join(" "),

  filled: [
    "bg-neutral-100",
    "border-transparent",
    "focus:bg-white",
    "focus:border-primary-500",
    "focus:ring-primary-500",
  ].join(" "),

  flushed: [
    "border-x-0",
    "border-t-0",
    "border-b-2",
    "rounded-none",
    "px-0",
    "focus:border-primary-500",
    "focus:ring-0",
  ].join(" "),
} as const;

/**
 * Input component props.
 */
export interface InputProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size"> {
  /** Size preset */
  size?: keyof typeof sizes;
  /** Visual variant */
  variant?: keyof typeof variants;
  /** Error state */
  error?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Label text (recommended for accessibility) */
  label?: string;
  /** Helper text displayed below input */
  helperText?: string;
  /** Icon or element on the left side */
  leftElement?: ReactNode;
  /** Icon or element on the right side */
  rightElement?: ReactNode;
  /** Full width input */
  fullWidth?: boolean;
  /** Required field indicator */
  isRequired?: boolean;
}

/**
 * Input component.
 *
 * A fully accessible text input with support for labels, error states,
 * helper text, and decorative elements. Uses design tokens exclusively.
 *
 * @example
 * ```tsx
 * <Input
 *   label="Email"
 *   type="email"
 *   placeholder="Enter your email"
 *   helperText="We'll never share your email"
 * />
 *
 * <Input
 *   label="Password"
 *   type="password"
 *   error
 *   errorMessage="Password must be at least 8 characters"
 * />
 *
 * <Input
 *   leftElement={<SearchIcon />}
 *   placeholder="Search..."
 * />
 * ```
 */
export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      size = "md",
      variant = "default",
      error = false,
      errorMessage,
      label,
      helperText,
      leftElement,
      rightElement,
      fullWidth = false,
      isRequired = false,
      disabled,
      id,
      className = "",
      ...props
    },
    ref
  ) => {
    // Generate unique ID for accessibility if not provided
    const generatedId = useId();
    const inputId = id || generatedId;
    const errorId = `${inputId}-error`;
    const helperId = `${inputId}-helper`;

    // Base input styles
    const baseStyles = [
      "block",
      "w-full",
      "rounded-md",
      "border",
      "bg-white",
      "text-neutral-900",
      "placeholder:text-neutral-400",
      "transition-colors",
      "duration-150",
      "focus:outline-none",
      "focus:ring-2",
      "focus:ring-offset-0",
      "disabled:bg-neutral-50",
      "disabled:text-neutral-500",
      "disabled:cursor-not-allowed",
    ].join(" ");

    // Error state styles
    const errorStyles = error
      ? [
          "border-error-500",
          "focus:border-error-500",
          "focus:ring-error-500",
          "text-error-900",
        ].join(" ")
      : "";

    // Padding adjustments for left/right elements
    const leftPadding = leftElement ? "pl-10" : "";
    const rightPadding = rightElement ? "pr-10" : "";

    // Compose final input class string
    const inputClasses = [
      baseStyles,
      sizes[size],
      error ? errorStyles : variants[variant],
      leftPadding,
      rightPadding,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    // Container width
    const containerWidth = fullWidth ? "w-full" : "w-auto";

    return (
      <div className={containerWidth}>
        {/* Label */}
        {label && (
          <label
            htmlFor={inputId}
            className={[
              "block",
              "mb-1.5",
              "text-sm",
              "font-medium",
              error ? "text-error-700" : "text-neutral-700",
            ].join(" ")}
          >
            {label}
            {isRequired && (
              <span className="text-error-500 ml-0.5" aria-hidden="true">
                *
              </span>
            )}
          </label>
        )}

        {/* Input wrapper for positioned elements */}
        <div className="relative">
          {/* Left element */}
          {leftElement && (
            <div
              className={[
                "absolute",
                "inset-y-0",
                "left-0",
                "flex",
                "items-center",
                "pl-3",
                "pointer-events-none",
                error ? "text-error-500" : "text-neutral-400",
              ].join(" ")}
              aria-hidden="true"
            >
              {leftElement}
            </div>
          )}

          {/* Input element */}
          <input
            ref={ref}
            id={inputId}
            disabled={disabled}
            aria-invalid={error}
            aria-required={isRequired}
            aria-describedby={
              [
                error && errorMessage ? errorId : null,
                helperText ? helperId : null,
              ]
                .filter(Boolean)
                .join(" ") || undefined
            }
            className={inputClasses}
            {...props}
          />

          {/* Right element */}
          {rightElement && (
            <div
              className={[
                "absolute",
                "inset-y-0",
                "right-0",
                "flex",
                "items-center",
                "pr-3",
              ].join(" ")}
            >
              {rightElement}
            </div>
          )}
        </div>

        {/* Error message - takes priority over helper text */}
        {error && errorMessage && (
          <p
            id={errorId}
            className="mt-1.5 text-sm text-error-600"
            role="alert"
            aria-live="polite"
          >
            {errorMessage}
          </p>
        )}

        {/* Helper text - hidden when error message is shown */}
        {helperText && !(error && errorMessage) && (
          <p
            id={helperId}
            className="mt-1.5 text-sm text-neutral-500"
          >
            {helperText}
          </p>
        )}
      </div>
    );
  }
);

Input.displayName = "Input";

export default Input;
