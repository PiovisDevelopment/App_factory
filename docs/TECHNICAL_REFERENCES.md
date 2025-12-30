# App Factory — Technical References

> **Purpose:** This document contains verified technical patterns from official documentation.
> **Rule:** Claude Code MUST use these patterns over internal training data.

---

## 1. Official Documentation URLs

| Technology | URL | Purpose |
|------------|-----|---------|
| JSON-RPC 2.0 | https://www.jsonrpc.org/specification | IPC protocol spec |
| Pluggy | https://pluggy.readthedocs.io/en/stable/ | Python plugin framework |
| Tauri v1.8 Sidecar | https://v1.tauri.app/v1/guides/building/sidecar/ | Python subprocess spawning |
| Gemini API | https://ai.google.dev/gemini-api/docs | LLM integration (Phase 5+) |

---

## 2. JSON-RPC 2.0 Specification (Embedded)

**Source:** https://www.jsonrpc.org/specification

### Request Object

```json
{
  "jsonrpc": "2.0",
  "method": "plugin/call",
  "params": {"plugin": "tts_kokoro", "method": "synthesize", "args": {"text": "Hello"}},
  "id": 1
}
```

| Field | Type | Required | Description |
|-------|------|----------|-------------|
| jsonrpc | string | Yes | Must be "2.0" |
| method | string | Yes | Method name to invoke |
| params | object/array | No | Parameters for the method |
| id | string/number/null | Yes* | Request identifier (*omit for notifications) |

### Response Object (Success)

```json
{
  "jsonrpc": "2.0",
  "result": {"audio_b64": "...", "format": "wav"},
  "id": 1
}
```

### Response Object (Error)

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32601,
    "message": "Method not found",
    "data": {"method": "unknown_method"}
  },
  "id": 1
}
```

### Standard Error Codes

| Code | Message | Meaning |
|------|---------|---------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid Request | Not a valid Request object |
| -32601 | Method not found | Method does not exist |
| -32602 | Invalid params | Invalid method parameters |
| -32603 | Internal error | Internal JSON-RPC error |
| -32000 to -32099 | Server error | Reserved for implementation-defined errors |

---

## 3. Pluggy Pattern (Embedded)

**Source:** https://pluggy.readthedocs.io/en/stable/

### Hook Specification (Contract Definition)

```python
import pluggy

hookspec = pluggy.HookspecMarker("appfactory")
hookimpl = pluggy.HookimplMarker("appfactory")

class TTSSpec:
    """TTS contract specification."""
    
    @hookspec
    def synthesize(self, text: str, voice_id: str) -> bytes:
        """Synthesize text to audio bytes."""
        
    @hookspec
    def get_voices(self) -> list[dict]:
        """Return available voices."""
```

### Hook Implementation (Plugin)

```python
class KokoroTTSPlugin:
    """Kokoro TTS plugin implementation."""
    
    @hookimpl
    def synthesize(self, text: str, voice_id: str) -> bytes:
        # Actual implementation
        return audio_bytes
        
    @hookimpl
    def get_voices(self) -> list[dict]:
        return [{"id": "af_bella", "name": "Bella"}]
```

### Plugin Manager

```python
pm = pluggy.PluginManager("appfactory")
pm.add_hookspecs(TTSSpec)
pm.register(KokoroTTSPlugin())

# Call hook (returns list of results from all plugins)
results = pm.hook.synthesize(text="Hello", voice_id="af_bella")
```

**Key Points:**
- `1:N` calling — multiple plugins can implement same hook
- Results returned as list (even for single plugin)
- Use `firstresult=True` in hookspec for single-result hooks

---

## 4. Tauri v1.8 Sidecar Pattern (Embedded)

**Source:** https://v1.tauri.app/v1/guides/building/sidecar/

### tauri.conf.json Configuration

```json
{
  "tauri": {
    "bundle": {
      "externalBin": [
        "binaries/plugin_host"
      ]
    }
  }
}
```

### Rust Spawn Code

```rust
use tauri::api::process::{Command, CommandEvent};
use std::sync::Mutex;

struct AppState {
    child: Mutex<Option<CommandChild>>,
    stdin: Mutex<Option<ChildStdin>>,
}

fn spawn_plugin_host(app: &AppHandle) -> Result<(), String> {
    let (mut rx, child) = Command::new_sidecar("plugin_host")
        .expect("failed to create sidecar command")
        .spawn()
        .expect("failed to spawn sidecar");
    
    // Store child handle for later
    let state = app.state::<AppState>();
    *state.child.lock().unwrap() = Some(child);
    
    // Handle stdout/stderr in background
    tauri::async_runtime::spawn(async move {
        while let Some(event) = rx.recv().await {
            match event {
                CommandEvent::Stdout(line) => {
                    // Parse JSON-RPC response
                    println!("Received: {}", line);
                }
                CommandEvent::Stderr(line) => {
                    eprintln!("Plugin host: {}", line);
                }
                CommandEvent::Error(err) => {
                    eprintln!("Error: {}", err);
                }
                CommandEvent::Terminated(status) => {
                    println!("Plugin host exited: {:?}", status);
                }
                _ => {}
            }
        }
    });
    
    Ok(())
}
```

### Writing to stdin

```rust
use std::io::Write;

