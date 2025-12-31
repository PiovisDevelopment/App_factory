/**
 * src/stores/templateStore.ts
 * ===========================
 * Zustand store for FE UI template management.
 * 
 * Implements EUR-1.1.10 (load templates) and EUR-1.1.10a (save as template).
 * Templates are persisted to local filesystem via Tauri FS API.
 */

import { create } from "zustand";
import { devtools, persist } from "zustand/middleware";
import { readDir, readTextFile, writeTextFile, removeFile, createDir, exists } from "@tauri-apps/api/fs";
import { appDataDir, join } from "@tauri-apps/api/path";
import { isTauri } from "../utils/tauriUtils";
import type { ProjectComponent, ProjectScreen, ProjectTheme } from "./projectStore";
import { useProjectStore } from "./projectStore";

// =============================================================================
// TYPES
// =============================================================================

/**
 * FE UI Template structure.
 */
export interface FETemplate {
    /** Unique template ID */
    id: string;
    /** Template name */
    name: string;
    /** Template description */
    description: string;
    /** Base64 encoded thumbnail image */
    thumbnail: string | null;
    /** Component definitions */
    components: Record<string, ProjectComponent>;
    /** Screen definitions */
    screens: Record<string, ProjectScreen>;
    /** Theme configuration */
    theme: ProjectTheme;
    /** Creation timestamp */
    createdAt: number;
    /** Last modified timestamp */
    updatedAt: number;
    /** Tags for filtering */
    tags: string[];
    /** Template author */
    author: string;
    /** Version */
    version: string;
}

/**
 * Template store state.
 */
interface TemplateState {
    /** All available templates */
    templates: FETemplate[];
    /** Currently selected template ID */
    selectedTemplateId: string | null;
    /** Search query */
    searchQuery: string;
    /** Loading state */
    isLoading: boolean;
    /** Saving state */
    isSaving: boolean;
    /** Error message */
    error: string | null;
}

/**
 * Template store actions.
 */
interface TemplateActions {
    /** Save current project as a template */
    saveAsTemplate: (name: string, description?: string, tags?: string[]) => Promise<FETemplate>;
    /** Load a template into the current project */
    loadTemplate: (templateId: string) => Promise<void>;
    /** Delete a template */
    deleteTemplate: (templateId: string) => Promise<void>;
    /** Refresh templates from disk */
    refreshTemplates: () => Promise<void>;
    /** Set selected template */
    setSelectedTemplate: (templateId: string | null) => void;
    /** Set search query */
    setSearchQuery: (query: string) => void;
    /** Clear error */
    clearError: () => void;
}

// =============================================================================
// HELPERS
// =============================================================================

const TEMPLATES_DIR = "templates";

/**
 * Get templates directory path.
 */
async function getTemplatesDir(): Promise<string> {
    const appData = await appDataDir();
    return await join(appData, TEMPLATES_DIR);
}

/**
 * Ensure templates directory exists.
 */
async function ensureTemplatesDir(): Promise<void> {
    const templatesPath = await getTemplatesDir();
    const dirExists = await exists(templatesPath);
    if (!dirExists) {
        await createDir(templatesPath, { recursive: true });
    }
}

/**
 * Generate unique ID.
 */
