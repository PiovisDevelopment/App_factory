/**
 * SettingsPanel.tsx
 * =================
 * Slide-over panel for application settings.
 * 
 * Hierarchical structure: Category → Provider → Configuration
 * Uses SchemaForm for dynamic plugin configuration forms.
 */

import React, { useCallback, useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { ApiKeyManager } from './ApiKeyManager';
import { SchemaForm } from './SchemaForm';
import { CategoryEditModal } from './CategoryEditModal';
import { SchemaEditModal } from './SchemaEditModal';
import {
    useSettingsStore,
} from '../../stores/settingsStore';
import type { RJSFSchema } from '@rjsf/utils';

interface SettingsPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

/**
 * Check if running in Tauri environment.
 */
function isTauriEnv(): boolean {
    return typeof window !== 'undefined' &&
        '__TAURI__' in window &&
        typeof (window as unknown as { __TAURI_IPC__?: unknown }).__TAURI_IPC__ === 'function';
}

export const SettingsPanel: React.FC<SettingsPanelProps> = ({ isOpen, onClose }) => {
    // Store state
    const categories = useSettingsStore(s => s.categories);
    const providersByCategory = useSettingsStore(s => s.providersByCategory);
    const selectedCategory = useSettingsStore(s => s.selectedCategory);
    const selectedProviderByCategory = useSettingsStore(s => s.selectedProviderByCategory);
    const pluginConfigs = useSettingsStore(s => s.pluginConfigs);
    const configSchemas = useSettingsStore(s => s.configSchemas);
    const isLoadingSchema = useSettingsStore(s => s.isLoadingSchema);

    // Store actions
    const setSelectedCategory = useSettingsStore(s => s.setSelectedCategory);
    const setSelectedProvider = useSettingsStore(s => s.setSelectedProvider);
    const setPluginConfig = useSettingsStore(s => s.setPluginConfig);
    const setConfigSchema = useSettingsStore(s => s.setConfigSchema);
    const setIsLoadingSchema = useSettingsStore(s => s.setIsLoadingSchema);
    const getActivePluginId = useSettingsStore(s => s.getActivePluginId);

    // Local State
    const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
    const [isSchemaModalOpen, setIsSchemaModalOpen] = useState(false);

    // Get providers for current category
    const currentProviders = providersByCategory[selectedCategory] || [];
    const selectedProviderId = selectedProviderByCategory[selectedCategory] || '';
    const activePluginId = getActivePluginId();
    const currentSchema = activePluginId ? configSchemas[activePluginId] : null;
    const currentConfig = activePluginId ? (pluginConfigs[activePluginId] ?? {}) : {};


    // Fetch schema when plugin changes
    const fetchSchema = useCallback(async (pluginId: string) => {
        if (!isTauriEnv()) {
            console.warn('[SettingsPanel] Tauri not available, cannot fetch schema');
            return;
        }

        // Check if schema already exists
        if (configSchemas[pluginId]) {
            return;
        }

        setIsLoadingSchema(true);
        try {
            const schema = await invoke<RJSFSchema>('ipc_call', {
                method: 'plugin/get_config_schema',
                params: { plugin_id: pluginId },
            });
            setConfigSchema(pluginId, schema as Record<string, unknown>);
        } catch (err) {
            console.error('[SettingsPanel] Failed to fetch schema:', err);
        } finally {
            setIsLoadingSchema(false);
        }
    }, [configSchemas, setConfigSchema, setIsLoadingSchema]);

    // Fetch schema when active plugin changes
    useEffect(() => {
        if (activePluginId && isOpen) {
            fetchSchema(activePluginId);
        }
    }, [activePluginId, isOpen, fetchSchema]);

    // Handle category change
    const handleCategoryChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const category = e.target.value;
        setSelectedCategory(category);
    };

    // Handle provider change
    const handleProviderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const providerId = e.target.value;
        setSelectedProvider(selectedCategory, providerId);
    };

    // Handle config change
    const handleConfigChange = (data: Record<string, unknown>) => {
        if (activePluginId) {
            setPluginConfig(activePluginId, data);
        }
    };

    if (!isOpen) return null;

    return (
        <>
            {/* Backdrop */}
            <div
                className="fixed inset-0 bg-black/50 z-40 transition-opacity"
                onClick={onClose}
            />

            {/* Panel */}
            <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-xl z-50 flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-neutral-200">
                    <h2 className="text-lg font-semibold text-neutral-900">Settings</h2>
                    <button
                        type="button"
                        onClick={onClose}
                        className="p-2 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
                    >
                        <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
                    {/* Category & Provider Row */}
                    <div className="flex gap-3">
                        {/* Category Selector */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-1">
                                <label htmlFor="category" className="block text-sm font-medium text-neutral-700">
                                    Category
                                </label>
                                <button
                                    onClick={() => setIsCategoryModalOpen(true)}
                                    className="text-neutral-400 hover:text-primary-600 p-0.5 rounded transition-colors"
                                    title="Edit Categories"
                                >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                </button>
                            </div>
                            <select
                                id="category"
                                value={selectedCategory}
                                onChange={handleCategoryChange}
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 truncate max-w-[15ch]"
                            >
                                {Object.entries(categories).map(([id, label]) => (
                                    <option key={id} value={id}>
                                        {label}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Provider Selector */}
                        <div className="flex-1">
                            <label htmlFor="provider" className="block text-sm font-medium text-neutral-700 mb-1">
                                Provider
                            </label>
                            <select
                                id="provider"
                                value={selectedProviderId}
                                onChange={handleProviderChange}
                                className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-primary-500 truncate"
                            >
                                {currentProviders.map(provider => (
                                    <option key={provider.id} value={provider.id}>
                                        {provider.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Configuration Form */}
                    {activePluginId && (
                        <div className="border-t border-neutral-200 pt-4">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-sm font-medium text-neutral-700">
                                    Configuration
                                </h3>
                                <button
                                    onClick={() => setIsSchemaModalOpen(true)}
                                    className="text-neutral-400 hover:text-primary-600 p-0.5 rounded transition-colors"
                                    title="Edit Configuration Schema"
                                >
                                    <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                    </svg>
                                </button>
                            </div>
                            {currentSchema ? (
                                <SchemaForm
                                    schema={currentSchema as RJSFSchema}
                                    formData={currentConfig}
                                    onChange={handleConfigChange}
                                    isLoading={isLoadingSchema}
                                />
                            ) : isLoadingSchema ? (
                                <div className="flex items-center justify-center py-8">
                                    <div className="flex items-center gap-2 text-neutral-500 text-sm">
                                        <svg
                                            className="animate-spin h-4 w-4"
                                            xmlns="http://www.w3.org/2000/svg"
                                            fill="none"
                                            viewBox="0 0 24 24"
                                        >
                                            <circle
                                                className="opacity-25"
                                                cx="12"
                                                cy="12"
                                                r="10"
                                                stroke="currentColor"
                                                strokeWidth="4"
                                            />
                                            <path
                                                className="opacity-75"
                                                fill="currentColor"
                                                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                                            />
                                        </svg>
                                        <span>Loading schema...</span>
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-neutral-500 italic">
                                    No configuration schema available for this provider.
                                </p>
                            )}
                        </div>
                    )}

                    {/* API Keys Manager */}
                    <ApiKeyManager />
                </div>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-neutral-200 bg-neutral-50">
                    <button
                        type="button"
                        onClick={onClose}
                        className="w-full px-4 py-2 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 transition-colors"
                    >
                        Done
                    </button>
                </div>
            </div>

            {/* Modals */}
            <CategoryEditModal
                isOpen={isCategoryModalOpen}
                onClose={() => setIsCategoryModalOpen(false)}
            />
            {activePluginId && (
                <SchemaEditModal
                    isOpen={isSchemaModalOpen}
                    onClose={() => setIsSchemaModalOpen(false)}
                    pluginId={activePluginId}
                />
            )}
        </>
    );
};
