# App Factory - Claude Code Instructions

> **CRITICAL:** Always implement based on documented patterns, not memory.

## Before ANY File Creation

1. **Read `docs/delivery_state.json`** — Contains current state, patterns, dependencies
2. **Read `docs/TECHNICAL_REFERENCES.md`** — Contains verified patterns from official docs
3. **Read dependency files first** — Check `file_manifest[DOrd].deps` array
4. **Follow embedded patterns** — Use `patterns` section from delivery_state.json

## Priority Order for Technical Decisions

1. **FIRST:** `docs/TECHNICAL_REFERENCES.md` (verified patterns)
2. **SECOND:** Existing delivered files (D001-D032)
3. **THIRD:** `delivery_state.json` patterns section
4. **LAST:** Internal training data (only if above sources don't cover it)

## Delivery Rules (Non-Negotiable)

| Rule | Description |
|------|-------------|
| **Single-Touch** | Each file implemented exactly once at its DOrd position |
| **No Forward Refs** | Files may only import from LOWER DOrd IDs |
| **Complete at Delivery** | No stubs, placeholders, TODOs, or mock data |
| **Preserve Existing** | Do not modify delivered files unless explicitly requested |

## File Header Patterns

### Python Files
```python
"""
D{NNN} - {path}
===============
{description}

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Dependencies:
    - D{XXX}: {file} ({description})
"""
```

### Rust Files
```rust
//! D{NNN} - {path}
//! ===============
//! {description}
//!
//! Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
//! Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)
//!
//! Dependencies:
//!     - D{XXX}: {file}
```

### TypeScript/React Files
```typescript
/**
 * D{NNN} - {path}
 * ===============
 * {description}
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D{XXX}, D{YYY}
 *
 * Rules:
 *   - NO hardcoded colors, spacing, or sizes
 *   - ALL styling via Tailwind classes referencing design tokens
 */
```

## Architecture Reference

```
┌─────────────────────────────────────────────────────────────────┐
│ TAURI PROCESS                                                   │
│ ┌───────────────────┐      ┌─────────────────────────────────┐ │
│ │ React + TypeScript│ ←──→ │ Rust IPC Manager                │ │
│ │ (Factory GUI)     │      │ (Command handlers, State)       │ │
│ └───────────────────┘      └──────────────┬──────────────────┘ │
└────────────────────────────────────────────┼────────────────────┘
                                             │ stdin/stdout (JSON-RPC 2.0)
┌────────────────────────────────────────────┼────────────────────┐
│ PYTHON SUBPROCESS                          │                    │
│ ┌──────────────────────────────────────────▼──────────────────┐ │
│ │ Plugin Host (__main__.py)                                   │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│ │ Plugin A    │ │ Plugin B    │ │ Plugin C                    │ │
│ └─────────────┘ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

## Current State

- **Last Delivered:** Check `docs/delivery_state.json` → `last_delivered`
- **Next Files:** Check `docs/delivery_state.json` → `next_session.files_to_deliver`
- **Progress:** Check `docs/DELIVERY_TRACKER.md` for human-readable status

## Workflow Per Delivery

```
1. Read docs/delivery_state.json
2. Identify next DOrd (e.g., D033)
3. Read dependency files listed in file_manifest[D033].deps
4. Create file following patterns section
5. Update delivery_state.json:
   - Increment delivered_count
   - Update last_delivered
   - Change file status from "GAP" to "EXISTS"
   - Update next_session
6. Update docs/DELIVERY_TRACKER.md checklist
```

## Tech Stack (Locked)

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + TypeScript | ^18.3.1 / ^5.4.5 |
| Build | Vite + Tailwind CSS | ^5.2.0 / ^3.4.3 |
| Desktop | Tauri (Rust) | 1.8.x (NOT v2) |
| Backend | Python subprocess | 3.11.x |
| IPC | JSON-RPC 2.0 over stdio | N/A |
| Plugins | Pluggy pattern | stdlib only |

## Error Handling

- Python: Use `ErrorCodes` from `config/error_codes.yaml`
- Rust: Use custom `IpcError` enum matching error_codes.yaml
- TypeScript: Typed error responses from Rust commands

## DO NOT

- Use Tauri v2 APIs (we're on 1.8.x)
- Hardcode colors/spacing (use design tokens)
- Create stubs or TODOs
- Modify files already marked EXISTS
- Skip reading dependencies before writing