# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**App Factory** is a visual plugin framework for integrating TTS, STT, and LLM services. It uses **Plugin Option C**: Tauri 1.8.x (Rust) + React 18 (TypeScript) + Python 3.11 subprocess with JSON-RPC 2.0 IPC over stdio.

## Architecture At a Glance

```
┌─ TAURI PROCESS ──────────────────────────────────────────┐
│ React Components ◄──► Rust IPC Manager (stdin/stdout)    │
│ (src/components/)      (src-tauri/src/ipc/)              │
└──────────────────────────────────────────────────────────┘
                    │
                    ▼ JSON-RPC 2.0
┌─ PYTHON SUBPROCESS ──────────────────────────────────────┐
│ Plugin Host (plugins/_host/) ◄──► Plugin Instances       │
│ - Discovery                                              │
│ - Loader                                                 │
│ - Router                                                 │
└──────────────────────────────────────────────────────────┘
```

**Key Files by Layer**:
- **Frontend**: `src/` (React + TypeScript + Zustand stores)
- **Rust IPC**: `src-tauri/src/ipc/` (subprocess communication)
- **Plugin Host**: `plugins/_host/` (Python plugin management)
- **Config**: `config/` (design tokens, error codes, schemas)
- **Contracts**: `contracts/` (plugin interface definitions)

## Development Commands

### Local Workflow (Fast - for development)

```bash
npm run local:js    # oxlint (fast JS linting)
npm run local:ts    # tsc (type checking only)
npm run local:py    # ruff check (fast Python linting)
npm run local:rs    # cargo clippy (Rust linting)
npm run local:all   # Run all local checks
```

### CI Workflow (Strict - for commits/CI)

```bash
npm run ci:js:types    # tsc --noEmit (strict types)
npm run ci:js:lint     # eslint --max-warnings=0 (zero tolerance)
npm run ci:py          # ruff + mypy (full Python validation)
npm run ci:rs          # cargo clippy -D warnings + fmt check
npm run ci:validate    # Run all CI checks
npm run ci:build       # vite build
npm run ci:all         # Full CI pipeline
```

### Application Commands

```bash
npm run dev            # Start Vite dev server (port 1420)
npm run build          # Build frontend for production
npm run tauri dev      # Run Tauri in development mode
npm run tauri build    # Build Tauri application
```

## Architecture Details

### Frontend Layer (React + TypeScript)

**Location**: `src/`

- **State Management**: Three Zustand stores
  - `factoryStore`: UI state, canvas, selections
  - `pluginStore`: Plugin registry, health, status
  - `projectStore`: Project metadata, screens

- **Component Organization**:
  - `ui/`: Atomic components (Button, Input, Modal, etc.) - D010-D019
  - `factory/`: Main interface components - D040-D049
  - `wizard/`: Plugin creation workflow - D050-D054
  - `testing/`: Plugin testing harness - D057-D060
  - `project/`: Project management - D063-D068
  - `ai/`: AI-assisted features - D069-D073
  - `gallery/`: Gallery management - D040-D043

- **Styling**: All colors/spacing via Tailwind classes referencing CSS custom properties (design_tokens.css)
  - NO hardcoded colors, spacing, or sizes
  - Use Tailwind classes like `bg-primary-500`, `text-neutral-900`, `p-4`

### Rust IPC Layer (src-tauri/src/ipc/)

Bridges React and Python subprocess using JSON-RPC 2.0:

| Module | Responsibility |
|--------|----------------|
| spawn | Python subprocess lifecycle |
| request | JSON-RPC request building |
| response | Response parsing |
| health | Health monitoring |
| manager | IpcManager orchestration |
| commands | Tauri command handlers |

**Key Points**:
- One Python subprocess per app instance
- Unbuffered stdout (CRITICAL for Windows IPC)
- Automatic respawn on crash
- Timeout management for stuck plugins

### Plugin Host Layer (Python)

**Location**: `plugins/_host/`

