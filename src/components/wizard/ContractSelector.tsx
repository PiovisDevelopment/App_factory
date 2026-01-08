/**
 * D051 - src/components/wizard/ContractSelector.tsx
 * ==================================================
 * Contract type selector for plugin creation wizard.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D050 (PluginWizard.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { forwardRef, type HTMLAttributes } from "react";

/**
 * Contract type information.
 */
export interface ContractInfo {
  /** Contract identifier */
  id: string;
  /** Display name */
  name: string;
  /** Contract description */
  description: string;
  /** Icon component or element */
  icon?: React.ReactNode;
  /** Whether contract is available */
  available?: boolean;
  /** Required methods */
  requiredMethods?: string[];
  /** Optional methods */
  optionalMethods?: string[];
  /** Example use cases */
  examples?: string[];
}

/**
 * Default contract types based on contracts_registry.yaml.
 */
export const CONTRACT_TYPES: ContractInfo[] = [
  {
    id: "tts",
    name: "Text-to-Speech",
    description: "Convert text into spoken audio. Implement voice synthesis with multiple voice options.",
    requiredMethods: ["synthesize", "get_voices"],
    optionalMethods: ["set_voice", "synthesize_stream"],
    examples: ["Kokoro TTS", "Piper TTS", "XTTS"],
    available: true,
  },
  {
    id: "stt",
    name: "Speech-to-Text",
    description: "Transcribe audio into text. Implement real-time or batch transcription with language detection.",
    requiredMethods: ["transcribe", "get_languages"],
    optionalMethods: ["start_streaming", "stop_streaming", "push_audio_chunk"],
    examples: ["Moonshine STT", "Whisper", "Vosk"],
    available: true,
  },
  {
    id: "llm",
    name: "Large Language Model",
    description: "Generate text completions from chat messages. Implement local or API-based language models.",
    requiredMethods: ["complete", "get_models"],
    optionalMethods: ["complete_stream", "embed"],
    examples: ["Ollama", "LM Studio", "OpenAI API"],
    available: true,
  },
  {
    id: "mcp",
    name: "MCP Bridge",
    description: "Bridge to Model Context Protocol servers. Connect external tools and resources.",
    requiredMethods: ["list_tools", "call_tool", "list_resources"],
    optionalMethods: ["read_resource"],
    examples: ["Filesystem MCP", "Database MCP"],
    available: true,
  },
  {
    id: "vision",
    name: "Computer Vision",
    description: "Analyze images and visual content. Implement object detection, image description, or generation.",
    requiredMethods: ["analyze"],
    optionalMethods: ["detect", "generate"],
    examples: ["LLaVA", "CLIP", "BLIP"],
    available: true,
  },
  {
    id: "embedding",
    name: "Text Embedding",
    description: "Generate vector embeddings from text. Implement semantic search and similarity matching.",
    requiredMethods: ["embed", "get_dimensions"],
    optionalMethods: ["embed_batch", "similarity"],
    examples: ["Sentence Transformers", "OpenAI Embeddings"],
    available: true,
  },
  {
    id: "debug",
    name: "Debug Plugin",
    description: "Development and debugging utilities. Use for testing the plugin system.",
    requiredMethods: ["ping", "echo"],
    optionalMethods: ["log", "inspect", "profile"],
    examples: ["Debug Echo", "Performance Profiler"],
    available: true,
  },
];

/**
 * ContractSelector component props.
 */
export interface ContractSelectorProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Currently selected contract ID */
  value?: string;
  /** Callback when selection changes */
  onChange?: (contractId: string) => void;
  /** Available contract types */
  contracts?: ContractInfo[];
  /** Whether to show detailed information */
  showDetails?: boolean;
  /** Layout variant */
  layout?: "grid" | "list";
  /** Grid columns for grid layout */
  gridColumns?: 2 | 3;
  /** Disabled contract IDs */
  disabledContracts?: string[];
}

/**
 * Contract icon components.
 */
const ContractIcons: Record<string, React.FC<{ className?: string }>> = {
  tts: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  ),
  stt: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5" />
      <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
      <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
    </svg>
  ),
  llm: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 2L2 7l10 5 10-5-10-5z" />
      <path d="M2 17l10 5 10-5" />
      <path d="M2 12l10 5 10-5" />
    </svg>
  ),
  mcp: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2" />
      <line x1="8" y1="21" x2="16" y2="21" />
      <line x1="12" y1="17" x2="12" y2="21" />
    </svg>
  ),
  vision: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  embedding: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="10" />
      <path d="M8 12h8" />
      <path d="M12 8v8" />
    </svg>
  ),
  debug: ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M12 22c5.523 0 10-4.477 10-10S17.523 2 12 2 2 6.477 2 12s4.477 10 10 10z" />
      <path d="m9 9 6 6" />
      <path d="m15 9-6 6" />
    </svg>
  ),
};

