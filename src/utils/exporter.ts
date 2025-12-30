/**
 * D080 - src/utils/exporter.ts
 * ============================
 * Project export logic for generating standalone applications.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D075, D076, D077, D078, D079
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *
 * This module provides:
 *   - Project export to standalone Tauri application
 *   - Template rendering for configuration files
 *   - Plugin bundling and packaging
 *   - Build manifest generation
 *   - Export validation and error handling
 */

import { invoke } from "@tauri-apps/api/tauri";
import type { ProjectState, ProjectBuildConfig, ProjectTheme, ProjectScreen, ProjectComponent } from "../stores/projectStore";
import type { Plugin } from "../stores/pluginStore";

// ============================================
// TYPES
// ============================================

/**
 * Export configuration options.
 */
export interface ExportConfig {
  /** Output directory path */
  outputDir: string;
  /** Project name (used for folder/file names) */
  projectName: string;
  /** Build mode */
  mode: "development" | "production";
  /** Target platform */
  platform: "windows" | "macos" | "linux" | "all";
  /** Whether to include Python runtime */
  includePythonRuntime: boolean;
  /** Plugins to bundle */
  bundledPlugins: string[];
  /** Application icon path */
  appIcon: string | null;
  /** Version string */
  version: string;
  /** Publisher/author name */
  publisher: string;
  /** Application identifier (e.g., com.example.app) */
  identifier: string;
  /** Whether to minify output */
  minify: boolean;
  /** Whether to generate source maps */
  sourceMaps: boolean;
  /** Custom environment variables */
  envVariables: Record<string, string>;
}

/**
 * Export manifest containing all generated files.
 */
export interface ExportManifest {
  /** Export timestamp */
  exportedAt: number;
  /** Project name */
  projectName: string;
  /** Version */
  version: string;
  /** Generated files list */
  files: ExportedFile[];
  /** Total size in bytes */
  totalSize: number;
  /** Bundled plugins */
  plugins: string[];
  /** Build configuration used */
  config: ExportConfig;
}

/**
 * Individual exported file info.
 */
export interface ExportedFile {
  /** Relative path from export root */
  path: string;
  /** File size in bytes */
  size: number;
  /** File type category */
  type: "config" | "source" | "asset" | "plugin" | "binary" | "template";
  /** Whether file was generated from template */
  generated: boolean;
}

/**
 * Export validation result.
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error.
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Related field or file */
  field?: string;
}

/**
 * Validation warning.
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Related field or file */
  field?: string;
}

/**
 * Export progress update.
 */
export interface ExportProgress {
  /** Current step number */
  step: number;
  /** Total steps */
  totalSteps: number;
  /** Current step description */
  description: string;
  /** Progress percentage (0-100) */
  percentage: number;
  /** Current file being processed */
  currentFile?: string;
}

/**
 * Export result.
 */
export interface ExportResult {
  /** Whether export succeeded */
  success: boolean;
  /** Export manifest */
  manifest: ExportManifest | null;
  /** Output directory path */
  outputPath: string;
  /** Error message if failed */
  error?: string;
  /** Export duration in ms */
  duration: number;
}

/**
 * Template variable context.
 */
export interface TemplateContext {
  /** Project configuration */
  project: {
    name: string;
    description: string;
    version: string;
    author: string;
    identifier: string;
  };
  /** Build configuration */
  build: ExportConfig;
  /** Theme configuration */
  theme: ProjectTheme;
  /** Screens list */
  screens: ProjectScreen[];
  /** Plugins list */
  plugins: Array<{
    id: string;
    name: string;
    version: string;
    category: string;
  }>;
  /** Environment variables */
  env: Record<string, string>;
  /** Timestamp */
  timestamp: string;
}

// ============================================
// CONSTANTS
// ============================================

/**
 * Default export configuration.
 */
export const DEFAULT_EXPORT_CONFIG: ExportConfig = {
  outputDir: "./dist",
  projectName: "app",
  mode: "production",
  platform: "windows",
  includePythonRuntime: true,
  bundledPlugins: [],
  appIcon: null,
  version: "1.0.0",
  publisher: "",
  identifier: "com.appfactory.app",
  minify: true,
  sourceMaps: false,
  envVariables: {},
};

