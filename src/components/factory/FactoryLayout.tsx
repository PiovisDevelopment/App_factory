/**
 * D049 - src/components/factory/FactoryLayout.tsx
 * =================================================
 * Main factory layout component orchestrating all factory panels.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D040-D048 (all Phase 4 components)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { forwardRef, useState, useCallback, type HTMLAttributes, type ReactNode } from "react";

/**
 * Panel types available in the factory.
 */
export type PanelType =
  | "plugins"
  | "components"
  | "tree"
  | "canvas"
  | "preview"
  | "properties"
  | "none";

/**
 * Panel configuration.
 */
export interface PanelConfig {
  /** Panel type */
  type: PanelType;
  /** Whether panel is visible */
  visible: boolean;
  /** Panel width (for side panels) or height (for bottom panels) */
  size?: number;
  /** Minimum size */
  minSize?: number;
  /** Maximum size */
  maxSize?: number;
}

/**
 * Layout preset configurations.
 */
export type LayoutPreset = "default" | "canvas-focus" | "preview-focus" | "split";

/**
 * FactoryLayout component props.
 */
export interface FactoryLayoutProps extends Omit<HTMLAttributes<HTMLDivElement>, "children"> {
  /** Left sidebar content */
  leftSidebar?: ReactNode;
  /** Right sidebar content */
  rightSidebar?: ReactNode;
  /** Main content (canvas) */
  mainContent?: ReactNode;
  /** Bottom panel content */
  bottomPanel?: ReactNode;
  /** Header content */
  header?: ReactNode;
  /** Initial panel configurations */
  initialPanels?: {
    left?: PanelConfig;
    right?: PanelConfig;
    bottom?: PanelConfig;
  };
  /** Layout preset */
  preset?: LayoutPreset;
  /** Whether panels are resizable */
  resizable?: boolean;
  /** Whether panels are collapsible */
  collapsible?: boolean;
  /** Callback when panel visibility changes */
  onPanelToggle?: (panel: "left" | "right" | "bottom", visible: boolean) => void;
  /** Callback when panel is resized */
  onPanelResize?: (panel: "left" | "right" | "bottom", size: number) => void;
}

/**
 * Chevron icons.
 */
const ChevronLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="15 18 9 12 15 6" />
  </svg>
);

const ChevronRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

const ChevronUpIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

/**
 * Default panel sizes.
 */
const defaultPanelSizes = {
  left: { size: 280, minSize: 200, maxSize: 400 },
  right: { size: 300, minSize: 240, maxSize: 450 },
  bottom: { size: 200, minSize: 120, maxSize: 400 },
};

/**
 * Layout presets.
 */
const layoutPresets: Record<LayoutPreset, { left: boolean; right: boolean; bottom: boolean }> = {
  default: { left: true, right: true, bottom: false },
  "canvas-focus": { left: false, right: false, bottom: false },
  "preview-focus": { left: false, right: true, bottom: false },
  split: { left: true, right: true, bottom: true },
};

/**
 * FactoryLayout component.
 *
 * The main layout component for the App Factory, providing a resizable
 * panel-based layout with sidebars, main content area, and bottom panel.
 *
 * @example
 * ```tsx
 * <FactoryLayout
 *   header={<ToolbarHeader />}
 *   leftSidebar={<PluginGallery />}
 *   mainContent={<CanvasEditor />}
 *   rightSidebar={<PropertyInspector />}
 *   bottomPanel={<PreviewPanel />}
 *   preset="default"
 *   resizable
 *   collapsible
 * />
 * ```
 */
