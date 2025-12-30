/**
 * D079 - src/hooks/usePlugin.ts
 * =============================
 * React hook for plugin management operations.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D075, D076, D077, D078
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *
 * This hook provides:
 *   - Plugin discovery and listing
 *   - Plugin loading/unloading
 *   - Plugin method invocation
 *   - Hot-swap functionality
 *   - Health monitoring
 *   - Configuration management
 *
 * Usage:
 *   ```tsx
 *   const { plugins, loadPlugin, invokeMethod } = usePlugin();
 *
 *   // Load a plugin
 *   await loadPlugin('tts_kokoro');
 *
 *   // Call plugin method
 *   const audio = await invokeMethod('tts_kokoro', 'synthesize', { text: 'Hello' });
 *   ```
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/tauri";
import { usePluginStore, type Plugin, type PluginManifest, type PluginMethod, type PluginConfigOption, type PluginHealth, type PluginInvocationResult } from "../stores/pluginStore";
import { useFactoryStore } from "../stores/factoryStore";
import { useIpc } from "./useIpc";
import { isTauri } from "../utils/tauriUtils";

// ============================================
// TYPES
// ============================================

/**
 * Plugin discovery result.
 */
export interface DiscoveryResult {
  /** Number of plugins found */
  count: number;
  /** Discovered plugin manifests */
  plugins: PluginManifest[];
  /** Errors encountered during discovery */
  errors: Array<{
    path: string;
    error: string;
  }>;
}

/**
 * Plugin load result.
 */
export interface LoadResult {
  /** Whether load succeeded */
  success: boolean;
  /** Plugin ID */
  pluginId: string;
  /** Available methods after loading */
  methods: PluginMethod[];
  /** Configuration options */
  config: PluginConfigOption[];
  /** Error message if failed */
  error?: string;
}

/**
 * Plugin method invocation options.
 */
export interface InvokeOptions {
  /** Timeout in milliseconds */
  timeout?: number;
  /** Show loading indicator */
  showLoading?: boolean;
  /** Loading message */
  loadingMessage?: string;
  /** Track in invocation history */
  trackHistory?: boolean;
}

/**
 * Hot-swap result.
 */
export interface SwapResult {
  /** Whether swap succeeded */
  success: boolean;
  /** Old plugin ID */
  oldPluginId: string;
  /** New plugin ID */
  newPluginId: string;
  /** Error message if failed */
  error?: string;
}

/**
 * Plugin hook return type.
 */
export interface UsePluginReturn {
  /** All plugins */
  plugins: Record<string, Plugin>;
  /** Selected plugin */
  selectedPlugin: Plugin | null;
  /** Whether discovery is in progress */
  isDiscovering: boolean;
  /** Loading plugin IDs */
  loadingPlugins: Set<string>;
  /** Invocation history */
  invocationHistory: PluginInvocationResult[];
  /** Health monitoring active */
  healthMonitoringActive: boolean;

  // Discovery
  /** Discover available plugins */
  discoverPlugins: () => Promise<DiscoveryResult>;
  /** Scan for new plugins */
  scanPlugins: () => Promise<DiscoveryResult>;
  /** Refresh plugin list */
  refreshPlugins: () => Promise<void>;

  // Lifecycle
  /** Load a plugin */
  loadPlugin: (pluginId: string) => Promise<LoadResult>;
  /** Unload a plugin */
  unloadPlugin: (pluginId: string) => Promise<void>;
  /** Hot-swap plugins */
  swapPlugin: (oldPluginId: string, newPluginId: string) => Promise<SwapResult>;

  // Invocation
  /** Invoke a plugin method */
  invokeMethod: <T = unknown>(
    pluginId: string,
    method: string,
    args?: Record<string, unknown>,
    options?: InvokeOptions
  ) => Promise<T>;

  // Selection
  /** Select a plugin */
  selectPlugin: (pluginId: string | null) => void;

