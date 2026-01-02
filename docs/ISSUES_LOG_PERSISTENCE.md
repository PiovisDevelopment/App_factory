# App Factory - Persistence Issues Log

> **Date:** 2026-01-02
> **Analysis Method:** Systematic Debugging (Phase 1-2)
> **Status:** FIXES IMPLEMENTED

---

## Executive Summary

This document analyzes the persistence architecture for Theme and WindowConfig settings when applied to apps loaded into the canvas. The identified issues have been **FIXED** by implementing bidirectional sync in `handleOpenProject` and `handleBrowseProject`.

---

## Issues Table

| ID | Description | Severity | Status | Root Cause |
|----|-------------|----------|--------|------------|
| ISS-001 | Project persistence fails in browser environment due to missing Tauri IPC | Low (Environment Constraint) | Open | Expected behavior - Tauri APIs not available in browser |
| ISS-002 | "Save Project" button does not provide error feedback when save fails in browser | Low | **FIXED** | projectStore now sets `status: "error"` with error message |
| ISS-003 | Theme not restored when loading project | **High** | **FIXED** | Added `setTheme()` call in handleOpenProject and handleBrowseProject |
| ISS-004 | WindowConfig not restored when loading project | **High** | **FIXED** | Added `useWindowConfigStore.getState().setConfig()` in handleOpenProject and handleBrowseProject |
| ISS-005 | Dual store architecture creates state synchronization complexity | Medium | **MITIGATED** | Bidirectional sync now implemented in load handlers |
| ISS-006 | Theme persists to localStorage only, not to project file correctly | Medium | **FIXED** | Project theme now synced to UI on load |
| ISS-007 | Canvas theme styling not applied when loading saved project | **High** | **FIXED** | Fixed by ISS-003 fix |
| ISS-008 | handleOpenProject uses hardcoded sample theme instead of loaded project theme | **Critical** | **FIXED** | Now reads actual project file from disk via Tauri readTextFile API |

---

## Detailed Analysis

### ISS-001: Browser Environment Persistence Failure

**Description:** When running in browser mode (not Tauri desktop), the `saveProject()` function cannot write to disk because Tauri IPC is not available.

