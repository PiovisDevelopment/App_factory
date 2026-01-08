/**
 * D072 - src/components/ai/ContractWizard.tsx
 * ============================================
 * AI-powered contract creation wizard for plugin development.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D010, D011, D012, D014, D015
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 */

import React, { useState, useCallback } from "react";
import { Button } from "../ui/Button";
import { Input } from "../ui/Input";
import { Select, type SelectOption } from "../ui/Select";
import { Panel } from "../ui/Panel";
import { Modal } from "../ui/Modal";

/**
 * Contract method parameter definition.
 */
export interface ContractParameter {
  /** Parameter name */
  name: string;
  /** Parameter type (Python type annotation) */
  type: string;
  /** Parameter description */
  description: string;
  /** Whether parameter is required */
  required: boolean;
  /** Default value (if optional) */
  defaultValue?: string;
}

/**
 * Contract method definition.
 */
export interface ContractMethod {
  /** Method name */
  name: string;
  /** Method description */
  description: string;
  /** Method parameters */
  parameters: ContractParameter[];
  /** Return type */
  returnType: string;
  /** Whether method is async */
  isAsync: boolean;
}

/**
 * Generated contract structure.
 */
export interface GeneratedContract {
  /** Contract name */
  name: string;
  /** Contract category (tts, stt, llm, etc.) */
  category: string;
  /** Contract description */
  description: string;
  /** Contract methods */
  methods: ContractMethod[];
  /** Generated Python code */
  code: string;
  /** Hook specification code */
  hookspecCode: string;
  /** Example implementation */
  exampleImplementation: string;
  /** Generation timestamp */
  generatedAt: Date;
}

/**
 * Contract wizard props.
 */
