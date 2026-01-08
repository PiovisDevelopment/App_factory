/**
 * D057 - src/components/testing/PluginTester.tsx
 * ===============================================
 * Plugin test harness UI for testing plugin functionality.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006 (design_tokens.css), D007 (tailwind.config.js), D010 (Button.tsx),
 *               D014 (Panel.tsx), D040 (PluginGallery.tsx)
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 *   - Fully typed props with TypeScript
 */

import React, { useState, useCallback, useMemo, type HTMLAttributes } from "react";

/**
 * Plugin info for testing.
 */
export interface TestablePlugin {
  id: string;
  name: string;
  displayName: string;
  contract: string;
  version: string;
  status: "loaded" | "unloaded" | "error" | "loading";
  methods: PluginMethod[];
}

/**
 * Plugin method definition.
 */
export interface PluginMethod {
  name: string;
  description?: string;
  params: MethodParam[];
  returns?: MethodReturn;
  required?: boolean;
}

/**
 * Method parameter.
 */
export interface MethodParam {
  name: string;
  type: string;
  required?: boolean;
  description?: string;
  default?: unknown;
}

/**
 * Method return type.
 */
export interface MethodReturn {
  type: string;
  description?: string;
  schema?: Record<string, unknown>;
}

/**
 * Test result.
 */
export interface TestResult {
  method: string;
  success: boolean;
  duration: number;
  request: unknown;
  response?: unknown;
  error?: string;
  timestamp: Date;
}

/**
 * PluginTester component props.
 */
export interface PluginTesterProps extends Omit<HTMLAttributes<HTMLDivElement>, "onSelect"> {
  /** Available plugins to test */
  plugins: TestablePlugin[];
  /** Currently selected plugin ID */
  selectedPluginId?: string;
  /** Callback when plugin is selected */
  onSelectPlugin?: (plugin: TestablePlugin) => void;
  /** Callback when test is executed */
  onExecuteTest?: (plugin: TestablePlugin, method: string, params: Record<string, unknown>) => Promise<TestResult>;
  /** Test history */
  testHistory?: TestResult[];
  /** Whether tests are running */
  isRunning?: boolean;
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
 * Check circle icon.
 */
const CheckCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

/**
 * X circle icon.
 */
const XCircleIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <line x1="15" y1="9" x2="9" y2="15" />
    <line x1="9" y1="9" x2="15" y2="15" />
  </svg>
);

/**
 * Clock icon.
 */
