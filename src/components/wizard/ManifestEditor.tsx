/**
 * D052 - src/components/wizard/ManifestEditor.tsx
 * ================================================
 * Manifest editor form for plugin creation wizard.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D011 (Input.tsx),
 *               D012 (Select.tsx), D050 (PluginWizard.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { forwardRef, useCallback, useMemo, type HTMLAttributes } from "react";
import type { PluginManifestData } from "./PluginWizard";

/**
 * ManifestEditor component props.
 */
export interface ManifestEditorProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Current manifest data */
  value: PluginManifestData;
  /** Callback when data changes */
  onChange: (data: Partial<PluginManifestData>) => void;
  /** Contract type (used for name prefix) */
  contract?: string;
  /** Validation errors */
  errors?: Record<string, string>;
  /** Whether form is disabled */
  disabled?: boolean;
  /** Whether to show advanced options */
  showAdvanced?: boolean;
  /** Custom section to render after basic info */
  additionalContent?: React.ReactNode;
}

/**
 * License options.
 */
const LICENSE_OPTIONS = [
  { value: "MIT", label: "MIT License" },
  { value: "Apache-2.0", label: "Apache 2.0" },
  { value: "GPL-3.0", label: "GPL 3.0" },
  { value: "BSD-3-Clause", label: "BSD 3-Clause" },
  { value: "ISC", label: "ISC License" },
  { value: "Proprietary", label: "Proprietary" },
];

/**
 * Python version options.
 */
const PYTHON_VERSION_OPTIONS = [
  { value: ">=3.11", label: "Python 3.11+" },
  { value: ">=3.10", label: "Python 3.10+" },
  { value: ">=3.9", label: "Python 3.9+" },
];

/**
 * Form field component.
 */
interface FormFieldProps {
  label: string;
  htmlFor: string;
  error?: string;
  required?: boolean;
  helpText?: string;
  children: React.ReactNode;
}

const FormField: React.FC<FormFieldProps> = ({
  label,
  htmlFor,
  error,
  required,
  helpText,
  children,
}) => (
  <div>
    <label
      htmlFor={htmlFor}
      className={[
        "block",
        "mb-1.5",
        "text-sm",
        "font-medium",
        error ? "text-error-700" : "text-neutral-700",
      ].join(" ")}
    >
      {label}
      {required && (
        <span className="text-error-500 ml-0.5" aria-hidden="true">
          *
        </span>
      )}
    </label>
    {children}
    {error && (
      <p className="mt-1 text-sm text-error-600" role="alert">
        {error}
      </p>
    )}
    {helpText && !error && (
      <p className="mt-1 text-sm text-neutral-500">{helpText}</p>
    )}
  </div>
);

/**
 * Input styles.
 */
const inputStyles = [
  "block",
  "w-full",
  "px-3",
  "py-2",
  "text-sm",
  "bg-white",
  "border",
  "border-neutral-300",
  "rounded-md",
  "placeholder:text-neutral-400",
  "focus:outline-none",
  "focus:ring-2",
  "focus:ring-primary-500",
  "focus:border-transparent",
  "disabled:bg-neutral-50",
  "disabled:text-neutral-500",
].join(" ");

const inputErrorStyles = [
  "border-error-500",
  "focus:ring-error-500",
].join(" ");

/**
 * Textarea styles.
 */
const textareaStyles = [
  inputStyles,
  "min-h-20",
  "resize-y",
].join(" ");

/**
 * Select styles.
 */
const selectStyles = [
  inputStyles,
  "appearance-none",
  "cursor-pointer",
  "pr-10",
].join(" ");

/**
 * Checkbox styles.
 */
const checkboxStyles = [
  "h-4",
  "w-4",
  "text-primary-600",
  "border-neutral-300",
  "rounded",
  "focus:ring-primary-500",
  "focus:ring-offset-0",
].join(" ");

/**
 * ManifestEditor component.
 *
 * Form for editing plugin manifest metadata. Provides fields for
 * all required and optional manifest properties.
 *
 * @example
 * ```tsx
 * <ManifestEditor
 *   value={manifestData}
 *   onChange={(updates) => setManifestData(prev => ({ ...prev, ...updates }))}
 *   contract="tts"
 * />
 * ```
 */
