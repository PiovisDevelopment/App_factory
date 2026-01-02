/**
 * PluginConfigPanel - Plugin Configuration Editor
 * =================================================
 * Displays and allows editing of plugin configuration options.
 * Shows when a plugin is selected from the Blueprint panel or plugin gallery.
 *
 * Features:
 * - Display plugin name, version, and contract type
 * - Render configuration options based on PluginConfigOption type
 * - Support input types: string, number, boolean, select, path
 * - Show description/help text for each option
 * - Apply and Reset to defaults buttons
 */

import React, { useState, useCallback, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface PluginConfigOption {
    /** Option key */
    key: string;
    /** Display label */
    label: string;
    /** Option type */
    type: 'string' | 'number' | 'boolean' | 'select' | 'path';
    /** Current value */
    value: unknown;
    /** Default value */
    defaultValue: unknown;
    /** Description/help text */
    description?: string;
    /** Options for select type */
    options?: Array<{ value: string; label: string }>;
    /** Validation constraints */
    validation?: {
        min?: number;
        max?: number;
        pattern?: string;
        required?: boolean;
    };
}

export interface PluginConfigInfo {
    id: string;
    name: string;
    version: string;
    contract: string;
    description?: string;
    config: PluginConfigOption[];
}

export interface PluginConfigPanelProps {
    /** Plugin to configure */
    plugin: PluginConfigInfo | null;
    /** Callback when config value changes */
    onChange?: (key: string, value: unknown) => void;
    /** Callback when all config is applied */
    onApply?: (config: Record<string, unknown>) => void;
    /** Callback to reset all values to defaults */
    onReset?: () => void;
    /** Callback to close/deselect plugin */
    onClose?: () => void;
    /** Whether the panel is read-only */
    readOnly?: boolean;
    /** Additional CSS classes */
    className?: string;
}

// ============================================================================
// ICONS
// ============================================================================

const PluginIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path d="M13 10V3L4 14h7v7l9-11h-7z" />
    </svg>
);

const CloseIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path d="M6 18L18 6M6 6l12 12" />
    </svg>
);

const RefreshIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth="2">
        <path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
    </svg>
);

// ============================================================================
// CONTRACT COLORS
// ============================================================================

