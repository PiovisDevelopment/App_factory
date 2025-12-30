# Implementation Plan - User Journey UJ-1.1.4: Import Third-Party Component

**Status:** Draft
**Date:** 2025-12-25
**Author:** Antigravity (AI Agent)

## 1. Goal Description

Ensure User Journey **UJ-1.1.4 "Import Third-Party Component"** is fully functional.
The goal is to allow users to import external UI components (e.g., from a URL) into the App Factory, satisfying Requirement **1.3b** ("Import wizard for third-party component URL") and Criterion **C10** ("FE Components Easy to Add").

## 2. Audit Findings & Gaps

### 2.1 Code Audit
*   **Gap 1 (UI - Missing Entry Point):** The `ComponentGallery` (D042) exists in the codebase but is **not integrated** into the main application layout (`App.tsx`). The Left Sidebar only displays the `PluginGallery`.
*   **Gap 2 (UI - Missing Import Trigger):** `ComponentGallery.tsx` lacks an "Import" button to trigger the import workflow.
*   **Gap 3 (Logic - Mocked Functionality):** `ImportWizard.tsx` relies on `mockFetchManifest` with hardcoded data. It does not perform actual network requests.
*   **Gap 4 (Logic - Missing Installation):** There is no logic to "install" the imported component (save the file to the project) once fetched.

### 2.2 User Verification (Browser UAT)
*   **Confirmed:** Sidebar shows "Plugins" but no "Components".
*   **Confirmed:** No "Import" button is visible anywhere in the UI.

## 3. Implementation Steps

### Phase 1: Integration & UI Wiring
*   **Modify `src/App.tsx`**:
    *   Refactor the Left Sidebar to include a **Toggle/Tab** system (Plugins vs. Components).
    *   Integrate `ComponentGallery` into the "Components" view.
    *   State management for switching views.
*   **Modify `src/components/factory/ComponentGallery.tsx`**:
    *   Add an **"Import" button** to the toolbar.
    *   Accept an `onImport` prop to trigger the wizard.

### Phase 2: Logic Implementation (ImportWizard)
*   **Modify `src/components/wizard/ImportWizard.tsx`**:
    *   **Replace Mock Fetch**: Use `@tauri-apps/api/http` (Client) to perform real network requests to the provided URL.
    *   **Implement Installation**:
        *   Add logic to save the fetched component (manifest + code) to the local file system.
        *   Target directory: `src/components/imported/` (or similar).
        *   Use `@tauri-apps/api/fs` `writeTextFile`.
    *   **Update State**: Ensure the UI reflects the success/failure of the operation.

### Phase 3: Wiring
*   **Update `App.tsx`**:
    *   Implement `handleImportComponent` function.
    *   Pass this handler to `ImportWizard`.
    *   Refresh `ComponentGallery` data after successful import (mocked list for now, or read from fs if possible). *Note: For this iteration, updating the in-memory list `components` state in `App` is sufficient to prove E2E functionality.*

## 4. Definition of Done & Acceptance Criteria

### Criteria
1.  **UI Visibility**: "Components" tab is visible in the Left Sidebar.
2.  **Gallery Access**: Clicking "Components" shows the `ComponentGallery`.
3.  **Import Trigger**: "Import" button opens the `ImportWizard` modal.
4.  **Functional Import**:
    *   User enters a valid URL (pointing to a raw JSON/Code file).
    *   Wizard fetches content (no mock delay).
    *   Wizard displays preview.
    *   "Install" button saves the component (simulated by adding to App state for verification if FS write is restricted, but best effort to use FS).
    *   New component appears in the Gallery.

### Risk Assessment
*   **Risk**: Low. Changes are additive to the UI.
*   **Impact**: Upstream - None. Downstream - Enables UJ-1.1.2 (Select Components).

## 5. Traceability Mapping

| ID | Requirement | Logic Implemented | Status |
| :--- | :--- | :--- | :--- |
| **UJ-1.1.4** | Import Third-Party Component | `ImportWizard.tsx` (Real Fetch) | **Pending** |
| **Req 1.3b** | Import wizard for third-party component URL | `ImportWizard.tsx` | **Pending** |
| **C10** | FE Components Easy to Add | `App.tsx` (Gallery Integration) | **Pending** |

## 6. Verification Plan

1.  Launch App.
2.  Click "Components" tab in Sidebar.
3.  Click "Import".
4.  Enter Test URL: `https://raw.githubusercontent.com/piovis/app-factory-templates/main/manifest.json` (or any accessible raw JSON).
5.  Verify Preview loads.
6.  Click Install.
7.  Verify Component appears in Gallery.
