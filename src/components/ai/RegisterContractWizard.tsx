/**
 * D093 - src/components/ai/RegisterContractWizard.tsx
 * ====================================================
 * Wizard for registering new contract types (plugin categories).
 *
 * This component allows users to create NEW plugin categories by defining:
 * - A unique prefix (e.g., "debug_", "mcp_")
 * - Required contract methods
 * - Smoke test configuration
 *
 * Unlike ContractWizard (D072) which creates contracts FROM existing categories,
 * this wizard creates NEW categories that are added to config/contract_prefixes.yaml.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D010, D011, D012, D014, D015, D072, D078
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
import { type ContractMethod, type ContractParameter } from "./ContractWizard";

/**
 * Smoke test configuration for the contract.
 */
export interface SmokeTestConfig {
  /** Method to call for smoke test */
  method: string;
  /** Parameters to pass */
  params: Record<string, unknown>;
  /** Expected result pattern or type */
  expected: string;
}

/**
 * New contract type definition.
 */
export interface NewContractType {
  /** Prefix for plugins of this type (e.g., "debug") */
  prefix: string;
  /** Full contract name (e.g., "DebugContract") */
  contractName: string;
  /** Description of this contract type */
  description: string;
  /** Required methods for this contract */
  requiredMethods: ContractMethod[];
  /** Optional smoke test configuration */
  smokeTest?: SmokeTestConfig;
  /** Example plugins for this category */
  examples?: string[];
}

/**
 * Generated YAML preview for the new contract type.
 */
export interface ContractYamlPreview {
  /** YAML content for contract_prefixes.yaml */
  prefixYaml: string;
  /** Python contract class code */
  contractCode: string;
}

/**
 * Props for RegisterContractWizard component.
 */