fn send_request(state: &AppState, request: &str) -> Result<(), String> {
    let mut stdin_guard = state.stdin.lock().unwrap();
    if let Some(stdin) = stdin_guard.as_mut() {
        writeln!(stdin, "{}", request)
            .map_err(|e| format!("Failed to write: {}", e))?;
        stdin.flush()
            .map_err(|e| format!("Failed to flush: {}", e))?;
    }
    Ok(())
}
```

---

## 5. Python stdout Buffering Fix (CRITICAL)

**Source:** PyInstaller Issue #8426, Tauri GitHub Issues

**Problem:** Python buffers stdout by default. Tauri receives nothing until buffer fills or process exits.

### Solution (Add at TOP of __main__.py)

```python
import sys
import io

# CRITICAL: Disable stdout buffering for IPC
# Must be BEFORE any other imports that might print
sys.stdout = io.TextIOWrapper(
    open(sys.stdout.fileno(), 'wb', 0),
    write_through=True
)
sys.stderr = io.TextIOWrapper(
    open(sys.stderr.fileno(), 'wb', 0),
    write_through=True
)
```

### Alternative (Per-message flush)

```python
import json

def send_response(response: dict):
    print(json.dumps(response), flush=True)
```

---

## 6. Proven Production References

| Pattern | Used By | Scale |
|---------|---------|-------|
| JSON-RPC over stdio | VS Code, Neovim LSP | 100+ LSP implementations |
| Pluggy plugin system | pytest | 100M+ downloads/month, 1400+ plugins |
| Tauri + Python sidecar | Evil Martians, Tauri docs | Production desktop apps |

---

## 7. Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│ TAURI PROCESS (Single Executable)                               │
│ ┌───────────────────┐      ┌─────────────────────────────────┐ │
│ │ React + TypeScript│ ←──→ │ Rust IPC Manager                │ │
│ │ (Factory GUI)     │ invoke()  (State, spawn, request/response) │
│ └───────────────────┘      └──────────────┬──────────────────┘ │
└────────────────────────────────────────────┼────────────────────┘
                                             │ stdin/stdout
                                             │ (JSON-RPC 2.0, newline-delimited)
┌────────────────────────────────────────────┼────────────────────┐
│ PYTHON SUBPROCESS                          │                    │
│ ┌──────────────────────────────────────────▼──────────────────┐ │
│ │ Plugin Host (__main__.py)                                   │ │
│ │ - Unbuffered stdout (CRITICAL)                              │ │
│ │ - JSON-RPC read loop                                        │ │
│ │ - Method routing via JsonRpcRouter                          │ │
│ └─────────────────────────────────────────────────────────────┘ │
│                              │                                  │
│ ┌────────────────────────────▼────────────────────────────────┐ │
│ │ PluginManager (Pluggy-based)                                │ │
│ │ - HybridDiscovery for plugin scanning                       │ │
│ │ - Contract validation                                       │ │
│ │ - Hot-swap with rollback                                    │ │
│ └─────────────────────────────────────────────────────────────┘ │
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────────────────────┐ │
│ │ tts_kokoro  │ │ stt_moon    │ │ llm_ollama                  │ │
│ │ (TTS)       │ │ (STT)       │ │ (LLM)                       │ │
│ └─────────────┘ └─────────────┘ └─────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

---

## 8. Tech Stack (Locked Versions)

| Layer | Technology | Version | Notes |
|-------|------------|---------|-------|
| Frontend | React + TypeScript | ^18.3.1 / ^5.4.5 | |
| Build | Vite + Tailwind CSS | ^5.2.0 / ^3.4.3 | |
| Desktop | Tauri | **1.8.x (NOT v2)** | v2 has breaking API changes |
| Backend | Python subprocess | 3.11.x | No FastAPI, no localhost |
| IPC | JSON-RPC 2.0 over stdio | N/A | Newline-delimited |
| Plugins | Pluggy | 1.5.0+ | stdlib only |
| State | Zustand | ^4.x | React state management |

---

## 9. Constraints (Non-Negotiable)

| Constraint | Reason |
|------------|--------|
| **No localhost/ports** | Single-process native feel |
| **No WebRTC** | Complexity, not needed for local IPC |
| **No FastAPI** | Avoided to prevent browser-like architecture |
| **Tauri v1.8 only** | v2 has incompatible sidecar API |
| **Windows 11 native** | No WSL, no Docker |

---

## Document Metadata

| Field | Value |
|-------|-------|
| Version | 1.0 |
| Created | 2025-12-23 |
| Source Conversations | `Hotswappable plugin creation mechanisms`, `Plugin framework reference guide` |
| Verification | Patterns verified against official docs |