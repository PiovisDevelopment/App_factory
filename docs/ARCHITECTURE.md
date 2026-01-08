# App Factory Architecture

> Comprehensive architecture documentation for the App Factory plugin framework.

## Overview

App Factory implements **Plugin Option C**: a hybrid desktop architecture combining Tauri (Rust + React) with Python subprocess for plugin execution. This design enables:

- Native Windows desktop application with minimal footprint
- Type-safe frontend with React 18 and TypeScript
- Extensible plugin system via Python
- Real-time IPC using JSON-RPC 2.0 over stdio

## Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│ TAURI PROCESS (Single Executable)                                           │
│ ┌─────────────────────────────┐    ┌──────────────────────────────────────┐ │
│ │ React + TypeScript          │    │ Rust Backend                         │ │
│ │ ┌─────────────────────────┐ │    │ ┌──────────────────────────────────┐ │ │
│ │ │ Factory Components      │ │    │ │ IPC Manager (D030-D036)          │ │ │
│ │ │ - PluginGallery         │ │    │ │ - spawn.rs: Python subprocess    │ │ │
│ │ │ - CanvasEditor          │◄────►│ │ - request.rs: JSON-RPC builder   │ │ │
│ │ │ - PluginWizard          │invoke│ │ - response.rs: Response parser   │ │ │
│ │ │ - ProjectLoader         │ │    │ │ - health.rs: Health monitoring   │ │ │
│ │ │ - ChatInterface         │ │    │ │ - manager.rs: IpcManager struct  │ │ │
│ │ └─────────────────────────┘ │    │ └──────────────┬───────────────────┘ │ │
│ │ ┌─────────────────────────┐ │    │                │                      │ │
│ │ │ Zustand Stores          │ │    │ ┌──────────────▼───────────────────┐ │ │
│ │ │ - factoryStore          │ │    │ │ Tauri Commands                   │ │ │
│ │ │ - pluginStore           │ │    │ │ - plugin_list, plugin_load       │ │ │
│ │ │ - projectStore          │ │    │ │ - plugin_call, plugin_health     │ │ │
│ │ └─────────────────────────┘ │    │ └──────────────────────────────────┘ │ │
│ └─────────────────────────────┘    └──────────────────────────────────────┘ │
└────────────────────────────────────────────────┬────────────────────────────┘
                                                 │
                                                 │ stdin/stdout
                                                 │ JSON-RPC 2.0 (newline-delimited)
                                                 │
┌────────────────────────────────────────────────┼────────────────────────────┐
│ PYTHON SUBPROCESS                              │                            │
│ ┌──────────────────────────────────────────────▼──────────────────────────┐ │
│ │ Plugin Host (__main__.py)                                           │ │
│ │ ┌────────────────────────────────────────────────────────────────────┐  │ │
│ │ │ JSON-RPC Read Loop                                                  │  │ │
│ │ │ - Unbuffered stdout (CRITICAL for Windows IPC)                      │  │ │
│ │ │ - Request parsing and routing                                       │  │ │
│ │ │ - Response serialization                                            │  │ │
│ │ └────────────────────────────────────────────────────────────────────┘  │ │
│ │ ┌─────────────────────────┐  ┌─────────────────────────────────────┐   │ │
│ │ │ JsonRpcRouter           │  │ PluginManager                        │   │ │
│ │ │ - Method dispatch       │  │ - HybridDiscovery                    │   │ │
│ │ │ - Error handling        │  │ - PluginValidator                    │   │ │
│ │ │ - Timeout management    │  │ - PluginLoader                       │   │ │
│ │ └─────────────────────────┘  │ - Hot-swap with rollback             │   │ │
│ │                               └─────────────────────────────────────┘   │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
│ ┌─────────────────────────────────────────────────────────────────────────┐ │
│ │ Plugin Layer                                                            │ │
│ │ ┌────────────┐ ┌────────────┐ ┌────────────┐ ┌────────────────────────┐ │ │
│ │ │ tts_kokoro │ │ stt_moon   │ │ llm_ollama │ │ custom_plugin          │ │ │
│ │ │ (TTS)      │ │ (STT)      │ │ (LLM)      │ │ (Any Contract)         │ │ │
│ │ └────────────┘ └────────────┘ └────────────┘ └────────────────────────┘ │ │
│ └─────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Layer Breakdown

### 1. Frontend Layer (React + TypeScript)

**Location**: `src/`