  // Configuration
  /** Get plugin configuration */
  getPluginConfig: (pluginId: string) => PluginConfigOption[];
  /** Update plugin configuration */
  updatePluginConfig: (pluginId: string, key: string, value: unknown) => Promise<void>;

  // Health
  /** Start health monitoring */
  startHealthMonitoring: () => void;
  /** Stop health monitoring */
  stopHealthMonitoring: () => void;
  /** Check plugin health */
  checkPluginHealth: (pluginId: string) => Promise<PluginHealth>;

  // Utility
  /** Get plugin by ID */
  getPlugin: (pluginId: string) => Plugin | undefined;
  /** Get plugins by category */
  getPluginsByCategory: (category: string) => Plugin[];
  /** Get active plugins */
  getActivePlugins: () => Plugin[];
  /** Clear invocation history */
  clearInvocationHistory: () => void;
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Parse plugin manifest from backend response.
 */
function parseManifest(data: Record<string, unknown>): PluginManifest {
  return {
    id: String(data.id || data.name || ""),
    name: String(data.name || ""),
    version: String(data.version || "1.0.0"),
    description: String(data.description || ""),
    author: String(data.author || ""),
    category: (data.category || "custom") as PluginManifest["category"],
    contract: String(data.contract || ""),
    entryPoint: String(data.entry_point || data.entryPoint || ""),
    dependencies: Array.isArray(data.dependencies) ? data.dependencies : [],
    tags: Array.isArray(data.tags) ? data.tags : [],
    icon: data.icon as string | undefined,
    license: data.license as string | undefined,
    repository: data.repository as string | undefined,
    minHostVersion: (data.min_host_version || data.minHostVersion) as string | undefined,
  };
}

/**
 * Parse plugin methods from backend response.
 */
function parseMethods(data: unknown[]): PluginMethod[] {
  if (!Array.isArray(data)) return [];

  return data.map((m) => {
    const method = m as Record<string, unknown>;
    return {
      name: String(method.name || ""),
      description: String(method.description || ""),
      parameters: Array.isArray(method.parameters)
        ? method.parameters.map((p: Record<string, unknown>) => ({
          name: String(p.name || ""),
          type: String(p.type || "any"),
          required: Boolean(p.required),
          default: p.default,
        }))
        : [],
      returnType: String(method.return_type || method.returnType || "void"),
      async: Boolean(method.async),
    };
  });
}

/**
 * Parse plugin config options from backend response.
 */
function parseConfigOptions(data: unknown[]): PluginConfigOption[] {
  if (!Array.isArray(data)) return [];

  return data.map((c) => {
    const config = c as Record<string, unknown>;
    return {
      key: String(config.key || ""),
      label: String(config.label || config.key || ""),
      type: (config.type || "string") as PluginConfigOption["type"],
      value: config.value,
      defaultValue: config.default_value ?? config.defaultValue ?? config.value,
      description: config.description as string | undefined,
      options: config.options as Array<{ value: string; label: string }> | undefined,
      validation: config.validation as PluginConfigOption["validation"] | undefined,
    };
  });
}

/**
 * Generate unique ID.
 */
function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
}

// ============================================
// HOOK IMPLEMENTATION
// ============================================

/**
 * React hook for plugin management.
 *
 * Provides comprehensive plugin lifecycle management including
 * discovery, loading, unloading, method invocation, and health monitoring.
 *
 * @example
 * ```tsx
 * function PluginPanel() {
 *   const {
 *     plugins,
 *     loadPlugin,
 *     invokeMethod,
 *     discoverPlugins,
 *   } = usePlugin();
 *
 *   useEffect(() => {
 *     discoverPlugins();
 *   }, [discoverPlugins]);
 *
 *   const handleLoad = async (id: string) => {
 *     const result = await loadPlugin(id);
 *     if (result.success) {
 *       console.log('Plugin loaded with methods:', result.methods);
 *     }
 *   };
 *
 *   const handleSynthesize = async () => {
 *     const audio = await invokeMethod('tts_kokoro', 'synthesize', {
 *       text: 'Hello world',
 *       voice: 'af_bella',
 *     });
 *   };
 *
 *   return (
 *     <div>
 *       {Object.values(plugins).map((plugin) => (
 *         <div key={plugin.manifest.id}>
 *           {plugin.manifest.name} - {plugin.status}
 *         </div>
 *       ))}
 *     </div>
 *   );
 * }
 * ```
 */
