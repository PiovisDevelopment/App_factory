/**
 * UJ-1.1.4 - src/components/wizard/ImportWizard.tsx
 * ==================================================
 * Multi-step wizard for importing third-party components/plugins from external URLs.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D011 (Input.tsx), D015 (Modal.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { useState, useCallback, useMemo } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Modal } from "../ui/Modal";
import { Panel } from "../ui/Panel";

/**
 * Import source type.
 */
export type ImportSourceType = "github" | "url" | "local";

/**
 * Component manifest from external source.
 */
export interface ComponentManifest {
  /** Component name */
  name: string;
  /** Display name */
  displayName: string;
  /** Version */
  version: string;
  /** Description */
  description: string;
  /** Author */
  author: string;
  /** License */
  license: string;
  /** Component type */
  type: "plugin" | "component" | "template";
  /** Contract type (for plugins) */
  contract?: string;
  /** Repository URL */
  repository?: string;
  /** Homepage URL */
  homepage?: string;
  /** Dependencies */
  dependencies?: string[];
  /** Tags */
  tags?: string[];
}

/**
 * Import wizard step.
 */
export type ImportWizardStep = "source" | "fetch" | "preview" | "install";

/**
 * Import wizard props.
 */
export interface ImportWizardProps {
  /** Whether the wizard modal is open */
  isOpen: boolean;
  /** Callback to close the wizard */
  onClose: () => void;
  /** Callback when import is complete */
  onImport?: (manifest: ComponentManifest, sourceUrl: string) => Promise<void>;
  /** Custom className */
  className?: string;
}

/**
 * Import validation result.
 */
interface ValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * GitHub icon.
 */
const GitHubIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z" />
  </svg>
);

/**
 * Link icon.
 */
const LinkIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
    <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
  </svg>
);

/**
 * Folder icon.
 */
const FolderIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);

/**
 * Check icon.
 */
const CheckIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Alert icon.
 */
const AlertIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="8" x2="12" y2="12" />
    <line x1="12" y1="16" x2="12.01" y2="16" />
  </svg>
);

/**
 * Loader icon.
 */
const LoaderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={`${className} animate-spin`}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" />
    <path
      className="opacity-75"
      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      fill="currentColor"
    />
  </svg>
);

/**
 * Source type selector card.
 */
const SourceTypeCard: React.FC<{
  type: ImportSourceType;
  title: string;
  description: string;
  icon: React.ReactNode;
  selected: boolean;
  onClick: () => void;
}> = ({ type: _type, title, description, icon, selected, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    className={[
      "p-4",
      "rounded-lg",
      "border-2",
      "text-left",
      "transition-all",
      "duration-200",
      "w-full",
      selected
        ? "border-primary-500 bg-primary-50"
        : "border-neutral-200 hover:border-primary-300 bg-white",
    ].join(" ")}
  >
    <div className="flex items-center gap-3">
      <div
        className={[
          "h-10 w-10 rounded-lg flex items-center justify-center",
          selected ? "bg-primary-500 text-white" : "bg-neutral-100 text-neutral-600",
        ].join(" ")}
      >
        {icon}
      </div>
      <div>
        <h4 className="font-medium text-neutral-900">{title}</h4>
        <p className="text-sm text-neutral-500">{description}</p>
      </div>
    </div>
  </button>
);

/**
 * Validate URL format.
 */
const validateUrl = (url: string): ValidationResult => {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!url.trim()) {
    errors.push("URL is required");
    return { isValid: false, errors, warnings };
  }

  try {
    const parsed = new URL(url);
    if (!["http:", "https:"].includes(parsed.protocol)) {
      errors.push("URL must use http or https protocol");
    }
  } catch {
    errors.push("Invalid URL format");
  }

  // GitHub-specific validation
  if (url.includes("github.com")) {
    if (!url.includes("/blob/") && !url.includes("/raw/") && !url.endsWith(".json")) {
      warnings.push("For GitHub URLs, ensure you're linking to a raw file or manifest.json");
    }
  }

  return {
    isValid: errors.length === 0,
    errors,
    warnings,
  };
};

/**
 * Fetch manifest from URL - transforms GitHub URLs and handles errors.
 */
