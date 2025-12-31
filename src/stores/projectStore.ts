/**
 * D077 - src/stores/projectStore.ts
 * ===================================
 * Zustand store for project state management.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D075, D076
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { save } from "@tauri-apps/api/dialog";
import { writeTextFile } from "@tauri-apps/api/fs";
import { isTauri } from "../utils/tauriUtils";
import type { ThemeConfig } from "../context/ThemeProvider";
import { defaultLightTheme } from "../context/ThemeProvider";

/**
 * Project status.
 */
export type ProjectStatus = "new" | "saved" | "modified" | "building" | "error";

/**
 * Screen type in the project.
 */
export type ScreenType = "main" | "settings" | "dialog" | "overlay" | "widget";

/**
 * Component slot binding.
 */
export interface ComponentSlot {
  /** Slot ID */
  id: string;
  /** Slot name */
  name: string;
  /** Contract type required */
  contractType: string;
  /** Bound plugin ID (null if unbound) */
  pluginId: string | null;
  /** Whether binding is required */
  required: boolean;
  /** Slot configuration */
  config: Record<string, unknown>;
}

/**
 * UI Component definition in project.
 */
export interface ProjectComponent {
  /** Component ID */
  id: string;
  /** Component type (e.g., "Button", "Panel") */
  type: string;
  /** Display name */
  name: string;
  /** Component properties */
  props: Record<string, unknown>;
  /** Child component IDs */
  children: string[];
  /** Parent component ID */
  parentId: string | null;
  /** Position in layout */
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  /** Plugin slots this component has */
  slots: ComponentSlot[];
  /** Custom styles */
  styles: Record<string, string>;
  /** Event handlers */
  events: Record<string, string>;
  /** Whether component is visible */
  visible: boolean;
  /** Whether component is locked (can't be edited) */
  locked: boolean;
}

/**
 * Screen definition in project.
 */
export interface ProjectScreen {
  /** Screen ID */
  id: string;
  /** Screen name */
  name: string;
  /** Screen type */
  type: ScreenType;
  /** Root component ID */
  rootComponentId: string | null;
  /** Screen route/path */
  route: string;
  /** Screen title */
  title: string;
  /** Whether this is the default screen */
  isDefault: boolean;
  /** Screen-specific settings */
  settings: Record<string, unknown>;
}

/**
 * Project theme configuration.
 * Uses the same structure as the UI theme persistence.
 */
export type ProjectTheme = ThemeConfig;

/**
 * Project build configuration.
 */
export interface ProjectBuildConfig {
  /** Output directory */
  outputDir: string;
  /** Target platform */
  platform: "windows" | "macos" | "linux" | "all";
  /** Build mode */
  mode: "development" | "production";
  /** Include Python runtime */
  includePythonRuntime: boolean;
  /** Bundled plugins */
  bundledPlugins: string[];
  /** App icon path */
  appIcon: string | null;
  /** Version string */
  version: string;
  /** Author/publisher */
  publisher: string;
  /** App identifier */
  identifier: string;
}

/**
 * Project metadata.
 */
export interface ProjectMetadata {
  /** Project name */
  name: string;
  /** Project description */
  description: string;
  /** Author */
  author: string;
  /** Version */
  version: string;
  /** Created timestamp */
  createdAt: number;
  /** Last modified timestamp */
  modifiedAt: number;
  /** Project file path */
  filePath: string | null;
  /** Tags */
  tags: string[];
}

/**
 * Recent project entry.
 */
export interface RecentProject {
  /** Project file path */
  path: string;
  /** Project name */
  name: string;
  /** Last opened timestamp */
  lastOpened: number;
  /** Thumbnail path */
  thumbnail: string | null;
}

/**
 * Project store state interface.
 */
export interface ProjectState {
  // Current project
  metadata: ProjectMetadata;
  status: ProjectStatus;
  screens: Record<string, ProjectScreen>;
  components: Record<string, ProjectComponent>;
  theme: ProjectTheme;
  buildConfig: ProjectBuildConfig;

  // Active selections
  activeScreenId: string | null;
  activeComponentId: string | null;

  // Clipboard
  clipboard: {
    type: "component" | "screen" | null;
    data: unknown;
  };

  // Recent projects
  recentProjects: RecentProject[];
  maxRecentProjects: number;