export const ManifestEditor = forwardRef<HTMLDivElement, ManifestEditorProps>(
  (
    {
      value,
      onChange,
      contract,
      errors = {},
      disabled = false,
      showAdvanced = false,
      additionalContent,
      className = "",
      ...props
    },
    ref
  ) => {
    // Generate plugin name from display name
    const generatePluginName = useCallback(
      (displayName: string): string => {
        if (!contract) return "";
        const slug = displayName
          .toLowerCase()
          .replace(/[^a-z0-9\s]/g, "")
          .replace(/\s+/g, "_")
          .replace(/_+/g, "_")
          .replace(/^_|_$/g, "");
        return slug ? `${contract}_${slug}_plugin` : "";
      },
      [contract]
    );

    // Handle display name change and auto-generate plugin name
    const handleDisplayNameChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const displayName = e.target.value;
        const name = generatePluginName(displayName);
        onChange({ displayName, name });
      },
      [generatePluginName, onChange]
    );

    // Handle input change
    const handleInputChange = useCallback(
      (field: keyof PluginManifestData) =>
        (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
          onChange({ [field]: e.target.value });
        },
      [onChange]
    );

    // Handle checkbox change
    const handleCheckboxChange = useCallback(
      (field: keyof PluginManifestData) =>
        (e: React.ChangeEvent<HTMLInputElement>) => {
          onChange({ [field]: e.target.checked });
        },
      [onChange]
    );

    // Handle number change
    const handleNumberChange = useCallback(
      (field: keyof PluginManifestData) =>
        (e: React.ChangeEvent<HTMLInputElement>) => {
          const num = parseInt(e.target.value, 10);
          if (!isNaN(num)) {
            onChange({ [field]: num });
          }
        },
      [onChange]
    );

    // Handle tags input (comma-separated)
    const handleTagsChange = useCallback(
      (e: React.ChangeEvent<HTMLInputElement>) => {
        const tags = e.target.value
          .split(",")
          .map((t) => t.trim())
          .filter((t) => t.length > 0);
        onChange({ tags });
      },
      [onChange]
    );

    // Tags as comma-separated string
    const tagsString = useMemo(() => value.tags.join(", "), [value.tags]);

    // Container styles
    const containerStyles = [
      "space-y-6",
      className,
    ].filter(Boolean).join(" ");

    return (
      <div ref={ref} className={containerStyles} {...props}>
        {/* Basic Information Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">
            Basic Information
          </h3>

          {/* Display Name */}
          <FormField
            label="Display Name"
            htmlFor="displayName"
            required
            error={errors.displayName}
            helpText="Human-readable name shown in the UI"
          >
            <input
              type="text"
              id="displayName"
              value={value.displayName}
              onChange={handleDisplayNameChange}
              disabled={disabled}
              placeholder="e.g., Kokoro TTS"
              className={[inputStyles, errors.displayName && inputErrorStyles].filter(Boolean).join(" ")}
            />
          </FormField>

          {/* Plugin Name (auto-generated) */}
          <FormField
            label="Plugin Name"
            htmlFor="name"
            required
            error={errors.name}
            helpText="Auto-generated from display name and contract"
          >
            <input
              type="text"
              id="name"
              value={value.name}
              onChange={handleInputChange("name")}
              disabled={disabled}
              placeholder={`${contract || "contract"}_name_plugin`}
              className={[
                inputStyles,
                errors.name && inputErrorStyles,
                "font-mono",
                "text-sm",
              ].filter(Boolean).join(" ")}
            />
          </FormField>

          {/* Version */}
          <FormField
            label="Version"
            htmlFor="version"
            required
            error={errors.version}
            helpText="Semantic version (major.minor.patch)"
          >
            <input
              type="text"
              id="version"
              value={value.version}
              onChange={handleInputChange("version")}
              disabled={disabled}
              placeholder="1.0.0"
              className={[inputStyles, errors.version && inputErrorStyles].filter(Boolean).join(" ")}
            />
          </FormField>

          {/* Description */}
          <FormField
            label="Description"
            htmlFor="description"
            error={errors.description}
            helpText="Brief description of what your plugin does"
          >
            <textarea
              id="description"
              value={value.description}
              onChange={handleInputChange("description")}
              disabled={disabled}
              placeholder="Describe your plugin's functionality..."
              rows={3}
              className={[textareaStyles, errors.description && inputErrorStyles].filter(Boolean).join(" ")}
            />
          </FormField>
        </div>

        {/* Author & License Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">
            Author & License
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Author */}
            <FormField
              label="Author"
              htmlFor="author"
              error={errors.author}
            >
              <input
                type="text"
                id="author"
                value={value.author}
                onChange={handleInputChange("author")}
                disabled={disabled}
                placeholder="Your name or organization"
                className={[inputStyles, errors.author && inputErrorStyles].filter(Boolean).join(" ")}
              />
            </FormField>

            {/* License */}
            <FormField
              label="License"
              htmlFor="license"
              error={errors.license}
            >
              <div className="relative">
                <select
                  id="license"
                  value={value.license}
                  onChange={handleInputChange("license")}
                  disabled={disabled}
                  className={selectStyles}
                >
                  {LICENSE_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </FormField>
          </div>
        </div>

        {/* Entry Point Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">
            Entry Point
          </h3>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Entry Point Module */}
            <FormField
              label="Entry Point Module"
              htmlFor="entryPoint"
              error={errors.entryPoint}
              helpText="Python module name (without .py)"
            >
              <input
                type="text"
                id="entryPoint"
                value={value.entryPoint}
                onChange={handleInputChange("entryPoint")}
                disabled={disabled}
                placeholder="plugin"
                className={[inputStyles, "font-mono", errors.entryPoint && inputErrorStyles].filter(Boolean).join(" ")}
              />
            </FormField>

            {/* Python Version */}
            <FormField
              label="Python Version"
              htmlFor="pythonRequires"
              error={errors.pythonRequires}
            >
              <div className="relative">
                <select
                  id="pythonRequires"
                  value={value.pythonRequires}
                  onChange={handleInputChange("pythonRequires")}
                  disabled={disabled}
                  className={selectStyles}
                >
                  {PYTHON_VERSION_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <div className="absolute inset-y-0 right-0 flex items-center pr-2 pointer-events-none">
                  <svg className="h-4 w-4 text-neutral-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
            </FormField>
          </div>
        </div>

        {/* Tags Section */}
        <div className="space-y-4">
          <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">
            Tags & Categorization
          </h3>

          <FormField
            label="Tags"
            htmlFor="tags"
            error={errors.tags}
            helpText="Comma-separated list of tags for search and filtering"
          >
            <input
              type="text"
              id="tags"
              value={tagsString}
              onChange={handleTagsChange}
              disabled={disabled}
              placeholder="e.g., japanese, high-quality, local"
              className={[inputStyles, errors.tags && inputErrorStyles].filter(Boolean).join(" ")}
            />
          </FormField>
        </div>

        {/* Advanced Options */}
        {showAdvanced && (
          <div className="space-y-4 pt-4 border-t border-neutral-200">
            <h3 className="text-sm font-semibold text-neutral-900 uppercase tracking-wide">
              System Requirements
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Minimum Memory */}
              <FormField
                label="Min Memory (MB)"
                htmlFor="minMemoryMb"
                error={errors.minMemoryMb}
              >
                <input
                  type="number"
                  id="minMemoryMb"
                  value={value.minMemoryMb}
                  onChange={handleNumberChange("minMemoryMb")}
                  disabled={disabled}
                  min={0}
                  step={256}
                  className={[inputStyles, errors.minMemoryMb && inputErrorStyles].filter(Boolean).join(" ")}
                />
              </FormField>

              {/* GPU Required */}
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="gpuRequired"
                  checked={value.gpuRequired}
                  onChange={handleCheckboxChange("gpuRequired")}
                  disabled={disabled}
                  className={checkboxStyles}
                />
                <label htmlFor="gpuRequired" className="text-sm text-neutral-700">
                  GPU Required
                </label>
              </div>

              {/* GPU Recommended */}
              <div className="flex items-center gap-3 pt-6">
                <input
                  type="checkbox"
                  id="gpuRecommended"
                  checked={value.gpuRecommended}
                  onChange={handleCheckboxChange("gpuRecommended")}
                  disabled={disabled}
                  className={checkboxStyles}
                />
                <label htmlFor="gpuRecommended" className="text-sm text-neutral-700">
                  GPU Recommended
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Additional content slot */}
        {additionalContent}
      </div>
    );
  }
);