const fetchManifest = async (url: string): Promise<ComponentManifest> => {
  // Transform GitHub blob URLs to raw URLs
  let fetchUrl = url;
  if (url.includes('github.com') && url.includes('/blob/')) {
    fetchUrl = url
      .replace('github.com', 'raw.githubusercontent.com')
      .replace('/blob/', '/');
  }

  try {
    const response = await fetch(fetchUrl, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    // Validate required fields and normalize to ComponentManifest
    return {
      name: data.name || 'unknown',
      displayName: data.displayName || data.name || 'Unknown Component',
      version: data.version || '0.0.0',
      description: data.description || 'No description provided',
      author: data.author?.name || data.author || 'Unknown',
      license: data.license || 'Unknown',
      type: data.type || 'component',
      repository: data.repository?.url || data.repository || url,
      homepage: data.homepage,
      dependencies: data.dependencies ? Object.keys(data.dependencies) : [],
      tags: data.keywords || data.tags || [],
    };
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error('Invalid JSON: The URL did not return valid JSON data');
    }
    throw error;
  }
};

/**
 * ImportWizard component.
 *
 * A multi-step wizard for importing third-party components/plugins from
 * GitHub repositories or direct URLs.
 *
 * @example
 * ```tsx
 * <ImportWizard
 *   isOpen={showImportWizard}
 *   onClose={() => setShowImportWizard(false)}
 *   onImport={async (manifest, url) => {
 *     await installComponent(manifest, url);
 *   }}
 * />
 * ```
 */
