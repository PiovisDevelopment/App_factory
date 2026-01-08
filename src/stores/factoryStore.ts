/**
 * D075 - src/stores/factoryStore.ts
 * ==================================
 * Zustand store for factory-wide state management.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";

/**
 * View mode for the factory layout.
 */
export type FactoryViewMode = "design" | "preview" | "code";

/**
 * Panel visibility configuration.
 */
export interface PanelVisibility {
  /** Left sidebar (galleries, tree) */
  leftSidebar: boolean;
  /** Right sidebar (properties, inspector) */
  rightSidebar: boolean;
  /** Bottom panel (logs, console) */
  bottomPanel: boolean;
  /** Top toolbar */
  toolbar: boolean;
}

/**
 * Panel sizes in pixels or percentage.
 */
export interface PanelSizes {
  /** Left sidebar width */
  leftSidebarWidth: number;
  /** Right sidebar width */
  rightSidebarWidth: number;
  /** Bottom panel height */
  bottomPanelHeight: number;
}

/**
 * Active tab selections for each panel.
 */
export interface ActiveTabs {
  /** Left sidebar active tab */
  leftSidebar: "plugins" | "components" | "screens" | "files";
  /** Right sidebar active tab */
  rightSidebar: "properties" | "styles" | "events" | "data";
  /** Bottom panel active tab */
  bottomPanel: "logs" | "console" | "terminal" | "problems";
}

/**
 * Canvas zoom and position state.
 */
export interface CanvasState {
  /** Zoom level (1 = 100%) */
  zoom: number;
  /** X offset in pixels */
  panX: number;
  /** Y offset in pixels */
  panY: number;
  /** Whether grid is visible */
  showGrid: boolean;
  /** Grid size in pixels */
  gridSize: number;
  /** Snap to grid enabled */
  snapToGrid: boolean;
}

/**
 * Selection state for canvas elements.
 */
export interface SelectionState {
  /** Selected element IDs */
  selectedIds: string[];
  /** Hovered element ID */
  hoveredId: string | null;
  /** Multi-select mode active */
  multiSelectMode: boolean;
}

/**
 * History entry for undo/redo.
 */
export interface HistoryEntry {
  /** Unique entry ID */
  id: string;
  /** Action description */
  description: string;
  /** Timestamp */
  timestamp: number;
  /** Serialized state snapshot */
  snapshot: string;
}

/**
 * Undo/redo history state.
 */
export interface HistoryState {
  /** Past entries (for undo) */
  past: HistoryEntry[];
  /** Future entries (for redo) */
  future: HistoryEntry[];
  /** Maximum history size */
  maxSize: number;
}

/**
 * Notification message.
 */
export interface Notification {
  /** Unique notification ID */
  id: string;
  /** Notification type */
  type: "info" | "success" | "warning" | "error";
  /** Title */
  title: string;
  /** Message body */
  message?: string;
  /** Auto-dismiss timeout in ms (0 = no auto-dismiss) */
  timeout: number;
  /** Creation timestamp */
  createdAt: number;
}

/**
 * Factory store state interface.
 */
export interface FactoryState {
  // View state
  viewMode: FactoryViewMode;
  panelVisibility: PanelVisibility;
  panelSizes: PanelSizes;
  activeTabs: ActiveTabs;

  // Canvas state
  canvas: CanvasState;
  selection: SelectionState;

  // History
  history: HistoryState;

  // Notifications
  notifications: Notification[];

  // UI state
  isLoading: boolean;
  loadingMessage: string | null;
  isSaving: boolean;
  hasUnsavedChanges: boolean;

  // Modal state
  activeModal: string | null;
  modalData: Record<string, unknown> | null;
}

/**
 * Factory store actions interface.
 */
export interface FactoryActions {
  // View actions
  setViewMode: (mode: FactoryViewMode) => void;
  togglePanel: (panel: keyof PanelVisibility) => void;
  setPanelSize: (panel: keyof PanelSizes, size: number) => void;
  setActiveTab: <K extends keyof ActiveTabs>(panel: K, tab: ActiveTabs[K]) => void;

  // Canvas actions
  setZoom: (zoom: number) => void;
  zoomIn: () => void;
  zoomOut: () => void;
  resetZoom: () => void;
  setPan: (x: number, y: number) => void;
  toggleGrid: () => void;
  setGridSize: (size: number) => void;
  toggleSnapToGrid: () => void;

  // Selection actions
  select: (ids: string[]) => void;
  addToSelection: (id: string) => void;
  removeFromSelection: (id: string) => void;
  clearSelection: () => void;
  setHovered: (id: string | null) => void;
  toggleMultiSelectMode: () => void;

  // History actions
  pushHistory: (description: string, snapshot: string) => void;
  undo: () => HistoryEntry | null;
  redo: () => HistoryEntry | null;
  clearHistory: () => void;

  // Notification actions
  addNotification: (notification: Omit<Notification, "id" | "createdAt">) => string;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;

  // UI actions
  setLoading: (isLoading: boolean, message?: string | null) => void;
  setSaving: (isSaving: boolean) => void;
  setUnsavedChanges: (hasChanges: boolean) => void;