ManifestEditor.displayName = "ManifestEditor";

/**
 * Compact manifest editor for inline editing.
 */
export interface ManifestEditorCompactProps {
  value: Partial<PluginManifestData>;
  onChange: (data: Partial<PluginManifestData>) => void;
  fields?: Array<keyof PluginManifestData>;
  className?: string;
}

export const ManifestEditorCompact: React.FC<ManifestEditorCompactProps> = ({
  value,
  onChange,
  fields = ["displayName", "version", "description"],
  className = "",
}) => {
  return (
    <div className={["space-y-3", className].filter(Boolean).join(" ")}>
      {fields.includes("displayName") && (
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">
            Name
          </label>
          <input
            type="text"
            value={value.displayName || ""}
            onChange={(e) => onChange({ displayName: e.target.value })}
            className={[inputStyles, "text-sm"].join(" ")}
          />
        </div>
      )}
      {fields.includes("version") && (
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">
            Version
          </label>
          <input
            type="text"
            value={value.version || ""}
            onChange={(e) => onChange({ version: e.target.value })}
            className={[inputStyles, "text-sm"].join(" ")}
          />
        </div>
      )}
      {fields.includes("description") && (
        <div>
          <label className="block text-xs font-medium text-neutral-500 mb-1">
            Description
          </label>
          <textarea
            value={value.description || ""}
            onChange={(e) => onChange({ description: e.target.value })}
            rows={2}
            className={[textareaStyles, "text-sm"].join(" ")}
          />
        </div>
      )}
    </div>
  );
};

ManifestEditorCompact.displayName = "ManifestEditorCompact";

export default ManifestEditor;