const generateId = (): string => {
    return `tmpl-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
};

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: TemplateState = {
    templates: [],
    selectedTemplateId: null,
    searchQuery: "",
    isLoading: false,
    isSaving: false,
    error: null,
};

// =============================================================================
// STORE
// =============================================================================

/**
 * Zustand store for template management.
 */
export const useTemplateStore = create<TemplateState & TemplateActions>()(
    devtools(
        persist(
            (set, get) => ({
                ...initialState,

                saveAsTemplate: async (name, description = "", tags = []) => {
                    set({ isSaving: true, error: null });

                    try {
                        // Get current project state
                        const projectStore = useProjectStore.getState();
                        const { components, screens, theme, metadata } = projectStore;

                        // Create template
                        const template: FETemplate = {
                            id: generateId(),
                            name,
                            description,
                            thumbnail: null, // Could capture canvas as image in future
                            components,
                            screens,
                            theme,
                            createdAt: Date.now(),
                            updatedAt: Date.now(),
                            tags,
                            author: metadata.author || "Unknown",
                            version: "1.0.0",
                        };

                        if (isTauri()) {
                            // Save to filesystem
                            await ensureTemplatesDir();
                            const templatesPath = await getTemplatesDir();
                            const filePath = await join(templatesPath, `${template.id}.json`);
                            await writeTextFile(filePath, JSON.stringify(template, null, 2));
                        }

                        // Update store
                        set((state) => ({
                            templates: [...state.templates, template],
                            isSaving: false,
                        }));

                        return template;
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "Failed to save template";
                        set({ isSaving: false, error: message });
                        throw error;
                    }
                },

                loadTemplate: async (templateId) => {
                    set({ isLoading: true, error: null });

                    try {
                        const { templates } = get();
                        const template = templates.find((t) => t.id === templateId);

                        if (!template) {
                            throw new Error("Template not found");
                        }

                        // Apply template to project store
                        const projectStore = useProjectStore.getState();

                        // Merge template into current project
                        projectStore.loadProject({
                            components: template.components,
                            screens: template.screens,
                            theme: template.theme,
                            status: "modified",
                        });

                        set({ isLoading: false, selectedTemplateId: templateId });
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "Failed to load template";
                        set({ isLoading: false, error: message });
                        throw error;
                    }
                },

                deleteTemplate: async (templateId) => {
                    set({ isLoading: true, error: null });

                    try {
                        if (isTauri()) {
                            const templatesPath = await getTemplatesDir();
                            const filePath = await join(templatesPath, `${templateId}.json`);
                            await removeFile(filePath);
                        }

                        set((state) => ({
                            templates: state.templates.filter((t) => t.id !== templateId),
                            selectedTemplateId:
                                state.selectedTemplateId === templateId ? null : state.selectedTemplateId,
                            isLoading: false,
                        }));
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "Failed to delete template";
                        set({ isLoading: false, error: message });
                        throw error;
                    }
                },

                refreshTemplates: async () => {
                    set({ isLoading: true, error: null });

                    try {
                        const templates: FETemplate[] = [];

                        if (isTauri()) {
                            await ensureTemplatesDir();
                            const templatesPath = await getTemplatesDir();
                            const entries = await readDir(templatesPath);

                            for (const entry of entries) {
                                if (entry.name?.endsWith(".json") && entry.path) {
                                    try {
                                        const content = await readTextFile(entry.path);
                                        const template = JSON.parse(content) as FETemplate;
                                        templates.push(template);
                                    } catch {
                                        // Skip invalid files
                                        console.warn("Failed to parse template:", entry.path);
                                    }
                                }
                            }
                        }

                        set({ templates, isLoading: false });
                    } catch (error) {
                        const message = error instanceof Error ? error.message : "Failed to refresh templates";
                        set({ isLoading: false, error: message });
                    }
                },

                setSelectedTemplate: (templateId) => {
                    set({ selectedTemplateId: templateId });
                },

                setSearchQuery: (query) => {
                    set({ searchQuery: query });
                },

                clearError: () => {
                    set({ error: null });
                },
            }),
            {
                name: "template-store",
                partialize: (state) => ({
                    templates: state.templates,
                }),
            }
        ),
        { name: "TemplateStore" }
    )
);

// =============================================================================
// SELECTORS
// =============================================================================

/**
 * Get filtered templates based on search query.
 */
export const useFilteredTemplates = () =>
    useTemplateStore((state) => {
        const query = state.searchQuery.toLowerCase();
        if (!query) return state.templates;

        return state.templates.filter(
            (t) =>
                t.name.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query) ||
                t.tags.some((tag) => tag.toLowerCase().includes(query))
        );
    });

/**
 * Get selected template.
 */
export const useSelectedTemplate = () =>
    useTemplateStore((state) =>
        state.templates.find((t) => t.id === state.selectedTemplateId)
    );

export default useTemplateStore;