| Module | Responsibility |
|--------|----------------|
| __main__ | Entry point, JSON-RPC loop |
| protocol | JSON-RPC router & method dispatch |
| discovery | Plugin discovery (folder scan + validation) |
| validator | Manifest validation against schema |
| loader | Plugin loading and initialization |
| manager | Plugin lifecycle (load, unload, hot-swap) |
| isolation | Execution isolation (temp dirs, resource limits) |
| shutdown | Graceful shutdown |
| scaffold | Plugin template generation |
| test_runner | Plugin testing harness |

**Plugin Lifecycle**:
```
UNLOADED → INITIALIZING → READY ↔ BUSY ↔ READY → SHUTTING_DOWN → STOPPED
```

### Plugin Layer

Located in `plugins/` directory. Each plugin is a folder with:
- `manifest.json`: Plugin metadata
- `plugin.py`: Implementation (extends PluginBase)
- `requirements.txt`: Dependencies

**Supported Contracts** (in `contracts/`):
- `base.py`: PluginBase ABC
- `tts.py`: Text-to-Speech
- `stt.py`: Speech-to-Text
- `llm.py`: Language Models

## Design System

### Design Tokens

CSS custom properties define all styling:

```css
/* Colors */
--color-primary-500, --color-neutral-900, --color-success-500, etc.

/* Spacing (4px grid) */
--space-0, --space-1, --space-2, ... --space-32

/* Typography */
--text-xs, --text-base, --text-xl, ...
--font-sans, --font-mono
--font-bold, --font-normal, ...

/* Shadows, Border Radius, Z-Index, etc. */
--shadow-md, --radius-md, --z-modal, ...
```

### Tailwind Integration

All Tailwind classes reference CSS variables:
```js
theme: {
  extend: {
    colors: {
      primary: { 500: "var(--color-primary-500)" },
      neutral: { 900: "var(--color-neutral-900)" },
      // ... etc
    },
    spacing: {
      "1": "var(--space-1)",
      "4": "var(--space-4)",
      // ... etc
    },
  }
}
```

## Configuration Files

| File | Purpose |
|------|---------|
| `config/design_tokens.css` | CSS custom properties |
| `tailwind.config.js` | Tailwind theme extending tokens |
| `config/manifest_schema.json` | Plugin manifest validation |
| `config/error_codes.yaml` | Standard error code mapping |
| `vite.config.ts` | Frontend build configuration |
| `src-tauri/Cargo.toml` | Rust dependencies |
| `tsconfig.json` | TypeScript compiler options |
| `pyproject.toml` | Python project config (ruff, mypy) |
| `.env.example` | Environment variables template |

## Error Handling

**Error Code Ranges**:

| Range | Category | Example |
|-------|----------|---------|
| -32700 to -32600 | JSON-RPC Standard | Parse error, Invalid request |
| -32000 to -32099 | Server Errors | Plugin not found, Load failed |
| 1000+ | Application | TTS failed, Model not found |

**Error Flow**:
```
Plugin Exception (Python)
  → JSON-RPC Error Response
  → Rust IpcError
  → Tauri Error
  → Frontend UI
```

## JSON-RPC 2.0 Protocol

### Request Format

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

### Response Format (Success)

```json
{
  "jsonrpc": "2.0",
  "result": {"audio_b64": "...", "format": "wav"},
  "id": 1
}
```

### Response Format (Error)

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

### Supported Methods

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

## Import Path Aliases

Configured in `tsconfig.json` and `vite.config.ts`:

```typescript
import Button from '@components/ui/button';        // src/components/ui/button
import { useFactory } from '@hooks/useFactory';    // src/hooks/useFactory
import { factoryStore } from '@stores/factory';    // src/stores/factory
import { THEME } from '@config/design_tokens';     // config/design_tokens.*
```

## File Organization Reference

| Path | Purpose |
|------|---------|
| `src/` | React + TypeScript frontend (components, stores, hooks) |
| `src-tauri/` | Tauri backend + Rust IPC (Python subprocess integration) |
| `plugins/` | Plugin folders (`manifest.json`, `plugin.py`, optional deps) |
| `plugins/_host/` | Python plugin host process (discovery, loader, router) |
| `contracts/` | Plugin contract interfaces (base, TTS, STT, LLM) |
| `config/` | Design tokens, schemas, and config data |
| `docs/` | Documentation and project policies |

## Code Patterns & Standards

