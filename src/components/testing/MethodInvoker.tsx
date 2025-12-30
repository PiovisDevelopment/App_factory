/**
 * D058 - src/components/testing/MethodInvoker.tsx
 * ================================================
 * Method test invoker for executing plugin methods with custom parameters.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D057 (PluginTester.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { useState, useCallback, useMemo, type HTMLAttributes } from "react";

/**
 * Parameter definition for method invocation.
 */
export interface InvokerParam {
  name: string;
  type: "string" | "number" | "boolean" | "object" | "array";
  required?: boolean;
  description?: string;
  default?: unknown;
  enum?: string[];
  min?: number;
  max?: number;
}

/**
 * Method definition for the invoker.
 */
export interface InvokerMethod {
  name: string;
  description?: string;
  params: InvokerParam[];
  returns?: {
    type: string;
    description?: string;
  };
}

/**
 * Invocation result.
 */
export interface InvocationResult {
  id: string;
  method: string;
  params: Record<string, unknown>;
  success: boolean;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
  duration: number;
  timestamp: Date;
}

/**
 * MethodInvoker component props.
 */
export interface MethodInvokerProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSubmit"> {
  /** Method to invoke */
  method: InvokerMethod;
  /** Plugin ID for context */
  pluginId: string;
  /** Plugin display name */
  pluginName?: string;
  /** Callback when method is invoked */
  onInvoke?: (method: string, params: Record<string, unknown>) => Promise<InvocationResult>;
  /** Whether invocation is in progress */
  isInvoking?: boolean;
  /** Last invocation result */
  lastResult?: InvocationResult;
  /** Whether to show the result panel */
  showResult?: boolean;
  /** Compact mode */
  compact?: boolean;
}

/**
 * Play icon.
 */
const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <polygon points="5 3 19 12 5 21 5 3" />
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
 * Reset icon.
 */
const ResetIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
    <path d="M3 3v5h5" />
  </svg>
);

/**
 * Generate a unique ID.
 */
