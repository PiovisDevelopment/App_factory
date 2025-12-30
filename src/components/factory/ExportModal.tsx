/**
 * D047 - src/components/factory/ExportModal.tsx
 * ===============================================
 * Export configuration modal for project export settings.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D015 (Modal.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { forwardRef, useState, useCallback, type HTMLAttributes } from "react";

/**
 * Export format options.
 */
export type ExportFormat = "tauri" | "electron" | "web" | "react-native";

/**
 * Build target options.
 */
export type BuildTarget = "windows" | "macos" | "linux" | "all";

/**
 * Export configuration.
 */
export interface ExportConfig {
  /** Export format */
  format: ExportFormat;
  /** Build targets */
  targets: BuildTarget[];
  /** Output directory */
  outputDir: string;
  /** Project name */
  projectName: string;
  /** Version string */
  version: string;
  /** Include plugins */
  includePlugins: boolean;
  /** Plugin IDs to include */
  selectedPlugins: string[];
  /** Bundle Python runtime */
  bundlePython: boolean;
  /** Enable code signing */
  codeSign: boolean;
  /** Create installer */
  createInstaller: boolean;
  /** Installer type */
  installerType?: "msi" | "exe" | "dmg" | "deb" | "appimage";
  /** Minify code */
  minify: boolean;
  /** Source maps */
  sourceMaps: boolean;
  /** Environment */
  environment: "development" | "production";
}

/**
 * Available plugin info for selection.
 */
export interface AvailablePlugin {
  id: string;
  name: string;
  required?: boolean;
}

/**
 * ExportModal component props.
 */
export interface ExportModalProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  /** Whether modal is open */
  isOpen: boolean;
  /** Callback to close modal */
  onClose: () => void;
  /** Callback when export is triggered */
  onExport: (config: ExportConfig) => void;
  /** Initial configuration */
  initialConfig?: Partial<ExportConfig>;
  /** Available plugins for selection */
  availablePlugins?: AvailablePlugin[];
  /** Whether export is in progress */
  isExporting?: boolean;
  /** Export progress (0-100) */
  progress?: number;
  /** Export status message */
  statusMessage?: string;
}

/**
 * Close icon.
 */
const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Folder icon.
 */
const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

/**
 * Export icon.
 */
const ExportIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
);

/**
 * Format descriptions.
 */
const formatDescriptions: Record<ExportFormat, { label: string; description: string }> = {
  tauri: {
    label: "Tauri",
    description: "Native desktop app with Rust backend (recommended)",
  },
  electron: {
    label: "Electron",
    description: "Cross-platform desktop using Node.js",
  },
  web: {
    label: "Web App",
    description: "Progressive Web App for browsers",
  },
  "react-native": {
    label: "React Native",
    description: "Mobile app for iOS and Android",
  },
};

/**
 * Target labels.
 */
const targetLabels: Record<BuildTarget, string> = {
  windows: "Windows",
  macos: "macOS",
  linux: "Linux",
  all: "All Platforms",
};

/**
 * Default export configuration.
 */
const defaultConfig: ExportConfig = {
  format: "tauri",
  targets: ["windows"],
  outputDir: "./dist",
  projectName: "my-app",
  version: "1.0.0",
  includePlugins: true,
  selectedPlugins: [],
  bundlePython: true,
  codeSign: false,
  createInstaller: true,
  installerType: "msi",
  minify: true,
  sourceMaps: false,
  environment: "production",
};

/**
 * ExportModal component.
 *
 * A modal dialog for configuring project export settings including
 * format, targets, plugins, and build options.
 *
 * @example
 * ```tsx
 * <ExportModal
 *   isOpen={showExport}
 *   onClose={() => setShowExport(false)}
 *   onExport={(config) => exportProject(config)}
 *   availablePlugins={plugins}
 * />
 * ```
 */
