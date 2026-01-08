/**
 * D066 - src/components/project/PluginSlotManager.tsx
 * ====================================================
 * Component for managing plugin slots within a project.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D014 (Panel.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { useState, useCallback, useMemo, type HTMLAttributes } from "react";

/**
 * Plugin slot configuration.
 */
export interface PluginSlot {
  id: string;
  name: string;
  contract: string;
  description?: string;
  assignedPluginId?: string;
  assignedPluginName?: string;
  assignedPluginVersion?: string;
  isRequired: boolean;
  isMultiple: boolean;
  fallbackPluginId?: string;
  position: "header" | "sidebar" | "main" | "footer" | "overlay" | "custom";
  priority: number;
  status: "empty" | "assigned" | "error" | "disabled";
  lastAssigned?: Date;
}

/**
 * Available plugin for assignment.
 */
export interface AvailablePlugin {
  id: string;
  name: string;
  displayName: string;
  contract: string;
  version: string;
  status: "loaded" | "unloaded" | "error";
  isCompatible: boolean;
  incompatibilityReason?: string;
}

/**
 * PluginSlotManager component props.
 */
export interface PluginSlotManagerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Available slots */
  slots: PluginSlot[];
  /** Available plugins for assignment */
  availablePlugins: AvailablePlugin[];
  /** Currently selected slot ID */
  selectedSlotId?: string;
  /** Callback when slot is selected */
  onSelectSlot?: (slot: PluginSlot) => void;
  /** Callback when plugin is assigned to slot */
  onAssignPlugin?: (slotId: string, pluginId: string) => void;
  /** Callback when plugin is unassigned from slot */
  onUnassignPlugin?: (slotId: string) => void;
  /** Callback when slot is added */
  onAddSlot?: () => void;
  /** Callback when slot is removed */
  onRemoveSlot?: (slotId: string) => void;
  /** Callback when swap plugin is requested */
  onSwapPlugin?: (slotId: string) => void;
  /** Callback when slot priority is changed */
  onChangePriority?: (slotId: string, direction: "up" | "down") => void;
  /** Whether manager is read-only */
  readOnly?: boolean;
  /** Filter by contract type */
  contractFilter?: string;
  /** Filter by position */
  positionFilter?: string;
}

/**
 * Contract icons.
 */
const ContractIcons: Record<string, React.FC<{ className?: string }>> = {
  tts: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  stt: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14M15.54 8.46a5 5 0 0 1 0 7.07" />
    </svg>
  ),
  llm: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  ),
  mcp: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="4" y="4" width="16" height="16" rx="2" ry="2" />
      <rect x="9" y="9" width="6" height="6" />
      <line x1="9" y1="1" x2="9" y2="4" />
      <line x1="15" y1="1" x2="15" y2="4" />
      <line x1="9" y1="20" x2="9" y2="23" />
      <line x1="15" y1="20" x2="15" y2="23" />
      <line x1="20" y1="9" x2="23" y2="9" />
      <line x1="20" y1="14" x2="23" y2="14" />
      <line x1="1" y1="9" x2="4" y2="9" />
      <line x1="1" y1="14" x2="4" y2="14" />
    </svg>
  ),
  default: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
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
 * Swap icon.
 */
const SwapIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="17 1 21 5 17 9" />
    <path d="M3 11V9a4 4 0 0 1 4-4h14" />
    <polyline points="7 23 3 19 7 15" />
    <path d="M21 13v2a4 4 0 0 1-4 4H3" />
  </svg>
);

/**
 * Chevron up icon.
 */
const ChevronUpIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="18 15 12 9 6 15" />
  </svg>
);

/**
 * Chevron down icon.
 */
const ChevronDownIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/**
 * Link icon.
 */
const LinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

/**
 * Unlink icon.
 */
const UnlinkIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M18.84 12.25l1.72-1.71a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M5.16 11.75l-1.72 1.71a5 5 0 0 0 7.07 7.07l1.72-1.71" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/**
 * Contract colors.
 */
