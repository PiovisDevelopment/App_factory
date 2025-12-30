/**
 * D012 - src/components/ui/Select.tsx
 * ====================================
 * Atomic select component using design tokens only.
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
  type SelectHTMLAttributes,
  type ReactNode,
} from "react";

/**
 * Select size styles mapped to Tailwind classes.
 */
const sizes = {
  xs: "px-2 py-1 text-xs pr-7",
  sm: "px-3 py-1.5 text-sm pr-8",
  md: "px-4 py-2 text-base pr-10",
  lg: "px-4 py-2.5 text-lg pr-10",
  xl: "px-5 py-3 text-xl pr-12",
} as const;

/**
 * Select variant styles.
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
} as const;

/**
 * Option type for type-safe option lists.
 */
export interface SelectOption {
  /** Option value */
  value: string;
  /** Display label */
  label: string;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Option group type for grouped options.
 */
export interface SelectOptionGroup {
  /** Group label */
  label: string;
  /** Options within this group */
  options: SelectOption[];
}

/**
 * Select component props.
 */
export interface SelectProps
  extends Omit<SelectHTMLAttributes<HTMLSelectElement>, "size"> {
  /** Size preset */
  size?: keyof typeof sizes;
  /** Visual variant */
  variant?: keyof typeof variants;
  /** Options array */
  options?: SelectOption[];
  /** Grouped options */
  optionGroups?: SelectOptionGroup[];
  /** Error state */
  error?: boolean;
  /** Error message to display */
  errorMessage?: string;
  /** Label text (recommended for accessibility) */
  label?: string;
  /** Helper text displayed below select */
  helperText?: string;
  /** Placeholder option text */
  placeholder?: string;
  /** Full width select */
  fullWidth?: boolean;
  /** Required field indicator */
  isRequired?: boolean;
  /** Left icon/element */
  leftElement?: ReactNode;
}

/**
 * Chevron down icon for the select dropdown indicator.
 */
const ChevronDownIcon = () => (
  <svg
    className="h-5 w-5 text-neutral-400"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 20 20"
    fill="currentColor"
    aria-hidden="true"
  >
    <path
      fillRule="evenodd"
      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
      clipRule="evenodd"
    />
  </svg>
);

/**
 * Select component.
 *
 * A fully accessible select/dropdown with support for options, groups,
 * labels, error states, and helper text. Uses design tokens exclusively.
 *
 * @example
 * ```tsx
 * <Select
 *   label="Country"
 *   placeholder="Select a country"
 *   options={[
 *     { value: "us", label: "United States" },
 *     { value: "uk", label: "United Kingdom" },
 *     { value: "ca", label: "Canada" },
 *   ]}
 * />
 *
 * <Select
 *   label="Category"
 *   optionGroups={[
 *     {
 *       label: "Fruits",
 *       options: [
 *         { value: "apple", label: "Apple" },
 *         { value: "banana", label: "Banana" },
 *       ],
 *     },
 *     {
 *       label: "Vegetables",
 *       options: [
 *         { value: "carrot", label: "Carrot" },
 *         { value: "broccoli", label: "Broccoli" },
 *       ],
 *     },
 *   ]}
 * />
 * ```
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  (
    {
      size = "md",
      variant = "default",
      options = [],
      optionGroups = [],
      error = false,
      errorMessage,
      label,
      helperText,
      placeholder,
      fullWidth = false,
      isRequired = false,
      leftElement,
      disabled,
      id,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    // Generate unique ID for accessibility if not provided
    const generatedId = useId();
    const selectId = id || generatedId;
    const errorId = `${selectId}-error`;
    const helperId = `${selectId}-helper`;

    // Base select styles
    const baseStyles = [
      "block",
      "w-full",
      "rounded-md",
      "border",
      "bg-white",
      "text-neutral-900",
      "appearance-none",
      "cursor-pointer",
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

    // Left padding for left element
    const leftPadding = leftElement ? "pl-10" : "";

    // Compose final select class string
    const selectClasses = [
      baseStyles,
      sizes[size],
      error ? errorStyles : variants[variant],
      leftPadding,
      className,
    ]
      .filter(Boolean)
      .join(" ");

    // Container width
    const containerWidth = fullWidth ? "w-full" : "w-auto";

    // Determine if we should render options or children
    const hasOptions = options.length > 0 || optionGroups.length > 0;

    return (
      <div className={containerWidth}>
        {/* Label */}
        {label && (
          <label
            htmlFor={selectId}
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

        {/* Select wrapper for positioned elements */}
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

          {/* Select element */}
          <select
            ref={ref}
            id={selectId}
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
            className={selectClasses}
            {...props}
          >
            {/* Placeholder option */}
            {placeholder && (
              <option value="" disabled>
                {placeholder}
              </option>
            )}

            {/* Render options if provided */}
            {hasOptions ? (
              <>
                {/* Flat options */}
                {options.map((option) => (
                  <option
                    key={option.value}
                    value={option.value}
                    disabled={option.disabled}
                  >
                    {option.label}
                  </option>
                ))}

                {/* Grouped options */}
                {optionGroups.map((group) => (
                  <optgroup key={group.label} label={group.label}>
                    {group.options.map((option) => (
                      <option
                        key={option.value}
                        value={option.value}
                        disabled={option.disabled}
                      >
                        {option.label}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </>
            ) : (
              // Render children if no options provided
              children
            )}
          </select>

          {/* Dropdown indicator */}
          <div
            className={[
              "absolute",
              "inset-y-0",
              "right-0",
              "flex",
              "items-center",
              "pr-2",
              "pointer-events-none",
            ].join(" ")}
            aria-hidden="true"
          >
            <ChevronDownIcon />
          </div>
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

Select.displayName = "Select";

export default Select;