  // Modal actions
  openModal: (modalId: string, data?: Record<string, unknown>) => void;
  closeModal: () => void;

  // Reset
  reset: () => void;
}

/**
 * Initial state values.
 */
const initialState: FactoryState = {
  viewMode: "design",
  panelVisibility: {
    leftSidebar: true,
    rightSidebar: true,
    bottomPanel: false,
    toolbar: true,
  },
  panelSizes: {
    leftSidebarWidth: 280,
    rightSidebarWidth: 320,
    bottomPanelHeight: 200,
  },
  activeTabs: {
    leftSidebar: "plugins",
    rightSidebar: "properties",
    bottomPanel: "logs",
  },
  canvas: {
    zoom: 1,
    panX: 0,
    panY: 0,
    showGrid: true,
    gridSize: 8,
    snapToGrid: true,
  },
  selection: {
    selectedIds: [],
    hoveredId: null,
    multiSelectMode: false,
  },
  history: {
    past: [],
    future: [],
    maxSize: 50,
  },
  notifications: [],
  isLoading: false,
  loadingMessage: null,
  isSaving: false,
  hasUnsavedChanges: false,
  activeModal: null,
  modalData: null,
};

/**
 * Generate unique ID for notifications and history entries.
 */
const generateId = (): string => {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

/**
 * Zustand factory store.
 *
 * Manages factory-wide UI state including:
 * - View mode (design/preview/code)
 * - Panel visibility and sizes
 * - Canvas zoom and pan
 * - Element selection
 * - Undo/redo history
 * - Notifications
 * - Modal state
 *
 * @example
 * ```tsx
 * const viewMode = useFactoryStore((state) => state.viewMode);
 * const setViewMode = useFactoryStore((state) => state.setViewMode);
 *
 * // Switch to preview mode
 * setViewMode("preview");
 *
 * // Toggle left sidebar
 * const togglePanel = useFactoryStore((state) => state.togglePanel);
 * togglePanel("leftSidebar");
 * ```
 */
export const useFactoryStore = create<FactoryState & FactoryActions>()(
  devtools(
    persist(
      (set, get) => ({
        ...initialState,

        // View actions
        setViewMode: (mode) => set({ viewMode: mode }, false, "setViewMode"),

        togglePanel: (panel) =>
          set(
            (state) => ({
              panelVisibility: {
                ...state.panelVisibility,
                [panel]: !state.panelVisibility[panel],
              },
            }),
            false,
            "togglePanel"
          ),

        setPanelSize: (panel, size) =>
          set(
            (state) => ({
              panelSizes: {
                ...state.panelSizes,
                [panel]: Math.max(0, size),
              },
            }),
            false,
            "setPanelSize"
          ),

        setActiveTab: (panel, tab) =>
          set(
            (state) => ({
              activeTabs: {
                ...state.activeTabs,
                [panel]: tab,
              },
            }),
            false,
            "setActiveTab"
          ),

        // Canvas actions
        setZoom: (zoom) =>
          set(
            (state) => ({
              canvas: {
                ...state.canvas,
                zoom: Math.max(0.1, Math.min(5, zoom)),
              },
            }),
            false,
            "setZoom"
          ),

        zoomIn: () =>
          set(
            (state) => ({
              canvas: {
                ...state.canvas,
                zoom: Math.min(5, state.canvas.zoom * 1.2),
              },
            }),
            false,
            "zoomIn"
          ),

        zoomOut: () =>
          set(
            (state) => ({
              canvas: {
                ...state.canvas,
                zoom: Math.max(0.1, state.canvas.zoom / 1.2),
              },
            }),
            false,
            "zoomOut"
          ),

        resetZoom: () =>
          set(
            (state) => ({
              canvas: {
                ...state.canvas,
                zoom: 1,
                panX: 0,
                panY: 0,
              },
            }),
            false,
            "resetZoom"
          ),

        setPan: (x, y) =>
          set(
            (state) => ({
              canvas: {
                ...state.canvas,
                panX: x,
                panY: y,
              },
            }),
            false,
            "setPan"
          ),

        toggleGrid: () =>
          set(
            (state) => ({
              canvas: {
                ...state.canvas,
                showGrid: !state.canvas.showGrid,
              },
            }),
            false,
            "toggleGrid"
          ),

        setGridSize: (size) =>
          set(
            (state) => ({
              canvas: {
                ...state.canvas,
                gridSize: Math.max(1, size),
              },
            }),
            false,
            "setGridSize"
          ),

        toggleSnapToGrid: () =>
          set(
            (state) => ({
              canvas: {
                ...state.canvas,
                snapToGrid: !state.canvas.snapToGrid,
              },
            }),
            false,
            "toggleSnapToGrid"
          ),

        // Selection actions
        select: (ids) =>
          set(
            (state) => ({
              selection: {
                ...state.selection,
                selectedIds: ids,
              },
            }),
            false,
            "select"
          ),

        addToSelection: (id) =>
          set(
            (state) => ({
              selection: {
                ...state.selection,
                selectedIds: state.selection.selectedIds.includes(id)
                  ? state.selection.selectedIds
                  : [...state.selection.selectedIds, id],
              },
            }),
            false,
            "addToSelection"
          ),

        removeFromSelection: (id) =>
          set(
            (state) => ({
              selection: {
                ...state.selection,
                selectedIds: state.selection.selectedIds.filter((i) => i !== id),
              },
            }),
            false,
            "removeFromSelection"
          ),

        clearSelection: () =>
          set(
            (state) => ({
              selection: {
                ...state.selection,
                selectedIds: [],
              },
            }),
            false,
            "clearSelection"
          ),

        setHovered: (id) =>
          set(
            (state) => ({
              selection: {
                ...state.selection,
                hoveredId: id,
              },
            }),
            false,
            "setHovered"
          ),

        toggleMultiSelectMode: () =>
          set(
            (state) => ({
              selection: {
                ...state.selection,
                multiSelectMode: !state.selection.multiSelectMode,
              },
            }),
            false,
            "toggleMultiSelectMode"
          ),

        // History actions
        pushHistory: (description, snapshot) =>
          set(
            (state) => {
              const entry: HistoryEntry = {
                id: generateId(),
                description,
                timestamp: Date.now(),
                snapshot,
              };

              const past = [...state.history.past, entry];
              if (past.length > state.history.maxSize) {
                past.shift();
              }

              return {
                history: {
                  ...state.history,
                  past,
                  future: [], // Clear redo stack on new action
                },
                hasUnsavedChanges: true,
              };
            },
            false,
            "pushHistory"
          ),

        undo: () => {
          const { history } = get();
          if (history.past.length === 0) return null;

          const entry = history.past[history.past.length - 1];
          if (!entry) return null;
          set(
            (state) => ({
              history: {
                ...state.history,
                past: state.history.past.slice(0, -1),
                future: [entry, ...state.history.future],
              },
            }),
            false,
            "undo"
          );
          return entry;
        },

        redo: () => {
          const { history } = get();
          if (history.future.length === 0) return null;

          const entry = history.future[0];
          if (!entry) return null;
          set(
            (state) => ({
              history: {
                ...state.history,
                past: [...state.history.past, entry],
                future: state.history.future.slice(1),
              },
            }),
            false,
            "redo"
          );
          return entry;
        },

        clearHistory: () =>
          set(
            (state) => ({
              history: {
                ...state.history,
                past: [],
                future: [],
              },
            }),
            false,
            "clearHistory"
          ),

        // Notification actions
        addNotification: (notification) => {
          const id = generateId();
          set(
            (state) => ({
              notifications: [
                ...state.notifications,
                {
                  ...notification,
                  id,
                  createdAt: Date.now(),
                },
              ],
            }),
            false,
            "addNotification"
          );

          // Auto-dismiss if timeout is set
          if (notification.timeout > 0) {
            setTimeout(() => {
              get().removeNotification(id);
            }, notification.timeout);
          }

          return id;
        },

        removeNotification: (id) =>
          set(
            (state) => ({
              notifications: state.notifications.filter((n) => n.id !== id),
            }),
            false,
            "removeNotification"
          ),

        clearNotifications: () => set({ notifications: [] }, false, "clearNotifications"),

        // UI actions
        setLoading: (isLoading, message = null) =>
          set({ isLoading, loadingMessage: message }, false, "setLoading"),

        setSaving: (isSaving) => set({ isSaving }, false, "setSaving"),

        setUnsavedChanges: (hasChanges) =>
          set({ hasUnsavedChanges: hasChanges }, false, "setUnsavedChanges"),

        // Modal actions
        openModal: (modalId, data = undefined) =>
          set(
            {
              activeModal: modalId,
              modalData: data || null,
            },
            false,
            "openModal"
          ),

        closeModal: () =>
          set(
            {
              activeModal: null,
              modalData: null,
            },
            false,
            "closeModal"
          ),

        // Reset
        reset: () => set(initialState, false, "reset"),
      }),
      {
        name: "factory-store",
        partialize: (state) => ({
          // Only persist UI preferences, not transient state
          panelVisibility: state.panelVisibility,
          panelSizes: state.panelSizes,
          activeTabs: state.activeTabs,
          canvas: {
            showGrid: state.canvas.showGrid,
            gridSize: state.canvas.gridSize,
            snapToGrid: state.canvas.snapToGrid,
          },
        }),
      }
    ),
    { name: "FactoryStore" }
  )
);

/**
 * Selector hooks for common state slices.
 */
export const useViewMode = () => useFactoryStore((state) => state.viewMode);
export const usePanelVisibility = () => useFactoryStore((state) => state.panelVisibility);
export const useCanvas = () => useFactoryStore((state) => state.canvas);
export const useSelection = () => useFactoryStore((state) => state.selection);
export const useNotifications = () => useFactoryStore((state) => state.notifications);
export const useIsLoading = () => useFactoryStore((state) => state.isLoading);
export const useActiveModal = () => useFactoryStore((state) => state.activeModal);

export default useFactoryStore;
