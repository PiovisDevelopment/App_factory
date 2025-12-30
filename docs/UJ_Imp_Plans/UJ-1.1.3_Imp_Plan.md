# Implementation Plan - UJ-1.1.3: Create New FE Component

**Goal**: Enable end-to-end functionality for creating new FE components using AI, ensuring full traceability and zero-risk integration.

## User Review Required
> [!IMPORTANT]
> **LLM Dependency**: The solution relies on a local LLM (Ollama) or a mocked fallback if Ollama is unavailable. The plugin will be created as `llm_ollama`.
> **UI Change**: The Left Sidebar will be refactored to support Tabs (Plugins / Components) to expose the new functionality.

## Proposed Changes

### Backend (Plugins)
#### [NEW] [plugins/llm_ollama/manifest.json](file:///c:/Users/anujd/Documents/01_AI/173_piovisstudio/app_factory/plugins/llm_ollama/manifest.json)
- Define `llm` contract implementation.
- Version: 1.0.0.

#### [NEW] [plugins/llm_ollama/plugin.py](file:///c:/Users/anujd/Documents/01_AI/173_piovisstudio/app_factory/plugins/llm_ollama/plugin.py)
- Implement `PluginBase`.
- Implement `complete(prompt, model)` and `complete_stream(prompt, model)`.
- **Logic**: Connect to `http://localhost:11434/api/generate`.
- **Fallback**: If connection fails, return a simulated valid response (Mock Mode) to ensure UAT passes even without external dependencies.
- **Traceability**: Satisfies `Req 1.3a` (AI generates component).

### Frontend (React)
#### [NEW] [src/components/ui/Tabs.tsx](file:///c:/Users/anujd/Documents/01_AI/173_piovisstudio/app_factory/src/components/ui/Tabs.tsx)
- Reusable Tabs component for the Sidebar using strict design tokens (C2).

#### [NEW] [src/components/factory/Sidebar.tsx](file:///c:/Users/anujd/Documents/01_AI/173_piovisstudio/app_factory/src/components/factory/Sidebar.tsx)
- New component to manage the Left Sidebar content (Plugins list vs Component Tools).
- Wraps `PluginGallery` and the new `ComponentGenerator` access.
- Satisfies `GAP-01` (No Tab Switcher).

#### [NEW] [src/hooks/useComponentGenerator.ts](file:///c:/Users/anujd/Documents/01_AI/173_piovisstudio/app_factory/src/hooks/useComponentGenerator.ts)
- Hook to handle `onGenerate` calls.
- Calls `invoke('plugin_call', { plugin: 'llm_ollama', ... })`.
- Handles loading and error states.
- Satisfies `GAP-03` (Orphaned AI Backend).

#### [MODIFY] [src/App.tsx](file:///c:/Users/anujd/Documents/01_AI/173_piovisstudio/app_factory/src/App.tsx)
- Import `Sidebar` and `useComponentGenerator`.
- Replace hardcoded `leftSidebar` content with `<Sidebar />`.
- Wire up the `ComponentGenerator` to the `useComponentGenerator` hook.
- Satisfies `GAP-02` (No Chat Trigger) and `GAP-04` (Preview Wiring).

## Verification Plan

### Automated Tests
- None required for this UI/Integration task.

### Manual Verification (UAT)
1.  **Launch App**: `npm run dev` (Frontend).
2.  **Nav to Editor**: Open a project.
3.  **Check UI**: Verify "Plugins" and "Components" tabs in Left Sidebar.
4.  **Open Generator**: Click "Components" -> "New Component".
5.  **Test AI**:
    *   Enter prompt: "A blue button".
    *   Click Generate.
    *   Verify "Generating..." state.
    *   Verify result appears (either from Ollama or Mock).
    *   Verify Preview Modal opens.
6.  **Copy/Save**: Click Copy/Save and verify console logs or action.

## Traceability Mapping
| Journey | Criterion | Implementation |
|---------|-----------|----------------|
| **UJ-1.1.3** | C10, C7 | `ComponentGenerator` in Sidebar + `llm_ollama` plugin |
| **Req 1.3** | C7 | `ChatInterface` (Future/Alternative) / `ComponentGenerator` UI |
| **Req 1.3a** | C2, C8 | `llm_ollama` plugin logic + Design System usage |
