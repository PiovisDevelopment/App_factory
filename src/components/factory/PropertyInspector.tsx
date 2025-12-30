/**
 * D046 - src/components/factory/PropertyInspector.tsx
 * =====================================================
 * Property editor panel for inspecting and editing component properties.
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
 * Property types.
 */
export type PropertyType =
  | "string"
  | "number"
  | "boolean"
  | "color"
  | "select"
  | "multiselect"
  | "object"
  | "array"
  | "function"
  | "node";

/**
 * Property definition.
 */
export interface PropertyDefinition {
  /** Property key */
  key: string;
  /** Display label */
  label: string;
  /** Property type */
  type: PropertyType;
  /** Current value */
  value: unknown;
  /** Default value */
  defaultValue?: unknown;
  /** Description */
  description?: string;
  /** Whether required */
  required?: boolean;
  /** Whether readonly */
  readonly?: boolean;
  /** Options for select/multiselect */
  options?: Array<{ label: string; value: unknown }>;
  /** Min value for numbers */
  min?: number;
  /** Max value for numbers */
  max?: number;
  /** Step for numbers */
  step?: number;
  /** Placeholder text */
  placeholder?: string;
  /** Category for grouping */
  category?: string;
  /** Nested properties for object type */
  properties?: PropertyDefinition[];
}

/**
 * Property group.
 */
export interface PropertyGroup {
  /** Group name */
  name: string;
  /** Whether collapsed */
  collapsed?: boolean;
  /** Properties in this group */
  properties: PropertyDefinition[];
}

/**
 * Selected element info.
 */
export interface SelectedElementInfo {
  /** Element ID */
  id: string;
  /** Element name */
  name: string;
  /** Element type */
  type: string;
  /** Component ID (if applicable) */
  componentId?: string;
}

/**
 * PropertyInspector component props.
 */
export interface PropertyInspectorProps extends HTMLAttributes<HTMLDivElement> {
  /** Selected element info */
  selectedElement?: SelectedElementInfo;
  /** Property definitions or groups */
  properties?: PropertyDefinition[] | PropertyGroup[];
  /** Whether properties are grouped */
  grouped?: boolean;
  /** Callback when a property value changes */
  onChange?: (key: string, value: unknown) => void;
  /** Callback when property is reset to default */
  onReset?: (key: string) => void;
  /** Empty state message */
  emptyMessage?: string;
  /** Whether editing is enabled */
  editable?: boolean;
  /** Show search */
  showSearch?: boolean;
}

/**
 * Chevron icon.
 */
const ChevronIcon: React.FC<{ className?: string; direction?: "up" | "down" }> = ({
  className,
  direction = "down",
}) => (
  <svg
    className={[className, direction === "up" && "rotate-180"].filter(Boolean).join(" ")}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="6 9 12 15 18 9" />
  </svg>
);

/**
 * Reset icon.
 */
const ResetIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
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
 * Property type badges.
 */
const typeBadges: Record<PropertyType, { label: string; color: string }> = {
  string: { label: "str", color: "bg-success-100 text-success-700" },
  number: { label: "num", color: "bg-primary-100 text-primary-700" },
  boolean: { label: "bool", color: "bg-warning-100 text-warning-700" },
  color: { label: "color", color: "bg-info-100 text-info-700" },
  select: { label: "enum", color: "bg-neutral-100 text-neutral-700" },
  multiselect: { label: "multi", color: "bg-neutral-100 text-neutral-700" },
  object: { label: "obj", color: "bg-error-100 text-error-700" },
  array: { label: "arr", color: "bg-error-100 text-error-700" },
  function: { label: "fn", color: "bg-neutral-200 text-neutral-600" },
  node: { label: "node", color: "bg-neutral-200 text-neutral-600" },
};

/**
 * Property input component.
 */
interface PropertyInputProps {
  property: PropertyDefinition;
  onChange: (value: unknown) => void;
  editable: boolean;
}

