/**
 * D068 - src/components/project/SwapPluginModal.tsx
 * ==================================================
 * Modal for hot-swapping plugins in a slot.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D014 (Modal.tsx), D066 (PluginSlotManager.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { useState, useCallback, useMemo, useEffect } from "react";
import { createPortal } from "react-dom";

/**
 * Plugin info for swap selection.
 */
export interface SwapPluginInfo {
  id: string;
  name: string;
  displayName: string;
  contract: string;
  version: string;
  description?: string;
  status: "loaded" | "unloaded" | "loading" | "error";
  isCompatible: boolean;
  incompatibilityReason?: string;
  lastUpdated?: Date;
  author?: string;
  dependencies?: string[];
  features?: string[];
}

/**
 * Current slot info.
 */
export interface SwapSlotInfo {
  id: string;
  name: string;
  contract: string;
  currentPluginId?: string;
  currentPluginName?: string;
  currentPluginVersion?: string;
  isRequired: boolean;
}

/**
 * Swap result.
 */
export interface SwapResult {
  success: boolean;
  previousPluginId?: string;
  newPluginId: string;
  error?: string;
  rollbackAvailable?: boolean;
}

/**
 * SwapPluginModal component props.
 */
export interface SwapPluginModalProps {
  /** Whether the modal is open */
  isOpen: boolean;
  /** Callback when modal should close */
  onClose: () => void;
  /** Slot to swap plugin for */
  slot: SwapSlotInfo;
  /** Available plugins for this slot */
  availablePlugins: SwapPluginInfo[];
  /** Callback when plugin is swapped */
  onSwap: (slotId: string, newPluginId: string) => Promise<SwapResult>;
  /** Callback when rollback is requested */
  onRollback?: (slotId: string) => Promise<boolean>;
  /** Whether swap is in progress */
  isSwapping?: boolean;
}

/**
 * Close icon.
 */
const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
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
 * Check icon.
 */
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Check circle icon.
 */
const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

/**
 * Alert icon.
 */
const AlertIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

/**
 * Undo icon.
 */
const UndoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M3 7v6h6" />
    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
  </svg>
);

/**
 * Search icon.
 */
const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="11" cy="11" r="8" />
    <line x1="21" y1="21" x2="16.65" y2="16.65" />
  </svg>
);

/**
 * Info icon.
 */
const InfoIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

/**
 * Status colors.
 */
const statusColors: Record<SwapPluginInfo["status"], string> = {
  loaded: "bg-success-500",
  unloaded: "bg-neutral-400",
  loading: "bg-warning-500 animate-pulse",
  error: "bg-error-500",
};

/**
 * Status labels.
 */
const statusLabels: Record<SwapPluginInfo["status"], string> = {
  loaded: "Loaded",
  unloaded: "Not Loaded",
  loading: "Loading",
  error: "Error",
};

/**
 * SwapPluginModal component.
 *
 * Modal for hot-swapping plugins in a slot with compatibility checking
 * and rollback support.
 *
 * @example
 * ```tsx
 * <SwapPluginModal
 *   isOpen={isOpen}
 *   onClose={() => setIsOpen(false)}
 *   slot={selectedSlot}
 *   availablePlugins={compatiblePlugins}
 *   onSwap={async (slotId, pluginId) => {
 *     const result = await swapPlugin(slotId, pluginId);
 *     return result;
 *   }}
 *   onRollback={async (slotId) => {
 *     return await rollbackSwap(slotId);
 *   }}
 * />
 * ```
 */
