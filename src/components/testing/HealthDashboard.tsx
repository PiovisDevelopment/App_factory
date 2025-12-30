/**
 * D059 - src/components/testing/HealthDashboard.tsx
 * ==================================================
 * Health status dashboard for monitoring plugin system health.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D014 (Panel.tsx), D057 (PluginTester.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { useMemo, type HTMLAttributes } from "react";

/**
 * Health status levels.
 */
export type HealthStatus = "healthy" | "degraded" | "unhealthy" | "unknown";

/**
 * Plugin health info.
 */
export interface PluginHealth {
  id: string;
  name: string;
  displayName: string;
  contract: string;
  status: HealthStatus;
  lastCheck: Date;
  uptime?: number;
  responseTime?: number;
  memoryUsage?: number;
  errorCount?: number;
  lastError?: string;
}

/**
 * System health info.
 */
export interface SystemHealth {
  pluginHost: {
    status: HealthStatus;
    pid?: number;
    uptime?: number;
    memoryUsage?: number;
    cpuUsage?: number;
  };
  ipc: {
    status: HealthStatus;
    pendingRequests?: number;
    averageLatency?: number;
    errorRate?: number;
  };
  plugins: {
    total: number;
    healthy: number;
    degraded: number;
    unhealthy: number;
    unknown: number;
  };
}

/**
 * HealthDashboard component props.
 */
export interface HealthDashboardProps extends HTMLAttributes<HTMLDivElement> {
  /** System health data */
  systemHealth: SystemHealth;
  /** Individual plugin health data */
  pluginHealth: PluginHealth[];
  /** Last refresh timestamp */
  lastRefresh?: Date;
  /** Callback to refresh health data */
  onRefresh?: () => void;
  /** Whether refresh is in progress */
  isRefreshing?: boolean;
  /** Auto-refresh interval in ms (0 = disabled) */
  autoRefreshInterval?: number;
  /** Callback when plugin is clicked */
  onPluginClick?: (plugin: PluginHealth) => void;
  /** Compact display mode */
  compact?: boolean;
}

/**
 * Heart pulse icon.
 */
const HeartPulseIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
  </svg>
);

/**
 * Server icon.
 */
const ServerIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
    <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
    <line x1="6" x2="6.01" y1="6" y2="6" />
    <line x1="6" x2="6.01" y1="18" y2="18" />
  </svg>
);

/**
 * Activity icon.
 */
const ActivityIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
  </svg>
);

/**
 * Refresh icon.
 */
const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
    <path d="M21 3v5h-5" />
    <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
    <path d="M8 16H3v5" />
  </svg>
);

/**
 * Clock icon.
 */
const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/**
 * Alert circle icon.
 */
const AlertCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <line x1="12" x2="12" y1="8" y2="12" />
    <line x1="12" x2="12.01" y1="16" y2="16" />
  </svg>
);

/**
 * Status color mapping.
 */
const statusColors: Record<HealthStatus, string> = {
  healthy: "text-success-600",
  degraded: "text-warning-600",
  unhealthy: "text-error-600",
  unknown: "text-neutral-400",
};

/**
 * Status background color mapping.
 */
const statusBgColors: Record<HealthStatus, string> = {
  healthy: "bg-success-50",
  degraded: "bg-warning-50",
  unhealthy: "bg-error-50",
  unknown: "bg-neutral-50",
};

/**
 * Status border color mapping.
 */
const statusBorderColors: Record<HealthStatus, string> = {
  healthy: "border-success-200",
  degraded: "border-warning-200",
  unhealthy: "border-error-200",
  unknown: "border-neutral-200",
};

/**
 * Status dot color mapping.
 */
const statusDotColors: Record<HealthStatus, string> = {
  healthy: "bg-success-500",
  degraded: "bg-warning-500",
  unhealthy: "bg-error-500",
  unknown: "bg-neutral-400",
};

/**
 * Contract badge colors.
 */
const contractColors: Record<string, string> = {
  tts: "bg-primary-100 text-primary-700",
  stt: "bg-success-50 text-success-700",
  llm: "bg-warning-50 text-warning-700",
  mcp: "bg-info-50 text-info-700",
  vision: "bg-purple-100 text-purple-700",
  embedding: "bg-cyan-100 text-cyan-700",
};

/**
 * Format uptime for display.
 */