const PropertyInput: React.FC<PropertyInputProps> = ({ property, onChange, editable }) => {
  const { type, value, options, min, max, step, placeholder, readonly } = property;
  const isDisabled = !editable || readonly;

  const inputStyles = [
    "w-full",
    "px-2",
    "py-1",
    "text-sm",
    "bg-white",
    "border",
    "border-neutral-200",
    "rounded",
    "focus:outline-none",
    "focus:ring-2",
    "focus:ring-primary-500",
    "focus:border-transparent",
    isDisabled && "bg-neutral-50 text-neutral-500 cursor-not-allowed",
  ]
    .filter(Boolean)
    .join(" ");

  switch (type) {
    case "string":
      return (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          disabled={isDisabled}
          className={inputStyles}
        />
      );

    case "number":
      return (
        <input
          type="number"
          value={Number(value ?? 0)}
          onChange={(e) => onChange(Number(e.target.value))}
          min={min}
          max={max}
          step={step ?? 1}
          placeholder={placeholder}
          disabled={isDisabled}
          className={inputStyles}
        />
      );

    case "boolean":
      return (
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(e.target.checked)}
            disabled={isDisabled}
            className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
          />
          <span className="text-sm text-neutral-600">{value ? "true" : "false"}</span>
        </label>
      );

    case "color":
      return (
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={String(value ?? "#000000")}
            onChange={(e) => onChange(e.target.value)}
            disabled={isDisabled}
            className="h-8 w-8 rounded border border-neutral-200 cursor-pointer"
          />
          <input
            type="text"
            value={String(value ?? "")}
            onChange={(e) => onChange(e.target.value)}
            placeholder="#000000"
            disabled={isDisabled}
            className={[inputStyles, "flex-1"].join(" ")}
          />
        </div>
      );

    case "select":
      return (
        <select
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={isDisabled}
          className={inputStyles}
        >
          <option value="">Select...</option>
          {options?.map((opt) => (
            <option key={String(opt.value)} value={String(opt.value)}>
              {opt.label}
            </option>
          ))}
        </select>
      );

    case "multiselect":
      const selectedValues = Array.isArray(value) ? value : [];
      return (
        <div className="flex flex-wrap gap-1">
          {options?.map((opt) => {
            const isSelected = selectedValues.includes(opt.value);
            return (
              <button
                key={String(opt.value)}
                type="button"
                onClick={() => {
                  if (isDisabled) return;
                  const newValues = isSelected
                    ? selectedValues.filter((v) => v !== opt.value)
                    : [...selectedValues, opt.value];
                  onChange(newValues);
                }}
                disabled={isDisabled}
                className={[
                  "px-2",
                  "py-1",
                  "text-xs",
                  "font-medium",
                  "rounded",
                  "border",
                  "transition-colors",
                  "duration-150",
                  isSelected
                    ? "bg-primary-100 border-primary-300 text-primary-700"
                    : "bg-white border-neutral-200 text-neutral-600 hover:bg-neutral-50",
                  isDisabled && "opacity-50 cursor-not-allowed",
                ].join(" ")}
              >
                {opt.label}
              </button>
            );
          })}
        </div>
      );

    case "object":
    case "array":
      return (
        <textarea
          value={typeof value === "object" ? JSON.stringify(value, null, 2) : String(value ?? "")}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value));
            } catch {
              // Invalid JSON, don't update
            }
          }}
          placeholder={type === "object" ? "{}" : "[]"}
          disabled={isDisabled}
          className={[inputStyles, "font-mono", "text-xs", "h-20", "resize-y"].join(" ")}
        />
      );

    case "function":
    case "node":
      return (
        <div className="px-2 py-1 text-sm text-neutral-400 italic bg-neutral-50 rounded border border-neutral-200">
          {type === "function" ? "(function)" : "(ReactNode)"}
        </div>
      );

    default:
      return (
        <input
          type="text"
          value={String(value ?? "")}
          onChange={(e) => onChange(e.target.value)}
          disabled={isDisabled}
          className={inputStyles}
        />
      );
  }
};

