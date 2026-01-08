/**
 * src/stores/componentLibraryStore.ts
 * ====================================
 * Zustand store for managing AI-generated component library.
 * Stores saved components with code, metadata, and thumbnails.
 * Persisted to localStorage with Tauri storage fallback.
 *
 * Architecture: Option B (Backend Pre-Compilation)
 * Dependencies: D070 (ComponentGenerator), LiveComponentPreview
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

// =============================================================================
// TYPES
// =============================================================================

/**
 * Framework type for components.
 */
export type ComponentFramework = 'react' | 'vue' | 'svelte' | 'html';

/**
 * Category for organizing components.
 */
export type ComponentCategory =
    | 'buttons'
    | 'cards'
    | 'forms'
    | 'navigation'
    | 'layout'
    | 'modals'
    | 'tables'
    | 'charts'
    | 'icons'
    | 'other';

/**
 * A saved component in the library.
 */
export interface LibraryComponent {
    /** Unique identifier */
    id: string;
    /** Display name */
    name: string;
    /** Optional description */
    description?: string;
    /** Raw TSX/component code */
    code: string;
    /** Compiled JavaScript (cached for performance) */
    compiledCode?: string;
    /** Target framework */
    framework: ComponentFramework;
    /** Category for organization */
    category: ComponentCategory;
    /** User-defined tags for search */
    tags: string[];
    /** Base64 thumbnail image (PNG or WebP) */
    thumbnail?: string;
    /** Original prompt used to generate the component */
    prompt?: string;
    /** Creation timestamp */
    createdAt: number;
    /** Last modified timestamp */
    updatedAt: number;
    /** Whether this is a favorite */
    isFavorite: boolean;
}

/**
 * Input for adding a new component to the library.
 */
export interface AddComponentInput {
    name: string;
    code: string;
    framework: ComponentFramework;
    description?: string | undefined;
    category?: ComponentCategory | undefined;
    tags?: string[] | undefined;
    thumbnail?: string | undefined;
    prompt?: string | undefined;
}

/**
 * Input for updating an existing component.
 */
export interface UpdateComponentInput {
    name?: string;
    description?: string;
    code?: string;
    compiledCode?: string;
    category?: ComponentCategory;
    tags?: string[];
    thumbnail?: string;
    isFavorite?: boolean;
}

// =============================================================================
// STORE STATE & ACTIONS
// =============================================================================

/**
 * Component library state interface.
 */
export interface ComponentLibraryState {
    /** All saved components */
    components: LibraryComponent[];
    /** Currently selected component ID */
    selectedComponentId: string | null;
    /** Search query for filtering */
    searchQuery: string;
    /** Category filter */
    categoryFilter: ComponentCategory | 'all';
    /** Whether to show only favorites */
    showFavoritesOnly: boolean;
}

/**
 * Component library actions interface.
 */
export interface ComponentLibraryActions {
    // CRUD operations
    addComponent: (input: AddComponentInput) => LibraryComponent;
    updateComponent: (id: string, input: UpdateComponentInput) => void;
    deleteComponent: (id: string) => void;
    duplicateComponent: (id: string) => LibraryComponent | null;

    // Selection
    selectComponent: (id: string | null) => void;
    getSelectedComponent: () => LibraryComponent | null;

    // Filtering
    setSearchQuery: (query: string) => void;
    setCategoryFilter: (category: ComponentCategory | 'all') => void;
    setShowFavoritesOnly: (show: boolean) => void;
    getFilteredComponents: () => LibraryComponent[];

    // Favorites
    toggleFavorite: (id: string) => void;

    // Bulk operations
    importComponents: (components: LibraryComponent[]) => void;
    exportComponents: () => LibraryComponent[];
    clearLibrary: () => void;

    // Utilities
    getComponentById: (id: string) => LibraryComponent | undefined;
    getComponentsByCategory: (category: ComponentCategory) => LibraryComponent[];
    getComponentCount: () => number;
}

// =============================================================================
// INITIAL STATE
// =============================================================================

const initialState: ComponentLibraryState = {
    components: [],
    selectedComponentId: null,
    searchQuery: '',
    categoryFilter: 'all',
    showFavoritesOnly: false,
};