/**
 * Get icon for contract type.
 */
const getContractIcon = (contractId: string): React.FC<{ className?: string }> => {
  // Non-null assertion safe: ContractIcons.debug is always defined
  return ContractIcons[contractId] ?? ContractIcons.debug!;
};

/**
 * Contract card colors.
 */
const contractColors: Record<string, { bg: string; border: string; text: string; iconBg: string }> = {
  tts: {
    bg: "bg-primary-50",
    border: "border-primary-200",
    text: "text-primary-700",
    iconBg: "bg-primary-100",
  },
  stt: {
    bg: "bg-success-50",
    border: "border-success-200",
    text: "text-success-700",
    iconBg: "bg-success-100",
  },
  llm: {
    bg: "bg-warning-50",
    border: "border-warning-200",
    text: "text-warning-700",
    iconBg: "bg-warning-100",
  },
  mcp: {
    bg: "bg-info-50",
    border: "border-info-200",
    text: "text-info-700",
    iconBg: "bg-info-100",
  },
  vision: {
    bg: "bg-purple-50",
    border: "border-purple-200",
    text: "text-purple-700",
    iconBg: "bg-purple-100",
  },
  embedding: {
    bg: "bg-cyan-50",
    border: "border-cyan-200",
    text: "text-cyan-700",
    iconBg: "bg-cyan-100",
  },
  debug: {
    bg: "bg-neutral-50",
    border: "border-neutral-200",
    text: "text-neutral-700",
    iconBg: "bg-neutral-100",
  },
};

const getContractColors = (contractId: string) => {
  // Non-null assertion safe: contractColors.debug is always defined
  return contractColors[contractId] ?? contractColors.debug!;
};

/**
 * ContractSelector component.
 *
 * Displays available contract types as selectable cards. Users select
 * the contract type their plugin will implement.
 *
 * @example
 * ```tsx
 * <ContractSelector
 *   value={selectedContract}
 *   onChange={(id) => setSelectedContract(id)}
 *   showDetails
 * />
 * ```
 */
