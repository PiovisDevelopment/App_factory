/**
 * D053 - src/components/wizard/DependencySelector.tsx
 * ====================================================
 * Dependency picker for plugin creation wizard.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D011 (Input.tsx), D050 (PluginWizard.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { forwardRef, useState, useCallback, useMemo, type HTMLAttributes } from "react";

/**
 * Python package dependency.
 */
export interface PythonDependency {
  /** Package name */
  name: string;
  /** Version constraint (optional) */
  version?: string;
  /** Whether package is optional */
  optional?: boolean;
  /** Package description */
  description?: string;
  /** Category for grouping */
  category?: string;
}

/**
 * Common dependency presets by contract type.
 */
export const DEPENDENCY_PRESETS: Record<string, PythonDependency[]> = {
  tts: [
    { name: "torch", version: ">=2.0.0", description: "PyTorch for neural TTS", category: "ML" },
    { name: "numpy", description: "Numerical computing", category: "Core" },
    { name: "soundfile", description: "Audio file I/O", category: "Audio" },
    { name: "scipy", description: "Scientific computing", category: "Core" },
    { name: "librosa", description: "Audio analysis", category: "Audio", optional: true },
  ],
  stt: [
    { name: "torch", version: ">=2.0.0", description: "PyTorch for speech recognition", category: "ML" },
    { name: "numpy", description: "Numerical computing", category: "Core" },
    { name: "soundfile", description: "Audio file I/O", category: "Audio" },
    { name: "torchaudio", description: "Audio processing with PyTorch", category: "Audio" },
  ],
  llm: [
    { name: "httpx", description: "HTTP client for API calls", category: "Networking" },
    { name: "pydantic", version: ">=2.0", description: "Data validation", category: "Core" },
  ],
  mcp: [
    { name: "httpx", description: "HTTP client", category: "Networking" },
    { name: "websockets", description: "WebSocket client", category: "Networking" },
  ],
  vision: [
    { name: "torch", version: ">=2.0.0", description: "PyTorch for vision models", category: "ML" },
    { name: "torchvision", description: "Vision utilities", category: "ML" },
    { name: "pillow", description: "Image processing", category: "Image" },
    { name: "numpy", description: "Numerical computing", category: "Core" },
  ],
  embedding: [
    { name: "torch", version: ">=2.0.0", description: "PyTorch for embeddings", category: "ML" },
    { name: "transformers", description: "Hugging Face transformers", category: "ML" },
    { name: "numpy", description: "Numerical computing", category: "Core" },
  ],
  debug: [],
};

/**
 * Common packages that work across contracts.
 */
export const COMMON_PACKAGES: PythonDependency[] = [
  { name: "pydantic", version: ">=2.0", description: "Data validation", category: "Core" },
  { name: "httpx", description: "Modern HTTP client", category: "Networking" },
  { name: "aiohttp", description: "Async HTTP client", category: "Networking" },
  { name: "numpy", description: "Numerical computing", category: "Core" },
  { name: "scipy", description: "Scientific computing", category: "Core" },
  { name: "pillow", description: "Image processing", category: "Image" },
  { name: "requests", description: "HTTP library", category: "Networking" },
  { name: "python-dotenv", description: "Environment variables", category: "Config" },
  { name: "pyyaml", description: "YAML parsing", category: "Config" },
  { name: "rich", description: "Rich text formatting", category: "Debug" },
];

/**
 * DependencySelector component props.
 */
export interface DependencySelectorProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Current dependencies list */
  value: string[];
  /** Callback when dependencies change */
  onChange: (dependencies: string[]) => void;
  /** Contract type for presets */
  contract?: string;
  /** Whether to show presets */
  showPresets?: boolean;
  /** Whether to show common packages */
  showCommon?: boolean;
  /** Maximum number of dependencies */
  maxDependencies?: number;
  /** Disabled state */
  disabled?: boolean;
}

/**
 * Package icon.
 */
const PackageIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M16.5 9.4l-9-5.19" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
    <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
    <line x1="12" y1="22.08" x2="12" y2="12" />
  </svg>
);

/**
 * Plus icon.
 */
const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/**
 * X icon.
 */
const XIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Parse dependency string into name and version.
 */
const parseDependency = (dep: string): { name: string; version: string } => {
  const match = dep.match(/^([a-zA-Z0-9_-]+)(.*)$/);
  if (match) {
    const name = match[1] ?? "";
    const version = match[2] ?? "";
    return { name, version };
  }
  return { name: dep, version: "" };
};

/**
 * Format dependency as string.
 */
const formatDependency = (name: string, version?: string): string => {
  return version ? `${name}${version}` : name;
};

/**
 * DependencySelector component.
 *
 * Allows users to add/remove Python package dependencies for their plugin.
 * Includes presets based on contract type and common package suggestions.
 *
 * @example
 * ```tsx
 * <DependencySelector
 *   value={dependencies}
 *   onChange={setDependencies}
 *   contract="tts"
 *   showPresets
 * />
 * ```
 */