  // Project state
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

/**
 * Project store actions interface.
 */
/**
 * Project file structure for loading from disk.
 */
export interface ProjectFile {
  /** Project metadata */
  metadata: ProjectMetadata;
  /** Screens configuration */
  screens: Record<string, ProjectScreen>;
  /** Components configuration */
  components: Record<string, ProjectComponent>;
  /** Theme configuration */
  theme: ProjectTheme;
  /** Build configuration */
  buildConfig: ProjectBuildConfig;
}

/**
 * Plugin configuration from plugins.yaml.
 */
export interface PluginsConfig {
  /** Active plugins */
  plugins: Array<{
    id: string;
    name: string;
    contract: string;
    enabled: boolean;
    config?: Record<string, unknown>;
  }>;
}

export interface ProjectActions {
  // Project lifecycle
  newProject: (name: string, author?: string) => void;
  loadProject: (data: Partial<ProjectState>) => void;
  loadProjectFromFile: (
    projectPath: string,
    projectJson: ProjectFile,
    pluginsConfig?: PluginsConfig
  ) => void;
  saveProject: (saveAs?: boolean) => Promise<void>;
  setMetadata: (metadata: Partial<ProjectMetadata>) => void;
  setStatus: (status: ProjectStatus) => void;

  // Screen actions
  addScreen: (screen: ProjectScreen) => void;
  updateScreen: (screenId: string, updates: Partial<ProjectScreen>) => void;
  removeScreen: (screenId: string) => void;
  setActiveScreen: (screenId: string | null) => void;
  duplicateScreen: (screenId: string) => ProjectScreen | null;

  // Component actions
  addComponent: (component: ProjectComponent) => void;
  updateComponent: (componentId: string, updates: Partial<ProjectComponent>) => void;
  removeComponent: (componentId: string) => void;
  setActiveComponent: (componentId: string | null) => void;
  moveComponent: (componentId: string, newParentId: string | null, index?: number) => void;
  duplicateComponent: (componentId: string) => ProjectComponent | null;

  // Slot actions
  bindSlot: (componentId: string, slotId: string, pluginId: string) => void;
  unbindSlot: (componentId: string, slotId: string) => void;
  updateSlotConfig: (componentId: string, slotId: string, config: Record<string, unknown>) => void;

  // Theme actions
  setTheme: (theme: Partial<ProjectTheme>) => void;
  resetTheme: () => void;

  // Build config actions
  setBuildConfig: (config: Partial<ProjectBuildConfig>) => void;

  // Clipboard actions
  copyComponent: (componentId: string) => void;
  copyScreen: (screenId: string) => void;
  paste: (targetParentId?: string | null) => string | null;
  clearClipboard: () => void;

  // Recent projects
  addRecentProject: (project: RecentProject) => void;
  removeRecentProject: (path: string) => void;
  clearRecentProjects: () => void;

  // State actions
  setLoading: (loading: boolean) => void;
  setSaving: (saving: boolean) => void;
  setError: (error: string | null) => void;

  // Reset
  reset: () => void;
}

/**
 * Default theme configuration.
 */
const defaultTheme: ProjectTheme = defaultLightTheme;

/**
 * Default build configuration.
 */
const defaultBuildConfig: ProjectBuildConfig = {
  outputDir: "./dist",
  platform: "windows",
  mode: "development",
  includePythonRuntime: true,
  bundledPlugins: [],
  appIcon: null,
  version: "1.0.0",
  publisher: "",
  identifier: "com.appfactory.app",
};

/**
 * Default metadata.
 */
const defaultMetadata: ProjectMetadata = {
  name: "Untitled Project",
  description: "",
  author: "",
  version: "1.0.0",
  createdAt: Date.now(),
  modifiedAt: Date.now(),
  filePath: null,
  tags: [],
};

/**
 * Initial state values.
 */
const initialState: ProjectState = {
  metadata: defaultMetadata,
  status: "new",
  screens: {},
  components: {},
  theme: defaultTheme,
  buildConfig: defaultBuildConfig,
  activeScreenId: null,
  activeComponentId: null,
  clipboard: {
    type: null,
    data: null,
  },
  recentProjects: [],
  maxRecentProjects: 10,
  isLoading: false,
  isSaving: false,
  error: null,
};

/**
 * Generate unique ID.
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Deep clone an object.
 */
const deepClone = <T>(obj: T): T => {
  return JSON.parse(JSON.stringify(obj));
};

/**
 * Zustand project store.
 *
 * Manages project state including:
 * - Project metadata and lifecycle
 * - Screens and screen management
 * - Components and component tree
 * - Plugin slot bindings
 * - Theme configuration
 * - Build settings
 *
 * @example
 * ```tsx
 * const projectName = useProjectStore((state) => state.metadata.name);
 * const screens = useProjectStore((state) => state.screens);
 *
 * // Create new project
 * const newProject = useProjectStore((state) => state.newProject);
 * newProject("My App", "John Doe");
 *
 * // Add a screen
 * const addScreen = useProjectStore((state) => state.addScreen);
 * addScreen({
 *   id: generateId(),
 *   name: "Home",
 *   type: "main",
 *   rootComponentId: null,
 *   route: "/",
 *   title: "Home",
 *   isDefault: true,
 *   settings: {},
 * });
 * ```
 */
export const useProjectStore = create<ProjectState & ProjectActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // Project lifecycle
        newProject: (name, author = "") => {
          const now = Date.now();
          set(
            {
              ...initialState,
              metadata: {
                ...defaultMetadata,
                name,
                author,
                createdAt: now,
                modifiedAt: now,
              },
              status: "new",
            },
            false,
            "newProject"
          );
        },

