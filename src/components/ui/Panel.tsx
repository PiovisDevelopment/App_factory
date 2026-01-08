/**
 * D015 - src/components/ui/Panel.tsx
 * ===================================
 * Atomic panel/card component using design tokens only.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing tokens
 *   - Fully typed props with TypeScript
 *   - Composable header, body, footer sections
 */

import React, { forwardRef, type ReactNode, type HTMLAttributes } from "react";

/**
 * Panel variant styles.
 */
const variants = {
  default: [
    "bg-white",
    "border",
    "border-neutral-200",
  ].join(" "),

  elevated: [
    "bg-white",
    "shadow-md",
  ].join(" "),

  filled: [
    "bg-neutral-50",
    "border",
    "border-neutral-200",
  ].join(" "),

  ghost: [
    "bg-transparent",
  ].join(" "),

  outline: [
    "bg-transparent",
    "border-2",
    "border-neutral-300",
  ].join(" "),
} as const;

/**
 * Panel padding presets.
 */
const paddings = {
  none: "",
  sm: "p-3",
  md: "p-4",
  lg: "p-6",
  xl: "p-8",
} as const;

/**
 * Panel radius presets.
 */
const radii = {
  none: "rounded-none",
  sm: "rounded-sm",
  md: "rounded-md",
  lg: "rounded-lg",
  xl: "rounded-xl",
  full: "rounded-2xl",
} as const;

/**
 * Panel component props.
 */
export interface PanelProps extends HTMLAttributes<HTMLDivElement> {
  /** Visual variant */
  variant?: keyof typeof variants;
  /** Padding preset */
  padding?: keyof typeof paddings;
  /** Border radius preset */
  radius?: keyof typeof radii;
  /** Whether panel is collapsible */
  collapsible?: boolean;
  /** Whether panel is collapsed (controlled) */
  isCollapsed?: boolean;
  /** Default collapsed state (uncontrolled) */
  defaultCollapsed?: boolean;
  /** Callback when collapse state changes */
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Header content */
  header?: ReactNode;
  /** Footer content */
  footer?: ReactNode;
  /** Whether to show header divider */
  showHeaderDivider?: boolean;
  /** Whether to show footer divider */
  showFooterDivider?: boolean;
}

/**
 * Chevron icon for collapsible panels.
 */
