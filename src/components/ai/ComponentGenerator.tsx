/**
 * D070 - src/components/ai/ComponentGenerator.tsx
 * ================================================
 * AI-powered component generation interface with single-screen layout.
 *
 * Layout: 30% left chat panel | 70% right (preview top + code bottom)
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D010, D011, D012, D014, D015
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 */

import React, { useState, useCallback, useRef, useEffect } from "react";
import { Button } from "../ui/Button";
import { Select, type SelectOption } from "../ui/Select";
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
 * Chat message structure for conversation history.
 */
interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
}

/**
 * Component generator props.
 */
export interface ComponentGeneratorProps {
  /** Callback when component is generated */
  onGenerate: (prompt: string, type: ComponentType, framework: FrameworkTarget) => Promise<GeneratedComponent>;
  /** Callback when user wants to add the generated component to the library */
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
 * Add-to-library icon.
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
 * Send icon for chat.
 */
const SendIcon: React.FC = () => (
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
    <line x1="22" y1="2" x2="11" y2="13" />
    <polygon points="22 2 15 22 11 13 2 9 22 2" />
  </svg>
);

/**
 * Clear/Reset icon.
 */
const ClearIcon: React.FC = () => (
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
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

/**
 * Code preview component with syntax highlighting placeholder.
 */
const CodePreview: React.FC<{
  code: string;
  language: string;
  onCopy?: () => void;
  maxHeight?: string;
}> = ({ code, language, onCopy, maxHeight = "300px" }) => {
  const containerStyles = [
    "relative",
    "bg-neutral-900",
    "rounded-lg",
    "overflow-hidden",
    "flex",
    "flex-col",
  ].join(" ");

  const headerStyles = [
    "flex",
    "items-center",
    "justify-between",
    "px-3",
    "py-2",
    "bg-neutral-800",
    "border-b",
    "border-neutral-700",
    "flex-shrink-0",
  ].join(" ");

  const codeStyles = [
    "p-3",
    "overflow-auto",
    "text-xs",
    "font-mono",
    "text-neutral-100",
    "whitespace-pre-wrap",
    "flex-1",
  ].join(" ");

  return (
    <div className={containerStyles} style={{ maxHeight }}>
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
 * Single-screen AI-powered interface for generating UI components.
 * Layout: 30% left (chat) | 70% right (preview top + code bottom)
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
  // Generation state
  const [prompt, setPrompt] = useState("");
  const [componentType, setComponentType] = useState<ComponentType>("button");
  const [framework, setFramework] = useState<FrameworkTarget>("react");
  const [generatedComponent, setGeneratedComponent] = useState<GeneratedComponent | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Chat state
  const [chatHistory, setChatHistory] = useState<ChatMessage[]>([]);
  const [isRefining, setIsRefining] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState(false);

  // Refs
  const chatContainerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll chat to bottom on new messages
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [chatHistory]);

  // Generate new component
  const handleGenerate = useCallback(async () => {
    if (!prompt.trim()) {
      setError("Please enter a description for the component you want to generate.");
      return;
    }
    if (framework !== "react") {
      setError("Live preview is only supported for React. Select React to generate a demoable component.");
      return;
    }

    setError(null);

    // Add user message to chat
    const userMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: prompt,
      timestamp: new Date(),
    };
    setChatHistory(prev => [...prev, userMessage]);
    setPrompt("");

    try {
      const result = await onGenerate(prompt, componentType, framework);
      setGeneratedComponent(result);

      // Add success message to chat
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `Generated "${result.name}" component. Check the preview panel on the right to see it in action.`,
        timestamp: new Date(),
      };
      setChatHistory(prev => [...prev, assistantMessage]);
    } catch (err) {
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

      // Add error message to chat
      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `Error: ${errorMsg}`,
        timestamp: new Date(),
      };
      setChatHistory(prev => [...prev, errorMessage]);
    }
  }, [prompt, componentType, framework, onGenerate]);

  // Refine existing component
  const handleRefinement = useCallback(async () => {
    if (!prompt.trim() || !generatedComponent) return;

    const userMessage = prompt.trim();
    setPrompt("");
    setIsRefining(true);

    // Add user message to chat
    const chatUserMessage: ChatMessage = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: userMessage,
      timestamp: new Date(),
    };
    setChatHistory(prev => [...prev, chatUserMessage]);

    try {
      const refinementPrompt = `REFINE this component. Apply the user's changes EXACTLY.

CURRENT CODE:
${generatedComponent.code}

USER CHANGE REQUEST: "${userMessage}"

RULES:
1. Keep component name: ${generatedComponent.name}
2. Output ONLY the component - no wrappers, no explanations
3. Implement EVERY requested change literally:
   - "yellow" → bg-yellow-400 or bg-amber-400
   - "make it spin" → transition-transform duration-500 hover:rotate-[360deg]
   - "squishy" → transition-transform duration-150 hover:scale-110 active:scale-90
4. No TypeScript syntax, no imports, no markdown
5. Keep aria-label and focus ring styles

${DESIGN_TOKEN_REFERENCE}

OUTPUT THE REFINED CODE ONLY:`;

      const result = await generateText(refinementPrompt);

      if (!result.success || !result.text) {
        throw new Error(result.error || 'Refinement failed');
      }

      const refinedCode = result.text;
      setGeneratedComponent(prev => prev ? {
        ...prev,
        code: refinedCode,
        generatedAt: new Date(),
      } as GeneratedComponent : null);

      // Add success message to chat
      const assistantMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: 'Component updated! The preview has been refreshed with your changes.',
        timestamp: new Date(),
      };
      setChatHistory(prev => [...prev, assistantMessage]);

    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : 'Refinement failed';

      const errorMessage: ChatMessage = {
        id: `msg-${Date.now() + 1}`,
        role: 'assistant',
        content: `Error: ${errorMsg}`,
        timestamp: new Date(),
      };
      setChatHistory(prev => [...prev, errorMessage]);
    } finally {
      setIsRefining(false);
    }
  }, [prompt, generatedComponent]);

  // Handle send action (generate or refine based on state)
  const handleSend = useCallback(() => {
    if (generatedComponent) {
      handleRefinement();
    } else {
      handleGenerate();
    }
  }, [generatedComponent, handleRefinement, handleGenerate]);

  // Handle keyboard submit
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }, [handleSend]);

  // Copy code to clipboard
  const handleCopy = useCallback(() => {
    if (generatedComponent) {
      navigator.clipboard.writeText(generatedComponent.code);
      onCopy?.(generatedComponent.code);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  }, [generatedComponent, onCopy]);

  // Save to library
  const handleSave = useCallback(() => {
    if (generatedComponent && onSave) {
      onSave(generatedComponent);

      const successMessage: ChatMessage = {
        id: `msg-${Date.now()}`,
        role: 'system',
        content: `"${generatedComponent.name}" has been added to your component library.`,
        timestamp: new Date(),
      };
      setChatHistory(prev => [...prev, successMessage]);
    }
  }, [generatedComponent, onSave]);

  // Clear/reset conversation
  const handleClear = useCallback(() => {
    setChatHistory([]);
    setGeneratedComponent(null);
    setPrompt("");
    setError(null);
  }, []);

  // Container styles for the full-screen layout
  const containerStyles = [
    "flex",
    "h-full",
    "w-full",
    "bg-neutral-50",
    "rounded-lg",
    "overflow-hidden",
    "border",
    "border-neutral-200",
    className,
  ].filter(Boolean).join(" ");

  return (
    <div className={containerStyles} style={{ minHeight: "600px" }}>
      {/* Left Panel - Chat (30%) */}
      <div className="w-[30%] min-w-[280px] flex flex-col border-r border-neutral-200 bg-white">
        {/* Chat Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-neutral-200 bg-neutral-50">
          <div className="flex items-center gap-2">
            <WandIcon />
            <span className="font-semibold text-sm text-neutral-800">AI Component Generator</span>
          </div>
          <button
            type="button"
            onClick={handleClear}
            className="p-1.5 rounded-md text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 transition-colors"
            title="Clear conversation"
          >
            <ClearIcon />
          </button>
        </div>

        {/* Configuration Options */}
        <div className="px-4 py-3 border-b border-neutral-200 bg-neutral-50 space-y-3">
          <Select
            label="Component Type"
            options={componentTypes}
            value={componentType}
            onChange={(e) => setComponentType(e.target.value as ComponentType)}
            fullWidth
            size="sm"
          />
          <Select
            label="Framework"
            options={frameworkOptions}
            value={framework}
            onChange={(e) => setFramework(e.target.value as FrameworkTarget)}
            fullWidth
            size="sm"
          />
        </div>

        {/* Chat Messages */}
        <div
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto p-4 space-y-3"
        >
          {chatHistory.length === 0 ? (
            <div className="text-center py-8">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-primary-100 mb-3">
                <WandIcon />
              </div>
              <p className="text-sm text-neutral-600 mb-2">
                Describe the component you want to create
              </p>
              <p className="text-xs text-neutral-400">
                e.g., "A card with image, title, and action button"
              </p>
            </div>
          ) : (
            chatHistory.map((msg) => (
              <div
                key={msg.id}
                className={[
                  'p-3 rounded-lg text-sm',
                  msg.role === 'user'
                    ? 'bg-primary-100 text-primary-900 ml-4'
                    : msg.role === 'system'
                      ? 'bg-success-50 text-success-700 border border-success-200'
                      : 'bg-neutral-100 text-neutral-800 mr-4',
                ].join(' ')}
              >
                {msg.role === 'user' && (
                  <span className="text-xs font-medium text-primary-600 block mb-1">You</span>
                )}
                {msg.role === 'assistant' && (
                  <span className="text-xs font-medium text-neutral-500 block mb-1">AI</span>
                )}
                {msg.content}
              </div>
            ))
          )}

          {/* Loading indicator */}
          {(isGenerating || isRefining) && (
            <div className="flex items-center gap-2 p-3 bg-neutral-100 rounded-lg mr-4">
              <div className="flex space-x-1">
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-2 h-2 bg-primary-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
              <span className="text-sm text-neutral-500">
                {isGenerating ? 'Generating component...' : 'Refining component...'}
              </span>
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mx-4 mb-2 p-2 bg-error-50 border border-error-200 rounded-lg text-xs text-error-700">
            {error}
          </div>
        )}

        {/* Chat Input */}
        <div className="p-4 border-t border-neutral-200 bg-white">
          <div className="flex gap-2">
            <textarea
              ref={inputRef}
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={generatedComponent ? "Describe changes to refine..." : "Describe your component..."}
              rows={2}
              disabled={isGenerating || isRefining}
              className={[
                "flex-1",
                "px-3",
                "py-2",
                "text-sm",
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
                "disabled:bg-neutral-50",
                "disabled:text-neutral-400",
              ].join(" ")}
            />
            <Button
              variant="primary"
              size="md"
              onClick={handleSend}
              loading={isGenerating || isRefining}
              disabled={!prompt.trim()}
              className="self-end"
              title={generatedComponent ? "Refine component" : "Generate component"}
            >
              <SendIcon />
            </Button>
          </div>
          {generatedComponent && (
            <p className="text-xs text-neutral-400 mt-2">
              Describe changes to refine the component, or clear to start fresh.
            </p>
          )}
        </div>
      </div>

      {/* Right Panel - Preview & Code (70%) */}
      <div className="flex-1 flex flex-col bg-neutral-100 min-w-0 overflow-hidden">
        {generatedComponent ? (
          <>
            {/* Toolbar */}
            <div className="flex items-center justify-between px-4 py-2 border-b border-neutral-200 bg-white">
              <div className="flex items-center gap-3">
                <span className="font-medium text-sm text-neutral-800">
                  {generatedComponent.name}
                </span>
                <span className="text-xs text-neutral-400">
                  {generatedComponent.type} • {generatedComponent.framework}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={handleCopy}
                  leftIcon={<CopyIcon />}
                >
                  {copyFeedback ? 'Copied!' : 'Copy Code'}
                </Button>
                {onSave && (
                  <Button
                    variant="primary"
                    size="sm"
                    onClick={handleSave}
                    leftIcon={<PlusIcon />}
                  >
                    Add to Library
                  </Button>
                )}
              </div>
            </div>

            {/* Upper Section - Preview */}
            <div className="flex-1 min-h-0 p-4 overflow-auto">
              <div className="h-full bg-white rounded-lg border border-neutral-200 overflow-hidden">
                <div className="px-3 py-2 border-b border-neutral-200 bg-neutral-50">
                  <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                    Live Preview
                  </span>
                </div>
                <div className="h-[calc(100%-36px)] w-full flex items-center justify-center">
                  <LiveComponentPreview
                    code={generatedComponent.code}
                    framework={generatedComponent.framework}
                    className="h-full w-full"
                  />
                </div>
              </div>
            </div>

            {/* Lower Section - Code */}
            <div className="h-[40%] min-h-[200px] p-4 pt-0">
              <CodePreview
                code={generatedComponent.code}
                language={generatedComponent.framework}
                onCopy={handleCopy}
                maxHeight="100%"
              />
            </div>
          </>
        ) : (
          /* Empty State */
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center max-w-md px-8">
              <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neutral-200 mb-4">
                <svg className="w-8 h-8 text-neutral-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="9" y1="9" x2="15" y2="9" />
                  <line x1="9" y1="13" x2="15" y2="13" />
                  <line x1="9" y1="17" x2="13" y2="17" />
                </svg>
              </div>
              <h3 className="text-lg font-semibold text-neutral-700 mb-2">
                No Component Generated Yet
              </h3>
              <p className="text-sm text-neutral-500 mb-4">
                Use the chat panel on the left to describe the component you want to create.
                The AI will generate the code and show a live preview here.
              </p>
              <div className="flex flex-wrap gap-2 justify-center">
                {['Button', 'Card', 'Form', 'Modal'].map((example) => (
                  <button
                    key={example}
                    type="button"
                    onClick={() => {
                      setPrompt(`A ${example.toLowerCase()} component with modern styling`);
                      inputRef.current?.focus();
                    }}
                    className="px-3 py-1.5 text-xs font-medium text-primary-600 bg-primary-50 rounded-full hover:bg-primary-100 transition-colors"
                  >
                    {example}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

ComponentGenerator.displayName = "ComponentGenerator";

export default ComponentGenerator;
