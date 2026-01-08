import React, { useState, useEffect } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';
import type { RJSFSchema } from '@rjsf/utils';

interface SchemaEditModalProps {
    isOpen: boolean;
    onClose: () => void;
    pluginId: string;
}

export const SchemaEditModal: React.FC<SchemaEditModalProps> = ({ isOpen, onClose, pluginId }) => {
    const configSchemas = useSettingsStore(s => s.configSchemas);
    const saveSchemaOverride = useSettingsStore(s => s.saveSchemaOverride);
    const initialSchema = configSchemas[pluginId] as RJSFSchema;

    const [schema, setSchema] = useState<RJSFSchema>(initialSchema || {});
    const [newFieldName, setNewFieldName] = useState('');
    const [newFieldType, setNewFieldType] = useState('string');

    useEffect(() => {
        if (isOpen && configSchemas[pluginId]) {
            setSchema(JSON.parse(JSON.stringify(configSchemas[pluginId])));
        }
    }, [isOpen, pluginId, configSchemas]);

    if (!isOpen) return null;

    const properties = (schema.properties || {}) as Record<string, any>;

    const handleAddField = () => {
        if (!newFieldName.trim()) return;

        const newProperties = {
            ...properties,
            [newFieldName.trim()]: {
                type: newFieldType,
                title: newFieldName.trim(), // Default title to name
            }
        };

        const newSchema = {
            ...schema,
            properties: newProperties,
        };

        setSchema(newSchema);
        setNewFieldName('');
    };

    const handleDeleteField = (key: string) => {
        const newProperties = { ...properties };
        delete newProperties[key];

        const newSchema = {
            ...schema,
            properties: newProperties
        };
        setSchema(newSchema);
    };

    const handleSave = () => {
        saveSchemaOverride(pluginId, schema);
        onClose();
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl p-6 flex flex-col max-h-[80vh]">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-neutral-900">Edit Configuration Schema</h3>
                    <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                <div className="flex-1 overflow-y-auto pr-2">
                    {/* Add Field Section */}
                    <div className="bg-neutral-50 p-4 rounded-lg mb-6 border border-neutral-200">
                        <h4 className="text-sm font-medium text-neutral-700 mb-3">Add New Parameter</h4>
                        <div className="flex gap-3">
                            <input
                                type="text"
                                value={newFieldName}
                                onChange={(e) => setNewFieldName(e.target.value)}
                                placeholder="Parameter name (e.g. top_k)"
                                className="flex-1 px-3 py-2 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                            />
                            <select
                                value={newFieldType}
                                onChange={(e) => setNewFieldType(e.target.value)}
                                className="px-3 py-2 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                            >
                                <option value="string">String</option>
                                <option value="number">Number</option>
                                <option value="boolean">Boolean</option>
                                <option value="integer">Integer</option>
                            </select>
                            <button
                                onClick={handleAddField}
                                disabled={!newFieldName.trim()}
                                className="px-4 py-2 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    {/* Fields List */}
                    <div className="space-y-3">
                        <h4 className="text-sm font-medium text-neutral-700">Existing Parameters</h4>
                        {Object.keys(properties).length === 0 ? (
                            <p className="text-sm text-neutral-500 italic">No parameters defined.</p>
                        ) : (
                            Object.entries(properties).map(([key, prop]) => (
                                <div key={key} className="flex items-center justify-between p-3 border border-neutral-200 rounded-lg hover:border-neutral-300 transition-colors">
                                    <div>
                                        <div className="font-medium text-neutral-900 text-sm">{key}</div>
                                        <div className="text-xs text-neutral-500">
                                            Type: <span className="font-mono bg-neutral-100 px-1 rounded">{prop.type}</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDeleteField(key)}
                                        className="text-neutral-400 hover:text-red-600 p-2"
                                        title="Remove parameter"
                                    >
                                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                            <polyline points="3 6 5 6 21 6" />
                                            <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                        </svg>
                                    </button>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                <div className="mt-6 pt-4 border-t border-neutral-200 flex justify-end gap-3">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 text-neutral-600 font-medium text-sm hover:bg-neutral-100 rounded-lg"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-4 py-2 bg-primary-500 text-white font-medium text-sm rounded-lg hover:bg-primary-600"
                    >
                        Save Schema
                    </button>
                </div>
            </div>
        </div>
    );
};
