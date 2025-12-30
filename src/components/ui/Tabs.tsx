/**
 * src/components/ui/Tabs.tsx
 * ==========================
 * Reusable Tabs component for the Sidebar using design tokens.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *
 * Traceability: Satisfies GAP-01 (Tab Switcher for Sidebar)
 */

import React from "react";

/**
 * Tab item definition.
 */
export interface TabItem {
  /** Unique tab identifier */
  id: string;
  /** Display label */
  label: string;
  /** Optional icon */
  icon?: React.ReactNode;
}

/**
 * Tabs component props.
 */
export interface TabsProps {
  /** Available tabs */
  tabs: TabItem[];
  /** Currently active tab ID */
  activeTab: string;
  /** Callback when tab changes */
  onTabChange: (tabId: string) => void;
  /** Custom className */
  className?: string;
}

/**
 * Tabs component for switching between views.
 *
 * @example
 * ```tsx
 * <Tabs
 *   tabs={[
 *     { id: 'plugins', label: 'Plugins' },
 *     { id: 'components', label: 'Components' },
 *   ]}
 *   activeTab={activeTab}
 *   onTabChange={setActiveTab}
 * />
 * ```
 */
export const Tabs: React.FC<TabsProps> = ({
  tabs,
  activeTab,
  onTabChange,
  className = "",
}) => {
  // Defensive check: prevent crash if tabs is undefined or empty
  if (!tabs || tabs.length === 0) {
    return null;
  }

  const containerStyles = [
    "flex",
    "rounded-lg",
    "bg-neutral-100",
    "p-1",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={containerStyles} role="tablist">
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        const tabStyles = [
          "flex-1",
          "flex",
          "items-center",
          "justify-center",
          "gap-1.5",
          "px-3",
          "py-1.5",
          "text-sm",
          "font-medium",
          "rounded-md",
          "transition-colors",
          isActive
            ? "bg-white text-neutral-900 shadow-sm"
            : "text-neutral-600 hover:text-neutral-900",
        ].join(" ");

        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            onClick={() => onTabChange(tab.id)}
            className={tabStyles}
          >
            {tab.icon}
            {tab.label}
          </button>
        );
      })}
    </div>
  );
};

Tabs.displayName = "Tabs";

export default Tabs;
