/**
 * D071 - src/components/ai/ConversationFlow.tsx
 * ==============================================
 * AI-powered conversation wizard for guided interactions.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D010, D011, D012, D014, D015
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 */

import React, { useState, useCallback, useMemo } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select, type SelectOption } from "../ui/Select";
import { Panel } from "../ui/Panel";

/**
 * Conversation step types.
 */
export type StepType = "text" | "select" | "multiselect" | "confirm" | "info";

/**
 * Single step in the conversation flow.
 */
export interface ConversationStep {
  /** Unique step identifier */
  id: string;
  /** Step type determines input method */
  type: StepType;
  /** Question or prompt to display */
  prompt: string;
  /** Helper text for additional context */
  helperText?: string;
  /** Options for select/multiselect types */
  options?: SelectOption[];
  /** Placeholder text for text inputs */
  placeholder?: string;
  /** Validation function returning error message or null */
  validate?: (value: unknown) => string | null;
  /** Whether this step is required */
  required?: boolean;
  /** Conditional function to determine if step should be shown */
  condition?: (answers: Record<string, unknown>) => boolean;
  /** Default value for the step */
  defaultValue?: unknown;
}

/**
 * Conversation flow configuration.
 */
export interface ConversationFlowConfig {
  /** Flow title */
  title: string;
  /** Flow description */
  description?: string;
  /** Array of conversation steps */
  steps: ConversationStep[];
  /** Callback when flow completes */
  onComplete: (answers: Record<string, unknown>) => void;
  /** Callback when flow is cancelled */
  onCancel?: () => void;
}

/**
 * Conversation flow props.
 */
export interface ConversationFlowProps extends ConversationFlowConfig {
  /** Custom className */
  className?: string;
  /** Whether the flow is processing/loading */
  isLoading?: boolean;
  /** Initial answers (for resuming flows) */
  initialAnswers?: Record<string, unknown>;
}

/**
 * Arrow right icon.
 */
const ArrowRightIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
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
 * Arrow left icon.
 */
const ArrowLeftIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
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
 * Check icon.
 */