// =============================================================================
// HELPERS
// =============================================================================

/**
 * Generate a unique ID for a component.
 */
function generateId(): string {
    return `comp_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

/**
 * Extract component name from code if not provided.
 */
function extractNameFromCode(code: string): string {
    // Match: const ComponentName = or function ComponentName
    const constMatch = code.match(/const\s+([A-Z][a-zA-Z0-9]*)\s*[:=]/);
    if (constMatch) return constMatch[1];

    const funcMatch = code.match(/function\s+([A-Z][a-zA-Z0-9]*)\s*\(/);
    if (funcMatch) return funcMatch[1];

    return `Component_${Date.now()}`;
}

// =============================================================================
// STORE
// =============================================================================

/**
 * Zustand store for component library.
 * 
 * Provides CRUD operations for managing AI-generated components,
 * with filtering, search, and favorites functionality.
 * 
 * @example
 * ```typescript
 * import { useComponentLibraryStore } from '../stores/componentLibraryStore';
 * 
 * // Add a component
 * const component = useComponentLibraryStore.getState().addComponent({
 *     name: 'PrimaryButton',
 *     code: 'const PrimaryButton = () => <button>Click me</button>',
 *     framework: 'react',
 *     category: 'buttons',
 * });
 * 
 * // Get filtered components
 * const filtered = useComponentLibraryStore.getState().getFilteredComponents();
 * ```
 */
export const useComponentLibraryStore = create<ComponentLibraryState & ComponentLibraryActions>()(
    persist(
        (set, get) => ({
            ...initialState,

            // =========================================================
            // CRUD OPERATIONS
            // =========================================================

            addComponent: (input) => {
                const id = generateId();
                const now = Date.now();

                const newComponent: LibraryComponent = {
                    id,
                    name: input.name || extractNameFromCode(input.code),
                    ...(input.description ? { description: input.description } : {}),
                    code: input.code,
                    framework: input.framework,
                    category: input.category || 'other',
                    tags: input.tags || [],
                    ...(input.thumbnail ? { thumbnail: input.thumbnail } : {}),
                    ...(input.prompt ? { prompt: input.prompt } : {}),
                    createdAt: now,
                    updatedAt: now,
                    isFavorite: false,
                };

                set((state) => ({
                    components: [...state.components, newComponent],
                }));

                return newComponent;
            },

            updateComponent: (id, input) => {
                // Remove undefined fields to satisfy exactOptionalPropertyTypes
                const sanitizedEntries = Object.entries(input).filter(([, value]) => value !== undefined);
                const sanitizedInput = Object.fromEntries(sanitizedEntries);

                // Ensure string fields are concrete strings
                if ('description' in sanitizedInput) {
                    sanitizedInput.description = (sanitizedInput.description as string) ?? '';
                }
                if ('thumbnail' in sanitizedInput) {
                    sanitizedInput.thumbnail = (sanitizedInput.thumbnail as string) ?? '';
                }
                if ('prompt' in sanitizedInput) {
                    sanitizedInput.prompt = (sanitizedInput.prompt as string) ?? '';
                }

                set((state) => ({
                    components: state.components.map((comp) =>
                        comp.id === id
                            ? { ...comp, ...sanitizedInput, updatedAt: Date.now() }
                            : comp
                    ),
                }));
            },

            deleteComponent: (id) => {
                set((state) => ({
                    components: state.components.filter((comp) => comp.id !== id),
                    selectedComponentId:
                        state.selectedComponentId === id ? null : state.selectedComponentId,
                }));
            },

            duplicateComponent: (id) => {
                const original = get().getComponentById(id);
                if (!original) return null;

                const duplicate = get().addComponent({
                    name: `${original.name} (Copy)`,
                    code: original.code,
                    framework: original.framework,
                    description: original.description,
                    category: original.category,
                    tags: [...original.tags],
                    thumbnail: original.thumbnail,
                    prompt: original.prompt,
                });

                return duplicate;
            },

            // =========================================================
            // SELECTION
            // =========================================================

            selectComponent: (id) => {
                set({ selectedComponentId: id });
            },

            getSelectedComponent: () => {
                const { components, selectedComponentId } = get();
                return components.find((c) => c.id === selectedComponentId) || null;
            },

            // =========================================================
            // FILTERING
            // =========================================================

            setSearchQuery: (query) => {
                set({ searchQuery: query });
            },

            setCategoryFilter: (category) => {
                set({ categoryFilter: category });
            },

            setShowFavoritesOnly: (show) => {
                set({ showFavoritesOnly: show });
            },

            getFilteredComponents: () => {
                const { components, searchQuery, categoryFilter, showFavoritesOnly } = get();

                return components.filter((comp) => {
                    // Favorites filter
                    if (showFavoritesOnly && !comp.isFavorite) return false;

                    // Category filter
                    if (categoryFilter !== 'all' && comp.category !== categoryFilter) return false;

                    // Search filter
                    if (searchQuery.trim()) {
                        const query = searchQuery.toLowerCase();
                        const matchesName = comp.name.toLowerCase().includes(query);
                        const matchesDescription = comp.description?.toLowerCase().includes(query);
                        const matchesTags = comp.tags.some((tag) => tag.toLowerCase().includes(query));
                        const matchesPrompt = comp.prompt?.toLowerCase().includes(query);

                        if (!matchesName && !matchesDescription && !matchesTags && !matchesPrompt) {
                            return false;
                        }
                    }

                    return true;
                });
            },

            // =========================================================
            // FAVORITES
            // =========================================================

            toggleFavorite: (id) => {
                set((state) => ({
                    components: state.components.map((comp) =>
                        comp.id === id
                            ? { ...comp, isFavorite: !comp.isFavorite, updatedAt: Date.now() }
                            : comp
                    ),
                }));
            },

            // =========================================================
            // BULK OPERATIONS
            // =========================================================

            importComponents: (components) => {
                // Assign new IDs and timestamps to imported components
                const now = Date.now();
                const imported = components.map((comp, index) => ({
                    ...comp,
                    id: generateId() + index,
                    createdAt: now,
                    updatedAt: now,
                }));

                set((state) => ({
                    components: [...state.components, ...imported],
                }));
            },

            exportComponents: () => {
                return get().components;
            },

            clearLibrary: () => {
                set({ components: [], selectedComponentId: null });
            },

            // =========================================================
            // UTILITIES
            // =========================================================

            getComponentById: (id) => {
                return get().components.find((c) => c.id === id);
            },

            getComponentsByCategory: (category) => {
                return get().components.filter((c) => c.category === category);
            },

            getComponentCount: () => {
                return get().components.length;
            },
        }),
        {
            name: 'app-factory-component-library',
            storage: createJSONStorage(() => localStorage),
            partialize: (state) => ({
                // Only persist the components array, not UI state
                components: state.components,
            }),
        }
    )
);

// =============================================================================
// SELECTOR HOOKS (for performance optimization)
// =============================================================================

/**
 * Get the count of components in the library.
 */
export const useComponentCount = () =>
    useComponentLibraryStore((state) => state.components.length);

/**
 * Get filtered components using the current filters.
 */
export const useFilteredComponents = () =>
    useComponentLibraryStore((state) => {
        const { components, searchQuery, categoryFilter, showFavoritesOnly } = state;

        return components.filter((comp) => {
            if (showFavoritesOnly && !comp.isFavorite) return false;
            if (categoryFilter !== 'all' && comp.category !== categoryFilter) return false;

            if (searchQuery.trim()) {
                const query = searchQuery.toLowerCase();
                const matchesName = comp.name.toLowerCase().includes(query);
                const matchesDescription = comp.description?.toLowerCase().includes(query);
                const matchesTags = comp.tags.some((tag) => tag.toLowerCase().includes(query));

                if (!matchesName && !matchesDescription && !matchesTags) return false;
            }

            return true;
        });
    });

/**
 * Get the currently selected component.
 */
export const useSelectedComponent = () =>
    useComponentLibraryStore((state) => {
        const { components, selectedComponentId } = state;
        return components.find((c) => c.id === selectedComponentId) || null;
    });
