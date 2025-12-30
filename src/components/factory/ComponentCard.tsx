/**
 * D043 - src/components/factory/ComponentCard.tsx
 * =================================================
 * Individual component card for gallery display.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D042 (ComponentGallery.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 *   - Reusable standalone card component
 */

import React, { forwardRef, type HTMLAttributes } from "react";

/**
 * Component category enumeration.
 */
export type ComponentCategory =
  | "atoms"
  | "molecules"
  | "organisms"
  | "templates"
  | "layouts"
  | "custom";

/**
 * Component type for specific UI patterns.
 */
export type ComponentType =
  | "button"
  | "input"
  | "select"
  | "checkbox"
  | "panel"
  | "modal"
  | "card"
  | "list"
  | "form"
  | "navigation"
  | "container"
  | "custom";

/**
 * Component information interface.
 */
export interface ComponentInfo {
  /** Unique component identifier */
  id: string;
  /** Display name */
  name: string;
  /** Component category */
  category: ComponentCategory;
  /** Component type */
  type: ComponentType;
  /** Short description */
  description: string;
  /** Preview thumbnail URL */
  thumbnail?: string;
  /** Whether component is built-in */
  builtIn?: boolean;
  /** Tags for filtering */
  tags?: string[];
  /** Props schema (simplified) */
  propsSchema?: Record<string, string>;
  /** Default props values */
  defaultProps?: Record<string, unknown>;
  /** Usage example code */
  exampleCode?: string;
  /** Component version */
  version?: string;
  /** Number of props */
  propsCount?: number;
  /** File path */
  filePath?: string;
}

/**
 * Card size variants.
 */
export type CardSize = "sm" | "md" | "lg";

/**
 * Category color mapping.
 */
const categoryColors: Record<ComponentCategory, string> = {
  atoms: "bg-primary-100 text-primary-700 border-primary-200",
  molecules: "bg-success-50 text-success-700 border-success-200",
  organisms: "bg-warning-50 text-warning-700 border-warning-200",
  templates: "bg-info-50 text-info-700 border-info-200",
  layouts: "bg-neutral-100 text-neutral-700 border-neutral-200",
  custom: "bg-neutral-50 text-neutral-600 border-neutral-200",
};

/**
 * Category labels.
 */
const categoryLabels: Record<ComponentCategory, string> = {
  atoms: "Atoms",
  molecules: "Molecules",
  organisms: "Organisms",
  templates: "Templates",
  layouts: "Layouts",
  custom: "Custom",
};

/**
 * Type icons mapping.
 */
const typeIcons: Record<ComponentType, React.FC<{ className?: string }>> = {
  button: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="8" width="18" height="8" rx="2" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
  input: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <line x1="7" y1="12" x2="7" y2="12.01" />
    </svg>
  ),
  select: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="6" width="18" height="12" rx="2" />
      <polyline points="16 10 12 14 8 10" />
    </svg>
  ),
  checkbox: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <polyline points="9 11 12 14 16 10" />
    </svg>
  ),
  panel: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
    </svg>
  ),
  modal: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <line x1="6" y1="8" x2="18" y2="8" />
      <line x1="6" y1="12" x2="14" y2="12" />
    </svg>
  ),
  card: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="7" y1="15" x2="17" y2="15" />
    </svg>
  ),
  list: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <line x1="8" y1="6" x2="21" y2="6" />
      <line x1="8" y1="12" x2="21" y2="12" />
      <line x1="8" y1="18" x2="21" y2="18" />
      <line x1="3" y1="6" x2="3.01" y2="6" />
      <line x1="3" y1="12" x2="3.01" y2="12" />
      <line x1="3" y1="18" x2="3.01" y2="18" />
    </svg>
  ),
  form: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <line x1="7" y1="7" x2="17" y2="7" />
      <rect x="7" y="11" width="10" height="3" rx="1" />
      <line x1="7" y1="17" x2="12" y2="17" />
    </svg>
  ),
  navigation: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="4" rx="1" />
      <line x1="6" y1="5" x2="8" y2="5" />
      <line x1="10" y1="5" x2="12" y2="5" />
      <line x1="14" y1="5" x2="16" y2="5" />
    </svg>
  ),
  container: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" />
      <rect x="7" y="7" width="10" height="10" rx="1" />
    </svg>
  ),
  custom: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  ),
};

