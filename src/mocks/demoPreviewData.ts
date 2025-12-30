/**
 * src/mocks/demoPreviewData.ts
 * ============================
 * Demo data for FE UI Preview demonstration.
 * Provides sample screen and component data for standalone preview testing.
 *
 * NOTICE TO AI ASSISTANTS:
 * ========================
 * This file contains mock/dummy data for preview demonstration.
 * Replace with production data sources when wiring to real project.
 * Search for "REPLACE_WITH_PRODUCTION" comments for integration points.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D045-D047 (Live preview panel requirements)
 */

import type { ProjectScreen, ProjectComponent } from '../stores/projectStore';

// =============================================================================
// DEMO SCREEN CONFIGURATION
// =============================================================================

// DUMMY_DATA_START: Demo screen for preview
// REPLACE_WITH_PRODUCTION: Load from projectStore.screens[screenId]
export const demoScreen: ProjectScreen = {
    id: 'demo-screen-1',
    name: 'Demo Preview Screen',
    type: 'main',
    rootComponentId: 'demo-container',
    route: '/',
    title: 'Demo Preview',
    isDefault: true,
    settings: {},
};
// DUMMY_DATA_END

// =============================================================================
// DEMO COMPONENT HIERARCHY
// =============================================================================

// DUMMY_DATA_START: Demo component tree for preview
// REPLACE_WITH_PRODUCTION: Load from projectStore.components
export const demoComponents: Record<string, ProjectComponent> = {
    // Root container
    'demo-container': {
        id: 'demo-container',
        type: 'panel',
        name: 'Demo Container',
        props: {
            title: 'Live Preview Demo',
            variant: 'elevated',
            padding: 'lg',
        },
        children: ['demo-form-section', 'demo-actions-section'],
        parentId: null,
        position: { x: 0, y: 0, width: 600, height: 400 },
        slots: [],
        styles: {},
        events: {},
        visible: true,
        locked: false,
    },

    // Form section
    'demo-form-section': {
        id: 'demo-form-section',
        type: 'panel',
        name: 'Form Section',
        props: {
            title: 'User Input',
            variant: 'outlined',
        },
        children: ['demo-input-name', 'demo-input-email', 'demo-select-option', 'demo-checkbox-agree'],
        parentId: 'demo-container',
        position: { x: 16, y: 60, width: 568, height: 200 },
        slots: [],
        styles: {},
        events: {},
        visible: true,
        locked: false,
    },

    // Text input - Name
    'demo-input-name': {
        id: 'demo-input-name',
        type: 'input',
        name: 'Name Input',
        props: {
            label: 'Full Name',
            placeholder: 'Enter your name...',
            type: 'text',
            required: true,
        },
        children: [],
        parentId: 'demo-form-section',
        position: { x: 8, y: 40, width: 260, height: 60 },
        slots: [],
        styles: {},
        events: { change: 'handleNameChange' },
        visible: true,
        locked: false,
    },

    // Text input - Email
    'demo-input-email': {
        id: 'demo-input-email',
        type: 'input',
        name: 'Email Input',
        props: {
            label: 'Email Address',
            placeholder: 'user@example.com',
            type: 'email',
            required: true,
        },
        children: [],
        parentId: 'demo-form-section',
        position: { x: 280, y: 40, width: 260, height: 60 },
        slots: [],
        styles: {},
        events: { change: 'handleEmailChange' },
        visible: true,
        locked: false,
    },

    // Select dropdown
    'demo-select-option': {
        id: 'demo-select-option',
        type: 'select',
        name: 'Category Select',
        props: {
            label: 'Category',
            placeholder: 'Select a category...',
            // Options provided by mockSelectOptions in previewMocks.ts
        },
        children: [],
        parentId: 'demo-form-section',
        position: { x: 8, y: 110, width: 260, height: 60 },
        slots: [],
        styles: {},
        events: { change: 'handleCategoryChange' },
        visible: true,
        locked: false,
    },

    // Checkbox
    'demo-checkbox-agree': {
        id: 'demo-checkbox-agree',
        type: 'checkbox',
        name: 'Agreement Checkbox',
        props: {
            label: 'I agree to the terms and conditions',
            checked: false,
        },
        children: [],
        parentId: 'demo-form-section',
        position: { x: 280, y: 120, width: 260, height: 40 },
        slots: [],
        styles: {},
        events: { change: 'handleAgreeChange' },
        visible: true,
        locked: false,
    },

    // Actions section
    'demo-actions-section': {
        id: 'demo-actions-section',
        type: 'panel',
        name: 'Actions Section',
        props: {
            variant: 'flat',
        },
        children: ['demo-btn-submit', 'demo-btn-cancel'],
        parentId: 'demo-container',
        position: { x: 16, y: 280, width: 568, height: 80 },
        slots: [],
        styles: {},
        events: {},
        visible: true,
        locked: false,
    },

    // Primary button
    'demo-btn-submit': {
        id: 'demo-btn-submit',
        type: 'button',
        name: 'Submit Button',
        props: {
            children: 'Submit',
            variant: 'primary',
            size: 'md',
        },
        children: [],
        parentId: 'demo-actions-section',
        position: { x: 8, y: 16, width: 120, height: 40 },
        slots: [],
        styles: {},
        events: { click: 'handleSubmit' },
        visible: true,
        locked: false,
    },

    // Secondary button
    'demo-btn-cancel': {
        id: 'demo-btn-cancel',
        type: 'button',
        name: 'Cancel Button',
        props: {
            children: 'Cancel',
            variant: 'secondary',
            size: 'md',
        },
        children: [],
        parentId: 'demo-actions-section',
        position: { x: 140, y: 16, width: 120, height: 40 },
        slots: [],
        styles: {},
        events: { click: 'handleCancel' },
        visible: true,
        locked: false,
    },
};
// DUMMY_DATA_END

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

/**
 * Load demo data into project store for preview testing.
 * REPLACE_WITH_PRODUCTION: Remove this function when using real project data.
 *
 * @param store - The project store instance
 */
export function loadDemoDataIntoStore(store: {
    screens: Record<string, ProjectScreen>;
    components: Record<string, ProjectComponent>;
}): void {
    // Merge demo data into store
    store.screens[demoScreen.id] = demoScreen;
    Object.entries(demoComponents).forEach(([id, component]) => {
        store.components[id] = component;
    });
}

/**
 * Get all demo component IDs.
 */
export function getDemoComponentIds(): string[] {
    return Object.keys(demoComponents);
}

/**
 * Get the root component ID for the demo screen.
 */
export function getDemoRootComponentId(): string {
    return demoScreen.rootComponentId || '';
}
