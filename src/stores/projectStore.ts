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
import { save, open } from "@tauri-apps/api/dialog";
import { writeTextFile, readTextFile } from "@tauri-apps/api/fs";
import { resolve, dirname } from "@tauri-apps/api/path";
import { isTauri } from "../utils/tauriUtils";
import type { ThemeConfig } from "../context/ThemeProvider";
import { defaultLightTheme } from "../context/ThemeProvider";

/**
 * Canvas element types (mirrored from CanvasEditor for serialization).
 */
export type CanvasElementType = "component" | "container" | "text" | "image" | "spacer";

/**
 * Canvas element bounds for serialization.
 */
export interface SerializedElementBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Serialized canvas element for project file persistence.
 */
export interface SerializedCanvasElement {
  id: string;
  type: CanvasElementType;
  name: string;
  bounds: SerializedElementBounds;
  componentId?: string;
  children?: SerializedCanvasElement[];
  props?: Record<string, unknown>;
  locked?: boolean;
  visible?: boolean;
  zIndex?: number;
}

/**
 * Window configuration for project file persistence.
 */
export interface SerializedWindowConfig {
  title: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number | null;
  maxHeight: number | null;
  x: number | null;
  y: number | null;
  center: boolean;
  fullscreen: boolean;
  resizable: boolean;
  decorations: boolean;
  alwaysOnTop: boolean;
  skipTaskbar: boolean;
  transparent: boolean;
  visible: boolean;
  focus: boolean;
  closable: boolean;
  minimizable: boolean;
  maximizable: boolean;
  fileDropEnabled: boolean;
}

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
  /** Screen-specific window configuration (overrides global windowConfig) */
  windowConfig?: SerializedWindowConfig;
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

  // Canvas state - the actual visual layout
  canvasElements: SerializedCanvasElement[];
  windowConfig: SerializedWindowConfig | null;

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

  // Save version tracking
  saveVersion: number;

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
 * Version 2: Includes canvasElements and windowConfig for complete save/load fidelity.
 */
export interface ProjectFile {
  /** File format version for forward compatibility */
  version: number;
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
  /** Canvas elements - the actual visual layout on the canvas */
  canvasElements?: SerializedCanvasElement[];
  /** Window configuration - Tauri window settings */
  windowConfig?: SerializedWindowConfig;
  /** Active screen ID */
  activeScreenId?: string | null;
  /** Active component ID */
  activeComponentId?: string | null;
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
  browseAndLoadProject: () => Promise<boolean>;
  /** Save project - writes a new versioned file (prompts for location if none exists) */
  saveProject: () => Promise<string | null>;
  /** Save As - prompts for a file location (defaulting to current file name if present) */
  saveProjectAs: () => Promise<string | null>;
  setMetadata: (metadata: Partial<ProjectMetadata>) => void;
  setStatus: (status: ProjectStatus) => void;

  // Canvas element actions
  setCanvasElements: (elements: SerializedCanvasElement[]) => void;
  updateCanvasElement: (elementId: string, updates: Partial<SerializedCanvasElement>) => void;
  addCanvasElement: (element: SerializedCanvasElement) => void;
  removeCanvasElement: (elementId: string) => void;

