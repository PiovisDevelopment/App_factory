/**
 * D054 - src/components/wizard/ScaffoldPreview.tsx
 * =================================================
 * Generated code preview for plugin creation wizard.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D050 (PluginWizard.tsx),
 *               D051 (ContractSelector.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { forwardRef, useState, useMemo, type HTMLAttributes } from "react";
import type { PluginManifestData } from "./PluginWizard";

/**
 * Generated file content.
 */
export interface GeneratedFile {
  /** File path relative to plugin folder */
  path: string;
  /** File content */
  content: string;
  /** File type for syntax highlighting */
  language: "python" | "json" | "yaml" | "text";
  /** Whether file is the main entry point */
  isEntryPoint?: boolean;
}

/**
 * ScaffoldPreview component props.
 */
export interface ScaffoldPreviewProps extends Omit<HTMLAttributes<HTMLDivElement>, "onChange"> {
  /** Plugin manifest data */
  manifestData: PluginManifestData;
  /** Custom file generator */
  generateFiles?: (data: PluginManifestData) => GeneratedFile[];
  /** Whether preview is loading */
  isLoading?: boolean;
  /** Error message if generation failed */
  error?: string;
  /** Callback when file is selected */
  onFileSelect?: (file: GeneratedFile) => void;
}

/**
 * File icon.
 */
const FileIcon: React.FC<{ className?: string; type: string }> = ({ className, type }) => {
  if (type === "python") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-1 17.93c-3.95-.49-7-3.85-7-7.93 0-.62.08-1.21.21-1.79L9 15v1c0 1.1.9 2 2 2v1.93zm6.9-2.54c-.26-.81-1-1.39-1.9-1.39h-1v-3c0-.55-.45-1-1-1H8v-2h2c.55 0 1-.45 1-1V7h2c1.1 0 2-.9 2-2v-.41c2.93 1.19 5 4.06 5 7.41 0 2.08-.8 3.97-2.1 5.39z" />
      </svg>
    );
  }
  if (type === "json") {
    return (
      <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <path d="M8 13h2" />
        <path d="M8 17h2" />
        <path d="M14 13h2" />
        <path d="M14 17h2" />
      </svg>
    );
  }
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <polyline points="10 9 9 9 8 9" />
    </svg>
  );
};

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
 * Copy icon.
 */
const CopyIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
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
 * Generate manifest.json content.
 */
const generateManifest = (data: PluginManifestData): string => {
  const manifest = {
    name: data.name,
    version: data.version,
    contract: data.contract,
    entry_point: data.entryPoint,
    display_name: data.displayName,
    description: data.description,
    author: data.author,
    license: data.license,
    dependencies: data.dependencies,
    python_requires: data.pythonRequires,
    gpu_required: data.gpuRequired,
    gpu_recommended: data.gpuRecommended,
    min_memory_mb: data.minMemoryMb,
    tags: data.tags,
    capabilities: data.capabilities,
    config_schema: data.configSchema,
    default_config: data.defaultConfig,
  };
  return JSON.stringify(manifest, null, 2);
};

/**
 * Generate plugin.py content based on contract.
 */