/**
 * Export steps for progress tracking.
 */
const EXPORT_STEPS = [
  "Validating project",
  "Preparing output directory",
  "Generating configuration files",
  "Processing screens and components",
  "Bundling plugins",
  "Copying assets",
  "Generating launcher scripts",
  "Creating manifest",
  "Finalizing export",
];

// ============================================
// VALIDATION
// ============================================

/**
 * Validate export configuration.
 */
export function validateExportConfig(config: ExportConfig): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Required fields
  if (!config.outputDir || config.outputDir.trim() === "") {
    errors.push({
      code: "MISSING_OUTPUT_DIR",
      message: "Output directory is required",
      field: "outputDir",
    });
  }

  if (!config.projectName || config.projectName.trim() === "") {
    errors.push({
      code: "MISSING_PROJECT_NAME",
      message: "Project name is required",
      field: "projectName",
    });
  } else if (!/^[a-zA-Z][a-zA-Z0-9_-]*$/.test(config.projectName)) {
    errors.push({
      code: "INVALID_PROJECT_NAME",
      message: "Project name must start with a letter and contain only letters, numbers, underscores, and hyphens",
      field: "projectName",
    });
  }

  // Version validation
  if (!config.version || !/^\d+\.\d+\.\d+/.test(config.version)) {
    warnings.push({
      code: "INVALID_VERSION",
      message: "Version should follow semver format (e.g., 1.0.0)",
      field: "version",
    });
  }

  // Identifier validation
  if (!config.identifier || !/^[a-z][a-z0-9]*(\.[a-z][a-z0-9]*)+$/.test(config.identifier)) {
    warnings.push({
      code: "INVALID_IDENTIFIER",
      message: "Identifier should be a valid reverse domain (e.g., com.example.app)",
      field: "identifier",
    });
  }

  // Platform validation
  const validPlatforms = ["windows", "macos", "linux", "all"];
  if (!validPlatforms.includes(config.platform)) {
    errors.push({
      code: "INVALID_PLATFORM",
      message: `Platform must be one of: ${validPlatforms.join(", ")}`,
      field: "platform",
    });
  }

  // Mode validation
  if (!["development", "production"].includes(config.mode)) {
    errors.push({
      code: "INVALID_MODE",
      message: "Mode must be 'development' or 'production'",
      field: "mode",
    });
  }

  // Python runtime warning
  if (!config.includePythonRuntime && config.bundledPlugins.length > 0) {
    warnings.push({
      code: "NO_PYTHON_RUNTIME",
      message: "Plugins require Python runtime to function",
      field: "includePythonRuntime",
    });
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

/**
 * Validate project state for export.
 */
export function validateProjectState(state: Partial<ProjectState>): ValidationResult {
  const errors: ValidationError[] = [];
  const warnings: ValidationWarning[] = [];

  // Check for screens
  const screens = state.screens ? Object.values(state.screens) : [];
  if (screens.length === 0) {
    errors.push({
      code: "NO_SCREENS",
      message: "Project must have at least one screen",
      field: "screens",
    });
  }

  // Check for default screen
  const hasDefaultScreen = screens.some((s) => s.isDefault);
  if (screens.length > 0 && !hasDefaultScreen) {
    warnings.push({
      code: "NO_DEFAULT_SCREEN",
      message: "No default screen set, first screen will be used",
      field: "screens",
    });
  }

  // Check for unbound required slots
  const components = state.components ? Object.values(state.components) : [];
  for (const component of components) {
    for (const slot of component.slots || []) {
      if (slot.required && !slot.pluginId) {
        warnings.push({
          code: "UNBOUND_REQUIRED_SLOT",
          message: `Component "${component.name}" has unbound required slot "${slot.name}"`,
          field: `components.${component.id}.slots.${slot.id}`,
        });
      }
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}

// ============================================
// TEMPLATE RENDERING
// ============================================

/**
 * Simple template renderer.
 * Replaces {{variable}} and {{variable.nested}} patterns.
 */
export function renderTemplate(template: string, context: TemplateContext): string {
  return template.replace(/\{\{([^}]+)\}\}/g, (match, path) => {
    const keys = path.trim().split(".");
    let value: unknown = context;

    for (const key of keys) {
      if (value && typeof value === "object" && key in value) {
        value = (value as Record<string, unknown>)[key];
      } else {
        // Return empty string for undefined values
        return "";
      }
    }

    if (value === null || value === undefined) {
      return "";
    }

    if (typeof value === "object") {
      return JSON.stringify(value);
    }

    return String(value);
  });
}

/**
 * Build template context from project state.
 */
export function buildTemplateContext(
  projectState: Partial<ProjectState>,
  plugins: Record<string, Plugin>,
  config: ExportConfig
): TemplateContext {
  const metadata = projectState.metadata || {
    name: config.projectName,
    description: "",
    version: config.version,
    author: config.publisher,
    createdAt: Date.now(),
    modifiedAt: Date.now(),
    filePath: null,
    tags: [],
  };

  const screens = projectState.screens ? Object.values(projectState.screens) : [];

  const pluginList = config.bundledPlugins
    .map((id) => plugins[id])
    .filter(Boolean)
    .map((p) => ({
      id: p.manifest.id,
      name: p.manifest.name,
      version: p.manifest.version,
      category: p.manifest.category,
    }));

  return {
    project: {
      name: metadata.name,
      description: metadata.description,
      version: config.version,
      author: config.publisher || metadata.author,
      identifier: config.identifier,
    },
    build: config,
    theme: projectState.theme || {
      name: "Default",
      primaryColor: "#3b82f6",
      secondaryColor: "#64748b",
      accentColor: "#8b5cf6",
      backgroundColor: "#ffffff",
      textColor: "#0f172a",
      borderRadius: "md",
      fontFamily: "system-ui, -apple-system, sans-serif",
      darkMode: false,
      customVariables: {},
    },
    screens,
    plugins: pluginList,
    env: config.envVariables,
    timestamp: new Date().toISOString(),
  };
}

// ============================================
// FILE GENERATION
// ============================================

/**
 * Generate Tauri configuration from template context.
 */
export function generateTauriConfig(context: TemplateContext): string {
  const config = {
    $schema: "https://raw.githubusercontent.com/tauri-apps/tauri/v1/core/tauri-config-schema/schema.json",
    build: {
      beforeBuildCommand: "npm run build",
      beforeDevCommand: "npm run dev",
      devPath: "http://localhost:5173",
      distDir: "../dist",
    },
    package: {
      productName: context.project.name,
      version: context.project.version,
    },
    tauri: {
      allowlist: {
        all: false,
        shell: {
          all: false,
          open: true,
          sidecar: true,
          scope: [
            {
              name: "plugin_host",
              sidecar: true,
            },
          ],
        },
        fs: {
          all: false,
          readFile: true,
          writeFile: true,
          readDir: true,
          createDir: true,
          removeDir: true,
          removeFile: true,
          renameFile: true,
          exists: true,
          scope: ["$APP/*", "$RESOURCE/*"],
        },
        path: {
          all: true,
        },
        dialog: {
          all: true,
        },
        process: {
          all: false,
          exit: true,
          relaunch: true,
        },
      },
      bundle: {
        active: true,
        category: "DeveloperTool",
        copyright: `Copyright ${new Date().getFullYear()} ${context.project.author}`,
        externalBin: ["binaries/plugin_host"],
        icon: [
          "icons/32x32.png",
          "icons/128x128.png",
          "icons/128x128@2x.png",
          "icons/icon.icns",
          "icons/icon.ico",
        ],
        identifier: context.project.identifier,
        longDescription: context.project.description,
        resources: ["plugins/*", "config/*"],
        shortDescription: context.project.description.slice(0, 100),
        targets: context.build.platform === "all" ? null : [context.build.platform === "windows" ? "msi" : "dmg"],
        windows: {
          certificateThumbprint: null,
          digestAlgorithm: "sha256",
          timestampUrl: "",
        },
      },
      security: {
        csp: "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'",
      },
      windows: [
        {
          fullscreen: false,
          height: 720,
          width: 1280,
          resizable: true,
          title: context.project.name,
          center: true,
          decorations: true,
        },
      ],
    },
  };

  return JSON.stringify(config, null, 2);
}

/**
 * Generate plugins.yaml configuration.
 */
export function generatePluginsConfig(context: TemplateContext): string {
  const lines: string[] = [
    "# Plugin Configuration",
    `# Generated: ${context.timestamp}`,
    `# Project: ${context.project.name}`,
    "",
    "# Plugin discovery paths",
    "discovery:",
    "  paths:",
    "    - ./plugins",
    "    - $HOME/.appfactory/plugins",
    "",
    "# Active plugins",
    "plugins:",
  ];

  for (const plugin of context.plugins) {
    lines.push(`  - id: ${plugin.id}`);
    lines.push(`    name: ${plugin.name}`);
    lines.push(`    version: ${plugin.version}`);
    lines.push(`    category: ${plugin.category}`);
    lines.push(`    enabled: true`);
    lines.push("");
  }

  if (context.plugins.length === 0) {
    lines.push("  # No plugins bundled");
  }

  lines.push("");
  lines.push("# Health monitoring");
  lines.push("health:");
  lines.push("  enabled: true");
  lines.push("  interval: 30000  # ms");
  lines.push("  timeout: 5000    # ms");
  lines.push("  maxFailures: 3");

  return lines.join("\n");
}

/**
 * Generate Windows launcher batch script.
 */
export function generateWindowsLauncher(context: TemplateContext): string {
  const lines: string[] = [
    "@echo off",
    `REM ${context.project.name} Launcher`,
    `REM Generated: ${context.timestamp}`,
    "",
    "REM Set application root",
    "set APP_ROOT=%~dp0",
    "",
    "REM Set environment variables",
  ];

  // Add custom environment variables
  for (const [key, value] of Object.entries(context.env)) {
    lines.push(`set ${key}=${value}`);
  }

  lines.push("");
  lines.push("REM Python path (if bundled)");
  if (context.build.includePythonRuntime) {
    lines.push('set PYTHON_PATH=%APP_ROOT%python\\python.exe');
    lines.push('set PATH=%APP_ROOT%python;%PATH%');
  } else {
    lines.push("REM Python runtime not bundled - using system Python");
  }

  lines.push("");
  lines.push("REM Plugin path");
  lines.push('set PLUGIN_PATH=%APP_ROOT%plugins');
  lines.push("");
  lines.push("REM Launch application");
  lines.push(`echo Starting ${context.project.name}...`);
  lines.push(`start "" "%APP_ROOT%${context.project.name}.exe"`);
  lines.push("");
  lines.push("exit /b 0");

  return lines.join("\r\n");
}

/**
 * Generate environment file template.
 */
export function generateEnvFile(context: TemplateContext): string {
  const lines: string[] = [
    `# ${context.project.name} Environment Configuration`,
    `# Generated: ${context.timestamp}`,
    "",
    "# Application",
    `APP_NAME=${context.project.name}`,
    `APP_VERSION=${context.project.version}`,
    `APP_ENV=${context.build.mode}`,
    "",
    "# Paths",
    "PLUGIN_DIR=./plugins",
    "CONFIG_DIR=./config",
    "DATA_DIR=./data",
    "LOG_DIR=./logs",
    "",
    "# Plugin Host",
    "PLUGIN_HOST_LOG_LEVEL=info",
    "PLUGIN_HOST_TIMEOUT=30000",
    "",
    "# IPC Settings",
    "IPC_BUFFER_SIZE=65536",
    "IPC_HEALTH_INTERVAL=30000",
    "",
  ];

  // Add custom environment variables
  if (Object.keys(context.env).length > 0) {
    lines.push("# Custom Variables");
    for (const [key, value] of Object.entries(context.env)) {
      lines.push(`${key}=${value}`);
    }
    lines.push("");
  }

  lines.push("# Add your custom environment variables below");
  lines.push("# KEY=value");

  return lines.join("\n");
}

// ============================================
// EXPORT FUNCTIONS
// ============================================

/**
 * Export project to standalone application.
 *
 * @param projectState - Current project state
 * @param plugins - Available plugins
 * @param config - Export configuration
 * @param onProgress - Progress callback
 * @returns Export result
 */
export async function exportProject(
  projectState: Partial<ProjectState>,
  plugins: Record<string, Plugin>,
  config: Partial<ExportConfig> = {},
  onProgress?: (progress: ExportProgress) => void
): Promise<ExportResult> {
  const startTime = Date.now();
  const exportConfig: ExportConfig = { ...DEFAULT_EXPORT_CONFIG, ...config };
  const exportedFiles: ExportedFile[] = [];

  // Report progress helper
  const reportProgress = (step: number, currentFile?: string) => {
    if (onProgress) {
      onProgress({
        step,
        totalSteps: EXPORT_STEPS.length,
        description: EXPORT_STEPS[step - 1] || "Processing...",
        percentage: Math.round((step / EXPORT_STEPS.length) * 100),
        currentFile,
      });
    }
  };

  try {
    // Step 1: Validate project
    reportProgress(1);
    const configValidation = validateExportConfig(exportConfig);
    if (!configValidation.valid) {
      return {
        success: false,
        manifest: null,
        outputPath: exportConfig.outputDir,
        error: configValidation.errors.map((e) => e.message).join("; "),
        duration: Date.now() - startTime,
      };
    }

    const projectValidation = validateProjectState(projectState);
    if (!projectValidation.valid) {
      return {
        success: false,
        manifest: null,
        outputPath: exportConfig.outputDir,
        error: projectValidation.errors.map((e) => e.message).join("; "),
        duration: Date.now() - startTime,
      };
    }

    // Step 2: Prepare output directory
    reportProgress(2);
    await invoke("export_prepare_dir", {
      path: exportConfig.outputDir,
      projectName: exportConfig.projectName,
    });

    // Step 3: Generate configuration files
    reportProgress(3);
    const context = buildTemplateContext(projectState, plugins, exportConfig);

    // Generate tauri.conf.json
    const tauriConfig = generateTauriConfig(context);
    await invoke("export_write_file", {
      basePath: exportConfig.outputDir,
      relativePath: "src-tauri/tauri.conf.json",
      content: tauriConfig,
    });
    exportedFiles.push({
      path: "src-tauri/tauri.conf.json",
      size: new Blob([tauriConfig]).size,
      type: "config",
      generated: true,
    });

    // Generate plugins.yaml
    reportProgress(3, "plugins.yaml");
    const pluginsConfig = generatePluginsConfig(context);
    await invoke("export_write_file", {
      basePath: exportConfig.outputDir,
      relativePath: "config/plugins.yaml",
      content: pluginsConfig,
    });
    exportedFiles.push({
      path: "config/plugins.yaml",
      size: new Blob([pluginsConfig]).size,
      type: "config",
      generated: true,
    });

    // Step 4: Process screens and components
    reportProgress(4);
    const screensData = JSON.stringify({
      screens: projectState.screens || {},
      components: projectState.components || {},
      theme: projectState.theme,
    }, null, 2);
    await invoke("export_write_file", {
      basePath: exportConfig.outputDir,
      relativePath: "config/project.json",
      content: screensData,
    });
    exportedFiles.push({
      path: "config/project.json",
      size: new Blob([screensData]).size,
      type: "config",
      generated: true,
    });

    // Step 5: Bundle plugins
    reportProgress(5);
    for (const pluginId of exportConfig.bundledPlugins) {
      reportProgress(5, pluginId);
      const plugin = plugins[pluginId];
      if (plugin) {
        await invoke("export_copy_plugin", {
          sourcePath: plugin.path,
          destPath: `${exportConfig.outputDir}/plugins/${pluginId}`,
        });
        exportedFiles.push({
          path: `plugins/${pluginId}`,
          size: 0, // Size determined by backend
          type: "plugin",
          generated: false,
        });
      }
    }

    // Step 6: Copy assets
    reportProgress(6);
    if (exportConfig.appIcon) {
      await invoke("export_copy_asset", {
        sourcePath: exportConfig.appIcon,
        destPath: `${exportConfig.outputDir}/icons`,
      });
    }

    // Step 7: Generate launcher scripts
    reportProgress(7);
    const launcherScript = generateWindowsLauncher(context);
    await invoke("export_write_file", {
      basePath: exportConfig.outputDir,
      relativePath: `start.bat`,
      content: launcherScript,
    });
    exportedFiles.push({
      path: "start.bat",
      size: new Blob([launcherScript]).size,
      type: "template",
      generated: true,
    });

    // Generate .env file
    const envFile = generateEnvFile(context);
    await invoke("export_write_file", {
      basePath: exportConfig.outputDir,
      relativePath: ".env",
      content: envFile,
    });
    exportedFiles.push({
      path: ".env",
      size: new Blob([envFile]).size,
      type: "config",
      generated: true,
    });

    // Step 8: Create manifest
    reportProgress(8);
    const totalSize = exportedFiles.reduce((sum, f) => sum + f.size, 0);
    const manifest: ExportManifest = {
      exportedAt: Date.now(),
      projectName: exportConfig.projectName,
      version: exportConfig.version,
      files: exportedFiles,
      totalSize,
      plugins: exportConfig.bundledPlugins,
      config: exportConfig,
    };

    const manifestJson = JSON.stringify(manifest, null, 2);
    await invoke("export_write_file", {
      basePath: exportConfig.outputDir,
      relativePath: "export-manifest.json",
      content: manifestJson,
    });

    // Step 9: Finalize
    reportProgress(9);

    return {
      success: true,
      manifest,
      outputPath: exportConfig.outputDir,
      duration: Date.now() - startTime,
    };
  } catch (err) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    return {
      success: false,
      manifest: null,
      outputPath: exportConfig.outputDir,
      error: errorMsg,
      duration: Date.now() - startTime,
    };
  }
}

/**
 * Estimate export size in bytes.
 */
export function estimateExportSize(
  projectState: Partial<ProjectState>,
  plugins: Record<string, Plugin>,
  config: Partial<ExportConfig>
): number {
  let estimatedSize = 0;

  // Base application size (approximately 50MB for Tauri)
  estimatedSize += 50 * 1024 * 1024;

  // Python runtime if included (approximately 100MB)
  if (config.includePythonRuntime !== false) {
    estimatedSize += 100 * 1024 * 1024;
  }

  // Plugin estimates (approximately 5MB each)
  const bundledPlugins = config.bundledPlugins || [];
  estimatedSize += bundledPlugins.length * 5 * 1024 * 1024;

  // Project data (screens, components) - rough estimate
  const screensCount = projectState.screens ? Object.keys(projectState.screens).length : 0;
  const componentsCount = projectState.components ? Object.keys(projectState.components).length : 0;
  estimatedSize += (screensCount + componentsCount) * 10 * 1024;

  return estimatedSize;
}

/**
 * Format byte size to human-readable string.
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return "0 B";

  const units = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const size = bytes / Math.pow(1024, i);

  return `${size.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

/**
 * Get export progress percentage from step.
 */
export function getProgressPercentage(step: number): number {
  return Math.min(100, Math.round((step / EXPORT_STEPS.length) * 100));
}

/**
 * Get export step description.
 */
export function getStepDescription(step: number): string {
  return EXPORT_STEPS[step - 1] || "Processing...";
}

export default {
  exportProject,
  validateExportConfig,
  validateProjectState,
  estimateExportSize,
  formatFileSize,
  generateTauriConfig,
  generatePluginsConfig,
  generateWindowsLauncher,
  generateEnvFile,
  renderTemplate,
  buildTemplateContext,
  DEFAULT_EXPORT_CONFIG,
};
