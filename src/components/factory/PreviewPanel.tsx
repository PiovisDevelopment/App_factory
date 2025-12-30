/**
 * D044 - src/components/factory/PreviewPanel.tsx
 * ================================================
 * Live preview panel for displaying component/screen previews.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { forwardRef, useState, useCallback, type HTMLAttributes, type ReactNode } from "react";

/**
 * Preview device types.
 */
export type DeviceType = "desktop" | "tablet" | "mobile" | "custom";

/**
 * Preview orientation.
 */
export type Orientation = "portrait" | "landscape";

/**
 * Preview theme mode.
 */
export type ThemeMode = "light" | "dark" | "system";

/**
 * Device preset configurations.
 */
export interface DevicePreset {
  /** Device name */
  name: string;
  /** Width in pixels */
  width: number;
  /** Height in pixels */
  height: number;
  /** Device type */
  type: DeviceType;
}

/**
 * Built-in device presets.
 */
const devicePresets: DevicePreset[] = [
  { name: "Desktop", width: 1920, height: 1080, type: "desktop" },
  { name: "Laptop", width: 1366, height: 768, type: "desktop" },
  { name: "iPad Pro", width: 1024, height: 1366, type: "tablet" },
  { name: "iPad", width: 768, height: 1024, type: "tablet" },
  { name: "iPhone 14 Pro", width: 393, height: 852, type: "mobile" },
  { name: "iPhone SE", width: 375, height: 667, type: "mobile" },
];

/**
 * PreviewPanel component props.
 */
import { LivePreview } from "./LivePreview";

export interface PreviewPanelProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Content to preview (direct children) */
  children?: ReactNode;
  /** Screen ID to preview (using LivePreview) */
  screenId?: string;
  /** Initial device preset index */
  initialDevice?: number;
  /** Initial zoom level (0.25 - 2) */
  initialZoom?: number;
  /** Initial theme mode */
  initialTheme?: ThemeMode;
  /** Initial orientation */
  initialOrientation?: Orientation;
  /** Whether to show device selector */
  showDeviceSelector?: boolean;
  /** Whether to show zoom controls */
  showZoomControls?: boolean;
  /** Whether to show theme toggle */
  showThemeToggle?: boolean;
  /** Whether to show orientation toggle */
  showOrientationToggle?: boolean;
  /** Whether to show refresh button */
  showRefresh?: boolean;
  /** Whether to show fullscreen button */
  showFullscreen?: boolean;
  /** Custom device presets */
  customPresets?: DevicePreset[];
  /** Callback when zoom changes */
  onZoomChange?: (zoom: number) => void;
  /** Callback when device changes */
  onDeviceChange?: (device: DevicePreset) => void;
  /** Callback when theme changes */
  onThemeChange?: (theme: ThemeMode) => void;
  /** Callback when refresh is requested */
  onRefresh?: () => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Loading state */
  isLoading?: boolean;
}

/**
 * Zoom in icon.
 */
const ZoomInIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="11" y1="8" x2="11" y2="14" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

/**
 * Zoom out icon.
 */
const ZoomOutIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
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
    <polyline points="23 4 23 10 17 10" />
    <polyline points="1 20 1 14 7 14" />
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
  </svg>
);

/**
 * Fullscreen icon.
 */
const FullscreenIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <polyline points="15 3 21 3 21 9" />
    <polyline points="9 21 3 21 3 15" />
    <line x1="21" y1="3" x2="14" y2="10" />
    <line x1="3" y1="21" x2="10" y2="14" />
  </svg>
);

/**
 * Sun icon (light mode).
 */
const SunIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <circle cx="12" cy="12" r="5" />
    <line x1="12" y1="1" x2="12" y2="3" />
    <line x1="12" y1="21" x2="12" y2="23" />
    <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
    <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
    <line x1="1" y1="12" x2="3" y2="12" />
    <line x1="21" y1="12" x2="23" y2="12" />
    <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
    <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
  </svg>
);

/**
 * Moon icon (dark mode).
 */
const MoonIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
  </svg>
);

/**
 * Rotate icon.
 */
const RotateIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
    <path d="M9 9h6v6" />
    <path d="M15 9l-6 6" />
  </svg>
);

/**
 * Device type icons.
 */
const deviceTypeIcons: Record<DeviceType, React.FC<{ className?: string }>> = {
  desktop: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  tablet: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  mobile: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
      <line x1="12" y1="18" x2="12.01" y2="18" />
    </svg>
  ),
  custom: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  ),
};

/**
 * Empty state icon.
 */
const EmptyIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

/**
 * PreviewPanel component.
 *
 * A live preview panel for displaying component/screen previews
 * with device simulation, zoom controls, and theme switching.
 *
 * @example
 * ```tsx
 * <PreviewPanel
 *   showDeviceSelector
 *   showZoomControls
 *   showThemeToggle
 *   initialDevice={0}
 *   initialZoom={1}
 * >
 *   <MyComponent />
 * </PreviewPanel>
 * ```
 */