const generatePluginCode = (data: PluginManifestData): string => {
  const contractUpper = data.contract.toUpperCase();
  const className = data.displayName
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join("")
    .replace(/[^a-zA-Z0-9]/g, "");

  const contractClass = `${data.contract.charAt(0).toUpperCase()}${data.contract.slice(1)}Contract`;

  // Contract-specific implementations
  const implementations: Record<string, string> = {
    tts: `
    def synthesize(self, text: str, voice_id: str | None = None, options: dict | None = None) -> dict:
        """
        Synthesize text to audio.

        Args:
            text: Text to synthesize
            voice_id: Voice ID to use (optional)
            options: Additional options (optional)

        Returns:
            Dict with audio_data (base64), format, sample_rate, duration_ms
        """
        # TODO: Implement TTS synthesis
        self.logger.info(f"Synthesizing: {text[:50]}...")

        # Example return structure
        return {
            "audio_data": "",  # Base64 encoded audio
            "format": "wav",
            "sample_rate": 22050,
            "duration_ms": 0,
        }

    def get_voices(self) -> list[dict]:
        """
        Get available voices.

        Returns:
            List of voice info dicts with id, name, language
        """
        # TODO: Return actual available voices
        return [
            {"id": "default", "name": "Default Voice", "language": "en"},
        ]`,
    stt: `
    def transcribe(self, audio_data: str, language: str | None = None, options: dict | None = None) -> dict:
        """
        Transcribe audio to text.

        Args:
            audio_data: Base64 encoded audio
            language: Language code (optional)
            options: Additional options (optional)

        Returns:
            Dict with text, confidence, language, segments (optional)
        """
        # TODO: Implement STT transcription
        self.logger.info("Transcribing audio...")

        return {
            "text": "",
            "confidence": 0.0,
            "language": language or "en",
        }

    def get_languages(self) -> list[str]:
        """
        Get supported languages.

        Returns:
            List of language codes
        """
        return ["en"]`,
    llm: `
    def complete(self, messages: list[dict], options: dict | None = None) -> dict:
        """
        Generate completion for messages.

        Args:
            messages: List of chat messages with role and content
            options: Generation options (temperature, max_tokens, etc.)

        Returns:
            Dict with content, model, usage
        """
        # TODO: Implement LLM completion
        self.logger.info(f"Completing with {len(messages)} messages...")

        return {
            "content": "",
            "model": "${data.name}",
            "usage": {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
            },
        }

    def get_models(self) -> list[str]:
        """
        Get available models.

        Returns:
            List of model identifiers
        """
        return ["default"]`,
    mcp: `
    def list_tools(self) -> dict:
        """
        List available tools from MCP server.

        Returns:
            Dict with tools list
        """
        return {"tools": []}

    def call_tool(self, name: str, arguments: dict | None = None) -> dict:
        """
        Call a tool on the MCP server.

        Args:
            name: Tool name
            arguments: Tool arguments (optional)

        Returns:
            Tool result dict
        """
        # TODO: Implement MCP tool call
        self.logger.info(f"Calling tool: {name}")
        return {"result": None}

    def list_resources(self) -> dict:
        """
        List available resources.

        Returns:
            Dict with resources list
        """
        return {"resources": []}`,
    vision: `
    def analyze(self, image_data: str, prompt: str | None = None) -> dict:
        """
        Analyze image content.

        Args:
            image_data: Base64 encoded image
            prompt: Analysis prompt (optional)

        Returns:
            Dict with description, labels, confidence
        """
        # TODO: Implement vision analysis
        self.logger.info("Analyzing image...")

        return {
            "description": "",
            "labels": [],
            "confidence": 0.0,
        }`,
    embedding: `
    def embed(self, text: str) -> dict:
        """
        Generate embedding vector for text.

        Args:
            text: Text to embed

        Returns:
            Dict with vector, dimensions, model
        """
        # TODO: Implement embedding generation
        self.logger.info(f"Embedding: {text[:50]}...")

        return {
            "vector": [],
            "dimensions": 0,
            "model": "${data.name}",
        }

    def get_dimensions(self) -> int:
        """
        Get embedding dimensions.

        Returns:
            Vector dimensions
        """
        return 0`,
    debug: `
    def ping(self) -> str:
        """
        Simple health check.

        Returns:
            "pong"
        """
        return "pong"

    def echo(self, message: any) -> any:
        """
        Echo back input.

        Args:
            message: Any value

        Returns:
            Same value
        """
        return message`,
  };

  const implementation = implementations[data.contract] || implementations.debug;

  return `"""
${data.name}
${"=".repeat(data.name.length)}
${data.description || "Plugin implementation."}

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Contract: ${contractUpper}
Author: ${data.author || "Unknown"}
License: ${data.license}
"""

import logging
from typing import Any

from contracts.base import PluginBase, PluginStatus, HealthStatus
from contracts.${data.contract}_contract import ${contractClass}


class ${className}Plugin(PluginBase, ${contractClass}):
    """
    ${data.displayName} plugin implementation.

    Implements the ${contractUpper} contract.
    """

    def __init__(self):
        """Initialize plugin."""
        super().__init__()
        self.logger = logging.getLogger(__name__)
        self._config: dict = {}
        self._status = PluginStatus.CREATED

    def initialize(self, config: dict | None = None) -> bool:
        """
        Initialize plugin with configuration.

        Args:
            config: Plugin configuration dictionary

        Returns:
            True if initialization succeeded
        """
        self.logger.info(f"Initializing ${data.displayName}...")

        self._config = config or {}

        # TODO: Add initialization logic here
        # - Load models
        # - Set up connections
        # - Validate configuration

        self._status = PluginStatus.READY
        self.logger.info("${data.displayName} initialized successfully")
        return True

    def shutdown(self) -> None:
        """
        Shutdown plugin and release resources.
        """
        self.logger.info("Shutting down ${data.displayName}...")

        # TODO: Add cleanup logic here
        # - Release models
        # - Close connections
        # - Save state if needed

        self._status = PluginStatus.STOPPED
        self.logger.info("${data.displayName} shutdown complete")

    def health_check(self) -> HealthStatus:
        """
        Perform health check.

        Returns:
            HealthStatus with current status and message
        """
        return HealthStatus(
            status=self._status,
            message="Plugin is healthy" if self._status == PluginStatus.READY else "Plugin not ready",
        )
${implementation}


# Plugin instance for registration
plugin = ${className}Plugin()
`;
};