export const ContractSelector = forwardRef<HTMLDivElement, ContractSelectorProps>(
  (
    {
      value,
      onChange,
      contracts = CONTRACT_TYPES,
      showDetails = true,
      layout = "grid",
      gridColumns = 2,
      disabledContracts = [],
      className = "",
      ...props
    },
    ref
  ) => {
    // Grid column classes
    const gridColClasses = {
      2: "grid-cols-1 sm:grid-cols-2",
      3: "grid-cols-1 sm:grid-cols-2 lg:grid-cols-3",
    };

    // Container styles
    const containerStyles = [
      layout === "grid" && ["grid", "gap-4", gridColClasses[gridColumns]].join(" "),
      layout === "list" && "flex flex-col gap-3",
      className,
    ].filter(Boolean).join(" ");

    // Handle selection
    const handleSelect = (contractId: string) => {
      if (!disabledContracts.includes(contractId)) {
        onChange?.(contractId);
      }
    };

    return (
      <div ref={ref} className={containerStyles} {...props}>
        {contracts.map((contract) => {
          const isSelected = value === contract.id;
          const isDisabled = disabledContracts.includes(contract.id) || !contract.available;
          const colors = getContractColors(contract.id);
          const Icon = getContractIcon(contract.id);

          // Card styles
          const cardStyles = [
            "group",
            "relative",
            "p-4",
            "rounded-lg",
            "border-2",
            "cursor-pointer",
            "transition-all",
            "duration-150",
            isSelected && [
              "ring-2",
              "ring-offset-2",
              "ring-primary-500",
              colors.border,
              colors.bg,
            ].join(" "),
            !isSelected && !isDisabled && [
              "border-neutral-200",
              "bg-white",
              "hover:border-neutral-300",
              "hover:shadow-sm",
            ].join(" "),
            isDisabled && [
              "border-neutral-100",
              "bg-neutral-50",
              "cursor-not-allowed",
              "opacity-60",
            ].join(" "),
          ].filter(Boolean).join(" ");

          return (
            <div
              key={contract.id}
              className={cardStyles}
              onClick={() => handleSelect(contract.id)}
              role="button"
              tabIndex={isDisabled ? -1 : 0}
              aria-pressed={isSelected}
              aria-disabled={isDisabled}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSelect(contract.id);
                }
              }}
            >
              {/* Selection indicator */}
              {isSelected && (
                <div className="absolute top-3 right-3">
                  <div className="flex items-center justify-center w-5 h-5 bg-primary-500 rounded-full">
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <polyline points="20 6 9 17 4 12" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                </div>
              )}

              {/* Header with icon and name */}
              <div className="flex items-start gap-3">
                {/* Icon */}
                <div
                  className={[
                    "flex",
                    "items-center",
                    "justify-center",
                    "w-10",
                    "h-10",
                    "rounded-lg",
                    "shrink-0",
                    isSelected ? colors.iconBg : "bg-neutral-100",
                  ].join(" ")}
                >
                  <Icon
                    className={[
                      "w-5",
                      "h-5",
                      isSelected ? colors.text : "text-neutral-600",
                    ].join(" ")}
                  />
                </div>

                {/* Name and ID */}
                <div className="flex-1 min-w-0">
                  <h3 className={[
                    "text-base",
                    "font-semibold",
                    isSelected ? "text-neutral-900" : "text-neutral-800",
                  ].join(" ")}>
                    {contract.name}
                  </h3>
                  <span className={[
                    "inline-flex",
                    "items-center",
                    "mt-1",
                    "px-2",
                    "py-0.5",
                    "text-xs",
                    "font-medium",
                    "rounded",
                    isSelected ? [colors.bg, colors.text].join(" ") : "bg-neutral-100 text-neutral-600",
                  ].join(" ")}>
                    {contract.id.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Description */}
              <p className="mt-3 text-sm text-neutral-600 line-clamp-2">
                {contract.description}
              </p>

              {/* Details section */}
              {showDetails && (
                <div className="mt-4 pt-3 border-t border-neutral-100">
                  {/* Required methods */}
                  {contract.requiredMethods && contract.requiredMethods.length > 0 && (
                    <div className="mb-2">
                      <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                        Required:
                      </span>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {contract.requiredMethods.map((method) => (
                          <code
                            key={method}
                            className="px-1.5 py-0.5 text-xs bg-neutral-100 text-neutral-700 rounded font-mono"
                          >
                            {method}()
                          </code>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Examples */}
                  {contract.examples && contract.examples.length > 0 && (
                    <div>
                      <span className="text-xs font-medium text-neutral-500 uppercase tracking-wide">
                        Examples:
                      </span>
                      <p className="mt-1 text-xs text-neutral-500">
                        {contract.examples.join(", ")}
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Unavailable indicator */}
              {!contract.available && (
                <div className="absolute inset-0 flex items-center justify-center bg-white/80 rounded-lg">
                  <span className="px-3 py-1 text-sm font-medium bg-neutral-200 text-neutral-600 rounded-full">
                    Coming Soon
                  </span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }
);

ContractSelector.displayName = "ContractSelector";

/**
 * Compact contract selector for smaller spaces.
 */
export interface ContractSelectorCompactProps {
  value?: string;
  onChange?: (contractId: string) => void;
  contracts?: ContractInfo[];
  className?: string;
}

export const ContractSelectorCompact: React.FC<ContractSelectorCompactProps> = ({
  value,
  onChange,
  contracts = CONTRACT_TYPES,
  className = "",
}) => {
  return (
    <div className={["flex", "flex-wrap", "gap-2", className].filter(Boolean).join(" ")}>
      {contracts.filter(c => c.available).map((contract) => {
        const isSelected = value === contract.id;
        const colors = getContractColors(contract.id);
        const Icon = getContractIcon(contract.id);

        return (
          <button
            key={contract.id}
            type="button"
            onClick={() => onChange?.(contract.id)}
            className={[
              "inline-flex",
              "items-center",
              "gap-2",
              "px-3",
              "py-2",
              "rounded-lg",
              "border",
              "text-sm",
              "font-medium",
              "transition-colors",
              "duration-150",
              isSelected
                ? [colors.bg, colors.border, colors.text].join(" ")
                : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300",
            ].join(" ")}
          >
            <Icon className="w-4 h-4" />
            {contract.name}
          </button>
        );
      })}
    </div>
  );
};

ContractSelectorCompact.displayName = "ContractSelectorCompact";

export default ContractSelector;
