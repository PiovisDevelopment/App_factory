/**
 * D045 - src/components/factory/CanvasEditor.tsx
 * ================================================
 * Layout canvas editor for visual component arrangement.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, {
  forwardRef,
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
  type HTMLAttributes,
} from "react";
import { LiveComponentPreview } from "../ai/LiveComponentPreview";
import { generateThemeCSSProperties } from "../../hooks/useThemedStyles";
import { resolveColor, resolveBorder } from "../../utils/tokenMap";
import { getComponent, isComponentRegistered } from "../../utils/ComponentRegistry";
import type { ThemeConfig } from "../../context/ThemeProvider";

/**
 * Canvas element types.
 */
import { TemplateComponentRenderer, elementTypeColors } from "./TemplateComponentRenderer";
import type { CanvasElement, CanvasElementType, ElementBounds } from "./canvasTypes";

export type { CanvasElement, CanvasElementType, ElementBounds };


/**
 * Tool types.
 */
type ToolType = "select" | "pan";

/**
 * Device preset for viewport simulation.
 */
interface DevicePreset {
  name: string;
  width: number;
  height: number;
}

/**
 * Built-in device presets.
 */
const devicePresets: DevicePreset[] = [
  { name: "Desktop (1920×1080)", width: 1920, height: 1080 },
  { name: "Laptop (1366×768)", width: 1366, height: 768 },
  { name: "Tablet (1024×768)", width: 1024, height: 768 },
  { name: "iPad (834×1194)", width: 834, height: 1194 },
  { name: "iPhone 14 Pro (393×852)", width: 393, height: 852 },
  { name: "iPhone SE (375×667)", width: 375, height: 667 },
];

/**
 * CanvasEditor component.
 *
 * A visual layout editor for arranging components on a canvas
 * with drag-and-drop, resize, grid snap, and zoom capabilities.
 *
 * @example
 * ```tsx
 * <CanvasEditor
 *   elements={canvasElements}
 *   selectedIds={[selectedId]}
 *   canvasWidth={1920}
 *   canvasHeight={1080}
 *   gridSettings={{ size: 8, snap: true, visible: true }}
 *   onSelect={(ids) => setSelectedId(ids[0])}
 *   onMove={(id, bounds) => updateElement(id, bounds)}
 *   editable
 * />
 * ```
 */

/**
 * Cursor icon.
 */
const CursorIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
    <path d="M13 13l6 6" />
  </svg>
);

/**
 * Hand/pan icon.
 */
const HandIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18 11V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v0" />
    <path d="M14 10V4a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v2" />
    <path d="M10 10.5V6a2 2 0 0 0-2-2v0a2 2 0 0 0-2 2v8" />
    <path d="M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-5.99-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15" />
  </svg>
);

/**
 * Zoom in icon.
 */
const ZoomInIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
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
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
    <line x1="8" y1="11" x2="14" y2="11" />
  </svg>
);

/**
 * Grid icon.
 */
const GridIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="3" y1="9" x2="21" y2="9" />
    <line x1="3" y1="15" x2="21" y2="15" />
    <line x1="9" y1="3" x2="9" y2="21" />
    <line x1="15" y1="3" x2="15" y2="21" />
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
 * Play icon (for demo mode).
 */
const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polygon points="5 3 19 12 5 21 5 3" />
  </svg>
);

/**
 * Stop icon (for demo mode).
 */
const StopIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="6" y="6" width="12" height="12" />
  </svg>
);

/**
 * Clear/eraser icon (for clear canvas).
 */
const ClearIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M20 5H9l-7 7 7 7h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2Z" />
    <line x1="18" y1="9" x2="12" y2="15" />
    <line x1="12" y1="9" x2="18" y2="15" />
  </svg>
);

/**
 * Undo icon (curved arrow left).
 */
const UndoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

