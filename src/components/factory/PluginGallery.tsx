/**
 * D040 - src/components/factory/PluginGallery.tsx
 * ================================================
 * Plugin gallery grid component for displaying available plugins.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D014 (Panel.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { forwardRef, useState, useMemo, type HTMLAttributes } from "react";

/**
 * Plugin status enumeration.
 */
export type PluginStatus = "loaded" | "unloaded" | "error" | "loading";

/**
 * Plugin contract type.
 */
export type PluginContract = "tts" | "stt" | "llm" | "memory" | "tool" | "custom";

/**
 * Plugin information interface.
 */
export interface PluginInfo {
  /** Unique plugin identifier */
  id: string;
  /** Display name */
  name: string;
  /** Plugin version */
  version: string;
  /** Short description */
  description: string;
  /** Contract type */
  contract: PluginContract;
  /** Current status */
  status: PluginStatus;
  /** Plugin author */
  author?: string;
  /** Plugin icon URL or component */
  icon?: string;
  /** Whether plugin is built-in */
  builtIn?: boolean;
  /** Tags for filtering */
  tags?: string[];
  /** Last updated timestamp */
  lastUpdated?: string;
}

/**
 * Gallery filter options.
 */
export interface GalleryFilters {
  /** Filter by status */
  status?: PluginStatus | "all";
  /** Filter by contract type */
  contract?: PluginContract | "all";
  /** Search query */
  search?: string;
  /** Show only built-in plugins */
  builtInOnly?: boolean;
}

/**
 * Gallery sort options.
 */
export type GallerySortBy = "name" | "status" | "contract" | "lastUpdated";
export type GallerySortOrder = "asc" | "desc";

/**
 * Gallery view mode.
 */
export type GalleryViewMode = "grid" | "list";

/**
 * Contract color mapping.
 */
const contractColors: Record<PluginContract, string> = {
  tts: "bg-primary-100 text-primary-700 border-primary-200",
  stt: "bg-success-50 text-success-700 border-success-200",
  llm: "bg-warning-50 text-warning-700 border-warning-200",
  memory: "bg-info-50 text-info-700 border-info-200",
  tool: "bg-neutral-100 text-neutral-700 border-neutral-200",
  custom: "bg-neutral-50 text-neutral-600 border-neutral-200",
};

/**
 * Status indicator colors.
 */
const statusColors: Record<PluginStatus, string> = {
  loaded: "bg-success-500",
  unloaded: "bg-neutral-400",
  error: "bg-error-500",
  loading: "bg-warning-500 animate-pulse",
};

/**
 * Status display labels.
 */
const statusLabels: Record<PluginStatus, string> = {
  loaded: "Loaded",
  unloaded: "Not Loaded",
  error: "Error",
  loading: "Loading...",
};

/**
 * PluginGallery component props.
 */
export interface PluginGalleryProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect" | "onLoad"> {
  /** Array of plugins to display */
  plugins: PluginInfo[];
  /** Currently selected plugin ID */
  selectedId?: string | undefined;
  /** Callback when a plugin is selected */
  onSelect?: ((plugin: PluginInfo) => void) | undefined;
  /** Callback when load is requested */
  onLoad?: ((plugin: PluginInfo) => void) | undefined;
  /** Callback when unload is requested */
  onUnload?: ((plugin: PluginInfo) => void) | undefined;
  /** Initial filters */
  initialFilters?: GalleryFilters | undefined;
  /** Initial sort settings */
  initialSort?: { by: GallerySortBy; order: GallerySortOrder } | undefined;
  /** Initial view mode */
  initialViewMode?: GalleryViewMode | undefined;
  /** Whether to show filter controls */
  showFilters?: boolean | undefined;
  /** Whether to show search input */
  showSearch?: boolean | undefined;
  /** Whether to show view mode toggle */
  showViewToggle?: boolean | undefined;
  /** Empty state message */
  emptyMessage?: string | undefined;
  /** Loading state */
  isLoading?: boolean | undefined;
  /** Grid columns for grid view */
  gridColumns?: 2 | 3 | 4 | undefined;
}

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
 * Load/Download icon component.
 */
const LoadIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

/**
 * Unload/Stop icon component.
 */
const UnloadIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <rect x="6" y="6" width="12" height="12" rx="2" />
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
 * PluginGallery component.
 *
 * Displays a grid or list of available plugins with filtering,
 * searching, and sorting capabilities.
 *
 * @example
 * ```tsx
 * <PluginGallery
 *   plugins={pluginList}
 *   selectedId="tts_kokoro"
 *   onSelect={(plugin) => console.log("Selected:", plugin)}
 *   onLoad={(plugin) => loadPlugin(plugin.id)}
 *   showFilters
 *   showSearch
 * />
 * ```
 */