/**
 * Size configurations.
 */
const sizeConfigs: Record<CardSize, { padding: string; iconSize: string; titleSize: string; thumbnailHeight: string }> = {
  sm: { padding: "p-3", iconSize: "h-8 w-8", titleSize: "text-sm", thumbnailHeight: "h-16" },
  md: { padding: "p-4", iconSize: "h-10 w-10", titleSize: "text-base", thumbnailHeight: "h-24" },
  lg: { padding: "p-5", iconSize: "h-12 w-12", titleSize: "text-lg", thumbnailHeight: "h-32" },
};

/**
 * ComponentCard component props.
 */
export interface ComponentCardProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Component information */
  component: ComponentInfo;
  /** Whether card is selected */
  isSelected?: boolean;
  /** Card size variant */
  size?: CardSize;
  /** Whether to show full details */
  showDetails?: boolean;
  /** Whether to show action buttons */
  showActions?: boolean;
  /** Whether to show thumbnail */
  showThumbnail?: boolean;
  /** Whether card is interactive (clickable) */
  interactive?: boolean;
  /** Enable drag and drop */
  draggable?: boolean;
  /** Callback when card is clicked */
  onSelect?: (component: ComponentInfo) => void;
  /** Callback when add is requested */
  onAdd?: (component: ComponentInfo) => void;
  /** Callback when edit is requested */
  onEdit?: (component: ComponentInfo) => void;
  /** Callback when info is requested */
  onInfo?: (component: ComponentInfo) => void;
}

/**
 * Add icon.
 */
const AddIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/**
 * Edit icon.
 */
const EditIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
  </svg>
);

/**
 * Info icon.
 */
const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

/**
 * Drag handle icon.
 */
const DragIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="9" cy="5" r="1" />
    <circle cx="9" cy="12" r="1" />
    <circle cx="9" cy="19" r="1" />
    <circle cx="15" cy="5" r="1" />
    <circle cx="15" cy="12" r="1" />
    <circle cx="15" cy="19" r="1" />
  </svg>
);

/**
 * ComponentCard component.
 *
 * A standalone card component for displaying UI component information.
 * Supports multiple sizes, selection states, drag-and-drop, and action buttons.
 *
 * @example
 * ```tsx
 * <ComponentCard
 *   component={componentInfo}
 *   isSelected={selectedId === componentInfo.id}
 *   onSelect={(component) => setSelectedId(component.id)}
 *   onAdd={(component) => addToCanvas(component)}
 *   showActions
 *   draggable
 * />
 * ```
 */
