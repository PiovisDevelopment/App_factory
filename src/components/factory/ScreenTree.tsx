/**
 * D048 - src/components/factory/ScreenTree.tsx
 * ==============================================
 * Screen/widget tree view for hierarchical structure display.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { forwardRef, useState, useCallback, type HTMLAttributes } from "react";

/**
 * Tree node types.
 */
export type TreeNodeType = "screen" | "widget" | "container" | "component" | "slot";

/**
 * Tree node definition.
 */
export interface TreeNode {
  /** Unique node ID */
  id: string;
  /** Display name */
  name: string;
  /** Node type */
  type: TreeNodeType;
  /** Child nodes */
  children?: TreeNode[];
  /** Whether node is expanded */
  expanded?: boolean;
  /** Whether node is locked */
  locked?: boolean;
  /** Whether node is visible */
  visible?: boolean;
  /** Whether node is droppable */
  droppable?: boolean;
  /** Component/plugin reference */
  componentRef?: string;
  /** Additional metadata */
  meta?: Record<string, unknown>;
}

/**
 * ScreenTree component props.
 */
export interface ScreenTreeProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Tree data */
  nodes: TreeNode[];
  /** Selected node IDs */
  selectedIds?: string[];
  /** Callback when node is selected */
  onSelect?: (ids: string[]) => void;
  /** Callback when node is expanded/collapsed */
  onToggle?: (id: string, expanded: boolean) => void;
  /** Callback when node visibility changes */
  onVisibilityChange?: (id: string, visible: boolean) => void;
  /** Callback when node lock changes */
  onLockChange?: (id: string, locked: boolean) => void;
  /** Callback when node is moved (drag & drop) */
  onMove?: (nodeId: string, targetId: string, position: "before" | "after" | "inside") => void;
  /** Callback when node is deleted */
  onDelete?: (id: string) => void;
  /** Callback when node is renamed */
  onRename?: (id: string, name: string) => void;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Whether drag and drop is enabled */
  draggable?: boolean;
  /** Show search input */
  showSearch?: boolean;
  /** Show visibility toggles */
  showVisibility?: boolean;
  /** Show lock toggles */
  showLock?: boolean;
  /** Empty message */
  emptyMessage?: string;
}

/**
 * Chevron icon.
 */
const ChevronIcon: React.FC<{ className?: string; expanded?: boolean }> = ({
  className,
  expanded,
}) => (
  <svg
    className={[className, "transition-transform duration-150", expanded && "rotate-90"]
      .filter(Boolean)
      .join(" ")}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="9 18 15 12 9 6" />
  </svg>
);

/**
 * Eye icon (visible).
 */
const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * Eye off icon (hidden).
 */
const EyeOffIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/**
 * Lock icon.
 */
const LockIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/**
 * Unlock icon.
 */
const UnlockIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
  </svg>
);

/**
 * Search icon.
 */
const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="m21 21-4.3-4.3" />
  </svg>
);

/**
 * Node type icons.
 */
const nodeTypeIcons: Record<TreeNodeType, React.FC<{ className?: string }>> = {
  screen: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  widget: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  ),
  container: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <rect x="7" y="7" width="10" height="10" rx="1" ry="1" />
    </svg>
  ),
  component: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 22 8.5 22 15.5 12 22 2 15.5 2 8.5 12 2" />
      <line x1="12" y1="22" x2="12" y2="15.5" />
      <polyline points="22 8.5 12 15.5 2 8.5" />
    </svg>
  ),
  slot: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" strokeDasharray="4 2" />
      <line x1="12" y1="8" x2="12" y2="16" />
      <line x1="8" y1="12" x2="16" y2="12" />
    </svg>
  ),
};

/**
 * Node type colors.
 */
const nodeTypeColors: Record<TreeNodeType, string> = {
  screen: "text-primary-500",
  widget: "text-success-500",
  container: "text-warning-500",
  component: "text-info-500",
  slot: "text-neutral-400",
};

/**
 * Tree node row component.
 */
interface TreeNodeRowProps {
  node: TreeNode;
  level: number;
  selectedIds: string[];
  editable: boolean;
  draggable: boolean;
  showVisibility: boolean;
  showLock: boolean;
  onSelect: (ids: string[]) => void;
  onToggle: (id: string, expanded: boolean) => void;
  onVisibilityChange?: ((id: string, visible: boolean) => void) | undefined;
  onLockChange?: ((id: string, locked: boolean) => void) | undefined;
  onMove?: ((nodeId: string, targetId: string, position: "before" | "after" | "inside") => void) | undefined;
  searchQuery?: string | undefined;
}

