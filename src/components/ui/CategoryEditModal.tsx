import React, { useState } from 'react';
import { useSettingsStore } from '../../stores/settingsStore';

interface CategoryEditModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const CategoryEditModal: React.FC<CategoryEditModalProps> = ({ isOpen, onClose }) => {
    const categories = useSettingsStore(s => s.categories);
    const providersByCategory = useSettingsStore(s => s.providersByCategory);
    const addCategory = useSettingsStore(s => s.addCategory);
    const updateCategory = useSettingsStore(s => s.updateCategory);
    const deleteCategory = useSettingsStore(s => s.deleteCategory);

    const [editingId, setEditingId] = useState<string | null>(null);
    const [editValue, setEditValue] = useState('');
    const [newCategoryName, setNewCategoryName] = useState('');
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleAdd = () => {
        if (!newCategoryName.trim()) return;

        const id = newCategoryName.toLowerCase().replace(/[^a-z0-9]/g, '_');
        if (categories[id]) {
            setError('Category ID already exists');
            return;
        }

        addCategory(id, newCategoryName.trim());
        setNewCategoryName('');
        setError(null);
    };

    const handleStartEdit = (id: string, currentLabel: string) => {
        setEditingId(id);
        setEditValue(currentLabel);
        setError(null);
    };

    const handleSaveEdit = () => {
        if (editingId && editValue.trim()) {
            updateCategory(editingId, editValue.trim());
            setEditingId(null);
        }
    };

    const handleDelete = (id: string) => {
        try {
            deleteCategory(id);
            setError(null);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete category');
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
                <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-semibold text-neutral-900">Manage Categories</h3>
                    <button onClick={onClose} className="text-neutral-500 hover:text-neutral-700">
                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                        </svg>
                    </button>
                </div>

                {error && (
                    <div className="mb-4 p-3 bg-red-50 text-red-700 text-sm rounded-md border border-red-200">
                        {error}
                    </div>
                )}

                {/* Add New */}
                <div className="flex gap-2 mb-6">
                    <input
                        type="text"
                        value={newCategoryName}
                        onChange={(e) => setNewCategoryName(e.target.value)}
                        placeholder="New category name..."
                        className="flex-1 px-3 py-2 border border-neutral-300 rounded-md text-sm focus:ring-2 focus:ring-primary-500 focus:outline-none"
                    />
                    <button
                        onClick={handleAdd}
                        disabled={!newCategoryName.trim()}
                        className="px-4 py-2 bg-primary-500 text-white rounded-md text-sm font-medium hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        Add
                    </button>
                </div>

                {/* List */}
                <div className="space-y-2 max-h-64 overflow-y-auto">
                    {Object.entries(categories).map(([id, label]) => {
                        const hasProviders = providersByCategory[id]?.length > 0;
                        const isEditing = editingId === id;

                        return (
                            <div key={id} className="flex items-center justify-between p-3 bg-neutral-50 rounded-lg group">
                                {isEditing ? (
                                    <div className="flex-1 flex gap-2 mr-2">
                                        <input
                                            type="text"
                                            value={editValue}
                                            onChange={(e) => setEditValue(e.target.value)}
                                            className="flex-1 px-2 py-1 border border-neutral-300 rounded text-sm"
                                            autoFocus
                                        />
                                        <button onClick={handleSaveEdit} className="text-green-600 hover:text-green-700">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="20 6 9 17 4 12" />
                                            </svg>
                                        </button>
                                        <button onClick={() => setEditingId(null)} className="text-neutral-500 hover:text-neutral-700">
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <line x1="18" y1="6" x2="6" y2="18" />
                                                <line x1="6" y1="6" x2="18" y2="18" />
                                            </svg>
                                        </button>
                                    </div>
                                ) : (
                                    <span className="text-sm font-medium text-neutral-700">{label}</span>
                                )}

                                {!isEditing && (
                                    <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => handleStartEdit(id, label)}
                                            className="p-1 text-neutral-400 hover:text-primary-600"
                                            title="Rename"
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                                                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                                            </svg>
                                        </button>
                                        <button
                                            onClick={() => handleDelete(id)}
                                            disabled={hasProviders}
                                            className={`p-1 ${hasProviders ? 'text-neutral-300 cursor-not-allowed' : 'text-neutral-400 hover:text-red-600'}`}
                                            title={hasProviders ? 'Cannot delete category with providers' : 'Delete'}
                                        >
                                            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                                <polyline points="3 6 5 6 21 6" />
                                                <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                                            </svg>
                                        </button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
};
