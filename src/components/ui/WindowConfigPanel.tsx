/**
 * D019 - src/components/ui/WindowConfigPanel.tsx
 * ===============================================
 * Window configuration panel with toggles for: fullscreen, floating,
 * frameless, always-on-top. Persists settings to tauri.conf.json.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies:
 *   - D006 (design_tokens.css)
 *   - D007 (tailwind.config.js)
 *   - D010 (Button.tsx)
 *   - D011 (Input.tsx)
 *   - D012 (Select.tsx)
 *   - D013 (Checkbox.tsx)
 *   - D015 (Panel.tsx)
 *
 * Features:
 *   - Window mode toggles (fullscreen, floating, frameless, always-on-top)
 *   - Window dimensions configuration
 *   - Minimum/maximum size constraints
 *   - Window position settings
 *   - Live preview of configuration
 *   - Export to tauri.conf.json format
 */

import React, { useState, useCallback, useEffect } from "react";
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import Button from "./Button";
import Input from "./Input";
// Select import removed - not used in this file
import Checkbox from "./Checkbox";
import Panel, { PanelHeader, PanelBody } from "./Panel";
import type { ScreenType, SerializedWindowConfig } from "../../stores/projectStore";

// ============================================
// Types
// ============================================

/**
 * Window configuration state.
 */
export interface WindowConfig {
  // Basic settings
  title: string;
  width: number;
  height: number;
  minWidth: number;
  minHeight: number;
  maxWidth: number | null;
  maxHeight: number | null;

  // Position (null = centered)
  x: number | null;
  y: number | null;
  center: boolean;

  // Window behavior flags
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

  // Special modes
  fileDropEnabled: boolean;
}

/**
 * Window config store state.
 */
interface WindowConfigState {
  config: WindowConfig;
  isDirty: boolean;

  // Actions
  setConfig: (updates: Partial<WindowConfig>) => void;
  resetToDefaults: () => void;
  markClean: () => void;
  exportToTauriConfig: () => TauriWindowConfig;
}

/**
 * Tauri window configuration format (for export).
 */
interface TauriWindowConfig {
  label: string;
  title: string;
  width: number;
  height: number;
  minWidth?: number;
  minHeight?: number;
  maxWidth?: number;
  maxHeight?: number;
  x?: number;
  y?: number;
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

// ============================================
// Default Configuration
// ============================================

const defaultConfig: WindowConfig = {
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

// ============================================
// Zustand Store
// ============================================

/**
 * Window configuration store with persistence.
 */
export const useWindowConfigStore = create<WindowConfigState>()(
  persist(
    (set, get) => ({
      config: defaultConfig,
      isDirty: false,

      setConfig: (updates) =>
        set((state) => ({
          config: { ...state.config, ...updates },
          isDirty: true,
        })),

      resetToDefaults: () =>
        set({
          config: defaultConfig,
          isDirty: true,
        }),

      markClean: () => set({ isDirty: false }),

      exportToTauriConfig: () => {
        const { config } = get();
        const tauriConfig: TauriWindowConfig = {
          label: "main",
          title: config.title,
          width: config.width,
          height: config.height,
          center: config.center,
          fullscreen: config.fullscreen,
          resizable: config.resizable,
          decorations: config.decorations,
          alwaysOnTop: config.alwaysOnTop,
          skipTaskbar: config.skipTaskbar,
          transparent: config.transparent,
          visible: config.visible,
          focus: config.focus,
          closable: config.closable,
          minimizable: config.minimizable,
          maximizable: config.maximizable,
          fileDropEnabled: config.fileDropEnabled,
        };

        // Only include optional values if set
        if (config.minWidth > 0) tauriConfig.minWidth = config.minWidth;
        if (config.minHeight > 0) tauriConfig.minHeight = config.minHeight;
        if (config.maxWidth !== null) tauriConfig.maxWidth = config.maxWidth;
        if (config.maxHeight !== null) tauriConfig.maxHeight = config.maxHeight;
        if (!config.center && config.x !== null) tauriConfig.x = config.x;
        if (!config.center && config.y !== null) tauriConfig.y = config.y;

        return tauriConfig;
      },
    }),
    {
      name: "app-factory-window-config",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ config: state.config }),
    }
  )
);

// ============================================
// Preset Configurations
// ============================================

interface WindowPreset {
  name: string;
  description: string;
  config: Partial<WindowConfig>;
}

