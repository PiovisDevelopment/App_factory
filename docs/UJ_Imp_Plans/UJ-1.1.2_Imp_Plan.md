# Implementation Plan - UJ-1.1.2: Select Components from Gallery

## Goal Description
Enable the end-to-end functionality for User Journey **UJ-1.1.2: Select Components from Gallery**.
The user must be able to:
1.  View a gallery of FE UI components (e.g., Button, Input, Card).
2.  Search/Filter these components.
3.  **Multi-select** components using **checkboxes**.

Currently, the `ComponentGallery` code exists but is:
1.  Not integrated into the main `App.tsx` UI (only `PluginGallery` is shown).
2.  Missing multi-select logic (supports only single `selectedId`).
3.  Missing checkbox UI elements.

## User Review Required
> [!IMPORTANT]
> **UI Changes**: This plan introduces a new "Components" tab in the left sidebar of the Editor, allowing toggling between "Plugins" and "Components".
> **Interaction Model**: The gallery will support multi-selection via checkboxes, per requirement 1.2.

## Proposed Changes

### Frontend Components

#### [MODIFY] [ComponentGallery.tsx](file:///c:/Users/anujd/Documents/01_AI/173_piovisstudio/app_factory/src/components/factory/ComponentGallery.tsx)
*   **Props Update**:
    *   Deprecate `selectedId: string`.
    *   Add `selectedIds: string[]`.
    *   Update `onSelect` callback to `(component: ComponentInfo, selected: boolean) => void`.
*   **Logic**:
    *   Refactor `handleSelect` to toggle selection in the array.
    *   Pass `isSelected` state based on `selectedIds.includes(component.id)`.

#### [MODIFY] [ComponentGalleryItem (Internal)](file:///c:/Users/anujd/Documents/01_AI/173_piovisstudio/app_factory/src/components/factory/ComponentGallery.tsx)
*   **UI Update**:
    *   Add `<input type="checkbox">` element to the item card.
    *   Position checkbox clearly (e.g., top-right corner or alongside name).
    *   Ensure clicking the card triggers the checkbox/selection logic.

### Main Application Logic

#### [MODIFY] [App.tsx](file:///c:/Users/anujd/Documents/01_AI/173_piovisstudio/app_factory/src/App.tsx)
*   **State**:
    *   Add `selectedComponentIds` state variable.
    *   Add `sampleComponents` data (mock data for Buttons, Inputs, Cards, etc.) to populate the gallery.
    *   Add `sidebarTab` state (`'plugins' | 'components'`).
*   **UI**:
    *   Add a specific Toggle/Tab Switcher in the Left Sidebar Header to switch between "Plugins" and "Components".
    *   Render `ComponentGallery` when "Components" tab is active.
    *   Pass `sampleComponents` and selection handlers to `ComponentGallery`.

## Verification Plan

### Automated Tests
*   **Unit Tests**: Update tests for `ComponentGallery` if they exist (none found currently, so manual verification is primary).

### Manual Verification
1.  **Launch App**: Open `http://localhost:1420`.
2.  **Navigation**: Click "New Project" (or navigate to Editor).
3.  **Locate Tab**: Verify a "Components" tab exists in the left sidebar.
4.  **Gallery View**: Click "Components" and verify the list of components (Button, Input, etc.) appears.
5.  **Multi-Select**:
    *   Click the checkbox on "Button".
    *   Click the checkbox on "Card".
    *   Verify both remain selected.
6.  **Search**: Type "Button" in the search bar. Verify list filters correctly.

## Traceability Mapping
| Journey | Requirement | Component | Status |
|---------|-------------|-----------|--------|
| UJ-1.1.2| 1.2 (Gallery Checkbox) | ComponentGallery.tsx | **Target** |
| UJ-1.1.2| 1.2a (Filter/Search) | ComponentGallery.tsx | **Existing** |
| UJ-1.1.2| C10 (Easy Add) | App.tsx | **Target** |
