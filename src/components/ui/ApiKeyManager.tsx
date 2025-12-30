/**
 * ApiKeyManager.tsx
 * =================
 * Component for managing API keys in the Settings panel.
 * Provides CRUD operations for API keys with masked display.
 * 
 * D079 - API Key Management (EUR-1.2.6)
 */

import React, { useState, useEffect, useCallback } from 'react';
import {
    useApiKeyStore,
    API_KEY_SERVICE_LABELS,
    type ApiKeyService,
    type ApiKeyEntry,
} from '../../stores/apiKeyStore';

// ============================================
// TYPES
// ============================================

interface AddKeyModalProps {
    isOpen: boolean;
    service: ApiKeyService;
    onClose: () => void;
    onAdd: (name: string, key: string) => Promise<void>;
}

interface EditKeyModalProps {
    isOpen: boolean;
    entry: ApiKeyEntry | null;
    service: ApiKeyService;
    onClose: () => void;
    onSave: (id: string, name: string, key?: string) => Promise<void>;
}

interface DeleteConfirmModalProps {
    isOpen: boolean;
    entry: ApiKeyEntry | null;
    onClose: () => void;
    onConfirm: () => Promise<void>;
}

// ============================================
// ADD KEY MODAL
// ============================================

const AddKeyModal: React.FC<AddKeyModalProps> = ({ isOpen, service, onClose, onAdd }) => {
    const [name, setName] = useState('');
    const [key, setKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Reset form when modal opens
    useEffect(() => {
        if (isOpen) {
            setName('');
            setKey('');
            setError('');
        }
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!name.trim()) {
            setError('Please enter a name for this key');
            return;
        }
        if (!key.trim()) {
            setError('Please enter the API key');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            await onAdd(name.trim(), key.trim());
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add key');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-900">
                        Add API Key - {API_KEY_SERVICE_LABELS[service]}
                    </h3>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="keyName" className="block text-sm font-medium text-neutral-700 mb-1">
                            Key Name
                        </label>
                        <input
                            id="keyName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="e.g., Production, Development, Testing"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="apiKey" className="block text-sm font-medium text-neutral-700 mb-1">
                            API Key
                        </label>
                        <input
                            id="apiKey"
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="Paste your API key here"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
                        />
                        <p className="mt-1 text-xs text-neutral-500">
                            Your key will be stored securely and only the first 3 and last 3 characters will be displayed.
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
                        >
                            {isSubmitting ? 'Adding...' : 'Add Key'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ============================================
// EDIT KEY MODAL
// ============================================

const EditKeyModal: React.FC<EditKeyModalProps> = ({ isOpen, entry, service: _service, onClose, onSave }) => {
    const [name, setName] = useState('');
    const [key, setKey] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState('');

    // Populate form when entry changes
    useEffect(() => {
        if (entry) {
            setName(entry.name);
            setKey(''); // Don't show masked key in edit field
            setError('');
        }
    }, [entry]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!entry) return;
        if (!name.trim()) {
            setError('Please enter a name');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            // Only pass key if user entered a new one
            const newKey = key.trim() || undefined;
            await onSave(entry.id, name.trim(), newKey);
            onClose();
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update key');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (!isOpen || !entry) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-neutral-50 border-b border-neutral-200">
                    <h3 className="text-lg font-semibold text-neutral-900">
                        Edit API Key
                    </h3>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {error && (
                        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            {error}
                        </div>
                    )}

                    <div>
                        <label htmlFor="editKeyName" className="block text-sm font-medium text-neutral-700 mb-1">
                            Key Name
                        </label>
                        <input
                            id="editKeyName"
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        />
                    </div>

                    <div>
                        <label htmlFor="editApiKey" className="block text-sm font-medium text-neutral-700 mb-1">
                            New API Key <span className="text-neutral-400 font-normal">(optional)</span>
                        </label>
                        <input
                            id="editApiKey"
                            type="password"
                            value={key}
                            onChange={(e) => setKey(e.target.value)}
                            placeholder="Leave empty to keep current key"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-neutral-900 placeholder-neutral-400 focus:ring-2 focus:ring-primary-500 focus:border-primary-500 font-mono"
                        />
                        <p className="mt-1 text-xs text-neutral-500">
                            Current key: <span className="font-mono">{entry.keyMasked}</span>
                        </p>
                    </div>

                    {/* Buttons */}
                    <div className="flex justify-end gap-3 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isSubmitting}
                            className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="px-4 py-2 bg-primary-500 text-white font-medium rounded-lg hover:bg-primary-600 disabled:opacity-50 transition-colors"
                        >
                            {isSubmitting ? 'Saving...' : 'Save Changes'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

// ============================================
// DELETE CONFIRM MODAL
// ============================================

const DeleteConfirmModal: React.FC<DeleteConfirmModalProps> = ({ isOpen, entry, onClose, onConfirm }) => {
    const [isDeleting, setIsDeleting] = useState(false);

    const handleConfirm = async () => {
        setIsDeleting(true);
        try {
            await onConfirm();
            onClose();
        } catch {
            // Error handled by parent
        } finally {
            setIsDeleting(false);
        }
    };

    if (!isOpen || !entry) return null;

    return (
        <div className="fixed inset-0 bg-black/60 z-[60] flex items-center justify-center p-4">
            <div className="bg-white rounded-xl shadow-2xl max-w-sm w-full overflow-hidden">
                {/* Header */}
                <div className="px-6 py-4 bg-red-50 border-b border-red-200">
                    <h3 className="text-lg font-semibold text-red-700">
                        Delete API Key
                    </h3>
                </div>

                {/* Content */}
                <div className="p-6">
                    <p className="text-neutral-700">
                        Are you sure you want to delete the key <strong>"{entry.name}"</strong>?
                    </p>
                    <p className="mt-2 text-sm text-neutral-500">
                        This action cannot be undone.
                    </p>
                </div>

                {/* Buttons */}
                <div className="px-6 py-4 bg-neutral-50 border-t border-neutral-200 flex justify-end gap-3">
                    <button
                        type="button"
                        onClick={onClose}
                        disabled={isDeleting}
                        className="px-4 py-2 text-neutral-700 hover:bg-neutral-100 rounded-lg transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        type="button"
                        onClick={handleConfirm}
                        disabled={isDeleting}
                        className="px-4 py-2 bg-red-500 text-white font-medium rounded-lg hover:bg-red-600 disabled:opacity-50 transition-colors"
                    >
                        {isDeleting ? 'Deleting...' : 'Delete'}
                    </button>
                </div>
            </div>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

export const ApiKeyManager: React.FC = () => {
    const {
        keys,
        selectedService,
        isLoading,
        error,
        setSelectedService,
        fetchKeys,
        addKey,
        updateKey,
        deleteKey,
        setActiveKey,
        clearError,
    } = useApiKeyStore();

    // Modal states
    const [showAddModal, setShowAddModal] = useState(false);
    const [editEntry, setEditEntry] = useState<ApiKeyEntry | null>(null);
    const [deleteEntry, setDeleteEntry] = useState<ApiKeyEntry | null>(null);
    const [isExpanded, setIsExpanded] = useState(true);

    // Fetch keys when component mounts or service changes
    useEffect(() => {
        fetchKeys(selectedService);
    }, [selectedService, fetchKeys]);

    // Get current service keys
    const serviceKeys = keys[selectedService] || [];

    // Handlers
    const handleServiceChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
        setSelectedService(e.target.value as ApiKeyService);
    }, [setSelectedService]);

    const handleAddKey = useCallback(async (name: string, key: string) => {
        await addKey(selectedService, name, key);
    }, [addKey, selectedService]);

    const handleUpdateKey = useCallback(async (id: string, name: string, key?: string) => {
        await updateKey(selectedService, id, name, key);
    }, [updateKey, selectedService]);

    const handleDeleteKey = useCallback(async () => {
        if (deleteEntry) {
            await deleteKey(selectedService, deleteEntry.id);
        }
    }, [deleteKey, selectedService, deleteEntry]);

    const handleSetActive = useCallback(async (id: string) => {
        await setActiveKey(selectedService, id);
    }, [setActiveKey, selectedService]);

    return (
        <div className="border border-neutral-200 rounded-lg overflow-hidden">
            {/* Header */}
            <button
                type="button"
                onClick={() => setIsExpanded(!isExpanded)}
                className="w-full flex items-center justify-between px-4 py-3 bg-neutral-50 hover:bg-neutral-100 transition-colors"
            >
                <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-neutral-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                    </svg>
                    <span className="font-medium text-neutral-900">API Keys</span>
                    {serviceKeys.length > 0 && (
                        <span className="px-2 py-0.5 text-xs bg-neutral-200 text-neutral-600 rounded-full">
                            {serviceKeys.length}
                        </span>
                    )}
                </div>
                <svg
                    className={`h-5 w-5 text-neutral-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                >
                    <polyline points="6 9 12 15 18 9" />
                </svg>
            </button>

            {/* Content */}
            {isExpanded && (
                <div className="p-4 space-y-4">
                    {/* Error Message */}
                    {error && (
                        <div className="flex items-center justify-between p-3 bg-red-50 border border-red-200 rounded-lg">
                            <span className="text-sm text-red-700">{error}</span>
                            <button
                                type="button"
                                onClick={clearError}
                                className="text-red-500 hover:text-red-700"
                            >
                                <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                    <line x1="18" y1="6" x2="6" y2="18" />
                                    <line x1="6" y1="6" x2="18" y2="18" />
                                </svg>
                            </button>
                        </div>
                    )}

                    {/* Service Selector */}
                    <div>
                        <label htmlFor="serviceSelect" className="block text-sm font-medium text-neutral-700 mb-1">
                            Service
                        </label>
                        <select
                            id="serviceSelect"
                            value={selectedService}
                            onChange={handleServiceChange}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-lg bg-white text-neutral-900 focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                        >
                            {Object.entries(API_KEY_SERVICE_LABELS).map(([id, label]) => (
                                <option key={id} value={id}>{label}</option>
                            ))}
                        </select>
                    </div>

                    {/* Keys List */}
                    <div className="space-y-2">
                        {isLoading ? (
                            <div className="text-center py-4 text-neutral-500">
                                <svg className="animate-spin h-5 w-5 mx-auto mb-2" viewBox="0 0 24 24" fill="none">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                                </svg>
                                Loading keys...
                            </div>
                        ) : serviceKeys.length === 0 ? (
                            <div className="text-center py-6 text-neutral-500">
                                <svg className="h-10 w-10 mx-auto mb-2 opacity-50" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                                    <path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.777-7.777zm0 0L15.5 7.5m0 0l3 3L22 7l-3-3m-3.5 3.5L19 4" />
                                </svg>
                                <p>No API keys configured for {API_KEY_SERVICE_LABELS[selectedService]}</p>
                                <p className="text-xs mt-1">Add a key to get started</p>
                            </div>
                        ) : (
                            serviceKeys.map((entry) => (
                                <div
                                    key={entry.id}
                                    className={`flex items-center gap-3 p-3 rounded-lg border ${entry.isActive
                                        ? 'border-primary-300 bg-primary-50'
                                        : 'border-neutral-200 bg-white'
                                        }`}
                                >
                                    {/* Radio button */}
                                    <button
                                        type="button"
                                        onClick={() => handleSetActive(entry.id)}
                                        className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-colors ${entry.isActive
                                            ? 'border-primary-500 bg-primary-500'
                                            : 'border-neutral-300 hover:border-primary-400'
                                            }`}
                                        title={entry.isActive ? 'Active key' : 'Set as active'}
                                    >
                                        {entry.isActive && (
                                            <div className="w-2 h-2 rounded-full bg-white" />
                                        )}
                                    </button>

                                    {/* Key Info */}
                                    <div className="flex-1 min-w-0">
                                        <div className="font-medium text-neutral-900 truncate">
                                            {entry.name}
                                        </div>
                                        <div className="text-sm text-neutral-500 font-mono">
                                            {entry.keyMasked}
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex items-center gap-1">
                                        <button
                                            type="button"
                                            onClick={() => setEditEntry(entry)}
                                            className="p-2 text-neutral-400 hover:text-neutral-600 hover:bg-neutral-100 rounded-lg transition-colors"
                                            title="Edit key"
                                        >
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setDeleteEntry(entry)}
                                            className="p-2 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                                            title="Delete key"
                                        >
                                            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                </div>
                            ))
                        )}
                    </div>

                    {/* Add Button */}
                    <button
                        type="button"
                        onClick={() => setShowAddModal(true)}
                        className="w-full flex items-center justify-center gap-2 px-4 py-2 border-2 border-dashed border-neutral-300 text-neutral-600 rounded-lg hover:border-primary-400 hover:text-primary-600 transition-colors"
                    >
                        <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="12" y1="5" x2="12" y2="19" />
                            <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                        Add New Key
                    </button>
                </div>
            )}

            {/* Modals */}
            <AddKeyModal
                isOpen={showAddModal}
                service={selectedService}
                onClose={() => setShowAddModal(false)}
                onAdd={handleAddKey}
            />
            <EditKeyModal
                isOpen={!!editEntry}
                entry={editEntry}
                service={selectedService}
                onClose={() => setEditEntry(null)}
                onSave={handleUpdateKey}
            />
            <DeleteConfirmModal
                isOpen={!!deleteEntry}
                entry={deleteEntry}
                onClose={() => setDeleteEntry(null)}
                onConfirm={handleDeleteKey}
            />
        </div>
    );
};