export const PluginGallery = forwardRef<HTMLDivElement, PluginGalleryProps>(
  (
    {
      plugins,
      selectedId,
      onSelect,
      onLoad,
      onUnload,
      initialFilters = { status: "all", contract: "all", search: "" },
      initialSort = { by: "name", order: "asc" },
      initialViewMode = "grid",
      showFilters = true,
      showSearch = true,
      showViewToggle = true,
      emptyMessage = "No plugins found",
      isLoading = false,
      gridColumns = 3,
      className = "",
      ...props
    },
    ref
  ) => {
    // State
    const [filters, setFilters] = useState<GalleryFilters>(initialFilters);
    const [sortBy] = useState<GallerySortBy>(initialSort.by);
    const [sortOrder] = useState<GallerySortOrder>(initialSort.order);
    const [viewMode, setViewMode] = useState<GalleryViewMode>(initialViewMode);
    const [showFilterPanel, setShowFilterPanel] = useState(false);

    // Filter and sort plugins
    const filteredPlugins = useMemo(() => {
      let result = [...plugins];

      // Apply status filter
      if (filters.status && filters.status !== "all") {
        result = result.filter((p) => p.status === filters.status);
      }

      // Apply contract filter
      if (filters.contract && filters.contract !== "all") {
        result = result.filter((p) => p.contract === filters.contract);
      }

      // Apply built-in filter
      if (filters.builtInOnly) {
        result = result.filter((p) => p.builtIn);
      }

      // Apply search filter
      if (filters.search) {
        const searchLower = filters.search.toLowerCase();
        result = result.filter(
          (p) =>
            p.name.toLowerCase().includes(searchLower) ||
            p.description.toLowerCase().includes(searchLower) ||
            p.id.toLowerCase().includes(searchLower) ||
            p.tags?.some((t) => t.toLowerCase().includes(searchLower))
        );
      }

      // Apply sorting
      result.sort((a, b) => {
        let comparison = 0;
        switch (sortBy) {
          case "name":
            comparison = a.name.localeCompare(b.name);
            break;
          case "status":
            comparison = a.status.localeCompare(b.status);
            break;
          case "contract":
            comparison = a.contract.localeCompare(b.contract);
            break;
          case "lastUpdated":
            comparison = (a.lastUpdated || "").localeCompare(b.lastUpdated || "");
            break;
        }
        return sortOrder === "asc" ? comparison : -comparison;
      });

      return result;
    }, [plugins, filters, sortBy, sortOrder]);

    // Handle search input
    const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      setFilters((prev) => ({ ...prev, search: e.target.value }));
    };

    // Handle filter changes
    const handleStatusFilter = (status: PluginStatus | "all") => {
      setFilters((prev) => ({ ...prev, status }));
    };

    const handleContractFilter = (contract: PluginContract | "all") => {
      setFilters((prev) => ({ ...prev, contract }));
    };

    // Container styles
    const containerStyles = ["flex", "flex-col", "gap-4", className]
      .filter(Boolean)
      .join(" ");

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
    const loadingStyles = [
      "flex",
      "items-center",
      "justify-center",
      "py-12",
    ].join(" ");

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
                  placeholder="Search plugins..."
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

            {/* Plugin count */}
            <span className="text-sm text-neutral-500 ml-auto">
              {filteredPlugins.length} plugin{filteredPlugins.length !== 1 ? "s" : ""}
            </span>
          </div>
        )}

        {/* Filter panel (collapsible) */}
        {showFilters && showFilterPanel && (
          <div className="flex flex-wrap gap-4 p-4 bg-white border border-neutral-200 rounded-lg">
            {/* Status filter */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Status
              </label>
              <div className="flex flex-wrap gap-1">
                {(["all", "loaded", "unloaded", "error"] as const).map((status) => (
                  <button
                    key={status}
                    type="button"
                    onClick={() => handleStatusFilter(status)}
                    className={[
                      "px-3",
                      "py-1",
                      "text-xs",
                      "font-medium",
                      "rounded-full",
                      "border",
                      "transition-colors",
                      "duration-150",
                      filters.status === status
                        ? "bg-primary-100 border-primary-300 text-primary-700"
                        : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                    ].join(" ")}
                  >
                    {status === "all" ? "All" : statusLabels[status]}
                  </button>
                ))}
              </div>
            </div>

            {/* Contract filter */}
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                Contract
              </label>
              <div className="flex flex-wrap gap-1">
                {(["all", "tts", "stt", "llm", "memory", "tool", "custom"] as const).map(
                  (contract) => (
                    <button
                      key={contract}
                      type="button"
                      onClick={() => handleContractFilter(contract)}
                      className={[
                        "px-3",
                        "py-1",
                        "text-xs",
                        "font-medium",
                        "rounded-full",
                        "border",
                        "transition-colors",
                        "duration-150",
                        filters.contract === contract
                          ? "bg-primary-100 border-primary-300 text-primary-700"
                          : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                      ].join(" ")}
                    >
                      {contract === "all" ? "All" : contract.toUpperCase()}
                    </button>
                  )
                )}
              </div>
            </div>
          </div>
        )}

        {/* Loading state */}
        {isLoading && (
          <div className={loadingStyles}>
            <div className="flex items-center gap-3 text-neutral-500">
              <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading plugins...</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredPlugins.length === 0 && (
          <div className={emptyStyles}>
            <div className="h-12 w-12 mb-4 text-neutral-300">
              <GridIcon className="h-full w-full" />
            </div>
            <p className="text-neutral-500">{emptyMessage}</p>
            {filters.search && (
              <p className="text-sm text-neutral-400 mt-1">
                Try adjusting your search or filters
              </p>
            )}
          </div>
        )}

        {/* Plugin grid/list */}
        {!isLoading && filteredPlugins.length > 0 && (
          <div className={contentStyles}>
            {filteredPlugins.map((plugin) => (
              <PluginGalleryItem
                key={plugin.id}
                plugin={plugin}
                isSelected={selectedId === plugin.id}
                viewMode={viewMode}
                onSelect={() => onSelect?.(plugin)}
                onLoad={() => onLoad?.(plugin)}
                onUnload={() => onUnload?.(plugin)}
              />
            ))}
          </div>
        )}
      </div>
    );
  }
);