export function usePlugin(): UsePluginReturn {
  // Store access
  const plugins = usePluginStore((state) => state.plugins);
  const selectedPluginId = usePluginStore((state) => state.selectedPluginId);
  const isDiscovering = usePluginStore((state) => state.isDiscovering);
  const loadingPlugins = usePluginStore((state) => state.loadingPlugins);
  const invocationHistory = usePluginStore((state) => state.invocationHistory);
  const healthMonitoringActive = usePluginStore((state) => state.healthMonitoringActive);
  const healthCheckInterval = usePluginStore((state) => state.healthCheckInterval);

  // Store actions
  const setDiscovering = usePluginStore((state) => state.setDiscovering);
  const addDiscoveredPlugin = usePluginStore((state) => state.addDiscoveredPlugin);
  const setPluginStatus = usePluginStore((state) => state.setPluginStatus);
  const setPluginMethods = usePluginStore((state) => state.setPluginMethods);
  const setPluginConfig = usePluginStore((state) => state.setPluginConfig);
  const updatePluginConfigValue = usePluginStore((state) => state.updatePluginConfigValue);
  const updatePluginHealth = usePluginStore((state) => state.updatePluginHealth);
  const setHealthMonitoring = usePluginStore((state) => state.setHealthMonitoring);
  const storeSelectPlugin = usePluginStore((state) => state.selectPlugin);
  const addInvocationResult = usePluginStore((state) => state.addInvocationResult);
  const storeClearHistory = usePluginStore((state) => state.clearInvocationHistory);
  const clearPlugins = usePluginStore((state) => state.clearPlugins);

  // Factory store for notifications
  const addNotification = useFactoryStore((state) => state.addNotification);
  const setLoading = useFactoryStore((state) => state.setLoading);

  // IPC hook
  const { isReady: ipcReady } = useIpc();

  // Health monitoring interval ref
  const healthIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mountedRef = useRef(true);

  // Selected plugin
  const selectedPlugin = selectedPluginId ? plugins[selectedPluginId] : null;

  /**
   * Discover available plugins.
   */
  const discoverPlugins = useCallback(async (): Promise<DiscoveryResult> => {
    if (!isTauri()) {
      console.warn('[usePlugin] discoverPlugins: Not in Tauri environment');
      return { count: 0, plugins: [], errors: [] };
    }
    try {
      setDiscovering(true);

      const result = await invoke<Record<string, unknown>>("discover_plugins");

      const discoveredPlugins = Array.isArray(result.plugins)
        ? (result.plugins as Record<string, unknown>[]).map(parseManifest)
        : [];

      // Add discovered plugins to store
      for (const manifest of discoveredPlugins) {
        const path = String((result.paths as Record<string, string>)?.[manifest.id] || "");
        addDiscoveredPlugin(manifest, path);
      }

      return {
        count: discoveredPlugins.length,
        plugins: discoveredPlugins,
        errors: Array.isArray(result.errors)
          ? (result.errors as Array<{ path: string; error: string }>)
          : [],
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addNotification({
        type: "error",
        title: "Discovery Failed",
        message: errorMsg,
        timeout: 5000,
      });
      throw err;
    } finally {
      if (mountedRef.current) {
        setDiscovering(false);
      }
    }
  }, [setDiscovering, addDiscoveredPlugin, addNotification]);

  /**
   * Scan for new plugins.
   */
  const scanPlugins = useCallback(async (): Promise<DiscoveryResult> => {
    if (!isTauri()) {
      console.warn('[usePlugin] scanPlugins: Not in Tauri environment');
      return { count: 0, plugins: [], errors: [] };
    }
    try {
      setDiscovering(true);

      const result = await invoke<Record<string, unknown>>("scan_plugins");

      const newPlugins = Array.isArray(result.new_plugins)
        ? (result.new_plugins as Record<string, unknown>[]).map(parseManifest)
        : [];

      // Add new plugins to store
      for (const manifest of newPlugins) {
        const path = String((result.paths as Record<string, string>)?.[manifest.id] || "");
        addDiscoveredPlugin(manifest, path);
      }

      if (newPlugins.length > 0) {
        addNotification({
          type: "success",
          title: "Plugins Found",
          message: `Discovered ${newPlugins.length} new plugin(s)`,
          timeout: 3000,
        });
      }

      return {
        count: newPlugins.length,
        plugins: newPlugins,
        errors: Array.isArray(result.errors)
          ? (result.errors as Array<{ path: string; error: string }>)
          : [],
      };
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      addNotification({
        type: "error",
        title: "Scan Failed",
        message: errorMsg,
        timeout: 5000,
      });
      throw err;
    } finally {
      if (mountedRef.current) {
        setDiscovering(false);
      }
    }
  }, [setDiscovering, addDiscoveredPlugin, addNotification]);

  /**
   * Refresh plugin list from backend.
   */
  const refreshPlugins = useCallback(async (): Promise<void> => {
    if (!isTauri()) {
      return;
    }
    try {
      const result = await invoke<Record<string, unknown>[]>("plugin_list");

      if (Array.isArray(result)) {
        for (const pluginData of result) {
          const manifest = parseManifest(pluginData);
          const status = (pluginData.status || "discovered") as Plugin["status"];
          const path = String(pluginData.path || "");

          // Update or add plugin
          if (!plugins[manifest.id]) {
            addDiscoveredPlugin(manifest, path);
          }
          setPluginStatus(manifest.id, status);

          // Update methods and config if available
          if (pluginData.methods) {
            setPluginMethods(manifest.id, parseMethods(pluginData.methods as unknown[]));
          }
          if (pluginData.config) {
            setPluginConfig(manifest.id, parseConfigOptions(pluginData.config as unknown[]));
          }
        }
      }
    } catch (err) {
      // Silently handle refresh errors
      console.error("Failed to refresh plugins:", err);
    }
  }, [plugins, addDiscoveredPlugin, setPluginStatus, setPluginMethods, setPluginConfig]);

  /**
   * Load a plugin.
   */
  const loadPlugin = useCallback(
    async (pluginId: string): Promise<LoadResult> => {
      if (!isTauri()) {
        return {
          success: false,
          pluginId,
          methods: [],
          config: [],
          error: 'Not running in Tauri environment',
        };
      }
      try {
        setPluginStatus(pluginId, "loading");

        const result = await invoke<Record<string, unknown>>("plugin_load", {
          name: pluginId,
        });

        const methods = parseMethods((result.methods as unknown[]) || []);
        const config = parseConfigOptions((result.config as unknown[]) || []);

        if (mountedRef.current) {
          setPluginStatus(pluginId, "active");
          setPluginMethods(pluginId, methods);
          setPluginConfig(pluginId, config);
        }

        addNotification({
          type: "success",
          title: "Plugin Loaded",
          message: `${pluginId} is now active`,
          timeout: 3000,
        });

        return {
          success: true,
          pluginId,
          methods,
          config,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (mountedRef.current) {
          setPluginStatus(pluginId, "error", errorMsg);
        }

        addNotification({
          type: "error",
          title: "Load Failed",
          message: `Failed to load ${pluginId}: ${errorMsg}`,
          timeout: 5000,
        });

        return {
          success: false,
          pluginId,
          methods: [],
          config: [],
          error: errorMsg,
        };
      }
    },
    [setPluginStatus, setPluginMethods, setPluginConfig, addNotification]
  );

  /**
   * Unload a plugin.
   */
  const unloadPlugin = useCallback(
    async (pluginId: string): Promise<void> => {
      try {
        setPluginStatus(pluginId, "unloading");

        await invoke("plugin_unload", { name: pluginId });

        if (mountedRef.current) {
          setPluginStatus(pluginId, "discovered");
        }

        addNotification({
          type: "info",
          title: "Plugin Unloaded",
          message: `${pluginId} has been unloaded`,
          timeout: 3000,
        });
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (mountedRef.current) {
          setPluginStatus(pluginId, "error", errorMsg);
        }

        addNotification({
          type: "error",
          title: "Unload Failed",
          message: `Failed to unload ${pluginId}: ${errorMsg}`,
          timeout: 5000,
        });

        throw err;
      }
    },
    [setPluginStatus, addNotification]
  );

  /**
   * Hot-swap plugins.
   */
  const swapPlugin = useCallback(
    async (oldPluginId: string, newPluginId: string): Promise<SwapResult> => {
      try {
        setLoading(true, `Swapping ${oldPluginId} with ${newPluginId}...`);
        setPluginStatus(oldPluginId, "unloading");
        setPluginStatus(newPluginId, "loading");

        const result = await invoke<Record<string, unknown>>("plugin_swap", {
          old_name: oldPluginId,
          new_name: newPluginId,
        });

        if (mountedRef.current) {
          setPluginStatus(oldPluginId, "discovered");
          setPluginStatus(newPluginId, "active");

          // Update methods and config for new plugin
          if (result.methods) {
            setPluginMethods(newPluginId, parseMethods(result.methods as unknown[]));
          }
          if (result.config) {
            setPluginConfig(newPluginId, parseConfigOptions(result.config as unknown[]));
          }
        }

        addNotification({
          type: "success",
          title: "Plugin Swapped",
          message: `Replaced ${oldPluginId} with ${newPluginId}`,
          timeout: 3000,
        });

        return {
          success: true,
          oldPluginId,
          newPluginId,
        };
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);

        if (mountedRef.current) {
          setPluginStatus(oldPluginId, "error", errorMsg);
          setPluginStatus(newPluginId, "error", errorMsg);
        }

        addNotification({
          type: "error",
          title: "Swap Failed",
          message: errorMsg,
          timeout: 5000,
        });

        return {
          success: false,
          oldPluginId,
          newPluginId,
          error: errorMsg,
        };
      } finally {
        setLoading(false);
      }
    },
    [setLoading, setPluginStatus, setPluginMethods, setPluginConfig, addNotification]
  );

  /**
   * Invoke a plugin method.
   */
  const invokeMethod = useCallback(
    async <T = unknown>(
      pluginId: string,
      method: string,
      args: Record<string, unknown> = {},
      options: InvokeOptions = {}
    ): Promise<T> => {
      const {
        showLoading = false,
        loadingMessage = `Calling ${method}...`,
        trackHistory = true,
      } = options;

      const startTime = Date.now();
      let success = false;
      let result: unknown = null;
      let errorMsg: string | null = null;

      try {
        if (!isTauri()) {
          throw new Error('Not running in Tauri environment');
        }
        if (showLoading) {
          setLoading(true, loadingMessage);
        }

        result = await invoke<T>("plugin_call", {
          plugin: pluginId,
          method,
          args,
        });

        success = true;
        return result as T;
      } catch (err) {
        errorMsg = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        const executionTime = Date.now() - startTime;

        if (showLoading) {
          setLoading(false);
        }

        // Track in history
        if (trackHistory) {
          addInvocationResult({
            id: generateId(),
            pluginId,
            method,
            success,
            result,
            error: errorMsg,
            executionTime,
            timestamp: Date.now(),
          });
        }
      }
    },
    [setLoading, addInvocationResult]
  );

  /**
   * Select a plugin.
   */
  const selectPlugin = useCallback(
    (pluginId: string | null) => {
      storeSelectPlugin(pluginId);
    },
    [storeSelectPlugin]
  );

  /**
   * Get plugin configuration.
   */
  const getPluginConfig = useCallback(
    (pluginId: string): PluginConfigOption[] => {
      return plugins[pluginId]?.config || [];
    },
    [plugins]
  );

  /**
   * Update plugin configuration.
   */
  const updatePluginConfig = useCallback(
    async (pluginId: string, key: string, value: unknown): Promise<void> => {
      try {
        // Update in store immediately for optimistic UI
        updatePluginConfigValue(pluginId, key, value);

        // Sync to backend
        await invoke("ipc_call", {
          method: "plugin/config",
          params: {
            plugin: pluginId,
            key,
            value,
          },
        });
      } catch (err) {
        // Revert on error (would need to store previous value)
        const errorMsg = err instanceof Error ? err.message : String(err);
        addNotification({
          type: "error",
          title: "Config Update Failed",
          message: errorMsg,
          timeout: 5000,
        });
        throw err;
      }
    },
    [updatePluginConfigValue, addNotification]
  );

  /**
   * Check plugin health.
   */
  const checkPluginHealth = useCallback(
    async (pluginId: string): Promise<PluginHealth> => {
      try {
        const result = await invoke<Record<string, unknown>>("ipc_call", {
          method: "plugin/health",
          params: { plugin: pluginId },
        });

        const health: PluginHealth = {
          healthy: Boolean(result.healthy),
          lastCheck: Date.now(),
          responseTime: (result.response_time || result.responseTime || null) as number | null,
          error: (result.error || null) as string | null,
          failureCount: (result.failure_count || result.failureCount || 0) as number,
        };

        if (mountedRef.current) {
          updatePluginHealth(pluginId, health);
        }

        return health;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const unhealthyStatus: PluginHealth = {
          healthy: false,
          lastCheck: Date.now(),
          responseTime: null,
          error: errorMsg,
          failureCount: (plugins[pluginId]?.health.failureCount || 0) + 1,
        };

        if (mountedRef.current) {
          updatePluginHealth(pluginId, unhealthyStatus);
        }

        return unhealthyStatus;
      }
    },
    [plugins, updatePluginHealth]
  );

  /**
   * Start health monitoring.
   */
  const startHealthMonitoring = useCallback(() => {
    if (healthIntervalRef.current) return;

    setHealthMonitoring(true);

    healthIntervalRef.current = setInterval(() => {
      const activePlugins = Object.values(plugins).filter(
        (p) => p.status === "active" || p.status === "loaded"
      );

      for (const plugin of activePlugins) {
        checkPluginHealth(plugin.manifest.id);
      }
    }, healthCheckInterval);
  }, [plugins, healthCheckInterval, setHealthMonitoring, checkPluginHealth]);

  /**
   * Stop health monitoring.
   */
  const stopHealthMonitoring = useCallback(() => {
    if (healthIntervalRef.current) {
      clearInterval(healthIntervalRef.current);
      healthIntervalRef.current = null;
    }
    setHealthMonitoring(false);
  }, [setHealthMonitoring]);

  /**
   * Get plugin by ID.
   */
  const getPlugin = useCallback(
    (pluginId: string): Plugin | undefined => {
      return plugins[pluginId];
    },
    [plugins]
  );

  /**
   * Get plugins by category.
   */
  const getPluginsByCategory = useCallback(
    (category: string): Plugin[] => {
      return Object.values(plugins).filter((p) => p.manifest.category === category);
    },
    [plugins]
  );

  /**
   * Get active plugins.
   */
  const getActivePlugins = useCallback((): Plugin[] => {
    return Object.values(plugins).filter((p) => p.status === "active");
  }, [plugins]);

  /**
   * Clear invocation history.
   */
  const clearInvocationHistory = useCallback(() => {
    storeClearHistory();
  }, [storeClearHistory]);

  // Cleanup on unmount
  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      if (healthIntervalRef.current) {
        clearInterval(healthIntervalRef.current);
      }
    };
  }, []);

  // Auto-discover on IPC ready
  useEffect(() => {
    if (ipcReady && Object.keys(plugins).length === 0) {
      discoverPlugins();
    }
  }, [ipcReady, plugins, discoverPlugins]);

  return {
    plugins,
    selectedPlugin,
    isDiscovering,
    loadingPlugins,
    invocationHistory,
    healthMonitoringActive,

    // Discovery
    discoverPlugins,
    scanPlugins,
    refreshPlugins,

    // Lifecycle
    loadPlugin,
    unloadPlugin,
    swapPlugin,

    // Invocation
    invokeMethod,

    // Selection
    selectPlugin,

    // Configuration
    getPluginConfig,
    updatePluginConfig,

    // Health
    startHealthMonitoring,
    stopHealthMonitoring,
    checkPluginHealth,

    // Utility
    getPlugin,
    getPluginsByCategory,
    getActivePlugins,
    clearInvocationHistory,
  };
}

