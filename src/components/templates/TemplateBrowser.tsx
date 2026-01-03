/**
 * src/components/templates/TemplateBrowser.tsx
 * =============================================
 * Template browser component for loading pre-built and user-saved templates.
 * 
 * Implements EUR-1.1.10 (template browser with thumbnails) and
 * EUR-1.1.10a (save as template button).
 */

import React, { useState, useCallback, useEffect } from "react";
import { Modal } from "../ui/Modal";
import { Input } from "../ui/Input";
import { Button } from "../ui/Button";
import { layoutTemplates, type LayoutTemplate } from "./layoutTemplates";
import { useTemplateStore, useFilteredTemplates, type FETemplate } from "../../stores/templateStore";
import { TemplatePreview } from "./TemplatePreview";
import type { CanvasElement } from "../factory/canvasTypes";

// =============================================================================
// TYPES
// =============================================================================

/** Info about the loaded template */
interface TemplateInfo {
    name: string;
    id: string;
}

interface TemplateBrowserProps {
    /** Called when a template is loaded */
    onLoadTemplate: (
        elements: CanvasElement[],
        windowSize?: { width: number; height: number },
        templateInfo?: TemplateInfo
    ) => void;
    /** Called when save as template is clicked */
    onSaveAsTemplate?: () => void;
    /** Additional CSS classes */
    className?: string;
}

interface SaveTemplateModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (name: string, description: string, tags: string[]) => Promise<void>;
    isSaving: boolean;
}

// =============================================================================
// ICONS
// =============================================================================

const SearchIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <circle cx="11" cy="11" r="8" />
        <line x1="21" y1="21" x2="16.65" y2="16.65" />
    </svg>
);

const TemplateIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="7" height="7" />
        <rect x="14" y="3" width="7" height="7" />
        <rect x="14" y="14" width="7" height="7" />
        <rect x="3" y="14" width="7" height="7" />
    </svg>
);

const PlusIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <line x1="12" y1="5" x2="12" y2="19" />
        <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
);

const TrashIcon: React.FC<{ className?: string }> = ({ className }) => (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <polyline points="3 6 5 6 21 6" />
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </svg>
);

// =============================================================================
// SAVE TEMPLATE MODAL
// =============================================================================