The frontend provides the user interface for the App Factory, built with:

| Technology | Version | Purpose |
|------------|---------|---------|
| React | ^18.3.1 | UI framework |
| TypeScript | ~5.9.3 | Type safety |
| Vite | ^5.2.0 | Build tool |
| Tailwind CSS | ^3.4.3 | Styling |
| Zustand | ^4.x | State management |

**Key Components**:

- **UI Atoms**: Reusable UI primitives (Button, Input, Modal, etc.)
- **Factory Components**: Main factory interface
- **Wizard Components**: Plugin creation workflow
- **Testing Components**: Plugin testing harness
- **Project Components**: Project management
- **AI Components**: AI-assisted features

**State Management**:

```typescript
// Three Zustand stores manage application state
factoryStore   // Factory UI state, canvas, selections
pluginStore    // Plugin registry, status, health
projectStore   // Project metadata, screens, components
```

### 2. Rust IPC Layer

**Location**: `src-tauri/src/ipc/`

The Rust layer bridges React and Python:

| Module | File | Responsibility |
|--------|------|----------------|
| spawn | Python subprocess lifecycle |
| request | JSON-RPC request building |
| response | Response parsing |
| health | Health monitoring |
| manager | IpcManager orchestration |
| commands | Tauri command handlers |

**Key Patterns**:

```rust
// Sidecar pattern for Python subprocess
use tauri::api::process::{Command, CommandEvent};

// State management
struct AppState {
    ipc_manager: Mutex<IpcManager>,
}

// Async command handlers
#[tauri::command]
async fn plugin_call(
    state: State<'_, AppState>,
    plugin: String,
    method: String,
    params: Value,
) -> Result<Value, IpcError> { ... }
```

### 3. Plugin Host Layer (Python)

**Location**: `plugins/_host/`

The Plugin Host is the Python subprocess that manages plugins:

| Module | File | Responsibility |
|--------|------|----------------|
| __main__ | Entry point, JSON-RPC loop |
| protocol | JSON-RPC router |
| discovery | Plugin discovery |
| validator | Manifest validation |
| loader | Plugin loading |
| manager | Plugin lifecycle |
| isolation | Execution isolation |
| shutdown | Graceful shutdown |

### 4. Plugin Layer

**Location**: `plugins/`

Individual plugins implementing contracts:

| Contract | Location | Purpose |
|----------|----------|---------|
| base | `contracts/` | PluginBase ABC |
| tts | `contracts/` | Text-to-Speech |
| stt | `contracts/` | Speech-to-Text |
| llm | `contracts/` | Language Models |

## Communication Protocol

### JSON-RPC 2.0 over stdio

All communication between Rust and Python uses JSON-RPC 2.0:

```
┌────────────┐    stdin (request)     ┌─────────────┐
│   Rust     │ ──────────────────────► │   Python    │
│ IpcManager │                         │ Plugin Host │
│            │ ◄────────────────────── │             │
└────────────┘    stdout (response)    └─────────────┘
```

**Request Format**:

```json
{
  "jsonrpc": "2.0",
  "method": "plugin/call",
  "params": {
    "plugin": "tts_kokoro",
    "method": "synthesize",
    "args": {"text": "Hello", "voice_id": "af_bella"}
  },
  "id": 1
}
```

**Response Format (Success)**:

```json
{
  "jsonrpc": "2.0",
  "result": {"audio_b64": "...", "format": "wav"},
  "id": 1
}
```

**Response Format (Error)**:

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Plugin not found",
    "data": {"plugin": "unknown_plugin"}
  },
  "id": 1
}
```

### Method Routing

The JSON-RPC router dispatches methods:

| Method | Description |
|--------|-------------|
| `plugin/list` | List discovered plugins |
| `plugin/load` | Load a plugin |
| `plugin/unload` | Unload a plugin |
| `plugin/call` | Call plugin method |
| `plugin/health` | Get plugin health |
| `plugin/swap` | Hot-swap plugins |
| `system/status` | System status |
| `shutdown` | Graceful shutdown |

## Plugin System

### Plugin Discovery

HybridDiscovery scans for plugins:

1. **Folder Scan**: Enumerate `plugins/` directory
2. **Manifest Check**: Look for `manifest.json`
3. **Validation**: Verify against schema
4. **Contract Match**: Ensure contract exists

### Plugin Lifecycle

```
                  ┌──────────────┐
                  │   UNLOADED   │
                  └──────┬───────┘
                         │ load()
                  ┌──────▼───────┐
                  │ INITIALIZING │
                  └──────┬───────┘
                         │ initialize()
           ┌─────────────┼─────────────┐
           │             │             │
    ┌──────▼───────┐     │      ┌──────▼───────┐
    │    READY     │◄────┘      │    ERROR     │
    └──────┬───────┘            └──────────────┘
           │ method call
    ┌──────▼───────┐
    │     BUSY     │
    └──────┬───────┘
           │ complete
    ┌──────▼───────┐
    │    READY     │
    └──────┬───────┘
           │ unload()
    ┌──────▼───────┐
    │SHUTTING_DOWN │
    └──────┬───────┘
           │ shutdown()
    ┌──────▼───────┐
    │   STOPPED    │
    └──────────────┘
