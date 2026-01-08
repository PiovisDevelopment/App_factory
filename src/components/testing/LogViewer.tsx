/**
 * D060 - src/components/testing/LogViewer.tsx
 * ============================================
 * Plugin log viewer for real-time log monitoring and filtering.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D011 (Input.tsx), D014 (Panel.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, {
  useState,
  useCallback,
  useMemo,
  useRef,
  useEffect,
  type HTMLAttributes,
} from "react";

/**
 * Log level types.
 */
export type LogLevel = "debug" | "info" | "warning" | "error" | "critical";

/**
 * Log entry structure.
 */
export interface LogEntry {
  id: string;
  timestamp: Date;
  level: LogLevel;
  source: string;
  message: string;
  data?: Record<string, unknown>;
  pluginId?: string;
}

/**
 * Log filter options.
 */
export interface LogFilter {
  levels?: LogLevel[];
  sources?: string[];
  pluginIds?: string[];
  search?: string;
  startTime?: Date;
  endTime?: Date;
}

/**
 * LogViewer component props.
 */
export interface LogViewerProps extends HTMLAttributes<HTMLDivElement> {
  /** Log entries to display */
  logs: LogEntry[];
  /** Maximum entries to display */
  maxEntries?: number;
  /** Whether to auto-scroll to new entries */
  autoScroll?: boolean;
  /** Callback when log is cleared */
  onClear?: () => void;
  /** Callback when filter changes */
  onFilterChange?: (filter: LogFilter) => void;
  /** Callback to export logs */
  onExport?: (format: "json" | "csv" | "text") => void;
  /** Available sources for filtering */
  availableSources?: string[];
  /** Available plugins for filtering */
  availablePlugins?: { id: string; name: string }[];
  /** Show timestamp column */
  showTimestamp?: boolean;
  /** Show source column */
  showSource?: boolean;
  /** Compact display mode */
  compact?: boolean;
}

/**
 * Search icon.
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
  >
    <circle cx="11" cy="11" r="8" />
    <path d="m21 21-4.3-4.3" />
  </svg>
);

/**
 * Trash icon.
 */
const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

/**
 * Download icon.
 */
const DownloadIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <line x1="12" x2="12" y1="15" y2="3" />
  </svg>
);

/**
 * Scroll to bottom icon.
 */
const ArrowDownIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M12 5v14" />
    <path d="m19 12-7 7-7-7" />
  </svg>
);

/**
 * Filter icon.
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
  >
    <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" />
  </svg>
);

/**
 * Log level colors.
 */
const levelColors: Record<LogLevel, string> = {
  debug: "text-neutral-500",
  info: "text-info-600",
  warning: "text-warning-600",
  error: "text-error-600",
  critical: "text-error-700",
};

/**
 * Log level background colors.
 */
const levelBgColors: Record<LogLevel, string> = {
  debug: "bg-neutral-100",
  info: "bg-info-50",
  warning: "bg-warning-50",
  error: "bg-error-50",
  critical: "bg-error-100",
};

/**
 * Log level badge colors.
 */
const levelBadgeColors: Record<LogLevel, string> = {
  debug: "bg-neutral-200 text-neutral-700",
  info: "bg-info-100 text-info-700",
  warning: "bg-warning-100 text-warning-700",
  error: "bg-error-100 text-error-700",
  critical: "bg-error-200 text-error-800",
};

/**
 * All log levels.
 */
const ALL_LEVELS: LogLevel[] = ["debug", "info", "warning", "error", "critical"];

/**
 * Format timestamp for display.
 */
const formatTimestamp = (date: Date): string => {
  return date.toLocaleTimeString("en-US", {
    hour12: false,
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    fractionalSecondDigits: 3,
  } as Intl.DateTimeFormatOptions);
};

/**
 * LogViewer component.
 *
 * Real-time log viewer with filtering, search, and export capabilities.
 *
 * @example
 * ```tsx
 * <LogViewer
 *   logs={logEntries}
 *   onClear={clearLogs}
 *   onExport={exportLogs}
 *   autoScroll
 * />
 * ```
 */