const formatUptime = (seconds: number): string => {
  if (seconds < 60) return `${seconds}s`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ${Math.floor((seconds % 3600) / 60)}m`;
  return `${Math.floor(seconds / 86400)}d ${Math.floor((seconds % 86400) / 3600)}h`;
};

/**
 * Format bytes for display.
 */
const formatBytes = (bytes: number): string => {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

/**
 * Format time ago for display.
 */
const formatTimeAgo = (date: Date): string => {
  const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
  if (seconds < 5) return "just now";
  if (seconds < 60) return `${seconds}s ago`;
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  return `${Math.floor(seconds / 3600)}h ago`;
};

/**
 * HealthDashboard component.
 *
 * Displays system and plugin health status with real-time monitoring.
 *
 * @example
 * ```tsx
 * <HealthDashboard
 *   systemHealth={systemHealthData}
 *   pluginHealth={pluginHealthData}
 *   onRefresh={handleRefresh}
 *   autoRefreshInterval={5000}
 * />
 * ```
 */
export const HealthDashboard: React.FC<HealthDashboardProps> = ({
  systemHealth,
  pluginHealth,
  lastRefresh,
  onRefresh,
  isRefreshing = false,
  autoRefreshInterval = 0,
  onPluginClick,
  compact = false,
  className = "",
  ...props
}) => {
  // Overall system status
  const overallStatus = useMemo((): HealthStatus => {
    if (systemHealth.pluginHost.status === "unhealthy") return "unhealthy";
    if (systemHealth.ipc.status === "unhealthy") return "unhealthy";
    if (systemHealth.plugins.unhealthy > 0) return "degraded";
    if (systemHealth.plugins.degraded > 0) return "degraded";
    if (systemHealth.pluginHost.status === "degraded") return "degraded";
    if (systemHealth.ipc.status === "degraded") return "degraded";
    if (
      systemHealth.pluginHost.status === "healthy" &&
      systemHealth.ipc.status === "healthy"
    ) {
      return "healthy";
    }
    return "unknown";
  }, [systemHealth]);

  // Container styles
  const containerStyles = [
    "flex",
    "flex-col",
    "gap-4",
    className,
  ].filter(Boolean).join(" ");

  // Card base styles
  const cardStyles = [
    "bg-white",
    "rounded-lg",
    "border",
    "border-neutral-200",
    "overflow-hidden",
  ].join(" ");

  return (
    <div className={containerStyles} {...props}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className={[
              "p-2",
              "rounded-lg",
              statusBgColors[overallStatus],
            ].join(" ")}
          >
            <HeartPulseIcon
              className={["h-5 w-5", statusColors[overallStatus]].join(" ")}
            />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-neutral-900">
              System Health
            </h3>
            <p className={["text-xs font-medium", statusColors[overallStatus]].join(" ")}>
              {overallStatus.charAt(0).toUpperCase() + overallStatus.slice(1)}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-neutral-500">
              Updated {formatTimeAgo(lastRefresh)}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing || !onRefresh}
            className={[
              "inline-flex",
              "items-center",
              "gap-1.5",
              "px-3",
              "py-1.5",
              "text-sm",
              "font-medium",
              "text-neutral-700",
              "bg-neutral-100",
              "rounded-md",
              "hover:bg-neutral-200",
              "disabled:opacity-50",
              "disabled:cursor-not-allowed",
              "transition-colors",
              "duration-150",
            ].join(" ")}
          >
            <RefreshIcon
              className={[
                "h-4 w-4",
                isRefreshing && "animate-spin",
              ].filter(Boolean).join(" ")}
            />
            {isRefreshing ? "Refreshing..." : "Refresh"}
          </button>
        </div>
      </div>

      {/* System status cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Plugin Host status */}
        <div className={cardStyles}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ServerIcon className="h-4 w-4 text-neutral-500" />
                <span className="text-sm font-medium text-neutral-700">
                  Plugin Host
                </span>
              </div>
              <div
                className={[
                  "h-2 w-2 rounded-full",
                  statusDotColors[systemHealth.pluginHost.status],
                ].join(" ")}
              />
            </div>

            <div className="space-y-2">
              {systemHealth.pluginHost.pid && (
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">PID</span>
                  <span className="text-neutral-700 font-mono">
                    {systemHealth.pluginHost.pid}
                  </span>
                </div>
              )}
              {systemHealth.pluginHost.uptime !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Uptime</span>
                  <span className="text-neutral-700">
                    {formatUptime(systemHealth.pluginHost.uptime)}
                  </span>
                </div>
              )}
              {systemHealth.pluginHost.memoryUsage !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Memory</span>
                  <span className="text-neutral-700">
                    {formatBytes(systemHealth.pluginHost.memoryUsage)}
                  </span>
                </div>
              )}
              {systemHealth.pluginHost.cpuUsage !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">CPU</span>
                  <span className="text-neutral-700">
                    {systemHealth.pluginHost.cpuUsage.toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* IPC status */}
        <div className={cardStyles}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <ActivityIcon className="h-4 w-4 text-neutral-500" />
                <span className="text-sm font-medium text-neutral-700">
                  IPC Channel
                </span>
              </div>
              <div
                className={[
                  "h-2 w-2 rounded-full",
                  statusDotColors[systemHealth.ipc.status],
                ].join(" ")}
              />
            </div>

            <div className="space-y-2">
              {systemHealth.ipc.pendingRequests !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Pending</span>
                  <span className="text-neutral-700">
                    {systemHealth.ipc.pendingRequests} requests
                  </span>
                </div>
              )}
              {systemHealth.ipc.averageLatency !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Latency</span>
                  <span className="text-neutral-700">
                    {systemHealth.ipc.averageLatency.toFixed(0)}ms avg
                  </span>
                </div>
              )}
              {systemHealth.ipc.errorRate !== undefined && (
                <div className="flex justify-between text-xs">
                  <span className="text-neutral-500">Error Rate</span>
                  <span
                    className={
                      systemHealth.ipc.errorRate > 0.05
                        ? "text-error-600"
                        : "text-neutral-700"
                    }
                  >
                    {(systemHealth.ipc.errorRate * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Plugin summary */}
        <div className={cardStyles}>
          <div className="p-4">
            <div className="flex items-center justify-between mb-3">
              <span className="text-sm font-medium text-neutral-700">
                Plugins
              </span>
              <span className="text-xs text-neutral-500">
                {systemHealth.plugins.total} total
              </span>
            </div>

            <div className="flex items-center gap-2">
              <div className="flex-1 h-2 bg-neutral-100 rounded-full overflow-hidden">
                {systemHealth.plugins.total > 0 && (
                  <>
                    <div
                      className="h-full bg-success-500 float-left"
                      style={{
                        width: `${(systemHealth.plugins.healthy / systemHealth.plugins.total) * 100}%`,
                      }}
                    />
                    <div
                      className="h-full bg-warning-500 float-left"
                      style={{
                        width: `${(systemHealth.plugins.degraded / systemHealth.plugins.total) * 100}%`,
                      }}
                    />
                    <div
                      className="h-full bg-error-500 float-left"
                      style={{
                        width: `${(systemHealth.plugins.unhealthy / systemHealth.plugins.total) * 100}%`,
                      }}
                    />
                  </>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-success-500" />
                <span className="text-neutral-600">
                  {systemHealth.plugins.healthy} healthy
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-warning-500" />
                <span className="text-neutral-600">
                  {systemHealth.plugins.degraded} degraded
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-error-500" />
                <span className="text-neutral-600">
                  {systemHealth.plugins.unhealthy} unhealthy
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full bg-neutral-400" />
                <span className="text-neutral-600">
                  {systemHealth.plugins.unknown} unknown
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Plugin health list */}
      <div className={cardStyles}>
        <div className="p-4 border-b border-neutral-200 bg-neutral-50">
          <h4 className="text-sm font-semibold text-neutral-900">
            Plugin Health Details
          </h4>
        </div>

        {pluginHealth.length === 0 ? (
          <div className="p-6 text-center text-sm text-neutral-500">
            No plugins loaded
          </div>
        ) : (
          <div className="divide-y divide-neutral-100">
            {pluginHealth.map((plugin) => (
              <div
                key={plugin.id}
                onClick={() => onPluginClick?.(plugin)}
                className={[
                  "p-4",
                  "transition-colors",
                  "duration-150",
                  onPluginClick && "cursor-pointer hover:bg-neutral-50",
                ].filter(Boolean).join(" ")}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={[
                        "h-2.5 w-2.5 rounded-full mt-1",
                        statusDotColors[plugin.status],
                      ].join(" ")}
                    />
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-neutral-900">
                          {plugin.displayName}
                        </span>
                        <span
                          className={[
                            "px-1.5",
                            "py-0.5",
                            "text-xs",
                            "font-medium",
                            "rounded",
                            contractColors[plugin.contract] || "bg-neutral-100 text-neutral-700",
                          ].join(" ")}
                        >
                          {plugin.contract.toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs text-neutral-500 mt-0.5">
                        {plugin.id}
                      </p>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="flex items-center gap-3 text-xs">
                      {plugin.responseTime !== undefined && (
                        <span className="text-neutral-500">
                          {plugin.responseTime}ms
                        </span>
                      )}
                      {plugin.uptime !== undefined && (
                        <span className="text-neutral-500">
                          Up {formatUptime(plugin.uptime)}
                        </span>
                      )}
                    </div>
                    {plugin.lastCheck && (
                      <p className="text-xs text-neutral-400 mt-1">
                        Checked {formatTimeAgo(plugin.lastCheck)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Error display */}
                {plugin.status === "unhealthy" && plugin.lastError && (
                  <div className="mt-3 flex items-start gap-2 p-2 rounded bg-error-50">
                    <AlertCircleIcon className="h-4 w-4 text-error-500 shrink-0 mt-0.5" />
                    <p className="text-xs text-error-700">
                      {plugin.lastError}
                    </p>
                  </div>
                )}

                {/* Metrics row */}
                {!compact && (plugin.memoryUsage !== undefined || plugin.errorCount !== undefined) && (
                  <div className="mt-3 flex items-center gap-4 text-xs text-neutral-500">
                    {plugin.memoryUsage !== undefined && (
                      <span>Memory: {formatBytes(plugin.memoryUsage)}</span>
                    )}
                    {plugin.errorCount !== undefined && plugin.errorCount > 0 && (
                      <span className="text-error-600">
                        Errors: {plugin.errorCount}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Auto-refresh indicator */}
      {autoRefreshInterval > 0 && (
        <div className="flex items-center justify-center gap-2 text-xs text-neutral-400">
          <ClockIcon className="h-3.5 w-3.5" />
          Auto-refresh every {autoRefreshInterval / 1000}s
        </div>
      )}
    </div>
  );
};

HealthDashboard.displayName = "HealthDashboard";

export default HealthDashboard;