### TypeScript Component Pattern

```typescript
/**
 * Brief description
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D0XX, D0YY
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 */

interface MyComponentProps {
  // ...
}

export function MyComponent({ /* props */ }: MyComponentProps) {
  return (
    <div className="p-4 bg-primary-500 text-neutral-900">
      {/* Always use Tailwind classes referencing tokens */}
    </div>
  );
}
```

### Python Module Pattern

```python
"""
D0XX - path/to/module.py
========================
Description

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Dependencies:
    - D0YY: file.py (description)
"""

import asyncio
from typing import Any

async def my_function() -> Any:
    """Function description."""
    pass
```

### Rust Module Pattern

```rust
//! ==========================
//! Description
//!
//! Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
//! Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)
//!
//! Dependencies:
```

## Delivery Rules (Non-Negotiable)

**Policy:** All contributions MUST adhere to [ANALYSIS_ENFORCEMENT.md](docs/ANALYSIS_ENFORCEMENT.md).

1. **Single-Touch**: Each file implemented exactly once at its DOrd position
2. **No Forward Refs**: Files may only import from LOWER DOrd IDs
3. **Complete at Delivery**: No stubs, placeholders, TODOs, or mock data
4. **Preserve Existing**: Do not modify delivered files unless explicitly requested

If you encounter a GAP file or need to add new functionality, check `docs/delivery_state.json` for dependencies and patterns.

## Testing & Validation

**Policy:** All contributions MUST adhere to [ANALYSIS_ENFORCEMENT.md](docs/ANALYSIS_ENFORCEMENT.md).

### Unit Tests

- Frontend: Use vanilla TypeScript (no test framework currently)
- Python: Use `pytest` with type hints
- Rust: Use `#[test]` and `#[tokio::test]`

### Running Validation

```bash
npm run ci:all    # Full validation pipeline (what CI runs)
npm run local:all # Fast local checks (use during development)
```

## Environment Setup

Create `.env` file from `.env.example`:

```env
LOG_LEVEL=info
PLUGIN_HOST_LOG_LEVEL=info
```

## Key Technologies

| Layer | Tech | Version |
|-------|------|---------|
| Desktop | Tauri | 1.8.x |
| Frontend | React | ^18.3.1 |
| Frontend | TypeScript | ~5.9.3 |
| Frontend | Tailwind CSS | ^3.4.3 |
| Frontend | Zustand | ^4.5.7 |
| Frontend | Vite | ^5.2.0 |
| Backend | Python | 3.11 |
| Backend | Pluggy | stdlib |
| Build | Rust | 1.70+ |
| IPC | JSON-RPC | 2.0 over stdin/stdout |

## Common Tasks

### Adding a New Component

1. Create file in `src/components/` (respecting category folder)
2. Use TypeScript + proper typing
3. Import only from lower-numbered D files
4. Use Tailwind classes only (no inline styles)
5. Run `npm run ci:js:types` to validate

### Adding a New Plugin

1. Create folder in `plugins/` with `manifest.json` and `plugin.py`
2. Extend appropriate contract (TTS, STT, or LLM)
3. Use async/await pattern
4. Run `npm run ci:py` to validate
5. Test via Plugin Testing harness (UI component)

### Modifying Rust IPC

1. Changes go in `src-tauri/src/ipc/`
2. Update corresponding JSON-RPC method
3. Run `npm run ci:rs` to validate
4. Test via Tauri dev mode

### Updating Design System

1. Add token to `config/design_tokens.css`
2. Reference in `tailwind.config.js` if new type
3. Update components to use new token
4. No magic numbers in components

## Documentation Files

| File | Purpose |
|------|---------|
| `README.md` | Project overview, quick start |
| `docs/ARCHITECTURE.md` | Detailed architecture |
| `docs/PLUGIN_DEVELOPMENT.md` | Plugin development guide |
| `docs/API_REFERENCE.md` | JSON-RPC API documentation |
| `docs/ANALYSIS_ENFORCEMENT.md` | Strict enforcement policy (linting, types, tests) |
| `docs/TROUBLESHOOTING.md` | Common issues |
| `docs/CHANGELOG.md` | Version history |

---