  // Window config actions
  setWindowConfig: (config: Partial<SerializedWindowConfig>) => void;
  /** Update window config for a specific screen (for per-screen window settings) */
  updateScreenWindowConfig: (screenId: string, config: Partial<SerializedWindowConfig>) => void;
  /** Clear a screen's window config (inherit from main) */
  clearScreenWindowConfig: (screenId: string) => void;

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
 * Default window configuration.
 */
const defaultWindowConfig: SerializedWindowConfig = {
  title: "App Factory",
  width: 1200,
  height: 800,
  minWidth: 800,
  minHeight: 600,
  maxWidth: null,
  maxHeight: null,
  x: null,
  y: null,
  center: true,
  fullscreen: false,
  resizable: true,
  decorations: true,
  alwaysOnTop: false,
  skipTaskbar: false,
  transparent: false,
  visible: true,
  focus: true,
  closable: true,
  minimizable: true,
  maximizable: true,
  fileDropEnabled: true,
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
  canvasElements: [],
  windowConfig: defaultWindowConfig,
  activeScreenId: null,
  activeComponentId: null,
  clipboard: {
    type: null,
    data: null,
  },
  recentProjects: [],
  maxRecentProjects: 10,
  saveVersion: 0,
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

const VERSIONED_FILENAME_REGEX = /^(.*)_v(\d{3})_(\d{6})$/;

const sanitizeBaseName = (name: string): string => {
  const safe = name.replace(/[^a-zA-Z0-9_-]/g, "_").replace(/^_+|_+$/g, "");
  return safe || "project";
};

const formatDateForFilename = (date: Date): string => {
  return [
    String(date.getFullYear()).slice(-2),
    String(date.getMonth() + 1).padStart(2, "0"),
    String(date.getDate()).padStart(2, "0"),
  ].join("");
};

const buildVersionedFilename = (baseName: string, version: number, date = new Date()): string => {
  const versionStr = String(version).padStart(3, "0");
  const dateStr = formatDateForFilename(date);
  return `${sanitizeBaseName(baseName)}_v${versionStr}_${dateStr}.json`;
};

const getBaseNameAndDetectedVersion = (
  filePath: string | null,
  fallbackName: string
): { baseName: string; detectedVersion: number } => {
  if (!filePath) {
    return { baseName: sanitizeBaseName(fallbackName), detectedVersion: 0 };
  }

  const filename = filePath.replace(/\\/g, "/").split("/").pop() || "";
  const withoutExt = filename.replace(/\.json$/i, "");
  const match = VERSIONED_FILENAME_REGEX.exec(withoutExt);

  if (match) {
    return {
      baseName: sanitizeBaseName(match[1] || fallbackName),
      detectedVersion: Number(match[2]) || 0,
    };
  }

  return {
    baseName: sanitizeBaseName(withoutExt || fallbackName),
    detectedVersion: 0,
  };
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

          // Hydrate project state from file - restore ALL fields for perfect round-trip
          set(
            (state) => ({
              ...state,
              metadata: {
                ...projectJson.metadata,
                filePath: projectPath,
                // Preserve original modifiedAt from file, don't overwrite
              },
              screens: projectJson.screens || {},
              components: projectJson.components || {},
              theme: projectJson.theme || state.theme,
              buildConfig: projectJson.buildConfig || state.buildConfig,
              // Restore canvas elements (v2 format) or empty array for v1 files
              canvasElements: projectJson.canvasElements || [],
              // Restore window config (v2 format) or keep default for v1 files
              windowConfig: projectJson.windowConfig || state.windowConfig,
              status: "saved",
              isLoading: false,
              error: null,
              // Restore active selections from file, or fallback to first screen
              activeScreenId: projectJson.activeScreenId !== undefined
                ? projectJson.activeScreenId
                : Object.keys(projectJson.screens || {})[0] || null,
              activeComponentId: projectJson.activeComponentId !== undefined
                ? projectJson.activeComponentId
                : null,
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

        browseAndLoadProject: async () => {
          set({ isLoading: true, error: null }, false, "browseAndLoadProject:start");

          try {
            if (!isTauri()) {
              console.warn("Browse unavailable in browser mode");
              set({ isLoading: false }, false, "browseAndLoadProject:browserMode");
              return false;
            }

            // Hardcoded path for development - projects directory
            const defaultDir = 'C:\\Users\\anujd\\Documents\\01_AI\\173_piovisstudio\\app_factory\\outputs\\projects';

            // Open file dialog
            const selectedPath = await open({
              filters: [{ name: "App Factory Project", extensions: ["json"] }],
              defaultPath: defaultDir,
              multiple: false,
              directory: false,
            });

            if (!selectedPath || Array.isArray(selectedPath)) {
              // User cancelled or invalid selection
              set({ isLoading: false }, false, "browseAndLoadProject:cancelled");
              return false;
            }

            // Read the project file
            const content = await readTextFile(selectedPath);
            const projectJson = JSON.parse(content) as ProjectFile;

            // Load the project using existing method
            get().loadProjectFromFile(selectedPath, projectJson);

            set({ isLoading: false }, false, "browseAndLoadProject:success");
            return true;
          } catch (error) {
            console.error("Failed to browse and load project:", error);
            set(
              {
                isLoading: false,
                error: error instanceof Error ? error.message : "Failed to load project",
              },
              false,
              "browseAndLoadProject:error"
            );
            return false;
          }
        },

        /**
         * Save project - writes a new versioned file each time.
         * Prompts for a location if none exists, then auto-increments version
         * in the chosen directory on subsequent saves.
         */
        saveProject: async () => {
          const state = get();
          set({ isSaving: true, error: null }, false, "saveProject:start");

          try {
            const now = Date.now();
            const { baseName, detectedVersion } = getBaseNameAndDetectedVersion(
              state.metadata.filePath,
              state.metadata.name
            );
            const nextVersion = Math.max(state.saveVersion, detectedVersion) + 1;
            const versionedFilename = buildVersionedFilename(baseName, nextVersion, new Date(now));

            // Determine file path - prompt for new location once, then auto-increment
            let filePath = state.metadata.filePath;

            if (!filePath) {
              if (isTauri()) {
                const defaultDir = await resolve("outputs", "projects");
                const defaultFilePath = await resolve(defaultDir, versionedFilename);
                const selectedPath = await save({
                  filters: [{ name: "App Factory Project", extensions: ["json"] }],
                  defaultPath: defaultFilePath,
                });
                if (!selectedPath) {
                  set({ isSaving: false }, false, "saveProject:cancelled");
                  return null;
                }
                filePath = selectedPath;
              } else {
                console.warn("Save unavailable in browser mode: Tauri IPC not available");
                set(
                  (s) => ({
                    status: "error",
                    isSaving: false,
                    error: "Save to disk unavailable in browser mode. Run with 'npm run tauri dev' for full functionality.",
                    metadata: { ...s.metadata },
                  }),
                  false,
                  "saveProject:browserModeUnavailable"
                );
                return null;
              }
            } else {
              if (isTauri()) {
                const targetDir = await dirname(filePath);
                filePath = await resolve(targetDir, versionedFilename);
              } else {
                console.warn("Save unavailable in browser mode: Tauri IPC not available");
                set(
                  (s) => ({
                    status: "error",
                    isSaving: false,
                    error: "Save to disk unavailable in browser mode. Run with 'npm run tauri dev' for full functionality.",
                    metadata: { ...s.metadata },
                  }),
                  false,
                  "saveProject:browserModeUnavailable"
                );
                return null;
              }
            }

            // Prepare complete Project File Data (version 2 format)
            const projectFile: ProjectFile = {
              version: 2,
              metadata: {
                ...state.metadata,
                filePath,
                modifiedAt: now,
              },
              screens: state.screens,
              components: state.components,
              theme: state.theme,
              buildConfig: state.buildConfig,
              canvasElements: state.canvasElements,
              ...(state.windowConfig ? { windowConfig: state.windowConfig } : {}),
              activeScreenId: state.activeScreenId,
              activeComponentId: state.activeComponentId,
            };

            // Write to disk (Tauri)
            if (isTauri() && filePath) {
              await writeTextFile(filePath, JSON.stringify(projectFile, null, 2));

              // Update state on success
              set(
                (s) => ({
                  status: "saved",
                  isSaving: false,
                  saveVersion: nextVersion,
                  metadata: { ...s.metadata, filePath, modifiedAt: now },
                }),
                false,
                "saveProject:success"
              );

              // Update recent projects
              get().addRecentProject({
                path: filePath,
                name: state.metadata.name,
                lastOpened: now,
                thumbnail: null,
              });

              return filePath;
            } else if (!isTauri()) {
              console.warn("Save unavailable in browser mode: Tauri IPC not available");
              set(
                (s) => ({
                  status: "error",
                  isSaving: false,
                  error: "Save to disk unavailable in browser mode. Run with 'npm run tauri dev' for full functionality.",
                  metadata: { ...s.metadata },
                }),
                false,
                "saveProject:browserModeUnavailable"
              );
              return null;
            } else {
              throw new Error("Cannot save: invalid file path");
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
            return null;
          }
        },

        /**
         * Save As - prompts for a file location (defaulting to current file name if present).
         * Format recommendation: <projectName>_v<NNN>_<YYMMDD>.json
         * Increments saveVersion counter for each Save As operation.
         */
        saveProjectAs: async () => {
          const state = get();
          set({ isSaving: true, error: null }, false, "saveProjectAs:start");

          try {
            const now = Date.now();
            const { baseName, detectedVersion } = getBaseNameAndDetectedVersion(
              state.metadata.filePath,
              state.metadata.name
            );
            const newVersion = Math.max(state.saveVersion, detectedVersion) + 1;
            const versionedFilename = buildVersionedFilename(baseName, newVersion, new Date(now));

            // Prepare complete Project File Data
            const projectFile: ProjectFile = {
              version: 2,
              metadata: {
                ...state.metadata,
                modifiedAt: now,
              },
              screens: state.screens,
              components: state.components,
              theme: state.theme,
              buildConfig: state.buildConfig,
              canvasElements: state.canvasElements,
              ...(state.windowConfig ? { windowConfig: state.windowConfig } : {}),
              activeScreenId: state.activeScreenId,
              activeComponentId: state.activeComponentId,
            };

            if (isTauri()) {
              // Determine default directory
              let defaultFilePath: string;
              if (state.metadata.filePath) {
                defaultFilePath = state.metadata.filePath;
              } else {
                const defaultDir = await resolve("outputs", "projects");
                defaultFilePath = await resolve(defaultDir, versionedFilename);
              }

              const selectedPath = await save({
                filters: [{ name: "App Factory Project", extensions: ["json"] }],
                defaultPath: defaultFilePath,
              });

              if (!selectedPath) {
                set({ isSaving: false }, false, "saveProjectAs:cancelled");
                return null;
              }

              // Write to disk
              const projectFileWithPath: ProjectFile = {
                ...projectFile,
                metadata: {
                  ...projectFile.metadata,
                  filePath: selectedPath,
                },
              };

              await writeTextFile(selectedPath, JSON.stringify(projectFileWithPath, null, 2));

              // Update state with new path and version
              set(
                (s) => ({
                  status: "saved",
                  isSaving: false,
                  saveVersion: newVersion,
                  metadata: {
                    ...s.metadata,
                    filePath: selectedPath,
                    modifiedAt: now,
                  },
                }),
                false,
                "saveProjectAs:success"
              );

              // Update Recent Projects
              get().addRecentProject({
                path: selectedPath,
                name: state.metadata.name,
                lastOpened: now,
                thumbnail: null,
              });

              return selectedPath;
            } else {
              // Browser fallback
              console.warn("Save As unavailable in browser: mocking save");
              await new Promise((r) => setTimeout(r, 500));
              set(
                (s) => ({
                  status: "saved",
                  isSaving: false,
                  saveVersion: newVersion,
                  metadata: { ...s.metadata, modifiedAt: Date.now() },
                }),
                false,
                "saveProjectAs:mockSuccess"
              );
              return null;
            }
          } catch (error) {
            console.error("Failed to save project as:", error);
            set(
              {
                isSaving: false,
                error: error instanceof Error ? error.message : "Unknown error saving project",
              },
              false,
              "saveProjectAs:error"
            );
            return null;
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

        // Canvas element actions
        setCanvasElements: (elements) =>
          set(
            { canvasElements: elements, status: "modified" },
            false,
            "setCanvasElements"
          ),

        updateCanvasElement: (elementId, updates) =>
          set(
            (state) => ({
              canvasElements: state.canvasElements.map((el) =>
                el.id === elementId ? { ...el, ...updates } : el
              ),
              status: "modified",
            }),
            false,
            "updateCanvasElement"
          ),

        addCanvasElement: (element) =>
          set(
            (state) => ({
              canvasElements: [...state.canvasElements, element],
              status: "modified",
            }),
            false,
            "addCanvasElement"
          ),

        removeCanvasElement: (elementId) =>
          set(
            (state) => ({
              canvasElements: state.canvasElements.filter((el) => el.id !== elementId),
              status: "modified",
            }),
            false,
            "removeCanvasElement"
          ),

        // Window config actions
        setWindowConfig: (config) =>
          set(
            (state) => ({
              windowConfig: state.windowConfig
                ? { ...state.windowConfig, ...config }
                : { ...defaultWindowConfig, ...config },
              status: "modified",
            }),
            false,
            "setWindowConfig"
          ),

        updateScreenWindowConfig: (screenId, config) =>
          set(
            (state) => {
              const screen = state.screens[screenId];
              if (!screen) return state;

              // Merge with existing screen windowConfig or create new one based on defaults
              const baseConfig = screen.windowConfig || state.windowConfig || defaultWindowConfig;
              const newWindowConfig: SerializedWindowConfig = {
                ...baseConfig,
                ...config,
              };

              return {
                screens: {
                  ...state.screens,
                  [screenId]: {
                    ...screen,
                    windowConfig: newWindowConfig,
                  },
                },
                status: "modified",
              };
            },
            false,
            "updateScreenWindowConfig"
          ),

        clearScreenWindowConfig: (screenId) =>
          set(
            (state) => {
              const screen = state.screens[screenId];
              if (!screen) return state;

              // Create a copy without windowConfig
              const { windowConfig: _, ...screenWithoutConfig } = screen;

              return {
                screens: {
                  ...state.screens,
                  [screenId]: screenWithoutConfig as ProjectScreen,
                },
                status: "modified",
              };
            },
            false,
            "clearScreenWindowConfig"
          ),

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
                  ...components[component.parentId]!,
                  children: components[component.parentId]!.children.filter(
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
                  ...components[newParentId]!,
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
                const parent = components[newComponent.parentId]!;
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

/**
 * Selector for canvas elements.
 */
export const useCanvasElements = () => useProjectStore((state) => state.canvasElements);

/**
 * Selector for window config.
 */
export const useWindowConfig = () => useProjectStore((state) => state.windowConfig);

/**
 * Selector for save version.
 */
export const useSaveVersion = () => useProjectStore((state) => state.saveVersion);

export default useProjectStore;
