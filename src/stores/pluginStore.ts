/**
 * D076 - src/stores/pluginStore.ts
 * =================================
 * Zustand store for plugin state management.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D001, D002, D003, D004
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 */

import { create } from "zustand";
import { devtools } from "zustand/middleware";

/**
 * Plugin status types.
 */
export type PluginStatus =
  | "discovered"
  | "loading"
  | "loaded"
  | "active"
  | "error"
  | "disabled"
  | "unloading";

/**
 * Plugin category/contract type.
 */
export type PluginCategory = "tts" | "stt" | "llm" | "vision" | "audio" | "data" | "custom";

/**
 * Plugin health status.
 */
export interface PluginHealth {
  /** Whether plugin is healthy */
  healthy: boolean;
  /** Last health check timestamp */
  lastCheck: number;
  /** Response time in ms */
  responseTime: number | null;
  /** Error message if unhealthy */
  error: string | null;
  /** Number of consecutive failures */
  failureCount: number;
}

/**
 * Plugin method definition.
 */
export interface PluginMethod {
  /** Method name */
  name: string;
  /** Method description */
  description: string;
  /** Parameter names and types */
  parameters: Array<{
    name: string;
    type: string;
    required: boolean;
    default?: unknown;
  }>;
  /** Return type */
  returnType: string;
  /** Whether method is async */
  async: boolean;
}

/**
 * Plugin configuration option.
 */
export interface PluginConfigOption {
  /** Option key */
  key: string;
  /** Display label */
  label: string;
  /** Option type */
  type: "string" | "number" | "boolean" | "select" | "path";
  /** Current value */
  value: unknown;
  /** Default value */
  defaultValue: unknown;
  /** Description/help text */
  description?: string | undefined;
  /** Options for select type */
  options?: Array<{ value: string; label: string }> | undefined;
  /** Validation constraints */
  validation?: {
    min?: number;
    max?: number;
    pattern?: string;
    required?: boolean;
  } | undefined;
}

/**
 * Plugin manifest structure.
 */
export interface PluginManifest {
  /** Plugin unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Plugin version */
  version: string;
  /** Description */
  description: string;
  /** Author */
  author: string;
  /** Category/contract type */
  category: PluginCategory;
  /** Contract interface implemented */
  contract: string;
  /** Plugin entry point */
  entryPoint: string;
  /** Dependencies on other plugins */
  dependencies: string[];
  /** Tags for search */
  tags: string[];
  /** Icon path (relative to plugin dir) */
  icon?: string | undefined;
  /** License */
  license?: string | undefined;
  /** Repository URL */
  repository?: string | undefined;
  /** Minimum host version required */
  minHostVersion?: string | undefined;
}

/**
 * Full plugin state.
 */
export interface Plugin {
  /** Plugin manifest */
  manifest: PluginManifest;
  /** Current status */
  status: PluginStatus;
  /** Health state */
  health: PluginHealth;
  /** Available methods */
  methods: PluginMethod[];
  /** Configuration options */
  config: PluginConfigOption[];
  /** Plugin file path */
  path: string;
  /** Load timestamp */
  loadedAt: number | null;
  /** Error message if any */
  error: string | null;
  /** Plugin metadata */
  metadata: Record<string, unknown>;
}

/**
 * Plugin invocation result.
 */
export interface PluginInvocationResult {
  /** Invocation ID */
  id: string;
  /** Plugin ID */
  pluginId: string;
  /** Method name */
  method: string;
  /** Whether successful */
  success: boolean;
  /** Result data */
  result: unknown;
  /** Error message if failed */
  error: string | null;
  /** Execution time in ms */
  executionTime: number;
  /** Timestamp */
  timestamp: number;
}

/**
 * Plugin store state interface.
 */
export interface PluginState {
  /** All discovered/loaded plugins */
  plugins: Record<string, Plugin>;

  /** Currently selected plugin ID */
  selectedPluginId: string | null;

  /** Plugin discovery in progress */
  isDiscovering: boolean;

  /** Plugin load in progress (plugin ID -> boolean) */
  loadingPlugins: Set<string>;

  /** Recent invocation results */
  invocationHistory: PluginInvocationResult[];

  /** Maximum invocation history size */
  maxInvocationHistory: number;

  /** Health check interval in ms */
  healthCheckInterval: number;

  /** Whether health monitoring is active */
  healthMonitoringActive: boolean;

  /** Filter state */
  filter: {
    category: PluginCategory | "all";
    status: PluginStatus | "all";
    searchQuery: string;
  };
}

/**
 * Plugin store actions interface.
 */
export interface PluginActions {
  // Discovery actions
  setDiscovering: (discovering: boolean) => void;
  addDiscoveredPlugin: (manifest: PluginManifest, path: string) => void;
  removePlugin: (pluginId: string) => void;
  clearPlugins: () => void;