        loadProject: (data) =>
          set(
            (state) => ({
              ...state,
              ...data,
              status: "saved",
              isLoading: false,
            }),
            false,
            "loadProject"
          ),

        loadProjectFromFile: (projectPath, projectJson, _pluginsConfig) => {
          // Validate project.json schema
          if (!projectJson.metadata || !projectJson.metadata.name) {
            set({ error: "Invalid project file: missing metadata" }, false, "loadProjectFromFile:error");
            return;
          }

          // Hydrate project state from file
          set(
            (state) => ({
              ...state,
              metadata: {
                ...projectJson.metadata,
                filePath: projectPath,
                modifiedAt: Date.now(),
              },
              screens: projectJson.screens || {},
              components: projectJson.components || {},
              theme: projectJson.theme || state.theme,
              buildConfig: projectJson.buildConfig || state.buildConfig,
              status: "saved",
              isLoading: false,
              error: null,
              // Set first screen as active if available
              activeScreenId: Object.keys(projectJson.screens || {})[0] || null,
              activeComponentId: null,
            }),
            false,
            "loadProjectFromFile"
          );

          // Add to recent projects
          const recentProject: RecentProject = {
            path: projectPath,
            name: projectJson.metadata.name,
            lastOpened: Date.now(),
            thumbnail: null,
          };
          get().addRecentProject(recentProject);
        },

        saveProject: async (saveAs = false) => {
          const state = get();
          set({ isSaving: true, error: null }, false, "saveProject:start");

          try {
            // 1. Prepare Project File Data
            const projectFile: ProjectFile = {
              metadata: state.metadata,
              screens: state.screens,
              components: state.components,
              theme: state.theme,
              buildConfig: state.buildConfig,
            };

            // 2. Determine File Path
            let filePath = state.metadata.filePath;

            if (saveAs || !filePath) {
              // Open Save Dialog if "Save As" or no path exists
              if (isTauri()) {
                const selectedPath = await save({
                  filters: [{ name: "App Factory Project", extensions: ["json"] }],
                  defaultPath: state.metadata.name + ".json",
                });
                if (!selectedPath) {
                  // User cancelled
                  set({ isSaving: false }, false, "saveProject:cancelled");
                  return;
                }
                filePath = selectedPath;
              } else {
                // Fallback for Browser Dev (Mock Save)
                console.warn("Save unavailable in browser: mocking save");
                await new Promise((resolve) => setTimeout(resolve, 1000));
                // Mock a successful save
                set(
                  (state) => ({
                    status: "saved",
                    isSaving: false,
                    metadata: {
                      ...state.metadata,
                      modifiedAt: Date.now(),
                    }
                  }),
                  false,
                  "saveProject:mockSuccess"
                );
                return;
              }
            }

            // 3. Write to Disk (Tauri Only)
            if (isTauri() && filePath) {
              await writeTextFile(filePath, JSON.stringify(projectFile, null, 2));

              // 4. Update State on Success
              set(
                (state) => ({
                  status: "saved",
                  isSaving: false,
                  metadata: {
                    ...state.metadata,
                    filePath,
                    modifiedAt: Date.now(),
                  },
                }),
                false,
                "saveProject:success"
              );

              // 5. Update Recent Projects
              const recentProject: RecentProject = {
                path: filePath,
                name: state.metadata.name,
                lastOpened: Date.now(),
                thumbnail: null,
              };
              get().addRecentProject(recentProject);

            } else {
              throw new Error("Cannot save: Not in Tauri environment or invalid path");
            }

          } catch (error) {
            console.error("Failed to save project:", error);
            set(
              {
                isSaving: false,
                error: error instanceof Error ? error.message : "Unknown error saving project",
              },
              false,
              "saveProject:error"
            );
          }
        },

