/**
 * D041 - src/components/factory/PluginCard.tsx
 * =============================================
 * Individual plugin card component for gallery display.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D040 (PluginGallery.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 *   - Reusable standalone card component
 */

import React, { forwardRef, type CSSProperties } from "react";

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
  /** Plugin icon URL */
  icon?: string;
  /** Whether plugin is built-in */
  builtIn?: boolean;
  /** Tags for filtering */
  tags?: string[];
  /** Last updated timestamp */
  lastUpdated?: string;
  /** Health status (0-100) */
  healthScore?: number;
  /** Dependencies */
  dependencies?: string[];
}

/**
 * Card size variants.
 */
export type CardSize = "sm" | "md" | "lg";

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
 * Contract icon mapping.
 */
const contractIcons: Record<PluginContract, React.FC<{ className?: string }>> = {
  tts: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  stt: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
  llm: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  memory: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  tool: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z" />
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
  loaded: "Active",
  unloaded: "Inactive",
  error: "Error",
  loading: "Loading",
};

/**
 * Size configurations.
 */
const sizeConfigs: Record<CardSize, { padding: string; iconSize: string; titleSize: string }> = {
  sm: { padding: "p-3", iconSize: "h-8 w-8", titleSize: "text-sm" },
  md: { padding: "p-4", iconSize: "h-10 w-10", titleSize: "text-base" },
  lg: { padding: "p-5", iconSize: "h-12 w-12", titleSize: "text-lg" },
};

/**
 * PluginCard component props.
 */
export interface PluginCardProps {
  /** Plugin information */
  plugin: PluginInfo;
  /** Whether card is selected */
  isSelected?: boolean;
  /** Card size variant */
  size?: CardSize;
  /** Whether to show full details */
  showDetails?: boolean;
  /** Whether to show action buttons */
  showActions?: boolean;
  /** Whether card is interactive (clickable) */
  interactive?: boolean;
  /** Callback when card is clicked */
  onSelect?: (plugin: PluginInfo) => void;
  /** Callback when load is requested */
  onLoad?: (plugin: PluginInfo) => void;
  /** Callback when unload is requested */
  onUnload?: (plugin: PluginInfo) => void;
  /** Callback when configure is requested */
  onConfigure?: (plugin: PluginInfo) => void;
  /** Callback when info is requested */
  onInfo?: (plugin: PluginInfo) => void;
  /** Custom className */
  className?: string;
  /** Custom inline styles */
  style?: CSSProperties;
}


/**
 * Load/Download icon.
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
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

/**
 * Unload/Stop icon.
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
  >
    <rect x="6" y="6" width="12" height="12" rx="2" />
  </svg>
);

/**
 * PluginCard component.
 *
 * A standalone card component for displaying plugin information.
 * Supports multiple sizes, selection states, and action buttons.
 *
 * @example
 * ```tsx
 * <PluginCard
 *   plugin={pluginInfo}
 *   isSelected={selectedId === pluginInfo.id}
 *   onSelect={(plugin) => setSelectedId(plugin.id)}
 *   onLoad={(plugin) => loadPlugin(plugin.id)}
 *   showActions
 * />
 * ```
 */