export const ComponentCard = forwardRef<HTMLDivElement, ComponentCardProps>(
  (
    {
      component,
      isSelected = false,
      size = "md",
      showDetails = true,
      showActions = true,
      showThumbnail = true,
      interactive = true,
      draggable = false,
      onSelect,
      onAdd,
      onEdit,
      onInfo,
      className = "",
      ...props
    },
    ref
  ) => {
    const sizeConfig = sizeConfigs[size];
    const TypeIcon = typeIcons[component.type];

    // Handle drag start
    const handleDragStart = (e: React.DragEvent) => {
      if (!draggable) return;
      e.dataTransfer.setData("application/json", JSON.stringify(component));
      e.dataTransfer.effectAllowed = "copy";
    };

    // Card container styles
    const cardStyles = [
      "group",
      "relative",
      "bg-white",
      "border",
      "rounded-lg",
      "overflow-hidden",
      "transition-all",
      "duration-150",
      sizeConfig.padding,
      interactive && "cursor-pointer",
      draggable && "cursor-grab active:cursor-grabbing",
      isSelected
        ? "border-primary-500 ring-2 ring-primary-100 shadow-md"
        : "border-neutral-200 hover:border-neutral-300 hover:shadow-sm",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    // Handle card click
    const handleClick = (e: React.MouseEvent) => {
      if (!interactive) return;
      e.preventDefault();
      onSelect?.(component);
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!interactive) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect?.(component);
      }
    };

    // Handle add action
    const handleAdd = (e: React.MouseEvent) => {
      e.stopPropagation();
      onAdd?.(component);
    };

    // Handle edit action
    const handleEdit = (e: React.MouseEvent) => {
      e.stopPropagation();
      onEdit?.(component);
    };

    // Handle info
    const handleInfo = (e: React.MouseEvent) => {
      e.stopPropagation();
      onInfo?.(component);
    };

    return (
      <div
        ref={ref}
        className={cardStyles}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        draggable={draggable}
        onDragStart={handleDragStart}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-selected={isSelected}
        {...props}
      >
        {/* Drag handle */}
        {draggable && (
          <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
            <DragIcon className="h-4 w-4 text-neutral-400" />
          </div>
        )}

        {/* Thumbnail */}
        {showThumbnail && (
          <div
            className={[
              "flex",
              "items-center",
              "justify-center",
              "bg-neutral-50",
              "rounded-md",
              "border",
              "border-neutral-100",
              "mb-3",
              sizeConfig.thumbnailHeight,
            ].join(" ")}
          >
            {component.thumbnail ? (
              <img
                src={component.thumbnail}
                alt={`${component.name} preview`}
                className="h-full w-full object-contain p-2"
              />
            ) : (
              <TypeIcon className="h-10 w-10 text-neutral-300" />
            )}
          </div>
        )}

        {/* Header with category and type */}
        <div className="flex items-start gap-3">
          {/* Type icon (when no thumbnail) */}
          {!showThumbnail && (
            <div
              className={[
                "flex",
                "items-center",
                "justify-center",
                "rounded-lg",
                "shrink-0",
                categoryColors[component.category],
                sizeConfig.iconSize,
              ].join(" ")}
            >
              <TypeIcon className="h-5 w-5" />
            </div>
          )}

          {/* Content */}
          <div className="flex-1 min-w-0">
            {/* Category badge */}
            <div className="flex items-center gap-2 mb-1">
              <span
                className={[
                  "inline-flex",
                  "items-center",
                  "px-2",
                  "py-0.5",
                  "text-xs",
                  "font-medium",
                  "rounded",
                  "border",
                  categoryColors[component.category],
                ].join(" ")}
              >
                {categoryLabels[component.category]}
              </span>
              <span className="text-xs text-neutral-400 capitalize">{component.type}</span>
            </div>

            {/* Name and version */}
            <div className="flex items-center gap-2">
              <h3
                className={[
                  "font-semibold",
                  "text-neutral-900",
                  "truncate",
                  sizeConfig.titleSize,
                ].join(" ")}
              >
                {component.name}
              </h3>
              {component.version && (
                <span className="text-xs text-neutral-400 shrink-0">v{component.version}</span>
              )}
              {component.builtIn && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-500 rounded shrink-0">
                  Built-in
                </span>
              )}
            </div>

            {/* Description */}
            {showDetails && (
              <p className="text-sm text-neutral-600 mt-1 line-clamp-2">{component.description}</p>
            )}

            {/* Tags */}
            {showDetails && component.tags && component.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {component.tags.slice(0, 4).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 text-xs bg-neutral-100 text-neutral-600 rounded"
                  >
                    {tag}
                  </span>
                ))}
                {component.tags.length > 4 && (
                  <span className="px-1.5 py-0.5 text-xs text-neutral-400">
                    +{component.tags.length - 4}
                  </span>
                )}
              </div>
            )}

            {/* Props count and file path */}
            {showDetails && (component.propsCount !== undefined || component.filePath) && (
              <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                {component.propsCount !== undefined && (
                  <span>{component.propsCount} props</span>
                )}
                {component.filePath && (
                  <span className="truncate font-mono">{component.filePath}</span>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Action buttons */}
        {showActions && (
          <div
            className={[
              "flex",
              "items-center",
              "gap-2",
              "mt-3",
              "pt-3",
              "border-t",
              "border-neutral-100",
              "opacity-0",
              "group-hover:opacity-100",
              "transition-opacity",
              "duration-150",
            ].join(" ")}
          >
            {/* Add button */}
            {onAdd && (
              <button
                type="button"
                onClick={handleAdd}
                className={[
                  "flex-1",
                  "flex",
                  "items-center",
                  "justify-center",
                  "gap-1",
                  "px-3",
                  "py-1.5",
                  "text-sm",
                  "font-medium",
                  "rounded-md",
                  "bg-primary-500",
                  "text-white",
                  "hover:bg-primary-600",
                  "transition-colors",
                  "duration-150",
                ].join(" ")}
              >
                <AddIcon className="h-4 w-4" />
                <span>Add</span>
              </button>
            )}

            {/* Edit button */}
            {onEdit && (
              <button
                type="button"
                onClick={handleEdit}
                className={[
                  "p-1.5",
                  "rounded-md",
                  "text-neutral-500",
                  "hover:text-neutral-700",
                  "hover:bg-neutral-100",
                  "transition-colors",
                  "duration-150",
                ].join(" ")}
                title="Edit component"
              >
                <EditIcon className="h-4 w-4" />
              </button>
            )}

            {/* Info button */}
            {onInfo && (
              <button
                type="button"
                onClick={handleInfo}
                className={[
                  "p-1.5",
                  "rounded-md",
                  "text-neutral-500",
                  "hover:text-neutral-700",
                  "hover:bg-neutral-100",
                  "transition-colors",
                  "duration-150",
                ].join(" ")}
                title="Component info"
              >
                <InfoIcon className="h-4 w-4" />
              </button>
            )}
          </div>
        )}
      </div>
    );
  }
);