const windowPresets: WindowPreset[] = [
  {
    name: "Default",
    description: "Standard resizable window with decorations",
    config: {
      width: 1200,
      height: 800,
      fullscreen: false,
      resizable: true,
      decorations: true,
      alwaysOnTop: false,
    },
  },
  {
    name: "Fullscreen",
    description: "Full screen application",
    config: {
      fullscreen: true,
      decorations: false,
      resizable: false,
    },
  },
  {
    name: "Floating Widget",
    description: "Small always-on-top widget",
    config: {
      width: 320,
      height: 480,
      minWidth: 280,
      minHeight: 400,
      maxWidth: 400,
      maxHeight: 600,
      resizable: true,
      decorations: true,
      alwaysOnTop: true,
      fullscreen: false,
    },
  },
  {
    name: "Frameless",
    description: "Borderless window without title bar",
    config: {
      decorations: false,
      resizable: true,
      transparent: false,
    },
  },
  {
    name: "Transparent Overlay",
    description: "Transparent background for overlays",
    config: {
      decorations: false,
      transparent: true,
      alwaysOnTop: true,
      skipTaskbar: true,
    },
  },
  {
    name: "Kiosk Mode",
    description: "Locked fullscreen without controls",
    config: {
      fullscreen: true,
      decorations: false,
      resizable: false,
      closable: false,
      minimizable: false,
      maximizable: false,
    },
  },
];

// ============================================
// Main Component
// ============================================

/**
 * Target for window config application.
 * - 'factory': Apply config to App Factory window itself
 * - 'canvas': Apply config to the app being designed in the canvas (saves to project)
 */
export type WindowConfigTarget = 'factory' | 'canvas';

export interface WindowConfigPanelProps {
  /** Whether the panel is open */
  isOpen?: boolean;
  /** Callback when panel should close */
  onClose?: () => void;
  /** Callback when config is saved/exported */
  onSave?: (config: TauriWindowConfig) => void;
  /** Position of the panel */
  position?: "left" | "right";
  /** Width of the panel */
  width?: string;
  /** Initial target for window config application */
  initialTarget?: WindowConfigTarget;
  /** Callback when window config is applied to canvas app (main window) */
  onApplyToCanvas?: (config: WindowConfig) => void;
  /** Callback when window config is applied to a specific screen */
  onApplyToScreen?: (screenId: string, config: WindowConfig) => void;
  /** Available screens from loaded project (for per-screen config) */
  screens?: Array<{ id: string; name: string; type: ScreenType; hasCustomConfig?: boolean }>;
  /** Currently selected screen ID for per-screen config (null = main window) */
  selectedScreenId?: string | null;
  /** Callback when screen selection changes */
  onScreenSelect?: (screenId: string | null) => void;
  /** Initial config to load (from project or screen) */
  initialConfig?: SerializedWindowConfig | null;
}

/**
 * WindowConfigPanel component.
 *
 * A comprehensive panel for configuring Tauri window settings including
 * size, position, behavior flags, and special modes. Can export configuration
 * in tauri.conf.json format.
 *
 * @example
 * ```tsx
 * const [isOpen, setIsOpen] = useState(false);
 *
 * <WindowConfigPanel
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   onSave={(config) => console.log("Config:", config)}
 * />
 * ```
 */
