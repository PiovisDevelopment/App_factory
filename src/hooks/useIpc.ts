/**
 * D078 - src/hooks/useIpc.ts
 * ==========================
 * React hook for IPC communication with the Python subprocess.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D075, D076, D036
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *
 * This hook provides:
 *   - IPC lifecycle management (start/stop)
 *   - Status monitoring and health checks
 *   - Generic IPC call interface
 *   - Batch request support
 *   - Error handling and recovery
 *
 * Usage:
 *   ```tsx
 *   const { status, call, start, stop, isReady } = useIpc();
 *
 *   // Start IPC when component mounts
 *   useEffect(() => { start(); }, [start]);
 *
 *   // Make IPC calls
 *   const result = await call('plugin/list', {});
 *   ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { useFactoryStore } from "../stores/factoryStore";
import { isTauri } from "../utils/tauriUtils";

// ============================================
// TYPES
// ============================================

/**
 * IPC lifecycle state.
 */
export type IpcLifecycleState =
  | "uninitialized"
  | "starting"
  | "running"
  | "stopping"
  | "stopped"
  | "error";

/**
 * IPC health status.
 */
export interface IpcHealthStatus {
  /** Whether the subprocess is healthy */
  isHealthy: boolean;
  /** Last latency measurement in ms */
  lastLatencyMs: number | null;
  /** Consecutive failure count */
  failureCount: number;
  /** Last check timestamp */
  lastCheckAt: number | null;
  /** Last error message */
  lastError: string | null;
}

/**
 * IPC manager statistics.
 */
export interface IpcManagerStats {
  /** Current lifecycle state */
  lifecycleState: IpcLifecycleState;
  /** Health status */
  healthStatus: IpcHealthStatus;
  /** Total requests sent */
  totalRequests: number;
  /** Successful requests */
  successfulRequests: number;
  /** Failed requests */
  failedRequests: number;
  /** Average response time in ms */
  avgResponseTimeMs: number;
  /** Subprocess uptime in seconds */
  uptimeSeconds: number;
  /** Respawn count */
  respawnCount: number;
}

/**
 * IPC call options.
 */
export interface IpcCallOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Retry count on failure */
  retries?: number;
  /** Show loading indicator */
  showLoading?: boolean;
  /** Loading message */
  loadingMessage?: string;
}

/**
 * Batch request item.
 */
export interface BatchRequest {
  /** Method name */
  method: string;
  /** Method parameters */
  params?: Record<string, unknown>;
}

/**
 * Batch result item.
 */
export interface BatchResult {
  /** Whether request succeeded */
  success: boolean;
  /** Result data if successful */
  result?: unknown;
  /** Error if failed */
  error?: {
    code: string;
    message: string;
  };
}

/**
 * Command error from Rust backend.
 */
export interface CommandError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Additional details */
  details?: Record<string, unknown>;
}

/**
 * IPC hook return type.
 */
export interface UseIpcReturn {
  /** Current IPC status */
  status: IpcLifecycleState;
  /** Health information */
  health: IpcHealthStatus;
  /** Manager statistics */
  stats: IpcManagerStats | null;
  /** Whether IPC is ready for requests */
  isReady: boolean;
  /** Whether IPC is starting */
  isStarting: boolean;
  /** Whether a call is in progress */
  isLoading: boolean;
  /** Last error */
  error: string | null;
  /** Start IPC */
  start: () => Promise<void>;
  /** Stop IPC */
  stop: () => Promise<void>;
  /** Make IPC call */
  call: <T = unknown>(
    method: string,
    params?: Record<string, unknown>,
    options?: IpcCallOptions
  ) => Promise<T>;
  /** Make batch IPC calls */
  batch: (requests: BatchRequest[]) => Promise<BatchResult[]>;
  /** Check health */
  checkHealth: () => Promise<IpcHealthStatus>;
  /** Ping subprocess */
  ping: () => Promise<boolean>;
  /** Refresh status */
  refreshStatus: () => Promise<void>;
  /** Clear error */
  clearError: () => void;
}