```

### Hot-Swap Mechanism

Plugins can be replaced at runtime:

1. **Capture State**: Save current plugin state
2. **Shutdown Old**: Call `shutdown()` on old plugin
3. **Load New**: Load new plugin from path
4. **Initialize**: Call `initialize()` on new plugin
5. **Restore State**: Apply captured state
6. **Rollback**: On failure, restore old plugin

## Design Tokens System

### CSS Custom Properties

All visual styling flows from `config/design_tokens.css`:

```css
:root {
  /* Colors */
  --color-primary-500: #3b82f6;
  --bg-primary: var(--color-neutral-50);
  --text-primary: var(--color-neutral-900);

  /* Spacing (4px grid) */
  --space-4: 1rem;

  /* Typography */
  --text-base: 1rem;
  --font-sans: ui-sans-serif, system-ui, ...;

  /* Shadows */
  --shadow-md: 0 4px 6px -1px rgb(0 0 0 / 0.1);
}
```

### Tailwind Integration

`tailwind.config.js` references CSS variables:

```javascript
theme: {
  extend: {
    colors: {
      primary: {
        500: "var(--color-primary-500)",
      },
    },
  },
}
```

### Usage in Components

```tsx
// Always use Tailwind classes referencing tokens
<button className="bg-primary-500 text-white px-4 py-2 rounded-md">
  Click me
</button>

// NEVER use hardcoded values
<button style={{ backgroundColor: '#3b82f6' }}> // ❌ Wrong
```

## Error Handling

### Error Code Hierarchy

| Range | Category | Example |
|-------|----------|---------|
| -32700 to -32600 | JSON-RPC Standard | Parse error, Invalid request |
| -32000 to -32099 | Server Errors | Plugin not found, Load failed |
| 1000+ | Application | TTS failed, Model not found |

### Error Flow

```
Plugin Error → Python Exception → JSON-RPC Error Response
     ↓
Rust IpcError → Tauri Error → Frontend ErrorBoundary
     ↓
User-friendly error message in UI
```

## Security Considerations

### Content Security Policy

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
```

### Plugin Isolation

- Each plugin runs in isolated execution context
- Resource limits prevent runaway plugins
- Sandboxing restricts filesystem access

### No Localhost/Ports

IPC uses stdio, not network sockets:
- No exposed ports
- No CORS issues
- Native process security

## Performance Optimizations

### Unbuffered IPC

Python stdout buffering disabled for real-time IPC:

```python
# At top of __main__.py
sys.stdout = io.TextIOWrapper(
    io.BufferedWriter(...),
    write_through=True
)
```

### Async Processing

- Rust: tokio async runtime
- Python: asyncio event loop
- Non-blocking IPC operations

### Resource Management

- Health monitoring detects stuck plugins
- Automatic recovery on failures
- Graceful shutdown with request draining

## File Manifest Reference

## File Manifest Reference

### Phase 0: Foundations
- Contracts, config files, error codes

### Phase 1: Atomic UI
- Button, Input, Select, Modal, Theme components

### Phase 2: Plugin Infrastructure
- Discovery, validation, loading, management

### Phase 3: Rust IPC
- IPC modules, Tauri commands

### Phase 4: Frontend Integration
- Gallery, Canvas, Inspector, Layout

### Phase 5: Plugin Creation
- Wizard, Scaffold, Testing

### Phase 6: App Management
- Project loader, AI features, Stores

### Phase 7: Production Export
- Exporter, Templates, Documentation

---

*Architecture Version: 1.0 | Last Updated: 2025-12-24*