const ClockIcon: React.FC<{ className?: string }> = ({ className }) => (
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
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

/**
 * Contract badge colors.
 */
const contractColors: Record<string, string> = {
  tts: "bg-primary-100 text-primary-700",
  stt: "bg-success-50 text-success-700",
  llm: "bg-warning-50 text-warning-700",
  mcp: "bg-info-50 text-info-700",
  vision: "bg-purple-50 text-purple-700",
  embedding: "bg-cyan-50 text-cyan-700",
  debug: "bg-neutral-100 text-neutral-700",
};

/**
 * PluginTester component.
 *
 * Test harness for interactively testing plugin methods. Allows selecting
 * plugins, invoking methods with parameters, and viewing results.
 *
 * @example
 * ```tsx
 * <PluginTester
 *   plugins={availablePlugins}
 *   selectedPluginId={selectedId}
 *   onSelectPlugin={(plugin) => setSelectedId(plugin.id)}
 *   onExecuteTest={async (plugin, method, params) => {
 *     return await invokePlugin(plugin.id, method, params);
 *   }}
 * />
 * ```
 */
export const PluginTester: React.FC<PluginTesterProps> = ({
  plugins,
  selectedPluginId,
  onSelectPlugin,
  onExecuteTest,
  testHistory = [],
  isRunning = false,
  className = "",
  ...props
}) => {
  // Selected method
  const [selectedMethod, setSelectedMethod] = useState<string>("");

  // Parameter values
  const [paramValues, setParamValues] = useState<Record<string, unknown>>({});

  // Local test results
  const [localResults, setLocalResults] = useState<TestResult[]>([]);

  // Selected plugin
  const selectedPlugin = useMemo(
    () => plugins.find((p) => p.id === selectedPluginId),
    [plugins, selectedPluginId]
  );

  // Selected method info
  const selectedMethodInfo = useMemo(
    () => selectedPlugin?.methods.find((m) => m.name === selectedMethod),
    [selectedPlugin, selectedMethod]
  );

  // All test results (local + history)
  const allResults = useMemo(
    () => [...localResults, ...testHistory].slice(0, 50),
    [localResults, testHistory]
  );

  // Handle plugin selection
  const handlePluginSelect = useCallback(
    (plugin: TestablePlugin) => {
      onSelectPlugin?.(plugin);
      setSelectedMethod("");
      setParamValues({});
    },
    [onSelectPlugin]
  );

  // Handle method selection
  const handleMethodSelect = useCallback(
    (methodName: string) => {
      setSelectedMethod(methodName);
      // Initialize param values with defaults
      const method = selectedPlugin?.methods.find((m) => m.name === methodName);
      if (method) {
        const defaults: Record<string, unknown> = {};
        method.params.forEach((param) => {
          if (param.default !== undefined) {
            defaults[param.name] = param.default;
          }
        });
        setParamValues(defaults);
      }
    },
    [selectedPlugin]
  );

  // Handle param change
  const handleParamChange = useCallback((name: string, value: unknown) => {
    setParamValues((prev) => ({ ...prev, [name]: value }));
  }, []);

  // Handle test execution
  const handleExecuteTest = useCallback(async () => {
    if (!selectedPlugin || !selectedMethod || !onExecuteTest) return;

    const result = await onExecuteTest(selectedPlugin, selectedMethod, paramValues);
    setLocalResults((prev) => [result, ...prev]);
  }, [selectedPlugin, selectedMethod, paramValues, onExecuteTest]);

  // Container styles
  const containerStyles = [
    "flex",
    "flex-col",
    "lg:flex-row",
    "gap-4",
    "h-full",
    className,
  ].filter(Boolean).join(" ");

  // Panel styles
  const panelStyles = [
    "bg-white",
    "rounded-lg",
    "border",
    "border-neutral-200",
    "overflow-hidden",
  ].join(" ");

  return (
    <div className={containerStyles} {...props}>
      {/* Plugin selector sidebar */}
      <div className={[panelStyles, "w-full lg:w-72 shrink-0"].join(" ")}>
        <div className="p-4 border-b border-neutral-200 bg-neutral-50">
          <h3 className="text-sm font-semibold text-neutral-900">Plugins</h3>
          <p className="mt-1 text-xs text-neutral-500">
            Select a plugin to test
          </p>
        </div>
        <div className="max-h-96 overflow-y-auto">
          {plugins.length === 0 ? (
            <div className="p-6 text-center text-sm text-neutral-500">
              No plugins available
            </div>
          ) : (
            <ul className="divide-y divide-neutral-100">
              {plugins.map((plugin) => (
                <li key={plugin.id}>
                  <button
                    type="button"
                    onClick={() => handlePluginSelect(plugin)}
                    disabled={plugin.status !== "loaded"}
                    className={[
                      "w-full",
                      "p-3",
                      "text-left",
                      "transition-colors",
                      "duration-150",
                      selectedPluginId === plugin.id
                        ? "bg-primary-50"
                        : "hover:bg-neutral-50",
                      plugin.status !== "loaded" && "opacity-50 cursor-not-allowed",
                    ].filter(Boolean).join(" ")}
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-neutral-900">
                        {plugin.displayName}
                      </span>
                      <span
                        className={[
                          "px-1.5",
                          "py-0.5",
                          "text-xs",
                          "font-medium",
                          "rounded",
                          contractColors[plugin.contract] || contractColors.debug,
                        ].join(" ")}
                      >
                        {plugin.contract.toUpperCase()}
                      </span>
                    </div>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="text-xs text-neutral-500">v{plugin.version}</span>
                      <span
                        className={[
                          "inline-flex",
                          "h-1.5",
                          "w-1.5",
                          "rounded-full",
                          plugin.status === "loaded" && "bg-success-500",
                          plugin.status === "unloaded" && "bg-neutral-400",
                          plugin.status === "error" && "bg-error-500",
                          plugin.status === "loading" && "bg-warning-500 animate-pulse",
                        ].filter(Boolean).join(" ")}
                      />
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Method tester */}
      <div className={[panelStyles, "flex-1 flex flex-col"].join(" ")}>
        {!selectedPlugin ? (
          <div className="flex-1 flex items-center justify-center p-6">
            <div className="text-center">
              <PlayIcon className="mx-auto h-12 w-12 text-neutral-300" />
              <p className="mt-2 text-sm text-neutral-500">
                Select a plugin to start testing
              </p>
            </div>
          </div>
        ) : (
          <>
            {/* Method selector */}
            <div className="p-4 border-b border-neutral-200 bg-neutral-50">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-neutral-900">
                  {selectedPlugin.displayName}
                </h3>
                <span className="text-xs text-neutral-500">
                  {selectedPlugin.methods.length} methods
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selectedPlugin.methods.map((method) => (
                  <button
                    key={method.name}
                    type="button"
                    onClick={() => handleMethodSelect(method.name)}
                    className={[
                      "px-3",
                      "py-1.5",
                      "text-sm",
                      "font-medium",
                      "rounded-md",
                      "border",
                      "transition-colors",
                      "duration-150",
                      selectedMethod === method.name
                        ? "bg-primary-100 border-primary-300 text-primary-700"
                        : "bg-white border-neutral-200 text-neutral-700 hover:border-neutral-300",
                      method.required && "ring-1 ring-primary-200",
                    ].filter(Boolean).join(" ")}
                  >
                    {method.name}()
                  </button>
                ))}
              </div>
            </div>

            {/* Parameter editor */}
            {selectedMethodInfo && (
              <div className="p-4 border-b border-neutral-200">
                <h4 className="text-sm font-medium text-neutral-700 mb-3">
                  Parameters
                </h4>
                {selectedMethodInfo.params.length === 0 ? (
                  <p className="text-sm text-neutral-500 italic">
                    No parameters required
                  </p>
                ) : (
                  <div className="space-y-3">
                    {selectedMethodInfo.params.map((param) => (
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
                        {param.type === "str" || param.type === "string" ? (
                          <textarea
                            value={String(paramValues[param.name] ?? "")}
                            onChange={(e) => handleParamChange(param.name, e.target.value)}
                            placeholder={param.description || `Enter ${param.name}`}
                            rows={2}
                            className={[
                              "w-full",
                              "px-3",
                              "py-2",
                              "text-sm",
                              "bg-white",
                              "border",
                              "border-neutral-300",
                              "rounded-md",
                              "focus:outline-none",
                              "focus:ring-2",
                              "focus:ring-primary-500",
                            ].join(" ")}
                          />
                        ) : param.type === "dict" || param.type === "object" ? (
                          <textarea
                            value={
                              typeof paramValues[param.name] === "object"
                                ? JSON.stringify(paramValues[param.name], null, 2)
                                : String(paramValues[param.name] ?? "{}")
                            }
                            onChange={(e) => {
                              try {
                                handleParamChange(param.name, JSON.parse(e.target.value));
                              } catch {
                                // Keep as string if invalid JSON
                              }
                            }}
                            placeholder='{"key": "value"}'
                            rows={3}
                            className={[
                              "w-full",
                              "px-3",
                              "py-2",
                              "text-sm",
                              "font-mono",
                              "bg-white",
                              "border",
                              "border-neutral-300",
                              "rounded-md",
                              "focus:outline-none",
                              "focus:ring-2",
                              "focus:ring-primary-500",
                            ].join(" ")}
                          />
                        ) : (
                          <input
                            type={param.type === "int" || param.type === "float" ? "number" : "text"}
                            value={String(paramValues[param.name] ?? "")}
                            onChange={(e) => {
                              const val = param.type === "int"
                                ? parseInt(e.target.value, 10)
                                : param.type === "float"
                                  ? parseFloat(e.target.value)
                                  : e.target.value;
                              handleParamChange(param.name, val);
                            }}
                            placeholder={param.description}
                            className={[
                              "w-full",
                              "px-3",
                              "py-2",
                              "text-sm",
                              "bg-white",
                              "border",
                              "border-neutral-300",
                              "rounded-md",
                              "focus:outline-none",
                              "focus:ring-2",
                              "focus:ring-primary-500",
                            ].join(" ")}
                          />
                        )}
                        {param.description && (
                          <p className="mt-1 text-xs text-neutral-500">
                            {param.description}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}

                {/* Execute button */}
                <button
                  type="button"
                  onClick={handleExecuteTest}
                  disabled={isRunning || !onExecuteTest}
                  className={[
                    "mt-4",
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
                  {isRunning ? (
                    <>
                      <div className="h-4 w-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                      Running...
                    </>
                  ) : (
                    <>
                      <PlayIcon className="h-4 w-4" />
                      Execute
                    </>
                  )}
                </button>
              </div>
            )}

            {/* Results area */}
            <div className="flex-1 overflow-y-auto">
              <div className="p-4">
                <h4 className="text-sm font-medium text-neutral-700 mb-3">
                  Test Results ({allResults.length})
                </h4>
                {allResults.length === 0 ? (
                  <p className="text-sm text-neutral-500 italic">
                    No test results yet
                  </p>
                ) : (
                  <div className="space-y-3">
                    {allResults.map((result, index) => (
                      <div
                        key={index}
                        className={[
                          "p-3",
                          "rounded-lg",
                          "border",
                          result.success
                            ? "bg-success-50 border-success-200"
                            : "bg-error-50 border-error-200",
                        ].join(" ")}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            {result.success ? (
                              <CheckCircleIcon className="h-4 w-4 text-success-600" />
                            ) : (
                              <XCircleIcon className="h-4 w-4 text-error-600" />
                            )}
                            <span className="text-sm font-medium">
                              {result.method}()
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-neutral-500">
                            <ClockIcon className="h-3.5 w-3.5" />
                            {result.duration}ms
                          </div>
                        </div>

                        {result.error && (
                          <p className="mt-2 text-sm text-error-700">
                            {result.error}
                          </p>
                        )}

                        {result.response !== undefined && (
                          <pre className="mt-2 p-2 bg-white rounded text-xs font-mono overflow-x-auto">
                            {JSON.stringify(result.response, null, 2) ?? ""}
                          </pre>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

PluginTester.displayName = "PluginTester";

export default PluginTester;
