/**
 * D042 - src/components/factory/ComponentGallery.tsx
 * ====================================================
 * Frontend component gallery for displaying available UI components.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { forwardRef, useState, useMemo, type HTMLAttributes } from "react";
import { getComponent, isComponentRegistered } from "../../utils/ComponentRegistry";

/**
 * Component category enumeration.
 */
export type ComponentCategory =
  | "atoms"
  | "molecules"
  | "organisms"
  | "templates"
  | "layouts"
  | "containers"
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
  /** Component version */
  version?: string;
  /** Default size (width/height) for drag-and-drop */
  defaultSize?: { width: number; height: number };
}

/**
 * Gallery filter options.
 */
export interface ComponentFilters {
  /** Filter by category */
  category?: ComponentCategory | "all";
  /** Filter by type */
  type?: ComponentType | "all";
  /** Search query */
  search?: string;
  /** Show only built-in components */
  builtInOnly?: boolean;
}

/**
 * Sort options.
 */
export type ComponentSortBy = "name" | "category" | "type";
export type SortOrder = "asc" | "desc";

/**
 * View mode.
 */
export type ViewMode = "grid" | "list";

/**
 * Category color mapping.
 */
const categoryColors: Record<ComponentCategory, string> = {
  atoms: "bg-primary-100 text-primary-700 border-primary-200",
  molecules: "bg-success-50 text-success-700 border-success-200",
  organisms: "bg-warning-50 text-warning-700 border-warning-200",
  templates: "bg-info-50 text-info-700 border-info-200",
  layouts: "bg-neutral-100 text-neutral-700 border-neutral-200",
  containers: "bg-indigo-50 text-indigo-700 border-indigo-200",
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
  containers: "Containers",
  custom: "Custom",
};

/**
 * Search icon component.
 */
const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

/**
 * Grid icon component.
 */
const GridIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

/**
 * List icon component.
 */
const ListIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="8" y1="6" x2="21" y2="6" />
    <line x1="8" y1="12" x2="21" y2="12" />
    <line x1="8" y1="18" x2="21" y2="18" />
    <line x1="3" y1="6" x2="3.01" y2="6" />
    <line x1="3" y1="12" x2="3.01" y2="12" />
    <line x1="3" y1="18" x2="3.01" y2="18" />
  </svg>
);

/**
 * Filter icon component.
 */
const FilterIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

/**
 * Component placeholder icon.
 */
const ComponentIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="9" y1="21" x2="9" y2="9" />
  </svg>
);

/**
 * Grid column class mapping.
 */
const gridColumnClasses: Record<number, string> = {
  2: "grid-cols-1 sm:grid-cols-2",
  3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
  4: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
};

/**
 * ComponentGallery component props.
 */
export interface ComponentGalleryProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Array of components to display */
  components: ComponentInfo[];
  /** Currently selected component ID (single-select mode - deprecated, use selectedIds) */
  selectedId?: string;
  /** Currently selected component IDs (multi-select mode) */
  selectedIds?: string[];
  /** Callback when a component is selected (single-select mode - deprecated) */
  onSelect?: (component: ComponentInfo) => void;
  /** Callback when a component selection changes (multi-select mode) */
  onSelectionChange?: (component: ComponentInfo, selected: boolean) => void;
  /** Callback when a component is added to canvas */
  onAdd?: (component: ComponentInfo) => void;
  /** Callback when component info is requested */
  onInfo?: (component: ComponentInfo) => void;
  /** Initial filters */
  initialFilters?: ComponentFilters;
  /** Initial sort settings */
  initialSort?: { by: ComponentSortBy; order: SortOrder };
  /** Initial view mode */
  initialViewMode?: ViewMode;
  /** Whether to show filter controls */
  showFilters?: boolean;
  /** Whether to show search input */
  showSearch?: boolean;
  /** Whether to show view mode toggle */
  showViewToggle?: boolean;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading state */
  isLoading?: boolean;
  /** Grid columns for grid view */
  gridColumns?: 2 | 3 | 4;
  /** Enable drag and drop */
  draggable?: boolean;
}