const generateId = (): string => {
  return `inv_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

/**
 * Parse value based on type.
 */
const parseValue = (value: string, type: InvokerParam["type"]): unknown => {
  if (value === "" || value === undefined) return undefined;

  switch (type) {
    case "number":
      const num = parseFloat(value);
      return isNaN(num) ? undefined : num;
    case "boolean":
      return value === "true";
    case "object":
    case "array":
      try {
        return JSON.parse(value);
      } catch {
        return undefined;
      }
    default:
      return value;
  }
};

/**
 * Format value for display.
 */
const formatValue = (value: unknown, type: InvokerParam["type"]): string => {
  if (value === undefined || value === null) return "";

  switch (type) {
    case "object":
    case "array":
      return typeof value === "string" ? value : JSON.stringify(value, null, 2);
    default:
      return String(value);
  }
};

/**
 * MethodInvoker component.
 *
 * Provides a form-based interface for invoking plugin methods with typed parameters.
 * Supports validation, default values, and result display.
 *
 * @example
 * ```tsx
 * <MethodInvoker
 *   method={{
 *     name: "synthesize",
 *     params: [
 *       { name: "text", type: "string", required: true },
 *       { name: "voice_id", type: "string", default: "af_bella" }
 *     ]
 *   }}
 *   pluginId="tts_kokoro"
 *   onInvoke={async (method, params) => {
 *     return await callPlugin("tts_kokoro", method, params);
 *   }}
 * />
 * ```
 */
export const MethodInvoker: React.FC<MethodInvokerProps> = ({
  method,
  pluginId,
  pluginName,
  onInvoke,
  isInvoking = false,
  lastResult,
  showResult = true,
  compact = false,
  className = "",
  ...props
}) => {
  // Parameter values state
  const [paramValues, setParamValues] = useState<Record<string, string>>(() => {
    const defaults: Record<string, string> = {};
    method.params.forEach((param) => {
      if (param.default !== undefined) {
        defaults[param.name] = formatValue(param.default, param.type);
      }
    });
    return defaults;
  });

  // Validation errors
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Copy state for result
  const [copied, setCopied] = useState(false);

  // Validate parameters
  const validateParams = useCallback((): boolean => {
    const newErrors: Record<string, string> = {};

    method.params.forEach((param) => {
      const value = paramValues[param.name];
      const parsed = parseValue(value, param.type);

      if (param.required && (value === "" || value === undefined)) {
        newErrors[param.name] = "This field is required";
      } else if (value !== "" && value !== undefined && parsed === undefined) {
        newErrors[param.name] = `Invalid ${param.type} value`;
      } else if (param.type === "number" && parsed !== undefined) {
        if (param.min !== undefined && (parsed as number) < param.min) {
          newErrors[param.name] = `Must be at least ${param.min}`;
        }
        if (param.max !== undefined && (parsed as number) > param.max) {
          newErrors[param.name] = `Must be at most ${param.max}`;
        }
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }, [method.params, paramValues]);

  // Build params object
  const buildParams = useMemo((): Record<string, unknown> => {
    const params: Record<string, unknown> = {};
    method.params.forEach((param) => {
      const value = paramValues[param.name];
      const parsed = parseValue(value, param.type);
      if (parsed !== undefined) {
        params[param.name] = parsed;
      }
    });
    return params;
  }, [method.params, paramValues]);

  // Handle param change
  const handleParamChange = useCallback((name: string, value: string) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => {
      const newErrors = { ...prev };
      delete newErrors[name];
      return newErrors;
    });
  }, []);

  // Handle invoke
  const handleInvoke = useCallback(async () => {
    if (!validateParams() || !onInvoke) return;
    await onInvoke(method.name, buildParams);
  }, [validateParams, onInvoke, method.name, buildParams]);

  // Handle reset
  const handleReset = useCallback(() => {
    const defaults: Record<string, string> = {};
    method.params.forEach((param) => {
      if (param.default !== undefined) {
        defaults[param.name] = formatValue(param.default, param.type);
      }
    });
    setParamValues(defaults);
    setErrors({});
  }, [method.params]);

  // Handle copy result
  const handleCopyResult = useCallback(async () => {
    if (!lastResult) return;
    const text = JSON.stringify(
      lastResult.success ? lastResult.result : lastResult.error,
      null,
      2
    );
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [lastResult]);

  // Container styles
  const containerStyles = [
    "flex",
    "flex-col",
    "gap-4",
    className,
  ].filter(Boolean).join(" ");

  // Input base styles
  const inputBaseStyles = [
    "w-full",
    "px-3",
    "py-2",
    "text-sm",
    "bg-white",
    "border",
    "rounded-md",
    "focus:outline-none",
    "focus:ring-2",
    "focus:ring-primary-500",
    "transition-colors",
    "duration-150",
  ];

  return (
    <div className={containerStyles} {...props}>
      {/* Method header */}
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-neutral-900">
            {method.name}()
          </h4>
          {method.description && (
            <p className="mt-0.5 text-xs text-neutral-500">
              {method.description}
            </p>
          )}
        </div>
        {pluginName && (
          <span className="text-xs text-neutral-400">
            {pluginName}
          </span>
        )}
      </div>

      {/* Parameters form */}
      {method.params.length > 0 ? (
        <div className={compact ? "space-y-2" : "space-y-3"}>
          {method.params.map((param) => (
            <div key={param.name}>
              <label className="flex items-center gap-2 text-sm font-medium text-neutral-700 mb-1">
                {param.name}
                <span className="text-xs font-normal text-neutral-400">
                  ({param.type})
                </span>
                {param.required && (
                  <span className="text-error-500">*</span>
                )}
              </label>

              {/* Enum select */}
              {param.enum ? (
                <select
                  value={paramValues[param.name] ?? ""}
                  onChange={(e) => handleParamChange(param.name, e.target.value)}
                  className={[
                    ...inputBaseStyles,
                    errors[param.name]
                      ? "border-error-500 focus:ring-error-500"
                      : "border-neutral-300",
                  ].join(" ")}
                >
                  <option value="">Select {param.name}</option>
                  {param.enum.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              ) : param.type === "boolean" ? (
                <select
                  value={paramValues[param.name] ?? ""}
                  onChange={(e) => handleParamChange(param.name, e.target.value)}
                  className={[
                    ...inputBaseStyles,
                    errors[param.name]
                      ? "border-error-500 focus:ring-error-500"
                      : "border-neutral-300",
                  ].join(" ")}
                >
                  <option value="">Select value</option>
                  <option value="true">true</option>
                  <option value="false">false</option>
                </select>
              ) : param.type === "object" || param.type === "array" ? (
                <textarea
                  value={paramValues[param.name] ?? ""}
                  onChange={(e) => handleParamChange(param.name, e.target.value)}
                  placeholder={param.type === "array" ? '["item1", "item2"]' : '{"key": "value"}'}
                  rows={compact ? 2 : 3}
                  className={[
                    ...inputBaseStyles,
                    "font-mono",
                    errors[param.name]
                      ? "border-error-500 focus:ring-error-500"
                      : "border-neutral-300",
                  ].join(" ")}
                />
              ) : (
                <input
                  type={param.type === "number" ? "number" : "text"}
                  value={paramValues[param.name] ?? ""}
                  onChange={(e) => handleParamChange(param.name, e.target.value)}
                  placeholder={param.description || `Enter ${param.name}`}
                  min={param.min}
                  max={param.max}
                  className={[
                    ...inputBaseStyles,
                    errors[param.name]
                      ? "border-error-500 focus:ring-error-500"
                      : "border-neutral-300",
                  ].join(" ")}
                />
              )}

              {/* Error message */}
              {errors[param.name] && (
                <p className="mt-1 text-xs text-error-600">
                  {errors[param.name]}
                </p>
              )}

              {/* Description */}
              {param.description && !errors[param.name] && (
                <p className="mt-1 text-xs text-neutral-500">
                  {param.description}
                </p>
              )}
            </div>
          ))}
        </div>
      ) : (
        <p className="text-sm text-neutral-500 italic">
          No parameters required
        </p>
      )}

      {/* Action buttons */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleInvoke}
          disabled={isInvoking || !onInvoke}
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
            "disabled:opacity-50",
            "disabled:cursor-not-allowed",
            "transition-colors",
            "duration-150",
          ].join(" ")}
        >
          {isInvoking ? (
            <>
              <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Invoking...
            </>
          ) : (
            <>
              <PlayIcon className="h-4 w-4" />
              Invoke
            </>
          )}
        </button>

        <button
          type="button"
          onClick={handleReset}
          disabled={isInvoking}
          className={[
            "inline-flex",
            "items-center",
            "gap-1.5",
            "px-3",
            "py-2",
            "text-sm",
            "font-medium",
            "text-neutral-700",
            "bg-neutral-100",
            "rounded-md",
            "hover:bg-neutral-200",
            "disabled:opacity-50",
            "disabled:cursor-not-allowed",
            "transition-colors",
            "duration-150",
          ].join(" ")}
        >
          <ResetIcon className="h-4 w-4" />
          Reset
        </button>
      </div>

      {/* Result display */}
      {showResult && lastResult && (
        <div
          className={[
            "rounded-lg",
            "border",
            "overflow-hidden",
            lastResult.success
              ? "bg-success-50 border-success-200"
              : "bg-error-50 border-error-200",
          ].join(" ")}
        >
          {/* Result header */}
          <div className="flex items-center justify-between px-3 py-2 border-b border-inherit">
            <div className="flex items-center gap-2">
              <span
                className={[
                  "text-xs",
                  "font-semibold",
                  "uppercase",
                  lastResult.success ? "text-success-700" : "text-error-700",
                ].join(" ")}
              >
                {lastResult.success ? "Success" : "Error"}
              </span>
              <span className="text-xs text-neutral-500">
                {lastResult.duration}ms
              </span>
            </div>
            <button
              type="button"
              onClick={handleCopyResult}
              className={[
                "inline-flex",
                "items-center",
                "gap-1",
                "px-2",
                "py-1",
                "text-xs",
                "font-medium",
                "text-neutral-600",
                "hover:text-neutral-900",
                "transition-colors",
                "duration-150",
              ].join(" ")}
            >
              {copied ? (
                <>
                  <CheckIcon className="h-3.5 w-3.5 text-success-600" />
                  Copied
                </>
              ) : (
                <>
                  <CopyIcon className="h-3.5 w-3.5" />
                  Copy
                </>
              )}
            </button>
          </div>

          {/* Result body */}
          <div className="p-3">
            {lastResult.success ? (
              <pre className="text-xs font-mono text-neutral-800 whitespace-pre-wrap overflow-x-auto">
                {JSON.stringify(lastResult.result, null, 2)}
              </pre>
            ) : (
              <div>
                <p className="text-sm font-medium text-error-700">
                  {lastResult.error?.message}
                </p>
                {lastResult.error?.code && (
                  <p className="text-xs text-error-600 mt-1">
                    Error code: {lastResult.error.code}
                  </p>
                )}
                {lastResult.error?.data && (
                  <pre className="mt-2 text-xs font-mono text-error-600 whitespace-pre-wrap overflow-x-auto">
                    {JSON.stringify(lastResult.error.data, null, 2)}
                  </pre>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

MethodInvoker.displayName = "MethodInvoker";

export default MethodInvoker;