export const ImportWizard: React.FC<ImportWizardProps> = ({
  isOpen,
  onClose,
  onImport,
  className = "",
}) => {
  // Wizard state
  const [currentStep, setCurrentStep] = useState<ImportWizardStep>("source");
  const [sourceType, setSourceType] = useState<ImportSourceType>("github");
  const [sourceUrl, setSourceUrl] = useState("");
  const [manifest, setManifest] = useState<ComponentManifest | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [validation, setValidation] = useState<ValidationResult | null>(null);

  // Step info
  const steps: { id: ImportWizardStep; title: string }[] = [
    { id: "source", title: "Source" },
    { id: "fetch", title: "Fetch" },
    { id: "preview", title: "Preview" },
    { id: "install", title: "Install" },
  ];

  const currentStepIndex = steps.findIndex((s) => s.id === currentStep);

  // URL validation
  const handleUrlChange = useCallback((value: string) => {
    setSourceUrl(value);
    if (value.trim()) {
      setValidation(validateUrl(value));
    } else {
      setValidation(null);
    }
  }, []);

  // Reset wizard
  const resetWizard = useCallback(() => {
    setCurrentStep("source");
    setSourceType("github");
    setSourceUrl("");
    setManifest(null);
    setError(null);
    setValidation(null);
    setIsLoading(false);
  }, []);

  // Handle close
  const handleClose = useCallback(() => {
    resetWizard();
    onClose();
  }, [onClose, resetWizard]);

  // Navigate to next step
  const handleNext = useCallback(async () => {
    setError(null);

    switch (currentStep) {
      case "source":
        if (!sourceUrl.trim()) {
          setError("Please enter a URL");
          return;
        }
        const urlValidation = validateUrl(sourceUrl);
        if (!urlValidation.isValid) {
          setError(urlValidation.errors[0]);
          return;
        }
        setCurrentStep("fetch");
        // Auto-start fetch
        setIsLoading(true);
        try {
          const fetchedManifest = await fetchManifest(sourceUrl);
          setManifest(fetchedManifest);
          setCurrentStep("preview");
        } catch (err) {
          setError("Failed to fetch manifest. Please check the URL and try again.");
          setCurrentStep("source");
        } finally {
          setIsLoading(false);
        }
        break;

      case "preview":
        setCurrentStep("install");
        setIsLoading(true);
        try {
          if (manifest && onImport) {
            await onImport(manifest, sourceUrl);
          }
          // Success - close wizard
          handleClose();
        } catch (err) {
          setError("Failed to install component. Please try again.");
        } finally {
          setIsLoading(false);
        }
        break;
    }
  }, [currentStep, sourceUrl, manifest, onImport, handleClose]);

  // Handle back
  const handleBack = useCallback(() => {
    switch (currentStep) {
      case "fetch":
      case "preview":
        setCurrentStep("source");
        break;
      case "install":
        setCurrentStep("preview");
        break;
    }
  }, [currentStep]);

  // Step content
  const renderStepContent = useMemo(() => {
    switch (currentStep) {
      case "source":
        return (
          <div className="space-y-6">
            {/* Source type selection */}
            <div className="space-y-3">
              <label className="block text-sm font-medium text-neutral-700">
                Import Source
              </label>
              <div className="grid grid-cols-3 gap-3">
                <SourceTypeCard
                  type="github"
                  title="GitHub"
                  description="Import from repository"
                  icon={<GitHubIcon className="h-5 w-5" />}
                  selected={sourceType === "github"}
                  onClick={() => setSourceType("github")}
                />
                <SourceTypeCard
                  type="url"
                  title="Direct URL"
                  description="Raw JSON manifest"
                  icon={<LinkIcon className="h-5 w-5" />}
                  selected={sourceType === "url"}
                  onClick={() => setSourceType("url")}
                />
                <SourceTypeCard
                  type="local"
                  title="Local File"
                  description="Browse local files"
                  icon={<FolderIcon className="h-5 w-5" />}
                  selected={sourceType === "local"}
                  onClick={() => setSourceType("local")}
                />
              </div>
            </div>

            {/* URL input */}
            <div className="space-y-2">
              <Input
                label={
                  sourceType === "github"
                    ? "GitHub URL"
                    : sourceType === "url"
                      ? "Manifest URL"
                      : "Local Path"
                }
                value={sourceUrl}
                onChange={(e) => handleUrlChange(e.target.value)}
                placeholder={
                  sourceType === "github"
                    ? "https://github.com/user/repo/blob/main/manifest.json"
                    : sourceType === "url"
                      ? "https://example.com/component/manifest.json"
                      : "C:/path/to/manifest.json"
                }
                fullWidth
                helperText={
                  sourceType === "github"
                    ? "Paste the URL to a GitHub repository or manifest.json file"
                    : sourceType === "url"
                      ? "Direct link to a component manifest JSON file"
                      : "Select a local manifest.json file"
                }
              />

              {/* Validation feedback */}
              {validation && (
                <div className="space-y-1">
                  {validation.errors.map((err, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-error-600">
                      <AlertIcon className="h-4 w-4" />
                      {err}
                    </div>
                  ))}
                  {validation.warnings.map((warn, i) => (
                    <div key={i} className="flex items-center gap-2 text-sm text-warning-600">
                      <AlertIcon className="h-4 w-4" />
                      {warn}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );

      case "fetch":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <LoaderIcon className="h-12 w-12 text-primary-500 mb-4" />
            <h3 className="text-lg font-medium text-neutral-900">Fetching Manifest</h3>
            <p className="text-sm text-neutral-500 mt-1">
              Retrieving component information from source...
            </p>
          </div>
        );

      case "preview":
        return (
          <div className="space-y-6">
            {manifest && (
              <>
                {/* Component header */}
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 rounded-lg bg-primary-100 flex items-center justify-center text-primary-600">
                    <FolderIcon className="h-8 w-8" />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold text-neutral-900">
                      {manifest.displayName}
                    </h3>
                    <p className="text-sm text-neutral-500">
                      {manifest.name} • v{manifest.version}
                    </p>
                    <p className="text-sm text-neutral-600 mt-2">{manifest.description}</p>
                  </div>
                </div>

                {/* Metadata panel */}
                <Panel variant="default" padding="md" radius="lg">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <dt className="text-xs font-medium text-neutral-500 uppercase">Author</dt>
                      <dd className="text-sm text-neutral-900">{manifest.author}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-500 uppercase">License</dt>
                      <dd className="text-sm text-neutral-900">{manifest.license}</dd>
                    </div>
                    <div>
                      <dt className="text-xs font-medium text-neutral-500 uppercase">Type</dt>
                      <dd className="text-sm text-neutral-900 capitalize">{manifest.type}</dd>
                    </div>
                    {manifest.contract && (
                      <div>
                        <dt className="text-xs font-medium text-neutral-500 uppercase">Contract</dt>
                        <dd className="text-sm text-neutral-900">{manifest.contract}</dd>
                      </div>
                    )}
                  </div>
                </Panel>

                {/* Tags */}
                {manifest.tags && manifest.tags.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {manifest.tags.map((tag) => (
                      <span
                        key={tag}
                        className="px-2 py-1 bg-neutral-100 text-neutral-600 text-xs rounded-full"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                )}

                {/* Dependencies warning */}
                {manifest.dependencies && manifest.dependencies.length > 0 && (
                  <div className="p-3 bg-warning-50 border border-warning-200 rounded-lg">
                    <div className="flex items-start gap-2">
                      <AlertIcon className="h-5 w-5 text-warning-600 shrink-0 mt-0.5" />
                      <div>
                        <h4 className="text-sm font-medium text-warning-800">
                          Dependencies Required
                        </h4>
                        <p className="text-sm text-warning-700 mt-1">
                          This component requires additional dependencies:{" "}
                          {manifest.dependencies.join(", ")}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        );

      case "install":
        return (
          <div className="flex flex-col items-center justify-center py-12">
            <LoaderIcon className="h-12 w-12 text-primary-500 mb-4" />
            <h3 className="text-lg font-medium text-neutral-900">Installing Component</h3>
            <p className="text-sm text-neutral-500 mt-1">
              Adding component to your project...
            </p>
          </div>
        );
    }
  }, [currentStep, sourceType, sourceUrl, manifest, validation, handleUrlChange]);

  // Can proceed to next step
  const canProceed = useMemo(() => {
    switch (currentStep) {
      case "source":
        return sourceUrl.trim().length > 0 && (!validation || validation.isValid);
      case "preview":
        return manifest !== null;
      default:
        return false;
    }
  }, [currentStep, sourceUrl, validation, manifest]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Import Component"
      size="lg"
      className={className}
    >
      <div className="space-y-6">
        {/* Step indicators */}
        <div className="flex items-center justify-between px-4">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <div className="flex items-center gap-2">
                <div
                  className={[
                    "h-8 w-8 rounded-full flex items-center justify-center text-sm font-medium",
                    index < currentStepIndex
                      ? "bg-success-500 text-white"
                      : index === currentStepIndex
                        ? "bg-primary-500 text-white"
                        : "bg-neutral-200 text-neutral-500",
                  ].join(" ")}
                >
                  {index < currentStepIndex ? (
                    <CheckIcon className="h-4 w-4" />
                  ) : (
                    index + 1
                  )}
                </div>
                <span
                  className={[
                    "text-sm font-medium",
                    index === currentStepIndex ? "text-primary-700" : "text-neutral-500",
                  ].join(" ")}
                >
                  {step.title}
                </span>
              </div>
              {index < steps.length - 1 && (
                <div
                  className={[
                    "flex-1 h-0.5 mx-2",
                    index < currentStepIndex ? "bg-success-500" : "bg-neutral-200",
                  ].join(" ")}
                />
              )}
            </React.Fragment>
          ))}
        </div>

        {/* Error message */}
        {error && (
          <div className="p-3 bg-error-50 border border-error-200 rounded-lg">
            <div className="flex items-center gap-2 text-error-700">
              <AlertIcon className="h-5 w-5" />
              <p className="text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Step content */}
        <div className="min-h-64">{renderStepContent}</div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-4 border-t border-neutral-200">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <div className="flex items-center gap-2">
            {currentStepIndex > 0 && currentStep !== "fetch" && currentStep !== "install" && (
              <Button variant="secondary" onClick={handleBack}>
                Back
              </Button>
            )}
            {(currentStep === "source" || currentStep === "preview") && (
              <Button
                variant="primary"
                onClick={handleNext}
                disabled={!canProceed || isLoading}
                loading={isLoading}
              >
                {currentStep === "preview" ? "Install" : "Continue"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
};

ImportWizard.displayName = "ImportWizard";

export default ImportWizard;
