/**
 * D050 - src/components/wizard/PluginWizard.tsx
 * ==============================================
 * Multi-step wizard for creating new plugins.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D015 (Modal.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { useState, useCallback, useMemo, useEffect, type ReactNode } from "react";

/**
 * Wizard step definition.
 */
export interface WizardStep {
  /** Unique step identifier */
  id: string;
  /** Step display title */
  title: string;
  /** Step description */
  description?: string;
  /** Whether step is optional */
  optional?: boolean;
  /** Icon component for step */
  icon?: ReactNode;
}

/**
 * Plugin manifest data collected through wizard.
 */
export interface PluginManifestData {
  /** Plugin name (e.g., tts_kokoro_plugin) */
  name: string;
  /** Display name */
  displayName: string;
  /** Version */
  version: string;
  /** Contract type */
  contract: string;
  /** Entry point module */
  entryPoint: string;
  /** Description */
  description: string;
  /** Author */
  author: string;
  /** License */
  license: string;
  /** Python requirements */
  dependencies: string[];
  /** Python version requirement */
  pythonRequires: string;
  /** GPU required */
  gpuRequired: boolean;
  /** GPU recommended */
  gpuRecommended: boolean;
  /** Minimum memory MB */
  minMemoryMb: number;
  /** Tags */
  tags: string[];
  /** Capabilities */
  capabilities: string[];
  /** Config schema */
  configSchema: Record<string, unknown>;
  /** Default config */
  defaultConfig: Record<string, unknown>;
}

/**
 * Default manifest data for new plugins.
 */
export const DEFAULT_MANIFEST_DATA: PluginManifestData = {
  name: "",
  displayName: "",
  version: "1.0.0",
  contract: "",
  entryPoint: "plugin",
  description: "",
  author: "",
  license: "MIT",
  dependencies: [],
  pythonRequires: ">=3.11",
  gpuRequired: false,
  gpuRecommended: false,
  minMemoryMb: 512,
  tags: [],
  capabilities: [],
  configSchema: {},
  defaultConfig: {},
};

/**
 * Wizard step identifiers.
 */
export type WizardStepId =
  | "contract"
  | "manifest"
  | "dependencies"
  | "preview";

/**
 * Default wizard steps.
 */
export const WIZARD_STEPS: WizardStep[] = [
  {
    id: "contract",
    title: "Select Contract",
    description: "Choose the contract type your plugin will implement",
  },
  {
    id: "manifest",
    title: "Plugin Details",
    description: "Configure plugin metadata and settings",
  },
  {
    id: "dependencies",
    title: "Dependencies",
    description: "Add Python package dependencies",
    optional: true,
  },
  {
    id: "preview",
    title: "Preview & Create",
    description: "Review generated code and create plugin",
  },
];

/**
 * PluginWizard component props.
 */
export interface PluginWizardProps {
  /** Initial manifest data */
  initialData?: Partial<PluginManifestData>;
  /** Custom wizard steps */
  steps?: WizardStep[];
  /** Callback when wizard completes */
  onComplete?: (data: PluginManifestData) => void;
  /** Callback when wizard is cancelled */
  onCancel?: () => void;
  /** Custom step content renderer */
  renderStep?: (stepId: string, data: PluginManifestData, onChange: (data: Partial<PluginManifestData>) => void) => ReactNode;
  /** Whether wizard is in loading state */
  isLoading?: boolean;
  /** Additional className */
  className?: string;
}

/**
 * Check icon component.
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
    aria-hidden="true"
  >
    <polyline points="20 6 9 17 4 12" />
  </svg>
);

/**
 * Arrow left icon.
 */
const ArrowLeftIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="19" y1="12" x2="5" y2="12" />
    <polyline points="12 19 5 12 12 5" />
  </svg>
);

/**
 * Arrow right icon.
 */
const ArrowRightIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <line x1="5" y1="12" x2="19" y2="12" />
    <polyline points="12 5 19 12 12 19" />
  </svg>
);

