/**
 * D064 - src/components/project/ComponentEditor.tsx
 * ==================================================
 * Component for editing frontend components in a project.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D011 (Input.tsx), D012 (Select.tsx), D014 (Panel.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { useState, useCallback, useMemo, type HTMLAttributes } from "react";

/**
 * Component property definition.
 */
export interface ComponentProperty {
  name: string;
  type: "string" | "number" | "boolean" | "color" | "select" | "object" | "array";
  value: unknown;
  defaultValue?: unknown;
  description?: string;
  required?: boolean;
  options?: { value: string; label: string }[];
  min?: number;
  max?: number;
}

/**
 * Component event definition.
 */
export interface ComponentEvent {
  name: string;
  description?: string;
  params?: { name: string; type: string }[];
}

/**
 * Component style definition.
 */
export interface ComponentStyle {
  property: string;
  value: string;
  isCustom?: boolean;
}

/**
 * Editable component structure.
 */
export interface EditableComponent {
  id: string;
  name: string;
  displayName: string;
  type: string;
  category: "ui" | "layout" | "form" | "data" | "media" | "custom";
  properties: ComponentProperty[];
  events: ComponentEvent[];
  styles: ComponentStyle[];
  children?: string[];
  parentId?: string;
  isLocked?: boolean;
  isVisible?: boolean;
}

/**
 * ComponentEditor component props.
 */
export interface ComponentEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Component being edited */
  component: EditableComponent;
  /** Callback when property changes */
  onPropertyChange?: (propertyName: string, value: unknown) => void;
  /** Callback when style changes */
  onStyleChange?: (styleProp: string, value: string) => void;
  /** Callback when event handler changes */
  onEventChange?: (eventName: string, handler: string) => void;
  /** Callback when component is deleted */
  onDelete?: () => void;
  /** Callback when component is duplicated */
  onDuplicate?: () => void;
  /** Callback when component visibility is toggled */
  onToggleVisibility?: () => void;
  /** Callback when component lock is toggled */
  onToggleLock?: () => void;
  /** Whether component is read-only */
  readOnly?: boolean;
}

/**
 * Category icons.
 */
const CategoryIcons: Record<EditableComponent["category"], React.FC<{ className?: string }>> = {
  ui: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    </svg>
  ),
  layout: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="3" y1="9" x2="21" y2="9" />
      <line x1="9" y1="21" x2="9" y2="9" />
    </svg>
  ),
  form: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <line x1="7" y1="8" x2="17" y2="8" />
      <line x1="7" y1="12" x2="17" y2="12" />
      <line x1="7" y1="16" x2="13" y2="16" />
    </svg>
  ),
  data: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5" />
    </svg>
  ),
  media: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
      <circle cx="8.5" cy="8.5" r="1.5" />
      <polyline points="21 15 16 10 5 21" />
    </svg>
  ),
  custom: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
};

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
 * Eye icon.
 */
const EyeIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

/**
 * Eye off icon.
 */
const EyeOffIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
    <line x1="1" y1="1" x2="23" y2="23" />
  </svg>
);

/**
 * Lock icon.
 */
const LockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
  </svg>
);

/**
 * Unlock icon.
 */
const UnlockIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
    <path d="M7 11V7a5 5 0 0 1 9.9-1" />
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
 * Category colors.
 */
const categoryColors: Record<EditableComponent["category"], string> = {
  ui: "bg-primary-100 text-primary-700",
  layout: "bg-success-50 text-success-700",
  form: "bg-warning-50 text-warning-700",
  data: "bg-info-50 text-info-700",
  media: "bg-purple-50 text-purple-700",
  custom: "bg-neutral-100 text-neutral-700",
};

/**
 * ComponentEditor component.
 *
 * Provides an interface for editing component properties, styles, and events.
 *
 * @example
 * ```tsx
 * <ComponentEditor
 *   component={selectedComponent}
 *   onPropertyChange={(name, value) => updateProperty(name, value)}
 *   onStyleChange={(prop, value) => updateStyle(prop, value)}
 *   onDelete={() => deleteComponent()}
 * />
 * ```
 */
