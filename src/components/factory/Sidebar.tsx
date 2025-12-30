/**
 * src/components/factory/Sidebar.tsx
 * ===================================
 * Left Sidebar component managing Plugins list and Component Tools.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D040, D042, D070
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *
 * Traceability: Satisfies GAP-01 (No Tab Switcher), GAP-02 (No Chat Trigger)
 */

import React, { useState, useCallback } from "react";
import { Tabs, type TabItem } from "../ui/Tabs";
import { PluginGallery, type PluginInfo } from "./PluginGallery";
import { ComponentGallery, type ComponentInfo } from "./ComponentGallery";

/**
 * Sidebar tab type.
 */
export type SidebarTab = "plugins" | "components";

/**
 * Sidebar component props.
 */
export interface SidebarProps {
  /** Available plugins */
  plugins: PluginInfo[];
  /** Selected plugin ID */
  selectedPluginId?: string;
  /** Callback when plugin is selected */
  onPluginSelect?: (plugin: PluginInfo) => void;
  /** Callback when plugin is loaded */
  onPluginLoad?: (plugin: PluginInfo) => void;
  /** Callback when plugin is unloaded */
  onPluginUnload?: (plugin: PluginInfo) => void;
  /** Available components */
  components: ComponentInfo[];
  /** Selected component IDs */
  selectedComponentIds?: string[];
  /** Callback when component selection changes */
  onComponentSelectionChange?: (component: ComponentInfo, selected: boolean) => void;
  /** Callback when "New Component" is clicked */
  onNewComponent?: () => void;
  /** Initial active tab */
  initialTab?: SidebarTab;
  /** Custom className */
  className?: string;
}

/**
 * Sidebar tabs configuration.
 */
const SIDEBAR_TABS: TabItem[] = [
  { id: "plugins", label: "Plugins" },
  { id: "components", label: "Components" },
];

/**
 * Plus icon for New Component button.
 */
const PlusIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/**
 * Sidebar component for the Left Panel.
 *
 * Provides tab switching between:
 * - Plugins: PluginGallery for plugin management
 * - Components: ComponentGallery + "New Component" button for AI generation
 *
 * @example
 * ```tsx
 * <Sidebar
 *   plugins={plugins}
 *   components={components}
 *   onNewComponent={() => setShowGenerator(true)}
 * />
 * ```
 */
export const Sidebar: React.FC<SidebarProps> = ({
  plugins,
  selectedPluginId,
  onPluginSelect,
  onPluginLoad,
  onPluginUnload,
  components,
  selectedComponentIds = [],
  onComponentSelectionChange,
  onNewComponent,
  initialTab = "plugins",
  className = "",
}) => {
  const [activeTab, setActiveTab] = useState<SidebarTab>(initialTab);

  const handleClearSelection = useCallback(() => {
    if (onComponentSelectionChange) {
      selectedComponentIds.forEach((id) => {
        const component = components.find((c) => c.id === id);
        if (component) {
          onComponentSelectionChange(component, false);
        }
      });
    }
  }, [components, selectedComponentIds, onComponentSelectionChange]);

  const containerStyles = [
    "h-full",
    "flex",
    "flex-col",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerStyles}>
      {/* Tab Switcher */}
      <div className="p-2 border-b border-neutral-200">
        <Tabs
          tabs={SIDEBAR_TABS}
          activeTab={activeTab}
          onTabChange={(id) => setActiveTab(id as SidebarTab)}
        />
      </div>

      {/* Gallery Content */}
      <div className="flex-1 overflow-auto p-3">
        {activeTab === "plugins" ? (
          <PluginGallery
            plugins={plugins}
            selectedId={selectedPluginId}
            onSelect={onPluginSelect}
            onLoad={onPluginLoad}
            onUnload={onPluginUnload}
            gridColumns={2}
            showViewToggle={false}
          />
        ) : (
          <div className="space-y-3">
            {/* New Component Button (GAP-02) */}
            {onNewComponent && (
              <button
                type="button"
                onClick={onNewComponent}
                className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
              >
                <PlusIcon />
                New Component
              </button>
            )}
            <ComponentGallery
              components={components}
              selectedIds={selectedComponentIds}
              onSelectionChange={onComponentSelectionChange}
              gridColumns={2}
              showViewToggle={false}
              showFilters={false}
              draggable
            />
          </div>
        )}
      </div>

      {/* Selection Summary */}
      {activeTab === "components" && selectedComponentIds.length > 0 && (
        <div className="p-3 border-t border-neutral-200 bg-primary-50">
          <div className="flex items-center justify-between">
            <span className="text-sm text-primary-700 font-medium">
              {selectedComponentIds.length} component
              {selectedComponentIds.length !== 1 ? "s" : ""} selected
            </span>
            <button
              type="button"
              onClick={handleClearSelection}
              className="text-xs text-primary-600 hover:text-primary-800 underline"
            >
              Clear
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

Sidebar.displayName = "Sidebar";

export default Sidebar;