/**
 * Single property row.
 */
interface PropertyRowProps {
  property: PropertyDefinition;
  onChange: (key: string, value: unknown) => void;
  onReset?: (key: string) => void;
  editable: boolean;
}

const PropertyRow: React.FC<PropertyRowProps> = ({ property, onChange, onReset, editable }) => {
  const hasChanged = property.defaultValue !== undefined && property.value !== property.defaultValue;
  const badge = typeBadges[property.type];

  return (
    <div className="flex flex-col gap-1 py-2 border-b border-neutral-100 last:border-b-0">
      {/* Label row */}
      <div className="flex items-center gap-2">
        <span
          className={["px-1", "text-xs", "font-mono", "rounded", badge.color].join(" ")}
        >
          {badge.label}
        </span>
        <span className="text-sm font-medium text-neutral-700 flex-1">
          {property.label}
          {property.required && <span className="text-error-500 ml-0.5">*</span>}
        </span>
        {hasChanged && onReset && editable && (
          <button
            type="button"
            onClick={() => onReset(property.key)}
            className="p-0.5 text-neutral-400 hover:text-neutral-600"
            title="Reset to default"
          >
            <ResetIcon className="h-3 w-3" />
          </button>
        )}
      </div>

      {/* Input */}
      <PropertyInput
        property={property}
        onChange={(value) => onChange(property.key, value)}
        editable={editable}
      />

      {/* Description */}
      {property.description && (
        <p className="text-xs text-neutral-400">{property.description}</p>
      )}
    </div>
  );
};

/**
 * Property group component.
 */
interface PropertyGroupComponentProps {
  group: PropertyGroup;
  onChange: (key: string, value: unknown) => void;
  onReset?: (key: string) => void;
  editable: boolean;
  searchQuery?: string;
}