// ============================================
// DEFAULT VALUES
// ============================================

const DEFAULT_HEALTH: IpcHealthStatus = {
  isHealthy: false,
  lastLatencyMs: null,
  failureCount: 0,
  lastCheckAt: null,
  lastError: null,
};

const DEFAULT_STATS: IpcManagerStats = {
  lifecycleState: "uninitialized",
  healthStatus: DEFAULT_HEALTH,
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  avgResponseTimeMs: 0,
  uptimeSeconds: 0,
  respawnCount: 0,
};

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse lifecycle state from backend response.
 */
function parseLifecycleState(state: string): IpcLifecycleState {
  const stateMap: Record<string, IpcLifecycleState> = {
    Uninitialized: "uninitialized",
    Starting: "starting",
    Running: "running",
    Stopping: "stopping",
    Stopped: "stopped",
    Error: "error",
  };
  return stateMap[state] || "uninitialized";
}

/**
 * Parse health status from backend response.
 */
function parseHealthStatus(data: Record<string, unknown>): IpcHealthStatus {
  return {
    isHealthy: Boolean(data.is_healthy ?? data.isHealthy ?? false),
    lastLatencyMs: (data.last_latency_ms ?? data.lastLatencyMs ?? null) as number | null,
    failureCount: (data.failure_count ?? data.failureCount ?? 0) as number,
    lastCheckAt: (data.last_check_at ?? data.lastCheckAt ?? null) as number | null,
    lastError: (data.last_error ?? data.lastError ?? null) as string | null,
  };
}

/**
 * Parse manager stats from backend response.
 */
function parseManagerStats(data: Record<string, unknown>): IpcManagerStats {
  const healthData = (data.health_status ?? data.healthStatus ?? {}) as Record<string, unknown>;
  return {
    lifecycleState: parseLifecycleState(
      (data.lifecycle_state ?? data.lifecycleState ?? "uninitialized") as string
    ),
    healthStatus: parseHealthStatus(healthData),
    totalRequests: (data.total_requests ?? data.totalRequests ?? 0) as number,
    successfulRequests: (data.successful_requests ?? data.successfulRequests ?? 0) as number,
    failedRequests: (data.failed_requests ?? data.failedRequests ?? 0) as number,
    avgResponseTimeMs: (data.avg_response_time_ms ?? data.avgResponseTimeMs ?? 0) as number,
    uptimeSeconds: (data.uptime_seconds ?? data.uptimeSeconds ?? 0) as number,
    respawnCount: (data.respawn_count ?? data.respawnCount ?? 0) as number,
  };
}

/**
 * Convert command error to string.
 */
function errorToString(error: unknown): string {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const err = error as CommandError;
    if (err.message) return `[${err.code || "ERROR"}] ${err.message}`;
  }
  return String(error);
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

/**
 * React hook for IPC communication with Python subprocess.
 *
 * Provides lifecycle management, status monitoring, and call interface
 * for communicating with the plugin host via Tauri commands.
 *
 * @example
 * ```tsx
 * function App() {
 *   const { status, call, start, isReady } = useIpc();
 *
 *   useEffect(() => {
 *     start();
 *   }, [start]);
 *
 *   const handleClick = async () => {
 *     if (!isReady) return;
 *     const plugins = await call('plugin/list');
 *     console.log(plugins);
 *   };
 *
 *   return (
 *     <div>
 *       <p>IPC Status: {status}</p>
 *       <button onClick={handleClick} disabled={!isReady}>
 *         List Plugins
 *       </button>
 *     </div>
 *   );
 * }
 * ```
 */