export const PreviewPanel = forwardRef<HTMLDivElement, PreviewPanelProps>(
  (
    {
      children,
      screenId,
      initialDevice = 0,
      initialZoom = 1,
      initialTheme = "light",
      initialOrientation = "portrait",
      showDeviceSelector = true,
      showZoomControls = true,
      showThemeToggle = true,
      showOrientationToggle = true,
      showRefresh = true,
      showFullscreen = false,
      customPresets,
      onZoomChange,
      onDeviceChange,
      onThemeChange,
      onRefresh,
      emptyMessage = "No preview available",
      isLoading = false,
      className = "",
      ...props
    },
    ref
  ) => {
    // State
    const [currentDeviceIndex, setCurrentDeviceIndex] = useState(initialDevice);
    const [zoom, setZoom] = useState(initialZoom);
    const [theme, setTheme] = useState<ThemeMode>(initialTheme);
    const [orientation, setOrientation] = useState<Orientation>(initialOrientation);
    const [isFullscreen, setIsFullscreen] = useState(false);

    // Use custom presets if provided, otherwise use built-in
    const presets = customPresets || devicePresets;
    const currentDevice = presets[currentDeviceIndex] || presets[0];

    // Calculate effective dimensions based on orientation
    const effectiveWidth =
      orientation === "landscape" && currentDevice.type !== "desktop"
        ? currentDevice.height
        : currentDevice.width;
    const effectiveHeight =
      orientation === "landscape" && currentDevice.type !== "desktop"
        ? currentDevice.width
        : currentDevice.height;

    // Zoom controls
    const handleZoomIn = useCallback(() => {
      const newZoom = Math.min(zoom + 0.25, 2);
      setZoom(newZoom);
      onZoomChange?.(newZoom);
    }, [zoom, onZoomChange]);

    const handleZoomOut = useCallback(() => {
      const newZoom = Math.max(zoom - 0.25, 0.25);
      setZoom(newZoom);
      onZoomChange?.(newZoom);
    }, [zoom, onZoomChange]);

    const handleZoomReset = useCallback(() => {
      setZoom(1);
      onZoomChange?.(1);
    }, [onZoomChange]);

    // Device change
    const handleDeviceChange = useCallback(
      (index: number) => {
        setCurrentDeviceIndex(index);
        onDeviceChange?.(presets[index]);
      },
      [presets, onDeviceChange]
    );

    // Theme toggle
    const handleThemeToggle = useCallback(() => {
      const newTheme = theme === "light" ? "dark" : "light";
      setTheme(newTheme);
      onThemeChange?.(newTheme);
    }, [theme, onThemeChange]);

    // Orientation toggle
    const handleOrientationToggle = useCallback(() => {
      setOrientation((prev) => (prev === "portrait" ? "landscape" : "portrait"));
    }, []);

    // Refresh
    const handleRefresh = useCallback(() => {
      onRefresh?.();
    }, [onRefresh]);

    // Container styles
    const containerStyles = [
      "flex",
      "flex-col",
      "h-full",
      "bg-neutral-100",
      "rounded-lg",
      "overflow-hidden",
      isFullscreen && "fixed inset-0 z-modal",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    // Toolbar styles
    const toolbarStyles = [
      "flex",
      "items-center",
      "gap-2",
      "p-2",
      "bg-white",
      "border-b",
      "border-neutral-200",
    ].join(" ");

    // Preview area styles
    const previewAreaStyles = [
      "flex-1",
      "flex",
      "items-center",
      "justify-center",
      "overflow-auto",
      "p-6",
    ].join(" ");

    // Device frame styles
    const deviceFrameStyles = [
      "relative",
      "bg-white",
      "border",
      "border-neutral-300",
      "rounded-lg",
      "shadow-lg",
      "overflow-hidden",
      "transition-all",
      "duration-300",
    ].join(" ");

    // Get device icon
    const DeviceIcon = deviceTypeIcons[currentDevice.type];

    return (
      <div ref={ref} className={containerStyles} {...props}>
        {/* Toolbar */}
        <div className={toolbarStyles}>
          {/* Device selector */}
          {showDeviceSelector && (
            <div className="flex items-center gap-1">
              <DeviceIcon className="h-4 w-4 text-neutral-500" />
              <select
                value={currentDeviceIndex}
                onChange={(e) => handleDeviceChange(Number(e.target.value))}
                className={[
                  "px-2",
                  "py-1",
                  "text-sm",
                  "bg-neutral-50",
                  "border",
                  "border-neutral-200",
                  "rounded-md",
                  "focus:outline-none",
                  "focus:ring-2",
                  "focus:ring-primary-500",
                ].join(" ")}
              >
                {presets.map((preset, index) => (
                  <option key={`${preset.name}-${index}`} value={index}>
                    {preset.name} ({preset.width}x{preset.height})
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Orientation toggle */}
          {showOrientationToggle && currentDevice.type !== "desktop" && (
            <button
              type="button"
              onClick={handleOrientationToggle}
              className={[
                "p-1.5",
                "rounded-md",
                "text-neutral-500",
                "hover:text-neutral-700",
                "hover:bg-neutral-100",
                "transition-colors",
                "duration-150",
              ].join(" ")}
              title={`Switch to ${orientation === "portrait" ? "landscape" : "portrait"}`}
            >
              <RotateIcon className="h-4 w-4" />
            </button>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Zoom controls */}
          {showZoomControls && (
            <div className="flex items-center gap-1 border border-neutral-200 rounded-md overflow-hidden">
              <button
                type="button"
                onClick={handleZoomOut}
                disabled={zoom <= 0.25}
                className={[
                  "p-1.5",
                  "text-neutral-500",
                  "hover:text-neutral-700",
                  "hover:bg-neutral-100",
                  "transition-colors",
                  "duration-150",
                  "disabled:opacity-50",
                  "disabled:cursor-not-allowed",
                ].join(" ")}
                title="Zoom out"
              >
                <ZoomOutIcon className="h-4 w-4" />
              </button>
              <button
                type="button"
                onClick={handleZoomReset}
                className={[
                  "px-2",
                  "py-1",
                  "text-xs",
                  "font-medium",
                  "text-neutral-600",
                  "hover:bg-neutral-100",
                  "min-w-12",
                  "text-center",
                ].join(" ")}
                title="Reset zoom"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={handleZoomIn}
                disabled={zoom >= 2}
                className={[
                  "p-1.5",
                  "text-neutral-500",
                  "hover:text-neutral-700",
                  "hover:bg-neutral-100",
                  "transition-colors",
                  "duration-150",
                  "disabled:opacity-50",
                  "disabled:cursor-not-allowed",
                ].join(" ")}
                title="Zoom in"
              >
                <ZoomInIcon className="h-4 w-4" />
              </button>
            </div>
          )}

          {/* Theme toggle */}
          {showThemeToggle && (
            <button
              type="button"
              onClick={handleThemeToggle}
              className={[
                "p-1.5",
                "rounded-md",
                "transition-colors",
                "duration-150",
                theme === "dark"
                  ? "bg-neutral-800 text-yellow-400"
                  : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100",
              ].join(" ")}
              title={`Switch to ${theme === "light" ? "dark" : "light"} mode`}
            >
              {theme === "dark" ? (
                <MoonIcon className="h-4 w-4" />
              ) : (
                <SunIcon className="h-4 w-4" />
              )}
            </button>
          )}

          {/* Refresh button */}
          {showRefresh && (
            <button
              type="button"
              onClick={handleRefresh}
              className={[
                "p-1.5",
                "rounded-md",
                "text-neutral-500",
                "hover:text-neutral-700",
                "hover:bg-neutral-100",
                "transition-colors",
                "duration-150",
              ].join(" ")}
              title="Refresh preview"
            >
              <RefreshIcon className="h-4 w-4" />
            </button>
          )}

          {/* Fullscreen button */}
          {showFullscreen && (
            <button
              type="button"
              onClick={() => setIsFullscreen(!isFullscreen)}
              className={[
                "p-1.5",
                "rounded-md",
                "text-neutral-500",
                "hover:text-neutral-700",
                "hover:bg-neutral-100",
                "transition-colors",
                "duration-150",
              ].join(" ")}
              title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
            >
              <FullscreenIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Preview area */}
        <div className={previewAreaStyles}>
          {/* Loading state */}
          {isLoading && (
            <div className="flex items-center gap-3 text-neutral-500">
              <div className="h-5 w-5 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <span>Loading preview...</span>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !children && !screenId && (
            <div className="flex flex-col items-center justify-center text-neutral-400">
              <EmptyIcon className="h-16 w-16 mb-4" />
              <p className="text-neutral-500">{emptyMessage}</p>
              <p className="text-sm text-neutral-400 mt-1">
                Select a component or screen to preview
              </p>
            </div>
          )}

          {/* Device frame with content */}
          {!isLoading && (children || screenId) && (
            <div
              className={deviceFrameStyles}
              style={{
                width: effectiveWidth * zoom,
                height: effectiveHeight * zoom,
              }}
            >
              {/* Device notch for mobile */}
              {currentDevice.type === "mobile" && orientation === "portrait" && (
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-24 h-6 bg-neutral-900 rounded-b-xl z-10" />
              )}

              {/* Content container */}
              <div
                className={[
                  "absolute",
                  "inset-0",
                  "overflow-auto",
                  theme === "dark" ? "bg-neutral-900" : "bg-white",
                ].join(" ")}
                data-theme={theme}
                style={{
                  transform: `scale(${zoom})`,
                  transformOrigin: "top left",
                  width: effectiveWidth,
                  height: effectiveHeight,
                }}
              >
                {children ? children : <LivePreview screenId={screenId} />}
              </div>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500">
          <span>
            {currentDevice.name} • {effectiveWidth}×{effectiveHeight}px
          </span>
          <span>{theme === "dark" ? "Dark" : "Light"} mode</span>
        </div>
      </div>
    );
  }
);

PreviewPanel.displayName = "PreviewPanel";

export default PreviewPanel;