// ============================================
// SPECIALIZED HOOKS
// ============================================

/**
 * Hook for using a specific plugin.
 */
export function usePluginInstance(pluginId: string): {
  plugin: Plugin | undefined;
  isLoading: boolean;
  isActive: boolean;
  methods: PluginMethod[];
  config: PluginConfigOption[];
  health: PluginHealth;
  load: () => Promise<LoadResult>;
  unload: () => Promise<void>;
  invoke: <T = unknown>(method: string, args?: Record<string, unknown>) => Promise<T>;
  updateConfig: (key: string, value: unknown) => Promise<void>;
} {
  const { plugins, loadPlugin, unloadPlugin, invokeMethod, updatePluginConfig, loadingPlugins } =
    usePlugin();

  const plugin = plugins[pluginId];
  const isLoading = loadingPlugins.has(pluginId);
  const isActive = plugin?.status === "active";
  const methods = plugin?.methods || [];
  const config = plugin?.config || [];
  const health = plugin?.health || {
    healthy: false,
    lastCheck: 0,
    responseTime: null,
    error: null,
    failureCount: 0,
  };

  const load = useCallback(() => loadPlugin(pluginId), [loadPlugin, pluginId]);
  const unload = useCallback(() => unloadPlugin(pluginId), [unloadPlugin, pluginId]);
  const invoke = useCallback(
    <T = unknown>(method: string, args?: Record<string, unknown>) =>
      invokeMethod<T>(pluginId, method, args),
    [invokeMethod, pluginId]
  );
  const updateConfig = useCallback(
    (key: string, value: unknown) => updatePluginConfig(pluginId, key, value),
    [updatePluginConfig, pluginId]
  );

  return {
    plugin,
    isLoading,
    isActive,
    methods,
    config,
    health,
    load,
    unload,
    invoke,
    updateConfig,
  };
}

