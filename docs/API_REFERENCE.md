# D088 - API Reference

> Complete API reference for App Factory JSON-RPC methods and TypeScript interfaces.

## JSON-RPC 2.0 Protocol

### Request Format

```json
{
  "jsonrpc": "2.0",
  "method": "method_name",
  "params": { ... },
  "id": 1
}
```

### Response Format (Success)

```json
{
  "jsonrpc": "2.0",
  "result": { ... },
  "id": 1
}
```

### Response Format (Error)

```json
{
  "jsonrpc": "2.0",
  "error": {
    "code": -32000,
    "message": "Error message",
    "data": { ... }
  },
  "id": 1
}
```

---

## Plugin Methods

### plugin/list

List all discovered plugins.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "plugin/list",
  "params": {
    "include_invalid": false
  },
  "id": 1
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| include_invalid | boolean | No | Include plugins with invalid manifests |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": [
    {
      "name": "tts_kokoro",
      "version": "1.0.0",
      "contract": "tts",
      "display_name": "Kokoro TTS",
      "description": "Neural TTS",
      "status": "ready",
      "loaded": true
    }
  ],
  "id": 1
}
```

---

### plugin/load

Load a plugin by name.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "plugin/load",
  "params": {
    "name": "tts_kokoro",
    "config": {
      "model_path": "./models/kokoro",
      "device": "cuda"
    }
  },
  "id": 2
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Plugin name (folder name) |
| config | object | No | Plugin configuration |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "plugin": {
      "name": "tts_kokoro",
      "version": "1.0.0",
      "status": "ready"
    }
  },
  "id": 2
}
```

**Errors:**
| Code | Message |
|------|---------|
| -32000 | Plugin not found |
| -32002 | Plugin load failed |
| -32003 | Plugin initialization failed |
| -32005 | Plugin already loaded |

---

### plugin/unload

Unload a loaded plugin.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "plugin/unload",
  "params": {
    "name": "tts_kokoro",
    "force": false
  },
  "id": 3
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Plugin name |
| force | boolean | No | Force unload even if busy |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "message": "Plugin unloaded successfully"
  },
  "id": 3
}
```

---

### plugin/call

Call a method on a loaded plugin.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "plugin/call",
  "params": {
    "plugin": "tts_kokoro",
    "method": "synthesize",
    "args": {
      "text": "Hello, world!",
      "voice_id": "af_bella"
    },
    "timeout": 30000
  },
  "id": 4
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| plugin | string | Yes | Plugin name |
| method | string | Yes | Method to call |
| args | object | No | Method arguments |
| timeout | number | No | Timeout in milliseconds |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "audio_b64": "UklGRi...",
    "format": "wav",
    "sample_rate": 24000,
    "duration_ms": 1250
  },
  "id": 4
}
```

**Errors:**
| Code | Message |
|------|---------|
| -32000 | Plugin not found |
| -32001 | Plugin not ready |
| -32601 | Method not found |
| -32602 | Invalid params |

---

### plugin/health

Get plugin health status.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "plugin/health",
  "params": {
    "name": "tts_kokoro"
  },
  "id": 5
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| name | string | Yes | Plugin name |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "status": "ready",
    "message": "Plugin operational",
    "details": {
      "model_loaded": true,
      "voices_available": 5
    },
    "latency_ms": 2.5,
    "memory_mb": 512.0
  },
  "id": 5
}
```

---

### plugin/swap

Hot-swap a running plugin with a new version.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "plugin/swap",
  "params": {
    "old_plugin": "tts_kokoro",
    "new_plugin_path": "./plugins/tts_kokoro_v2",
    "preserve_state": true
  },
  "id": 6
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| old_plugin | string | Yes | Currently loaded plugin |
| new_plugin_path | string | Yes | Path to new plugin |
| preserve_state | boolean | No | Preserve plugin state |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "success": true,
    "old_version": "1.0.0",
    "new_version": "2.0.0",
    "state_preserved": true
  },
  "id": 6
}
```

**Errors:**
| Code | Message |
|------|---------|
| -32020 | Hot-swap failed |
| -32021 | Hot-swap rollback failed |

---

## System Methods

### system/status