const SaveTemplateModal: React.FC<SaveTemplateModalProps> = ({
    isOpen,
    onClose,
    onSave,
    isSaving,
}) => {
    const [name, setName] = useState("");
    const [description, setDescription] = useState("");
    const [tagsInput, setTagsInput] = useState("");

    const handleSave = async () => {
        if (!name.trim()) return;
        const tags = tagsInput.split(",").map((t) => t.trim()).filter(Boolean);
        await onSave(name, description, tags);
        setName("");
        setDescription("");
        setTagsInput("");
        onClose();
    };

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Save as Template" size="md">
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Template Name *
                    </label>
                    <Input
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="e.g., My Chat Layout"
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Description
                    </label>
                    <textarea
                        value={description}
                        onChange={(e) => setDescription(e.target.value)}
                        placeholder="Describe your template..."
                        className="w-full px-3 py-2 border border-neutral-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-none"
                        rows={3}
                    />
                </div>
                <div>
                    <label className="block text-sm font-medium text-neutral-700 mb-1">
                        Tags (comma separated)
                    </label>
                    <Input
                        value={tagsInput}
                        onChange={(e) => setTagsInput(e.target.value)}
                        placeholder="e.g., chat, sidebar, dark"
                    />
                </div>
                <div className="flex justify-end gap-3 pt-2">
                    <Button variant="secondary" onClick={onClose} disabled={isSaving}>
                        Cancel
                    </Button>
                    <Button variant="primary" onClick={handleSave} disabled={!name.trim() || isSaving}>
                        {isSaving ? "Saving..." : "Save Template"}
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

// =============================================================================
// TEMPLATE CARD
// =============================================================================

interface TemplateCardProps {
    template: LayoutTemplate | FETemplate;
    isPrebuilt: boolean;
    onLoad: () => void;
    onDelete?: () => void;
}

const TemplateCard: React.FC<TemplateCardProps> = ({
    template,
    isPrebuilt,
    onLoad,
    onDelete,
}) => {
    // Prepare data for preview
    let elements: CanvasElement[] = [];
    let windowSize = { width: 1920, height: 1080 };

    if (isPrebuilt) {
        const t = template as LayoutTemplate;
        elements = t.elements || [];
        if (t.windowSize) windowSize = t.windowSize;
    } else {
        const t = template as FETemplate;
        if (t.components) {
            elements = Object.values(t.components).map((comp) => ({
                id: comp.id,
                type: "component",
                name: comp.name,
                componentId: comp.type,
                bounds: {
                    x: comp.position?.x ?? 0,
                    y: comp.position?.y ?? 0,
                    width: comp.position?.width ?? 200,
                    height: comp.position?.height ?? 100,
                },
                props: comp.props,
                visible: true,
                zIndex: 1, // Default zIndex
            }));
        }
    }

    return (
        <div className="group relative bg-white border border-neutral-200 rounded-xl overflow-hidden hover:border-primary-300 hover:shadow-md transition-all duration-200 cursor-default" title={template.description}>
            {/* Preview Area */}
            <div className="h-32 bg-neutral-100 flex items-center justify-center relative overflow-hidden">
                <TemplatePreview
                    elements={elements}
                    windowSize={windowSize}
                    containerHeight={128} // Matches h-32
                />

                {/* Hover Overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100 z-10">
                    <button
                        onClick={onLoad}
                        className="px-4 py-2 bg-white text-neutral-900 rounded-lg text-sm font-medium shadow-lg hover:bg-neutral-50 transition-colors transform translate-y-2 group-hover:translate-y-0 duration-200"
                    >
                        Load Template
                    </button>
                </div>
            </div>

            {/* Info */}
            <div className="p-3">
                <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                        <h4 className="font-medium text-sm text-neutral-900 truncate">
                            {template.name}
                        </h4>
                        <p className="text-xs text-neutral-500 mt-0.5 line-clamp-2">
                            {template.description}
                        </p>
                    </div>
                    {!isPrebuilt && onDelete && (
                        <button
                            onClick={(e) => {
                                e.stopPropagation();
                                onDelete();
                            }}
                            className="p-1.5 text-neutral-400 hover:text-red-500 hover:bg-red-50 rounded transition-colors"
                            title="Delete template"
                        >
                            <TrashIcon className="h-4 w-4" />
                        </button>
                    )}
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mt-2">
                    {isPrebuilt && (
                        <span className="px-1.5 py-0.5 bg-primary-50 text-primary-600 text-[10px] font-medium rounded">
                            Built-in
                        </span>
                    )}
                    {(template.tags || []).slice(0, 2).map((tag) => (
                        <span
                            key={tag}
                            className="px-1.5 py-0.5 bg-neutral-100 text-neutral-500 text-[10px] rounded"
                        >
                            {tag}
                        </span>
                    ))}
                </div>
            </div>
        </div>
    );
};

// =============================================================================
// TEMPLATE BROWSER COMPONENT
// =============================================================================

/**
 * Template browser for loading and managing FE UI templates.
 */
export const TemplateBrowser: React.FC<TemplateBrowserProps> = ({
    onLoadTemplate,
    onSaveAsTemplate,
    className = "",
}) => {
    const [searchQuery, setSearchQuery] = useState("");
    const [activeTab, setActiveTab] = useState<"prebuilt" | "saved">("prebuilt");
    const [showSaveModal, setShowSaveModal] = useState(false);

    // User-saved templates from store
    const userTemplates = useFilteredTemplates();
    const { saveAsTemplate, deleteTemplate, refreshTemplates, isSaving } = useTemplateStore();

    // Refresh templates on mount
    useEffect(() => {
        refreshTemplates();
    }, [refreshTemplates]);

    // Filter pre-built templates by search
    const filteredPrebuilt = searchQuery
        ? layoutTemplates.filter(
            (t) =>
                t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : layoutTemplates;

    // Filter user templates by search
    const filteredUser = searchQuery
        ? userTemplates.filter(
            (t) =>
                t.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.tags.some((tag) => tag.toLowerCase().includes(searchQuery.toLowerCase()))
        )
        : userTemplates;

    // Handle loading a pre-built template
    const handleLoadPrebuilt = useCallback(
        (template: LayoutTemplate) => {
            onLoadTemplate(template.elements, template.windowSize, {
                name: template.name,
                id: template.id,
            });
        },
        [onLoadTemplate]
    );

    // Handle loading a user-saved template
    const handleLoadUserTemplate = useCallback(
        (template: FETemplate) => {
            // Convert user template components to canvas elements
            const elements: CanvasElement[] = Object.values(template.components).map((comp) => ({
                id: comp.id,
                type: "component",
                name: comp.name,
                componentId: comp.type,
                bounds: {
                    x: comp.position?.x ?? 100,
                    y: comp.position?.y ?? 100,
                    width: comp.position?.width ?? 200,
                    height: comp.position?.height ?? 100,
                },
                zIndex: 1,
                props: comp.props,
            }));
            onLoadTemplate(elements, undefined, {
                name: template.name,
                id: template.id,
            });
        },
        [onLoadTemplate]
    );

    // Handle saving current layout as template
    const handleSaveTemplate = useCallback(
        async (name: string, description: string, tags: string[]) => {
            await saveAsTemplate(name, description, tags);
        },
        [saveAsTemplate]
    );

    // Handle delete
    const handleDelete = useCallback(
        async (templateId: string) => {
            if (window.confirm("Are you sure you want to delete this template?")) {
                await deleteTemplate(templateId);
            }
        },
        [deleteTemplate]
    );

    return (
        <div className={`flex flex-col h-full ${className}`}>
            {/* Header */}
            <div className="flex items-center justify-between mb-3">
                <h3 className="font-semibold text-neutral-900">Templates</h3>
                {onSaveAsTemplate && (
                    <button
                        onClick={() => setShowSaveModal(true)}
                        className="flex items-center gap-1 px-2 py-1 text-xs font-medium text-primary-600 hover:text-primary-700 hover:bg-primary-50 rounded transition-colors"
                    >
                        <PlusIcon className="h-3.5 w-3.5" />
                        Save Current
                    </button>
                )}
            </div>

            {/* Search */}
            <div className="relative mb-3">
                <SearchIcon className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-neutral-400" />
                <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="Search templates..."
                    className="w-full pl-9 pr-3 py-2 text-sm border border-neutral-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
            </div>

            {/* Tabs */}
            <div className="flex gap-1 mb-3 bg-neutral-100 p-1 rounded-lg">
                <button
                    onClick={() => setActiveTab("prebuilt")}
                    className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${activeTab === "prebuilt"
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-600 hover:text-neutral-900"
                        }`}
                >
                    Pre-built ({filteredPrebuilt.length})
                </button>
                <button
                    onClick={() => setActiveTab("saved")}
                    className={`flex-1 py-1.5 px-3 text-xs font-medium rounded-md transition-colors ${activeTab === "saved"
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-600 hover:text-neutral-900"
                        }`}
                >
                    My Templates ({filteredUser.length})
                </button>
            </div>

            {/* Template Grid */}
            <div className="flex-1 overflow-auto">
                {activeTab === "prebuilt" ? (
                    filteredPrebuilt.length > 0 ? (
                        <div className="grid grid-cols-1 gap-3">
                            {filteredPrebuilt.map((template) => (
                                <TemplateCard
                                    key={template.id}
                                    template={template}
                                    isPrebuilt={true}
                                    onLoad={() => handleLoadPrebuilt(template)}
                                />
                            ))}
                        </div>
                    ) : (
                        <div className="text-center py-8 text-neutral-500 text-sm">
                            No templates found
                        </div>
                    )
                ) : filteredUser.length > 0 ? (
                    <div className="grid grid-cols-1 gap-3">
                        {filteredUser.map((template) => (
                            <TemplateCard
                                key={template.id}
                                template={template}
                                isPrebuilt={false}
                                onLoad={() => handleLoadUserTemplate(template)}
                                onDelete={() => handleDelete(template.id)}
                            />
                        ))}
                    </div>
                ) : (
                    <div className="text-center py-8">
                        <TemplateIcon className="h-10 w-10 text-neutral-300 mx-auto mb-2" />
                        <p className="text-sm text-neutral-500">No saved templates yet</p>
                        <p className="text-xs text-neutral-400 mt-1">
                            Save your current layout to reuse it later
                        </p>
                    </div>
                )}
            </div>

            {/* Save Template Modal */}
            <SaveTemplateModal
                isOpen={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                onSave={handleSaveTemplate}
                isSaving={isSaving}
            />
        </div>
    );
};

TemplateBrowser.displayName = "TemplateBrowser";

export default TemplateBrowser;
