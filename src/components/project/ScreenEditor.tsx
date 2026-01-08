/**
 * D065 - src/components/project/ScreenEditor.tsx
 * ===============================================
 * Component for editing screens and widgets in a project.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D011 (Input.tsx), D014 (Panel.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { useState, useCallback, type HTMLAttributes } from "react";

/**
 * Widget slot definition.
 */
export interface WidgetSlot {
  id: string;
  name: string;
  pluginId?: string;
  pluginType?: string;
  position: { x: number; y: number };
  size: { width: number; height: number };
  constraints?: {
    minWidth?: number;
    maxWidth?: number;
    minHeight?: number;
    maxHeight?: number;
  };
  isRequired?: boolean;
}

/**
 * Screen route configuration.
 */
export interface ScreenRoute {
  path: string;
  params?: { name: string; type: string; required: boolean }[];
  guards?: string[];
}

/**
 * Screen metadata.
 */
export interface ScreenMeta {
  title: string;
  description?: string;
  keywords?: string[];
  icon?: string;
}

/**
 * Editable screen structure.
 */
export interface EditableScreen {
  id: string;
  name: string;
  displayName: string;
  type: "page" | "modal" | "drawer" | "widget" | "overlay";
  route: ScreenRoute;
  meta: ScreenMeta;
  layout: "single" | "split" | "grid" | "stack" | "custom";
  widgets: WidgetSlot[];
  parentId?: string;
  isDefault?: boolean;
  isProtected?: boolean;
}

/**
 * ScreenEditor component props.
 */
export interface ScreenEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Screen being edited */
  screen: EditableScreen;
  /** Available screens for navigation */
  availableScreens?: EditableScreen[];
  /** Callback when screen property changes */
  onPropertyChange?: (property: string, value: unknown) => void;
  /** Callback when widget is selected */
  onWidgetSelect?: (widget: WidgetSlot) => void;
  /** Callback when widget is added */
  onWidgetAdd?: (position: { x: number; y: number }) => void;
  /** Callback when widget is removed */
  onWidgetRemove?: (widgetId: string) => void;
  /** Callback when widget is moved */
  onWidgetMove?: (widgetId: string, position: { x: number; y: number }) => void;
  /** Callback when widget is resized */
  onWidgetResize?: (widgetId: string, size: { width: number; height: number }) => void;
  /** Callback when screen is deleted */
  onDelete?: () => void;
  /** Callback when screen is duplicated */
  onDuplicate?: () => void;
  /** Currently selected widget ID */
  selectedWidgetId?: string;
  /** Whether in preview mode */
  previewMode?: boolean;
  /** Whether screen is read-only */
  readOnly?: boolean;
  /** Grid snap size */
  gridSize?: number;
  /** Whether to show grid */
  showGrid?: boolean;
}

/**
 * Screen type icons.
 */
const ScreenTypeIcons: Record<EditableScreen["type"], React.FC<{ className?: string }>> = {
  page: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
    </svg>
  ),
  modal: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="9" y1="3" x2="9" y2="21" />
    </svg>
  ),
  drawer: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  ),
  widget: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="7" />
      <rect x="14" y="3" width="7" height="7" />
      <rect x="14" y="14" width="7" height="7" />
      <rect x="3" y="14" width="7" height="7" />
    </svg>
  ),
  overlay: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <rect x="7" y="7" width="10" height="10" rx="1" ry="1" />
    </svg>
  ),
};

/**
 * Layout icons.
 */
const LayoutIcons: Record<EditableScreen["layout"], React.FC<{ className?: string }>> = {
  single: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  ),
  split: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  ),
  grid: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="12" x2="21" y2="12" />
      <line x1="12" y1="3" x2="12" y2="21" />
    </svg>
  ),
  stack: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="3" y1="15" x2="21" y2="15" />
    </svg>
  ),
  custom: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="7" height="9" rx="1" />
      <rect x="14" y="3" width="7" height="5" rx="1" />
      <rect x="14" y="12" width="7" height="9" rx="1" />
      <rect x="3" y="16" width="7" height="5" rx="1" />
    </svg>
  ),
};