Get Plugin Host system status.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "system/status",
  "params": {},
  "id": 10
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "version": "1.0.0",
    "uptime_seconds": 3600,
    "plugins_loaded": 3,
    "plugins_total": 5,
    "memory_mb": 256.0,
    "requests_processed": 1250
  },
  "id": 10
}
```

---

### system/discover

Trigger plugin discovery scan.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "system/discover",
  "params": {
    "paths": ["./plugins", "~/.appfactory/plugins"]
  },
  "id": 11
}
```

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "discovered": 5,
    "valid": 4,
    "invalid": 1,
    "plugins": [...]
  },
  "id": 11
}
```

---

### shutdown

Gracefully shutdown the Plugin Host.

**Request:**
```json
{
  "jsonrpc": "2.0",
  "method": "shutdown",
  "params": {
    "reason": "user_requested",
    "timeout": 10000
  },
  "id": 99
}
```

**Parameters:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| reason | string | No | Shutdown reason |
| timeout | number | No | Wait timeout for requests |

**Response:**
```json
{
  "jsonrpc": "2.0",
  "result": {
    "status": "shutting_down",
    "reason": "user_requested",
    "timestamp": "2025-12-24T12:00:00Z"
  },
  "id": 99
}
```

---

## Contract Method Reference

### TTS Contract Methods

#### synthesize

Convert text to audio.

```json
{
  "method": "plugin/call",
  "params": {
    "plugin": "tts_kokoro",
    "method": "synthesize",
    "args": {
      "text": "Hello, world!",
      "voice_id": "af_bella"
    }
  }
}
```

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| text | string | Yes | Text to synthesize |
| voice_id | string | No | Voice identifier |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| audio_b64 | string | Base64 encoded audio |
| format | string | Audio format (wav, mp3, etc.) |
| sample_rate | number | Sample rate in Hz |
| duration_ms | number | Audio duration |

---

#### get_voices

List available voices.

```json
{
  "method": "plugin/call",
  "params": {
    "plugin": "tts_kokoro",
    "method": "get_voices",
    "args": {}
  }
}
```

**Returns:**
```json
[
  {
    "id": "af_bella",
    "name": "Bella",
    "language": "en-US",
    "gender": "female",
    "style": "natural"
  }
]
```

---

### STT Contract Methods

#### transcribe

Transcribe audio to text.

```json
{
  "method": "plugin/call",
  "params": {
    "plugin": "stt_moon",
    "method": "transcribe",
    "args": {
      "audio_b64": "UklGRi...",
      "language": "en"
    }
  }
}
```

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| audio_b64 | string | Yes | Base64 encoded audio |
| language | string | No | Language code |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| text | string | Transcribed text |
| confidence | number | Confidence score (0-1) |
| language | string | Detected language |

---

#### start_stream / feed_audio / end_stream

Streaming transcription API.

```json
// Start session
{"method": "plugin/call", "params": {"plugin": "stt_moon", "method": "start_stream", "args": {"language": "en"}}}
// Response: {"session_id": "abc123"}

// Feed audio chunks
{"method": "plugin/call", "params": {"plugin": "stt_moon", "method": "feed_audio", "args": {"session_id": "abc123", "audio_b64": "..."}}}
// Response: {"partial": "Hello wo"}

// End session
{"method": "plugin/call", "params": {"plugin": "stt_moon", "method": "end_stream", "args": {"session_id": "abc123"}}}
// Response: {"text": "Hello world", "confidence": 0.95}
```

---

### LLM Contract Methods

#### complete

Generate text completion.

```json
{
  "method": "plugin/call",
  "params": {
    "plugin": "llm_ollama",
    "method": "complete",
    "args": {
      "prompt": "Write a haiku about programming:",
      "max_tokens": 100,
      "temperature": 0.7
    }
  }
}
```

**Arguments:**
| Name | Type | Required | Description |
|------|------|----------|-------------|
| prompt | string | Yes | Input prompt |
| max_tokens | number | No | Max tokens to generate |
| temperature | number | No | Sampling temperature |
| stop_sequences | array | No | Stop sequences |

**Returns:**
| Name | Type | Description |
|------|------|-------------|
| text | string | Generated text |
| tokens_used | number | Tokens consumed |
| finish_reason | string | Why generation stopped |

---

#### chat

Generate chat response.

```json
{
  "method": "plugin/call",
  "params": {
    "plugin": "llm_ollama",
    "method": "chat",
    "args": {
      "messages": [
        {"role": "system", "content": "You are a helpful assistant."},
        {"role": "user", "content": "What is the capital of France?"}
      ],
      "max_tokens": 100
    }
  }
}
```

**Returns:**
```json
{
  "message": {
    "role": "assistant",
    "content": "The capital of France is Paris."
  },
  "tokens_used": 42
}
```

---

## TypeScript Interfaces

### Plugin Types

```typescript
// Plugin manifest
interface PluginManifest {
  name: string;
  version: string;
  contract: string;
  entry_point: string;
  display_name?: string;
  description?: string;
  author?: string;
  dependencies?: string[];
  config_schema?: Record<string, unknown>;
}

// Plugin status
type PluginStatus =
  | "unloaded"
  | "initializing"
  | "ready"
  | "busy"
  | "error"
  | "shutting_down"
  | "stopped";

// Plugin info
interface Plugin {
  manifest: PluginManifest;
  path: string;
  status: PluginStatus;
  loaded: boolean;
  lastHealth?: HealthStatus;
}

// Health status
interface HealthStatus {
  status: PluginStatus;
  message: string;
  details?: Record<string, unknown>;
  latency_ms?: number;
  memory_mb?: number;
}
```

### IPC Types

```typescript
// JSON-RPC request
interface JsonRpcRequest {
  jsonrpc: "2.0";
  method: string;
  params?: Record<string, unknown> | unknown[];
  id?: string | number;
}

// JSON-RPC response
interface JsonRpcResponse<T = unknown> {
  jsonrpc: "2.0";
  result?: T;
  error?: JsonRpcError;
  id: string | number | null;
}