const TreeNodeRow: React.FC<TreeNodeRowProps> = ({
  node,
  level,
  selectedIds,
  editable,
  draggable,
  showVisibility,
  showLock,
  onSelect,
  onToggle,
  onVisibilityChange,
  onLockChange,
  onMove,
  searchQuery,
}) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const [dropPosition, setDropPosition] = useState<"before" | "after" | "inside" | null>(null);

  const isSelected = selectedIds.includes(node.id);
  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = node.expanded ?? true;
  const isVisible = node.visible ?? true;
  const isLocked = node.locked ?? false;

  const NodeIcon = nodeTypeIcons[node.type];

  // Check if node matches search
  const matchesSearch =
    !searchQuery || node.name.toLowerCase().includes(searchQuery.toLowerCase());

  // Handle click
  const handleClick = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      if (e.shiftKey) {
        // Multi-select
        if (isSelected) {
          onSelect(selectedIds.filter((id) => id !== node.id));
        } else {
          onSelect([...selectedIds, node.id]);
        }
      } else {
        onSelect([node.id]);
      }
    },
    [node.id, isSelected, selectedIds, onSelect]
  );

  // Handle toggle
  const handleToggle = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onToggle(node.id, !isExpanded);
    },
    [node.id, isExpanded, onToggle]
  );

  // Handle visibility toggle
  const handleVisibility = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onVisibilityChange?.(node.id, !isVisible);
    },
    [node.id, isVisible, onVisibilityChange]
  );

  // Handle lock toggle
  const handleLock = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      onLockChange?.(node.id, !isLocked);
    },
    [node.id, isLocked, onLockChange]
  );

  // Drag handlers
  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!draggable) return;
      e.dataTransfer.setData("text/plain", node.id);
      e.dataTransfer.effectAllowed = "move";
    },
    [draggable, node.id]
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!draggable || !node.droppable) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";
      setIsDragOver(true);

      // Determine drop position based on mouse position
      const rect = (e.target as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const height = rect.height;

      if (y < height * 0.25) {
        setDropPosition("before");
      } else if (y > height * 0.75) {
        setDropPosition("after");
      } else {
        setDropPosition("inside");
      }
    },
    [draggable, node.droppable]
  );

  const handleDragLeave = useCallback(() => {
    setIsDragOver(false);
    setDropPosition(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      setDropPosition(null);

      const draggedId = e.dataTransfer.getData("text/plain");
      if (draggedId && draggedId !== node.id && dropPosition) {
        onMove?.(draggedId, node.id, dropPosition);
      }
    },
    [node.id, dropPosition, onMove]
  );

  if (!matchesSearch && !hasChildren) return null;

  const rowStyles = [
    "group",
    "flex",
    "items-center",
    "gap-1",
    "h-8",
    "px-2",
    "rounded-md",
    "cursor-pointer",
    "transition-colors",
    "duration-150",
    isSelected ? "bg-primary-100 text-primary-900" : "hover:bg-neutral-100",
    !isVisible && "opacity-50",
    isDragOver && dropPosition === "inside" && "ring-2 ring-primary-500 ring-inset",
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div>
      {/* Drop indicator (before) */}
      {isDragOver && dropPosition === "before" && (
        <div className="h-0.5 bg-primary-500 mx-2 rounded-full" />
      )}

      {/* Node row */}
      <div
        className={rowStyles}
        style={{ paddingLeft: `${level * 16 + 8}px` }}
        onClick={handleClick}
        draggable={draggable && !isLocked}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Expand/collapse button */}
        <button
          type="button"
          onClick={handleToggle}
          className={[
            "p-0.5",
            "rounded",
            "hover:bg-neutral-200",
            !hasChildren && "invisible",
          ].join(" ")}
        >
          <ChevronIcon className="h-3 w-3 text-neutral-400" expanded={isExpanded} />
        </button>

        {/* Node icon */}
        <NodeIcon className={["h-4 w-4", nodeTypeColors[node.type]].join(" ")} />

        {/* Node name */}
        <span className="flex-1 text-sm truncate">{node.name}</span>

        {/* Action buttons (show on hover) */}
        <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity duration-150">
          {/* Visibility toggle */}
          {showVisibility && (
            <button
              type="button"
              onClick={handleVisibility}
              className="p-1 rounded hover:bg-neutral-200"
              title={isVisible ? "Hide" : "Show"}
            >
              {isVisible ? (
                <EyeIcon className="h-3.5 w-3.5 text-neutral-400" />
              ) : (
                <EyeOffIcon className="h-3.5 w-3.5 text-neutral-400" />
              )}
            </button>
          )}

          {/* Lock toggle */}
          {showLock && editable && (
            <button
              type="button"
              onClick={handleLock}
              className="p-1 rounded hover:bg-neutral-200"
              title={isLocked ? "Unlock" : "Lock"}
            >
              {isLocked ? (
                <LockIcon className="h-3.5 w-3.5 text-neutral-400" />
              ) : (
                <UnlockIcon className="h-3.5 w-3.5 text-neutral-400" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Drop indicator (after) */}
      {isDragOver && dropPosition === "after" && (
        <div className="h-0.5 bg-primary-500 mx-2 rounded-full" />
      )}

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <TreeNodeRow
              key={child.id}
              node={child}
              level={level + 1}
              selectedIds={selectedIds}
              editable={editable}
              draggable={draggable}
              showVisibility={showVisibility}
              showLock={showLock}
              onSelect={onSelect}
              onToggle={onToggle}
              onVisibilityChange={onVisibilityChange}
              onLockChange={onLockChange}
              onMove={onMove}
              searchQuery={searchQuery}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * ScreenTree component.
 *
 * A hierarchical tree view for displaying and managing screens,
 * widgets, and components with drag-and-drop support.
 *
 * @example
 * ```tsx
 * <ScreenTree
 *   nodes={screenHierarchy}
 *   selectedIds={[selectedId]}
 *   onSelect={(ids) => setSelectedId(ids[0])}
 *   onMove={(nodeId, targetId, pos) => moveNode(nodeId, targetId, pos)}
 *   editable
 *   draggable
 * />
 * ```
 */
export const ScreenTree = forwardRef<HTMLDivElement, ScreenTreeProps>(
  (
    {
      nodes,
      selectedIds = [],
      onSelect,
      onToggle,
      onVisibilityChange,
      onLockChange,
      onMove,
      onDelete,
      onRename,
      editable = true,
      draggable = true,
      showSearch = true,
      showVisibility = true,
      showLock = true,
      emptyMessage = "No screens or widgets",
      className = "",
      ...props
    },
    ref
  ) => {
    const [searchQuery, setSearchQuery] = useState("");

    // Handle select
    const handleSelect = useCallback(
      (ids: string[]) => {
        onSelect?.(ids);
      },
      [onSelect]
    );

    // Handle toggle
    const handleToggle = useCallback(
      (id: string, expanded: boolean) => {
        onToggle?.(id, expanded);
      },
      [onToggle]
    );

    // Count total nodes
    const countNodes = (nodeList: TreeNode[]): number => {
      return nodeList.reduce((acc, node) => {
        return acc + 1 + (node.children ? countNodes(node.children) : 0);
      }, 0);
    };

    const totalNodes = countNodes(nodes);

    // Container styles
    const containerStyles = [
      "flex",
      "flex-col",
      "h-full",
      "bg-white",
      "border",
      "border-neutral-200",
      "rounded-lg",
      "overflow-hidden",
      className,
    ].join(" ");

    return (
      <div ref={ref} className={containerStyles} {...props}>
        {/* Header */}
        <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-200">
          <h3 className="text-sm font-semibold text-neutral-900">Structure</h3>
        </div>

        {/* Search */}
        {showSearch && nodes.length > 0 && (
          <div className="px-3 py-2 border-b border-neutral-100">
            <div className="relative">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className={[
                  "w-full",
                  "pl-8",
                  "pr-3",
                  "py-1.5",
                  "text-sm",
                  "bg-neutral-50",
                  "border",
                  "border-neutral-200",
                  "rounded-md",
                  "focus:outline-none",
                  "focus:ring-2",
                  "focus:ring-primary-500",
                  "focus:border-transparent",
                  "placeholder:text-neutral-400",
                ].join(" ")}
              />
            </div>
          </div>
        )}

        {/* Tree content */}
        <div className="flex-1 overflow-auto p-2">
          {/* Empty state */}
          {nodes.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center py-8">
              <div className="h-12 w-12 mb-3 text-neutral-300">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
              <p className="text-sm text-neutral-500">{emptyMessage}</p>
            </div>
          )}

          {/* Tree nodes */}
          {nodes.map((node) => (
            <TreeNodeRow
              key={node.id}
              node={node}
              level={0}
              selectedIds={selectedIds}
              editable={editable}
              draggable={draggable}
              showVisibility={showVisibility}
              showLock={showLock}
              onSelect={handleSelect}
              onToggle={handleToggle}
              onVisibilityChange={onVisibilityChange}
              onLockChange={onLockChange}
              onMove={onMove}
              searchQuery={searchQuery}
            />
          ))}
        </div>

        {/* Footer */}
        <div className="px-3 py-1.5 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500">
          {totalNodes} item{totalNodes !== 1 ? "s" : ""}
          {selectedIds.length > 0 && ` • ${selectedIds.length} selected`}
        </div>
      </div>
    );
  }
);

ScreenTree.displayName = "ScreenTree";

export default ScreenTree;