const contractColors: Record<string, string> = {
  tts: "bg-primary-100 text-primary-700 border-primary-200",
  stt: "bg-success-50 text-success-700 border-success-200",
  llm: "bg-warning-50 text-warning-700 border-warning-200",
  mcp: "bg-info-50 text-info-700 border-info-200",
  default: "bg-neutral-100 text-neutral-700 border-neutral-200",
};

/**
 * Status colors.
 */
const statusColors: Record<PluginSlot["status"], string> = {
  empty: "border-neutral-300 bg-neutral-50",
  assigned: "border-success-300 bg-success-50",
  error: "border-error-300 bg-error-50",
  disabled: "border-neutral-200 bg-neutral-100 opacity-60",
};

/**
 * Status labels.
 */
const statusLabels: Record<PluginSlot["status"], string> = {
  empty: "Empty",
  assigned: "Assigned",
  error: "Error",
  disabled: "Disabled",
};

/**
 * Position labels.
 */
const positionLabels: Record<PluginSlot["position"], string> = {
  header: "Header",
  sidebar: "Sidebar",
  main: "Main",
  footer: "Footer",
  overlay: "Overlay",
  custom: "Custom",
};

/**
 * PluginSlotManager component.
 *
 * Manages plugin slots allowing assignment, swapping, and configuration
 * of plugins within the project.
 *
 * @example
 * ```tsx
 * <PluginSlotManager
 *   slots={projectSlots}
 *   availablePlugins={loadedPlugins}
 *   selectedSlotId={selectedSlot}
 *   onSelectSlot={(slot) => setSelectedSlot(slot.id)}
 *   onAssignPlugin={(slotId, pluginId) => assignPlugin(slotId, pluginId)}
 *   onSwapPlugin={(slotId) => showSwapModal(slotId)}
 * />
 * ```
 */
