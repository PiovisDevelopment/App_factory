/**
 * D073 - src/components/ai/FixSuggestions.tsx
 * ============================================
 * AI-powered fix suggestions for errors and issues.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D006, D007, D010, D014, D015
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 */

import React, { useState, useCallback } from "react";
import { Button } from "../ui/Button";
import { Panel } from "../ui/Panel";

/**
 * Severity levels for issues.
 */
export type IssueSeverity = "error" | "warning" | "info" | "hint";

/**
 * Issue structure that needs fixing.
 */
export interface Issue {
  /** Unique issue identifier */
  id: string;
  /** Issue title/summary */
  title: string;
  /** Detailed description */
  description: string;
  /** Issue severity */
  severity: IssueSeverity;
  /** File where issue occurred */
  file?: string;
  /** Line number */
  line?: number;
  /** Column number */
  column?: number;
  /** Error code (if applicable) */
  code?: string;
  /** Original error message */
  originalMessage?: string;
}

/**
 * Suggested fix structure.
 */
export interface FixSuggestion {
  /** Unique suggestion identifier */
  id: string;
  /** Related issue ID */
  issueId: string;
  /** Fix title */
  title: string;
  /** Detailed explanation of the fix */
  explanation: string;
  /** Confidence level (0-100) */
  confidence: number;
  /** Code diff or patch */
  diff?: string;
  /** Whether this fix can be auto-applied */
  autoApplicable: boolean;
  /** Potential side effects */
  sideEffects?: string[];
  /** Resources or documentation links */
  resources?: { title: string; url: string }[];
}

/**
 * Fix suggestions props.
 */
export interface FixSuggestionsProps {
  /** Array of issues to display fixes for */
  issues: Issue[];
  /** Callback to get AI-generated fix suggestions */
  onGetSuggestions: (issue: Issue) => Promise<FixSuggestion[]>;
  /** Callback when user applies a fix */
  onApplyFix?: (suggestion: FixSuggestion) => Promise<void>;
  /** Callback when user dismisses an issue */
  onDismissIssue?: (issue: Issue) => void;
  /** Whether suggestions are loading */
  isLoading?: boolean;
  /** Custom className */
  className?: string;
}

/**
 * Severity icon component.
 */