/**
 * Hook for plugin method invocation with automatic tracking.
 */
export function usePluginMethod<T = unknown>(
  pluginId: string,
  method: string,
  options?: {
    args?: Record<string, unknown>;
    enabled?: boolean;
    refetchInterval?: number;
  }
): {
  data: T | null;
  isLoading: boolean;
  error: string | null;
  invoke: (args?: Record<string, unknown>) => Promise<T>;
} {
  const { invokeMethod } = usePlugin();
  const [data, setData] = useState<T | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { args, enabled = true, refetchInterval } = options || {};

  const invoke = useCallback(
    async (invokeArgs?: Record<string, unknown>) => {
      try {
        setIsLoading(true);
        setError(null);

        const result = await invokeMethod<T>(pluginId, method, invokeArgs || args || {});
        setData(result);
        return result;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        setError(errorMsg);
        throw err;
      } finally {
        setIsLoading(false);
      }
    },
    [pluginId, method, args, invokeMethod]
  );

  useEffect(() => {
    if (enabled) {
      invoke();
    }
  }, [enabled, invoke]);

  useEffect(() => {
    if (!refetchInterval || !enabled) return;

    const interval = setInterval(invoke, refetchInterval);
    return () => clearInterval(interval);
  }, [refetchInterval, enabled, invoke]);

  return {
    data,
    isLoading,
    error,
    invoke,
  };
}

export default usePlugin;