export interface ContractWizardProps {
  /** Callback when contract is generated */
  onGenerate: (name: string, category: string, description: string, methods: ContractMethod[]) => Promise<GeneratedContract>;
  /** Callback when user saves the contract */
  onSave?: (contract: GeneratedContract) => void;
  /** Available contract categories */
  categories?: SelectOption[];
  /** Whether generation is in progress */
  isGenerating?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Default contract categories.
 */
const defaultCategories: SelectOption[] = [
  { value: "tts", label: "Text-to-Speech (TTS)" },
  { value: "stt", label: "Speech-to-Text (STT)" },
  { value: "llm", label: "Large Language Model (LLM)" },
  { value: "vision", label: "Computer Vision" },
  { value: "audio", label: "Audio Processing" },
  { value: "data", label: "Data Processing" },
  { value: "custom", label: "Custom" },
];

/**
 * Available Python types for parameters.
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
 * Code icon.
 */
const CodeIcon: React.FC = () => (
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
    <polyline points="16 18 22 12 16 6" />
    <polyline points="8 6 2 12 8 18" />
  </svg>
);

/**
 * Method editor component.
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
          placeholder="synthesize"
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
          <div className="space-y-3">
            {method.parameters.map((param, index) => (
              <div
                key={index}
                className="grid grid-cols-12 gap-2 items-end bg-neutral-50 p-3 rounded-lg"
              >
                <div className="col-span-3">
                  <Input
                    {...(index === 0 ? { label: "Name" } : {})}
                    value={param.name}
                    onChange={(e) =>
                      updateParameter(index, { ...param, name: e.target.value })
                    }
                    placeholder="text"
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
}> = ({ code, title }) => (
  <div className="bg-neutral-900 rounded-lg overflow-hidden">
    <div className="px-4 py-2 bg-neutral-800 border-b border-neutral-700">
      <span className="text-xs text-neutral-400 uppercase tracking-wide">{title}</span>
    </div>
    <pre className="p-4 overflow-x-auto text-sm font-mono text-neutral-100 whitespace-pre">
      <code>{code}</code>
    </pre>
  </div>
);

/**
 * ContractWizard component.
 *
 * A wizard interface for creating plugin contracts (interfaces) with AI assistance.
 * Helps define methods, parameters, and generates Python contract code.
 *
 * @example
 * ```tsx
 * const handleGenerate = async (name, category, description, methods) => {
 *   const result = await aiService.generateContract(name, category, description, methods);
 *   return result;
 * };
 *
 * <ContractWizard
 *   onGenerate={handleGenerate}
 *   onSave={(contract) => saveContract(contract)}
 * />
 * ```
 */
export const ContractWizard: React.FC<ContractWizardProps> = ({
  onGenerate,
  onSave,
  categories = defaultCategories,
  isGenerating = false,
  className = "",
}) => {
  const [name, setName] = useState("");
  const [category, setCategory] = useState("tts");
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
  const [generatedContract, setGeneratedContract] = useState<GeneratedContract | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

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

  const handleGenerate = useCallback(async () => {
    // Validation
    if (!name.trim()) {
      setError("Contract name is required");
      return;
    }

    const validMethods = methods.filter((m) => m.name.trim());
    if (validMethods.length === 0) {
      setError("At least one method with a name is required");
      return;
    }

    setError(null);
    try {
      const result = await onGenerate(name, category, description, validMethods);
      setGeneratedContract(result);
      setShowPreviewModal(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to generate contract");
    }
  }, [name, category, description, methods, onGenerate]);

  const handleSave = useCallback(() => {
    if (generatedContract && onSave) {
      onSave(generatedContract);
      setShowPreviewModal(false);
    }
  }, [generatedContract, onSave]);

  const containerStyles = [
    "space-y-6",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={containerStyles}>
      {/* Contract definition */}
      <Panel
        variant="default"
        padding="lg"
        radius="lg"
        header="Define Contract"
        showHeaderDivider
      >
        <div className="space-y-6">
          {/* Basic info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Contract Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="TTSContract"
              helperText="Use PascalCase, e.g., MyCustomContract"
              fullWidth
              isRequired
            />
            <Select
              label="Category"
              options={categories}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              fullWidth
              isRequired
            />
          </div>

          <Input
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the purpose of this contract"
            helperText="A brief description of what plugins implementing this contract should do"
            fullWidth
          />

          {/* Methods section */}
          <div className="space-y-4">
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

            {methods.map((method, index) => (
              <MethodEditor
                key={index}
                method={method}
                onChange={(m) => updateMethod(index, m)}
                onRemove={() => removeMethod(index)}
              />
            ))}
          </div>

          {/* Error display */}
          {error && (
            <div className="p-3 bg-error-50 border border-error-200 rounded-lg text-sm text-error-700">
              {error}
            </div>
          )}

          {/* Generate button */}
          <div className="flex justify-end">
            <Button
              variant="primary"
              size="lg"
              onClick={handleGenerate}
              loading={isGenerating}
              disabled={!name.trim() || methods.length === 0}
              leftIcon={<CodeIcon />}
            >
              Generate Contract
            </Button>
          </div>
        </div>
      </Panel>

      {/* Generated code preview */}
      {generatedContract && (
        <Panel
          variant="elevated"
          padding="lg"
          radius="lg"
          header={`Generated: ${generatedContract.name}`}
          showHeaderDivider
        >
          <div className="space-y-4">
            <CodePreview
              code={generatedContract.code}
              title="Contract Code"
            />

            <div className="flex justify-end gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={() => navigator.clipboard.writeText(generatedContract.code)}
              >
                Copy Code
              </Button>
              {onSave && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSave}
                >
                  Save Contract
                </Button>
              )}
            </div>
          </div>
        </Panel>
      )}

      {/* Full preview modal */}
      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="Generated Contract"
        size="4xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowPreviewModal(false)}
            >
              Close
            </Button>
            {onSave && (
              <Button
                variant="primary"
                onClick={handleSave}
              >
                Save Contract
              </Button>
            )}
          </>
        }
      >
        {generatedContract && (
          <div className="space-y-6">
            {/* Contract info */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-neutral-700">Name:</span>{" "}
                <span className="text-neutral-900">{generatedContract.name}</span>
              </div>
              <div>
                <span className="font-medium text-neutral-700">Category:</span>{" "}
                <span className="text-neutral-900">{generatedContract.category}</span>
              </div>
            </div>

            <p className="text-sm text-neutral-600">
              {generatedContract.description}
            </p>

            {/* Generated code sections */}
            <div className="space-y-4">
              <CodePreview
                code={generatedContract.code}
                title="Contract Definition"
              />

              <CodePreview
                code={generatedContract.hookspecCode}
                title="Pluggy Hook Specification"
              />

              <CodePreview
                code={generatedContract.exampleImplementation}
                title="Example Implementation"
              />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

ContractWizard.displayName = "ContractWizard";

export default ContractWizard;