export const ExportModal = forwardRef<HTMLDivElement, ExportModalProps>(
  (
    {
      isOpen,
      onClose,
      onExport,
      initialConfig,
      availablePlugins = [],
      isExporting = false,
      progress = 0,
      statusMessage,
      className = "",
      ...props
    },
    ref
  ) => {
    // State
    const [config, setConfig] = useState<ExportConfig>({
      ...defaultConfig,
      ...initialConfig,
    });
    const [activeTab, setActiveTab] = useState<"general" | "plugins" | "build">("general");

    // Update config
    const updateConfig = useCallback(<K extends keyof ExportConfig>(key: K, value: ExportConfig[K]) => {
      setConfig((prev) => ({ ...prev, [key]: value }));
    }, []);

    // Toggle target
    const toggleTarget = useCallback((target: BuildTarget) => {
      setConfig((prev) => {
        if (target === "all") {
          return { ...prev, targets: ["all"] };
        }
        const newTargets = prev.targets.filter((t) => t !== "all");
        if (newTargets.includes(target)) {
          return { ...prev, targets: newTargets.filter((t) => t !== target) };
        }
        return { ...prev, targets: [...newTargets, target] };
      });
    }, []);

    // Toggle plugin
    const togglePlugin = useCallback((pluginId: string) => {
      setConfig((prev) => {
        if (prev.selectedPlugins.includes(pluginId)) {
          return { ...prev, selectedPlugins: prev.selectedPlugins.filter((id) => id !== pluginId) };
        }
        return { ...prev, selectedPlugins: [...prev.selectedPlugins, pluginId] };
      });
    }, []);

    // Handle export
    const handleExport = useCallback(() => {
      onExport(config);
    }, [config, onExport]);

    // Handle close
    const handleClose = useCallback(() => {
      if (!isExporting) {
        onClose();
      }
    }, [isExporting, onClose]);

    if (!isOpen) return null;

    // Tab button styles
    const tabStyles = (isActive: boolean) =>
      [
        "px-4",
        "py-2",
        "text-sm",
        "font-medium",
        "border-b-2",
        "transition-colors",
        "duration-150",
        isActive
          ? "border-primary-500 text-primary-600"
          : "border-transparent text-neutral-500 hover:text-neutral-700 hover:border-neutral-300",
      ].join(" ");

    // Input styles
    const inputStyles = [
      "w-full",
      "px-3",
      "py-2",
      "text-sm",
      "bg-white",
      "border",
      "border-neutral-200",
      "rounded-md",
      "focus:outline-none",
      "focus:ring-2",
      "focus:ring-primary-500",
      "focus:border-transparent",
    ].join(" ");

    return (
      <div
        ref={ref}
        className={[
          "fixed",
          "inset-0",
          "z-modal",
          "flex",
          "items-center",
          "justify-center",
          "p-4",
          className,
        ].join(" ")}
        {...props}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-neutral-900/50"
          onClick={handleClose}
          aria-hidden="true"
        />

        {/* Modal */}
        <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
            <div className="flex items-center gap-3">
              <ExportIcon className="h-5 w-5 text-primary-500" />
              <h2 className="text-lg font-semibold text-neutral-900">Export Project</h2>
            </div>
            <button
              type="button"
              onClick={handleClose}
              disabled={isExporting}
              className={[
                "p-1.5",
                "rounded-md",
                "text-neutral-400",
                "hover:text-neutral-600",
                "hover:bg-neutral-100",
                "transition-colors",
                "duration-150",
                isExporting && "opacity-50 cursor-not-allowed",
              ].join(" ")}
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex border-b border-neutral-200 px-6">
            <button
              type="button"
              onClick={() => setActiveTab("general")}
              className={tabStyles(activeTab === "general")}
            >
              General
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("plugins")}
              className={tabStyles(activeTab === "plugins")}
            >
              Plugins
            </button>
            <button
              type="button"
              onClick={() => setActiveTab("build")}
              className={tabStyles(activeTab === "build")}
            >
              Build Options
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-6">
            {/* General Tab */}
            {activeTab === "general" && (
              <div className="space-y-6">
                {/* Project Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Project Name
                    </label>
                    <input
                      type="text"
                      value={config.projectName}
                      onChange={(e) => updateConfig("projectName", e.target.value)}
                      className={inputStyles}
                      disabled={isExporting}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                      Version
                    </label>
                    <input
                      type="text"
                      value={config.version}
                      onChange={(e) => updateConfig("version", e.target.value)}
                      placeholder="1.0.0"
                      className={inputStyles}
                      disabled={isExporting}
                    />
                  </div>
                </div>

                {/* Output Directory */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-1">
                    Output Directory
                  </label>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={config.outputDir}
                      onChange={(e) => updateConfig("outputDir", e.target.value)}
                      className={[inputStyles, "flex-1"].join(" ")}
                      disabled={isExporting}
                    />
                    <button
                      type="button"
                      className={[
                        "px-3",
                        "py-2",
                        "border",
                        "border-neutral-200",
                        "rounded-md",
                        "text-neutral-600",
                        "hover:bg-neutral-50",
                        "transition-colors",
                        "duration-150",
                      ].join(" ")}
                      disabled={isExporting}
                    >
                      <FolderIcon className="h-5 w-5" />
                    </button>
                  </div>
                </div>

                {/* Export Format */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Export Format
                  </label>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.keys(formatDescriptions) as ExportFormat[]).map((format) => (
                      <button
                        key={format}
                        type="button"
                        onClick={() => updateConfig("format", format)}
                        disabled={isExporting}
                        className={[
                          "flex",
                          "flex-col",
                          "items-start",
                          "p-3",
                          "border-2",
                          "rounded-lg",
                          "text-left",
                          "transition-all",
                          "duration-150",
                          config.format === format
                            ? "border-primary-500 bg-primary-50"
                            : "border-neutral-200 hover:border-neutral-300",
                          isExporting && "opacity-50 cursor-not-allowed",
                        ].join(" ")}
                      >
                        <span className="text-sm font-medium text-neutral-900">
                          {formatDescriptions[format].label}
                        </span>
                        <span className="text-xs text-neutral-500 mt-0.5">
                          {formatDescriptions[format].description}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Build Targets */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Build Targets
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {(Object.keys(targetLabels) as BuildTarget[]).map((target) => (
                      <button
                        key={target}
                        type="button"
                        onClick={() => toggleTarget(target)}
                        disabled={isExporting}
                        className={[
                          "px-3",
                          "py-1.5",
                          "text-sm",
                          "font-medium",
                          "rounded-full",
                          "border",
                          "transition-colors",
                          "duration-150",
                          config.targets.includes(target)
                            ? "bg-primary-100 border-primary-300 text-primary-700"
                            : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                          isExporting && "opacity-50 cursor-not-allowed",
                        ].join(" ")}
                      >
                        {targetLabels[target]}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Plugins Tab */}
            {activeTab === "plugins" && (
              <div className="space-y-4">
                {/* Include plugins toggle */}
                <label className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    checked={config.includePlugins}
                    onChange={(e) => updateConfig("includePlugins", e.target.checked)}
                    disabled={isExporting}
                    className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-neutral-900">Include Plugins</span>
                    <p className="text-xs text-neutral-500">Bundle selected plugins with export</p>
                  </div>
                </label>

                {/* Plugin selection */}
                {config.includePlugins && (
                  <div className="space-y-2">
                    <label className="block text-sm font-medium text-neutral-700">
                      Select Plugins
                    </label>
                    {availablePlugins.length === 0 ? (
                      <p className="text-sm text-neutral-500 italic">No plugins available</p>
                    ) : (
                      <div className="border border-neutral-200 rounded-lg divide-y divide-neutral-100">
                        {availablePlugins.map((plugin) => (
                          <label
                            key={plugin.id}
                            className={[
                              "flex",
                              "items-center",
                              "gap-3",
                              "p-3",
                              "cursor-pointer",
                              "hover:bg-neutral-50",
                              plugin.required && "bg-neutral-50",
                            ].join(" ")}
                          >
                            <input
                              type="checkbox"
                              checked={config.selectedPlugins.includes(plugin.id) || plugin.required}
                              onChange={() => !plugin.required && togglePlugin(plugin.id)}
                              disabled={isExporting || plugin.required}
                              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                            />
                            <span className="text-sm text-neutral-900">{plugin.name}</span>
                            {plugin.required && (
                              <span className="px-1.5 py-0.5 text-xs bg-neutral-200 text-neutral-600 rounded">
                                Required
                              </span>
                            )}
                          </label>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Bundle Python */}
                <label className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-50">
                  <input
                    type="checkbox"
                    checked={config.bundlePython}
                    onChange={(e) => updateConfig("bundlePython", e.target.checked)}
                    disabled={isExporting}
                    className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <div>
                    <span className="text-sm font-medium text-neutral-900">Bundle Python Runtime</span>
                    <p className="text-xs text-neutral-500">
                      Include Python interpreter (increases bundle size)
                    </p>
                  </div>
                </label>
              </div>
            )}

            {/* Build Options Tab */}
            {activeTab === "build" && (
              <div className="space-y-4">
                {/* Environment */}
                <div>
                  <label className="block text-sm font-medium text-neutral-700 mb-2">
                    Environment
                  </label>
                  <div className="flex gap-3">
                    {(["development", "production"] as const).map((env) => (
                      <button
                        key={env}
                        type="button"
                        onClick={() => updateConfig("environment", env)}
                        disabled={isExporting}
                        className={[
                          "flex-1",
                          "px-4",
                          "py-2",
                          "text-sm",
                          "font-medium",
                          "rounded-lg",
                          "border-2",
                          "transition-colors",
                          "duration-150",
                          config.environment === env
                            ? "border-primary-500 bg-primary-50 text-primary-700"
                            : "border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                        ].join(" ")}
                      >
                        {env.charAt(0).toUpperCase() + env.slice(1)}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Build options */}
                <div className="space-y-3">
                  <label className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-50">
                    <input
                      type="checkbox"
                      checked={config.minify}
                      onChange={(e) => updateConfig("minify", e.target.checked)}
                      disabled={isExporting}
                      className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-neutral-900">Minify Code</span>
                      <p className="text-xs text-neutral-500">Reduce bundle size by minifying</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-50">
                    <input
                      type="checkbox"
                      checked={config.sourceMaps}
                      onChange={(e) => updateConfig("sourceMaps", e.target.checked)}
                      disabled={isExporting}
                      className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-neutral-900">Source Maps</span>
                      <p className="text-xs text-neutral-500">Generate source maps for debugging</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-50">
                    <input
                      type="checkbox"
                      checked={config.codeSign}
                      onChange={(e) => updateConfig("codeSign", e.target.checked)}
                      disabled={isExporting}
                      className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-neutral-900">Code Signing</span>
                      <p className="text-xs text-neutral-500">Sign executable (requires certificate)</p>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 border border-neutral-200 rounded-lg cursor-pointer hover:bg-neutral-50">
                    <input
                      type="checkbox"
                      checked={config.createInstaller}
                      onChange={(e) => updateConfig("createInstaller", e.target.checked)}
                      disabled={isExporting}
                      className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                    />
                    <div>
                      <span className="text-sm font-medium text-neutral-900">Create Installer</span>
                      <p className="text-xs text-neutral-500">Generate platform-specific installer</p>
                    </div>
                  </label>
                </div>
              </div>
            )}
          </div>

          {/* Progress bar (when exporting) */}
          {isExporting && (
            <div className="px-6 py-3 bg-neutral-50 border-t border-neutral-200">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-neutral-700">Exporting...</span>
                <span className="text-sm text-neutral-500">{progress}%</span>
              </div>
              <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary-500 transition-all duration-300"
                  style={{ width: `${progress}%` }}
                />
              </div>
              {statusMessage && (
                <p className="text-xs text-neutral-500 mt-1">{statusMessage}</p>
              )}
            </div>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-3 px-6 py-4 bg-neutral-50 border-t border-neutral-200">
            <button
              type="button"
              onClick={handleClose}
              disabled={isExporting}
              className={[
                "px-4",
                "py-2",
                "text-sm",
                "font-medium",
                "text-neutral-700",
                "bg-white",
                "border",
                "border-neutral-200",
                "rounded-lg",
                "hover:bg-neutral-50",
                "transition-colors",
                "duration-150",
                isExporting && "opacity-50 cursor-not-allowed",
              ].join(" ")}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleExport}
              disabled={isExporting || config.targets.length === 0}
              className={[
                "flex",
                "items-center",
                "gap-2",
                "px-4",
                "py-2",
                "text-sm",
                "font-medium",
                "text-white",
                "bg-primary-600",
                "rounded-lg",
                "hover:bg-primary-700",
                "transition-colors",
                "duration-150",
                (isExporting || config.targets.length === 0) && "opacity-50 cursor-not-allowed",
              ].join(" ")}
            >
              {isExporting ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  <span>Exporting...</span>
                </>
              ) : (
                <>
                  <ExportIcon className="h-4 w-4" />
                  <span>Export</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }
);

ExportModal.displayName = "ExportModal";

export default ExportModal;
