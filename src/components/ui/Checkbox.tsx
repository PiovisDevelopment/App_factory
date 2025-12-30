/**
 * D013 - src/components/ui/Checkbox.tsx
 * ======================================
 * Atomic checkbox component using design tokens only.
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
  useId,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";

/**
 * Checkbox size styles mapped to Tailwind classes.
 */
const sizes = {
  sm: {
    checkbox: "h-4 w-4",
    label: "text-sm",
    gap: "gap-2",
  },
  md: {
    checkbox: "h-5 w-5",
    label: "text-base",
    gap: "gap-2.5",
  },
  lg: {
    checkbox: "h-6 w-6",
    label: "text-lg",
    gap: "gap-3",
  },
} as const;

/**
 * Color variant styles for checkbox.
 */
const colorVariants = {
  primary: {
    checked: "checked:bg-primary-600 checked:border-primary-600",
    focus: "focus:ring-primary-500",
  },
  success: {
    checked: "checked:bg-success-600 checked:border-success-600",
    focus: "focus:ring-success-500",
  },
  warning: {
    checked: "checked:bg-warning-600 checked:border-warning-600",
    focus: "focus:ring-warning-500",
  },
  error: {
    checked: "checked:bg-error-600 checked:border-error-600",
    focus: "focus:ring-error-500",
  },
} as const;

/**
 * Checkbox component props.
 */
export interface CheckboxProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, "size" | "type"> {
  /** Size preset */
  size?: keyof typeof sizes;
  /** Color variant when checked */
  colorScheme?: keyof typeof colorVariants;
  /** Label text */
  label?: ReactNode;
  /** Description text below label */
  description?: string;
  /** Error state */
  error?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Indeterminate state (partially checked) */
  indeterminate?: boolean;
  /** Required field indicator */
  isRequired?: boolean;
}

/**
 * Checkmark icon SVG.
 */
const CheckIcon = () => (
  <svg
    className="absolute h-full w-full text-white pointer-events-none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Minus icon for indeterminate state.
 */
const MinusIcon = () => (
  <svg
    className="absolute h-full w-full text-white pointer-events-none"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="3"
    strokeLinecap="round"
    aria-hidden="true"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/**
 * Checkbox component.
 *
 * A fully accessible checkbox with support for labels, descriptions,
 * error states, and indeterminate state. Uses design tokens exclusively.
 *
 * @example
 * ```tsx
 * <Checkbox
 *   label="Accept terms and conditions"
 *   description="You must accept to continue"
 * />
 *
 * <Checkbox
 *   label="Select all"
 *   indeterminate
 * />
 *
 * <Checkbox
 *   label="Agree to policy"
 *   error
 *   errorMessage="You must agree to the policy"
 * />
 * ```
 */
export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  (
    {
      size = "md",
      colorScheme = "primary",
      label,
      description,
      error = false,
      errorMessage,
      indeterminate = false,
      isRequired = false,
      disabled,
      checked,
      defaultChecked,
      id,
      className = "",
      ...props
    },
    ref
  ) => {
    // Generate unique ID for accessibility if not provided
    const generatedId = useId();
    const checkboxId = id || generatedId;
    const errorId = `${checkboxId}-error`;
    const descriptionId = `${checkboxId}-description`;

    // Get size configuration
    const sizeConfig = sizes[size];
    const colorConfig = colorVariants[colorScheme];

    // Base checkbox styles (the actual input)
    const checkboxBaseStyles = [
      "appearance-none",
      "shrink-0",
      "rounded",
      "border-2",
      "border-neutral-300",
      "bg-white",
      "cursor-pointer",
      "transition-all",
      "duration-150",
      "focus:outline-none",
      "focus:ring-2",
      "focus:ring-offset-2",
      colorConfig.focus,
      colorConfig.checked,
      "hover:border-neutral-400",
      "checked:hover:opacity-90",
      "disabled:bg-neutral-100",
      "disabled:border-neutral-200",
      "disabled:cursor-not-allowed",
      "disabled:checked:bg-neutral-400",
      "disabled:checked:border-neutral-400",
    ].join(" ");

    // Error state border
    const errorBorderStyles = error
      ? "border-error-500 focus:ring-error-500"
      : "";

    // Compose checkbox classes
    const checkboxClasses = [
      checkboxBaseStyles,
      sizeConfig.checkbox,
      errorBorderStyles,
    ]
      .filter(Boolean)
      .join(" ");

    // Label text styles
    const labelStyles = [
      sizeConfig.label,
      "font-medium",
      "select-none",
      error ? "text-error-700" : "text-neutral-700",
      disabled ? "text-neutral-400" : "",
    ]
      .filter(Boolean)
      .join(" ");

    // Container styles
    const containerStyles = [
      "inline-flex",
      "items-start",
      sizeConfig.gap,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    // Determine if checkbox should appear checked
    const isChecked = checked ?? defaultChecked ?? false;

    return (
      <div className="flex flex-col">
        <label className={containerStyles}>
          {/* Checkbox input wrapper */}
          <span className="relative flex items-center justify-center">
            <input
              ref={(node) => {
                // Handle both ref forwarding and indeterminate state
                if (typeof ref === "function") {
                  ref(node);
                } else if (ref) {
                  ref.current = node;
                }
                if (node) {
                  node.indeterminate = indeterminate;
                }
              }}
              type="checkbox"
              id={checkboxId}
              disabled={disabled}
              checked={checked}
              defaultChecked={defaultChecked}
              aria-invalid={error}
              aria-required={isRequired}
              aria-describedby={
                [
                  description ? descriptionId : null,
                  error && errorMessage ? errorId : null,
                ]
                  .filter(Boolean)
                  .join(" ") || undefined
              }
              className={checkboxClasses}
              {...props}
            />

            {/* Visual checkmark/minus overlay */}
            <span
              className={[
                "absolute",
                "inset-0",
                "flex",
                "items-center",
                "justify-center",
                "pointer-events-none",
                "opacity-0",
                "transition-opacity",
                "duration-150",
                // Show icon when checked or indeterminate via peer selector would be ideal,
                // but we'll use CSS to handle this via the :checked pseudo-selector
              ].join(" ")}
              style={{
                opacity: isChecked || indeterminate ? 1 : 0,
              }}
            >
              {indeterminate ? <MinusIcon /> : <CheckIcon />}
            </span>
          </span>

          {/* Label and description */}
          {(label || description) && (
            <span className="flex flex-col">
              {label && (
                <span className={labelStyles}>
                  {label}
                  {isRequired && (
                    <span className="text-error-500 ml-0.5" aria-hidden="true">
                      *
                    </span>
                  )}
                </span>
              )}
              {description && (
                <span
                  id={descriptionId}
                  className={[
                    "text-sm",
                    "text-neutral-500",
                    disabled ? "text-neutral-400" : "",
                  ]
                    .filter(Boolean)
                    .join(" ")}
                >
                  {description}
                </span>
              )}
            </span>
          )}
        </label>

        {/* Error message */}
        {error && errorMessage && (
          <p
            id={errorId}
            className={[
              "mt-1.5",
              "text-sm",
              "text-error-600",
              label || description ? `ml-[calc(${sizeConfig.checkbox}+0.625rem)]` : "",
            ]
              .filter(Boolean)
              .join(" ")}
            role="alert"
            aria-live="polite"
          >
            {errorMessage}
          </p>
        )}
      </div>
    );
  }
);

Checkbox.displayName = "Checkbox";

export default Checkbox;