export const FactoryLayout = forwardRef<HTMLDivElement, FactoryLayoutProps>(
  (
    {
      leftSidebar,
      rightSidebar,
      mainContent,
      bottomPanel,
      header,
      initialPanels,
      preset = "default",
      resizable = true,
      collapsible = true,
      onPanelToggle,
      onPanelResize,
      className = "",
      ...props
    },
    ref
  ) => {
    // Panel state
    const [leftVisible, setLeftVisible] = useState(
      initialPanels?.left?.visible ?? layoutPresets[preset].left
    );
    const [rightVisible, setRightVisible] = useState(
      initialPanels?.right?.visible ?? layoutPresets[preset].right
    );
    const [bottomVisible, setBottomVisible] = useState(
      initialPanels?.bottom?.visible ?? layoutPresets[preset].bottom
    );

    const [leftSize, setLeftSize] = useState(
      initialPanels?.left?.size ?? defaultPanelSizes.left.size
    );
    const [rightSize, setRightSize] = useState(
      initialPanels?.right?.size ?? defaultPanelSizes.right.size
    );
    const [bottomSize, setBottomSize] = useState(
      initialPanels?.bottom?.size ?? defaultPanelSizes.bottom.size
    );

    // Resize state
    const [isResizing, setIsResizing] = useState<"left" | "right" | "bottom" | null>(null);

    // Toggle panel visibility
    const togglePanel = useCallback(
      (panel: "left" | "right" | "bottom") => {
        switch (panel) {
          case "left":
            setLeftVisible((v) => {
              onPanelToggle?.(panel, !v);
              return !v;
            });
            break;
          case "right":
            setRightVisible((v) => {
              onPanelToggle?.(panel, !v);
              return !v;
            });
            break;
          case "bottom":
            setBottomVisible((v) => {
              onPanelToggle?.(panel, !v);
              return !v;
            });
            break;
        }
      },
      [onPanelToggle]
    );

    // Handle resize start
    const handleResizeStart = useCallback(
      (panel: "left" | "right" | "bottom") => {
        if (!resizable) return;
        setIsResizing(panel);
      },
      [resizable]
    );

    // Handle resize move
    const handleResizeMove = useCallback(
      (e: React.MouseEvent) => {
        if (!isResizing) return;

        const minSize = defaultPanelSizes[isResizing].minSize;
        const maxSize = defaultPanelSizes[isResizing].maxSize;

        switch (isResizing) {
          case "left": {
            const newSize = Math.min(maxSize, Math.max(minSize, e.clientX));
            setLeftSize(newSize);
            onPanelResize?.(isResizing, newSize);
            break;
          }
          case "right": {
            const newSize = Math.min(maxSize, Math.max(minSize, window.innerWidth - e.clientX));
            setRightSize(newSize);
            onPanelResize?.(isResizing, newSize);
            break;
          }
          case "bottom": {
            const newSize = Math.min(maxSize, Math.max(minSize, window.innerHeight - e.clientY));
            setBottomSize(newSize);
            onPanelResize?.(isResizing, newSize);
            break;
          }
        }
      },
      [isResizing, onPanelResize]
    );

    // Handle resize end
    const handleResizeEnd = useCallback(() => {
      setIsResizing(null);
    }, []);

    // Container styles
    const containerStyles = [
      "flex",
      "flex-col",
      "h-screen",
      "w-screen",
      "bg-neutral-100",
      "overflow-hidden",
      isResizing === "left" && "select-none cursor-ew-resize",
      isResizing === "right" && "select-none cursor-ew-resize",
      isResizing === "bottom" && "select-none cursor-ns-resize",
      className,
    ]
      .filter(Boolean)
      .join(" ");

    // Sidebar styles
    const sidebarStyles = (visible: boolean, side: "left" | "right") =>
      [
        "relative", // Required for absolute positioned resize handle
        "flex",
        "flex-col",
        "bg-white",
        "border-neutral-200",
        "transition-all",
        "duration-200",
        side === "left" ? "border-r" : "border-l",
        !visible && "w-0 overflow-hidden",
      ]
        .filter(Boolean)
        .join(" ");

    // Resize handle styles
    // Using w-2 (8px) for better hit target while keeping visual appearance subtle
    const resizeHandleStyles = (orientation: "vertical" | "horizontal") =>
      [
        "absolute",
        "bg-transparent",
        "hover:bg-primary-300/50",
        "transition-colors",
        "duration-150",
        "z-20",
        orientation === "vertical"
          ? "w-2 h-full top-0 cursor-ew-resize" // cursor-ew-resize is the double-ended horizontal arrow
          : "h-2 w-full left-0 cursor-ns-resize", // cursor-ns-resize is the double-ended vertical arrow
        isResizing && "bg-primary-400/70",
      ]
        .filter(Boolean)
        .join(" ");

    // Collapse button styles
    const collapseButtonStyles = (visible: boolean) =>
      [
        "flex",
        "items-center",
        "justify-center",
        "h-8",
        "w-8",
        "rounded-md",
        "bg-white",
        "border",
        "border-neutral-200",
        "shadow-sm",
        "text-neutral-500",
        "hover:text-neutral-700",
        "hover:bg-neutral-50",
        "transition-colors",
        "duration-150",
        !visible && "opacity-60",
      ]
        .filter(Boolean)
        .join(" ");

    return (
      <div
        ref={ref}
        className={containerStyles}
        onMouseMove={isResizing ? handleResizeMove : undefined}
        onMouseUp={handleResizeEnd}
        onMouseLeave={handleResizeEnd}
        {...props}
      >
        {/* Header */}
        {header && (
          <div className="flex items-center h-12 px-4 bg-white border-b border-neutral-200 shrink-0" data-ui-ref="layout-header">
            {header}
          </div>
        )}

        {/* Main content area */}
        <div className="flex flex-1 overflow-hidden">
          {/* Left sidebar */}
          {leftSidebar && (
            <div
              className={sidebarStyles(leftVisible, "left")}
              style={{ width: leftVisible ? leftSize : 0 }}
              data-ui-ref="layout-sidebar-left"
            >
              {/* Sidebar content */}
              <div className="flex-1 overflow-hidden">{leftSidebar}</div>

              {/* Resize handle */}
              {resizable && leftVisible && (
                <div
                  className={[resizeHandleStyles("vertical"), "right-0"].join(" ")}
                  onMouseDown={() => handleResizeStart("left")}
                />
              )}
            </div>
          )}

          {/* Left collapse button */}
          {collapsible && leftSidebar && (
            <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20 ml-1">
              <button
                type="button"
                onClick={() => togglePanel("left")}
                className={collapseButtonStyles(leftVisible)}
                style={{ marginLeft: leftVisible ? leftSize - 12 : 4 }}
                title={leftVisible ? "Collapse sidebar" : "Expand sidebar"}
              >
                {leftVisible ? (
                  <ChevronLeftIcon className="h-4 w-4" />
                ) : (
                  <ChevronRightIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          )}

          {/* Center content area */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Main canvas/content */}
            <div className="flex-1 overflow-hidden relative" data-ui-ref="layout-center-canvas">
              {mainContent || (
                <div className="flex items-center justify-center h-full text-neutral-400">
                  <div className="text-center">
                    <div className="h-16 w-16 mx-auto mb-4 opacity-50">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                        <line x1="3" y1="9" x2="21" y2="9" />
                        <line x1="9" y1="21" x2="9" y2="9" />
                      </svg>
                    </div>
                    <p className="text-sm">No content to display</p>
                    <p className="text-xs text-neutral-300 mt-1">
                      Add components from the sidebar
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* Bottom panel */}
            {bottomPanel && bottomVisible && (
              <div
                className="relative bg-white border-t border-neutral-200 shrink-0"
                style={{ height: bottomSize }}
                data-ui-ref="layout-panel-bottom"
              >
                {/* Resize handle */}
                {resizable && (
                  <div
                    className={[resizeHandleStyles("horizontal"), "top-0"].join(" ")}
                    onMouseDown={() => handleResizeStart("bottom")}
                  />
                )}

                {/* Panel content */}
                <div className="h-full overflow-hidden">{bottomPanel}</div>
              </div>
            )}

            {/* Bottom collapse button */}
            {collapsible && bottomPanel && (
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 z-20 mb-1">
                <button
                  type="button"
                  onClick={() => togglePanel("bottom")}
                  className={collapseButtonStyles(bottomVisible)}
                  style={{ marginBottom: bottomVisible ? bottomSize - 12 : 4 }}
                  title={bottomVisible ? "Collapse panel" : "Expand panel"}
                >
                  {bottomVisible ? (
                    <ChevronDownIcon className="h-4 w-4" />
                  ) : (
                    <ChevronUpIcon className="h-4 w-4" />
                  )}
                </button>
              </div>
            )}
          </div>

          {/* Right sidebar */}
          {rightSidebar && (
            <div
              className={sidebarStyles(rightVisible, "right")}
              style={{ width: rightVisible ? rightSize : 0 }}
              data-ui-ref="layout-sidebar-right"
            >
              {/* Resize handle */}
              {resizable && rightVisible && (
                <div
                  className={[resizeHandleStyles("vertical"), "left-0"].join(" ")}
                  onMouseDown={() => handleResizeStart("right")}
                />
              )}

              {/* Sidebar content */}
              <div className="flex-1 overflow-hidden">{rightSidebar}</div>
            </div>
          )}

          {/* Right collapse button */}
          {collapsible && rightSidebar && (
            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20 mr-1">
              <button
                type="button"
                onClick={() => togglePanel("right")}
                className={collapseButtonStyles(rightVisible)}
                style={{ marginRight: rightVisible ? rightSize - 12 : 4 }}
                title={rightVisible ? "Collapse sidebar" : "Expand sidebar"}
              >
                {rightVisible ? (
                  <ChevronRightIcon className="h-4 w-4" />
                ) : (
                  <ChevronLeftIcon className="h-4 w-4" />
                )}
              </button>
            </div>
          )}
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between h-6 px-3 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500 shrink-0">
          <span>App Factory</span>
          <div className="flex items-center gap-4">
            <span>
              Panels: {leftVisible ? "L" : "-"} | {bottomVisible ? "B" : "-"} |{" "}
              {rightVisible ? "R" : "-"}
            </span>
          </div>
        </div>
      </div>
    );
  }
);

FactoryLayout.displayName = "FactoryLayout";

export default FactoryLayout;
