# App Factory Requirements Traceability Matrix

## Single Source of Truth for Validation

**Document Purpose:** Bidirectional traceability between User Journeys, Requirements, Criteria, and Delivery Order  
**Architecture:** Tauri + React + Python Subprocess (stdio IPC — Plugin Option C)  
**Version:** 5.0  
**Date:** 24-Dec-2025

---

## Table of Contents

1. [The 12 Success Criteria](#1-the-12-success-criteria)
2. [User Questions → Requirements Mapping](#2-user-questions--requirements-mapping)
3. [User Journeys](#3-user-journeys)
4. [Complete Requirements with Full Traceability](#4-complete-requirements-with-full-traceability)
5. [Delivery Order → Requirements → Criteria Matrix](#5-delivery-order--requirements--criteria-matrix)
6. [Criteria → Delivery Order Reverse Lookup](#6-criteria--delivery-order-reverse-lookup)
7. [Acceptance Criteria](#7-acceptance-criteria)

---

## 1. The 12 Success Criteria

These are the non-negotiable criteria that define project success. Every requirement and delivery item must trace to at least one criterion.

| # | Criterion | Description | Verification Method |
|---|-----------|-------------|---------------------|
| C1 | FE/BE Complete Separation | Edit backend without impacting frontend, and vice versa | Architecture review: no shared imports between FE/BE |
| C2 | Strict FE Design System | Consistent new components via enforced design tokens | All components use only CSS variables from design_tokens.css |
| C3 | Scalable BE Plugin Framework | Consistent, predictable system for hot-swappable plugins | New plugin created in <5 min using contract template |
| C4 | Secrets/API Key Injection | Secrets injected into target apps from Factory | Exported app runs with injected .env values |
| C5 | Plugin Architecture Modular | Highly modular, logical plugin system | Each plugin folder self-contained with manifest.json |
| C6 | Folder Reflects Architecture | Project structure mirrors plugin architecture | Folder tree matches architecture diagram |
| C7 | Apps Pre-Wired via Factory | Apps mostly pre-wired, easy to install/configure | Export → install_dependencies.bat → run_app.bat succeeds |
| C8 | Well-Commented for Junior AI | Plugin code easy for AI coding assistant to manage | All public methods have docstrings with examples |
| C9 | Plugins Auto-Identifiable | New plugins automatically appear in Factory library | Drop plugin folder → appears in discovery within 5 sec |
| C10 | FE Components Easy to Add/Preview | New FE components added with minimum risk | Preview renders new component before code generation |
| C11 | Graceful Isolation + Health Check | Plugins register, health check, manage in isolation | Plugin crash doesn't crash main app; health_check() returns status |
| C12 | Async Plugins via Slots/Sockets | Main apps are collection of async plugins using slots | JSON-RPC IPC handles concurrent plugin requests |

---

## 2. User Questions → Requirements Mapping

*Original user questions from context_original_reqs.txt mapped to formal requirements*

### 2.1 New Target Application — FE UI

| Q# | User Question ("Can I...") | Req ID | Requirement Summary |
|----|----------------------------|--------|---------------------|
| 1.1.1 | Preview how the FE UI looks before it is developed? | 1.1 | Live preview panel updating in real-time |
| 1.1.2 | Multi-select any FE UI components that already exist from a gallery? | 1.2 | Component gallery with checkbox multi-select |
| 1.1.3 | Create new FE UI components that are missing/don't currently exist within the gallery for my new app? | 1.3 | Create new component via chat interface |
| 1.1.3a | Can the AI design the new FE UI components so that it seamlessly integrates with the wider design and other components? | 1.3a | AI generates code matching design system |
| 1.1.3b | Can I import new designs/components from third party libraries/galleries? | 1.3b | Import wizard for third-party component URLs |
| 1.1.4 | Add/change my FE UI theme e.g. change colors? | 1.4 | Theme customization panel with color pickers |
| 1.1.5 | Choose what features my FE UI will have e.g. fullscreen vs floating widget, invisible header, invisible window frame? | 1.5 | Window configuration panel with toggles |
| 1.1.6 | Change the proposed layout of a window? panel? widget? | 1.6 | Drag-and-drop layout editor with snap-to-grid |
| 1.1.7 | Can the AI create a mockup the FE UI by asking clarifying questions? | 1.7 | AI initiates structured conversation flow |
| 1.1.8 | Can the AI create a mockup of the FE UI based on my requirements? | 1.8 | AI accepts natural language requirements |
| 1.1.9 | Can the AI create a mockup of FE UI based on my previous preferences/patterns/logic I've used before? | 1.9 | AI analyzes previous apps for patterns |
| 1.1.10 | Can I see/load from previously saved/created FE UI templates? | 1.10 | Template browser with thumbnails |
| 1.1.10a | Can I save new templates to a library for future apps? | 1.10a | "Save as Template" button |

### 2.2 New Target Application — BE Solution

| Q# | User Question ("Can I...") | Req ID | Requirement Summary |
|----|----------------------------|--------|---------------------|
| 1.2.1 | See a hybrid process flow + solution design + architecture design blueprint of the backend solution before committing to it? | 2.1 | Backend blueprint view before commitment |
| 1.2.2 | Add/change/remove the components for my app? (e.g. TTS, LLM etc) | 2.2 | Plugin library browser with add/remove |
| 1.2.3 | Select the compatible plugins that I want for each component from a library of existing plugin-ins? | 2.3 | Plugin selection from compatible list |
| 1.2.4 | Can the AI recommend the optimal combination of plugins from my requirements? | 2.4 | AI plugin recommendation |
| 1.2.5a | Can I add new plugins from code snippets? | 2.5a | Accept code snippet, detect language |
| 1.2.5b | Can I add new plugins from repos cloned onto my local computer? | 2.5b | Accept GitHub repo URL, scan for modules |
| 1.2.6 | Add/view/delete/change the API keys where relevant to each component(s) from a library? | 2.6 | Secrets manager for API keys |
| 1.2.7 | Create/select/edit/change variables for each of my components where possible? e.g. table names, databases etc. | 2.7 | Variable configuration per plugin |
| 1.2.8 | Can an AI create the end-to-end BE solution, including data pipelines, creating DBs, datatables etc from my requirements + asking clarifying questions? | 2.8 | AI creates end-to-end BE solution |
| 1.2.9 | Can I test the BE functionality to ensure that it works BEFORE the entire application is made and without the FE UI? | 2.9 | "Test Backend Only" mode |
| 1.2.10 | Can I see the entire blueprint of the agreed backend once developed in an interactive screen? | 2.10 | Interactive blueprint panel |
| 1.2.10a | How the plugin's are connected? | 2.10a | View plugin connections with status |
| 1.2.10b | Which plugin's passed vs failed automated tests completed by within the app prior to export? | 2.10b | Test results panel per plugin |

### 2.3 Fullstack Solutions

| Q# | User Question ("Can I...") | Req ID | Requirement Summary |
|----|----------------------------|--------|---------------------|
| 1.3.1 | Can the AI determine the optimal end-to-end solution based on the end user goals + journies based on the available components and library of existing plugins? | 3.1 | AI determines optimal E2E solution |

### 2.4 Production

| Q# | User Question ("Can I...") | Req ID | Requirement Summary |
|----|----------------------------|--------|---------------------|
| 1.4.1 | Can I export the final version as self-contained application so that it can be used and installed on other windows computer(s)? | 4.1 | Export as self-contained ZIP |

### 2.5 Existing Applications — General

| Q# | User Question ("Can I...") | Req ID | Requirement Summary |
|----|----------------------------|--------|---------------------|
| 2.1.1 | Load the application, so that I can see the blueprint? | E1.1 | "Load Project" button |

### 2.6 Existing Applications — FE UI

| Q# | User Question ("Can I...") | Req ID | Requirement Summary |
|----|----------------------------|--------|---------------------|
| 2.2.1 | Add/edit/delete FE UI components? | E2.1 | Editable component list |
| 2.2.2 | Add/edit/delete screens, widgets? | E2.2 | Screen/widget tree view |

### 2.7 Existing Applications — BE

| Q# | User Question ("Can I...") | Req ID | Requirement Summary |
|----|----------------------------|--------|---------------------|
| 2.3.1 | Add/edit/delete existing plugins for existing component/slots (e.g. TTS, LLM integration)? | E3.1 | Plugin assignments in slot-based view |
| 2.3.2 | Can I add new component slots/sockets to an existing app? | E3.2 | "Add Component Slot" button |
| 2.3.3 | Can I hotswap out a plugin for another one in the same category from a library? | E3.3 | "Swap Plugin" button with validation |

### 2.8 General Features — Scalability

| Q# | User Question ("Can I...") | Req ID | Requirement Summary |
|----|----------------------------|--------|---------------------|
| 3.1.1 | Can I add new BE component categories e.g. Debugging (plugins), MCP (plugins), Docker (plugins)? These would create a new library category. | G1.1 | "Register New Contract Type" wizard |
| 3.1.2 | Can I add/remove/edit new components/widgets/dashboards/screens/panels into the FE UI Galley from within the App Factory? | G1.2a-d | FE UI Gallery management screens |
| 3.1.3 | Can I add/remove/edit new plugins into the BE Plugin library from within the App Factory? | G1.3 | BE Plugin library management |

### 2.9 General Features — Usability

| Q# | User Question ("Can I...") | Req ID | Requirement Summary |
|----|----------------------------|--------|---------------------|
| 3.2.1 | Sort/filter/search? | G2.1 | Sort/filter/search controls |

### 2.10 General Features — Progress Monitoring

| Q# | User Question ("Can I...") | Req ID | Requirement Summary |
|----|----------------------------|--------|---------------------|
| 3.3.1 | See progress of all steps? | G3.1 | Progress dashboard |
| 3.3.2 | See/track the state of development of the FE? | G3.2 | FE development state tracker |
| 3.3.3 | See/track the state of development of the BE? | G3.3 | BE development state tracker |
| 3.3.4 | See/track the state of testing? | G3.4 | Testing state tracker |

### 2.11 General Features — Self-Learning

| Q# | User Question ("Can I...") | Req ID | Requirement Summary |
|----|----------------------------|--------|---------------------|
| 3.4.1 | Does the App Factory get smarter the more I use it? | G4.1a | bug_fixes table for AI learning |
| 3.4.2 | Does the AI avoid the same mistakes? | G4.1b | AI queries bug_fixes before generating |
| 3.4.3 | Does the App Factory remember my preferences? | G5.1 | user_preferences table |

---

## 3. User Journeys

### 3.1 Journey Index

| Journey ID | Journey Name | Category | Related Requirements |
|------------|--------------|----------|---------------------|
| UJ-1.1.1 | Preview FE UI | New App - FE | 1.1 |
| UJ-1.1.2 | Select Components from Gallery | New App - FE | 1.2 |
| UJ-1.1.3 | Create New FE Component | New App - FE | 1.3, 1.3a |
| UJ-1.1.4 | Import Third-Party Component | New App - FE | 1.3b |
| UJ-1.1.5 | Customize Theme | New App - FE | 1.4 |
| UJ-1.1.6 | Configure Window Settings | New App - FE | 1.5 |
| UJ-1.1.7 | Arrange Layout | New App - FE | 1.6 |
| UJ-1.1.8 | AI Guided FE Design | New App - FE | 1.7, 1.8, 1.9 |
| UJ-1.1.9 | Use FE Template | New App - FE | 1.10 |
| UJ-1.1.10 | Save FE as Template | New App - FE | 1.10a |
| UJ-1.2.1 | View BE Blueprint | New App - BE | 2.1 |
| UJ-1.2.2 | Browse Plugin Library | New App - BE | 2.2, 2.3 |
| UJ-1.2.3 | AI Plugin Recommendation | New App - BE | 2.4 |
| UJ-1.2.4 | Add Plugin from Code Snippet | New App - BE | 2.5a |
| UJ-1.2.5 | Add Plugin from Repo | New App - BE | 2.5b |
| UJ-1.2.6 | Manage API Keys | New App - BE | 2.6 |
| UJ-1.2.7 | Configure Plugin Variables | New App - BE | 2.7 |
| UJ-1.2.8 | AI Generate BE Solution | New App - BE | 2.8 |
| UJ-1.2.9 | Test BE Without FE | New App - BE | 2.9 |
| UJ-1.2.10 | View Interactive Blueprint | New App - BE | 2.10, 2.10a, 2.10b |
| UJ-1.3.1 | AI Optimal E2E Solution | Fullstack | 3.1 |
| UJ-1.4.1 | Export Application | Production | 4.1 |
| UJ-2.1.1 | Load Existing Project | Existing - General | E1.1 |
| UJ-2.2.1 | Edit FE Components | Existing - FE | E2.1 |
| UJ-2.2.2 | Edit Screens/Widgets | Existing - FE | E2.2 |
| UJ-2.3.1 | Manage Plugin Assignments | Existing - BE | E3.1 |
| UJ-2.3.2 | Add Component Slot | Existing - BE | E3.2 |
| UJ-2.3.3 | Hotswap Plugin | Existing - BE | E3.3 |
| UJ-3.1.1 | Register New Contract Type | Factory - Scalability | G1.1 |
| UJ-3.1.2 | Manage FE Gallery | Factory - Scalability | G1.2a-d |
| UJ-3.1.3 | Manage BE Library | Factory - Scalability | G1.3 |
| UJ-3.2.1 | Search/Filter/Sort | Factory - Usability | G2.1 |
| UJ-3.3.1 | View Progress Dashboard | Factory - Monitoring | G3.1-G3.4 |
| UJ-3.4.1 | Factory Self-Learning | Factory - Learning | G4.1a, G4.1b, G5.1 |

### 3.2 Journey Details

#### UJ-1.1.1: Preview FE UI

**Entry:** User wants to see how UI will look before code generation  
**Criteria Addressed:** C7, C10  
**Steps:**
1. User opens App Factory
2. User navigates to FE UI panel
3. User makes selections (components, colors, layout)
4. Preview panel updates in real-time
5. User sees accurate representation of final UI

**Exit:** User has validated UI appearance before committing

**Success Criteria:**
- Preview renders within 500ms of change
- Preview matches final generated output 95%+

---

#### UJ-1.2.3: AI Plugin Recommendation

**Entry:** User has requirements but unsure which plugins to use  
**Criteria Addressed:** C3, C7  
**Steps:**
1. User describes requirements in chat
2. AI analyzes available plugins in library
3. AI recommends optimal combination
4. User reviews recommendations
5. User accepts/modifies selection
6. Plugins added to project

**Exit:** Optimal plugin combination selected

**Success Criteria:**
- AI recommendation matches user intent 80%+
- Recommended plugins are compatible with each other

---

#### UJ-1.4.1: Export Application

**Entry:** User has completed app design and testing  
**Criteria Addressed:** C4, C6, C7  
**Steps:**
1. User clicks "Export Project"
2. Factory generates self-contained ZIP
3. ZIP contains ALL source code
4. ZIP contains install_dependencies.bat
5. ZIP contains run_app.bat
6. Factory injects secrets from .env
7. User downloads ZIP

**Exit:** Self-contained exportable application

**Success Criteria:**
- ZIP extracts and runs on clean Windows PC
- All source code editable after export
- Secrets properly injected

---

#### UJ-2.3.3: Hotswap Plugin

**Entry:** User wants to swap one plugin for another of same type  
**Criteria Addressed:** C3, C11  
**Steps:**
1. User selects plugin slot
2. User clicks "Swap Plugin"
3. Modal shows compatible plugins (same contract)
4. User selects replacement plugin
5. Factory validates compatibility
6. Factory performs hot-swap
7. App continues running (no restart)

**Exit:** Plugin swapped without app restart

**Success Criteria:**
- Hot-swap completes in <2 seconds
- No data loss during swap
- Original plugin restored if swap fails

---

## 4. Complete Requirements with Full Traceability

### 4.1 Foundation Requirements (Phase 0)

| DOrd | Req ID | Requirement | Criteria | User Question | Journey |
|------|--------|-------------|----------|---------------|---------|
| D001 | F0.1 | `contracts/base.py` with PluginBase ABC: `initialize()`, `shutdown()`, `health_check()`, `get_manifest()` | C3, C5, C11 | — | — |
| D002 | F0.2 | `contracts/tts_contract.py`: `synthesize()`, `get_voices()`, `set_voice()` | C3, C5 | — | — |
| D003 | F0.3 | `contracts/stt_contract.py`: `transcribe()`, `start_streaming()`, `stop_streaming()` | C3, C5 | — | — |
| D004 | F0.4 | `contracts/llm_contract.py`: `complete()`, `complete_stream()`, `get_models()` | C3, C5 | — | — |
| D005 | F0.5 | `config/contract_prefixes.yaml`: valid prefixes `tts_`, `stt_`, `llm_`, `mcp_`, `debug_` | C3, C9 | — | — |
| D006 | F0.6 | `config/design_tokens.css`: CSS custom properties for colours, spacing, typography | C2 | — | — |
| D007 | F0.7 | `tailwind.config.js`: extends design tokens with semantic aliases | C2 | — | — |
| D008 | F0.8 | `config/manifest_schema.json`: plugin manifest structure | C3, C5 | — | — |
| D009 | F0.9 | `config/error_codes.yaml`: JSON-RPC error codes | C11 | — | — |

### 4.2 FE UI Design Requirements (Phase 1, 4)

| DOrd | Req ID | Requirement | Criteria | User Question | Journey |
|------|--------|-------------|----------|---------------|---------|
| D010-D015 | 1.4a-f | Atomic UI components (Button, Input, Select, Checkbox, Modal, Panel) using design tokens only | C2 | 1.1.4 | UJ-1.1.5 |
| D016 | 1.4 | ThemePreview.tsx for theme color preview | C2 | 1.1.4 | UJ-1.1.5 |
| D017-D018 | 1.4g-h | ThemeCustomizationPanel.tsx (D017) and ThemeProvider.tsx (D018) with immediate preview | C2, C10 | 1.1.4 | UJ-1.1.5 |
| D019 | 1.5 | Window configuration panel: fullscreen, floating, frameless, always-on-top | C7 | 1.1.5 | UJ-1.1.6 |
| D040-D042 | 1.2, 1.2a, 1.2b | Component gallery with checkbox multi-select and search/filter | C10 | 1.1.2 | UJ-1.1.2 |
| D043-D044 | G1.2a-b | FE UI Gallery for components and widgets | C10 | 3.1.2 | UJ-3.1.2 |
| D045-D047 | 1.1, 1.1a, 1.1b | Live preview panel with real-time updates and theme switching | C7, C10 | 1.1.1 | UJ-1.1.1 |
| D048-D049 | 1.6, 1.6a | Drag-and-drop layout editor with snap-to-grid | C7, C10 | 1.1.6 | UJ-1.1.7 |

### 4.3 Plugin Infrastructure Requirements (Phase 2)

| DOrd | Req ID | Requirement | Criteria | User Question | Journey |
|------|--------|-------------|----------|---------------|---------|
| D020 | P0.1 | `plugins/_host/discovery.py` scanning `./plugins/` for valid manifests | C3, C9 | — | — |
| D021 | P0.2a | `plugins/_host/__init__.py` package initialization with logging | C3, C5 | — | — |
| D022 | P0.3 | `plugins/_host/validator.py` validating manifests against schema | C3, C9 | — | — |
| D023 | P0.4 | `plugins/_host/loader.py` dynamically importing plugin modules | C3, C5 | — | — |
| D024 | P0.5 | `plugins/_host/manager.py` with lifecycle: load, unload, hot-swap, health | C3, C11 | — | — |
| D025 | P0.6 | `plugins/_host/__main__.py` with JSON-RPC read loop | C1, C12 | — | — |
| D026 | P0.7 | JSON-RPC routing: `plugin/list`, `plugin/load`, `plugin/unload`, `plugin/swap`, `plugin/health` | C1, C11 | — | — |
| D027-D029 | P0.8-P0.10 | Graceful shutdown (D027), crash isolation (D028), `config/contracts_registry.yaml` (D029) | C8, C11 | — | — |

### 4.4 Rust IPC Layer Requirements (Phase 3)

| DOrd | Req ID | Requirement | Criteria | User Question | Journey |
|------|--------|-------------|----------|---------------|---------|
| D030 | R0.1 | `src-tauri/src/ipc/mod.rs` with subprocess spawn via `Command::new` + piped stdio | C1 | — | — |
| D031-D032 | R0.2-R0.3 | `send_request()` and `read_response()` for JSON-RPC | C1, C12 | — | — |
| D033-D034 | R0.4-R0.5 | Request ID tracking with timeout, subprocess health monitor | C11 | — | — |
| D035 | R0.6 | Tauri commands: `invoke('plugin_list')`, `invoke('plugin_swap')`, `invoke('plugin_health')` | C1, C11 | — | — |
| D036 | R0.7 | Graceful shutdown in `RunEvent::ExitRequested` | C11 | — | — |

### 4.5 Plugin Creation Pipeline Requirements (Phase 5)

| DOrd | Req ID | Requirement | Criteria | User Question | Journey |
|------|--------|-------------|----------|---------------|---------|
| D050 | 2.1 | `src/pages/PluginWizard.tsx` with step-by-step plugin creation | C3, C7 | 1.2.1 | UJ-1.2.1 |
| D051 | 2.5a | Accept code snippet via paste/file-upload, detect language | C3 | 1.2.5a | UJ-1.2.4 |
| D052 | 2.3 | AST analysis to infer contract type from function signatures | C3 | 1.2.3 | UJ-1.2.2 |
| D053 | 2.4 | Generate plugin scaffold: `manifest.json`, `plugin.py`, `README.md` | C3, C8 | — | — |
| D054 | 2.5b | Accept GitHub repo URL, clone, scan for compatible Python modules | C3 | 1.2.5b | UJ-1.2.5 |
| D055 | 2.6 | Accept MCP server URL, wrap as `mcp_` prefixed plugin | C3 | — | — |
| D056 | 2.7 | Register new plugin in discovery, validate, update `plugins.yaml` | C3, C9 | 1.2.7 | UJ-1.2.7 |
| D057 | 2.8 | Display validation results: passed (✓), failed (✗), warnings (⚠) | C3 | — | — |
| D058-D061 | 2.9, 2.10, 2.10a, 2.10b | Test BE Only mode, interactive blueprint, test results | C3, C7 | 1.2.9, 1.2.10, 1.2.10a, 1.2.10b | UJ-1.2.9, UJ-1.2.10 |
| D062 | 3.1 | AI determines optimal E2E solution from goals + components | C3, C7 | 1.3.1 | UJ-1.3.1 |

### 4.6 Existing App Management Requirements (Phase 6)

| DOrd | Req ID | Requirement | Criteria | User Question | Journey |
|------|--------|-------------|----------|---------------|---------|
| D063 | E1.1 | "Load Project" button parsing `plugins.yaml` + `tauri.conf.json` | C7 | 2.1.1 | UJ-2.1.1 |
| D064 | E2.1 | Editable FE component list | C7, C10 | 2.2.1 | UJ-2.2.1 |
| D065 | E2.2 | Screen/widget tree view | C7, C10 | 2.2.2 | UJ-2.2.2 |
| D066 | E3.1 | Plugin assignments in slot-based view | C7, C11 | 2.3.1 | UJ-2.3.1 |
| D067 | E3.2 | "Add Component Slot" button | C3, C7 | 2.3.2 | UJ-2.3.2 |
| D068 | E3.3 | "Swap Plugin" button with validation and hot-swap | C3, C11 | 2.3.3 | UJ-2.3.3 |

### 4.7 AI Integration Requirements (Phase 6)

| DOrd | Req ID | Requirement | Criteria | User Question | Journey |
|------|--------|-------------|----------|---------------|---------|
| D069 | 1.3 | Chat interface for describing new FE components | C7, C10 | 1.1.3 | UJ-1.1.3 |
| D070 | 1.3a | AI generates component code matching design system | C2, C8, C10 | 1.1.3a | UJ-1.1.3 |
| D071 | 1.3b | Import wizard for third-party component URL | C10 | 1.1.3b | UJ-1.1.4 |
| D072 | 1.7 | AI initiates structured conversation before mockup | C7 | 1.1.7 | UJ-1.1.8 |
| D073 | G1.1 | "Register New Contract Type" wizard | C3 | 3.1.1 | UJ-3.1.1 |

### 4.8 General Features Requirements (Phase 6)

| DOrd | Req ID | Requirement | Criteria | User Question | Journey |
|------|--------|-------------|----------|---------------|---------|
| D074-D075 | G1.2c-d | FE UI Gallery for dashboards and screens/panels | C10 | 3.1.2 | UJ-3.1.2 |
| D076 | G4.1a | `bug_fixes` table in `factory.db` | C8 | 3.4.1 | UJ-3.4.1 |
| D077 | G4.1b | AI queries `bug_fixes` before generating | C8 | 3.4.2 | UJ-3.4.1 |
| D078 | G5.1 | `user_preferences` table | C4, C8 | 3.4.3 | UJ-3.4.1 |
| D079 | — | Secrets Manager UI: view/edit API keys | C4 | 1.2.6 | UJ-1.2.6 |

### 4.9 Production Export Requirements (Phase 7)

| DOrd | Req ID | Requirement | Criteria | User Question | Journey |
|------|--------|-------------|----------|---------------|---------|
| D080 | 4.1 | "Export Project" button generating self-contained ZIP | C4, C6, C7 | 1.4.1 | UJ-1.4.1 |
| D081 | 4.1a | ZIP contains ALL source code | C6, C7 | 1.4.1 | UJ-1.4.1 |
| D082 | 4.1b | Generate `install_dependencies.bat` | C7 | 1.4.1 | UJ-1.4.1 |
| D083 | 4.1c | Generate `run_app.bat` | C7 | 1.4.1 | UJ-1.4.1 |
| D084 | 4.1d | Inject secrets from Factory's `.env` | C4 | 1.4.1 | UJ-1.4.1 |
| D085 | 4.1e | Validate exported project runs offline | C7 | 1.4.1 | UJ-1.4.1 |

### 4.10 Documentation Requirements (Phase 7)

| DOrd | Req ID | Requirement | Criteria | User Question | Journey |
|------|--------|-------------|----------|---------------|---------|
| D086 | D1.1 | `docs/ARCHITECTURE.md` system architecture documentation | C7 | — | — |
| D087 | D1.2 | `docs/PLUGIN_DEVELOPMENT.md` | C3, C8 | — | — |
| D088 | D1.3 | `docs/API_REFERENCE.md` documenting JSON-RPC methods | C8 | — | — |
| D089 | D1.4a | `docs/TROUBLESHOOTING.md` troubleshooting guide | C7 | — | — |
| D090 | D1.5 | `CHANGELOG.md` | C8 | — | — |
| D091 | D1.6 | `docs/USER_GUIDE.md` with step-by-step instructions | C7 | — | — |
| B009 | D1.4 | Root `README.md` with quick start (Bootstrap phase) | C7 | — | — |

---

## 5. Delivery Order → Requirements → Criteria Matrix

| DOrd | Req ID(s) | User Question(s) | Journey(s) | Criteria |
|------|-----------|------------------|------------|----------|
| D001 | F0.1 | — | — | C3, C5, C11 |
| D002 | F0.2 | — | — | C3, C5 |
| D003 | F0.3 | — | — | C3, C5 |
| D004 | F0.4 | — | — | C3, C5 |
| D005 | F0.5 | — | — | C3, C9 |
| D006 | F0.6 | — | — | C2 |
| D007 | F0.7 | — | — | C2 |
| D008 | F0.8 | — | — | C3, C5 |
| D009 | F0.9 | — | — | C11 |
| D010-D015 | 1.4a-f | 1.1.4 | UJ-1.1.5 | C2 |
| D016 | 1.4 | 1.1.4 | UJ-1.1.5 | C2 |
| D017-D018 | 1.4g-h | 1.1.4 | UJ-1.1.5 | C2, C10 |
| D019 | 1.5 | 1.1.5 | UJ-1.1.6 | C7 |
| D020-D024 | P0.1-P0.5 | — | — | C3, C5, C9, C11 |
| D025-D029 | P0.6-P0.10 | — | — | C1, C8, C11, C12 |
| D030-D036 | R0.1-R0.7 | — | — | C1, C11, C12 |
| D040-D042 | 1.2, 1.2a, 1.2b | 1.1.2 | UJ-1.1.2 | C10 |
| D043-D044 | G1.2a-b | 3.1.2 | UJ-3.1.2 | C10 |
| D045-D047 | 1.1, 1.1a, 1.1b | 1.1.1 | UJ-1.1.1 | C7, C10 |
| D048-D049 | 1.6, 1.6a | 1.1.6 | UJ-1.1.7 | C7, C10 |
| D050-D057 | 2.1-2.8 | 1.2.1-1.2.7 | UJ-1.2.1-UJ-1.2.7 | C3, C7, C8, C9 |
| D058-D061 | 2.9-2.10b | 1.2.9-1.2.10b | UJ-1.2.9-UJ-1.2.10 | C3, C7 |
| D062 | 3.1 | 1.3.1 | UJ-1.3.1 | C3, C7 |
| D063-D068 | E1.1-E3.3 | 2.1.1-2.3.3 | UJ-2.1.1-UJ-2.3.3 | C3, C7, C10, C11 |
| D069-D073 | 1.3, 1.3a, 1.3b, 1.7, G1.1 | 1.1.3, 1.1.3a, 1.1.3b, 1.1.7, 3.1.1 | UJ-1.1.3, UJ-1.1.4, UJ-1.1.8, UJ-3.1.1 | C2, C3, C7, C8, C10 |
| D074-D079 | G1.2c-d, G4.1a-b, G5.1 | 3.1.2, 3.4.1-3.4.3 | UJ-3.1.2, UJ-3.4.1 | C4, C8, C10 |
| D080-D085 | 4.1, 4.1a-e | 1.4.1 | UJ-1.4.1 | C4, C6, C7 |
| D086-D090 | D1.1-D1.5 | — | — | C3, C7, C8 |

---

## 6. Criteria → Delivery Order Reverse Lookup

| Criterion | Delivery Orders | Count |
|-----------|-----------------|-------|
| C1 (FE/BE Separation) | D025-D036 | 12 |
| C2 (Strict FE Design System) | D006-D018, D070 | 14 |
| C3 (Scalable BE Plugin Framework) | D001-D005, D008, D020-D029, D050-D062, D067-D068, D073, D087 | 35 |
| C4 (Secrets Injection) | D078-D079, D080, D084 | 4 |
| C5 (Plugin Architecture Modular) | D001-D005, D008, D020-D024 | 13 |
| C6 (Folder Reflects Architecture) | D080-D081 | 2 |
| C7 (Apps Pre-Wired) | D019, D045-D050, D058-D090 | 40 |
| C8 (Well-Commented for AI) | D027-D029, D053, D070, D076-D078, D087-D090 | 12 |
| C9 (Plugins Auto-Identifiable) | D005, D020-D024, D056 | 7 |
| C10 (FE Components Easy to Add) | D017-D018, D040-D049, D064-D065, D069-D071, D074-D075 | 16 |
| C11 (Graceful Isolation) | D001, D009, D024-D036, D066-D068 | 17 |
| C12 (Async Plugins Slots/Sockets) | D025-D035 | 11 |

---

## 7. Acceptance Criteria

### 7.1 Criteria Acceptance Tests

| Criterion | Test | Pass Condition |
|-----------|------|----------------|
| C1 | Modify backend file, run FE | FE compiles and runs without backend change |
| C2 | Create new component | Component uses only design_tokens.css variables |
| C3 | Create new plugin from scratch | Plugin operational in <5 minutes using contract template |
| C4 | Export app with API keys | Exported .env contains all injected secrets |
| C5 | Inspect plugin folder | Contains manifest.json, plugin.py, no external dependencies |
| C6 | Compare folder tree to architecture diagram | 1:1 match |
| C7 | Export → fresh PC → install → run | App launches successfully |
| C8 | Open any plugin file | All public methods have docstrings |
| C9 | Drop new plugin folder → refresh | Plugin appears in library <5 seconds |
| C10 | Add new component via chat | Preview updates before code generated |
| C11 | Force plugin crash | Main app continues running |
| C12 | Send concurrent plugin requests | All requests handled without blocking |

### 7.2 User Journey Acceptance Tests

| Journey | Test | Pass Condition |
|---------|------|----------------|
| UJ-1.1.1 | Make FE selection | Preview updates within 500ms |
| UJ-1.2.3 | Request AI recommendation | AI suggests compatible plugins |
| UJ-1.4.1 | Click Export | ZIP contains all source + scripts |
| UJ-2.3.3 | Swap plugin | Swap completes without app restart |

---

## Document End

**Usage Notes for AI Coding Assistant:**
1. Use Section 5 to find what criteria a delivery order satisfies
2. Use Section 6 to find what delivery orders implement a criterion
3. Use Section 4 for full requirement details with traceability
4. Use Section 7 to verify implementation correctness