export const SwapPluginModal: React.FC<SwapPluginModalProps> = ({
  isOpen,
  onClose,
  slot,
  availablePlugins,
  onSwap,
  onRollback,
  isSwapping: externalIsSwapping = false,
}) => {
  // Search query
  const [searchQuery, setSearchQuery] = useState("");

  // Selected plugin
  const [selectedPluginId, setSelectedPluginId] = useState<string | null>(null);

  // Swap state
  const [isSwapping, setIsSwapping] = useState(false);
  const [swapResult, setSwapResult] = useState<SwapResult | null>(null);

  // Show details panel


  // Reset state when modal opens
  useEffect(() => {
    if (isOpen) {
      setSearchQuery("");
      setSelectedPluginId(null);
      setSwapResult(null);

    }
  }, [isOpen]);

  // Filter plugins
  const filteredPlugins = useMemo(() => {
    if (!searchQuery.trim()) return availablePlugins;

    const query = searchQuery.toLowerCase();
    return availablePlugins.filter(
      (p) =>
        p.name.toLowerCase().includes(query) ||
        p.displayName.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
    );
  }, [availablePlugins, searchQuery]);

  // Sort plugins: compatible first, then by status, then by name
  const sortedPlugins = useMemo(() => {
    return [...filteredPlugins].sort((a, b) => {
      // Compatible first
      if (a.isCompatible !== b.isCompatible) {
        return a.isCompatible ? -1 : 1;
      }
      // Loaded first
      if (a.status !== b.status) {
        const statusOrder = { loaded: 0, loading: 1, unloaded: 2, error: 3 };
        return statusOrder[a.status] - statusOrder[b.status];
      }
      // Then by name
      return a.displayName.localeCompare(b.displayName);
    });
  }, [filteredPlugins]);



  // Handle swap
  const handleSwap = useCallback(async () => {
    if (!selectedPluginId) return;

    setIsSwapping(true);
    setSwapResult(null);

    try {
      const result = await onSwap(slot.id, selectedPluginId);
      setSwapResult(result);

      if (result.success) {
        // Auto-close after successful swap
        setTimeout(() => {
          onClose();
        }, 1500);
      }
    } catch (error) {
      setSwapResult({
        success: false,
        newPluginId: selectedPluginId,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      });
    } finally {
      setIsSwapping(false);
    }
  }, [selectedPluginId, slot.id, onSwap, onClose]);

  // Handle rollback
  const handleRollback = useCallback(async () => {
    if (!onRollback || !swapResult?.rollbackAvailable) return;

    setIsSwapping(true);

    try {
      const success = await onRollback(slot.id);
      if (success) {
        setSwapResult(null);
        setSelectedPluginId(null);
      }
    } finally {
      setIsSwapping(false);
    }
  }, [onRollback, swapResult, slot.id]);

  // Handle close
  const handleClose = useCallback(() => {
    if (!isSwapping && !externalIsSwapping) {
      onClose();
    }
  }, [isSwapping, externalIsSwapping, onClose]);

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isSwapping && !externalIsSwapping) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isOpen, isSwapping, externalIsSwapping, handleClose]);

  // Prevent body scroll
  useEffect(() => {
    if (isOpen) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const modalContent = (
    <div
      className={[
        "fixed",
        "inset-0",
        "z-modal",
        "flex",
        "items-center",
        "justify-center",
        "p-4",
        "bg-black/50",
        "backdrop-blur-sm",
      ].join(" ")}
      onClick={handleClose}
    >
      <div
        className={[
          "w-full",
          "max-w-2xl",
          "bg-white",
          "rounded-lg",
          "shadow-xl",
          "overflow-hidden",
          "flex",
          "flex-col",
          "max-h-[80vh]",
        ].join(" ")}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200 shrink-0">
          <div>
            <h2 className="text-lg font-semibold text-neutral-900">
              Swap Plugin
            </h2>
            <p className="text-sm text-neutral-500">
              Select a plugin to swap into <span className="font-medium">{slot.name}</span>
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={isSwapping || externalIsSwapping}
            className={[
              "p-1",
              "rounded-md",
              "text-neutral-400",
              "hover:text-neutral-600",
              "hover:bg-neutral-100",
              "disabled:opacity-50",
              "transition-colors",
              "duration-150",
            ].join(" ")}
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {/* Current plugin info */}
        {slot.currentPluginId && (
          <div className="px-6 py-3 bg-neutral-50 border-b border-neutral-200 shrink-0">
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-neutral-500 uppercase">
                Current:
              </span>
              <span className="text-sm font-medium text-neutral-900">
                {slot.currentPluginName}
              </span>
              <span className="text-xs text-neutral-400">
                v{slot.currentPluginVersion}
              </span>
            </div>
          </div>
        )}

        {/* Search */}
        <div className="px-6 py-3 border-b border-neutral-100 shrink-0">
          <div className="relative">
            <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search plugins..."
              disabled={isSwapping}
              className={[
                "w-full",
                "pl-10",
                "pr-4",
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
            />
          </div>
        </div>

        {/* Plugin list */}
        <div className="flex-1 overflow-y-auto">
          {sortedPlugins.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center">
              <InfoIcon className="h-12 w-12 text-neutral-300 mb-4" />
              <p className="text-sm text-neutral-500">
                {searchQuery
                  ? "No plugins match your search"
                  : "No compatible plugins available"}
              </p>
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {sortedPlugins.map((plugin) => {
                const isSelected = selectedPluginId === plugin.id;
                const isCurrent = plugin.id === slot.currentPluginId;
                const canSelect = plugin.isCompatible && plugin.status === "loaded" && !isCurrent;

                return (
                  <li key={plugin.id}>
                    <button
                      type="button"
                      onClick={() => canSelect && setSelectedPluginId(plugin.id)}
                      disabled={!canSelect || isSwapping}
                      className={[
                        "w-full",
                        "p-4",
                        "text-left",
                        "transition-colors",
                        "duration-150",
                        isSelected
                          ? "bg-primary-50"
                          : canSelect
                            ? "hover:bg-neutral-50"
                            : "",
                        !canSelect && "opacity-60 cursor-not-allowed",
                      ].join(" ")}
                    >
                      <div className="flex items-start gap-3">
                        {/* Selection indicator */}
                        <div
                          className={[
                            "flex",
                            "items-center",
                            "justify-center",
                            "h-5",
                            "w-5",
                            "rounded-full",
                            "border-2",
                            "shrink-0",
                            "mt-0.5",
                            isSelected
                              ? "border-primary-500 bg-primary-500"
                              : "border-neutral-300",
                          ].join(" ")}
                        >
                          {isSelected && <CheckIcon className="h-3 w-3 text-white" />}
                        </div>

                        {/* Plugin info */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <h4 className="text-sm font-medium text-neutral-900 truncate">
                              {plugin.displayName}
                            </h4>
                            <span className="text-xs text-neutral-400">
                              v{plugin.version}
                            </span>
                            {isCurrent && (
                              <span className="px-1.5 py-0.5 text-xs font-medium bg-info-50 text-info-700 rounded">
                                Current
                              </span>
                            )}
                          </div>

                          {plugin.description && (
                            <p className="mt-0.5 text-xs text-neutral-500 line-clamp-2">
                              {plugin.description}
                            </p>
                          )}

                          {!plugin.isCompatible && plugin.incompatibilityReason && (
                            <p className="mt-1 text-xs text-error-600 flex items-center gap-1">
                              <AlertIcon className="h-3 w-3" />
                              {plugin.incompatibilityReason}
                            </p>
                          )}

                          {plugin.features && plugin.features.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {plugin.features.slice(0, 3).map((feature) => (
                                <span
                                  key={feature}
                                  className="px-1.5 py-0.5 text-xs bg-neutral-100 text-neutral-600 rounded"
                                >
                                  {feature}
                                </span>
                              ))}
                              {plugin.features.length > 3 && (
                                <span className="text-xs text-neutral-400">
                                  +{plugin.features.length - 3} more
                                </span>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Status indicator */}
                        <div className="flex flex-col items-end gap-1 shrink-0">
                          <span
                            className={[
                              "h-2",
                              "w-2",
                              "rounded-full",
                              statusColors[plugin.status],
                            ].join(" ")}
                            title={statusLabels[plugin.status]}
                          />
                          <span className="text-xs text-neutral-400">
                            {statusLabels[plugin.status]}
                          </span>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Result message */}
        {swapResult && (
          <div
            className={[
              "px-6",
              "py-3",
              "border-t",
              "shrink-0",
              swapResult.success
                ? "bg-success-50 border-success-200"
                : "bg-error-50 border-error-200",
            ].join(" ")}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                {swapResult.success ? (
                  <CheckCircleIcon className="h-5 w-5 text-success-600" />
                ) : (
                  <AlertIcon className="h-5 w-5 text-error-600" />
                )}
                <p
                  className={[
                    "text-sm",
                    "font-medium",
                    swapResult.success ? "text-success-700" : "text-error-700",
                  ].join(" ")}
                >
                  {swapResult.success
                    ? "Plugin swapped successfully!"
                    : swapResult.error || "Failed to swap plugin"}
                </p>
              </div>

              {swapResult.rollbackAvailable && onRollback && (
                <button
                  type="button"
                  onClick={handleRollback}
                  disabled={isSwapping}
                  className={[
                    "inline-flex",
                    "items-center",
                    "gap-1",
                    "px-3",
                    "py-1.5",
                    "text-sm",
                    "font-medium",
                    "text-neutral-700",
                    "bg-white",
                    "border",
                    "border-neutral-300",
                    "rounded-md",
                    "hover:bg-neutral-50",
                    "disabled:opacity-50",
                  ].join(" ")}
                >
                  <UndoIcon className="h-4 w-4" />
                  Rollback
                </button>
              )}
            </div>
          </div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-neutral-200 bg-neutral-50 shrink-0">
          <div className="text-xs text-neutral-500">
            {sortedPlugins.length} plugin{sortedPlugins.length === 1 ? "" : "s"} available
            {slot.isRequired && (
              <span className="ml-2 text-error-500">
                This slot is required
              </span>
            )}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleClose}
              disabled={isSwapping || externalIsSwapping}
              className={[
                "px-4",
                "py-2",
                "text-sm",
                "font-medium",
                "text-neutral-700",
                "bg-white",
                "border",
                "border-neutral-300",
                "rounded-md",
                "hover:bg-neutral-50",
                "disabled:opacity-50",
                "transition-colors",
                "duration-150",
              ].join(" ")}
            >
              Cancel
            </button>

            <button
              type="button"
              onClick={handleSwap}
              disabled={!selectedPluginId || isSwapping || externalIsSwapping || !!swapResult}
              className={[
                "inline-flex",
                "items-center",
                "gap-2",
                "px-4",
                "py-2",
                "text-sm",
                "font-medium",
                "text-white",
                "bg-primary-600",
                "rounded-md",
                "hover:bg-primary-700",
                "disabled:opacity-50",
                "disabled:cursor-not-allowed",
                "transition-colors",
                "duration-150",
              ].join(" ")}
            >
              {isSwapping || externalIsSwapping ? (
                <>
                  <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Swapping...
                </>
              ) : (
                <>
                  <SwapIcon className="h-4 w-4" />
                  Swap Plugin
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

SwapPluginModal.displayName = "SwapPluginModal";

export default SwapPluginModal;
