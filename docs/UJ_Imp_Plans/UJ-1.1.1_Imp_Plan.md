# UJ-1.1.1 Implementation Plan: Preview FE UI

## Goal Description
Ensure User Journey **UJ-1.1.1: Preview FE UI** is fully functional.
Currently, the "Preview FE UI" and "Theme Customization" features are implemented as components (`ThemeCustomizationPanel`, `PreviewPanel`, `ThemePreview`) but are **not wired** into the main `App.tsx` layout. The features are inaccessible to the user (hidden).

This plan maps to **App_Factory_Traceability_Matrix_v5.0.md**:
- **UJ-1.1.1**: Preview FE UI
- **Criteria**: C7 (Apps Pre-Wired), C10 (FE Components Easy to Add/Preview)
- **Reqs**: 1.1, 1.1a, 1.1b, 1.4

## User Review Required
> [!IMPORTANT]
> This change modifies the main `App.tsx` layout to include a "Theme" overlay and a "Preview" bottom panel. This significantly changes the Editor UI user experience by adding new controls and panels.

## Current Gaps (Code Audit & UAT)
1.  **Wiring Gap**: `src/App.tsx` does not import or render `ThemeCustomizationPanel`, `PreviewPanel`, or `ThemePreview`.
2.  **UI Exposure Gap**: `AppHeader` (internal to `App.tsx`) lacks buttons to toggle the "Theme" or "Preview" panels.
3.  **UAT Failure**: Browser testing confirmed that "Theme" and "Preview" buttons/panels are completely missing from the Editor interface.

## Proposed Changes

### src/App.tsx
#### [MODIFY] [App.tsx](file:///C:/Users/anujd/Documents/01_AI/173_piovisstudio/app_factory/src/App.tsx)
-   **Import Components**:
    -   `ThemeCustomizationPanel` from `./components/ui/ThemeCustomizationPanel`
    -   `PreviewPanel` from `./components/factory/PreviewPanel`
    -   `ThemePreview` from `./components/ui/ThemePreview`
-   **Add State**:
    -   `isThemePanelOpen` (boolean)
    -   `showPreview` (boolean)
-   **Update `AppHeader`**:
    -   Add **"Theme"** button (toggles `isThemePanelOpen`).
    -   Add **"Preview"** button (toggles `showPreview`).
-   **Update `App` Render**:
    -   Render `<ThemeCustomizationPanel isOpen={isThemePanelOpen} onClose={() => setIsThemePanelOpen(false)} />` inside the `ThemeProvider` but outside `FactoryLayout` (as it is an overlay).
    -   Pass `<PreviewPanel><ThemePreview /></PreviewPanel>` as the `bottomPanel` prop to `FactoryLayout`.
    -   Set `bottomPanel` visible if `showPreview` is true (via initialPanels or Layout control).
    -   We will prioritize the layout showing the bottom panel.

## Verification Plan

### Automated Tests
-   None (Visual/UI interaction).

### Manual Verification (UAT script)
1.  **Launch Browser**: Open `http://localhost:1420`.
2.  **Open Project**: Enter Editor.
3.  **Verify UI**:
    -   [ ] Verify "Theme" button exists in Header.
    -   [ ] Verify "Preview Panel" appears at the bottom.
4.  **Test Journey UJ-1.1.1**:
    -   [ ] Click "Theme". Verify `ThemeCustomizationPanel` opens.
    -   [ ] Change a color (e.g., Primary 500).
    -   [ ] Verify the `PreviewPanel` (bottom) updates instantly to reflect the new color.
5.  **Success**: Components update < 500ms, matching design tokens.

## Definition of Done
-   [ ] `App.tsx` imports and renders missing panels.
-   [ ] `AppHeader` includes "Theme" button.
-   [ ] `PreviewPanel` containing `ThemePreview` is visible in the bottom layout.
-   [ ] Changing theme settings updates the preview in real-time.