/**
 * Loader icon.
 */
const LoaderIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
  </svg>
);

/**
 * PluginWizard component.
 *
 * A multi-step wizard for creating new plugins. Guides users through
 * contract selection, manifest configuration, dependency setup, and
 * code preview.
 *
 * @example
 * ```tsx
 * <PluginWizard
 *   onComplete={(data) => createPlugin(data)}
 *   onCancel={() => setShowWizard(false)}
 * />
 * ```
 */
export const PluginWizard: React.FC<PluginWizardProps> = ({
  initialData,
  steps = WIZARD_STEPS,
  onComplete,
  onCancel,
  renderStep,
  isLoading = false,
  className = "",
}) => {
  const effectiveSteps = steps?.length ? steps : WIZARD_STEPS;
  const lastStepIndex = Math.max(effectiveSteps.length - 1, 0);

  // Current step index
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const clampedStepIndex = useMemo(
    () => Math.min(currentStepIndex, lastStepIndex),
    [currentStepIndex, lastStepIndex],
  );

  useEffect(() => {
    if (currentStepIndex !== clampedStepIndex) {
      setCurrentStepIndex(clampedStepIndex);
    }
  }, [clampedStepIndex, currentStepIndex]);

  // Manifest data being edited
  const [manifestData, setManifestData] = useState<PluginManifestData>({
    ...DEFAULT_MANIFEST_DATA,
    ...initialData,
  });

  // Validation errors per step
  const [stepErrors, setStepErrors] = useState<Record<string, string[]>>({});

  // Current step
  const currentStep = effectiveSteps[clampedStepIndex];
  const currentStepId = currentStep?.id;
  const isFirstStep = clampedStepIndex === 0;
  const isLastStep = clampedStepIndex === lastStepIndex;

  if (!currentStep || typeof currentStepId !== "string" || currentStepId.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-6 text-sm text-neutral-600 border border-neutral-200 rounded-lg bg-neutral-50">
        No steps are configured for the plugin wizard.
      </div>
    );
  }

  // Update manifest data
  const handleDataChange = useCallback((updates: Partial<PluginManifestData>) => {
    setManifestData((prev) => ({ ...prev, ...updates }));
  }, []);

  // Validate current step
  const validateStep = useCallback((stepId: string): string[] => {
    const errors: string[] = [];

    switch (stepId) {
      case "contract":
        if (!manifestData.contract) {
          errors.push("Please select a contract type");
        }
        break;

      case "manifest":
        if (!manifestData.name) {
          errors.push("Plugin name is required");
        } else if (!/^[a-z][a-z0-9_]*_plugin$/.test(manifestData.name)) {
          errors.push("Name must be lowercase with underscores, ending in _plugin");
        }
        if (!manifestData.displayName) {
          errors.push("Display name is required");
        }
        if (!manifestData.version || !/^\d+\.\d+\.\d+/.test(manifestData.version)) {
          errors.push("Valid semantic version required (e.g., 1.0.0)");
        }
        break;

      case "dependencies":
        // Dependencies step is optional
        break;

      case "preview":
        // Final validation
        if (!manifestData.contract || !manifestData.name) {
          errors.push("Please complete all required fields");
        }
        break;
    }

    return errors;
  }, [manifestData]);

  // Go to next step
  const handleNext = useCallback(() => {
    if (typeof currentStepId !== "string" || currentStepId.length === 0) {
      return;
    }

    const errors = validateStep(currentStepId);

    if (errors.length > 0) {
      setStepErrors((prev) => ({ ...prev, [currentStepId]: errors }));
      return;
    }

    // Clear errors for this step
    setStepErrors((prev) => ({ ...prev, [currentStepId]: [] }));

    if (isLastStep) {
      onComplete?.(manifestData);
    } else {
      setCurrentStepIndex((prev) => Math.min(prev + 1, lastStepIndex));
    }
  }, [currentStepId, isLastStep, lastStepIndex, manifestData, onComplete, validateStep]);

  // Go to previous step
  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => Math.max(prev - 1, 0));
    }
  }, [isFirstStep]);

  // Jump to specific step
  const handleStepClick = useCallback((index: number) => {
    // Only allow going to completed steps or next step
    if (index < 0 || index > lastStepIndex) {
      return;
    }

    if (index <= clampedStepIndex) {
      setCurrentStepIndex(index);
    }
  }, [clampedStepIndex, lastStepIndex]);

  // Step completion status
  const stepCompletion = useMemo(() => {
    return effectiveSteps.map((step, index) => {
      if (index < clampedStepIndex) {
        return "completed";
      }
      if (index === clampedStepIndex) {
        return "current";
      }
      return "pending";
    });
  }, [clampedStepIndex, effectiveSteps]);

  // Container styles
  const containerStyles = [
    "flex",
    "flex-col",
    "bg-white",
    "rounded-lg",
    "border",
    "border-neutral-200",
    "shadow-lg",
    "overflow-hidden",
    className,
  ].filter(Boolean).join(" ");

  // Step indicator styles
  const getStepIndicatorStyles = (status: string) => [
    "flex",
    "items-center",
    "justify-center",
    "w-8",
    "h-8",
    "rounded-full",
    "text-sm",
    "font-semibold",
    "shrink-0",
    "transition-colors",
    "duration-200",
    status === "completed" && "bg-success-500 text-white",
    status === "current" && "bg-primary-500 text-white",
    status === "pending" && "bg-neutral-200 text-neutral-500",
  ].filter(Boolean).join(" ");

  // Step text styles
  const getStepTextStyles = (status: string) => [
    "text-sm",
    "font-medium",
    "transition-colors",
    "duration-200",
    status === "completed" && "text-success-700",
    status === "current" && "text-primary-700",
    status === "pending" && "text-neutral-500",
  ].filter(Boolean).join(" ");

  // Step connector styles
  const getConnectorStyles = (status: string) => [
    "flex-1",
    "h-0.5",
    "mx-2",
    "transition-colors",
    "duration-200",
    status === "completed" ? "bg-success-500" : "bg-neutral-200",
  ].filter(Boolean).join(" ");

  return (
    <div className={containerStyles}>
      {/* Step indicators */}
      <div className="flex items-center p-6 border-b border-neutral-200 bg-neutral-50">
        {effectiveSteps.map((step, index) => (
          <React.Fragment key={step.id}>
            {/* Step indicator */}
            <button
              type="button"
              onClick={() => handleStepClick(index)}
              disabled={stepCompletion[index] === "pending"}
              className={[
                "flex",
                "items-center",
                "gap-2",
                "cursor-pointer",
                stepCompletion[index] === "pending" && "cursor-not-allowed opacity-60",
              ].filter(Boolean).join(" ")}
            >
              <div className={getStepIndicatorStyles(stepCompletion[index])}>
                {stepCompletion[index] === "completed" ? (
                  <CheckIcon className="h-4 w-4" />
                ) : (
                  index + 1
                )}
              </div>
              <span className={getStepTextStyles(stepCompletion[index])}>
                {step.title}
                {step.optional && (
                  <span className="ml-1 text-xs text-neutral-400">(optional)</span>
                )}
              </span>
            </button>

            {/* Connector */}
            {index < effectiveSteps.length - 1 && (
              <div className={getConnectorStyles(stepCompletion[index])} />
            )}
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="flex-1 p-6 min-h-96">
        {/* Step header */}
        <div className="mb-6">
          <h2 className="text-xl font-semibold text-neutral-900">
            {currentStep.title}
          </h2>
          {currentStep.description && (
            <p className="mt-1 text-sm text-neutral-600">
              {currentStep.description}
            </p>
          )}
        </div>

        {/* Validation errors */}
        {stepErrors[currentStepId]?.length > 0 && (
          <div className="mb-4 p-3 bg-error-50 border border-error-200 rounded-lg">
            <ul className="list-disc list-inside text-sm text-error-700">
              {stepErrors[currentStepId].map((error, index) => (
                <li key={index}>{error}</li>
              ))}
            </ul>
          </div>
        )}

        {/* Custom content or default placeholder */}
        {renderStep ? (
          renderStep(currentStepId, manifestData, handleDataChange)
        ) : (
          <DefaultStepContent
            stepId={currentStepId}
            data={manifestData}
            onChange={handleDataChange}
          />
        )}
      </div>

      {/* Footer with navigation */}
      <div className="flex items-center justify-between p-4 border-t border-neutral-200 bg-neutral-50">
        <div>
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className={[
                "px-4",
                "py-2",
                "text-sm",
                "font-medium",
                "text-neutral-700",
                "hover:text-neutral-900",
                "transition-colors",
                "duration-150",
              ].join(" ")}
            >
              Cancel
            </button>
          )}
        </div>

        <div className="flex items-center gap-3">
          {/* Previous button */}
          {!isFirstStep && (
            <button
              type="button"
              onClick={handlePrevious}
              className={[
                "inline-flex",
                "items-center",
                "gap-2",
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
                "transition-colors",
                "duration-150",
              ].join(" ")}
            >
              <ArrowLeftIcon className="h-4 w-4" />
              Previous
            </button>
          )}

          {/* Next/Complete button */}
          <button
            type="button"
            onClick={handleNext}
            disabled={isLoading}
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
              "disabled:opacity-60",
              "disabled:cursor-not-allowed",
              "transition-colors",
              "duration-150",
            ].join(" ")}
          >
            {isLoading ? (
              <>
                <LoaderIcon className="h-4 w-4 animate-spin" />
                Creating...
              </>
            ) : isLastStep ? (
              <>
                Create Plugin
                <CheckIcon className="h-4 w-4" />
              </>
            ) : (
              <>
                Next
                <ArrowRightIcon className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

PluginWizard.displayName = "PluginWizard";

/**
 * Default step content placeholder.
 */
interface DefaultStepContentProps {
  stepId: string;
  data: PluginManifestData;
  onChange: (data: Partial<PluginManifestData>) => void;
}

const DefaultStepContent: React.FC<DefaultStepContentProps> = ({
  stepId,
  data,
  onChange,
}) => {
  // Placeholder content - real components will be provided via renderStep
  return (
    <div className="flex items-center justify-center h-64 bg-neutral-50 rounded-lg border-2 border-dashed border-neutral-200">
      <div className="text-center">
        <p className="text-neutral-500">
          Step content for <span className="font-medium">{stepId}</span>
        </p>
        <p className="mt-1 text-sm text-neutral-400">
          Use renderStep prop to provide custom content
        </p>
      </div>
    </div>
  );
};

/**
 * Hook for wizard state management.
 */
export interface UsePluginWizardOptions {
  initialData?: Partial<PluginManifestData>;
  onComplete?: (data: PluginManifestData) => void;
}

export interface UsePluginWizardReturn {
  data: PluginManifestData;
  setData: React.Dispatch<React.SetStateAction<PluginManifestData>>;
  updateData: (updates: Partial<PluginManifestData>) => void;
  reset: () => void;
}

export function usePluginWizard(options: UsePluginWizardOptions = {}): UsePluginWizardReturn {
  const [data, setData] = useState<PluginManifestData>({
    ...DEFAULT_MANIFEST_DATA,
    ...options.initialData,
  });

  const updateData = useCallback((updates: Partial<PluginManifestData>) => {
    setData((prev) => ({ ...prev, ...updates }));
  }, []);

  const reset = useCallback(() => {
    setData({ ...DEFAULT_MANIFEST_DATA, ...options.initialData });
  }, [options.initialData]);

  return {
    data,
    setData,
    updateData,
    reset,
  };
}

export default PluginWizard;