const PropertyGroupComponent: React.FC<PropertyGroupComponentProps> = ({
  group,
  onChange,
  onReset,
  editable,
  searchQuery,
}) => {
  const [isCollapsed, setIsCollapsed] = useState(group.collapsed ?? false);

  // Filter properties by search
  const filteredProperties = searchQuery
    ? group.properties.filter(
        (p) =>
          p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
          p.description?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : group.properties;

  if (filteredProperties.length === 0) return null;

  return (
    <div className="border border-neutral-200 rounded-lg overflow-hidden">
      {/* Group header */}
      <button
        type="button"
        onClick={() => setIsCollapsed(!isCollapsed)}
        className={[
          "flex",
          "items-center",
          "w-full",
          "px-3",
          "py-2",
          "text-sm",
          "font-medium",
          "text-neutral-700",
          "bg-neutral-50",
          "hover:bg-neutral-100",
          "transition-colors",
          "duration-150",
        ].join(" ")}
      >
        <ChevronIcon
          className="h-4 w-4 mr-2 text-neutral-400 transition-transform duration-150"
          direction={isCollapsed ? "down" : "up"}
        />
        {group.name}
        <span className="ml-auto text-xs text-neutral-400">
          {filteredProperties.length} prop{filteredProperties.length !== 1 ? "s" : ""}
        </span>
      </button>

      {/* Group content */}
      {!isCollapsed && (
        <div className="px-3 py-1 bg-white">
          {filteredProperties.map((prop) => (
            <PropertyRow
              key={prop.key}
              property={prop}
              onChange={onChange}
              onReset={onReset}
              editable={editable}
            />
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * PropertyInspector component.
 *
 * A panel for inspecting and editing component/element properties
 * with support for various input types, grouping, and search.
 *
 * @example
 * ```tsx
 * <PropertyInspector
 *   selectedElement={{ id: "1", name: "Button", type: "component" }}
 *   properties={[
 *     { key: "label", label: "Label", type: "string", value: "Click me" },
 *     { key: "disabled", label: "Disabled", type: "boolean", value: false },
 *   ]}
 *   onChange={(key, value) => updateProperty(key, value)}
 *   editable
 * />
 * ```
 */
export const PropertyInspector = forwardRef<HTMLDivElement, PropertyInspectorProps>(
  (
    {
      selectedElement,
      properties = [],
      grouped = false,
      onChange,
      onReset,
      emptyMessage = "Select an element to view its properties",
      editable = true,
      showSearch = true,
      className = "",
      ...props
    },
    ref
  ) => {
    const [searchQuery, setSearchQuery] = useState("");

    // Handle property change
    const handleChange = useCallback(
      (key: string, value: unknown) => {
        onChange?.(key, value);
      },
      [onChange]
    );

    // Handle reset
    const handleReset = useCallback(
      (key: string) => {
        onReset?.(key);
      },
      [onReset]
    );

    // Check if properties are grouped
    const isGrouped = grouped || (properties.length > 0 && "properties" in properties[0]);

    // Filter flat properties by search
    const filteredFlatProperties =
      !isGrouped && searchQuery
        ? (properties as PropertyDefinition[]).filter(
            (p) =>
              p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.key.toLowerCase().includes(searchQuery.toLowerCase()) ||
              p.description?.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : (properties as PropertyDefinition[]);

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
          <h3 className="text-sm font-semibold text-neutral-900">Properties</h3>
          {selectedElement && (
            <p className="text-xs text-neutral-500 mt-0.5">
              {selectedElement.name} ({selectedElement.type})
            </p>
          )}
        </div>

        {/* Search */}
        {showSearch && properties.length > 0 && (
          <div className="px-3 py-2 border-b border-neutral-100">
            <div className="relative">
              <SearchIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
              <input
                type="text"
                placeholder="Search properties..."
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

        {/* Content */}
        <div className="flex-1 overflow-auto p-3">
          {/* Empty state */}
          {!selectedElement && (
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

          {/* No properties */}
          {selectedElement && properties.length === 0 && (
            <div className="text-center py-8">
              <p className="text-sm text-neutral-500">No properties available</p>
            </div>
          )}

          {/* Grouped properties */}
          {selectedElement && isGrouped && (
            <div className="flex flex-col gap-3">
              {(properties as PropertyGroup[]).map((group) => (
                <PropertyGroupComponent
                  key={group.name}
                  group={group}
                  onChange={handleChange}
                  onReset={handleReset}
                  editable={editable}
                  searchQuery={searchQuery}
                />
              ))}
            </div>
          )}

          {/* Flat properties */}
          {selectedElement && !isGrouped && filteredFlatProperties.length > 0 && (
            <div className="flex flex-col">
              {filteredFlatProperties.map((prop) => (
                <PropertyRow
                  key={prop.key}
                  property={prop}
                  onChange={handleChange}
                  onReset={handleReset}
                  editable={editable}
                />
              ))}
            </div>
          )}

          {/* No search results */}
          {selectedElement &&
            searchQuery &&
            ((isGrouped &&
              (properties as PropertyGroup[]).every(
                (g) =>
                  !g.properties.some(
                    (p) =>
                      p.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
                      p.key.toLowerCase().includes(searchQuery.toLowerCase())
                  )
              )) ||
              (!isGrouped && filteredFlatProperties.length === 0)) && (
              <div className="text-center py-8">
                <p className="text-sm text-neutral-500">No properties match "{searchQuery}"</p>
              </div>
            )}
        </div>

        {/* Footer with stats */}
        {selectedElement && properties.length > 0 && (
          <div className="px-3 py-1.5 bg-neutral-50 border-t border-neutral-200 text-xs text-neutral-500">
            {isGrouped
              ? `${(properties as PropertyGroup[]).reduce((acc, g) => acc + g.properties.length, 0)} properties in ${properties.length} groups`
              : `${properties.length} properties`}
          </div>
        )}
      </div>
    );
  }
);

PropertyInspector.displayName = "PropertyInspector";

export default PropertyInspector;