export const DependencySelector = forwardRef<HTMLDivElement, DependencySelectorProps>(
  (
    {
      value,
      onChange,
      contract,
      showPresets = true,
      showCommon = true,
      maxDependencies = 50,
      disabled = false,
      className = "",
      ...props
    },
    ref
  ) => {
    // State for new dependency input
    const [newDep, setNewDep] = useState("");
    const [newVersion, setNewVersion] = useState("");
    const [inputError, setInputError] = useState("");

    // Get preset dependencies for contract
    const presetDeps = useMemo(() => {
      if (!contract || !showPresets) return [];
      return DEPENDENCY_PRESETS[contract] || [];
    }, [contract, showPresets]);

    // Parse current dependencies
    const parsedDeps = useMemo(() => {
      return value.map(parseDependency);
    }, [value]);

    // Check if a package is already added
    const isAdded = useCallback(
      (packageName: string): boolean => {
        return parsedDeps.some((d) => d.name.toLowerCase() === packageName.toLowerCase());
      },
      [parsedDeps]
    );

    // Add a dependency
    const addDependency = useCallback(
      (name: string, version?: string) => {
        if (disabled) return;
        if (value.length >= maxDependencies) {
          setInputError(`Maximum ${maxDependencies} dependencies allowed`);
          return;
        }
        if (isAdded(name)) {
          setInputError(`${name} is already added`);
          return;
        }

        const dep = formatDependency(name, version);
        onChange([...value, dep]);
        setNewDep("");
        setNewVersion("");
        setInputError("");
      },
      [disabled, value, maxDependencies, isAdded, onChange]
    );

    // Remove a dependency
    const removeDependency = useCallback(
      (index: number) => {
        if (disabled) return;
        const newDeps = [...value];
        newDeps.splice(index, 1);
        onChange(newDeps);
      },
      [disabled, value, onChange]
    );

    // Handle add from input
    const handleAdd = useCallback(() => {
      if (!newDep.trim()) {
        setInputError("Package name is required");
        return;
      }

      // Validate package name
      if (!/^[a-zA-Z0-9_-]+$/.test(newDep.trim())) {
        setInputError("Invalid package name");
        return;
      }

      // Validate version if provided
      if (newVersion && !/^(>=|<=|==|~=|>|<)?[\d.]+[a-zA-Z0-9.-]*$/.test(newVersion.trim())) {
        setInputError("Invalid version constraint");
        return;
      }

      addDependency(newDep.trim(), newVersion.trim() || undefined);
    }, [newDep, newVersion, addDependency]);

    // Handle key press
    const handleKeyPress = useCallback(
      (e: React.KeyboardEvent) => {
        if (e.key === "Enter") {
          e.preventDefault();
          handleAdd();
        }
      },
      [handleAdd]
    );

    // Container styles
    const containerStyles = [
      "space-y-6",
      className,
    ].filter(Boolean).join(" ");

    // Input styles
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

    return (
      <div ref={ref} className={containerStyles} {...props}>
        {/* Add dependency section */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-neutral-700">
            Add Package
          </label>
          <div className="flex gap-2">
            <div className="flex-1">
              <input
                type="text"
                value={newDep}
                onChange={(e) => {
                  setNewDep(e.target.value);
                  setInputError("");
                }}
                onKeyPress={handleKeyPress}
                disabled={disabled}
                placeholder="Package name (e.g., numpy)"
                className={inputStyles}
              />
            </div>
            <div className="w-32">
              <input
                type="text"
                value={newVersion}
                onChange={(e) => {
                  setNewVersion(e.target.value);
                  setInputError("");
                }}
                onKeyPress={handleKeyPress}
                disabled={disabled}
                placeholder=">=1.0.0"
                className={inputStyles}
              />
            </div>
            <button
              type="button"
              onClick={handleAdd}
              disabled={disabled || !newDep.trim()}
              className={[
                "inline-flex",
                "items-center",
                "justify-center",
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
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
          {inputError && (
            <p className="text-sm text-error-600">{inputError}</p>
          )}
        </div>

        {/* Current dependencies */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="block text-sm font-medium text-neutral-700">
              Dependencies ({value.length})
            </label>
            {value.length > 0 && (
              <button
                type="button"
                onClick={() => onChange([])}
                disabled={disabled}
                className="text-xs text-neutral-500 hover:text-neutral-700"
              >
                Clear all
              </button>
            )}
          </div>

          {value.length === 0 ? (
            <div className="flex items-center justify-center p-6 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-200">
              <div className="text-center">
                <PackageIcon className="mx-auto h-8 w-8 text-neutral-400" />
                <p className="mt-2 text-sm text-neutral-500">
                  No dependencies added yet
                </p>
                <p className="mt-1 text-xs text-neutral-400">
                  Add packages or select from presets below
                </p>
              </div>
            </div>
          ) : (
            <div className="flex flex-wrap gap-2">
              {parsedDeps.map((dep, index) => (
                <div
                  key={index}
                  className={[
                    "inline-flex",
                    "items-center",
                    "gap-1.5",
                    "px-3",
                    "py-1.5",
                    "bg-neutral-100",
                    "text-neutral-800",
                    "rounded-full",
                    "text-sm",
                    "font-medium",
                  ].join(" ")}
                >
                  <PackageIcon className="h-3.5 w-3.5 text-neutral-500" />
                  <span className="font-mono">{dep.name}</span>
                  {dep.version && (
                    <span className="text-neutral-500 font-mono text-xs">
                      {dep.version}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => removeDependency(index)}
                    disabled={disabled}
                    className={[
                      "ml-1",
                      "p-0.5",
                      "rounded-full",
                      "text-neutral-400",
                      "hover:text-neutral-600",
                      "hover:bg-neutral-200",
                      "transition-colors",
                      "duration-150",
                    ].join(" ")}
                  >
                    <XIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Preset dependencies */}
        {showPresets && presetDeps.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700">
              Recommended for {contract?.toUpperCase()}
            </label>
            <div className="flex flex-wrap gap-2">
              {presetDeps.map((dep) => {
                const added = isAdded(dep.name);
                return (
                  <button
                    key={dep.name}
                    type="button"
                    onClick={() => !added && addDependency(dep.name, dep.version)}
                    disabled={disabled || added}
                    title={dep.description}
                    className={[
                      "inline-flex",
                      "items-center",
                      "gap-1.5",
                      "px-3",
                      "py-1.5",
                      "rounded-full",
                      "text-sm",
                      "font-medium",
                      "border",
                      "transition-colors",
                      "duration-150",
                      added
                        ? "bg-success-50 border-success-200 text-success-700 cursor-default"
                        : "bg-white border-neutral-200 text-neutral-700 hover:border-primary-300 hover:bg-primary-50 cursor-pointer",
                      dep.optional && !added && "border-dashed",
                    ].filter(Boolean).join(" ")}
                  >
                    {added ? (
                      <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <polyline points="20 6 9 17 4 12" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    ) : (
                      <PlusIcon className="h-3.5 w-3.5" />
                    )}
                    <span className="font-mono">{dep.name}</span>
                    {dep.version && (
                      <span className="text-xs opacity-60">{dep.version}</span>
                    )}
                    {dep.optional && !added && (
                      <span className="text-xs text-neutral-400">(optional)</span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Common packages */}
        {showCommon && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700">
              Common Packages
            </label>
            <div className="flex flex-wrap gap-2">
              {COMMON_PACKAGES.filter((dep) => !isAdded(dep.name)).slice(0, 10).map((dep) => (
                <button
                  key={dep.name}
                  type="button"
                  onClick={() => addDependency(dep.name, dep.version)}
                  disabled={disabled}
                  title={dep.description}
                  className={[
                    "inline-flex",
                    "items-center",
                    "gap-1.5",
                    "px-2.5",
                    "py-1",
                    "rounded-md",
                    "text-xs",
                    "font-medium",
                    "bg-white",
                    "border",
                    "border-neutral-200",
                    "text-neutral-600",
                    "hover:border-neutral-300",
                    "hover:bg-neutral-50",
                    "cursor-pointer",
                    "transition-colors",
                    "duration-150",
                  ].join(" ")}
                >
                  <PlusIcon className="h-3 w-3" />
                  <span className="font-mono">{dep.name}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Requirements.txt preview */}
        {value.length > 0 && (
          <div className="space-y-2">
            <label className="block text-sm font-medium text-neutral-700">
              requirements.txt Preview
            </label>
            <pre className="p-3 bg-neutral-900 text-neutral-100 rounded-lg text-sm font-mono overflow-x-auto">
              {value.join("\n")}
            </pre>
          </div>
        )}
      </div>
    );
  }
);

DependencySelector.displayName = "DependencySelector";

/**
 * Compact dependency display.
 */
export interface DependencyListProps {
  dependencies: string[];
  className?: string;
}

export const DependencyList: React.FC<DependencyListProps> = ({
  dependencies,
  className = "",
}) => {
  if (dependencies.length === 0) {
    return (
      <span className="text-sm text-neutral-500 italic">No dependencies</span>
    );
  }

  return (
    <div className={["flex flex-wrap gap-1", className].filter(Boolean).join(" ")}>
      {dependencies.map((dep, index) => {
        const { name, version } = parseDependency(dep);
        return (
          <span
            key={index}
            className="inline-flex items-center px-2 py-0.5 bg-neutral-100 text-neutral-700 rounded text-xs font-mono"
          >
            {name}
            {version && <span className="text-neutral-500 ml-0.5">{version}</span>}
          </span>
        );
      })}
    </div>
  );
};

DependencyList.displayName = "DependencyList";

export default DependencySelector;