export const PluginCard = forwardRef<HTMLDivElement, PluginCardProps>(
  (
    {
      plugin,
      isSelected = false,
      size = "md",
      showDetails = true,
      showActions = true,
      interactive = true,
      onSelect,
      onLoad,
      onUnload,
      onConfigure,
      onInfo,
      className = "",
      ...props
    },
    ref
  ) => {
    const sizeConfig = sizeConfigs[size];
    const ContractIcon = contractIcons[plugin.contract];

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
      onSelect?.(plugin);
    };

    // Handle keyboard navigation
    const handleKeyDown = (e: React.KeyboardEvent) => {
      if (!interactive) return;
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        onSelect?.(plugin);
      }
    };

    // Handle load/unload action
    const handleToggleLoad = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (plugin.status === "loaded") {
        onUnload?.(plugin);
      } else if (plugin.status === "unloaded") {
        onLoad?.(plugin);
      }
    };

    return (
      <div
        ref={ref}
        className={cardStyles}
        onClick={handleClick}
        onKeyDown={handleKeyDown}
        role={interactive ? "button" : undefined}
        tabIndex={interactive ? 0 : undefined}
        aria-selected={isSelected}
        {...props}
      >
        {/* Header with icon and status */}
        <div className="flex items-start gap-3">
          {/* Plugin icon */}
          <div
            className={[
              "flex",
              "items-center",
              "justify-center",
              "rounded-lg",
              "shrink-0",
              contractColors[plugin.contract],
              sizeConfig.iconSize,
            ].join(" ")}
          >
            {plugin.icon ? (
              <img
                src={plugin.icon}
                alt={`${plugin.name} icon`}
                className="h-full w-full object-contain p-1"
              />
            ) : (
              <ContractIcon className="h-5 w-5" />
            )}
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
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
                {plugin.name}
              </h3>
              <span className="text-xs text-neutral-400 shrink-0">v{plugin.version}</span>
              {plugin.builtIn && (
                <span className="px-1.5 py-0.5 text-xs font-medium bg-neutral-100 text-neutral-500 rounded">
                  Built-in
                </span>
              )}
            </div>

            {/* Contract badge and status */}
            <div className="flex items-center gap-2 mt-1">
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
                ].join(" ")}
              >
                {plugin.contract.toUpperCase()}
              </span>
              <div className="flex items-center gap-1">
                <div
                  className={["h-2", "w-2", "rounded-full", statusColors[plugin.status]].join(" ")}
                />
                <span className="text-xs text-neutral-500">{statusLabels[plugin.status]}</span>
              </div>
            </div>

            {/* Description */}
            {showDetails && (
              <p className="text-sm text-neutral-600 mt-2 line-clamp-2">{plugin.description}</p>
            )}

            {/* Tags */}
            {showDetails && plugin.tags && plugin.tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {plugin.tags.slice(0, 3).map((tag) => (
                  <span
                    key={tag}
                    className="px-1.5 py-0.5 text-xs bg-neutral-100 text-neutral-600 rounded"
                  >
                    {tag}
                  </span>
                ))}
                {plugin.tags.length > 3 && (
                  <span className="px-1.5 py-0.5 text-xs text-neutral-400">
                    +{plugin.tags.length - 3}
                  </span>
                )}
              </div>
            )}

            {/* Author and health */}
            {showDetails && (plugin.author || plugin.healthScore !== undefined) && (
              <div className="flex items-center gap-4 mt-2 text-xs text-neutral-500">
                {plugin.author && <span>by {plugin.author}</span>}
                {plugin.healthScore !== undefined && (
                  <div className="flex items-center gap-1">
                    <div className="h-1.5 w-16 bg-neutral-200 rounded-full overflow-hidden">
                      <div
                        className={[
                          "h-full",
                          "rounded-full",
                          plugin.healthScore >= 80
                            ? "bg-success-500"
                            : plugin.healthScore >= 50
                              ? "bg-warning-500"
                              : "bg-error-500",
                        ].join(" ")}
                        style={{ width: `${plugin.healthScore}%` }}
                      />
                    </div>
                    <span>{plugin.healthScore}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Status indicator (absolute positioned) */}
          <div
            className={[
              "absolute",
              "top-3",
              "right-3",
              "h-2.5",
              "w-2.5",
              "rounded-full",
              "border-2",
              "border-white",
              "shadow-sm",
              statusColors[plugin.status],
            ].join(" ")}
            title={statusLabels[plugin.status]}
          />

          {/* Permanent Load/Unload icon button */}
          {showActions && (
            <button
              type="button"
              onClick={handleToggleLoad}
              disabled={plugin.status === "loading" || plugin.status === "error"}
              className={[
                "absolute",
                "bottom-3",
                "right-3",
                "p-1.5",
                "rounded-md",
                "transition-colors",
                "duration-150",
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
          )}
        </div>

      </div>
    );
  }
);

PluginCard.displayName = "PluginCard";

/**
 * Compact plugin card variant for list views.
 */
export interface PluginCardCompactProps
  extends Omit<PluginCardProps, "showDetails" | "showActions" | "size"> {
  /** Show quick action button */
  showQuickAction?: boolean;
}

export const PluginCardCompact = forwardRef<HTMLDivElement, PluginCardCompactProps>(
  ({ plugin, isSelected, showQuickAction = true, onSelect, onLoad, onUnload, className = "", ...props }, ref) => {
    const ContractIcon = contractIcons[plugin.contract];

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
      isSelected
        ? "border-primary-500 bg-primary-50"
        : "border-neutral-200 hover:border-neutral-300",
      className,
    ].join(" ");

    const handleClick = () => onSelect?.(plugin);

    const handleAction = (e: React.MouseEvent) => {
      e.stopPropagation();
      if (plugin.status === "loaded") {
        onUnload?.(plugin);
      } else {
        onLoad?.(plugin);
      }
    };

    return (
      <div
        ref={ref}
        className={cardStyles}
        onClick={handleClick}
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
            contractColors[plugin.contract],
          ].join(" ")}
        >
          <ContractIcon className="h-4 w-4" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium text-neutral-900 truncate">{plugin.name}</span>
            <span className="text-xs text-neutral-400">v{plugin.version}</span>
          </div>
          <span className="text-xs text-neutral-500">{plugin.contract.toUpperCase()}</span>
        </div>

        {/* Status */}
        <div
          className={["h-2", "w-2", "rounded-full", "shrink-0", statusColors[plugin.status]].join(
            " "
          )}
        />

        {/* Quick action */}
        {showQuickAction && (
          <button
            type="button"
            onClick={handleAction}
            disabled={plugin.status === "loading"}
            className={[
              "px-2",
              "py-1",
              "text-xs",
              "font-medium",
              "rounded",
              "transition-colors",
              "duration-150",
              "shrink-0",
              plugin.status === "loaded"
                ? "bg-neutral-100 text-neutral-600 hover:bg-neutral-200"
                : "bg-primary-100 text-primary-700 hover:bg-primary-200",
            ].join(" ")}
          >
            {plugin.status === "loaded" ? "Stop" : "Start"}
          </button>
        )}
      </div>
    );
  }
);

PluginCardCompact.displayName = "PluginCardCompact";

export default PluginCard;