const ChevronIcon: React.FC<{ collapsed: boolean }> = ({ collapsed }) => (
  <svg
    className={[
      "h-5",
      "w-5",
      "text-neutral-500",
      "transition-transform",
      "duration-200",
      collapsed ? "" : "rotate-180",
    ].join(" ")}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/**
 * Panel component.
 *
 * A versatile container component with support for headers, footers,
 * collapsible content, and multiple visual variants. Uses design tokens exclusively.
 *
 * @example
 * ```tsx
 * // Basic panel
 * <Panel variant="elevated" padding="lg">
 *   <p>Panel content goes here</p>
 * </Panel>
 *
 * // Panel with header and footer
 * <Panel
 *   header={<h3>Settings</h3>}
 *   footer={<Button>Save</Button>}
 *   showHeaderDivider
 *   showFooterDivider
 * >
 *   <SettingsForm />
 * </Panel>
 *
 * // Collapsible panel
 * <Panel
 *   collapsible
 *   header="Advanced Options"
 *   defaultCollapsed
 * >
 *   <AdvancedSettings />
 * </Panel>
 * ```
 */
export const Panel = forwardRef<HTMLDivElement, PanelProps>(
  (
    {
      variant = "default",
      padding = "md",
      radius = "lg",
      collapsible = false,
      isCollapsed: controlledCollapsed,
      defaultCollapsed = false,
      onCollapsedChange,
      header,
      footer,
      showHeaderDivider = false,
      showFooterDivider = false,
      className = "",
      children,
      ...props
    },
    ref
  ) => {
    // Handle controlled vs uncontrolled collapsed state
    const [internalCollapsed, setInternalCollapsed] = React.useState(defaultCollapsed);
    const isCollapsed = controlledCollapsed ?? internalCollapsed;

    const handleToggleCollapse = () => {
      const newValue = !isCollapsed;
      if (controlledCollapsed === undefined) {
        setInternalCollapsed(newValue);
      }
      onCollapsedChange?.(newValue);
    };

    // Base panel styles
    const panelStyles = [
      variants[variant],
      radii[radius],
      "overflow-hidden",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    // Header styles
    const headerStyles = [
      "flex",
      "items-center",
      "justify-between",
      paddings[padding],
      showHeaderDivider ? "border-b border-neutral-200" : "",
    ]
      .filter(Boolean)
      .join(" ");

    // Collapsible header button styles
    const headerButtonStyles = [
      "flex",
      "items-center",
      "justify-between",
      "w-full",
      paddings[padding],
      "text-left",
      "hover:bg-neutral-50",
      "focus:outline-none",
      "focus:ring-2",
      "focus:ring-inset",
      "focus:ring-primary-500",
      "transition-colors",
      "duration-150",
      showHeaderDivider && !isCollapsed ? "border-b border-neutral-200" : "",
    ]
      .filter(Boolean)
      .join(" ");

    // Body styles
    const bodyStyles = [
      paddings[padding],
    ].join(" ");

    // Footer styles
    const footerStyles = [
      paddings[padding],
      showFooterDivider ? "border-t border-neutral-200" : "",
    ]
      .filter(Boolean)
      .join(" ");

    // Header content wrapper styles
    const headerContentStyles = [
      "flex-1",
      "font-semibold",
      "text-neutral-900",
    ].join(" ");

    return (
      <div ref={ref} className={panelStyles} {...props}>
        {/* Header section */}
        {header && (
          collapsible ? (
            <button
              type="button"
              onClick={handleToggleCollapse}
              aria-expanded={!isCollapsed}
              className={headerButtonStyles}
            >
              <div className={headerContentStyles}>
                {header}
              </div>
              <ChevronIcon collapsed={isCollapsed} />
            </button>
          ) : (
            <div className={headerStyles}>
              <div className={headerContentStyles}>
                {header}
              </div>
            </div>
          )
        )}

        {/* Body section - hidden when collapsed */}
        {!isCollapsed && (
          <div className={bodyStyles}>
            {children}
          </div>
        )}

        {/* Footer section - hidden when collapsed */}
        {footer && !isCollapsed && (
          <div className={footerStyles}>
            {footer}
          </div>
        )}
      </div>
    );
  }
);

Panel.displayName = "Panel";

/**
 * PanelHeader component for structured panel headers.
 */
export interface PanelHeaderProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  /** Title text or element */
  title?: ReactNode;
  /** Subtitle text or element */
  subtitle?: ReactNode;
  /** Actions to display on the right side */
  actions?: ReactNode;
  /** Native title attribute (tooltip) */
  htmlTitle?: string;
}

export const PanelHeader = forwardRef<HTMLDivElement, PanelHeaderProps>(
  ({ title, subtitle, actions, className = "", children, htmlTitle, ...props }, ref) => {
    const headerClasses = [
      "flex",
      "items-start",
      "justify-between",
      "gap-4",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div
        ref={ref}
        className={headerClasses}
        {...(htmlTitle ? { title: htmlTitle } : {})}
        {...props}
      >
        {(title || subtitle) ? (
          <div className="flex-1 min-w-0">
            {title && (
              <h3 className="text-lg font-semibold text-neutral-900 truncate">
                {title}
              </h3>
            )}
            {subtitle && (
              <p className="text-sm text-neutral-500 mt-0.5">
                {subtitle}
              </p>
            )}
          </div>
        ) : children}
        {actions && (
          <div className="flex items-center gap-2 shrink-0">
            {actions}
          </div>
        )}
      </div>
    );
  }
);

PanelHeader.displayName = "PanelHeader";

/**
 * PanelBody component for panel content with consistent styling.
 */
export interface PanelBodyProps extends HTMLAttributes<HTMLDivElement> {
  /** Padding preset override */
  padding?: keyof typeof paddings;
}

export const PanelBody = forwardRef<HTMLDivElement, PanelBodyProps>(
  ({ padding = "none", className = "", children, ...props }, ref) => {
    const bodyClasses = [
      paddings[padding],
      "text-neutral-700",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={ref} className={bodyClasses} {...props}>
        {children}
      </div>
    );
  }
);

PanelBody.displayName = "PanelBody";

/**
 * PanelFooter component for panel footers with consistent styling.
 */
export interface PanelFooterProps extends HTMLAttributes<HTMLDivElement> {
  /** Alignment of footer content */
  align?: "left" | "center" | "right" | "between";
}

const alignmentStyles = {
  left: "justify-start",
  center: "justify-center",
  right: "justify-end",
  between: "justify-between",
} as const;

export const PanelFooter = forwardRef<HTMLDivElement, PanelFooterProps>(
  ({ align = "right", className = "", children, ...props }, ref) => {
    const footerClasses = [
      "flex",
      "items-center",
      "gap-3",
      alignmentStyles[align],
      className,
    ]
      .filter(Boolean)
      .join(" ");

    return (
      <div ref={ref} className={footerClasses} {...props}>
        {children}
      </div>
    );
  }
);

PanelFooter.displayName = "PanelFooter";

export default Panel;