/**
 * Plus icon.
 */
const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/**
 * Trash icon.
 */
const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

/**
 * Copy icon.
 */
const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
  </svg>
);



/**
 * Grid icon.
 */
const GridIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

/**
 * Move icon.
 */
const MoveIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="5 9 2 12 5 15" />
    <polyline points="9 5 12 2 15 5" />
    <polyline points="15 19 12 22 9 19" />
    <polyline points="19 9 22 12 19 15" />
    <line x1="2" y1="12" x2="22" y2="12" />
    <line x1="12" y1="2" x2="12" y2="22" />
  </svg>
);

/**
 * Screen type colors.
 */
const screenTypeColors: Record<EditableScreen["type"], string> = {
  page: "bg-primary-100 text-primary-700",
  modal: "bg-warning-50 text-warning-700",
  drawer: "bg-success-50 text-success-700",
  widget: "bg-info-50 text-info-700",
  overlay: "bg-purple-50 text-purple-700",
};

/**
 * ScreenEditor component.
 *
 * Provides an interface for editing screens and their widget layouts.
 *
 * @example
 * ```tsx
 * <ScreenEditor
 *   screen={selectedScreen}
 *   onPropertyChange={(prop, value) => updateScreen(prop, value)}
 *   onWidgetSelect={(widget) => setSelectedWidget(widget)}
 *   onWidgetAdd={(pos) => addWidget(pos)}
 *   selectedWidgetId={selectedWidgetId}
 * />
 * ```
 */