export interface RegisterContractWizardProps {
  /** Callback when a new contract type is registered */
  onRegister: (contractType: NewContractType) => Promise<void>;
  /** Existing prefixes to prevent duplicates */
  existingPrefixes?: string[];
  /** Callback when wizard is closed */
  onClose?: () => void;
  /** Whether registration is in progress */
  isRegistering?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Wizard steps.
 */
type WizardStep = "prefix" | "methods" | "smokeTest" | "preview";

/**
 * Available Python types for method parameters.
 */
const pythonTypes: SelectOption[] = [
  { value: "str", label: "str (String)" },
  { value: "int", label: "int (Integer)" },
  { value: "float", label: "float (Decimal)" },
  { value: "bool", label: "bool (Boolean)" },
  { value: "bytes", label: "bytes (Binary)" },
  { value: "list[str]", label: "list[str] (String List)" },
  { value: "list[int]", label: "list[int] (Integer List)" },
  { value: "dict[str, Any]", label: "dict[str, Any] (Dictionary)" },
  { value: "Optional[str]", label: "Optional[str]" },
  { value: "Any", label: "Any" },
];

/**
 * Plus icon.
 */
const PlusIcon: React.FC = () => (
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
    <line x1="12" y1="5" x2="12" y2="19" />
    <line x1="5" y1="12" x2="19" y2="12" />
  </svg>
);

/**
 * Trash icon.
 */
const TrashIcon: React.FC = () => (
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
    <polyline points="3 6 5 6 21 6" />
    <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
  </svg>
);

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
 * Step indicator component.
 */
const StepIndicator: React.FC<{
  steps: { key: WizardStep; label: string }[];
  currentStep: WizardStep;
}> = ({ steps, currentStep }) => {
  const currentIndex = steps.findIndex((s) => s.key === currentStep);

  return (
    <div className="flex items-center justify-center gap-2 mb-6">
      {steps.map((step, index) => {
        const isComplete = index < currentIndex;
        const isCurrent = index === currentIndex;

        return (
          <React.Fragment key={step.key}>
            <div className="flex items-center gap-2">
              <div
                className={[
                  "w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium transition-colors",
                  isComplete && "bg-success-500 text-white",
                  isCurrent && "bg-primary-500 text-white",
                  !isComplete && !isCurrent && "bg-neutral-200 text-neutral-500",
                ].filter(Boolean).join(" ")}
              >
                {isComplete ? <CheckIcon /> : index + 1}
              </div>
              <span
                className={[
                  "text-sm hidden sm:inline",
                  isCurrent && "font-medium text-neutral-900",
                  !isCurrent && "text-neutral-500",
                ].filter(Boolean).join(" ")}
              >
                {step.label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <div
                className={[
                  "w-8 h-0.5",
                  isComplete ? "bg-success-500" : "bg-neutral-200",
                ].join(" ")}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};

/**
 * Method editor for defining contract methods.
 */
const MethodEditor: React.FC<{
  method: ContractMethod;
  onChange: (method: ContractMethod) => void;
  onRemove: () => void;
}> = ({ method, onChange, onRemove }) => {
  const addParameter = () => {
    onChange({
      ...method,
      parameters: [
        ...method.parameters,
        {
          name: "",
          type: "str",
          description: "",
          required: true,
        },
      ],
    });
  };

  const updateParameter = (index: number, param: ContractParameter) => {
    const newParams = [...method.parameters];
    newParams[index] = param;
    onChange({ ...method, parameters: newParams });
  };

  const removeParameter = (index: number) => {
    onChange({
      ...method,
      parameters: method.parameters.filter((_, i) => i !== index),
    });
  };

  return (
    <div className="border border-neutral-200 rounded-lg p-4 space-y-4">
      <div className="flex items-start justify-between">
        <h4 className="text-sm font-semibold text-neutral-900">Method</h4>
        <Button
          variant="ghost"
          size="xs"
          onClick={onRemove}
          leftIcon={<TrashIcon />}
          className="text-error-600 hover:text-error-700"
        >
          Remove
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Method Name"
          value={method.name}
          onChange={(e) => onChange({ ...method, name: e.target.value })}
          placeholder="process"
          fullWidth
        />
        <Select
          label="Return Type"
          options={pythonTypes}
          value={method.returnType}
          onChange={(e) => onChange({ ...method, returnType: e.target.value })}
          fullWidth
        />
      </div>

      <Input
        label="Description"
        value={method.description}
        onChange={(e) => onChange({ ...method, description: e.target.value })}
        placeholder="Describe what this method does"
        fullWidth
      />

      <div className="flex items-center gap-4">
        <label className="flex items-center gap-2 text-sm text-neutral-700 cursor-pointer">
          <input
            type="checkbox"
            checked={method.isAsync}
            onChange={(e) => onChange({ ...method, isAsync: e.target.checked })}
            className="w-4 h-4 text-primary-600 border-neutral-300 rounded focus:ring-primary-500"
          />
          Async method
        </label>
      </div>

      {/* Parameters */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h5 className="text-xs font-medium text-neutral-600 uppercase tracking-wide">
            Parameters
          </h5>
          <Button
            variant="ghost"
            size="xs"
            onClick={addParameter}
            leftIcon={<PlusIcon />}
          >
            Add Parameter
          </Button>
        </div>

        {method.parameters.length === 0 ? (
          <p className="text-sm text-neutral-400 italic">No parameters defined</p>
        ) : (
          <div className="space-y-2">
            {method.parameters.map((param, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 items-end bg-neutral-50 p-2 rounded-lg"
              >
                <div className="col-span-3">
                  <Input
                    {...(index === 0 ? { label: "Name" } : {})}
                    value={param.name}
                    onChange={(e) =>
                      updateParameter(index, { ...param, name: e.target.value })
                    }
                    placeholder="arg"
                    size="sm"
                    fullWidth
                  />
                </div>
                <div className="col-span-3">
                  <Select
                    {...(index === 0 ? { label: "Type" } : {})}
                    options={pythonTypes}
                    value={param.type}
                    onChange={(e) =>
                      updateParameter(index, { ...param, type: e.target.value })
                    }
                    size="sm"
                    fullWidth
                  />
                </div>
                <div className="col-span-4">
                  <Input
                    {...(index === 0 ? { label: "Description" } : {})}
                    value={param.description}
                    onChange={(e) =>
                      updateParameter(index, { ...param, description: e.target.value })
                    }
                    placeholder="Description"
                    size="sm"
                    fullWidth
                  />
                </div>
                <div className="col-span-1 flex items-center justify-center">
                  <label className="flex items-center gap-1 text-xs text-neutral-600 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={param.required}
                      onChange={(e) =>
                        updateParameter(index, { ...param, required: e.target.checked })
                      }
                      className="w-3 h-3 text-primary-600 border-neutral-300 rounded"
                    />
                    Req
                  </label>
                </div>
                <div className="col-span-1">
                  <Button
                    variant="ghost"
                    size="xs"
                    iconOnly
                    onClick={() => removeParameter(index)}
                    aria-label="Remove parameter"
                    className="text-error-500 hover:text-error-600"
                  >
                    <TrashIcon />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * Code preview component.
 */
const CodePreview: React.FC<{
  code: string;
  title: string;
  language?: string;
}> = ({ code, title }) => (
  <div className="bg-neutral-900 rounded-lg overflow-hidden">
    <div className="px-4 py-2 bg-neutral-800 border-b border-neutral-700 flex items-center justify-between">
      <span className="text-xs text-neutral-400 uppercase tracking-wide">{title}</span>
      <Button
        variant="ghost"
        size="xs"
        onClick={() => navigator.clipboard.writeText(code)}
        className="text-neutral-400 hover:text-neutral-200"
      >
        Copy
      </Button>
    </div>
    <pre className="p-4 overflow-x-auto text-sm font-mono text-neutral-100 whitespace-pre max-h-64">
      <code>{code}</code>
    </pre>
  </div>
);

/**
 * RegisterContractWizard component.
 *
 * A multi-step wizard for registering new contract types (plugin categories).
 * This creates new entries in config/contract_prefixes.yaml and generates
 * the corresponding Python contract class.
 *
 * @example
 * ```tsx
 * <RegisterContractWizard
 *   onRegister={async (contractType) => {
 *     await ipc.call('contract/register', contractType);
 *   }}
 *   existingPrefixes={['tts', 'stt', 'llm']}
 *   onClose={() => setShowWizard(false)}
 * />
 * ```
 */
export const RegisterContractWizard: React.FC<RegisterContractWizardProps> = ({
  onRegister,
  existingPrefixes = [],
  onClose,
  isRegistering = false,
  className = "",
}) => {
  // Wizard state
  const [currentStep, setCurrentStep] = useState<WizardStep>("prefix");
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [prefix, setPrefix] = useState("");
  const [contractName, setContractName] = useState("");
  const [description, setDescription] = useState("");
  const [methods, setMethods] = useState<ContractMethod[]>([
    {
      name: "",
      description: "",
      parameters: [],
      returnType: "str",
      isAsync: false,
    },
  ]);
  const [smokeTest, setSmokeTest] = useState<SmokeTestConfig>({
    method: "",
    params: {},
    expected: "",
  });
  const [smokeTestParamsJson, setSmokeTestParamsJson] = useState("{}");

  // Wizard steps configuration
  const steps: { key: WizardStep; label: string }[] = [
    { key: "prefix", label: "Prefix & Name" },
    { key: "methods", label: "Methods" },
    { key: "smokeTest", label: "Smoke Test" },
    { key: "preview", label: "Preview" },
  ];

  // Derived contract name from prefix
  const derivedContractName = useMemo(() => {
    if (contractName) return contractName;
    if (!prefix) return "";
    // Convert prefix to PascalCase + "Contract"
    return prefix.charAt(0).toUpperCase() + prefix.slice(1) + "Contract";
  }, [prefix, contractName]);

  // Generate YAML preview
  const yamlPreview = useMemo(() => {
    const validMethods = methods.filter((m) => m.name.trim());
    const smokeMethod = smokeTest.method || (validMethods[0]?.name || "health_check");

    return `  ${prefix}:
    contract: ${prefix}_contract
    description: "${description || `${derivedContractName} plugins`}"
    examples:
      - ${prefix}_example_plugin
    smoke_test:
      method: ${smokeMethod}
      params: ${JSON.stringify(smokeTest.params)}
      expected: "${smokeTest.expected || 'not null'}"`;
  }, [prefix, description, derivedContractName, methods, smokeTest]);

  // Generate Python contract code
  const pythonCode = useMemo(() => {
    const validMethods = methods.filter((m) => m.name.trim());
    const methodDefs = validMethods.map((m) => {
      const params = m.parameters
        .map((p) => `${p.name}: ${p.type}${p.required ? "" : " = None"}`)
        .join(", ");
      const asyncPrefix = m.isAsync ? "async " : "";
      return `    @abstractmethod
    ${asyncPrefix}def ${m.name}(self${params ? ", " + params : ""}) -> ${m.returnType}:
        """${m.description || m.name}"""
        pass`;
    }).join("\n\n");

    return `"""
contracts/${prefix}_contract.py
==============================
${description || `Contract for ${prefix} plugins.`}

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout
"""

from abc import abstractmethod
from typing import Any, Optional
from contracts.base import PluginBase


class ${derivedContractName}(PluginBase):
    """
    ${description || `Contract interface for ${prefix} plugins.`}

    All ${prefix}_ prefixed plugins must implement this contract.
    """

${methodDefs}
`;
  }, [prefix, derivedContractName, description, methods]);

  // Validation
  const validatePrefix = useCallback(() => {
    if (!prefix.trim()) {
      setError("Prefix is required");
      return false;
    }
    if (!/^[a-z][a-z0-9_]*$/.test(prefix)) {
      setError("Prefix must start with a letter and contain only lowercase letters, numbers, and underscores");
      return false;
    }
    if (existingPrefixes.includes(prefix)) {
      setError(`Prefix "${prefix}" already exists`);
      return false;
    }
    setError(null);
    return true;
  }, [prefix, existingPrefixes]);

  const validateMethods = useCallback(() => {
    const validMethods = methods.filter((m) => m.name.trim());
    if (validMethods.length === 0) {
      setError("At least one method is required");
      return false;
    }
    for (const method of validMethods) {
      if (!/^[a-z_][a-z0-9_]*$/.test(method.name)) {
        setError(`Invalid method name: ${method.name}`);
        return false;
      }
    }
    setError(null);
    return true;
  }, [methods]);

  // Navigation
  const goNext = useCallback(() => {
    const stepIndex = steps.findIndex((s) => s.key === currentStep);
    if (stepIndex === -1) return;
    if (currentStep === "prefix" && !validatePrefix()) return;
    if (currentStep === "methods" && !validateMethods()) return;

    if (currentStep === "smokeTest") {
      // Parse smoke test params
      try {
        const params = JSON.parse(smokeTestParamsJson);
        setSmokeTest((prev) => ({ ...prev, params }));
      } catch {
        setError("Invalid JSON for smoke test parameters");
        return;
      }
    }

    if (stepIndex < steps.length - 1) {
      const nextStep = steps[stepIndex + 1];
      if (!nextStep) return;
      setCurrentStep(nextStep.key);
      setError(null);
    }
  }, [currentStep, steps, validatePrefix, validateMethods, smokeTestParamsJson]);

  const goBack = useCallback(() => {
    const stepIndex = steps.findIndex((s) => s.key === currentStep);
    if (stepIndex === -1) return;
    if (stepIndex > 0) {
      const prevStep = steps[stepIndex - 1];
      if (!prevStep) return;
      setCurrentStep(prevStep.key);
      setError(null);
    }
  }, [currentStep, steps]);

  // Method management
  const addMethod = useCallback(() => {
    setMethods((prev) => [
      ...prev,
      {
        name: "",
        description: "",
        parameters: [],
        returnType: "str",
        isAsync: false,
      },
    ]);
  }, []);

  const updateMethod = useCallback((index: number, method: ContractMethod) => {
    setMethods((prev) => {
      const newMethods = [...prev];
      newMethods[index] = method;
      return newMethods;
    });
  }, []);

  const removeMethod = useCallback((index: number) => {
    setMethods((prev) => prev.filter((_, i) => i !== index));
  }, []);

  // Submit
  const handleRegister = useCallback(async () => {
    const validMethods = methods.filter((m) => m.name.trim());

    const contractType: NewContractType = {
      prefix,
      contractName: derivedContractName,
      description,
      requiredMethods: validMethods,
      ...(smokeTest.method ? { smokeTest } : {}),
    };

    try {
      await onRegister(contractType);
      onClose?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed");
    }
  }, [prefix, derivedContractName, description, methods, smokeTest, onRegister, onClose]);

  const containerStyles = ["space-y-6", className].filter(Boolean).join(" ");

  return (
    <div className={containerStyles}>
      <Panel
        variant="default"
        padding="lg"
        radius="lg"
        header="Register New Contract Type"
        showHeaderDivider
      >
        <StepIndicator steps={steps} currentStep={currentStep} />

        {/* Step 1: Prefix & Name */}
        {currentStep === "prefix" && (
          <div className="space-y-6">
            <div className="text-sm text-neutral-600 mb-4">
              Define a unique prefix for your new plugin category. This prefix will be used
              to identify plugins of this type (e.g., "debug_" for debugging plugins).
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Prefix"
                value={prefix}
                onChange={(e) => setPrefix(e.target.value.toLowerCase())}
                placeholder="debug"
                helperText="Lowercase, no spaces (e.g., debug, mcp, audio)"
                fullWidth
                isRequired
              />
              <Input
                label="Contract Name"
                value={contractName}
                onChange={(e) => setContractName(e.target.value)}
                placeholder={derivedContractName || "DebugContract"}
                helperText="PascalCase (auto-generated if empty)"
                fullWidth
              />
            </div>

            <Input
              label="Description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe what plugins of this type do"
              helperText="Brief description for documentation"
              fullWidth
            />

            {prefix && (
              <div className="p-3 bg-neutral-50 rounded-lg text-sm">
                <p className="font-medium text-neutral-700 mb-1">Preview:</p>
                <p className="text-neutral-600">
                  Plugins will be named: <code className="bg-neutral-200 px-1 rounded">{prefix}_*</code>
                </p>
                <p className="text-neutral-600">
                  Contract file: <code className="bg-neutral-200 px-1 rounded">contracts/{prefix}_contract.py</code>
                </p>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Methods */}
        {currentStep === "methods" && (
          <div className="space-y-4">
            <div className="text-sm text-neutral-600 mb-4">
              Define the required methods that plugins implementing this contract must provide.
            </div>

            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-neutral-900">
                Contract Methods
              </h3>
              <Button
                variant="secondary"
                size="sm"
                onClick={addMethod}
                leftIcon={<PlusIcon />}
              >
                Add Method
              </Button>
            </div>

            <div className="space-y-4">
              {methods.map((method, index) => (
                <MethodEditor
                  key={index}
                  method={method}
                  onChange={(m) => updateMethod(index, m)}
                  onRemove={() => removeMethod(index)}
                />
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Smoke Test */}
        {currentStep === "smokeTest" && (
          <div className="space-y-6">
            <div className="text-sm text-neutral-600 mb-4">
              Configure a smoke test that will be run to verify plugins of this type are working correctly.
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Select
                label="Test Method"
                options={[
                  { value: "", label: "Select a method..." },
                  ...methods
                    .filter((m) => m.name.trim())
                    .map((m) => ({ value: m.name, label: m.name })),
                ]}
                value={smokeTest.method}
                onChange={(e) => setSmokeTest((prev) => ({ ...prev, method: e.target.value }))}
                fullWidth
              />
              <Input
                label="Expected Result"
                value={smokeTest.expected}
                onChange={(e) => setSmokeTest((prev) => ({ ...prev, expected: e.target.value }))}
                placeholder="not null"
                helperText="Expected result pattern (e.g., 'not null', 'dict')"
                fullWidth
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-neutral-700 mb-1">
                Test Parameters (JSON)
              </label>
              <textarea
                value={smokeTestParamsJson}
                onChange={(e) => setSmokeTestParamsJson(e.target.value)}
                placeholder='{"key": "value"}'
                className="w-full h-24 px-3 py-2 border border-neutral-300 rounded-lg font-mono text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              />
              <p className="mt-1 text-xs text-neutral-500">
                Parameters to pass to the smoke test method
              </p>
            </div>
          </div>
        )}

        {/* Step 4: Preview */}
        {currentStep === "preview" && (
          <div className="space-y-6">
            <div className="text-sm text-neutral-600 mb-4">
              Review the generated configuration and code before registering.
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <CodePreview
                code={yamlPreview}
                title="contract_prefixes.yaml entry"
                language="yaml"
              />
              <CodePreview
                code={pythonCode}
                title="Contract Python Class"
                language="python"
              />
            </div>

            <div className="p-4 bg-warning-50 border border-warning-200 rounded-lg">
              <p className="text-sm text-warning-800">
                <strong>Note:</strong> Registering this contract type will:
              </p>
              <ul className="mt-2 text-sm text-warning-700 list-disc list-inside">
                <li>Add an entry to <code>config/contract_prefixes.yaml</code></li>
                <li>Create <code>contracts/{prefix}_contract.py</code></li>
                <li>Make the <code>{prefix}_</code> prefix available for new plugins</li>
              </ul>
            </div>
          </div>
        )}

        {/* Error display */}
        {error && (
          <div className="p-3 bg-error-50 border border-error-200 rounded-lg text-sm text-error-700">
            {error}
          </div>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between pt-4 border-t border-neutral-200">
          <div>
            {currentStep !== "prefix" && (
              <Button variant="secondary" onClick={goBack}>
                Back
              </Button>
            )}
          </div>
          <div className="flex gap-3">
            {onClose && (
              <Button variant="ghost" onClick={onClose}>
                Cancel
              </Button>
            )}
            {currentStep !== "preview" ? (
              <Button
                variant="primary"
                onClick={goNext}
                rightIcon={<ArrowRightIcon />}
              >
                Next
              </Button>
            ) : (
              <Button
                variant="primary"
                onClick={handleRegister}
                loading={isRegistering}
                leftIcon={<CheckIcon />}
              >
                Register Contract Type
              </Button>
            )}
          </div>
        </div>
      </Panel>
    </div>
  );
};

RegisterContractWizard.displayName = "RegisterContractWizard";

export default RegisterContractWizard;