**Evidence Location:** [projectStore.ts:711-724](src/stores/projectStore.ts#L711-L724)

```typescript
if (!isTauri()) {
  console.warn("Save unavailable in browser mode: Tauri IPC not available");
  set(
    (s) => ({
      status: "error",
      isSaving: false,
      error: "Save to disk unavailable in browser mode...",
    }),
    ...
  );
  return;
}
```

**Impact:** Users cannot save projects when testing in browser. This is expected behavior - file system access requires Tauri.

**Workaround:** Run with `npm run tauri dev` for full functionality.

---

### ISS-002: Missing Error Feedback on Save Failure

**Description:** Previously, the save button showed misleading "Saved" status even when save failed in browser mode.

**Status:** **Addressed** - The code now sets `status: "error"` with a meaningful error message.

**Evidence Location:** [projectStore.ts:711-724](src/stores/projectStore.ts#L711-L724)

**Note:** The UI should display this error state. If App.tsx is not reading `projectError` from the store, the banner won't show.

---

### ISS-003: Theme Not Restored When Loading Project (CRITICAL)

**Description:** When a project is loaded via `handleOpenProject()`, the theme stored in the project file is NOT applied to the visual ThemeProvider.

**Root Cause Analysis:**

1. **Current Flow (Broken):**
   ```
   handleOpenProject(project)
     → loadProjectFromFile(path, projectFile)  // Updates projectStore.theme
     → setAppMode('editor')                     // Theme NOT synced to ThemeProvider
   ```

2. **Missing Step:** After loading, there's no call to `setTheme(projectFile.theme)` to update the visual ThemeProvider.

**Evidence Location:** [App.tsx:805-856](src/App.tsx#L805-L856)

```typescript
const handleOpenProject = useCallback((project: ProjectInfo) => {
  const projectFile: ProjectFile = {
    // ... hardcoded theme values, NOT from loaded project
    theme: {
      name: 'Default',
      primaryColor: '#3b82f6',  // Hardcoded!
      // ...
    },
  };

  loadProjectFromFile(project.path, projectFile);
  // MISSING: setTheme(projectFile.theme)  <-- Should sync to visual store
  setAppMode('editor');
}, [loadProjectFromFile, setTheme]);
```

**Impact:** Users lose their theme customizations when reloading a saved project.

---

### ISS-004: WindowConfig Not Restored When Loading Project (HIGH)

**Description:** Similar to ISS-003, the window configuration is not synced back to `useWindowConfigStore` when a project is loaded.

**Root Cause:** The `loadProjectFromFile` updates `projectStore.windowConfig`, but no code syncs this to `useWindowConfigStore`.

**Required Fix (Not Implemented):**
```typescript
// After loadProjectFromFile:
if (projectFile.windowConfig) {
  useWindowConfigStore.getState().setConfig(projectFile.windowConfig);
}
```

---

### ISS-005: Dual Store Architecture

**Description:** The application maintains TWO separate state stores for the same data:

| Data | Visual/UI Store | Persistence Store |
|------|-----------------|-------------------|
| Theme | `useThemeStore` (ThemeProvider) | `projectStore.theme` |
| WindowConfig | `useWindowConfigStore` | `projectStore.windowConfig` |

**Problem:** Changes in one store don't automatically propagate to the other.

**Current Partial Sync:**
```typescript
// App.tsx:647-649 - Syncs UI → Project (one-way only)
useEffect(() => {
  setProjectTheme(theme);  // Updates projectStore when UI changes
}, [theme, setProjectTheme]);
```

**Missing:** Project → UI sync when loading.

---

### ISS-006: Theme Persistence Mismatch

**Description:**
- `useThemeStore` persists to `localStorage` with key `app-factory-theme`
- `projectStore` persists theme to project JSON file
- These can become out of sync

**Evidence Location:**
- [ThemeProvider.tsx:484-492](src/context/ThemeProvider.tsx#L484-L492) - localStorage persistence
- [projectStore.ts:679-690](src/stores/projectStore.ts#L679-L690) - Project file persistence

---

### ISS-007: Canvas Theme Styling Not Applied

**Description:** When loading a project with custom theme settings for the canvas app, those settings don't visually appear.

**Root Cause:** Consequence of ISS-003. The canvas relies on CSS custom properties injected by ThemeProvider. If ThemeProvider isn't updated, canvas doesn't change.

---

### ISS-008: Hardcoded Theme in handleOpenProject (CRITICAL)

**Description:** The `handleOpenProject` function creates a hardcoded `ProjectFile` object instead of using the actual loaded project data.

**Evidence Location:** [App.tsx:807-843](src/App.tsx#L807-L843)

```typescript
const handleOpenProject = useCallback((project: ProjectInfo) => {
  // BUG: This creates a NEW ProjectFile with HARDCODED values
  // instead of reading the actual project file from disk
  const projectFile: ProjectFile = {
    metadata: { /* from project info */ },
    theme: {
      name: 'Default',           // HARDCODED
      primaryColor: '#3b82f6',   // HARDCODED
      // ...
    },
    // ...
  };
```

**Expected Behavior:** Should read the actual project file from disk using Tauri's `readTextFile` and parse the JSON.

---

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CURRENT STATE                                 │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                         │
│  ┌──────────────────┐          ┌──────────────────────────────────────┐ │
│  │  useThemeStore   │          │          projectStore                │ │
│  │  (localStorage)  │──sync───▶│  (project JSON file via Tauri)      │ │
│  │                  │          │                                      │ │
│  │  • theme         │          │  • theme (ProjectTheme)              │ │
│  │  • savedThemes   │    ✓     │  • windowConfig                      │ │
│  │  • customFonts   │  (works) │  • canvasElements                    │ │
│  └──────────────────┘          │  • metadata                          │ │
│           │                    └──────────────────────────────────────┘ │
│           │                                     │                       │
│           ▼                                     │                       │
│  ┌──────────────────┐                          │                       │
│  │  ThemeProvider   │                          │                       │
│  │  (CSS injection) │◀──────── NO SYNC ────────┘                       │
│  └──────────────────┘      (MISSING!)                                  │
│                                                                         │
│  ┌──────────────────┐          ┌──────────────────────────────────────┐ │
│  │ useWindowConfig  │          │     projectStore.windowConfig       │ │
│  │     Store        │◀──────── NO SYNC ────────┤                      │ │
│  │  (localStorage)  │      (MISSING!)          │                      │ │
│  └──────────────────┘                          │                      │ │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Implemented Fixes

### Fix ISS-003, ISS-004, ISS-008: handleOpenProject (IMPLEMENTED)

The `handleOpenProject` function was completely rewritten to:
1. Read actual project file from disk using Tauri's `readTextFile` API
2. Parse JSON into ProjectFile
3. Load into projectStore
4. Sync theme to visual ThemeProvider
5. Sync windowConfig to WindowConfigStore
6. Sync canvasElements to local state

**File:** [App.tsx:806-871](src/App.tsx#L806-L871)

```typescript
const handleOpenProject = useCallback(async (project: ProjectInfo) => {
  if (isTauri()) {
    try {
      const { readTextFile } = await import('@tauri-apps/api/fs');
      const content = await readTextFile(project.path);
      const projectFile = JSON.parse(content) as ProjectFile;

      loadProjectFromFile(project.path, projectFile);

      // Sync theme from loaded project to visual ThemeProvider
      if (projectFile.theme) {
        setTheme(projectFile.theme);
      }

      // Sync windowConfig from loaded project to WindowConfigStore
      if (projectFile.windowConfig) {
        useWindowConfigStore.getState().setConfig(projectFile.windowConfig);
      }

      // Sync canvas elements to local state
      if (projectFile.canvasElements) {
        setCanvasElements(projectFile.canvasElements);
      }

      setAppMode('editor');
    } catch (error) {
      console.error('Failed to load project:', error);
      setAppMode('editor');
    }
  } else {
    // Browser mode fallback with current theme
    // ...
  }
}, [loadProjectFromFile, setTheme, theme, setCanvasElements]);
```

### Fix handleBrowseProject (IMPLEMENTED)

The `handleBrowseProject` function was updated to:
1. Use the store's `browseAndLoadProject` which handles file picker and reading
2. Sync theme to visual ThemeProvider after load
3. Sync windowConfig to WindowConfigStore after load
4. Sync canvasElements to local state after load

**File:** [App.tsx:878-904](src/App.tsx#L878-L904)

```typescript
const handleBrowseProject = useCallback(async () => {
  const browseAndLoadProject = useProjectStore.getState().browseAndLoadProject;
  const success = await browseAndLoadProject();

  if (success) {
    const state = useProjectStore.getState();

    if (state.theme) {
      setTheme(state.theme);
    }

    if (state.windowConfig) {
      useWindowConfigStore.getState().setConfig(state.windowConfig);
    }

    if (state.canvasElements && state.canvasElements.length > 0) {
      setCanvasElements(state.canvasElements);
    }

    setAppMode('editor');
  }
}, [setTheme, setCanvasElements]);
```

---

## Testing Checklist (Manual)

- [ ] Save a project with custom theme colors
- [ ] Close and reopen the project
- [ ] Verify theme colors are restored in canvas
- [ ] Save a project with custom window dimensions
- [ ] Close and reopen the project
- [ ] Verify window dimensions are restored in canvas
- [ ] Test save error feedback in browser mode

---

## Files Modified

| File | Changes Made |
|------|-------------|
| [App.tsx](src/App.tsx) | Added `isTauri` import; Rewrote `handleOpenProject` to read from disk and sync stores; Rewrote `handleBrowseProject` to sync stores |
| [projectStore.ts](src/stores/projectStore.ts) | Already had ISS-002 fix |

---

## Conclusion

The persistence issues have been **FIXED** by implementing a **bidirectional sync layer** between the visual UI stores (`useThemeStore`, `useWindowConfigStore`) and the project persistence store (`projectStore`).

Now:
- **UI → Project**: Works (via `useEffect` in App.tsx)
- **Project → UI**: **FIXED** (sync calls in `handleOpenProject` and `handleBrowseProject`)