  // Loading actions
  setPluginStatus: (pluginId: string, status: PluginStatus, error?: string | null) => void;
  setPluginMethods: (pluginId: string, methods: PluginMethod[]) => void;
  setPluginConfig: (pluginId: string, config: PluginConfigOption[]) => void;
  updatePluginConfigValue: (pluginId: string, key: string, value: unknown) => void;

  // Health actions
  updatePluginHealth: (pluginId: string, health: Partial<PluginHealth>) => void;
  setHealthMonitoring: (active: boolean) => void;

  // Selection actions
  selectPlugin: (pluginId: string | null) => void;

  // Invocation actions
  addInvocationResult: (result: PluginInvocationResult) => void;
  clearInvocationHistory: () => void;

  // Filter actions
  setFilter: (filter: Partial<PluginState["filter"]>) => void;
  resetFilter: () => void;

  // Batch actions
  setPlugins: (plugins: Record<string, Plugin>) => void;

  // Reset
  reset: () => void;
}

/**
 * Initial state values.
 */
const initialState: PluginState = {
  plugins: {},
  selectedPluginId: null,
  isDiscovering: false,
  loadingPlugins: new Set(),
  invocationHistory: [],
  maxInvocationHistory: 100,
  healthCheckInterval: 30000, // 30 seconds
  healthMonitoringActive: false,
  filter: {
    category: "all",
    status: "all",
    searchQuery: "",
  },
};

/**
 * Generate unique ID for invocation results.
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Create initial plugin state from manifest.
 */
const createPluginState = (manifest: PluginManifest, path: string): Plugin => ({
  manifest,
  status: "discovered",
  health: {
    healthy: true,
    lastCheck: 0,
    responseTime: null,
    error: null,
    failureCount: 0,
  },
  methods: [],
  config: [],
  path,
  loadedAt: null,
  error: null,
  metadata: {},
});

/**
 * Zustand plugin store.
 *
 * Manages plugin state including:
 * - Plugin discovery and registration
 * - Plugin loading and status
 * - Health monitoring
 * - Configuration management
 * - Method invocation history
 *
 * @example
 * ```tsx
 * const plugins = usePluginStore((state) => state.plugins);
 * const selectedPlugin = usePluginStore((state) =>
 *   state.selectedPluginId ? state.plugins[state.selectedPluginId] : null
 * );
 *
 * // Add discovered plugin
 * const addPlugin = usePluginStore((state) => state.addDiscoveredPlugin);
 * addPlugin(manifest, "/path/to/plugin");
 *
 * // Update plugin status
 * const setStatus = usePluginStore((state) => state.setPluginStatus);
 * setStatus("tts_kokoro", "active");
 * ```
 */