export const LogViewer: React.FC<LogViewerProps> = ({
  logs,
  maxEntries = 1000,
  autoScroll = true,
  onClear,
  onFilterChange,
  onExport,
  availableSources = [],
  availablePlugins = [],
  showTimestamp = true,
  showSource = true,
  compact = false,
  className = "",
  ...props
}) => {
  // Filter state
  const [selectedLevels, setSelectedLevels] = useState<Set<LogLevel>>(
    new Set(ALL_LEVELS)
  );
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSources, setSelectedSources] = useState<Set<string>>(new Set());
  const [selectedPlugins, setSelectedPlugins] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [isAutoScrollEnabled, setIsAutoScrollEnabled] = useState(autoScroll);
  const [expandedLogs, setExpandedLogs] = useState<Set<string>>(new Set());

  // Refs
  const logContainerRef = useRef<HTMLDivElement>(null);
  const wasAtBottomRef = useRef(true);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let result = logs;

    // Filter by level
    if (selectedLevels.size < ALL_LEVELS.length) {
      result = result.filter((log) => selectedLevels.has(log.level));
    }

    // Filter by source
    if (selectedSources.size > 0) {
      result = result.filter((log) => selectedSources.has(log.source));
    }

    // Filter by plugin
    if (selectedPlugins.size > 0) {
      result = result.filter(
        (log) => log.pluginId && selectedPlugins.has(log.pluginId)
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (log) =>
          log.message.toLowerCase().includes(query) ||
          log.source.toLowerCase().includes(query) ||
          (log.pluginId && log.pluginId.toLowerCase().includes(query))
      );
    }

    // Limit entries
    if (result.length > maxEntries) {
      result = result.slice(-maxEntries);
    }

    return result;
  }, [logs, selectedLevels, selectedSources, selectedPlugins, searchQuery, maxEntries]);

  // Notify filter change
  useEffect(() => {
    if (onFilterChange) {
      const filter: LogFilter = {};

      if (selectedLevels.size < ALL_LEVELS.length) {
        filter.levels = Array.from(selectedLevels);
      }

      if (selectedSources.size > 0) {
        filter.sources = Array.from(selectedSources);
      }

      if (selectedPlugins.size > 0) {
        filter.pluginIds = Array.from(selectedPlugins);
      }

      const trimmedSearch = searchQuery.trim();
      if (trimmedSearch) {
        filter.search = trimmedSearch;
      }

      onFilterChange(filter);
    }
  }, [selectedLevels, selectedSources, selectedPlugins, searchQuery, onFilterChange]);

  // Auto-scroll handling
  useEffect(() => {
    const container = logContainerRef.current;
    if (!container || !isAutoScrollEnabled) return;

    // Check if we should scroll
    if (wasAtBottomRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [filteredLogs, isAutoScrollEnabled]);

  // Track scroll position
  const handleScroll = useCallback(() => {
    const container = logContainerRef.current;
    if (!container) return;

    const threshold = 50;
    const atBottom =
      container.scrollHeight - container.scrollTop - container.clientHeight <
      threshold;
    wasAtBottomRef.current = atBottom;
  }, []);

  // Toggle level filter
  const toggleLevel = useCallback((level: LogLevel) => {
    setSelectedLevels((prev) => {
      const next = new Set(prev);
      if (next.has(level)) {
        next.delete(level);
      } else {
        next.add(level);
      }
      return next;
    });
  }, []);

  // Toggle source filter
  const toggleSource = useCallback((source: string) => {
    setSelectedSources((prev) => {
      const next = new Set(prev);
      if (next.has(source)) {
        next.delete(source);
      } else {
        next.add(source);
      }
      return next;
    });
  }, []);

  // Toggle plugin filter
  const togglePlugin = useCallback((pluginId: string) => {
    setSelectedPlugins((prev) => {
      const next = new Set(prev);
      if (next.has(pluginId)) {
        next.delete(pluginId);
      } else {
        next.add(pluginId);
      }
      return next;
    });
  }, []);

  // Toggle log expansion
  const toggleExpanded = useCallback((logId: string) => {
    setExpandedLogs((prev) => {
      const next = new Set(prev);
      if (next.has(logId)) {
        next.delete(logId);
      } else {
        next.add(logId);
      }
      return next;
    });
  }, []);

  // Scroll to bottom
  const scrollToBottom = useCallback(() => {
    const container = logContainerRef.current;
    if (container) {
      container.scrollTop = container.scrollHeight;
      wasAtBottomRef.current = true;
    }
  }, []);

  // Clear all filters
  const clearFilters = useCallback(() => {
    setSelectedLevels(new Set(ALL_LEVELS));
    setSelectedSources(new Set());
    setSelectedPlugins(new Set());
    setSearchQuery("");
  }, []);

  // Check if any filters are active
  const hasActiveFilters =
    selectedLevels.size < ALL_LEVELS.length ||
    selectedSources.size > 0 ||
    selectedPlugins.size > 0 ||
    searchQuery.trim() !== "";

  // Container styles
  const containerStyles = [
    "flex",
    "flex-col",
    "bg-white",
    "rounded-lg",
    "border",
    "border-neutral-200",
    "overflow-hidden",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={containerStyles} {...props}>
      {/* Toolbar */}
      <div className="flex items-center justify-between p-3 border-b border-neutral-200 bg-neutral-50">
        {/* Search */}
        <div className="relative flex-1 max-w-md">
          <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search logs..."
            className={[
              "w-full",
              "pl-9",
              "pr-3",
              "py-1.5",
              "text-sm",
              "bg-white",
              "border",
              "border-neutral-300",
              "rounded-md",
              "focus:outline-none",
              "focus:ring-2",
              "focus:ring-primary-500",
            ].join(" ")}
          />
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 ml-4">
          {/* Filter toggle */}
          <button
            type="button"
            onClick={() => setShowFilters(!showFilters)}
            className={[
              "inline-flex",
              "items-center",
              "gap-1.5",
              "px-3",
              "py-1.5",
              "text-sm",
              "font-medium",
              "rounded-md",
              "transition-colors",
              "duration-150",
              showFilters || hasActiveFilters
                ? "bg-primary-100 text-primary-700"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
            ].join(" ")}
          >
            <FilterIcon className="h-4 w-4" />
            Filters
            {hasActiveFilters && (
              <span className="ml-1 px-1.5 py-0.5 text-xs bg-primary-600 text-white rounded-full">
                {(selectedLevels.size < ALL_LEVELS.length ? 1 : 0) +
                  (selectedSources.size > 0 ? 1 : 0) +
                  (selectedPlugins.size > 0 ? 1 : 0)}
              </span>
            )}
          </button>

          {/* Auto-scroll toggle */}
          <button
            type="button"
            onClick={() => setIsAutoScrollEnabled(!isAutoScrollEnabled)}
            className={[
              "inline-flex",
              "items-center",
              "gap-1.5",
              "px-3",
              "py-1.5",
              "text-sm",
              "font-medium",
              "rounded-md",
              "transition-colors",
              "duration-150",
              isAutoScrollEnabled
                ? "bg-primary-100 text-primary-700"
                : "bg-neutral-100 text-neutral-700 hover:bg-neutral-200",
            ].join(" ")}
            title={isAutoScrollEnabled ? "Auto-scroll enabled" : "Auto-scroll disabled"}
          >
            <ArrowDownIcon className="h-4 w-4" />
          </button>

          {/* Export */}
          {onExport && (
            <div className="relative group">
              <button
                type="button"
                className={[
                  "inline-flex",
                  "items-center",
                  "gap-1.5",
                  "px-3",
                  "py-1.5",
                  "text-sm",
                  "font-medium",
                  "bg-neutral-100",
                  "text-neutral-700",
                  "rounded-md",
                  "hover:bg-neutral-200",
                  "transition-colors",
                  "duration-150",
                ].join(" ")}
              >
                <DownloadIcon className="h-4 w-4" />
                Export
              </button>
              <div className="absolute right-0 mt-1 py-1 bg-white rounded-md shadow-lg border border-neutral-200 opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-150 z-10">
                <button
                  type="button"
                  onClick={() => onExport("json")}
                  className="block w-full px-4 py-1.5 text-sm text-left text-neutral-700 hover:bg-neutral-50"
                >
                  JSON
                </button>
                <button
                  type="button"
                  onClick={() => onExport("csv")}
                  className="block w-full px-4 py-1.5 text-sm text-left text-neutral-700 hover:bg-neutral-50"
                >
                  CSV
                </button>
                <button
                  type="button"
                  onClick={() => onExport("text")}
                  className="block w-full px-4 py-1.5 text-sm text-left text-neutral-700 hover:bg-neutral-50"
                >
                  Plain Text
                </button>
              </div>
            </div>
          )}

          {/* Clear */}
          {onClear && (
            <button
              type="button"
              onClick={onClear}
              className={[
                "inline-flex",
                "items-center",
                "gap-1.5",
                "px-3",
                "py-1.5",
                "text-sm",
                "font-medium",
                "bg-neutral-100",
                "text-neutral-700",
                "rounded-md",
                "hover:bg-error-50",
                "hover:text-error-700",
                "transition-colors",
                "duration-150",
              ].join(" ")}
            >
              <TrashIcon className="h-4 w-4" />
              Clear
            </button>
          )}
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="p-3 border-b border-neutral-200 bg-neutral-50 space-y-3">
          {/* Level filters */}
          <div>
            <span className="text-xs font-medium text-neutral-600 mb-2 block">
              Log Levels
            </span>
            <div className="flex flex-wrap gap-2">
              {ALL_LEVELS.map((level) => (
                <button
                  key={level}
                  type="button"
                  onClick={() => toggleLevel(level)}
                  className={[
                    "px-2.5",
                    "py-1",
                    "text-xs",
                    "font-medium",
                    "rounded-md",
                    "border",
                    "transition-colors",
                    "duration-150",
                    selectedLevels.has(level)
                      ? levelBadgeColors[level] + " border-transparent"
                      : "bg-white border-neutral-200 text-neutral-400",
                  ].join(" ")}
                >
                  {level.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Source filters */}
          {availableSources.length > 0 && (
            <div>
              <span className="text-xs font-medium text-neutral-600 mb-2 block">
                Sources
              </span>
              <div className="flex flex-wrap gap-2">
                {availableSources.map((source) => (
                  <button
                    key={source}
                    type="button"
                    onClick={() => toggleSource(source)}
                    className={[
                      "px-2.5",
                      "py-1",
                      "text-xs",
                      "font-medium",
                      "rounded-md",
                      "border",
                      "transition-colors",
                      "duration-150",
                      selectedSources.has(source)
                        ? "bg-primary-100 text-primary-700 border-transparent"
                        : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300",
                    ].join(" ")}
                  >
                    {source}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Plugin filters */}
          {availablePlugins.length > 0 && (
            <div>
              <span className="text-xs font-medium text-neutral-600 mb-2 block">
                Plugins
              </span>
              <div className="flex flex-wrap gap-2">
                {availablePlugins.map((plugin) => (
                  <button
                    key={plugin.id}
                    type="button"
                    onClick={() => togglePlugin(plugin.id)}
                    className={[
                      "px-2.5",
                      "py-1",
                      "text-xs",
                      "font-medium",
                      "rounded-md",
                      "border",
                      "transition-colors",
                      "duration-150",
                      selectedPlugins.has(plugin.id)
                        ? "bg-primary-100 text-primary-700 border-transparent"
                        : "bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300",
                    ].join(" ")}
                  >
                    {plugin.name}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Clear filters */}
          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearFilters}
              className="text-xs text-primary-600 hover:text-primary-700 font-medium"
            >
              Clear all filters
            </button>
          )}
        </div>
      )}

      {/* Log entries */}
      <div
        ref={logContainerRef}
        onScroll={handleScroll}
        className={[
          "flex-1",
          "overflow-y-auto",
          "font-mono",
          "text-xs",
          compact ? "p-2" : "p-3",
          "bg-neutral-900",
        ].join(" ")}
        style={{ minHeight: "200px", maxHeight: "500px" }}
      >
        {filteredLogs.length === 0 ? (
          <div className="flex items-center justify-center h-full text-neutral-500">
            {logs.length === 0 ? "No logs yet" : "No logs match filters"}
          </div>
        ) : (
          <div className="space-y-0.5">
            {filteredLogs.map((log) => (
              <div
                key={log.id}
                className={[
                  "flex",
                  "items-start",
                  "gap-2",
                  compact ? "py-0.5" : "py-1",
                  "px-2",
                  "rounded",
                  "hover:bg-neutral-800",
                  log.data && "cursor-pointer",
                ].filter(Boolean).join(" ")}
                onClick={() => log.data && toggleExpanded(log.id)}
              >
                {/* Timestamp */}
                {showTimestamp && (
                  <span className="text-neutral-500 shrink-0">
                    {formatTimestamp(log.timestamp)}
                  </span>
                )}

                {/* Level badge */}
                <span
                  className={[
                    "shrink-0",
                    "px-1.5",
                    "py-0.5",
                    "rounded",
                    "text-xs",
                    "font-medium",
                    "uppercase",
                    levelBadgeColors[log.level],
                  ].join(" ")}
                >
                  {log.level.slice(0, 4)}
                </span>

                {/* Source */}
                {showSource && (
                  <span className="text-primary-400 shrink-0">
                    [{log.source}]
                  </span>
                )}

                {/* Plugin ID */}
                {log.pluginId && (
                  <span className="text-cyan-400 shrink-0">
                    &lt;{log.pluginId}&gt;
                  </span>
                )}

                {/* Message */}
                <span className={levelColors[log.level]}>
                  {log.message}
                </span>

                {/* Expandable indicator */}
                {log.data && (
                  <span className="text-neutral-600 ml-auto">
                    {expandedLogs.has(log.id) ? "▼" : "▶"}
                  </span>
                )}
              </div>
            ))}

            {/* Expanded data */}
            {filteredLogs.map(
              (log) =>
                log.data &&
                expandedLogs.has(log.id) && (
                  <div
                    key={`${log.id}-data`}
                    className="ml-6 p-2 bg-neutral-800 rounded text-neutral-300 whitespace-pre-wrap"
                  >
                    {JSON.stringify(log.data, null, 2)}
                  </div>
                )
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-3 py-2 border-t border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
        <span>
          {filteredLogs.length} of {logs.length} entries
          {hasActiveFilters && " (filtered)"}
        </span>
        <button
          type="button"
          onClick={scrollToBottom}
          className="text-primary-600 hover:text-primary-700 font-medium"
        >
          Scroll to bottom
        </button>
      </div>
    </div>
  );
};

LogViewer.displayName = "LogViewer";

export default LogViewer;