export const WindowConfigPanel: React.FC<WindowConfigPanelProps> = ({
  isOpen = true,
  onClose,
  onSave,
  position = "right",
  width = "380px",
  initialTarget = 'factory',
  onApplyToCanvas,
  onApplyToScreen,
  screens = [],
  selectedScreenId,
  onScreenSelect,
  initialConfig,
}) => {
  const {
    config,
    isDirty,
    setConfig,
    resetToDefaults,
    markClean,
    exportToTauriConfig,
  } = useWindowConfigStore();

  const [showExportModal, setShowExportModal] = useState(false);
  const [configTarget, setConfigTarget] = useState<WindowConfigTarget>(initialTarget);
  // Local state for screen selection (controlled by parent or internal)
  const [localSelectedScreen, setLocalSelectedScreen] = useState<string | null>(selectedScreenId ?? null);

  // Sync local screen selection with parent prop
  useEffect(() => {
    if (selectedScreenId !== undefined) {
      setLocalSelectedScreen(selectedScreenId);
    }
  }, [selectedScreenId]);

  // Load initial config when it changes (e.g., when switching screens)
  useEffect(() => {
    if (initialConfig && configTarget === 'canvas') {
      setConfig(initialConfig as Partial<WindowConfig>);
    }
  }, [initialConfig, configTarget, setConfig]);

  // Handle screen selection change
  const handleScreenChange = useCallback((screenId: string | null) => {
    setLocalSelectedScreen(screenId);
    if (onScreenSelect) {
      onScreenSelect(screenId);
    }
  }, [onScreenSelect]);

  // Handle number input changes
  const handleNumberChange = useCallback(
    (key: keyof WindowConfig, value: string) => {
      const numValue = parseInt(value, 10);
      if (!isNaN(numValue)) {
        setConfig({ [key]: numValue });
      } else if (value === "") {
        setConfig({ [key]: key.includes("max") ? null : 0 });
      }
    },
    [setConfig]
  );

  // Handle boolean toggle changes
  const handleToggle = useCallback(
    (key: keyof WindowConfig) => {
      setConfig({ [key]: !config[key] });
    },
    [config, setConfig]
  );

  // Apply preset
  const applyPreset = useCallback(
    (preset: WindowPreset) => {
      setConfig(preset.config);
    },
    [setConfig]
  );

  // Export configuration
  const handleExport = useCallback(() => {
    const tauriConfig = exportToTauriConfig();
    if (onSave) {
      onSave(tauriConfig);
    }
    markClean();
    setShowExportModal(true);
  }, [exportToTauriConfig, onSave, markClean]);

  // Copy to clipboard
  const copyToClipboard = useCallback(() => {
    const tauriConfig = exportToTauriConfig();
    const jsonString = JSON.stringify(tauriConfig, null, 2);
    navigator.clipboard.writeText(jsonString);
  }, [exportToTauriConfig]);

  if (!isOpen) {
    return null;
  }

  const positionClasses =
    position === "right" ? "right-0 border-l" : "left-0 border-r";

  return (
    <div
      className={[
        "fixed",
        "top-0",
        "bottom-0",
        "z-40",
        "bg-white",
        "shadow-xl",
        "flex",
        "flex-col",
        "border-neutral-200",
        positionClasses,
      ].join(" ")}
      style={{ width }}
      role="dialog"
      aria-label="Window Configuration Panel"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50 shrink-0">
        <div className="flex items-center gap-2">
          <h2 className="text-lg font-semibold text-neutral-900">
            Window Config
          </h2>
          {isDirty && (
            <span className="px-1.5 py-0.5 text-xs font-medium bg-warning-100 text-warning-700 rounded">
              Modified
            </span>
          )}
        </div>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="p-2 rounded-md hover:bg-neutral-200 transition-colors text-neutral-600"
            aria-label="Close panel"
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        )}
      </div>

      {/* Target Selector - Factory vs Canvas App */}
      <div className="px-4 py-3 border-b border-neutral-200 bg-white">
        <div className="flex rounded-lg bg-neutral-100 p-1">
          <button
            type="button"
            onClick={() => setConfigTarget('factory')}
            className={[
              "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              configTarget === 'factory'
                ? "bg-white text-neutral-900 shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            ].join(" ")}
          >
            App Factory
          </button>
          <button
            type="button"
            onClick={() => setConfigTarget('canvas')}
            className={[
              "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
              configTarget === 'canvas'
                ? "bg-primary-500 text-white shadow-sm"
                : "text-neutral-600 hover:text-neutral-900"
            ].join(" ")}
          >
            Canvas App
          </button>
        </div>
        <p className="text-xs text-neutral-500 mt-2 text-center">
          {configTarget === 'factory'
            ? "Changes apply to App Factory window"
            : "Changes apply to the app in the canvas"}
        </p>
      </div>

      {/* Screen Selector - Only show when Canvas App mode is active */}
      {configTarget === 'canvas' && (
        <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50">
          <label className="block text-xs font-medium text-neutral-600 mb-2">
            Configure Window For:
          </label>
          <select
            value={localSelectedScreen ?? 'main'}
            onChange={(e) => handleScreenChange(e.target.value === 'main' ? null : e.target.value)}
            className={[
              "w-full px-3 py-2 text-sm rounded-md border border-neutral-200",
              "bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500",
              "transition-colors"
            ].join(" ")}
          >
            <option value="main">Main App Window</option>
            {screens.map((screen) => (
              <option key={screen.id} value={screen.id}>
                {screen.name} ({screen.type})
                {screen.hasCustomConfig ? ' ★' : ''}
              </option>
            ))}
          </select>
          {localSelectedScreen && screens.find(s => s.id === localSelectedScreen)?.hasCustomConfig && (
            <p className="text-xs text-primary-600 mt-1.5 flex items-center gap-1">
              <span className="inline-block w-2 h-2 bg-primary-500 rounded-full"></span>
              Custom configuration set
            </p>
          )}
          {screens.length === 0 && (
            <p className="text-xs text-neutral-400 mt-1.5 italic">
              No additional screens in project
            </p>
          )}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Presets */}
        <Panel variant="filled" padding="sm" radius="md">
          <PanelHeader title="Quick Presets" />
          <PanelBody className="pt-3">
            <div className="grid grid-cols-2 gap-2">
              {windowPresets.map((preset) => (
                <button
                  key={preset.name}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className={[
                    "p-2",
                    "text-left",
                    "rounded-md",
                    "border",
                    "border-neutral-200",
                    "hover:border-primary-300",
                    "hover:bg-primary-50",
                    "transition-colors",
                  ].join(" ")}
                  title={preset.description}
                >
                  <span className="text-sm font-medium text-neutral-800 block">
                    {preset.name}
                  </span>
                  <span className="text-xs text-neutral-500 line-clamp-1">
                    {preset.description}
                  </span>
                </button>
              ))}
            </div>
          </PanelBody>
        </Panel>

        {/* Window Title */}
        <Panel variant="default" padding="sm" radius="md">
          <PanelHeader title="Basic Settings" />
          <PanelBody className="pt-3 space-y-3">
            <Input
              label="Window Title"
              value={config.title}
              onChange={(e) => setConfig({ title: e.target.value })}
              fullWidth
            />
          </PanelBody>
        </Panel>

        {/* Dimensions */}
        <Panel variant="default" padding="sm" radius="md">
          <PanelHeader title="Dimensions" />
          <PanelBody className="pt-3 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Width"
                type="number"
                value={config.width}
                onChange={(e) => handleNumberChange("width", e.target.value)}
                rightElement={<span className="text-xs text-neutral-400">px</span>}
              />
              <Input
                label="Height"
                type="number"
                value={config.height}
                onChange={(e) => handleNumberChange("height", e.target.value)}
                rightElement={<span className="text-xs text-neutral-400">px</span>}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Min Width"
                type="number"
                value={config.minWidth}
                onChange={(e) => handleNumberChange("minWidth", e.target.value)}
                rightElement={<span className="text-xs text-neutral-400">px</span>}
              />
              <Input
                label="Min Height"
                type="number"
                value={config.minHeight}
                onChange={(e) => handleNumberChange("minHeight", e.target.value)}
                rightElement={<span className="text-xs text-neutral-400">px</span>}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Max Width"
                type="number"
                value={config.maxWidth ?? ""}
                onChange={(e) => handleNumberChange("maxWidth", e.target.value)}
                placeholder="None"
                rightElement={<span className="text-xs text-neutral-400">px</span>}
              />
              <Input
                label="Max Height"
                type="number"
                value={config.maxHeight ?? ""}
                onChange={(e) => handleNumberChange("maxHeight", e.target.value)}
                placeholder="None"
                rightElement={<span className="text-xs text-neutral-400">px</span>}
              />
            </div>
          </PanelBody>
        </Panel>

        {/* Position */}
        <Panel variant="default" padding="sm" radius="md">
          <PanelHeader title="Position" />
          <PanelBody className="pt-3 space-y-3">
            <Checkbox
              label="Center on screen"
              description="Ignore X/Y position and center window"
              checked={config.center}
              onChange={() => handleToggle("center")}
            />
            {!config.center && (
              <div className="grid grid-cols-2 gap-3">
                <Input
                  label="X Position"
                  type="number"
                  value={config.x ?? ""}
                  onChange={(e) => handleNumberChange("x", e.target.value)}
                  placeholder="Auto"
                  rightElement={<span className="text-xs text-neutral-400">px</span>}
                />
                <Input
                  label="Y Position"
                  type="number"
                  value={config.y ?? ""}
                  onChange={(e) => handleNumberChange("y", e.target.value)}
                  placeholder="Auto"
                  rightElement={<span className="text-xs text-neutral-400">px</span>}
                />
              </div>
            )}
          </PanelBody>
        </Panel>

        {/* Window Behavior */}
        <Panel variant="default" padding="sm" radius="md">
          <PanelHeader title="Window Behavior" />
          <PanelBody className="pt-3 space-y-2">
            <Checkbox
              label="Fullscreen"
              description="Launch in fullscreen mode"
              checked={config.fullscreen}
              onChange={() => handleToggle("fullscreen")}
            />
            <Checkbox
              label="Resizable"
              description="Allow user to resize window"
              checked={config.resizable}
              onChange={() => handleToggle("resizable")}
            />
            <Checkbox
              label="Decorations"
              description="Show title bar and window controls"
              checked={config.decorations}
              onChange={() => handleToggle("decorations")}
            />
            <Checkbox
              label="Always on Top"
              description="Keep window above other windows"
              checked={config.alwaysOnTop}
              onChange={() => handleToggle("alwaysOnTop")}
            />
            <Checkbox
              label="Skip Taskbar"
              description="Hide from taskbar/dock"
              checked={config.skipTaskbar}
              onChange={() => handleToggle("skipTaskbar")}
            />
            <Checkbox
              label="Transparent"
              description="Enable transparent background"
              checked={config.transparent}
              onChange={() => handleToggle("transparent")}
            />
          </PanelBody>
        </Panel>

        {/* Window Controls */}
        <Panel variant="default" padding="sm" radius="md">
          <PanelHeader title="Window Controls" />
          <PanelBody className="pt-3 space-y-2">
            <Checkbox
              label="Closable"
              description="Show close button"
              checked={config.closable}
              onChange={() => handleToggle("closable")}
            />
            <Checkbox
              label="Minimizable"
              description="Show minimize button"
              checked={config.minimizable}
              onChange={() => handleToggle("minimizable")}
            />
            <Checkbox
              label="Maximizable"
              description="Show maximize button"
              checked={config.maximizable}
              onChange={() => handleToggle("maximizable")}
            />
          </PanelBody>
        </Panel>

        {/* Other Settings */}
        <Panel variant="default" padding="sm" radius="md">
          <PanelHeader title="Other Settings" />
          <PanelBody className="pt-3 space-y-2">
            <Checkbox
              label="Visible on launch"
              description="Show window immediately"
              checked={config.visible}
              onChange={() => handleToggle("visible")}
            />
            <Checkbox
              label="Focus on launch"
              description="Give focus to window on start"
              checked={config.focus}
              onChange={() => handleToggle("focus")}
            />
            <Checkbox
              label="File drop enabled"
              description="Accept drag-and-drop files"
              checked={config.fileDropEnabled}
              onChange={() => handleToggle("fileDropEnabled")}
            />
          </PanelBody>
        </Panel>

        {/* Preview */}
        <Panel variant="filled" padding="sm" radius="md">
          <PanelHeader title="Configuration Preview" />
          <PanelBody className="pt-3">
            <pre className="text-xs font-mono bg-neutral-900 text-neutral-100 p-3 rounded-md overflow-x-auto max-h-48">
              {JSON.stringify(exportToTauriConfig(), null, 2)}
            </pre>
          </PanelBody>
        </Panel>
      </div>

      {/* Footer */}
      <div className="px-4 py-3 border-t border-neutral-200 bg-neutral-50 shrink-0">
        {configTarget === 'canvas' ? (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={resetToDefaults}
              className="flex-1"
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={() => {
                if (localSelectedScreen && onApplyToScreen) {
                  // Apply to specific screen
                  onApplyToScreen(localSelectedScreen, config);
                } else if (onApplyToCanvas) {
                  // Apply to main app window
                  onApplyToCanvas(config);
                }
              }}
              className="flex-1"
            >
              {localSelectedScreen ? 'Apply to Screen' : 'Apply to Canvas'}
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={resetToDefaults}
              className="flex-1"
            >
              Reset
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={copyToClipboard}
              className="flex-1"
            >
              Copy JSON
            </Button>
            <Button
              variant="primary"
              size="sm"
              onClick={handleExport}
              className="flex-1"
            >
              Export
            </Button>
          </div>
        )}
      </div>

      {/* Export Success Modal */}
      {showExportModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-sm w-full">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-success-100 flex items-center justify-center">
                <svg
                  className="h-6 w-6 text-success-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                >
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-neutral-900">
                  Configuration Exported
                </h3>
                <p className="text-sm text-neutral-600">
                  Copy the JSON to your tauri.conf.json
                </p>
              </div>
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setShowExportModal(false)}
              fullWidth
            >
              Done
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

WindowConfigPanel.displayName = "WindowConfigPanel";

export default WindowConfigPanel;
