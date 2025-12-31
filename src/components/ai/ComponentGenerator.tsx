/**
 * D070 - src/components/ai/ComponentGenerator.tsx
 * ================================================
 * AI-powered component generation interface.
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
import { Select, type SelectOption } from "../ui/Select";
import { Panel } from "../ui/Panel";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { LiveComponentPreview } from "./LiveComponentPreview";
import { generateText } from "../../services/llmService";
import { DESIGN_TOKEN_REFERENCE } from "../../hooks/useComponentGenerator";

/**
 * Component type options for generation.
 */
export type ComponentType = "button" | "input" | "card" | "form" | "list" | "modal" | "navigation" | "layout" | "custom";

/**
 * Framework target options.
 */
export type FrameworkTarget = "react" | "vue" | "svelte" | "html";

/**
 * Generated component output structure.
 */
export interface GeneratedComponent {
  /** Component name */
  name: string;
  /** Component type */
  type: ComponentType;
  /** Framework target */
  framework: FrameworkTarget;
  /** Generated code */
  code: string;
  /** Generated styles (if separate) */
  styles?: string;
  /** TypeScript types (if applicable) */
  types?: string;
  /** Generation timestamp */
  generatedAt: Date;
  /** Original prompt used */
  prompt: string;
}

/**
 * Component generator props.
 */