export const usePluginStore = create<PluginState & PluginActions>()(
  devtools(
    (set, _get) => ({
      ...initialState,

      // Discovery actions
      setDiscovering: (discovering) =>
        set({ isDiscovering: discovering }, false, "setDiscovering"),

      addDiscoveredPlugin: (manifest, path) =>
        set(
          (state) => ({
            plugins: {
              ...state.plugins,
              [manifest.id]: createPluginState(manifest, path),
            },
          }),
          false,
          "addDiscoveredPlugin"
        ),

      removePlugin: (pluginId) =>
        set(
          (state) => {
            const { [pluginId]: removed, ...remaining } = state.plugins;
            return {
              plugins: remaining,
              selectedPluginId:
                state.selectedPluginId === pluginId ? null : state.selectedPluginId,
            };
          },
          false,
          "removePlugin"
        ),

      clearPlugins: () =>
        set(
          {
            plugins: {},
            selectedPluginId: null,
            loadingPlugins: new Set(),
          },
          false,
          "clearPlugins"
        ),

      // Loading actions
      setPluginStatus: (pluginId, status, error = null) =>
        set(
          (state) => {
            const plugin = state.plugins[pluginId];
            if (!plugin) return state;

            const loadingPlugins = new Set(state.loadingPlugins);
            if (status === "loading") {
              loadingPlugins.add(pluginId);
            } else {
              loadingPlugins.delete(pluginId);
            }

            return {
              plugins: {
                ...state.plugins,
                [pluginId]: {
                  ...plugin,
                  status,
                  error,
                  loadedAt: status === "loaded" || status === "active" ? Date.now() : plugin.loadedAt,
                },
              },
              loadingPlugins,
            };
          },
          false,
          "setPluginStatus"
        ),

      setPluginMethods: (pluginId, methods) =>
        set(
          (state) => {
            const plugin = state.plugins[pluginId];
            if (!plugin) return state;

            return {
              plugins: {
                ...state.plugins,
                [pluginId]: {
                  ...plugin,
                  methods,
                },
              },
            };
          },
          false,
          "setPluginMethods"
        ),

      setPluginConfig: (pluginId, config) =>
        set(
          (state) => {
            const plugin = state.plugins[pluginId];
            if (!plugin) return state;

            return {
              plugins: {
                ...state.plugins,
                [pluginId]: {
                  ...plugin,
                  config,
                },
              },
            };
          },
          false,
          "setPluginConfig"
        ),

      updatePluginConfigValue: (pluginId, key, value) =>
        set(
          (state) => {
            const plugin = state.plugins[pluginId];
            if (!plugin) return state;

            return {
              plugins: {
                ...state.plugins,
                [pluginId]: {
                  ...plugin,
                  config: plugin.config.map((opt) =>
                    opt.key === key ? { ...opt, value } : opt
                  ),
                },
              },
            };
          },
          false,
          "updatePluginConfigValue"
        ),

      // Health actions
      updatePluginHealth: (pluginId, healthUpdate) =>
        set(
          (state) => {
            const plugin = state.plugins[pluginId];
            if (!plugin) return state;

            return {
              plugins: {
                ...state.plugins,
                [pluginId]: {
                  ...plugin,
                  health: {
                    ...plugin.health,
                    ...healthUpdate,
                    lastCheck: Date.now(),
                  },
                },
              },
            };
          },
          false,
          "updatePluginHealth"
        ),

      setHealthMonitoring: (active) =>
        set({ healthMonitoringActive: active }, false, "setHealthMonitoring"),

      // Selection actions
      selectPlugin: (pluginId) =>
        set({ selectedPluginId: pluginId }, false, "selectPlugin"),

      // Invocation actions
      addInvocationResult: (result) =>
        set(
          (state) => {
            const history = [
              { ...result, id: result.id || generateId() },
              ...state.invocationHistory,
            ];
            if (history.length > state.maxInvocationHistory) {
              history.pop();
            }
            return { invocationHistory: history };
          },
          false,
          "addInvocationResult"
        ),

      clearInvocationHistory: () =>
        set({ invocationHistory: [] }, false, "clearInvocationHistory"),

      // Filter actions
      setFilter: (filterUpdate) =>
        set(
          (state) => ({
            filter: {
              ...state.filter,
              ...filterUpdate,
            },
          }),
          false,
          "setFilter"
        ),

      resetFilter: () =>
        set(
          {
            filter: {
              category: "all",
              status: "all",
              searchQuery: "",
            },
          },
          false,
          "resetFilter"
        ),

      // Batch actions
      setPlugins: (plugins) => set({ plugins }, false, "setPlugins"),

      // Reset
      reset: () => set(initialState, false, "reset"),
    }),
    { name: "PluginStore" }
  )
);

/**
 * Selector for filtered plugins list.
 */
export const useFilteredPlugins = () =>
  usePluginStore((state) => {
    const { plugins, filter } = state;
    let result = Object.values(plugins);

    // Filter by category
    if (filter.category !== "all") {
      result = result.filter((p) => p.manifest.category === filter.category);
    }

    // Filter by status
    if (filter.status !== "all") {
      result = result.filter((p) => p.status === filter.status);
    }

    // Filter by search query
    if (filter.searchQuery) {
      const query = filter.searchQuery.toLowerCase();
      result = result.filter(
        (p) =>
          p.manifest.name.toLowerCase().includes(query) ||
          p.manifest.description.toLowerCase().includes(query) ||
          p.manifest.tags.some((t) => t.toLowerCase().includes(query))
      );
    }

    return result;
  });

/**
 * Selector for selected plugin.
 */
export const useSelectedPlugin = () =>
  usePluginStore((state) =>
    state.selectedPluginId ? state.plugins[state.selectedPluginId] : null
  );

/**
 * Selector for plugins by category.
 */
export const usePluginsByCategory = (category: PluginCategory) =>
  usePluginStore((state) =>
    Object.values(state.plugins).filter((p) => p.manifest.category === category)
  );

/**
 * Selector for active plugins.
 */
export const useActivePlugins = () =>
  usePluginStore((state) =>
    Object.values(state.plugins).filter((p) => p.status === "active")
  );

/**
 * Selector for plugin count by status.
 */
export const usePluginCounts = () =>
  usePluginStore((state) => {
    const counts = {
      total: 0,
      active: 0,
      loaded: 0,
      error: 0,
      disabled: 0,
    };

    Object.values(state.plugins).forEach((p) => {
      counts.total++;
      if (p.status === "active") counts.active++;
      if (p.status === "loaded") counts.loaded++;
      if (p.status === "error") counts.error++;
      if (p.status === "disabled") counts.disabled++;
    });

    return counts;
  });

export default usePluginStore;