export const ComponentEditor: React.FC<ComponentEditorProps> = ({
  component,
  onPropertyChange,
  onStyleChange,
  onEventChange,
  onDelete,
  onDuplicate,
  onToggleVisibility,
  onToggleLock,
  readOnly = false,
  className = "",
  ...props
}) => {
  // Active tab
  const [activeTab, setActiveTab] = useState<"properties" | "styles" | "events">("properties");

  // Collapsed sections
  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  // Toggle section
  const toggleSection = useCallback((section: string) => {
    setCollapsedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  }, []);

  // Group properties by category
  type PropertyGroups = {
    required: ComponentProperty[];
    optional: ComponentProperty[];
  };

  const groupedProperties = useMemo<PropertyGroups>(() => {
    const groups: PropertyGroups = {
      required: [],
      optional: [],
    };

    (component.properties ?? []).forEach((prop) => {
      if (prop.required) {
        groups.required.push(prop);
      } else {
        groups.optional.push(prop);
      }
    });

    return groups;
  }, [component.properties]);

  // Get category icon
  const CategoryIcon = CategoryIcons[component.category];

  // Render property input
  const renderPropertyInput = (prop: ComponentProperty) => {
    const baseInputStyles = [
      "w-full",
      "px-3",
      "py-1.5",
      "text-sm",
      "bg-white",
      "border",
      "border-neutral-300",
      "rounded-md",
      "focus:outline-none",
      "focus:ring-2",
      "focus:ring-primary-500",
      "disabled:bg-neutral-50",
      "disabled:cursor-not-allowed",
    ].join(" ");

    switch (prop.type) {
      case "boolean":
        return (
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={Boolean(prop.value)}
              onChange={(e) => onPropertyChange?.(prop.name, e.target.checked)}
              disabled={readOnly || component.isLocked}
              className={[
                "h-4",
                "w-4",
                "rounded",
                "border-neutral-300",
                "text-primary-600",
                "focus:ring-primary-500",
              ].join(" ")}
            />
            <span className="text-sm text-neutral-600">
              {prop.value ? "Enabled" : "Disabled"}
            </span>
          </label>
        );

      case "number":
        return (
          <input
            type="number"
            value={Number(prop.value) || 0}
            onChange={(e) => onPropertyChange?.(prop.name, parseFloat(e.target.value))}
            min={prop.min}
            max={prop.max}
            disabled={readOnly || component.isLocked}
            className={baseInputStyles}
          />
        );

      case "color":
        return (
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={String(prop.value) || "#000000"}
              onChange={(e) => onPropertyChange?.(prop.name, e.target.value)}
              disabled={readOnly || component.isLocked}
              className={[
                "h-8",
                "w-8",
                "rounded",
                "border",
                "border-neutral-300",
                "cursor-pointer",
                "disabled:cursor-not-allowed",
              ].join(" ")}
            />
            <input
              type="text"
              value={String(prop.value) || ""}
              onChange={(e) => onPropertyChange?.(prop.name, e.target.value)}
              disabled={readOnly || component.isLocked}
              className={[baseInputStyles, "flex-1"].join(" ")}
              placeholder="#000000"
            />
          </div>
        );

      case "select":
        return (
          <select
            value={String(prop.value) || ""}
            onChange={(e) => onPropertyChange?.(prop.name, e.target.value)}
            disabled={readOnly || component.isLocked}
            className={baseInputStyles}
          >
            <option value="">Select...</option>
            {prop.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );

      case "object":
      case "array":
        return (
          <textarea
            value={
              typeof prop.value === "object"
                ? JSON.stringify(prop.value, null, 2)
                : String(prop.value ?? "")
            }
            onChange={(e) => {
              try {
                onPropertyChange?.(prop.name, JSON.parse(e.target.value));
              } catch {
                // Keep as string if invalid JSON
              }
            }}
            disabled={readOnly || component.isLocked}
            rows={3}
            className={[baseInputStyles, "font-mono text-xs"].join(" ")}
            placeholder={prop.type === "object" ? "{}" : "[]"}
          />
        );

      default:
        return (
          <input
            type="text"
            value={String(prop.value ?? "")}
            onChange={(e) => onPropertyChange?.(prop.name, e.target.value)}
            disabled={readOnly || component.isLocked}
            className={baseInputStyles}
            placeholder={prop.description}
          />
        );
    }
  };

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
              categoryColors[component.category],
            ].join(" ")}
          >
            <CategoryIcon className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="text-sm font-semibold text-neutral-900 truncate">
              {component.displayName}
            </h3>
            <p className="text-xs text-neutral-500">
              {component.type} • {component.category}
            </p>
          </div>
        </div>

        {/* Action buttons */}
        <div className="mt-3 flex items-center gap-1">
          <button
            type="button"
            onClick={onToggleVisibility}
            disabled={readOnly}
            className={[
              "p-1.5",
              "rounded-md",
              "text-neutral-400",
              component.isVisible === false
                ? "bg-warning-50 text-warning-600"
                : "hover:bg-neutral-100 hover:text-neutral-600",
              "transition-colors",
              "duration-150",
              "disabled:opacity-50",
            ].join(" ")}
            title={component.isVisible === false ? "Show" : "Hide"}
          >
            {component.isVisible === false ? (
              <EyeOffIcon className="h-4 w-4" />
            ) : (
              <EyeIcon className="h-4 w-4" />
            )}
          </button>

          <button
            type="button"
            onClick={onToggleLock}
            disabled={readOnly}
            className={[
              "p-1.5",
              "rounded-md",
              "text-neutral-400",
              component.isLocked
                ? "bg-error-50 text-error-600"
                : "hover:bg-neutral-100 hover:text-neutral-600",
              "transition-colors",
              "duration-150",
              "disabled:opacity-50",
            ].join(" ")}
            title={component.isLocked ? "Unlock" : "Lock"}
          >
            {component.isLocked ? (
              <LockIcon className="h-4 w-4" />
            ) : (
              <UnlockIcon className="h-4 w-4" />
            )}
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
            title="Duplicate"
          >
            <CopyIcon className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={onDelete}
            disabled={readOnly || component.isLocked}
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
            title="Delete"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-neutral-200">
        {(["properties", "styles", "events"] as const).map((tab) => (
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
      <div className="flex-1 overflow-y-auto">
        {activeTab === "properties" && (
          <div className="p-4 space-y-4">
            {Object.entries(groupedProperties).map(
              ([group, props]) =>
                props.length > 0 && (
                  <div key={group}>
                    <button
                      type="button"
                      onClick={() => toggleSection(`props-${group}`)}
                      className={[
                        "flex",
                        "items-center",
                        "justify-between",
                        "w-full",
                        "py-2",
                        "text-xs",
                        "font-semibold",
                        "text-neutral-500",
                        "uppercase",
                        "tracking-wider",
                      ].join(" ")}
                    >
                      {group} ({props.length})
                      <ChevronDownIcon
                        className={[
                          "h-4",
                          "w-4",
                          "transition-transform",
                          "duration-200",
                          collapsedSections.has(`props-${group}`) ? "" : "rotate-180",
                        ].join(" ")}
                      />
                    </button>

                    {!collapsedSections.has(`props-${group}`) && (
                      <div className="space-y-3">
                        {props.map((prop) => (
                          <div key={prop.name}>
                            <label className="flex items-center gap-1 text-sm font-medium text-neutral-700 mb-1">
                              {prop.name}
                              {prop.required && (
                                <span className="text-error-500">*</span>
                              )}
                            </label>
                            {renderPropertyInput(prop)}
                            {prop.description && (
                              <p className="mt-1 text-xs text-neutral-400">
                                {prop.description}
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
            )}

            {component.properties.length === 0 && (
              <p className="text-sm text-neutral-500 italic text-center py-4">
                No properties defined
              </p>
            )}
          </div>
        )}

        {activeTab === "styles" && (
          <div className="p-4 space-y-3">
            {component.styles.map((style) => (
              <div key={style.property}>
                <label className="flex items-center gap-1 text-sm font-medium text-neutral-700 mb-1">
                  {style.property}
                  {style.isCustom && (
                    <span className="px-1 py-0.5 text-xs bg-neutral-100 text-neutral-500 rounded">
                      custom
                    </span>
                  )}
                </label>
                <input
                  type="text"
                  value={style.value}
                  onChange={(e) => onStyleChange?.(style.property, e.target.value)}
                  disabled={readOnly || component.isLocked}
                  className={[
                    "w-full",
                    "px-3",
                    "py-1.5",
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
                    "disabled:cursor-not-allowed",
                  ].join(" ")}
                />
              </div>
            ))}

            {component.styles.length === 0 && (
              <p className="text-sm text-neutral-500 italic text-center py-4">
                No styles defined
              </p>
            )}
          </div>
        )}

        {activeTab === "events" && (
          <div className="p-4 space-y-3">
            {component.events.map((event) => (
              <div key={event.name}>
                <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-1">
                  <span className="text-primary-600">@</span>
                  {event.name}
                </label>
                {event.description && (
                  <p className="text-xs text-neutral-500 mb-1">
                    {event.description}
                  </p>
                )}
                <textarea
                  placeholder={`// Handle ${event.name}\n(${event.params?.map((p) => p.name).join(", ") || ""}) => {\n  \n}`}
                  onChange={(e) => onEventChange?.(event.name, e.target.value)}
                  disabled={readOnly || component.isLocked}
                  rows={3}
                  className={[
                    "w-full",
                    "px-3",
                    "py-1.5",
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
                    "disabled:cursor-not-allowed",
                  ].join(" ")}
                />
              </div>
            ))}

            {component.events.length === 0 && (
              <p className="text-sm text-neutral-500 italic text-center py-4">
                No events defined
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

ComponentEditor.displayName = "ComponentEditor";

export default ComponentEditor;