        setMetadata: (metadata) =>
          set(
            (state) => ({
              metadata: {
                ...state.metadata,
                ...metadata,
                modifiedAt: Date.now(),
              },
              status: state.status === "saved" ? "modified" : state.status,
            }),
            false,
            "setMetadata"
          ),

        setStatus: (status) => set({ status }, false, "setStatus"),

        // Screen actions
        addScreen: (screen) =>
          set(
            (state) => ({
              screens: {
                ...state.screens,
                [screen.id]: screen,
              },
              activeScreenId: state.activeScreenId || screen.id,
              status: "modified",
            }),
            false,
            "addScreen"
          ),

        updateScreen: (screenId, updates) =>
          set(
            (state) => {
              const screen = state.screens[screenId];
              if (!screen) return state;

              return {
                screens: {
                  ...state.screens,
                  [screenId]: { ...screen, ...updates },
                },
                status: "modified",
              };
            },
            false,
            "updateScreen"
          ),

        removeScreen: (screenId) =>
          set(
            (state) => {
              const { [screenId]: removed, ...remaining } = state.screens;

              // Also remove components belonging to this screen
              const screen = state.screens[screenId];
              const componentIds = new Set<string>();
              if (screen?.rootComponentId) {
                const collectIds = (id: string) => {
                  componentIds.add(id);
                  const component = state.components[id];
                  component?.children.forEach(collectIds);
                };
                collectIds(screen.rootComponentId);
              }

              const components = { ...state.components };
              componentIds.forEach((id) => delete components[id]);

              return {
                screens: remaining,
                components,
                activeScreenId:
                  state.activeScreenId === screenId
                    ? Object.keys(remaining)[0] || null
                    : state.activeScreenId,
                activeComponentId: componentIds.has(state.activeComponentId || "")
                  ? null
                  : state.activeComponentId,
                status: "modified",
              };
            },
            false,
            "removeScreen"
          ),

        setActiveScreen: (screenId) =>
          set({ activeScreenId: screenId, activeComponentId: null }, false, "setActiveScreen"),

        duplicateScreen: (screenId) => {
          const state = get();
          const screen = state.screens[screenId];
          if (!screen) return null;

          const newScreen: ProjectScreen = {
            ...deepClone(screen),
            id: generateId(),
            name: `${screen.name} (Copy)`,
            isDefault: false,
          };

          set(
            (s) => ({
              screens: {
                ...s.screens,
                [newScreen.id]: newScreen,
              },
              status: "modified",
            }),
            false,
            "duplicateScreen"
          );

          return newScreen;
        },

        // Component actions
        addComponent: (component) =>
          set(
            (state) => ({
              components: {
                ...state.components,
                [component.id]: component,
              },
              status: "modified",
            }),
            false,
            "addComponent"
          ),

        updateComponent: (componentId, updates) =>
          set(
            (state) => {
              const component = state.components[componentId];
              if (!component) return state;

              return {
                components: {
                  ...state.components,
                  [componentId]: { ...component, ...updates },
                },
                status: "modified",
              };
            },
            false,
            "updateComponent"
          ),

        removeComponent: (componentId) =>
          set(
            (state) => {
              // Collect all descendant IDs
              const idsToRemove = new Set<string>();
              const collectIds = (id: string) => {
                idsToRemove.add(id);
                const component = state.components[id];
                component?.children.forEach(collectIds);
              };
              collectIds(componentId);

              // Remove from parent's children
              const components = { ...state.components };
              const component = components[componentId];
              if (component?.parentId && components[component.parentId]) {
                components[component.parentId] = {
                  ...components[component.parentId],
                  children: components[component.parentId].children.filter(
                    (id) => id !== componentId
                  ),
                };
              }

              // Remove all collected components
              idsToRemove.forEach((id) => delete components[id]);

              return {
                components,
                activeComponentId: idsToRemove.has(state.activeComponentId || "")
                  ? null
                  : state.activeComponentId,
                status: "modified",
              };
            },
            false,
            "removeComponent"
          ),