// JSON-RPC error
interface JsonRpcError {
  code: number;
  message: string;
  data?: unknown;
}
```

### Project Types

```typescript
// Project state
interface ProjectState {
  metadata: ProjectMetadata;
  screens: Record<string, ProjectScreen>;
  components: Record<string, ProjectComponent>;
  theme: ProjectTheme;
  buildConfig: ProjectBuildConfig;
}

// Project metadata
interface ProjectMetadata {
  name: string;
  description: string;
  version: string;
  author: string;
  createdAt: number;
  modifiedAt: number;
  filePath: string | null;
  tags: string[];
}

// Project screen
interface ProjectScreen {
  id: string;
  name: string;
  route: string;
  layout: ScreenLayout;
  componentIds: string[];
  isDefault: boolean;
}

// Project component
interface ProjectComponent {
  id: string;
  name: string;
  type: string;
  props: Record<string, unknown>;
  slots: ComponentSlot[];
  position: { x: number; y: number };
  size: { width: number; height: number };
}

// Component slot
interface ComponentSlot {
  id: string;
  name: string;
  contract: string;
  pluginId: string | null;
  required: boolean;
  config: Record<string, unknown>;
}
```

### Export Types

```typescript
// Export configuration
interface ExportConfig {
  outputDir: string;
  projectName: string;
  mode: "development" | "production";
  platform: "windows" | "macos" | "linux" | "all";
  includePythonRuntime: boolean;
  bundledPlugins: string[];
  appIcon: string | null;
  version: string;
  publisher: string;
  identifier: string;
  minify: boolean;
  sourceMaps: boolean;
  envVariables: Record<string, string>;
}

// Export result
interface ExportResult {
  success: boolean;
  manifest: ExportManifest | null;
  outputPath: string;
  error?: string;
  duration: number;
}

// Export manifest
interface ExportManifest {
  exportedAt: number;
  projectName: string;
  version: string;
  files: ExportedFile[];
  totalSize: number;
  plugins: string[];
  config: ExportConfig;
}
```

---

## Error Codes

### Standard JSON-RPC Errors

| Code | Name | Description |
|------|------|-------------|
| -32700 | Parse error | Invalid JSON |
| -32600 | Invalid Request | Not a valid Request object |
| -32601 | Method not found | Method does not exist |
| -32602 | Invalid params | Invalid method parameters |
| -32603 | Internal error | Internal JSON-RPC error |

### Server Errors

| Code | Name | Description |
|------|------|-------------|
| -32000 | Plugin not found | Plugin not loaded |
| -32001 | Plugin not ready | Plugin not in READY state |
| -32002 | Plugin load failed | Failed to load plugin |
| -32003 | Plugin init failed | initialize() failed |
| -32004 | Plugin shutdown failed | shutdown() failed |
| -32005 | Plugin already loaded | Plugin already loaded |
| -32010 | Contract mismatch | Wrong contract implementation |
| -32011 | Contract not found | Contract type not found |
| -32012 | Manifest invalid | Invalid manifest.json |
| -32013 | Manifest missing | No manifest.json |
| -32020 | Hot-swap failed | Hot-swap operation failed |
| -32021 | Rollback failed | Hot-swap rollback failed |
| -32030 | Discovery failed | Plugin discovery failed |
| -32040 | Health timeout | Health check timeout |
| -32050 | Resource exhausted | System resources exhausted |
| -32051 | Dependency missing | Missing Python package |
| -32052 | Model not found | Model file not found |

### Application Errors

| Code | Name | Contract |
|------|------|----------|
| 1000 | TTS synthesis failed | tts |
| 1001 | Voice not found | tts |
| 1002 | Text too long | tts |
| 1100 | Transcription failed | stt |
| 1101 | Invalid audio | stt |
| 1102 | Language not supported | stt |
| 1200 | Completion failed | llm |
| 1201 | Model not available | llm |
| 1202 | Context too long | llm |
| 1203 | Rate limited | llm |
| 1300 | MCP connection failed | mcp |
| 1301 | MCP tool not found | mcp |

---

## React Hooks Reference

### useIpc (D078)

```typescript
import { useIpc } from "../hooks/useIpc";

function MyComponent() {
  const { call, isLoading, error } = useIpc();

  const handleClick = async () => {
    const result = await call("plugin/call", {
      plugin: "tts_kokoro",
      method: "synthesize",
      args: { text: "Hello" }
    });
  };

  return (
    <button onClick={handleClick} disabled={isLoading}>
      {isLoading ? "Loading..." : "Synthesize"}
    </button>
  );
}
```

### usePlugin (D079)

```typescript
import { usePlugin } from "../hooks/usePlugin";

function PluginStatus({ pluginId }: { pluginId: string }) {
  const { plugin, health, isLoading, reload, unload } = usePlugin(pluginId);

  if (!plugin) return <div>Plugin not found</div>;

  return (
    <div>
      <h3>{plugin.manifest.display_name}</h3>
      <p>Status: {health?.status || "unknown"}</p>
      <button onClick={reload}>Reload</button>
      <button onClick={unload}>Unload</button>
    </div>
  );
}
```

---

*API Reference Version: 1.0 | Last Updated: 2025-12-24*