/**
 * ComponentGallery component.
 *
 * Displays a grid or list of available UI components with filtering,
 * searching, and drag-and-drop capabilities.
 *
 * @example
 * ```tsx
 * <ComponentGallery
 *   components={componentList}
 *   selectedId="button-primary"
 *   onSelect={(component) => console.log("Selected:", component)}
 *   onAdd={(component) => addToCanvas(component)}
 *   showFilters
 *   showSearch
 *   draggable
 * />
 * ```
 */
export const ComponentGallery = forwardRef<HTMLDivElement, ComponentGalleryProps>(
  (
    {
      components,
      selectedId,
      selectedIds = [],
      onSelect,
      onSelectionChange,
      onAdd,
      onInfo,
      initialFilters = { category: "all", type: "all", search: "" },
      initialSort = { by: "name", order: "asc" },
      initialViewMode = "grid",
      showFilters = true,
      showSearch = true,
      showViewToggle = true,
      emptyMessage = "No components found",
      isLoading = false,
      gridColumns = 3,
      draggable = false,
      className = "",
      ...props
    },
    ref
  ) => {
    // State
    const [filters, setFilters] = useState<ComponentFilters>(initialFilters);
    const [sortBy] = useState<ComponentSortBy>(initialSort.by);
    const [sortOrder] = useState<SortOrder>(initialSort.order);
    const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    // Filter and sort components
    const filteredComponents = useMemo(() => {
      let result = [...components];

      // Apply category filter
      if (filters.category && filters.category !== "all") {
        result = result.filter((c) => c.category === filters.category);
      }

      // Apply type filter
      if (filters.type && filters.type !== "all") {
        result = result.filter((c) => c.type === filters.type);
      }

      // Apply built-in filter
      if (filters.builtInOnly) {
        result = result.filter((c) => c.builtIn);
      }

      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(
          (c) =>
            c.name.toLowerCase().includes(searchLower) ||
            c.description.toLowerCase().includes(searchLower) ||
            c.id.toLowerCase().includes(searchLower) ||
            c.tags?.some((t) => t.toLowerCase().includes(searchLower))
        );
      }

      // Apply sorting
      result.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "category":
            comparison = a.category.localeCompare(b.category);
            break;
          case "type":
            comparison = a.type.localeCompare(b.type);
            break;
        }
        return sortOrder === "asc" ? comparison : -comparison;
      });

      return result;
    }, [components, filters, sortBy, sortOrder]);

    // Handle search input
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, search: e.target.value }));
    };

    // Handle filter changes
    const handleCategoryFilter = (category: ComponentCategory | "all") => {
      setFilters((prev) => ({ ...prev, category }));
    };

    // Container styles
    const containerStyles = ["flex", "flex-col", "gap-4", className].filter(Boolean).join(" ");

    // Toolbar styles
    const toolbarStyles = [
      "flex",
      "flex-wrap",
      "items-center",
      "gap-3",
      "p-3",
      "bg-neutral-50",
      "border",
      "border-neutral-200",
      "rounded-lg",
    ].join(" ");

    // Grid/list container styles
    const contentStyles =
      viewMode === "grid"
        ? ["grid", "gap-4", gridColumnClasses[gridColumns]].join(" ")
        : ["flex", "flex-col", "gap-2"].join(" ");

    // Empty state styles
    const emptyStyles = [
      "flex",
      "flex-col",
      "items-center",
      "justify-center",
      "py-12",
      "text-neutral-500",
    ].join(" ");

    // Loading state styles
    const loadingStyles = ["flex", "items-center", "justify-center", "py-12"].join(" ");

    return (
      <div ref={ref} className={containerStyles} {...props}>
        {/* Toolbar */}
        {(showSearch || showFilters || showViewToggle) && (
          <div className={toolbarStyles}>
            {/* Search */}
            {showSearch && (
              <div className="relative flex-1 min-w-48">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                  type="text"
                  placeholder="Search components..."
                  value={filters.search || ""}
                  onChange={handleSearchChange}
                  className={[
                    "w-full",
                    "pl-9",
                    "pr-4",
                    "py-2",
                    "text-sm",
                    "bg-white",
                    "border",
                    "border-neutral-200",
                    "rounded-md",
                    "focus:outline-none",
                    "focus:ring-2",
                    "focus:ring-primary-500",
                    "focus:border-transparent",
                    "placeholder:text-neutral-400",
                  ].join(" ")}
                />
              </div>
            )}

            {/* Filter toggle */}
            {showFilters && (
              <button
                type="button"
                onClick={() => setShowFilterPanel(!showFilterPanel)}
                className={[
                  "flex",
                  "items-center",
                  "gap-2",
                  "px-3",
                  "py-2",
                  "text-sm",
                  "font-medium",
                  "rounded-md",
                  "border",
                  "transition-colors",
                  "duration-150",
                  showFilterPanel
                    ? "bg-primary-50 border-primary-200 text-primary-700"
                    : "bg-white border-neutral-200 text-neutral-700 hover:bg-neutral-50",
                ].join(" ")}
              >
                <FilterIcon className="h-4 w-4" />
                <span>Filters</span>
              </button>
            )}

            {/* View mode toggle */}
            {showViewToggle && (
              <div className="flex border border-neutral-200 rounded-md overflow-hidden">
                <button
                  type="button"
                  onClick={() => setViewMode("grid")}
                  className={[
                    "p-2",
                    "transition-colors",
                    "duration-150",
                    viewMode === "grid"
                      ? "bg-primary-50 text-primary-600"
                      : "bg-white text-neutral-500 hover:bg-neutral-50",
                  ].join(" ")}
                  aria-label="Grid view"
                >
                  <GridIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("list")}
                  className={[
                    "p-2",
                    "border-l",
                    "border-neutral-200",
                    "transition-colors",
                    "duration-150",
                    viewMode === "list"
                      ? "bg-primary-50 text-primary-600"
                      : "bg-white text-neutral-500 hover:bg-neutral-50",
                  ].join(" ")}
                  aria-label="List view"
                >
                  <ListIcon className="h-4 w-4" />
                </button>
              </div>
            )}

            {/* Component count */}
            <span className="text-sm text-neutral-500 ml-auto">
              {filteredComponents.length} component{filteredComponents.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Filter panel (collapsible) */}
        {showFilters && showFilterPanel && (
          <div className="flex flex-wrap gap-4 p-4 bg-white border border-neutral-200 rounded-lg">
            {/* Category filter */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Category
              </label>
              <div className="flex flex-wrap gap-1">
                {(
                  ["all", "atoms", "molecules", "organisms", "templates", "layouts", "containers", "custom"] as const
                ).map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => handleCategoryFilter(category)}
                    className={[
                      "px-3",
                      "py-1",
                      "text-xs",
                      "font-medium",
                      "rounded-full",
                      "border",
                      "transition-colors",
                      "duration-150",
                      filters.category === category
                        ? "bg-primary-100 border-primary-300 text-primary-700"
                        : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                    ].join(" ")}
                  >
                    {category === "all" ? "All" : categoryLabels[category]}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className={loadingStyles}>
            <div className="flex items-center gap-3 text-neutral-500">
              <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading components...</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredComponents.length === 0 && (
          <div className={emptyStyles}>
            <div className="h-12 w-12 mb-4 text-neutral-300">
              <ComponentIcon className="h-full w-full" />
            </div>
            <p className="text-neutral-500">{emptyMessage}</p>
            {filters.search && (
              <p className="text-sm text-neutral-400 mt-1">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        )}

        {/* Component grid/list */}
        {!isLoading && filteredComponents.length > 0 && (
          <div className={contentStyles}>
            {filteredComponents.map((component) => {
              // Support both single-select (selectedId) and multi-select (selectedIds) modes
              const isSelected = selectedIds.length > 0
                ? selectedIds.includes(component.id)
                : selectedId === component.id;

              return (
                <ComponentGalleryItem
                  key={component.id}
                  component={component}
                  isSelected={isSelected}
                  isMultiSelect={selectedIds.length > 0 || onSelectionChange !== undefined}
                  viewMode={viewMode}
                  draggable={draggable}
                  onSelect={() => onSelect?.(component)}
                  onSelectionChange={(selected) => onSelectionChange?.(component, selected)}
                  onAdd={() => onAdd?.(component)}
                  onInfo={() => onInfo?.(component)}
                />
              );
            })}
          </div>
        )}
      </div>
    );
  }
);

ComponentGallery.displayName = "ComponentGallery";

/**
 * Component preview renderer - renders actual component from registry for thumbnails.
 */
const ComponentPreviewRenderer: React.FC<{ type: string }> = ({ type }) => {
  const Component = getComponent(type);

  // Provide sample props based on component type
  const sampleProps: Record<string, Record<string, unknown>> = {
    button: { children: "Button", variant: "primary", size: "sm" },
    input: { placeholder: "Input...", size: "sm" },
    select: {
      options: [{ value: "1", label: "Option" }],
      placeholder: "Select",
      size: "sm"
    },
    checkbox: { label: "Check", size: "sm" },
    panel: { children: "Panel", className: "p-2 text-xs" },
    modal: { children: "Modal", isOpen: false },
    card: { children: "Card", className: "p-2 text-xs" },
    tabs: {
      tabs: [{ id: "1", label: "Tab" }],
      activeTab: "1",
      size: "sm"
    },
    navigation: {
      tabs: [{ id: "1", label: "Nav" }],
      activeTab: "1",
      size: "sm"
    },
  };

  const props = sampleProps[type.toLowerCase()] || {};

  try {
    return <Component {...props} />;
  } catch {
    return <span className="text-xs text-neutral-400">Preview</span>;
  }
};

/**
 * Internal gallery item component.
 */
interface ComponentGalleryItemProps {
  component: ComponentInfo;
  isSelected: boolean;
  isMultiSelect?: boolean;
  viewMode: ViewMode;
  draggable?: boolean;
  onSelect?: () => void;
  onSelectionChange?: (selected: boolean) => void;
  onAdd?: () => void;
  onInfo?: () => void;
}

const ComponentGalleryItem: React.FC<ComponentGalleryItemProps> = ({
  component,
  isSelected,
  isMultiSelect = false,
  viewMode,
  draggable = false,
  onSelect,
  onSelectionChange,
  onAdd,
  onInfo,
}) => {
  const isGrid = viewMode === "grid";

  const handleDragStart = (e: React.DragEvent) => {
    if (!draggable) return;
    e.dataTransfer.setData("application/json", JSON.stringify(component));
    e.dataTransfer.effectAllowed = "copy";
  };

  const itemStyles = [
    "group",
    "relative",
    "bg-white",
    "border",
    "rounded-lg",
    "cursor-pointer",
    "transition-all",
    "duration-150",
    isSelected
      ? "border-primary-500 ring-2 ring-primary-100"
      : "border-neutral-200 hover:border-neutral-300 hover:shadow-sm",
    isGrid ? "p-4" : "p-3 flex items-center gap-4",
    draggable && "cursor-grab active:cursor-grabbing",
  ]
    .filter(Boolean)
    .join(" ");

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    // In multi-select mode, toggle selection via checkbox
    if (isMultiSelect) {
      onSelectionChange?.(!isSelected);
    } else {
      onSelect?.();
    }
  };

  const handleCheckboxChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.stopPropagation();
    onSelectionChange?.(e.target.checked);
  };

  const handleAdd = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onAdd?.();
  };

  const preventDrag = (e: React.DragEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };

  const handleInfo = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onInfo?.();
  };

  return (
    <div
      className={itemStyles}
      onClick={handleClick}
      draggable={draggable}
      onDragStart={handleDragStart}
      role="button"
      tabIndex={0}
    >
      {/* Multi-select checkbox (UJ-1.1.2) */}
      {isMultiSelect && (
        <div className="absolute top-3 right-3 z-10">
          <input
            type="checkbox"
            checked={isSelected}
            onChange={handleCheckboxChange}
            onClick={(e) => e.stopPropagation()}
            className={[
              "h-4",
              "w-4",
              "rounded",
              "border-neutral-300",
              "text-primary-500",
              "focus:ring-primary-500",
              "focus:ring-offset-0",
              "cursor-pointer",
              "transition-colors",
            ].join(" ")}
            aria-label={`Select ${component.name}`}
          />
        </div>
      )}

      {/* Thumbnail or live preview */}
      <div
        className={[
          "flex",
          "items-center",
          "justify-center",
          "bg-neutral-50",
          "rounded-md",
          "border",
          "border-neutral-100",
          "overflow-hidden",
          isGrid ? "h-24 mb-3" : "h-12 w-12 shrink-0",
        ].join(" ")}
      >
        {component.thumbnail ? (
          <img
            src={component.thumbnail}
            alt={`${component.name} preview`}
            className="h-full w-full object-contain p-2"
          />
        ) : isComponentRegistered(component.type) ? (
          <div className="transform scale-75 pointer-events-none">
            <ComponentPreviewRenderer type={component.type} />
          </div>
        ) : (
          <ComponentIcon className={isGrid ? "h-10 w-10 text-neutral-300" : "h-6 w-6 text-neutral-300"} />
        )}
      </div>

      {/* Content */}
      <div className={isGrid ? "" : "flex-1 min-w-0"}>
        {/* Category badge */}
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
            isGrid ? "mb-2" : "",
          ].join(" ")}
        >
          {categoryLabels[component.category]}
        </span>

        {/* Name */}
        <div className={isGrid ? "mt-2" : "mt-1"}>
          <h4 className="text-sm font-semibold text-neutral-900 truncate">
            {component.name}
            {component.builtIn && (
              <span className="ml-1 text-xs font-normal text-neutral-400">(built-in)</span>
            )}
          </h4>
          {component.version && (
            <span className="text-xs text-neutral-500">v{component.version}</span>
          )}
        </div>

        {/* Description */}
        <p
          className={[
            "text-sm",
            "text-neutral-600",
            "mt-1",
            isGrid ? "line-clamp-2" : "truncate",
          ].join(" ")}
        >
          {component.description}
        </p>

        {/* Tags */}
        {isGrid && component.tags && component.tags.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {component.tags.slice(0, 3).map((tag) => (
              <span
                key={tag}
                className="px-1.5 py-0.5 text-xs bg-neutral-100 text-neutral-600 rounded"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Action buttons */}
      <div
        className={[
          "flex",
          "items-center",
          "gap-2",
          isGrid
            ? "absolute bottom-3 right-3 opacity-0 group-hover:opacity-100 transition-opacity duration-150"
            : "",
        ].join(" ")}
      >
        {onAdd && (
          <button
            type="button"
            onClick={handleAdd}
            onDragStart={preventDrag}
            onDrag={preventDrag}
            draggable={false}
            className={[
              "px-3",
              "py-1.5",
              "text-xs",
              "font-medium",
              "rounded-md",
              "bg-primary-500",
              "text-white",
              "hover:bg-primary-600",
              "transition-colors",
              "duration-150",
            ].join(" ")}
          >
            Add
          </button>
        )}
        {onInfo && (
          <button
            type="button"
            onClick={handleInfo}
            onDragStart={preventDrag}
            onDrag={preventDrag}
            draggable={false}
            className={[
              "p-1.5",
              "rounded-md",
              "text-neutral-500",
              "hover:text-neutral-700",
              "hover:bg-neutral-100",
              "transition-colors",
              "duration-150",
            ].join(" ")}
            title="More info"
          >
            <svg
              className="h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};

export default ComponentGallery;