PluginGallery.displayName = "PluginGallery";

/**
 * Internal gallery item component.
 */
interface PluginGalleryItemProps {
  plugin: PluginInfo;
  isSelected: boolean;
  viewMode: GalleryViewMode;
  onSelect?: () => void;
  onLoad?: () => void;
  onUnload?: () => void;
}

const PluginGalleryItem: React.FC<PluginGalleryItemProps> = ({
  plugin,
  isSelected,
  viewMode,
  onSelect,
  onLoad,
  onUnload,
}) => {
  const isGrid = viewMode === "grid";

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
  ].join(" ");

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    onSelect?.();
  };

  const handleAction = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (plugin.status === "loaded") {
      onUnload?.();
    } else if (plugin.status === "unloaded") {
      onLoad?.();
    }
  };

  return (
    <div className={itemStyles} onClick={handleClick} role="button" tabIndex={0} title={plugin.description}>
      {/* Status indicator */}
      <div
        className={[
          "absolute",
          "top-3",
          "right-3",
          "h-2",
          "w-2",
          "rounded-full",
          statusColors[plugin.status],
        ].join(" ")}
        title={statusLabels[plugin.status]}
      />

      {/* Content */}
      <div className={isGrid ? "" : "flex-1 min-w-0"}>
        {/* Contract badge */}
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
            contractColors[plugin.contract],
            isGrid ? "mb-2" : "",
          ].join(" ")}
        >
          {plugin.contract.toUpperCase()}
        </span>

        {/* Name and version */}
        <div className={isGrid ? "mt-2" : "mt-1"}>
          <h4 className="text-sm font-semibold text-neutral-900 truncate">
            {plugin.name}
            {plugin.builtIn && (
              <span className="ml-1 text-xs font-normal text-neutral-400">(built-in)</span>
            )}
          </h4>
          <span className="text-xs text-neutral-500">v{plugin.version}</span>
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
          {plugin.description}
        </p>
      </div>

      {/* Permanent Load/Unload icon button */}
      <button
        type="button"
        onClick={handleAction}
        disabled={plugin.status === "loading" || plugin.status === "error"}
        className={[
          "p-1.5",
          "rounded-md",
          "transition-colors",
          "duration-150",
          isGrid ? "absolute bottom-3 right-3" : "shrink-0",
          plugin.status === "loaded"
            ? "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100"
            : "text-primary-500 hover:text-primary-700 hover:bg-primary-50",
          (plugin.status === "loading" || plugin.status === "error") &&
          "opacity-50 cursor-not-allowed",
        ].join(" ")}
        title={plugin.status === "loaded" ? "Unload plugin" : "Load plugin"}
      >
        {plugin.status === "loaded" ? (
          <UnloadIcon className="h-5 w-5" />
        ) : plugin.status === "loading" ? (
          <LoadIcon className="h-5 w-5 animate-pulse" />
        ) : (
          <LoadIcon className="h-5 w-5" />
        )}
      </button>
    </div>
  );
};

export default PluginGallery;