        setActiveComponent: (componentId) =>
          set({ activeComponentId: componentId }, false, "setActiveComponent"),

        moveComponent: (componentId, newParentId, index) =>
          set(
            (state) => {
              const component = state.components[componentId];
              if (!component) return state;

              const components = { ...state.components };

              // Remove from old parent
              if (component.parentId && components[component.parentId]) {
                components[component.parentId] = {
                  ...components[component.parentId],
                  children: components[component.parentId].children.filter(
                    (id) => id !== componentId
                  ),
                };
              }

              // Add to new parent
              if (newParentId && components[newParentId]) {
                const children = [...components[newParentId].children];
                if (index !== undefined && index >= 0) {
                  children.splice(index, 0, componentId);
                } else {
                  children.push(componentId);
                }
                components[newParentId] = {
                  ...components[newParentId],
                  children,
                };
              }

              // Update component's parentId
              components[componentId] = {
                ...component,
                parentId: newParentId,
              };

              return {
                components,
                status: "modified",
              };
            },
            false,
            "moveComponent"
          ),

        duplicateComponent: (componentId) => {
          const state = get();
          const component = state.components[componentId];
          if (!component) return null;

          const newComponent: ProjectComponent = {
            ...deepClone(component),
            id: generateId(),
            name: `${component.name} (Copy)`,
          };

          set(
            (s) => {
              const components = { ...s.components, [newComponent.id]: newComponent };

              // Add to parent's children if has parent
              if (newComponent.parentId && components[newComponent.parentId]) {
                const parent = components[newComponent.parentId];
                const insertIndex = parent.children.indexOf(componentId) + 1;
                const children = [...parent.children];
                children.splice(insertIndex, 0, newComponent.id);
                components[newComponent.parentId] = { ...parent, children };
              }

              return {
                components,
                status: "modified",
              };
            },
            false,
            "duplicateComponent"
          );

          return newComponent;
        },

        // Slot actions
        bindSlot: (componentId, slotId, pluginId) =>
          set(
            (state) => {
              const component = state.components[componentId];
              if (!component) return state;

              return {
                components: {
                  ...state.components,
                  [componentId]: {
                    ...component,
                    slots: component.slots.map((slot) =>
                      slot.id === slotId ? { ...slot, pluginId } : slot
                    ),
                  },
                },
                status: "modified",
              };
            },
            false,
            "bindSlot"
          ),

        unbindSlot: (componentId, slotId) =>
          set(
            (state) => {
              const component = state.components[componentId];
              if (!component) return state;

              return {
                components: {
                  ...state.components,
                  [componentId]: {
                    ...component,
                    slots: component.slots.map((slot) =>
                      slot.id === slotId ? { ...slot, pluginId: null } : slot
                    ),
                  },
                },
                status: "modified",
              };
            },
            false,
            "unbindSlot"
          ),

        updateSlotConfig: (componentId, slotId, config) =>
          set(
            (state) => {
              const component = state.components[componentId];
              if (!component) return state;

              return {
                components: {
                  ...state.components,
                  [componentId]: {
                    ...component,
                    slots: component.slots.map((slot) =>
                      slot.id === slotId
                        ? { ...slot, config: { ...slot.config, ...config } }
                        : slot
                    ),
                  },
                },
                status: "modified",
              };
            },
            false,
            "updateSlotConfig"
          ),

        // Theme actions
        setTheme: (theme) =>
          set(
            (state) => ({
              theme: { ...state.theme, ...theme },
              status: "modified",
            }),
            false,
            "setTheme"
          ),

        resetTheme: () =>
          set(
            {
              theme: defaultTheme,
              status: "modified",
            },
            false,
            "resetTheme"
          ),

        // Build config actions
        setBuildConfig: (config) =>
          set(
            (state) => ({
              buildConfig: { ...state.buildConfig, ...config },
              status: "modified",
            }),
            false,
            "setBuildConfig"
          ),

        // Clipboard actions
        copyComponent: (componentId) => {
          const state = get();
          const component = state.components[componentId];
          if (!component) return;

          set(
            {
              clipboard: {
                type: "component",
                data: deepClone(component),
              },
            },
            false,
            "copyComponent"
          );
        },