const contractColors: Record<string, string> = {
    llm: 'bg-blue-100 text-blue-700 border-blue-200',
    tts: 'bg-purple-100 text-purple-700 border-purple-200',
    stt: 'bg-green-100 text-green-700 border-green-200',
    memory: 'bg-amber-100 text-amber-700 border-amber-200',
    database: 'bg-cyan-100 text-cyan-700 border-cyan-200',
    default: 'bg-neutral-100 text-neutral-700 border-neutral-200',
};

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const PluginConfigPanel: React.FC<PluginConfigPanelProps> = ({
    plugin,
    onChange,
    onApply,
    onReset,
    onClose,
    readOnly = false,
    className = '',
}) => {
    // Track local changes before applying
    const [localValues, setLocalValues] = useState<Record<string, unknown>>({});
    const [hasChanges, setHasChanges] = useState(false);

    // Initialize local values from plugin config
    const currentValues = useMemo(() => {
        if (!plugin) return {};
        const values: Record<string, unknown> = {};
        plugin.config.forEach((opt) => {
            values[opt.key] = localValues[opt.key] ?? opt.value;
        });
        return values;
    }, [plugin, localValues]);

    // Handle value change
    const handleChange = useCallback((key: string, value: unknown) => {
        setLocalValues((prev) => ({ ...prev, [key]: value }));
        setHasChanges(true);
        onChange?.(key, value);
    }, [onChange]);

    // Handle apply all
    const handleApply = useCallback(() => {
        if (!plugin) return;
        onApply?.(currentValues);
        setHasChanges(false);
    }, [plugin, currentValues, onApply]);

    // Handle reset to defaults
    const handleReset = useCallback(() => {
        if (!plugin) return;
        const defaults: Record<string, unknown> = {};
        plugin.config.forEach((opt) => {
            defaults[opt.key] = opt.defaultValue;
        });
        setLocalValues(defaults);
        setHasChanges(true);
        onReset?.();
    }, [plugin, onReset]);

    // Get contract color
    const getContractColor = (contract: string) => {
        return contractColors[contract.toLowerCase()] || contractColors.default;
    };

    // Render empty state
    if (!plugin) {
        return (
            <div className={`flex flex-col items-center justify-center h-full p-6 text-center ${className}`}>
                <div className="w-16 h-16 rounded-full bg-neutral-100 flex items-center justify-center mb-4">
                    <PluginIcon className="w-8 h-8 text-neutral-400" />
                </div>
                <p className="text-sm text-neutral-500">Select a plugin to view its configuration</p>
                <p className="text-xs text-neutral-400 mt-1">Click on a plugin slot in the Blueprint panel</p>
            </div>
        );
    }

    // Render config option input based on type
    const renderInput = (option: PluginConfigOption) => {
        const value = currentValues[option.key];

        switch (option.type) {
            case 'boolean':
                return (
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input
                            type="checkbox"
                            checked={Boolean(value)}
                            onChange={(e) => handleChange(option.key, e.target.checked)}
                            disabled={readOnly}
                            className="sr-only peer"
                        />
                        <div className="w-9 h-5 bg-neutral-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-primary-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-neutral-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-primary-500" />
                    </label>
                );

            case 'select':
                return (
                    <select
                        value={String(value)}
                        onChange={(e) => handleChange(option.key, e.target.value)}
                        disabled={readOnly}
                        className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                    >
                        {option.options?.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                );

            case 'number':
                return (
                    <input
                        type="number"
                        value={Number(value) || 0}
                        onChange={(e) => handleChange(option.key, parseFloat(e.target.value))}
                        disabled={readOnly}
                        min={option.validation?.min}
                        max={option.validation?.max}
                        step={option.validation?.min !== undefined && option.validation.min < 1 ? 0.1 : 1}
                        className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                    />
                );

            case 'path':
                return (
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={String(value || '')}
                            onChange={(e) => handleChange(option.key, e.target.value)}
                            disabled={readOnly}
                            placeholder="Enter path..."
                            className="flex-1 px-3 py-1.5 text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed font-mono text-xs"
                        />
                        <button
                            type="button"
                            disabled={readOnly}
                            className="px-2 py-1.5 text-xs bg-neutral-100 border border-neutral-300 rounded-md hover:bg-neutral-200 disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Browse..."
                        >
                            📁
                        </button>
                    </div>
                );

            case 'string':
            default:
                return (
                    <input
                        type="text"
                        value={String(value || '')}
                        onChange={(e) => handleChange(option.key, e.target.value)}
                        disabled={readOnly}
                        placeholder={`Enter ${option.label.toLowerCase()}...`}
                        className="w-full px-3 py-1.5 text-sm border border-neutral-300 rounded-md bg-white focus:outline-none focus:ring-2 focus:ring-primary-300 focus:border-primary-500 disabled:bg-neutral-100 disabled:cursor-not-allowed"
                    />
                );
        }
    };

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Header */}
            <div className="p-3 border-b border-neutral-200 bg-neutral-50">
                <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                            <h3 className="text-sm font-semibold text-neutral-800 truncate">{plugin.name}</h3>
                            <span className={`px-1.5 py-0.5 text-[10px] font-medium rounded border ${getContractColor(plugin.contract)}`}>
                                {plugin.contract.toUpperCase()}
                            </span>
                        </div>
                        <p className="text-xs text-neutral-500 mt-0.5">v{plugin.version}</p>
                    </div>
                    {onClose && (
                        <button
                            type="button"
                            onClick={onClose}
                            className="p-1 rounded hover:bg-neutral-200 transition-colors"
                            title="Close"
                        >
                            <CloseIcon className="w-4 h-4 text-neutral-500" />
                        </button>
                    )}
                </div>
                {plugin.description && (
                    <p className="text-xs text-neutral-600 mt-2 line-clamp-2">{plugin.description}</p>
                )}
            </div>

            {/* Configuration Options */}
            <div className="flex-1 overflow-auto p-3">
                {plugin.config.length === 0 ? (
                    <div className="text-center py-8 text-neutral-400">
                        <p className="text-sm">No configuration options available</p>
                        <p className="text-xs mt-1">This plugin uses default settings</p>
                    </div>
                ) : (
                    <div className="space-y-4">
                        {plugin.config.map((option) => (
                            <div key={option.key} className="space-y-1.5">
                                <div className="flex items-center justify-between">
                                    <label className="text-xs font-medium text-neutral-700">
                                        {option.label}
                                        {option.validation?.required && (
                                            <span className="text-red-500 ml-0.5">*</span>
                                        )}
                                    </label>
                                    {option.type === 'boolean' && renderInput(option)}
                                </div>
                                {option.type !== 'boolean' && renderInput(option)}
                                {option.description && (
                                    <p className="text-[10px] text-neutral-500">{option.description}</p>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* Footer Actions */}
            {!readOnly && plugin.config.length > 0 && (
                <div className="p-3 border-t border-neutral-200 bg-neutral-50 space-y-2">
                    <div className="flex gap-2">
                        <button
                            type="button"
                            onClick={handleApply}
                            disabled={!hasChanges}
                            className="flex-1 px-3 py-1.5 text-xs font-medium bg-primary-500 text-white rounded-md hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            Apply Changes
                        </button>
                        <button
                            type="button"
                            onClick={handleReset}
                            className="px-3 py-1.5 text-xs font-medium bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 transition-colors flex items-center gap-1"
                            title="Reset to defaults"
                        >
                            <RefreshIcon className="w-3 h-3" />
                            Reset
                        </button>
                    </div>
                    {hasChanges && (
                        <p className="text-[10px] text-amber-600 text-center">
                            You have unsaved changes
                        </p>
                    )}
                </div>
            )}
        </div>
    );
};

PluginConfigPanel.displayName = 'PluginConfigPanel';

export default PluginConfigPanel;