ComponentCard.displayName = "ComponentCard";

/**
 * Compact component card variant for list views.
 */
export interface ComponentCardCompactProps
  extends Omit<ComponentCardProps, "showDetails" | "showActions" | "showThumbnail" | "size"> {
  /** Show quick add button */
  showQuickAdd?: boolean;
}

export const ComponentCardCompact = forwardRef<HTMLDivElement, ComponentCardCompactProps>(
  (
    {
      component,
      isSelected,
      showQuickAdd = true,
      draggable = false,
      onSelect,
      onAdd,
      className = "",
      ...props
    },
    ref
  ) => {
    const TypeIcon = typeIcons[component.type];

    const handleDragStart = (e: React.DragEvent) => {
      if (!draggable) return;
      e.dataTransfer.setData("application/json", JSON.stringify(component));
      e.dataTransfer.effectAllowed = "copy";
    };

    const cardStyles = [
      "flex",
      "items-center",
      "gap-3",
      "p-3",
      "bg-white",
      "border",
      "rounded-lg",
      "cursor-pointer",
      "transition-all",
      "duration-150",
      draggable && "cursor-grab active:cursor-grabbing",
      isSelected
        ? "border-primary-500 bg-primary-50"
        : "border-neutral-200 hover:border-neutral-300",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const handleClick = () => onSelect?.(component);

    const handleAdd = (e: React.MouseEvent) => {
      e.stopPropagation();
      onAdd?.(component);
    };

    return (
      <div
        ref={ref}
        className={cardStyles}
        onClick={handleClick}
        draggable={draggable}
        onDragStart={handleDragStart}
        role="button"
        tabIndex={0}
        {...props}
      >
        {/* Icon */}
        <div
          className={[
            "flex",
            "items-center",
            "justify-center",
            "h-8",
            "w-8",
            "rounded-md",
            "shrink-0",
            categoryColors[component.category],
          ].join(" ")}
        >
          <TypeIcon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-900 truncate">{component.name}</span>
            {component.version && (
              <span className="text-xs text-neutral-400">v{component.version}</span>
            )}
          </div>
          <span className="text-xs text-neutral-500">
            {categoryLabels[component.category]} / {component.type}
          </span>
        </div>

        {/* Quick add */}
        {showQuickAdd && onAdd && (
          <button
            type="button"
            onClick={handleAdd}
            className={[
              "p-1.5",
              "rounded-md",
              "shrink-0",
              "bg-primary-100",
              "text-primary-700",
              "hover:bg-primary-200",
              "transition-colors",
              "duration-150",
            ].join(" ")}
            title="Add to canvas"
          >
            <AddIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    );
  }
);

ComponentCardCompact.displayName = "ComponentCardCompact";

export default ComponentCard;