export function useIpc(): UseIpcReturn {
  // State
  const [status, setStatus] = useState<IpcLifecycleState>("uninitialized");
  const [health, setHealth] = useState<IpcHealthStatus>(DEFAULT_HEALTH);
  const [stats, setStats] = useState<IpcManagerStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Refs for cleanup
  const statusIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Factory store integration
  const setFactoryLoading = useFactoryStore((state) => state.setLoading);
  const addNotification = useFactoryStore((state) => state.addNotification);

  /**
   * Start the IPC manager.
   */
  const start = useCallback(async () => {
    if (status === "running" || status === "starting") return;
    if (!isTauri()) {
      console.warn('[useIpc] start: Not in Tauri environment, skipping');
      return;
    }

    try {
      setStatus("starting");
      setError(null);

      await invoke("ipc_start");

      if (mountedRef.current) {
        setStatus("running");
        setHealth((prev) => ({ ...prev, isHealthy: true }));
      }
    } catch (err) {
      const errorMsg = errorToString(err);
      if (mountedRef.current) {
        setStatus("error");
        setError(errorMsg);
        setHealth((prev) => ({ ...prev, isHealthy: false, lastError: errorMsg }));
      }
      throw err;
    }
  }, [status]);

  /**
   * Stop the IPC manager.
   */
  const stop = useCallback(async () => {
    if (status === "stopped" || status === "stopping") return;
    if (!isTauri()) {
      console.warn('[useIpc] stop: Not in Tauri environment, skipping');
      return;
    }

    try {
      setStatus("stopping");
      setError(null);

      await invoke("ipc_stop");

      if (mountedRef.current) {
        setStatus("stopped");
        setHealth(DEFAULT_HEALTH);
      }
    } catch (err) {
      const errorMsg = errorToString(err);
      if (mountedRef.current) {
        setStatus("error");
        setError(errorMsg);
      }
      throw err;
    }
  }, [status]);

  /**
   * Make an IPC call.
   */
  const call = useCallback(
    async <T = unknown>(
      method: string,
      params: Record<string, unknown> = {},
      options: IpcCallOptions = {}
    ): Promise<T> => {
      if (!isTauri()) {
        throw new Error('IPC call unavailable: Not running in Tauri environment');
      }
      const { showLoading = false, loadingMessage = "Processing..." } = options;

      try {
        if (showLoading) {
          setIsLoading(true);
          setFactoryLoading(true, loadingMessage);
        }

        const result = await invoke<T>("ipc_call", {
          method,
          params,
        });

        return result;
      } catch (err) {
        const errorMsg = errorToString(err);
        setError(errorMsg);
        throw err;
      } finally {
        if (showLoading) {
          setIsLoading(false);
          setFactoryLoading(false);
        }
      }
    },
    [setFactoryLoading]
  );

  /**
   * Make batch IPC calls.
   */
  const batch = useCallback(async (requests: BatchRequest[]): Promise<BatchResult[]> => {
    if (!isTauri()) {
      throw new Error('IPC batch unavailable: Not running in Tauri environment');
    }
    try {
      setIsLoading(true);

      const results = await invoke<BatchResult[]>("ipc_batch", {
        requests: requests.map((r) => ({
          method: r.method,
          params: r.params || {},
        })),
      });

      return results;
    } catch (err) {
      const errorMsg = errorToString(err);
      setError(errorMsg);
      throw err;
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * Check subprocess health.
   */
  const checkHealth = useCallback(async (): Promise<IpcHealthStatus> => {
    if (!isTauri()) {
      return { ...DEFAULT_HEALTH, lastError: 'Not in Tauri environment' };
    }
    try {
      const result = await invoke<Record<string, unknown>>("health_check");
      const healthStatus = parseHealthStatus(result);

      if (mountedRef.current) {
        setHealth(healthStatus);
      }

      return healthStatus;
    } catch (err) {
      const errorMsg = errorToString(err);
      const unhealthyStatus: IpcHealthStatus = {
        ...DEFAULT_HEALTH,
        isHealthy: false,
        lastError: errorMsg,
        lastCheckAt: Date.now(),
      };

      if (mountedRef.current) {
        setHealth(unhealthyStatus);
      }

      return unhealthyStatus;
    }
  }, []);

  /**
   * Ping the subprocess.
   */
  const ping = useCallback(async (): Promise<boolean> => {
    if (!isTauri()) {
      return false;
    }
    try {
      await invoke("ping");
      return true;
    } catch {
      return false;
    }
  }, []);

  /**
   * Refresh status from backend.
   */
  const refreshStatus = useCallback(async () => {
    if (!isTauri()) {
      // Not in Tauri - set safe defaults
      setStatus("stopped");
      setHealth(DEFAULT_HEALTH);
      return;
    }
    try {
      const result = await invoke<Record<string, unknown>>("ipc_status");
      const managerStats = parseManagerStats(result);

      if (mountedRef.current) {
        setStats(managerStats);
        setStatus(managerStats.lifecycleState);
        setHealth(managerStats.healthStatus);
      }
    } catch (err) {
      // Status check failed - subprocess might not be running
      if (mountedRef.current) {
        setStatus("uninitialized");
        setHealth(DEFAULT_HEALTH);
      }
    }
  }, []);

  /**
   * Clear error state.
   */
  const clearError = useCallback(() => {
    setError(null);
  }, []);

  // Check if IPC is ready
  const isReady = status === "running" && health.isHealthy;
  const isStarting = status === "starting";

  // Initial status check on mount
  useEffect(() => {
    mountedRef.current = true;
    refreshStatus();

    return () => {
      mountedRef.current = false;
    };
  }, [refreshStatus]);

  // Periodic status polling when running
  useEffect(() => {
    if (status === "running") {
      // Poll every 5 seconds while running
      statusIntervalRef.current = setInterval(() => {
        refreshStatus();
      }, 5000);
    }

    return () => {
      if (statusIntervalRef.current) {
        clearInterval(statusIntervalRef.current);
        statusIntervalRef.current = null;
      }
    };
  }, [status, refreshStatus]);

  return {
    status,
    health,
    stats,
    isReady,
    isStarting,
    isLoading,
    error,
    start,
    stop,
    call,
    batch,
    checkHealth,
    ping,
    refreshStatus,
    clearError,
  };
}

// ============================================
// SPECIALIZED HOOKS
// ============================================

/**
 * Hook for IPC status only (lightweight).
 */
export function useIpcStatus(): {
  status: IpcLifecycleState;
  isReady: boolean;
  health: IpcHealthStatus;
} {
  const [status, setStatus] = useState<IpcLifecycleState>("uninitialized");
  const [health, setHealth] = useState<IpcHealthStatus>(DEFAULT_HEALTH);

  useEffect(() => {
    let mounted = true;

    const checkStatus = async () => {
      if (!isTauri()) {
        if (mounted) {
          setStatus("stopped");
          setHealth(DEFAULT_HEALTH);
        }
        return;
      }
      try {
        const ready = await invoke<boolean>("ipc_ready");
        if (mounted) {
          setStatus(ready ? "running" : "stopped");
          setHealth((prev) => ({ ...prev, isHealthy: ready }));
        }
      } catch {
        if (mounted) {
          setStatus("uninitialized");
          setHealth(DEFAULT_HEALTH);
        }
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, 10000);

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  return {
    status,
    isReady: status === "running" && health.isHealthy,
    health,
  };
}

/**
 * Hook for making single IPC calls.
 */
export function useIpcCall<T = unknown>(
  method: string,
  params?: Record<string, unknown>,
  options?: { enabled?: boolean; refetchInterval?: number }
): {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
} {
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { enabled = true, refetchInterval } = options || {};

  const fetch = useCallback(async () => {
    if (!enabled) return;
    if (!isTauri()) {
      setError('IPC unavailable: Not running in Tauri environment');
      return;
    }

    try {
      setIsLoading(true);
      setError(null);

      const result = await invoke<T>("ipc_call", {
        method,
        params: params || {},
      });

      setData(result);
    } catch (err) {
      setError(errorToString(err));
    } finally {
      setIsLoading(false);
    }
  }, [method, params, enabled]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(fetch, refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, enabled, fetch]);

  return {
    data,
    isLoading,
    error,
    refetch: fetch,
  };
}

export default useIpc;