/**
 * Generate __init__.py content.
 */
const generateInit = (data: PluginManifestData): string => {
  return `"""
${data.name}
${"=".repeat(data.name.length)}
${data.description || "Plugin package."}
"""

from .${data.entryPoint} import plugin

__all__ = ["plugin"]
__version__ = "${data.version}"
`;
};

/**
 * Default file generator.
 */
const defaultGenerateFiles = (data: PluginManifestData): GeneratedFile[] => {
  return [
    {
      path: "manifest.json",
      content: generateManifest(data),
      language: "json",
    },
    {
      path: `${data.entryPoint}.py`,
      content: generatePluginCode(data),
      language: "python",
      isEntryPoint: true,
    },
    {
      path: "__init__.py",
      content: generateInit(data),
      language: "python",
    },
  ];
};

/**
 * ScaffoldPreview component.
 *
 * Displays generated plugin code files with syntax highlighting.
 * Allows users to preview and copy the generated code before creation.
 *
 * @example
 * ```tsx
 * <ScaffoldPreview
 *   manifestData={wizardData}
 * />
 * ```
 */
export const ScaffoldPreview = forwardRef<HTMLDivElement, ScaffoldPreviewProps>(
  (
    {
      manifestData,
      generateFiles = defaultGenerateFiles,
      isLoading = false,
      error,
      onFileSelect,
      className = "",
      ...props
    },
    ref
  ) => {
    // Selected file index
    const [selectedIndex, setSelectedIndex] = useState(0);

    // Copy state
    const [copied, setCopied] = useState(false);

    // Generate files
    const files = useMemo(() => {
      if (!manifestData.name || !manifestData.contract) {
        return [];
      }
      return generateFiles(manifestData);
    }, [manifestData, generateFiles]);

    // Selected file
    const selectedFile = files[selectedIndex];

    // Handle file selection
    const handleFileSelect = (index: number) => {
      setSelectedIndex(index);
      setCopied(false);
      if (files[index]) {
        onFileSelect?.(files[index]);
      }
    };

    // Handle copy
    const handleCopy = async () => {
      if (!selectedFile) return;

      try {
        await navigator.clipboard.writeText(selectedFile.content);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch (err) {
        console.error("Failed to copy:", err);
      }
    };

    // Container styles
    const containerStyles = [
      "flex",
      "flex-col",
      "h-full",
      "min-h-96",
      "bg-white",
      "rounded-lg",
      "border",
      "border-neutral-200",
      "overflow-hidden",
      className,
    ].filter(Boolean).join(" ");

    // Loading state
    if (isLoading) {
      return (
        <div ref={ref} className={containerStyles} {...props}>
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <div className="inline-block h-8 w-8 border-2 border-primary-500 border-t-transparent rounded-full animate-spin" />
              <p className="mt-2 text-sm text-neutral-500">Generating files...</p>
            </div>
          </div>
        </div>
      );
    }

    // Error state
    if (error) {
      return (
        <div ref={ref} className={containerStyles} {...props}>
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-error-100 text-error-600 mb-4">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <p className="text-sm text-error-700">{error}</p>
            </div>
          </div>
        </div>
      );
    }

    // Empty state
    if (files.length === 0) {
      return (
        <div ref={ref} className={containerStyles} {...props}>
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <FolderIcon className="mx-auto h-12 w-12 text-neutral-300" />
              <p className="mt-2 text-sm text-neutral-500">
                Complete the previous steps to see generated files
              </p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div ref={ref} className={containerStyles} {...props}>
        {/* Header with folder structure */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-neutral-200 bg-neutral-50">
          <FolderIcon className="h-4 w-4 text-warning-500" />
          <span className="text-sm font-medium text-neutral-700">{manifestData.name}/</span>
        </div>

        {/* File tabs */}
        <div className="flex border-b border-neutral-200 bg-neutral-50 overflow-x-auto">
          {files.map((file, index) => (
            <button
              key={file.path}
              type="button"
              onClick={() => handleFileSelect(index)}
              className={[
                "flex",
                "items-center",
                "gap-2",
                "px-4",
                "py-2.5",
                "text-sm",
                "font-medium",
                "border-b-2",
                "-mb-px",
                "transition-colors",
                "duration-150",
                "whitespace-nowrap",
                selectedIndex === index
                  ? "border-primary-500 text-primary-700 bg-white"
                  : "border-transparent text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100",
              ].join(" ")}
            >
              <FileIcon className="h-4 w-4" type={file.language} />
              {file.path}
              {file.isEntryPoint && (
                <span className="px-1.5 py-0.5 text-xs bg-primary-100 text-primary-700 rounded">
                  main
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Code display */}
        <div className="flex-1 relative overflow-hidden">
          {/* Copy button */}
          <button
            type="button"
            onClick={handleCopy}
            className={[
              "absolute",
              "top-3",
              "right-3",
              "z-10",
              "inline-flex",
              "items-center",
              "gap-1.5",
              "px-2.5",
              "py-1.5",
              "text-xs",
              "font-medium",
              "rounded-md",
              "transition-colors",
              "duration-150",
              copied
                ? "bg-success-100 text-success-700"
                : "bg-neutral-700 text-neutral-200 hover:bg-neutral-600",
            ].join(" ")}
          >
            {copied ? (
              <>
                <CheckIcon className="h-3.5 w-3.5" />
                Copied!
              </>
            ) : (
              <>
                <CopyIcon className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>

          {/* Code content */}
          <pre className="h-full p-4 bg-neutral-900 text-neutral-100 text-sm font-mono overflow-auto">
            <code>{selectedFile?.content}</code>
          </pre>
        </div>

        {/* File info footer */}
        <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-200 bg-neutral-50 text-xs text-neutral-500">
          <span>
            {files.length} file{files.length !== 1 ? "s" : ""} will be created
          </span>
          <span>
            {selectedFile?.content.split("\n").length} lines
          </span>
        </div>
      </div>
    );
  }
);

ScaffoldPreview.displayName = "ScaffoldPreview";

export default ScaffoldPreview;