export const CanvasEditor = forwardRef<HTMLDivElement, CanvasEditorProps>(
  (
    {
      elements,
      selectedIds = [],
      canvasWidth = 1920,
      canvasHeight = 1080,
      initialZoom = 0.5,
      gridSettings = { size: 8, snap: true, visible: true },
      editable = true,
      showRulers = true,
      showGuides = false,
      onSelect,
      onMove,
      onResize,
      onDelete,
      onDrop,
      onZoomChange,
      onCanvasSizeChange,
      getComponentCode,
      templateName,
      demoMode: externalDemoMode,
      onDemoModeChange,
      canvasTheme,
      onClear,
      onUndo,
      canUndo = false,
      className = "",
      ...props
    },
    ref
  ) => {
    // State
    const [zoom, setZoom] = useState(initialZoom);
    const [pan, setPan] = useState({ x: 0, y: 0 });
    const [tool, setTool] = useState<ToolType>("select");
    const [isDragging, setIsDragging] = useState(false);
    const [isResizing, setIsResizing] = useState(false);
    const [isPanning, setIsPanning] = useState(false);
    const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
    const [showGrid, setShowGrid] = useState(gridSettings.visible);
    const [currentDevice, setCurrentDevice] = useState(0);
    const [effectiveWidth, setEffectiveWidth] = useState(canvasWidth);
    const [effectiveHeight, setEffectiveHeight] = useState(canvasHeight);

    // Demo mode state (internal or controlled)
    const [internalDemoMode, setInternalDemoMode] = useState(false);
    const isDemoMode = externalDemoMode ?? internalDemoMode;
    const toggleDemoMode = useCallback(() => {
      const newValue = !isDemoMode;
      setInternalDemoMode(newValue);
      onDemoModeChange?.(newValue);
    }, [isDemoMode, onDemoModeChange]);

    // Resize state
    const [resizeDirection, setResizeDirection] = useState<string | null>(null);
    const [resizeStart, setResizeStart] = useState<{ x: number; y: number } | null>(null);
    const [resizeInitialBounds, setResizeInitialBounds] = useState<ElementBounds | null>(null);
    const [resizeElementId, setResizeElementId] = useState<string | null>(null);

    // Refs
    const canvasRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);

    // Theme - generate CSS properties from canvasTheme prop (isolated from App Factory theme)
    // If no canvasTheme provided, use a clean default with white background
    const canvasThemeStyles = useMemo(() => {
      if (canvasTheme) {
        return generateThemeCSSProperties(canvasTheme);
      }
      // Default canvas styling when no theme is provided
      return {
        backgroundColor: '#ffffff',
        color: '#18181b',
      };
    }, [canvasTheme]);

    // Snap to grid
    const snapToGrid = useCallback(
      (value: number): number => {
        if (!gridSettings.snap) return value;
        return Math.round(value / gridSettings.size) * gridSettings.size;
      },
      [gridSettings.snap, gridSettings.size]
    );

    // Get element by ID
    const getElementById = useCallback(
      (id: string): CanvasElement | undefined => {
        const findElement = (elements: CanvasElement[]): CanvasElement | undefined => {
          for (const el of elements) {
            if (el.id === id) return el;
            if (el.children) {
              const found = findElement(el.children);
              if (found) return found;
            }
          }
          return undefined;
        };
        return findElement(elements);
      },
      [elements]
    );

    // Handle zoom
    const handleZoomIn = useCallback(() => {
      const newZoom = Math.min(zoom + 0.1, 2);
      setZoom(newZoom);
      onZoomChange?.(newZoom);
    }, [zoom, onZoomChange]);

    const handleZoomOut = useCallback(() => {
      const newZoom = Math.max(zoom - 0.1, 0.1);
      setZoom(newZoom);
      onZoomChange?.(newZoom);
    }, [zoom, onZoomChange]);

    const handleZoomReset = useCallback(() => {
      setZoom(1);
      setPan({ x: 0, y: 0 });
      onZoomChange?.(1);
    }, [onZoomChange]);

    // Handle wheel zoom (Ctrl + middle mouse wheel)
    const handleWheel = useCallback(
      (e: React.WheelEvent) => {
        // Only zoom when Ctrl key is held
        if (!e.ctrlKey) return;

        e.preventDefault();

        // deltaY > 0 means scrolling down (zoom out)
        // deltaY < 0 means scrolling up (zoom in)
        if (e.deltaY < 0) {
          handleZoomIn();
        } else if (e.deltaY > 0) {
          handleZoomOut();
        }
      },
      [handleZoomIn, handleZoomOut]
    );

    // Handle element click
    const handleElementClick = useCallback(
      (e: React.MouseEvent, element: CanvasElement) => {
        // In demo mode, let clicks pass through to interactive components
        if (!editable || isDemoMode) return;
        e.stopPropagation();

        if (e.shiftKey) {
          // Multi-select
          const newSelection = selectedIds.includes(element.id)
            ? selectedIds.filter((id) => id !== element.id)
            : [...selectedIds, element.id];
          onSelect?.(newSelection);
        } else {
          onSelect?.([element.id]);
        }
      },
      [editable, isDemoMode, selectedIds, onSelect]
    );

    // Handle canvas click (deselect)
    const handleCanvasClick = useCallback(
      (e: React.MouseEvent) => {
        if (e.target === canvasRef.current) {
          onSelect?.([]);
        }
      },
      [onSelect]
    );

    // Handle drag start
    const handleDragStart = useCallback(
      (e: React.MouseEvent, element: CanvasElement) => {
        if (!editable || element.locked || isDemoMode) return;
        e.preventDefault();
        setIsDragging(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      },
      [editable, isDemoMode]
    );

    // Handle drag
    const handleDrag = useCallback(
      (e: React.MouseEvent) => {
        if (!isDragging || !dragStart || selectedIds.length === 0) return;

        const dx = (e.clientX - dragStart.x) / zoom;
        const dy = (e.clientY - dragStart.y) / zoom;

        selectedIds.forEach((id) => {
          const element = getElementById(id);
          if (element && !element.locked) {
            const newBounds = {
              ...element.bounds,
              x: snapToGrid(element.bounds.x + dx),
              y: snapToGrid(element.bounds.y + dy),
            };
            onMove?.(id, newBounds);
          }
        });

        setDragStart({ x: e.clientX, y: e.clientY });
      },
      [isDragging, dragStart, selectedIds, zoom, getElementById, snapToGrid, onMove]
    );

    // Handle drag end
    const handleDragEnd = useCallback(() => {
      setIsDragging(false);
      setDragStart(null);
    }, []);

    // ===== RESIZE HANDLERS =====
    // Material Design minimum touch target: 48dp
    const MIN_SIZE = 48;

    // Handle resize start
    const handleResizeStart = useCallback(
      (e: React.MouseEvent, element: CanvasElement, direction: string) => {
        if (!editable || element.locked) return;
        e.preventDefault();
        e.stopPropagation();
        setIsResizing(true);
        setResizeDirection(direction);
        setResizeStart({ x: e.clientX, y: e.clientY });
        setResizeInitialBounds({ ...element.bounds });
        setResizeElementId(element.id);
      },
      [editable]
    );

    // Handle resize drag
    const handleResizeMove = useCallback(
      (e: React.MouseEvent) => {
        if (!isResizing || !resizeStart || !resizeInitialBounds || !resizeDirection || !resizeElementId) return;

        const dx = (e.clientX - resizeStart.x) / zoom;
        const dy = (e.clientY - resizeStart.y) / zoom;

        let newBounds = { ...resizeInitialBounds };

        // Apply resize based on direction
        if (resizeDirection.includes('e')) {
          newBounds.width = Math.max(MIN_SIZE, snapToGrid(resizeInitialBounds.width + dx));
        }
        if (resizeDirection.includes('w')) {
          const newWidth = Math.max(MIN_SIZE, snapToGrid(resizeInitialBounds.width - dx));
          const widthDelta = resizeInitialBounds.width - newWidth;
          newBounds.x = snapToGrid(resizeInitialBounds.x + widthDelta);
          newBounds.width = newWidth;
        }
        if (resizeDirection.includes('s')) {
          newBounds.height = Math.max(MIN_SIZE, snapToGrid(resizeInitialBounds.height + dy));
        }
        if (resizeDirection.includes('n')) {
          const newHeight = Math.max(MIN_SIZE, snapToGrid(resizeInitialBounds.height - dy));
          const heightDelta = resizeInitialBounds.height - newHeight;
          newBounds.y = snapToGrid(resizeInitialBounds.y + heightDelta);
          newBounds.height = newHeight;
        }

        onResize?.(resizeElementId, newBounds);
      },
      [isResizing, resizeStart, resizeInitialBounds, resizeDirection, resizeElementId, zoom, snapToGrid, onResize]
    );

    // Handle resize end
    const handleResizeEnd = useCallback(() => {
      setIsResizing(false);
      setResizeDirection(null);
      setResizeStart(null);
      setResizeInitialBounds(null);
      setResizeElementId(null);
    }, []);

    // Handle pan
    const handlePanStart = useCallback(
      (e: React.MouseEvent) => {
        if (tool !== "pan" && !e.buttons) return;
        setIsPanning(true);
        setDragStart({ x: e.clientX, y: e.clientY });
      },
      [tool]
    );

    const handlePanMove = useCallback(
      (e: React.MouseEvent) => {
        if (!isPanning || !dragStart) return;

        const dx = e.clientX - dragStart.x;
        const dy = e.clientY - dragStart.y;

        setPan((prev) => ({
          x: prev.x + dx,
          y: prev.y + dy,
        }));

        setDragStart({ x: e.clientX, y: e.clientY });
      },
      [isPanning, dragStart]
    );

    const handlePanEnd = useCallback(() => {
      setIsPanning(false);
      setDragStart(null);
    }, []);

    // Handle drop
    const handleCanvasDrop = useCallback(
      (e: React.DragEvent) => {
        e.preventDefault();
        if (!editable) return;

        const data = e.dataTransfer.getData("application/json");
        if (!data) return;

        try {
          const component = JSON.parse(data);
          const rect = canvasRef.current?.getBoundingClientRect();
          if (!rect) return;

          const x = snapToGrid((e.clientX - rect.left - pan.x) / zoom);
          const y = snapToGrid((e.clientY - rect.top - pan.y) / zoom);

          console.log("[CanvasEditor] Dropped component:", component);
          onDrop?.(component, { x, y });
        } catch (err) {
          console.error("Failed to parse dropped data:", err);
        }
      },
      [editable, zoom, pan, snapToGrid, onDrop]
    );

    const handleDragOver = useCallback((e: React.DragEvent) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = "copy";
    }, []);

    // Handle keyboard
    useEffect(() => {
      const handleKeyDown = (e: KeyboardEvent) => {
        if (!editable) return;

        // Check if the user is typing in an input field - allow normal behavior
        const activeElement = document.activeElement;
        const isInputElement =
          activeElement instanceof HTMLInputElement ||
          activeElement instanceof HTMLTextAreaElement ||
          activeElement?.getAttribute('contenteditable') === 'true';

        if (isInputElement) {
          // Allow all keyboard events to pass through to input elements
          return;
        }

        if (e.key === "Delete" || e.key === "Backspace") {
          if (selectedIds.length > 0) {
            onDelete?.(selectedIds);
          }
        }

        if (e.key === "Escape") {
          onSelect?.([]);
        }

        // Arrow keys for moving
        if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
          e.preventDefault();
          const delta = e.shiftKey ? gridSettings.size * 4 : gridSettings.size;
          selectedIds.forEach((id) => {
            const element = getElementById(id);
            if (element && !element.locked) {
              const newBounds = { ...element.bounds };
              switch (e.key) {
                case "ArrowUp":
                  newBounds.y -= delta;
                  break;
                case "ArrowDown":
                  newBounds.y += delta;
                  break;
                case "ArrowLeft":
                  newBounds.x -= delta;
                  break;
                case "ArrowRight":
                  newBounds.x += delta;
                  break;
              }
              onMove?.(id, newBounds);
            }
          });
        }
      };

      window.addEventListener("keydown", handleKeyDown);
      return () => window.removeEventListener("keydown", handleKeyDown);
    }, [editable, selectedIds, gridSettings.size, getElementById, onDelete, onSelect, onMove]);


    // Container styles
    const containerStyles = [
      "flex",
      "flex-col",
      "h-full",
      "bg-neutral-200",
      "rounded-lg",
      "overflow-hidden",
      className,
    ].join(" ");

    // Render element recursively
    const renderElement = (element: CanvasElement): React.ReactNode => {
      const isSelected = selectedIds.includes(element.id);
      if (element.visible === false) return null;

      // Get component code if this is a component-type element
      const componentData = element.type === 'component' && element.componentId && getComponentCode
        ? getComponentCode(element.componentId)
        : null;

      return (
        <div
          key={element.id}
          className={[
            "absolute",
            // In demo mode, let clicks pass through to interactive components
            isDemoMode && "pointer-events-none",
            // Hide debug styling in demo mode
            !isDemoMode && "border-2",
            !isDemoMode && "rounded",
            !isDemoMode && "cursor-move",
            "transition-shadow",
            "duration-150",
            !isDemoMode && elementTypeColors[element.type],
            isSelected && !isDemoMode && "ring-2 ring-primary-500 ring-offset-2",
            element.locked && !isDemoMode && "opacity-50 cursor-not-allowed",
          ]
            .filter(Boolean)
            .join(" ")}
          style={{
            left: element.bounds.x,
            top: element.bounds.y,
            width: element.bounds.width,
            height: element.bounds.height,
            zIndex: element.zIndex || 0,
          }}
          onClick={(e) => handleElementClick(e, element)}
          onMouseDown={(e) => handleDragStart(e, element)}
        >
          {/* Element label - hidden in demo mode */}
          {!isDemoMode && (
            <div className="absolute -top-5 left-0 px-1 text-xs font-medium text-neutral-600 bg-white rounded shadow-sm truncate max-w-full">
              {element.name}
            </div>
          )}

          {/* Live component preview for component-type elements */}
          <div className={`absolute inset-0 overflow-hidden flex items-center justify-center ${isDemoMode ? "pointer-events-auto" : ""}`}>
            {componentData?.code ? (
              // AI-generated component: use LiveComponentPreview
              <LiveComponentPreview
                code={componentData.code}
                framework={componentData.framework || 'react'}
                className="w-full h-full"
              />
            ) : element.componentId ? (
              // Template/built-in component: use TemplateComponentRenderer
              // This has rich visual previews for all template component types
              <TemplateComponentRenderer
                componentId={element.componentId}
                props={element.props}
                bounds={{ width: element.bounds.width, height: element.bounds.height }}
                demoMode={isDemoMode}
              />
            ) : null}
          </div>


          {/* Resize handles (when selected, hidden in demo mode) */}
          {isSelected && editable && !element.locked && !isDemoMode && (
            <>
              {/* Corner handles */}
              {["nw", "ne", "sw", "se"].map((pos) => (
                <div
                  key={pos}
                  className={[
                    "absolute",
                    "h-3",
                    "w-3",
                    "bg-white",
                    "border-2",
                    "border-primary-500",
                    "rounded-sm",
                    "transition-transform",
                    "duration-100",
                    "hover:scale-125",
                    "hover:shadow-md",
                    "active:scale-110",
                    pos.includes("n") ? "-top-1.5" : "-bottom-1.5",
                    pos.includes("w") ? "-left-1.5" : "-right-1.5",
                    `cursor-${pos}-resize`,
                  ].join(" ")}
                  onMouseDown={(e) => handleResizeStart(e, element, pos)}
                />
              ))}
              {/* Edge handles */}
              {["n", "s", "e", "w"].map((pos) => (
                <div
                  key={pos}
                  className={[
                    "absolute",
                    "bg-white",
                    "border-2",
                    "border-primary-500",
                    "rounded-sm",
                    "transition-transform",
                    "duration-100",
                    "hover:scale-110",
                    "active:scale-100",
                    pos === "n" || pos === "s" ? "h-2 w-4 left-1/2 -translate-x-1/2" : "h-4 w-2 top-1/2 -translate-y-1/2",
                    pos === "n" && "-top-1",
                    pos === "s" && "-bottom-1",
                    pos === "e" && "-right-1",
                    pos === "w" && "-left-1",
                    `cursor-${pos}-resize`,
                  ].join(" ")}
                  onMouseDown={(e) => handleResizeStart(e, element, pos)}
                />
              ))}
            </>
          )}

          {/* Children */}
          {element.children && element.children.length > 0 && (
            <div className="absolute inset-2">
              {element.children.map(renderElement)}
            </div>
          )}
        </div>
      );
    };

    return (
      <div id="canvas-editor" ref={ref} className={containerStyles} {...props}>
        {/* Toolbar */}
        <div className="flex items-center gap-2 p-2 bg-white border-b border-neutral-200">
          {/* Tool buttons */}
          <div className="flex border border-neutral-200 rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setTool("select")}
              className={[
                "p-1.5",
                "transition-colors",
                "duration-150",
                tool === "select"
                  ? "bg-primary-50 text-primary-600"
                  : "text-neutral-500 hover:bg-neutral-50",
              ].join(" ")}
              title="Select tool (V)"
              aria-label="Select tool"
            >
              <CursorIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => setTool("pan")}
              className={[
                "p-1.5",
                "border-l",
                "border-neutral-200",
                "transition-colors",
                "duration-150",
                tool === "pan"
                  ? "bg-primary-50 text-primary-600"
                  : "text-neutral-500 hover:bg-neutral-50",
              ].join(" ")}
              title="Pan tool (H)"
              aria-label="Pan tool"
            >
              <HandIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Grid toggle */}
          <button
            type="button"
            onClick={() => setShowGrid(!showGrid)}
            className={[
              "p-1.5",
              "rounded-md",
              "transition-colors",
              "duration-150",
              showGrid
                ? "bg-primary-50 text-primary-600"
                : "text-neutral-500 hover:bg-neutral-50",
            ].join(" ")}
            title="Toggle grid"
            aria-label="Toggle grid visibility"
          >
            <GridIcon className="h-4 w-4" />
          </button>

          {/* Device selector */}
          <select
            value={currentDevice}
            onChange={(e) => {
              const idx = Number(e.target.value);
              setCurrentDevice(idx);
              const device = devicePresets[idx];
              setEffectiveWidth(device.width);
              setEffectiveHeight(device.height);
              onCanvasSizeChange?.(device.width, device.height);
            }}
            className="px-2 py-1 text-xs border border-neutral-200 rounded-md bg-white text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500"
            aria-label="Select device viewport size"
          >
            {devicePresets.map((device, idx) => (
              <option key={device.name} value={idx}>
                {device.name}
              </option>
            ))}
          </select>

          {/* Template Name Badge (EUR-1.1.10) */}
          {templateName && (
            <div className="flex items-center gap-1.5 px-2.5 py-1 bg-primary-50 border border-primary-200 rounded-md">
              <svg className="h-3.5 w-3.5 text-primary-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              <span className="text-xs font-medium text-primary-700">{templateName}</span>
            </div>
          )}

          {/* Spacer */}
          <div className="flex-1" />

          {/* Zoom controls */}
          <div className="flex items-center gap-1 border border-neutral-200 rounded-md overflow-hidden">
            <button
              type="button"
              onClick={handleZoomOut}
              disabled={zoom <= 0.1}
              className="p-1.5 text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
              title="Zoom out"
              aria-label="Zoom out"
            >
              <ZoomOutIcon className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={handleZoomReset}
              className="px-2 py-1 text-xs font-medium text-neutral-600 hover:bg-neutral-50 min-w-12 text-center"
              title="Reset zoom"
              aria-label="Reset zoom to 100%"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              type="button"
              onClick={handleZoomIn}
              disabled={zoom >= 2}
              className="p-1.5 text-neutral-500 hover:bg-neutral-50 disabled:opacity-50"
              title="Zoom in"
              aria-label="Zoom in"
            >
              <ZoomInIcon className="h-4 w-4" />
            </button>
          </div>

          {/* Demo Mode Toggle */}
          <button
            type="button"
            onClick={toggleDemoMode}
            className={[
              "flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs font-medium transition-colors duration-150",
              isDemoMode
                ? "bg-success-100 text-success-700 border border-success-300"
                : "bg-neutral-100 text-neutral-600 hover:bg-neutral-200 border border-neutral-200",
            ].join(" ")}
            title={isDemoMode ? "Exit Demo Mode" : "Enter Demo Mode - Preview interactive experience"}
            aria-label={isDemoMode ? "Exit demo mode" : "Enter demo mode"}
          >
            {isDemoMode ? (
              <>
                <StopIcon className="h-3.5 w-3.5" />
                <span>Exit Demo</span>
              </>
            ) : (
              <>
                <PlayIcon className="h-3.5 w-3.5" />
                <span>Demo</span>
              </>
            )}
          </button>

          {/* Delete button */}
          {selectedIds.length > 0 && editable && (
            <button
              type="button"
              onClick={() => onDelete?.(selectedIds)}
              className="p-1.5 rounded-md text-error-500 hover:bg-error-50 transition-colors duration-150"
              title="Delete selected"
              aria-label="Delete selected elements"
            >
              <TrashIcon className="h-4 w-4" />
            </button>
          )}

          {/* Undo button */}
          {editable && (
            <button
              type="button"
              onClick={() => onUndo?.()}
              disabled={!canUndo}
              className={[
                "p-1.5 rounded-md transition-colors duration-150",
                canUndo
                  ? "text-neutral-600 hover:bg-neutral-100"
                  : "text-neutral-300 cursor-not-allowed",
              ].join(" ")}
              title="Undo last action (Ctrl+Z)"
              aria-label="Undo last action"
            >
              <UndoIcon className="h-4 w-4" />
            </button>
          )}

          {/* Clear Canvas button */}
          {editable && (
            <button
              type="button"
              onClick={() => onClear?.()}
              disabled={elements.length === 0}
              className={[
                "p-1.5 rounded-md transition-colors duration-150",
                elements.length > 0
                  ? "text-warning-600 hover:bg-warning-50"
                  : "text-neutral-300 cursor-not-allowed",
              ].join(" ")}
              title="Clear canvas"
              aria-label="Clear all elements from canvas"
            >
              <ClearIcon className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Canvas viewport */}
        <div
          ref={viewportRef}
          className={[
            "flex-1",
            "overflow-hidden",
            "relative",
            "p-4",
            tool === "pan" && "cursor-grab",
            isPanning && "cursor-grabbing",
          ]
            .filter(Boolean)
            .join(" ")}
          onMouseDown={tool === "pan" ? handlePanStart : undefined}
          onMouseMove={
            isResizing ? handleResizeMove :
              isPanning ? handlePanMove :
                isDragging ? handleDrag :
                  undefined
          }
          onMouseUp={() => {
            handlePanEnd();
            handleDragEnd();
            handleResizeEnd();
          }}
          onMouseLeave={() => {
            handlePanEnd();
            handleDragEnd();
            handleResizeEnd();
          }}
          onWheel={handleWheel}
        >
          {/* Canvas with theme applied - uses canvasTheme (project theme), NOT App Factory theme */}
          <div
            ref={canvasRef}
            className="absolute shadow-xl"
            style={{
              ...canvasThemeStyles,
              width: effectiveWidth,
              height: effectiveHeight,
              transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
              transformOrigin: "0 0",
            }}
            onClick={handleCanvasClick}
            onDrop={handleCanvasDrop}
            onDragOver={handleDragOver}
          >
            {/* Grid */}
            {showGrid && (
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: `
                    linear-gradient(to right, var(--color-neutral-100) 1px, transparent 1px),
                    linear-gradient(to bottom, var(--color-neutral-100) 1px, transparent 1px)
                  `,
                  backgroundSize: `${gridSettings.size}px ${gridSettings.size}px`,
                }}
              />
            )}

            {/* Elements */}
            {elements.map(renderElement)}
          </div>
        </div>

        {/* Status bar */}
        <div className="flex items-center justify-between px-3 py-1.5 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500">
          <span>
            Canvas: {effectiveWidth}×{effectiveHeight}px
          </span>
          <span>
            {selectedIds.length > 0
              ? `${selectedIds.length} element${selectedIds.length > 1 ? "s" : ""} selected`
              : `${elements.length} element${elements.length !== 1 ? "s" : ""}`}
          </span>
          <span>Grid: {gridSettings.size}px</span>
        </div>
      </div >
    );
  }
);

CanvasEditor.displayName = "CanvasEditor";

export default CanvasEditor;