const SeverityIcon: React.FC<{ severity: IssueSeverity }> = ({ severity }) => {
  const iconColors = {
    error: "text-error-500",
    warning: "text-warning-500",
    info: "text-info-500",
    hint: "text-neutral-500",
  };

  const baseClass = `h-5 w-5 ${iconColors[severity]}`;

  switch (severity) {
    case "error":
      return (
        <svg
          className={baseClass}
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
          <line x1="15" y1="9" x2="9" y2="15" />
          <line x1="9" y1="9" x2="15" y2="15" />
        </svg>
      );
    case "warning":
      return (
        <svg
          className={baseClass}
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
          <line x1="12" y1="9" x2="12" y2="13" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
    case "info":
      return (
        <svg
          className={baseClass}
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
    default:
      return (
        <svg
          className={baseClass}
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
          <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" />
          <line x1="12" y1="17" x2="12.01" y2="17" />
        </svg>
      );
  }
};

/**
 * Lightbulb icon.
 */
const LightbulbIcon: React.FC = () => (
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
    <line x1="9" y1="18" x2="15" y2="18" />
    <line x1="10" y1="22" x2="14" y2="22" />
    <path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14" />
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
 * External link icon.
 */
const ExternalLinkIcon: React.FC = () => (
  <svg
    className="h-3 w-3"
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
    <polyline points="15 3 21 3 21 9" />
    <line x1="10" y1="14" x2="21" y2="3" />
  </svg>
);

/**
 * X icon for dismiss.
 */
const XIcon: React.FC = () => (
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
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

/**
 * Confidence indicator component.
 */
const ConfidenceIndicator: React.FC<{ confidence: number }> = ({ confidence }) => {
  const getColor = () => {
    if (confidence >= 80) return "bg-success-500";
    if (confidence >= 50) return "bg-warning-500";
    return "bg-error-500";
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 bg-neutral-200 rounded-full overflow-hidden">
        <div
          className={`h-full ${getColor()} rounded-full transition-all duration-300`}
          style={{ width: `${confidence}%` }}
        />
      </div>
      <span className="text-xs text-neutral-600 w-10 text-right">{confidence}%</span>
    </div>
  );
};

/**
 * Diff viewer component.
 */
const DiffViewer: React.FC<{ diff: string }> = ({ diff }) => {
  const lines = diff.split("\n");

  return (
    <div className="bg-neutral-900 rounded-lg overflow-hidden">
      <div className="px-4 py-2 bg-neutral-800 border-b border-neutral-700">
        <span className="text-xs text-neutral-400 uppercase tracking-wide">
          Suggested Changes
        </span>
      </div>
      <pre className="p-4 overflow-x-auto text-sm font-mono">
        {lines.map((line, index) => {
          let lineClass = "text-neutral-300";
          if (line.startsWith("+") && !line.startsWith("+++")) {
            lineClass = "text-success-400 bg-success-900/30";
          } else if (line.startsWith("-") && !line.startsWith("---")) {
            lineClass = "text-error-400 bg-error-900/30";
          } else if (line.startsWith("@@")) {
            lineClass = "text-info-400";
          }
          return (
            <div key={index} className={`${lineClass} px-2 -mx-2`}>
              {line}
            </div>
          );
        })}
      </pre>
    </div>
  );
};

/**
 * Single suggestion card component.
 */
const SuggestionCard: React.FC<{
  suggestion: FixSuggestion;
  onApply?: () => void;
  isApplying?: boolean;
}> = ({ suggestion, onApply, isApplying }) => {
  const [showDiff, setShowDiff] = useState(false);

  return (
    <div className="border border-neutral-200 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-3">
          <span className="text-primary-500 mt-0.5">
            <LightbulbIcon />
          </span>
          <div>
            <h4 className="text-sm font-medium text-neutral-900">
              {suggestion.title}
            </h4>
            <p className="text-sm text-neutral-600 mt-1">
              {suggestion.explanation}
            </p>
          </div>
        </div>
        {suggestion.autoApplicable && onApply && (
          <Button
            variant="primary"
            size="sm"
            onClick={onApply}
            loading={!!isApplying}
            leftIcon={<CheckIcon />}
          >
            Apply
          </Button>
        )}
      </div>

      {/* Confidence */}
      <div className="pl-7">
        <span className="text-xs text-neutral-500 block mb-1">Confidence</span>
        <ConfidenceIndicator confidence={suggestion.confidence} />
      </div>

      {/* Side effects warning */}
      {suggestion.sideEffects && suggestion.sideEffects.length > 0 && (
        <div className="pl-7">
          <div className="p-3 bg-warning-50 border border-warning-200 rounded-lg">
            <span className="text-xs font-medium text-warning-700 block mb-1">
              Potential Side Effects
            </span>
            <ul className="text-sm text-warning-600 list-disc list-inside">
              {suggestion.sideEffects.map((effect, index) => (
                <li key={index}>{effect}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {/* Diff preview toggle */}
      {suggestion.diff && (
        <div className="pl-7">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setShowDiff(!showDiff)}
          >
            {showDiff ? "Hide" : "Show"} Changes
          </Button>
          {showDiff && (
            <div className="mt-3">
              <DiffViewer diff={suggestion.diff} />
            </div>
          )}
        </div>
      )}

      {/* Resources */}
      {suggestion.resources && suggestion.resources.length > 0 && (
        <div className="pl-7">
          <span className="text-xs text-neutral-500 block mb-2">
            Related Resources
          </span>
          <div className="flex flex-wrap gap-2">
            {suggestion.resources.map((resource, index) => (
              <a
                key={index}
                href={resource.url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs text-primary-600 hover:text-primary-700 hover:underline"
              >
                {resource.title}
                <ExternalLinkIcon />
              </a>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Issue card with expandable suggestions.
 */
const IssueCard: React.FC<{
  issue: Issue;
  onGetSuggestions: () => Promise<FixSuggestion[]>;
  onApplyFix?: (suggestion: FixSuggestion) => Promise<void>;
  onDismiss?: () => void;
}> = ({ issue, onGetSuggestions, onApplyFix, onDismiss }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [suggestions, setSuggestions] = useState<FixSuggestion[]>([]);
  const [isLoadingSuggestions, setIsLoadingSuggestions] = useState(false);
  const [applyingId, setApplyingId] = useState<string | null>(null);

  const handleExpand = useCallback(async () => {
    if (!isExpanded && suggestions.length === 0) {
      setIsLoadingSuggestions(true);
      try {
        const result = await onGetSuggestions();
        setSuggestions(result);
      } catch (err) {
        console.error("Failed to get suggestions:", err);
      } finally {
        setIsLoadingSuggestions(false);
      }
    }
    setIsExpanded(!isExpanded);
  }, [isExpanded, suggestions.length, onGetSuggestions]);

  const handleApply = useCallback(
    async (suggestion: FixSuggestion) => {
      if (!onApplyFix) return;
      setApplyingId(suggestion.id);
      try {
        await onApplyFix(suggestion);
      } finally {
        setApplyingId(null);
      }
    },
    [onApplyFix]
  );

  const severityBg = {
    error: "border-l-error-500 bg-error-50/50",
    warning: "border-l-warning-500 bg-warning-50/50",
    info: "border-l-info-500 bg-info-50/50",
    hint: "border-l-neutral-400 bg-neutral-50",
  };

  return (
    <div
      className={`border-l-4 rounded-lg overflow-hidden ${severityBg[issue.severity]}`}
    >
      {/* Issue header */}
      <div className="p-4">
        <div className="flex items-start justify-between">
          <div className="flex items-start gap-3">
            <SeverityIcon severity={issue.severity} />
            <div className="flex-1 min-w-0">
              <h3 className="text-sm font-semibold text-neutral-900">
                {issue.title}
              </h3>
              <p className="text-sm text-neutral-600 mt-0.5">
                {issue.description}
              </p>
              {issue.file && (
                <p className="text-xs text-neutral-500 mt-1 font-mono">
                  {issue.file}
                  {issue.line && `:${issue.line}`}
                  {issue.column && `:${issue.column}`}
                </p>
              )}
              {issue.code && (
                <span className="inline-block mt-1 px-2 py-0.5 bg-neutral-200 rounded text-xs font-mono text-neutral-700">
                  {issue.code}
                </span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={handleExpand}
              leftIcon={<LightbulbIcon />}
            >
              {isExpanded ? "Hide" : "Get"} Suggestions
            </Button>
            {onDismiss && (
              <Button
                variant="ghost"
                size="sm"
                iconOnly
                onClick={onDismiss}
                aria-label="Dismiss issue"
              >
                <XIcon />
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Suggestions panel */}
      {isExpanded && (
        <div className="border-t border-neutral-200 bg-white p-4">
          {isLoadingSuggestions ? (
            <div className="flex items-center justify-center py-8">
              <div className="flex items-center gap-2 text-neutral-500">
                <div className="w-5 h-5 border-2 border-neutral-300 border-t-primary-500 rounded-full animate-spin" />
                <span className="text-sm">Getting AI suggestions...</span>
              </div>
            </div>
          ) : suggestions.length === 0 ? (
            <div className="text-center py-6 text-neutral-500">
              <LightbulbIcon />
              <p className="text-sm mt-2">No suggestions available</p>
            </div>
          ) : (
            <div className="space-y-4">
              {suggestions.map((suggestion) => (
                <SuggestionCard
                  key={suggestion.id}
                  suggestion={suggestion}
                  {...(onApplyFix && suggestion.autoApplicable
                    ? { onApply: () => handleApply(suggestion) }
                    : {})}
                  isApplying={applyingId === suggestion.id}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * FixSuggestions component.
 *
 * Displays a list of issues with AI-powered fix suggestions. Users can
 * expand issues to see suggestions, view diffs, and apply fixes.
 *
 * @example
 * ```tsx
 * const issues = [
 *   {
 *     id: "1",
 *     title: "Missing required parameter",
 *     description: "Function 'synthesize' is missing required parameter 'voice_id'",
 *     severity: "error",
 *     file: "plugins/tts_kokoro/plugin.py",
 *     line: 42,
 *   },
 * ];
 *
 * <FixSuggestions
 *   issues={issues}
 *   onGetSuggestions={async (issue) => {
 *     return await aiService.getSuggestions(issue);
 *   }}
 *   onApplyFix={async (suggestion) => {
 *     await applyPatch(suggestion.diff);
 *   }}
 * />
 * ```
 */
export const FixSuggestions: React.FC<FixSuggestionsProps> = ({
  issues,
  onGetSuggestions,
  onApplyFix,
  onDismissIssue,
  isLoading = false,
  className = "",
}) => {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  const visibleIssues = issues.filter((issue) => !dismissedIds.has(issue.id));

  const handleDismiss = useCallback(
    (issue: Issue) => {
      setDismissedIds((prev) => new Set([...prev, issue.id]));
      onDismissIssue?.(issue);
    },
    [onDismissIssue]
  );

  const containerStyles = ["space-y-4", className].filter(Boolean).join(" ");

  // Group issues by severity
  const errorIssues = visibleIssues.filter((i) => i.severity === "error");
  const warningIssues = visibleIssues.filter((i) => i.severity === "warning");
  const infoIssues = visibleIssues.filter((i) => i.severity === "info");
  const hintIssues = visibleIssues.filter((i) => i.severity === "hint");

  if (visibleIssues.length === 0) {
    return (
      <Panel variant="default" padding="lg" radius="lg" className={className}>
        <div className="text-center py-8">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-success-100 text-success-600 mb-3">
            <CheckIcon />
          </div>
          <h3 className="text-lg font-semibold text-neutral-900">
            No Issues Found
          </h3>
          <p className="text-sm text-neutral-500 mt-1">
            Everything looks good! No issues to fix.
          </p>
        </div>
      </Panel>
    );
  }

  return (
    <div className={containerStyles}>
      {/* Summary header */}
      <Panel variant="default" padding="md" radius="lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h2 className="text-lg font-semibold text-neutral-900">
              Issues ({visibleIssues.length})
            </h2>
            <div className="flex items-center gap-3 text-sm">
              {errorIssues.length > 0 && (
                <span className="text-error-600">
                  {errorIssues.length} error{errorIssues.length !== 1 ? "s" : ""}
                </span>
              )}
              {warningIssues.length > 0 && (
                <span className="text-warning-600">
                  {warningIssues.length} warning{warningIssues.length !== 1 ? "s" : ""}
                </span>
              )}
              {infoIssues.length > 0 && (
                <span className="text-info-600">
                  {infoIssues.length} info
                </span>
              )}
              {hintIssues.length > 0 && (
                <span className="text-neutral-500">
                  {hintIssues.length} hint{hintIssues.length !== 1 ? "s" : ""}
                </span>
              )}
            </div>
          </div>
          {isLoading && (
            <div className="flex items-center gap-2 text-neutral-500">
              <div className="w-4 h-4 border-2 border-neutral-300 border-t-primary-500 rounded-full animate-spin" />
              <span className="text-sm">Analyzing...</span>
            </div>
          )}
        </div>
      </Panel>

      {/* Issues list */}
      <div className="space-y-3">
        {visibleIssues.map((issue) => (
          <IssueCard
            key={issue.id}
            issue={issue}
            onGetSuggestions={() => onGetSuggestions(issue)}
            {...(onApplyFix ? { onApplyFix } : {})}
            {...(onDismissIssue ? { onDismiss: () => handleDismiss(issue) } : {})}
          />
        ))}
      </div>
    </div>
  );
};

FixSuggestions.displayName = "FixSuggestions";

export default FixSuggestions;