export const PluginSlotManager: React.FC<PluginSlotManagerProps> = ({
  slots,
  availablePlugins,
  selectedSlotId,
  onSelectSlot,
  onAssignPlugin,
  onUnassignPlugin,
  onAddSlot,
  onRemoveSlot,
  onSwapPlugin,
  onChangePriority,
  readOnly = false,
  contractFilter,
  positionFilter,
  className = "",
  ...props
}) => {
  // View mode
  const [viewMode, setViewMode] = useState<"list" | "grid">("list");

  // Expanded slot details
  const [expandedSlotId, setExpandedSlotId] = useState<string | null>(null);

  // Filter slots
  const filteredSlots = useMemo(() => {
    return slots.filter((slot) => {
      if (contractFilter && slot.contract !== contractFilter) return false;
      if (positionFilter && slot.position !== positionFilter) return false;
      return true;
    });
  }, [slots, contractFilter, positionFilter]);

  // Sort by priority
  const sortedSlots = useMemo(() => {
    return [...filteredSlots].sort((a, b) => a.priority - b.priority);
  }, [filteredSlots]);



  // Get compatible plugins for a slot
  const getCompatiblePlugins = useCallback(
    (slot: PluginSlot) => {
      return availablePlugins.filter(
        (plugin) => plugin.contract === slot.contract && plugin.isCompatible
      );
    },
    [availablePlugins]
  );

  // Handle slot click
  const handleSlotClick = useCallback(
    (slot: PluginSlot) => {
      onSelectSlot?.(slot);
    },
    [onSelectSlot]
  );

  // Toggle slot expansion
  const toggleSlotExpansion = useCallback((slotId: string) => {
    setExpandedSlotId((prev) => (prev === slotId ? null : slotId));
  }, []);

  // Get contract icon
  const getContractIcon = (contract: string) => {
    return ContractIcons[contract] ?? ContractIcons["default"]!;
  };

  // Container styles
  const containerStyles = [
    "flex",
    "flex-col",
    "h-full",
    "bg-white",
    "rounded-lg",
    "border",
    "border-neutral-200",
    "overflow-hidden",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerStyles} {...props}>
      {/* Header */}
      <div className="p-4 border-b border-neutral-200 bg-neutral-50">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-neutral-900">
            Plugin Slots
          </h3>
          <div className="flex items-center gap-2">
            {/* View toggle */}
            <div className="flex rounded-md border border-neutral-300 overflow-hidden">
              <button
                type="button"
                onClick={() => setViewMode("list")}
                className={[
                  "px-2",
                  "py-1",
                  viewMode === "list"
                    ? "bg-neutral-200 text-neutral-900"
                    : "bg-white text-neutral-500 hover:bg-neutral-50",
                ].join(" ")}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <line x1="8" y1="6" x2="21" y2="6" />
                  <line x1="8" y1="12" x2="21" y2="12" />
                  <line x1="8" y1="18" x2="21" y2="18" />
                  <line x1="3" y1="6" x2="3.01" y2="6" />
                  <line x1="3" y1="12" x2="3.01" y2="12" />
                  <line x1="3" y1="18" x2="3.01" y2="18" />
                </svg>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={[
                  "px-2",
                  "py-1",
                  viewMode === "grid"
                    ? "bg-neutral-200 text-neutral-900"
                    : "bg-white text-neutral-500 hover:bg-neutral-50",
                ].join(" ")}
              >
                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="7" height="7" />
                  <rect x="14" y="3" width="7" height="7" />
                  <rect x="14" y="14" width="7" height="7" />
                  <rect x="3" y="14" width="7" height="7" />
                </svg>
              </button>
            </div>

            {/* Add slot button */}
            <button
              type="button"
              onClick={onAddSlot}
              disabled={readOnly}
              className={[
                "inline-flex",
                "items-center",
                "gap-1",
                "px-3",
                "py-1.5",
                "text-sm",
                "font-medium",
                "text-white",
                "bg-primary-600",
                "rounded-md",
                "hover:bg-primary-700",
                "disabled:opacity-50",
                "transition-colors",
                "duration-150",
              ].join(" ")}
            >
              <PlusIcon className="h-4 w-4" />
              Add Slot
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="flex gap-4 text-xs text-neutral-500">
          <span>{slots.length} total slots</span>
          <span>{slots.filter((s) => s.status === "assigned").length} assigned</span>
          <span>{slots.filter((s) => s.status === "empty").length} empty</span>
        </div>
      </div>

      {/* Slot list */}
      <div className="flex-1 overflow-y-auto">
        {sortedSlots.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-12 text-center">
            <LinkIcon className="h-12 w-12 text-neutral-300 mb-4" />
            <p className="text-sm text-neutral-500 mb-4">
              No plugin slots defined. Add a slot to connect plugins.
            </p>
            {!readOnly && (
              <button
                type="button"
                onClick={onAddSlot}
                className={[
                  "inline-flex",
                  "items-center",
                  "gap-1",
                  "px-4",
                  "py-2",
                  "text-sm",
                  "font-medium",
                  "text-white",
                  "bg-primary-600",
                  "rounded-md",
                  "hover:bg-primary-700",
                ].join(" ")}
              >
                <PlusIcon className="h-4 w-4" />
                Add First Slot
              </button>
            )}
          </div>
        ) : viewMode === "list" ? (
          <ul className="divide-y divide-neutral-100">
            {sortedSlots.map((slot, index) => {
              const ContractIcon = getContractIcon(slot.contract);
              const isExpanded = expandedSlotId === slot.id;
              const compatiblePlugins = getCompatiblePlugins(slot);

              return (
                <li key={slot.id}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleSlotClick(slot)}
                    onKeyDown={(e) => e.key === "Enter" && handleSlotClick(slot)}
                    className={[
                      "p-4",
                      "cursor-pointer",
                      "transition-colors",
                      "duration-150",
                      selectedSlotId === slot.id
                        ? "bg-primary-50"
                        : "hover:bg-neutral-50",
                    ].join(" ")}
                  >
                    <div className="flex items-start gap-3">
                      {/* Contract icon */}
                      <div
                        className={[
                          "flex",
                          "items-center",
                          "justify-center",
                          "h-10",
                          "w-10",
                          "rounded-lg",
                          "border",
                          contractColors[slot.contract] ?? contractColors["default"]!,
                        ].join(" ")}
                      >
                        <ContractIcon className="h-5 w-5" />
                      </div>

                      {/* Slot info */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h4 className="text-sm font-medium text-neutral-900 truncate">
                            {slot.name}
                          </h4>
                          {slot.isRequired && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-error-50 text-error-700 rounded">
                              Required
                            </span>
                          )}
                          {slot.isMultiple && (
                            <span className="px-1.5 py-0.5 text-xs font-medium bg-info-50 text-info-700 rounded">
                              Multiple
                            </span>
                          )}
                        </div>

                        {slot.description && (
                          <p className="mt-0.5 text-xs text-neutral-500 truncate">
                            {slot.description}
                          </p>
                        )}

                        <div className="mt-2 flex items-center gap-3 text-xs text-neutral-400">
                          <span className="uppercase font-medium">
                            {slot.contract}
                          </span>
                          <span>{positionLabels[slot.position]}</span>
                          <span>Priority: {slot.priority}</span>
                        </div>

                        {/* Assigned plugin */}
                        {slot.assignedPluginId && (
                          <div className="mt-2 flex items-center gap-2">
                            <LinkIcon className="h-3.5 w-3.5 text-success-500" />
                            <span className="text-sm text-neutral-700">
                              {slot.assignedPluginName}
                            </span>
                            <span className="text-xs text-neutral-400">
                              v{slot.assignedPluginVersion}
                            </span>
                          </div>
                        )}
                      </div>

                      {/* Status badge */}
                      <div className="flex flex-col items-end gap-2">
                        <span
                          className={[
                            "px-2",
                            "py-1",
                            "text-xs",
                            "font-medium",
                            "rounded-full",
                            "border",
                            statusColors[slot.status],
                          ].join(" ")}
                        >
                          {statusLabels[slot.status]}
                        </span>

                        {/* Actions */}
                        <div className="flex items-center gap-1">
                          {slot.assignedPluginId ? (
                            <>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onSwapPlugin?.(slot.id);
                                }}
                                disabled={readOnly}
                                className={[
                                  "p-1",
                                  "rounded",
                                  "text-neutral-400",
                                  "hover:text-primary-600",
                                  "hover:bg-primary-50",
                                  "disabled:opacity-50",
                                ].join(" ")}
                                title="Swap plugin"
                              >
                                <SwapIcon className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onUnassignPlugin?.(slot.id);
                                }}
                                disabled={readOnly}
                                className={[
                                  "p-1",
                                  "rounded",
                                  "text-neutral-400",
                                  "hover:text-error-600",
                                  "hover:bg-error-50",
                                  "disabled:opacity-50",
                                ].join(" ")}
                                title="Unassign plugin"
                              >
                                <UnlinkIcon className="h-4 w-4" />
                              </button>
                            </>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleSlotExpansion(slot.id);
                              }}
                              disabled={readOnly || compatiblePlugins.length === 0}
                              className={[
                                "p-1",
                                "rounded",
                                "text-neutral-400",
                                "hover:text-success-600",
                                "hover:bg-success-50",
                                "disabled:opacity-50",
                              ].join(" ")}
                              title="Assign plugin"
                            >
                              <LinkIcon className="h-4 w-4" />
                            </button>
                          )}

                          {/* Priority buttons */}
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onChangePriority?.(slot.id, "up");
                            }}
                            disabled={readOnly || index === 0}
                            className={[
                              "p-1",
                              "rounded",
                              "text-neutral-400",
                              "hover:text-neutral-600",
                              "hover:bg-neutral-100",
                              "disabled:opacity-50",
                            ].join(" ")}
                            title="Move up"
                          >
                            <ChevronUpIcon className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onChangePriority?.(slot.id, "down");
                            }}
                            disabled={readOnly || index === sortedSlots.length - 1}
                            className={[
                              "p-1",
                              "rounded",
                              "text-neutral-400",
                              "hover:text-neutral-600",
                              "hover:bg-neutral-100",
                              "disabled:opacity-50",
                            ].join(" ")}
                            title="Move down"
                          >
                            <ChevronDownIcon className="h-4 w-4" />
                          </button>

                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              onRemoveSlot?.(slot.id);
                            }}
                            disabled={readOnly || slot.isRequired}
                            className={[
                              "p-1",
                              "rounded",
                              "text-neutral-400",
                              "hover:text-error-600",
                              "hover:bg-error-50",
                              "disabled:opacity-50",
                            ].join(" ")}
                            title="Remove slot"
                          >
                            <TrashIcon className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded: Plugin selector */}
                    {isExpanded && (
                      <div className="mt-4 p-3 bg-neutral-50 rounded-lg">
                        <p className="text-xs font-medium text-neutral-500 mb-2">
                          Available Plugins ({compatiblePlugins.length})
                        </p>
                        {compatiblePlugins.length === 0 ? (
                          <p className="text-sm text-neutral-400 italic">
                            No compatible plugins available
                          </p>
                        ) : (
                          <div className="space-y-1">
                            {compatiblePlugins.map((plugin) => (
                              <button
                                key={plugin.id}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onAssignPlugin?.(slot.id, plugin.id);
                                  setExpandedSlotId(null);
                                }}
                                disabled={plugin.status !== "loaded"}
                                className={[
                                  "w-full",
                                  "flex",
                                  "items-center",
                                  "justify-between",
                                  "p-2",
                                  "text-left",
                                  "rounded",
                                  "bg-white",
                                  "border",
                                  "border-neutral-200",
                                  "hover:border-primary-300",
                                  "hover:bg-primary-50",
                                  "disabled:opacity-50",
                                  "disabled:cursor-not-allowed",
                                  "transition-colors",
                                  "duration-150",
                                ].join(" ")}
                              >
                                <div>
                                  <span className="text-sm font-medium text-neutral-900">
                                    {plugin.displayName}
                                  </span>
                                  <span className="ml-2 text-xs text-neutral-400">
                                    v{plugin.version}
                                  </span>
                                </div>
                                <span
                                  className={[
                                    "h-2",
                                    "w-2",
                                    "rounded-full",
                                    plugin.status === "loaded" && "bg-success-500",
                                    plugin.status === "unloaded" && "bg-neutral-400",
                                    plugin.status === "error" && "bg-error-500",
                                  ]
                                    .filter(Boolean)
                                    .join(" ")}
                                />
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          /* Grid view */
          <div className="p-4 grid grid-cols-2 lg:grid-cols-3 gap-4">
            {sortedSlots.map((slot) => {
              const ContractIcon = getContractIcon(slot.contract);

              return (
                <div
                  key={slot.id}
                  role="button"
                  tabIndex={0}
                  onClick={() => handleSlotClick(slot)}
                  onKeyDown={(e) => e.key === "Enter" && handleSlotClick(slot)}
                  className={[
                    "p-4",
                    "rounded-lg",
                    "border-2",
                    "cursor-pointer",
                    "transition-all",
                    "duration-150",
                    selectedSlotId === slot.id
                      ? "border-primary-500 shadow-md"
                      : "border-neutral-200 hover:border-neutral-300",
                    statusColors[slot.status],
                  ].join(" ")}
                >
                  <div className="flex items-center justify-between mb-2">
                    <div
                      className={[
                        "p-2",
                        "rounded-lg",
                        "border",
                        contractColors[slot.contract] || contractColors.default,
                      ].join(" ")}
                    >
                      <ContractIcon className="h-5 w-5" />
                    </div>
                    <span
                      className={[
                        "h-2",
                        "w-2",
                        "rounded-full",
                        slot.status === "assigned" && "bg-success-500",
                        slot.status === "empty" && "bg-neutral-400",
                        slot.status === "error" && "bg-error-500",
                        slot.status === "disabled" && "bg-neutral-300",
                      ]
                        .filter(Boolean)
                        .join(" ")}
                    />
                  </div>

                  <h4 className="text-sm font-medium text-neutral-900 truncate">
                    {slot.name}
                  </h4>

                  <p className="text-xs text-neutral-500 mt-1 uppercase">
                    {slot.contract}
                  </p>

                  {slot.assignedPluginName && (
                    <p className="text-xs text-success-600 mt-2 truncate">
                      {slot.assignedPluginName}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2 border-t border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
        {filteredSlots.length === slots.length
          ? `${slots.length} slot${slots.length === 1 ? "" : "s"}`
          : `${filteredSlots.length} of ${slots.length} slots`}
        {" • "}
        {availablePlugins.filter((p) => p.status === "loaded").length} plugins available
      </div>
    </div>
  );
};

PluginSlotManager.displayName = "PluginSlotManager";

export default PluginSlotManager;