const CheckIcon: React.FC = () => (
  <svg
    className="h-4 w-4"
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
 * Info icon.
 */
const InfoIcon: React.FC = () => (
  <svg
    className="h-5 w-5"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

/**
 * Progress indicator component.
 */
const ProgressIndicator: React.FC<{
  currentStep: number;
  totalSteps: number;
}> = ({ currentStep, totalSteps }) => {
  const progress = ((currentStep + 1) / totalSteps) * 100;

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="text-neutral-600">
          Step {currentStep + 1} of {totalSteps}
        </span>
        <span className="text-neutral-500">{Math.round(progress)}%</span>
      </div>
      <div className="h-2 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-primary-500 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
};

/**
 * Step renderer component.
 */
const StepRenderer: React.FC<{
  step: ConversationStep;
  value: unknown;
  onChange: (value: unknown) => void;
  error?: string | null;
}> = ({ step, value, onChange, error }) => {
  const renderInput = () => {
    switch (step.type) {
      case "text":
        return (
          <Input
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            {...(step.placeholder ? { placeholder: step.placeholder } : {})}
            error={!!error}
            {...(error !== undefined && error !== null ? { errorMessage: error } : {})}
            {...(step.helperText ? { helperText: step.helperText } : {})}
            fullWidth
          />
        );

      case "select":
        return (
          <Select
            options={step.options || []}
            value={(value as string) || ""}
            onChange={(e) => onChange(e.target.value)}
            placeholder="Select an option"
            error={!!error}
            {...(error !== undefined && error !== null ? { errorMessage: error } : {})}
            {...(step.helperText ? { helperText: step.helperText } : {})}
            fullWidth
          />
        );

      case "multiselect":
        const selectedValues = (value as string[]) || [];
        return (
          <div className="space-y-2">
            {step.options?.map((option) => (
              <label
                key={option.value}
                className={[
                  "flex",
                  "items-center",
                  "gap-3",
                  "p-3",
                  "rounded-lg",
                  "border",
                  "cursor-pointer",
                  "transition-colors",
                  "duration-150",
                  selectedValues.includes(option.value)
                    ? "border-primary-500 bg-primary-50"
                    : "border-neutral-200 hover:border-neutral-300",
                ].join(" ")}
              >
                <input
                  type="checkbox"
                  checked={selectedValues.includes(option.value)}
                  onChange={(e) => {
                    if (e.target.checked) {
                      onChange([...selectedValues, option.value]);
                    } else {
                      onChange(selectedValues.filter((v) => v !== option.value));
                    }
                  }}
                  className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm text-neutral-900">{option.label}</span>
              </label>
            ))}
            {step.helperText && (
              <p className="text-sm text-neutral-500 mt-2">{step.helperText}</p>
            )}
            {error && (
              <p className="text-sm text-error-600 mt-1">{error}</p>
            )}
          </div>
        );

      case "confirm":
        return (
          <div className="space-y-4">
            {step.helperText && (
              <p className="text-sm text-neutral-600">{step.helperText}</p>
            )}
            <div className="flex items-center gap-4">
              <Button
                variant={value === true ? "primary" : "secondary"}
                onClick={() => onChange(true)}
                size="md"
              >
                Yes
              </Button>
              <Button
                variant={value === false ? "primary" : "secondary"}
                onClick={() => onChange(false)}
                size="md"
              >
                No
              </Button>
            </div>
            {error && (
              <p className="text-sm text-error-600">{error}</p>
            )}
          </div>
        );

      case "info":
        return (
          <div className="flex items-start gap-3 p-4 bg-info-50 border border-info-200 rounded-lg">
            <span className="text-info-600 shrink-0">
              <InfoIcon />
            </span>
            <p className="text-sm text-info-800">{step.helperText}</p>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h3 className="text-lg font-semibold text-neutral-900">{step.prompt}</h3>
        {step.required && step.type !== "info" && (
          <span className="text-xs text-neutral-500 mt-1">Required</span>
        )}
      </div>
      {renderInput()}
    </div>
  );
};

/**
 * ConversationFlow component.
 *
 * A guided conversation wizard that walks users through a series of steps
 * to gather information. Supports text input, selection, multi-select,
 * confirmation, and informational steps.
 *
 * @example
 * ```tsx
 * const steps: ConversationStep[] = [
 *   {
 *     id: "name",
 *     type: "text",
 *     prompt: "What would you like to name your project?",
 *     placeholder: "My Awesome Project",
 *     required: true,
 *   },
 *   {
 *     id: "type",
 *     type: "select",
 *     prompt: "What type of project is this?",
 *     options: [
 *       { value: "web", label: "Web Application" },
 *       { value: "mobile", label: "Mobile App" },
 *     ],
 *     required: true,
 *   },
 * ];
 *
 * <ConversationFlow
 *   title="Create New Project"
 *   steps={steps}
 *   onComplete={(answers) => console.log(answers)}
 * />
 * ```
 */
export const ConversationFlow: React.FC<ConversationFlowProps> = ({
  title,
  description,
  steps,
  onComplete,
  onCancel,
  className = "",
  isLoading = false,
  initialAnswers = {},
}) => {
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, unknown>>(initialAnswers);
  const [errors, setErrors] = useState<Record<string, string | null>>({});

  // Filter steps based on conditions
  const visibleSteps = useMemo(() => {
    return steps.filter((step) => {
      if (step.condition) {
        return step.condition(answers);
      }
      return true;
    });
  }, [steps, answers]);

  const currentStep = visibleSteps[currentStepIndex];
  const isFirstStep = currentStepIndex === 0;
  const isLastStep = currentStepIndex === visibleSteps.length - 1;

  const validateCurrentStep = useCallback((): boolean => {
    if (!currentStep) return true;

    const value = answers[currentStep.id];

    // Required validation
    if (currentStep.required && currentStep.type !== "info") {
      const isEmpty =
        value === undefined ||
        value === null ||
        value === "" ||
        (Array.isArray(value) && value.length === 0);

      if (isEmpty) {
        setErrors((prev) => ({
          ...prev,
          [currentStep.id]: "This field is required",
        }));
        return false;
      }
    }

    // Custom validation
    if (currentStep.validate) {
      const error = currentStep.validate(value);
      if (error) {
        setErrors((prev) => ({
          ...prev,
          [currentStep.id]: error,
        }));
        return false;
      }
    }

    setErrors((prev) => ({
      ...prev,
      [currentStep.id]: null,
    }));
    return true;
  }, [currentStep, answers]);

  const handleNext = useCallback(() => {
    if (!validateCurrentStep()) return;

    if (isLastStep) {
      onComplete(answers);
    } else {
      setCurrentStepIndex((prev) => prev + 1);
    }
  }, [validateCurrentStep, isLastStep, onComplete, answers]);

  const handlePrevious = useCallback(() => {
    if (!isFirstStep) {
      setCurrentStepIndex((prev) => prev - 1);
    }
  }, [isFirstStep]);

  const handleValueChange = useCallback(
    (value: unknown) => {
      if (!currentStep) return;
      setAnswers((prev) => ({
        ...prev,
        [currentStep.id]: value,
      }));
      // Clear error when value changes
      setErrors((prev) => ({
        ...prev,
        [currentStep.id]: null,
      }));
    },
    [currentStep]
  );

  const containerStyles = [
    "w-full",
    "max-w-2xl",
    "mx-auto",
    className,
  ].filter(Boolean).join(" ");

  if (!currentStep) {
    return null;
  }

  return (
    <div className={containerStyles}>
      <Panel
        variant="elevated"
        padding="lg"
        radius="lg"
      >
        {/* Header */}
        <div className="mb-6">
          <h2 className="text-xl font-bold text-neutral-900">{title}</h2>
          {description && (
            <p className="text-sm text-neutral-600 mt-1">{description}</p>
          )}
        </div>

        {/* Progress */}
        <div className="mb-8">
          <ProgressIndicator
            currentStep={currentStepIndex}
            totalSteps={visibleSteps.length}
          />
        </div>

        {/* Current step */}
        <div className="mb-8">
          <StepRenderer
            step={currentStep}
            value={answers[currentStep.id] ?? currentStep.defaultValue}
            onChange={handleValueChange}
            {...(errors[currentStep.id] !== undefined ? { error: errors[currentStep.id] } : {})}
          />
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-6 border-t border-neutral-200">
          <div>
            {onCancel && (
              <Button
                variant="ghost"
                size="md"
                onClick={onCancel}
                disabled={isLoading}
              >
                Cancel
              </Button>
            )}
          </div>

          <div className="flex items-center gap-3">
            {!isFirstStep && (
              <Button
                variant="secondary"
                size="md"
                onClick={handlePrevious}
                disabled={isLoading}
                leftIcon={<ArrowLeftIcon />}
              >
                Back
              </Button>
            )}
            <Button
              variant="primary"
              size="md"
              onClick={handleNext}
              loading={isLoading}
              rightIcon={isLastStep ? <CheckIcon /> : <ArrowRightIcon />}
            >
              {isLastStep ? "Complete" : "Next"}
            </Button>
          </div>
        </div>
      </Panel>

      {/* Step indicators */}
      <div className="flex items-center justify-center gap-2 mt-6">
        {visibleSteps.map((step, index) => (
          <button
            key={step.id}
            onClick={() => {
              if (index < currentStepIndex) {
                setCurrentStepIndex(index);
              }
            }}
            disabled={index > currentStepIndex}
            className={[
              "w-3",
              "h-3",
              "rounded-full",
              "transition-colors",
              "duration-150",
              index === currentStepIndex
                ? "bg-primary-500"
                : index < currentStepIndex
                ? "bg-primary-300 hover:bg-primary-400 cursor-pointer"
                : "bg-neutral-200 cursor-not-allowed",
            ].join(" ")}
            aria-label={`Step ${index + 1}: ${step.prompt}`}
          />
        ))}
      </div>
    </div>
  );
};

ConversationFlow.displayName = "ConversationFlow";

export default ConversationFlow;