export interface ComponentGeneratorProps {
  /** Callback when component is generated */
  onGenerate: (prompt: string, type: ComponentType, framework: FrameworkTarget) => Promise<GeneratedComponent>;
  /** Callback when user wants to save/export generated component */
  onSave?: (component: GeneratedComponent) => void;
  /** Callback when user copies code to clipboard */
  onCopy?: (code: string) => void;
  /** Available component type options */
  componentTypes?: SelectOption[];
  /** Available framework options */
  frameworkOptions?: SelectOption[];
  /** Whether generation is in progress */
  isGenerating?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Default component type options.
 */
const defaultComponentTypes: SelectOption[] = [
  { value: "button", label: "Button" },
  { value: "input", label: "Input Field" },
  { value: "card", label: "Card" },
  { value: "form", label: "Form" },
  { value: "list", label: "List" },
  { value: "modal", label: "Modal/Dialog" },
  { value: "navigation", label: "Navigation" },
  { value: "layout", label: "Layout" },
  { value: "custom", label: "Custom" },
];

/**
 * Default framework options.
 */
const defaultFrameworkOptions: SelectOption[] = [
  { value: "react", label: "React + TypeScript" },
  { value: "vue", label: "Vue 3" },
  { value: "svelte", label: "Svelte" },
  { value: "html", label: "HTML + CSS" },
];

/**
 * Magic wand icon for generate button.
 */
const WandIcon: React.FC = () => (
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
    <path d="M15 4V2" />
    <path d="M15 16v-2" />
    <path d="M8 9h2" />
    <path d="M20 9h2" />
    <path d="M17.8 11.8 19 13" />
    <path d="M15 9h0" />
    <path d="M17.8 6.2 19 5" />
    <path d="m3 21 9-9" />
    <path d="M12.2 6.2 11 5" />
  </svg>
);

/**
 * Copy icon.
 */
const CopyIcon: React.FC = () => (
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
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

/**
 * Save icon.
 */
const SaveIcon: React.FC = () => (
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
    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
    <polyline points="17 21 17 13 7 13 7 21" />
    <polyline points="7 3 7 8 15 8" />
  </svg>
);

/**
 * Code preview component with syntax highlighting placeholder.
 */
const CodePreview: React.FC<{
  code: string;
  language: string;
  onCopy?: () => void;
}> = ({ code, language, onCopy }) => {
  const containerStyles = [
    "relative",
    "bg-neutral-900",
    "rounded-lg",
    "overflow-hidden",
  ].join(" ");

  const headerStyles = [
    "flex",
    "items-center",
    "justify-between",
    "px-4",
    "py-2",
    "bg-neutral-800",
    "border-b",
    "border-neutral-700",
  ].join(" ");

  const codeStyles = [
    "p-4",
    "overflow-x-auto",
    "text-sm",
    "font-mono",
    "text-neutral-100",
    "whitespace-pre",
  ].join(" ");

  return (
    <div className={containerStyles}>
      <div className={headerStyles}>
        <span className="text-xs text-neutral-400 uppercase tracking-wide">
          {language}
        </span>
        {onCopy && (
          <Button
            variant="ghost"
            size="xs"
            onClick={onCopy}
            leftIcon={<CopyIcon />}
            className="text-neutral-400 hover:text-white"
          >
            Copy
          </Button>
        )}
      </div>
      <pre className={codeStyles}>
        <code>{code}</code>
      </pre>
    </div>
  );
};

/**
 * ComponentGenerator component.
 *
 * An AI-powered interface for generating UI components from natural language
 * descriptions. Supports multiple component types and framework targets.
 *
 * @example
 * ```tsx
 * const handleGenerate = async (prompt, type, framework) => {
 *   const result = await aiService.generateComponent(prompt, type, framework);
 *   return result;
 * };
 *
 * <ComponentGenerator
 *   onGenerate={handleGenerate}
 *   onSave={(component) => saveToProject(component)}
 * />
 * ```
 */
export const ComponentGenerator: React.FC<ComponentGeneratorProps> = ({
  onGenerate,
  onSave,
  onCopy,
  componentTypes = defaultComponentTypes,
  frameworkOptions = defaultFrameworkOptions,
  isGenerating = false,
  className = "",
}) => {
  const [prompt, setPrompt] = useState("");
  const [componentType, setComponentType] = useState<ComponentType>("button");
  const [framework, setFramework] = useState<FrameworkTarget>("react");
  const [generatedComponent, setGeneratedComponent] = useState<GeneratedComponent | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [previewTab, setPreviewTab] = useState<'preview' | 'code' | 'refine'>('preview');

  // Chat refinement state
  const [refinementInput, setRefinementInput] = useState("");
  const [isRefining, setIsRefining] = useState(false);
  const [refinementHistory, setRefinementHistory] = useState<Array<{ role: 'user' | 'assistant'; content: string }>>([]);

  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Please enter a description for the component you want to generate.");
      return;
    }

    setError(null);
    try {
      const result = await onGenerate(prompt, componentType, framework);
      setGeneratedComponent(result);
      setShowPreviewModal(true);
    } catch (err) {
      // Handle various error types: Error instances, Tauri CommandError objects, strings
      let errorMsg = "Failed to generate component";
      if (err instanceof Error) {
        errorMsg = err.message;
      } else if (typeof err === "object" && err !== null && "message" in err) {
        const msg = (err as { message: string }).message;
        if (typeof msg === "string" && msg.length > 0) {
          errorMsg = msg;
        }
      } else if (typeof err === "string" && err.length > 0) {
        errorMsg = err;
      }
      setError(errorMsg);
    }
  }, [prompt, componentType, framework, onGenerate]);

  const handleCopy = useCallback(() => {
    if (generatedComponent) {
      navigator.clipboard.writeText(generatedComponent.code);
      onCopy?.(generatedComponent.code);
    }
  }, [generatedComponent, onCopy]);

  const handleSave = useCallback(() => {
    if (generatedComponent && onSave) {
      onSave(generatedComponent);
      setShowPreviewModal(false);
    }
  }, [generatedComponent, onSave]);

  /**
   * Handle component refinement via chat.
   */
  const handleRefinement = useCallback(async () => {
    if (!refinementInput.trim() || !generatedComponent) return;

    const userMessage = refinementInput.trim();
    setRefinementInput("");
    setIsRefining(true);

    // Add user message to history
    setRefinementHistory(prev => [...prev, { role: 'user', content: userMessage }]);

    try {
      // Build refinement prompt - uses same design tokens as initial generation (EUR-1.1.3a, C2)
      const refinementPrompt = `You are refining an existing ${generatedComponent.framework} component for the App Factory design system.

CURRENT COMPONENT CODE:
\`\`\`
${generatedComponent.code}
\`\`\`

USER REFINEMENT REQUEST:
"${userMessage}"

CRITICAL REQUIREMENTS:
1. Output ONLY the complete updated component code
2. Do NOT include any TypeScript syntax (type annotations, interfaces, generics)
3. Use Tailwind CSS classes for ALL styling - NO inline styles
4. Use ONLY the design token classes listed below - this ensures visual consistency
5. Do NOT include any import statements - React is available globally
6. Do NOT wrap code in markdown code fences
7. For React: use React.useState, React.useCallback directly
8. Keep the same component name
9. Apply the user's requested changes while preserving existing functionality
10. For hover effects, use Tailwind hover: prefix (e.g., hover:bg-primary-700)

${DESIGN_TOKEN_REFERENCE}

Generate ONLY the updated component code. No explanations.`;

      const result = await generateText(refinementPrompt);

      if (!result.success || !result.text) {
        throw new Error(result.error || 'Refinement failed');
      }

      // Update the generated component with refined code
      const refinedCode = result.text;
      setGeneratedComponent(prev => prev ? {
        ...prev,
        code: refinedCode,
        updatedAt: new Date(),
      } as GeneratedComponent : null);

      // Add assistant response to history
      setRefinementHistory(prev => [...prev, {
        role: 'assistant',
        content: 'Component updated! Check the Preview tab to see the changes.'
      }]);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Refinement failed';
      setRefinementHistory(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${errorMsg}`
      }]);
    } finally {
      setIsRefining(false);
    }
  }, [refinementInput, generatedComponent]);

  const containerStyles = [
    "space-y-6",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={containerStyles}>
      <Panel
        variant="default"
        padding="lg"
        radius="lg"
        header="AI Component Generator"
        showHeaderDivider
      >
        <div className="space-y-4">
          {/* Component description input */}
          <div>
            <label className="block text-sm font-medium text-neutral-700 mb-2">
              Describe your component
            </label>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="e.g., A card component with an image on top, title, description, and two action buttons at the bottom"
              rows={4}
              className={[
                "w-full",
                "px-4",
                "py-3",
                "text-base",
                "text-neutral-900",
                "placeholder:text-neutral-400",
                "border",
                "border-neutral-300",
                "rounded-lg",
                "focus:outline-none",
                "focus:ring-2",
                "focus:ring-primary-500",
                "focus:border-primary-500",
                "resize-none",
                "transition-colors",
                "duration-150",
              ].join(" ")}
            />
          </div>

          {/* Configuration row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Select
              label="Component Type"
              options={componentTypes}
              value={componentType}
              onChange={(e) => setComponentType(e.target.value as ComponentType)}
              fullWidth
            />
            <Select
              label="Target Framework"
              options={frameworkOptions}
              value={framework}
              onChange={(e) => setFramework(e.target.value as FrameworkTarget)}
              fullWidth
            />
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
              disabled={!prompt.trim()}
              leftIcon={<WandIcon />}
            >
              Generate Component
            </Button>
          </div>
        </div>
      </Panel>

      {/* Generated component preview */}
      {generatedComponent && (
        <Panel
          variant="elevated"
          padding="lg"
          radius="lg"
          header={
            <div className="flex items-center justify-between w-full">
              <span>Generated: {generatedComponent.name}</span>
              <span className="text-xs text-neutral-500">
                {generatedComponent.generatedAt.toLocaleString()}
              </span>
            </div>
          }
          showHeaderDivider
        >
          <div className="space-y-4">
            {/* Code preview */}
            <CodePreview
              code={generatedComponent.code}
              language={generatedComponent.framework}
              onCopy={handleCopy}
            />

            {/* Types preview (if available) */}
            {generatedComponent.types && (
              <CodePreview
                code={generatedComponent.types}
                language="typescript"
              />
            )}

            {/* Actions */}
            <div className="flex items-center justify-end gap-3">
              <Button
                variant="secondary"
                size="md"
                onClick={handleCopy}
                leftIcon={<CopyIcon />}
              >
                Copy Code
              </Button>
              {onSave && (
                <Button
                  variant="primary"
                  size="md"
                  onClick={handleSave}
                  leftIcon={<SaveIcon />}
                >
                  Save to Project
                </Button>
              )}
            </div>
          </div>
        </Panel>
      )}

      <Modal
        isOpen={showPreviewModal}
        onClose={() => setShowPreviewModal(false)}
        title="Generated Component Preview"
        size="4xl"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowPreviewModal(false)}
            >
              Close
            </Button>
            <Button
              variant="secondary"
              onClick={handleCopy}
              leftIcon={<CopyIcon />}
            >
              Copy Code
            </Button>
            {onSave && (
              <Button
                variant="primary"
                onClick={handleSave}
                leftIcon={<SaveIcon />}
              >
                Save to Project
              </Button>
            )}
          </>
        }
      >
        {generatedComponent && (
          <div className="space-y-4">
            {/* Component metadata */}
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-neutral-700">Name:</span>{" "}
                <span className="text-neutral-900">{generatedComponent.name}</span>
              </div>
              <div>
                <span className="font-medium text-neutral-700">Type:</span>{" "}
                <span className="text-neutral-900">{generatedComponent.type}</span>
              </div>
              <div>
                <span className="font-medium text-neutral-700">Framework:</span>{" "}
                <span className="text-neutral-900">{generatedComponent.framework}</span>
              </div>
              <div>
                <span className="font-medium text-neutral-700">Generated:</span>{" "}
                <span className="text-neutral-900">
                  {generatedComponent.generatedAt.toLocaleString()}
                </span>
              </div>
            </div>

            {/* Original prompt */}
            <div className="border-t border-neutral-200 pt-4">
              <h4 className="text-sm font-medium text-neutral-700 mb-2">Original Prompt</h4>
              <p className="text-sm text-neutral-600 bg-neutral-50 p-3 rounded-lg">
                {generatedComponent.prompt}
              </p>
            </div>

            {/* Tab switcher */}
            <div className="border-t border-neutral-200 pt-4">
              <div className="flex gap-1 mb-4 bg-neutral-100 p-1 rounded-lg w-fit">
                <button
                  onClick={() => setPreviewTab('preview')}
                  className={[
                    'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                    previewTab === 'preview'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900',
                  ].join(' ')}
                >
                  Preview
                </button>
                <button
                  onClick={() => setPreviewTab('code')}
                  className={[
                    'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                    previewTab === 'code'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900',
                  ].join(' ')}
                >
                  Code
                </button>
                <button
                  onClick={() => setPreviewTab('refine')}
                  className={[
                    'px-4 py-2 text-sm font-medium rounded-md transition-colors',
                    previewTab === 'refine'
                      ? 'bg-white text-neutral-900 shadow-sm'
                      : 'text-neutral-600 hover:text-neutral-900',
                  ].join(' ')}
                >
                  Refine
                </button>
              </div>

              {/* Preview tab content */}
              {previewTab === 'preview' && (
                <LiveComponentPreview
                  code={generatedComponent.code}
                  framework={generatedComponent.framework}
                  className="min-h-[300px]"
                />
              )}

              {/* Code tab content */}
              {previewTab === 'code' && (
                <CodePreview
                  code={generatedComponent.code}
                  language={generatedComponent.framework}
                />
              )}

              {/* Refine tab content */}
              {previewTab === 'refine' && (
                <div className="space-y-4">
                  {/* Refinement history */}
                  <div className="max-h-[200px] overflow-y-auto space-y-3 p-3 bg-neutral-50 rounded-lg">
                    {refinementHistory.length === 0 ? (
                      <p className="text-sm text-neutral-500 text-center py-4">
                        Describe changes you'd like to make to this component.
                        The AI will update the code accordingly.
                      </p>
                    ) : (
                      refinementHistory.map((msg, idx) => (
                        <div
                          key={idx}
                          className={[
                            'p-3 rounded-lg text-sm',
                            msg.role === 'user'
                              ? 'bg-primary-100 text-primary-900 ml-8'
                              : 'bg-white border border-neutral-200 mr-8',
                          ].join(' ')}
                        >
                          <span className="font-medium">
                            {msg.role === 'user' ? 'You: ' : 'AI: '}
                          </span>
                          {msg.content}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Refinement input */}
                  <div className="flex gap-2">
                    <Input
                      value={refinementInput}
                      onChange={(e) => setRefinementInput(e.target.value)}
                      placeholder="e.g., Make the button larger, add a hover effect, change the color to blue..."
                      className="flex-1"
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleRefinement();
                        }
                      }}
                      disabled={isRefining}
                    />
                    <Button
                      variant="primary"
                      onClick={handleRefinement}
                      loading={isRefining}
                      disabled={!refinementInput.trim()}
                    >
                      Refine
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
};

ComponentGenerator.displayName = "ComponentGenerator";

export default ComponentGenerator;
