# User Journey Implementation Plan
**Target Journeys:** UJ-2.1.1, UJ-1.1.2, UJ-1.1.4

## 1. Executive Summary
This plan addresses the "Last Mile" integration gaps identified in the v5.0 Audit. By focusing on **User Journeys**, we ensure that not only do the components exist, but they function cohesively to deliver the intended value to the end user. The remediation targets Project Loading, Gallery Interactions, and Component Import flows.

---

## 2. Traceability Matrix Mapping

| Journey ID | Journey Name | Requirements Addressed | Success Criteria |
| :--- | :--- | :--- | :--- |
| **UJ-2.1.1** | Load Existing Project | **REQ E1.1** (Load Project Logic) | **C7** (Apps Pre-Wired), **C3** (Scalable Plugin Framework) |
| **UJ-1.1.2** | Select Plugin from Gallery | **REQ 1.2a/b** (Gallery Multi-select) | **C10** (FE Components Easy to Add) |
| **UJ-1.1.4** | Import Third-Party Component | **REQ 1.3b** (Import Wizard) | **C10** (FE Components Easy to Add), **C3** (Modules) |
| **UJ-B1.1*** | System Integrity (Backup) | **REQ B1.1** (System Backup/Restore) | **C11** (Graceful Isolation - Data Safety) |

*\*UJ-B1.1 is a proposed extension to ensure data integrity during remediation.*

---

## 3. Implementation Details

### 3.1 UJ-2.1.1: Load Existing Project
**Objective:** Enable the user to load a project from the disk, parsing its configuration to restore the editor state.

-   **File:** `src/stores/projectStore.ts`
    -   Action `loadProjectFromFile(path)`:
        -   Read `project.json` and `plugins.yaml`.
        -   Validate schema against strict types.
        -   Hydrate `projectStore` state.
-   **File:** `src/App.tsx`
    -   Implement "Mode Switching" Logic:
        -   `const [appMode, setAppMode] = useState<"launcher" | "editor">("launcher");`
    -   Render `ProjectLoader` when in `launcher` mode.
    -   On successful load, transition to `editor` mode (Factory Layout).

### 3.2 UJ-1.1.2: Select Components from Gallery
**Objective:** Allow users to select multiple items in the gallery and perform batch actions.

-   **File:** `src/components/gallery/GalleryManager.tsx`
    -   State: `selectedIds: Set<string>`.
    -   UI: Add Checkboxes to `ItemCard` and `ItemRow`.
    -   UI: Add Toolbar Actions:
        -   `Batch Install ({n})`: Loops through selected items and calls `onInstall`.
        -   `Batch Uninstall ({n})`: (If applicable).

### 3.3 UJ-1.1.4: Import Third-Party Component
**Objective:** Allow users to import components/plugins from external URLs.

-   **File:** `src/components/wizard/ImportWizard.tsx` (NEW)
    -   **Step 1:** Input Source URL (GitHub / Raw JSON).
    -   **Step 2:** Fetch & Validate Manifest (Mock or Real Request).
    -   **Step 3:** Preview Metadata (Name, Author, Version).
    -   **Step 4:** Confirm & Install (Updates `plugins.yaml` / Registry).
-   **File:** `src/components/gallery/GalleryManager.tsx`
    -   Add "Import" button to toolbar that opens `ImportWizard` modal.

### 3.4 UJ-B1.1: System Integrity
**Objective:** Prevent data loss during project updates.

-   **File:** `src/utils/backup.ts` (NEW)
    -   `createBackup(projectPath)`: Zips folder to `backups/timestamp_name.zip`.
    -   `restoreBackup(zipPath)`: Unzips to restore point.

---

## 4. Definition of Done (DoD)

1.  **Code Complete:** All listed files modified/created with 0 TypeScript errors.
2.  **Linting:** Code passes `npm run lint` with strict design token enforcement.
3.  **Tests:**
    -   Unit tests for `backup.ts`.
    -   Smoke test for `ProjectLoader` state transition.
4.  **UX verification:**
    -   No "flicker" during project load.
    -   Multi-select counters update instantly.
5.  **Documentation:**
    -   Update `USER_GUIDE.md` with "How to Import" and "How to Backup".

---

## 5. Acceptance Criteria (AC)

### AC-1: Project Load
-   [ ] Given I am on the start screen,
-   [ ] When I select a valid project folder,
-   [ ] Then the `FactoryLayout` loads with that specific project's name and plugins.

### AC-2: Gallery Batch
-   [ ] Given I am in the Gallery,
-   [ ] When I select 3 plugins and click "Install (3)",
-   [ ] Then all 3 plugins are added to the project's dependency list.

### AC-3: Import Flow
-   [ ] Given I have a valid GitHub URL for a component,
-   [ ] When I paste it into the Import Wizard,
-   [ ] Then I see a preview of the component metadata before installing.

### AC-4: Backup
-   [ ] Given I have an open project,
-   [ ] When I trigger a backup,
-   [ ] Then a Verified ZIP file appears in the `backups/` directory.