export const ScreenEditor: React.FC<ScreenEditorProps> = ({
  screen,
  availableScreens = [],
  onPropertyChange,
  onWidgetSelect,
  onWidgetAdd,
  onWidgetRemove,
  onWidgetMove,
  onWidgetResize,
  onDelete,
  onDuplicate,
  selectedWidgetId,
  previewMode = false,
  readOnly = false,
  gridSize = 20,
  showGrid: initialShowGrid = true,
  className = "",
  ...props
}) => {
  // Active tab
  const [activeTab, setActiveTab] = useState<"layout" | "route" | "meta">("layout");

  // Show grid
  const [showGrid, setShowGrid] = useState(initialShowGrid);

  // Dragging state
  const [isDragging, setIsDragging] = useState(false);
  const [dragWidget, setDragWidget] = useState<string | null>(null);

  // Get screen type icon
  const ScreenTypeIcon = ScreenTypeIcons[screen.type];


  // Handle canvas click for adding widgets
  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (readOnly || previewMode) return;

      const rect = e.currentTarget.getBoundingClientRect();
      const x = Math.round((e.clientX - rect.left) / gridSize) * gridSize;
      const y = Math.round((e.clientY - rect.top) / gridSize) * gridSize;

      // Only add if clicking empty space
      if (e.target === e.currentTarget) {
        onWidgetAdd?.({ x, y });
      }
    },
    [readOnly, previewMode, gridSize, onWidgetAdd]
  );

  // Handle widget drag start
  const handleWidgetDragStart = useCallback(
    (widgetId: string) => {
      if (readOnly) return;
      setIsDragging(true);
      setDragWidget(widgetId);
    },
    [readOnly]
  );

  // Handle widget drag end
  const handleWidgetDragEnd = useCallback(
    (e: React.MouseEvent<HTMLDivElement>, widgetId: string) => {
      if (!isDragging || dragWidget !== widgetId) return;

      const rect = e.currentTarget.parentElement?.getBoundingClientRect();
      if (rect) {
        const x = Math.round((e.clientX - rect.left) / gridSize) * gridSize;
        const y = Math.round((e.clientY - rect.top) / gridSize) * gridSize;
        onWidgetMove?.(widgetId, { x, y });
      }

      setIsDragging(false);
      setDragWidget(null);
    },
    [isDragging, dragWidget, gridSize, onWidgetMove]
  );

  // Container styles
  const containerStyles = [
    "flex",
    "flex-col",
    "h-full",
    "bg-white",
    "overflow-hidden",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerStyles} {...props}>
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 bg-neutral-50">
        <div className="flex items-center gap-3">
          <div
            className={[
              "flex",
              "items-center",
              "justify-center",
              "h-10",
              "w-10",
              "rounded-lg",
              screenTypeColors[screen.type],
            ].join(" ")}
          >
            <ScreenTypeIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900 truncate">
              {screen.displayName}
            </h3>
            <p className="text-xs text-neutral-500">
              {screen.type} • {screen.layout} layout • {screen.widgets.length} widgets
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex items-center gap-1">
          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className={[
              "p-1.5",
              "rounded-md",
              showGrid
                ? "bg-primary-50 text-primary-600"
                : "text-neutral-400 hover:bg-neutral-100 hover:text-neutral-600",
              "transition-colors",
              "duration-150",
            ].join(" ")}
            title={showGrid ? "Hide grid" : "Show grid"}
          >
            <GridIcon className="h-4 w-4" />
          </button>

          <div className="flex-1" />

          <button
            type="button"
            onClick={onDuplicate}
            disabled={readOnly}
            className={[
              "p-1.5",
              "rounded-md",
              "text-neutral-400",
              "hover:bg-neutral-100",
              "hover:text-neutral-600",
              "transition-colors",
              "duration-150",
              "disabled:opacity-50",
            ].join(" ")}
            title="Duplicate screen"
          >
            <CopyIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={readOnly || screen.isDefault}
            className={[
              "p-1.5",
              "rounded-md",
              "text-neutral-400",
              "hover:bg-error-50",
              "hover:text-error-600",
              "transition-colors",
              "duration-150",
              "disabled:opacity-50",
            ].join(" ")}
            title="Delete screen"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200">
        {(["layout", "route", "meta"] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={[
              "flex-1",
              "px-4",
              "py-2",
              "text-sm",
              "font-medium",
              "border-b-2",
              "transition-colors",
              "duration-150",
              activeTab === tab
                ? "border-primary-600 text-primary-600"
                : "border-transparent text-neutral-500 hover:text-neutral-700",
            ].join(" ")}
          >
            {tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "layout" && (
          <div className="h-full flex flex-col">
            {/* Layout type selector */}
            <div className="p-4 border-b border-neutral-100">
              <label className="block text-xs font-medium text-neutral-500 mb-2">
                Layout Type
              </label>
              <div className="flex gap-2">
                {(Object.keys(LayoutIcons) as EditableScreen["layout"][]).map((layout) => {
                  const Icon = LayoutIcons[layout];
                  return (
                    <button
                      key={layout}
                      type="button"
                      onClick={() => onPropertyChange?.("layout", layout)}
                      disabled={readOnly}
                      className={[
                        "flex",
                        "flex-col",
                        "items-center",
                        "gap-1",
                        "p-2",
                        "rounded-md",
                        "border",
                        "transition-colors",
                        "duration-150",
                        screen.layout === layout
                          ? "border-primary-500 bg-primary-50 text-primary-700"
                          : "border-neutral-200 text-neutral-500 hover:border-neutral-300",
                        "disabled:opacity-50",
                      ].join(" ")}
                      title={layout}
                    >
                      <Icon className="h-5 w-5" />
                      <span className="text-xs capitalize">{layout}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Widget canvas */}
            <div className="flex-1 p-4 overflow-auto">
              <div
                className={[
                  "relative",
                  "w-full",
                  "h-64",
                  "rounded-lg",
                  "border-2",
                  "border-dashed",
                  "border-neutral-300",
                  showGrid ? "bg-[url('data:image/svg+xml,%3Csvg%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%20width%3D%2220%22%20height%3D%2220%22%3E%3Crect%20fill%3D%22%23f9fafb%22%20width%3D%2220%22%20height%3D%2220%22/%3E%3Cpath%20d%3D%22M%200%200%20L%2020%200%20L%2020%2020%22%20fill%3D%22none%22%20stroke%3D%22%23e5e7eb%22%20stroke-width%3D%221%22/%3E%3C/svg%3E')]" : "bg-neutral-50",
                  "transition-colors",
                  "duration-150",
                ].join(" ")}
                onClick={handleCanvasClick}
              >
                {screen.widgets.length === 0 ? (
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="text-center">
                      <PlusIcon className="mx-auto h-8 w-8 text-neutral-300" />
                      <p className="mt-2 text-sm text-neutral-400">
                        Click to add a widget slot
                      </p>
                    </div>
                  </div>
                ) : (
                  screen.widgets.map((widget) => (
                    <div
                      key={widget.id}
                      role="button"
                      tabIndex={0}
                      onClick={(e) => {
                        e.stopPropagation();
                        onWidgetSelect?.(widget);
                      }}
                      onMouseDown={() => handleWidgetDragStart(widget.id)}
                      onMouseUp={(e) => handleWidgetDragEnd(e, widget.id)}
                      className={[
                        "absolute",
                        "flex",
                        "flex-col",
                        "items-center",
                        "justify-center",
                        "rounded-md",
                        "border-2",
                        "cursor-move",
                        "transition-shadow",
                        "duration-150",
                        selectedWidgetId === widget.id
                          ? "border-primary-500 bg-primary-50 shadow-md"
                          : "border-neutral-300 bg-white hover:border-neutral-400",
                        widget.pluginId ? "" : "border-dashed",
                      ].join(" ")}
                      style={{
                        left: widget.position.x,
                        top: widget.position.y,
                        width: widget.size.width,
                        height: widget.size.height,
                      }}
                    >
                      <MoveIcon className="h-4 w-4 text-neutral-400" />
                      <span className="mt-1 text-xs text-neutral-500 truncate max-w-full px-2">
                        {widget.name}
                      </span>
                      {widget.pluginType && (
                        <span className="text-xs text-neutral-400">
                          {widget.pluginType}
                        </span>
                      )}

                      {/* Remove button */}
                      {selectedWidgetId === widget.id && !readOnly && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onWidgetRemove?.(widget.id);
                          }}
                          className={[
                            "absolute",
                            "-top-2",
                            "-right-2",
                            "p-1",
                            "rounded-full",
                            "bg-error-500",
                            "text-white",
                            "shadow-sm",
                            "hover:bg-error-600",
                          ].join(" ")}
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Widget list */}
            <div className="p-4 border-t border-neutral-100">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-neutral-500">
                  Widgets ({screen.widgets.length})
                </span>
                <button
                  type="button"
                  onClick={() => onWidgetAdd?.({ x: 0, y: 0 })}
                  disabled={readOnly}
                  className={[
                    "inline-flex",
                    "items-center",
                    "gap-1",
                    "px-2",
                    "py-1",
                    "text-xs",
                    "text-primary-600",
                    "hover:bg-primary-50",
                    "rounded",
                    "transition-colors",
                    "duration-150",
                    "disabled:opacity-50",
                  ].join(" ")}
                >
                  <PlusIcon className="h-3 w-3" />
                  Add Widget
                </button>
              </div>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {screen.widgets.map((widget) => (
                  <button
                    key={widget.id}
                    type="button"
                    onClick={() => onWidgetSelect?.(widget)}
                    className={[
                      "w-full",
                      "flex",
                      "items-center",
                      "gap-2",
                      "px-2",
                      "py-1.5",
                      "text-left",
                      "rounded",
                      "transition-colors",
                      "duration-150",
                      selectedWidgetId === widget.id
                        ? "bg-primary-50 text-primary-700"
                        : "hover:bg-neutral-50 text-neutral-700",
                    ].join(" ")}
                  >
                    <span className="text-sm truncate">{widget.name}</span>
                    {widget.isRequired && (
                      <span className="text-error-500 text-xs">*</span>
                    )}
                    {widget.pluginType && (
                      <span className="ml-auto text-xs text-neutral-400">
                        {widget.pluginType}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === "route" && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Path
              </label>
              <input
                type="text"
                value={screen.route.path}
                onChange={(e) =>
                  onPropertyChange?.("route", { ...screen.route, path: e.target.value })
                }
                disabled={readOnly}
                className={[
                  "w-full",
                  "px-3",
                  "py-2",
                  "text-sm",
                  "font-mono",
                  "bg-white",
                  "border",
                  "border-neutral-300",
                  "rounded-md",
                  "focus:outline-none",
                  "focus:ring-2",
                  "focus:ring-primary-500",
                  "disabled:bg-neutral-50",
                ].join(" ")}
                placeholder="/path/:param"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Route Parameters
              </label>
              {screen.route.params && screen.route.params.length > 0 ? (
                <div className="space-y-2">
                  {screen.route.params.map((param, index) => (
                    <div
                      key={index}
                      className="flex items-center gap-2 p-2 bg-neutral-50 rounded"
                    >
                      <span className="text-sm font-mono text-primary-600">
                        :{param.name}
                      </span>
                      <span className="text-xs text-neutral-400">
                        ({param.type})
                      </span>
                      {param.required && (
                        <span className="text-error-500 text-xs">required</span>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 italic">
                  No route parameters defined
                </p>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Guards
              </label>
              {screen.route.guards && screen.route.guards.length > 0 ? (
                <div className="flex flex-wrap gap-1">
                  {screen.route.guards.map((guard) => (
                    <span
                      key={guard}
                      className="px-2 py-0.5 text-xs bg-warning-50 text-warning-700 rounded"
                    >
                      {guard}
                    </span>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-neutral-500 italic">
                  No guards configured
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === "meta" && (
          <div className="p-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Title
              </label>
              <input
                type="text"
                value={screen.meta.title}
                onChange={(e) =>
                  onPropertyChange?.("meta", { ...screen.meta, title: e.target.value })
                }
                disabled={readOnly}
                className={[
                  "w-full",
                  "px-3",
                  "py-2",
                  "text-sm",
                  "bg-white",
                  "border",
                  "border-neutral-300",
                  "rounded-md",
                  "focus:outline-none",
                  "focus:ring-2",
                  "focus:ring-primary-500",
                  "disabled:bg-neutral-50",
                ].join(" ")}
                placeholder="Screen title"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Description
              </label>
              <textarea
                value={screen.meta.description || ""}
                onChange={(e) =>
                  onPropertyChange?.("meta", { ...screen.meta, description: e.target.value })
                }
                disabled={readOnly}
                rows={3}
                className={[
                  "w-full",
                  "px-3",
                  "py-2",
                  "text-sm",
                  "bg-white",
                  "border",
                  "border-neutral-300",
                  "rounded-md",
                  "focus:outline-none",
                  "focus:ring-2",
                  "focus:ring-primary-500",
                  "disabled:bg-neutral-50",
                ].join(" ")}
                placeholder="Screen description for SEO and accessibility"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Icon
              </label>
              <input
                type="text"
                value={screen.meta.icon || ""}
                onChange={(e) =>
                  onPropertyChange?.("meta", { ...screen.meta, icon: e.target.value })
                }
                disabled={readOnly}
                className={[
                  "w-full",
                  "px-3",
                  "py-2",
                  "text-sm",
                  "bg-white",
                  "border",
                  "border-neutral-300",
                  "rounded-md",
                  "focus:outline-none",
                  "focus:ring-2",
                  "focus:ring-primary-500",
                  "disabled:bg-neutral-50",
                ].join(" ")}
                placeholder="Icon name or path"
              />
            </div>

            <div className="pt-4 border-t border-neutral-200">
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={screen.isDefault}
                    onChange={(e) => onPropertyChange?.("isDefault", e.target.checked)}
                    disabled={readOnly}
                    className="h-4 w-4 rounded border-neutral-300 text-primary-600"
                  />
                  <span className="text-sm text-neutral-700">Default screen</span>
                </label>

                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={screen.isProtected}
                    onChange={(e) => onPropertyChange?.("isProtected", e.target.checked)}
                    disabled={readOnly}
                    className="h-4 w-4 rounded border-neutral-300 text-primary-600"
                  />
                  <span className="text-sm text-neutral-700">Protected route</span>
                </label>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

ScreenEditor.displayName = "ScreenEditor";

export default ScreenEditor;