        copyScreen: (screenId) => {
          const state = get();
          const screen = state.screens[screenId];
          if (!screen) return;

          set(
            {
              clipboard: {
                type: "screen",
                data: deepClone(screen),
              },
            },
            false,
            "copyScreen"
          );
        },

        paste: (targetParentId = null) => {
          const state = get();
          const { clipboard } = state;

          if (!clipboard.type || !clipboard.data) return null;

          if (clipboard.type === "component") {
            const original = clipboard.data as ProjectComponent;
            const newId = generateId();
            const newComponent: ProjectComponent = {
              ...deepClone(original),
              id: newId,
              name: `${original.name} (Copy)`,
              parentId: targetParentId,
            };

            set(
              (s) => {
                const components = { ...s.components, [newId]: newComponent };

                if (targetParentId && components[targetParentId]) {
                  components[targetParentId] = {
                    ...components[targetParentId],
                    children: [...components[targetParentId].children, newId],
                  };
                }

                return {
                  components,
                  activeComponentId: newId,
                  status: "modified",
                };
              },
              false,
              "paste"
            );

            return newId;
          }

          if (clipboard.type === "screen") {
            const original = clipboard.data as ProjectScreen;
            const newId = generateId();
            const newScreen: ProjectScreen = {
              ...deepClone(original),
              id: newId,
              name: `${original.name} (Copy)`,
              isDefault: false,
            };

            set(
              (s) => ({
                screens: { ...s.screens, [newId]: newScreen },
                activeScreenId: newId,
                status: "modified",
              }),
              false,
              "paste"
            );

            return newId;
          }

          return null;
        },

        clearClipboard: () =>
          set({ clipboard: { type: null, data: null } }, false, "clearClipboard"),

        // Recent projects
        addRecentProject: (project) =>
          set(
            (state) => {
              const filtered = state.recentProjects.filter((p) => p.path !== project.path);
              const updated = [
                { ...project, lastOpened: Date.now() },
                ...filtered,
              ].slice(0, state.maxRecentProjects);

              return { recentProjects: updated };
            },
            false,
            "addRecentProject"
          ),

        removeRecentProject: (path) =>
          set(
            (state) => ({
              recentProjects: state.recentProjects.filter((p) => p.path !== path),
            }),
            false,
            "removeRecentProject"
          ),

        clearRecentProjects: () =>
          set({ recentProjects: [] }, false, "clearRecentProjects"),

        // State actions
        setLoading: (loading) => set({ isLoading: loading }, false, "setLoading"),
        setSaving: (saving) => set({ isSaving: saving }, false, "setSaving"),
        setError: (error) => set({ error }, false, "setError"),

        // Reset
        reset: () => set(initialState, false, "reset"),
      }),
      {
        name: "project-store",
        partialize: (state) => ({
          // Only persist recent projects, not the current project
          recentProjects: state.recentProjects,
        }),
      }
    ),
    { name: "ProjectStore" }
  )
);

/**
 * Selector for all screens as array.
 */
export const useScreens = () =>
  useProjectStore((state) => Object.values(state.screens));

/**
 * Selector for active screen.
 */
export const useActiveScreen = () =>
  useProjectStore((state) =>
    state.activeScreenId ? state.screens[state.activeScreenId] : null
  );

/**
 * Selector for active component.
 */
export const useActiveComponent = () =>
  useProjectStore((state) =>
    state.activeComponentId ? state.components[state.activeComponentId] : null
  );

/**
 * Selector for component tree of active screen.
 */
export const useActiveScreenComponents = () =>
  useProjectStore((state) => {
    const screen = state.activeScreenId ? state.screens[state.activeScreenId] : null;
    if (!screen?.rootComponentId) return [];

    const components: ProjectComponent[] = [];
    const collect = (id: string) => {
      const component = state.components[id];
      if (component) {
        components.push(component);
        component.children.forEach(collect);
      }
    };
    collect(screen.rootComponentId);

    return components;
  });

/**
 * Selector for project status.
 */
export const useProjectStatus = () => useProjectStore((state) => state.status);

/**
 * Selector for project theme.
 */
export const useProjectTheme = () => useProjectStore((state) => state.theme);

/**
 * Selector for build config.
 */
export const useBuildConfig = () => useProjectStore((state) => state.buildConfig);

export default useProjectStore;
