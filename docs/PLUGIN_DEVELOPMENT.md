# D087 - Plugin Development Guide

> Complete guide for creating plugins for the App Factory framework.

## Overview

App Factory uses a contract-based plugin system powered by Python. Plugins:

- Implement standardized contracts (TTS, STT, LLM, etc.)
- Communicate via JSON-RPC 2.0 over stdio
- Support hot-swapping at runtime
- Are discovered automatically via manifest files

## Quick Start

### 1. Create Plugin Folder

```
plugins/
└── my_tts_plugin/
    ├── manifest.json     # Required: Plugin metadata
    ├── __init__.py       # Required: Plugin entry point
    └── requirements.txt  # Optional: Dependencies
```

### 2. Define Manifest

Create `manifest.json`:

```json
{
  "name": "my_tts_plugin",
  "version": "1.0.0",
  "contract": "tts",
  "entry_point": "__init__",
  "display_name": "My TTS Plugin",
  "description": "A custom text-to-speech plugin",
  "author": "Your Name",
  "dependencies": [],
  "config_schema": {
    "type": "object",
    "properties": {
      "voice": {
        "type": "string",
        "default": "default"
      }
    }
  }
}
```

### 3. Implement Contract

Create `__init__.py`:

```python
"""My TTS Plugin implementation."""

from contracts.tts_contract import TTSContract
from contracts.base import HealthStatus, PluginStatus

class MyTTSPlugin(TTSContract):
    """Custom TTS plugin implementation."""

    async def initialize(self, config: dict) -> bool:
        """Initialize plugin with configuration."""
        self._voice = config.get("voice", "default")
        self._status = PluginStatus.READY
        return True

    async def shutdown(self) -> bool:
        """Clean up resources."""
        self._status = PluginStatus.STOPPED
        return True

    def health_check(self) -> HealthStatus:
        """Report health status."""
        return HealthStatus(
            status=self._status,
            message="Plugin operational"
        )

    async def synthesize(self, text: str, voice_id: str = None) -> bytes:
        """Convert text to speech audio."""
        # Your TTS implementation here
        audio_bytes = self._generate_audio(text, voice_id or self._voice)
        return audio_bytes

    async def get_voices(self) -> list[dict]:
        """List available voices."""
        return [
            {"id": "default", "name": "Default Voice", "language": "en-US"}
        ]
```

## Contract Reference

### PluginBase (D001)

All plugins must extend from a contract, which extends `PluginBase`:

```python
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional

class PluginBase(ABC):
    """Abstract base class for all plugins."""

    @abstractmethod
    async def initialize(self, config: Dict[str, Any]) -> bool:
        """Initialize plugin with configuration."""
        pass

    @abstractmethod
    async def shutdown(self) -> bool:
        """Shutdown plugin and release resources."""
        pass

    @abstractmethod
    def health_check(self) -> HealthStatus:
        """Check plugin health status."""
        pass
```

### Available Contracts

#### TTS Contract (D002)

```python
from contracts.tts_contract import TTSContract

class MyPlugin(TTSContract):
    async def synthesize(self, text: str, voice_id: str = None) -> bytes:
        """Convert text to audio bytes."""
        ...

    async def get_voices(self) -> list[dict]:
        """Return available voices."""
        ...

    async def get_voice_info(self, voice_id: str) -> dict:
        """Return voice metadata."""
        ...
```

#### STT Contract (D003)

```python
from contracts.stt_contract import STTContract

class MyPlugin(STTContract):
    async def transcribe(self, audio: bytes, language: str = None) -> str:
        """Convert audio to text."""
        ...

    async def get_languages(self) -> list[dict]:
        """Return supported languages."""
        ...

    async def start_stream(self) -> str:
        """Start streaming transcription session."""
        ...

    async def feed_audio(self, session_id: str, audio_chunk: bytes) -> dict:
        """Feed audio chunk to streaming session."""
        ...

    async def end_stream(self, session_id: str) -> str:
        """End streaming session and get final result."""
        ...
```

#### LLM Contract (D004)

```python
from contracts.llm_contract import LLMContract

class MyPlugin(LLMContract):
    async def complete(
        self,
        prompt: str,
        max_tokens: int = 1024,
        temperature: float = 0.7,
        stop_sequences: list[str] = None
    ) -> str:
        """Generate text completion."""
        ...

    async def chat(
        self,
        messages: list[dict],
        max_tokens: int = 1024,
        temperature: float = 0.7
    ) -> dict:
        """Generate chat response."""
        ...

    async def get_models(self) -> list[dict]:
        """Return available models."""
        ...

    async def stream_complete(
        self,
        prompt: str,
        max_tokens: int = 1024,
        temperature: float = 0.7
    ) -> AsyncIterator[str]:
        """Stream text completion."""
        ...
```

## Manifest Schema

### Required Fields

| Field | Type | Description |
|-------|------|-------------|
| `name` | string | Unique identifier (must match folder name) |
| `version` | string | Semantic version (e.g., "1.0.0") |
| `contract` | string | Contract type (tts, stt, llm, etc.) |
| `entry_point` | string | Python module path |

### Optional Fields

| Field | Type | Description |
|-------|------|-------------|
| `display_name` | string | Human-readable name |
| `description` | string | Plugin description |
| `author` | string | Author name |
| `dependencies` | array | pip package requirements |
| `config_schema` | object | JSON Schema for config |

### Example Manifest

```json
{
  "name": "tts_kokoro",
  "version": "1.2.0",
  "contract": "tts",
  "entry_point": "main",
  "display_name": "Kokoro TTS",
  "description": "High-quality neural TTS using Kokoro models",
  "author": "Piovis Development",
  "dependencies": [
    "torch>=2.0.0",
    "soundfile>=0.12.0",
    "numpy>=1.24.0"
  ],
  "config_schema": {
    "type": "object",
    "properties": {
      "model_path": {
        "type": "string",
        "description": "Path to model weights"
      },
      "device": {
        "type": "string",
        "enum": ["cpu", "cuda"],
        "default": "cpu"
      },
      "sample_rate": {
        "type": "integer",
        "default": 24000
      }
    },
    "required": ["model_path"]
  }
}
```

## Plugin Lifecycle

### 1. Discovery

The Plugin Host discovers plugins by:

1. Scanning the `plugins/` directory
2. Finding folders with `manifest.json`
3. Validating manifest against schema
4. Registering plugin metadata

### 2. Loading

When a plugin is loaded:

1. Import the entry point module
2. Find the contract class
3. Instantiate the plugin
4. Set the manifest

### 3. Initialization

The `initialize(config)` method is called:

1. Receives configuration dictionary
2. Plugin sets up resources (models, connections)
3. Returns `True` on success
4. Status transitions to `READY`

### 4. Operation

During normal operation:

1. Plugin receives method calls via JSON-RPC
2. Executes contract methods
3. Returns results or raises errors
4. Health checks run periodically

### 5. Shutdown

When the plugin is unloaded:

1. `shutdown()` method is called
2. Plugin releases resources
3. Status transitions to `STOPPED`

## Health Monitoring

Plugins report health via `health_check()`:

```python
def health_check(self) -> HealthStatus:
    """Report current plugin health."""
    return HealthStatus(
        status=PluginStatus.READY,  # Current status
        message="Operating normally",  # Status message
        details={                    # Optional diagnostics
            "model_loaded": True,
            "requests_processed": 42,
        },
        latency_ms=2.5,             # Optional response time
        memory_mb=256.0,            # Optional memory usage
    )
```

### Status Values

| Status | Description |
|--------|-------------|
| `UNLOADED` | Not yet initialized |
| `INITIALIZING` | Starting up |
| `READY` | Fully operational |
| `BUSY` | Processing request |
| `ERROR` | Recoverable error |
| `SHUTTING_DOWN` | Stopping |
| `STOPPED` | Cleanly stopped |

## Error Handling

### Raising Errors

Use error codes from `config/error_codes.yaml`:

```python
from plugins._host.protocol import ErrorCodes

class MyPlugin(TTSContract):
    async def synthesize(self, text: str, voice_id: str = None) -> bytes:
        if not text:
            raise ValueError("Text cannot be empty")

        if len(text) > 10000:
            raise PluginError(
                code=1002,  # TTS_TEXT_TOO_LONG
                message="Text exceeds maximum length"
            )

        # Implementation...
```

### Error Codes Reference

| Code | Name | Description |
|------|------|-------------|
| 1000 | TTS_SYNTHESIS_FAILED | TTS operation failed |
| 1001 | TTS_VOICE_NOT_FOUND | Voice ID not found |
| 1002 | TTS_TEXT_TOO_LONG | Input text too long |
| 1100 | STT_TRANSCRIPTION_FAILED | STT operation failed |
| 1101 | STT_AUDIO_INVALID | Invalid audio format |
| 1200 | LLM_COMPLETION_FAILED | LLM operation failed |
| 1201 | LLM_MODEL_NOT_AVAILABLE | Model not loaded |

## Configuration

### Config Schema

Define configuration schema in manifest:

```json
{
  "config_schema": {
    "type": "object",
    "properties": {
      "api_key": {
        "type": "string",
        "description": "API key for service"
      },
      "timeout": {
        "type": "integer",
        "default": 30,
        "minimum": 1,
        "maximum": 300
      },
      "features": {
        "type": "array",
        "items": {"type": "string"}
      }
    },
    "required": ["api_key"]
  }
}
```

### Receiving Config

Configuration is passed to `initialize()`:

```python
async def initialize(self, config: dict) -> bool:
    self._api_key = config["api_key"]
    self._timeout = config.get("timeout", 30)
    self._features = config.get("features", [])
    return True
```

## Hot-Swap Support

Plugins can implement state capture for hot-swap:

```python
class MyPlugin(TTSContract):
    def capture_state(self) -> dict:
        """Capture current state for hot-swap."""
        return {
            "cache": self._cache,
            "settings": self._settings,
        }

    def restore_state(self, state: dict) -> None:
        """Restore state after hot-swap."""
        self._cache = state.get("cache", {})
        self._settings = state.get("settings", {})
```

## Dependencies

### requirements.txt

List pip dependencies:

```
torch>=2.0.0
numpy>=1.24.0
soundfile>=0.12.0
```

### Manifest Dependencies

Also declare in manifest for validation:

```json
{
  "dependencies": [
    "torch>=2.0.0",
    "numpy>=1.24.0",
    "soundfile>=0.12.0"
  ]
}
```

### Auto-Installation

The Plugin Host can auto-install dependencies:

```bash
python -m plugins._host --auto-install-deps
```

## Testing Plugins

### Using Plugin Tester UI

1. Open App Factory
2. Navigate to Plugin Testing panel
3. Select your plugin
4. Use Method Invoker to test methods
5. Monitor Health Dashboard

### Command Line Testing

```bash
# Start plugin host in sync mode
python -m plugins._host --sync-mode

# Send JSON-RPC request
echo '{"jsonrpc":"2.0","method":"plugin/load","params":{"name":"my_plugin"},"id":1}'

# Call plugin method
echo '{"jsonrpc":"2.0","method":"plugin/call","params":{"plugin":"my_plugin","method":"synthesize","args":{"text":"Hello"}},"id":2}'
```

### Unit Testing

```python
import pytest
from my_plugin import MyTTSPlugin

@pytest.fixture
async def plugin():
    p = MyTTSPlugin()
    await p.initialize({"voice": "default"})
    yield p
    await p.shutdown()

@pytest.mark.asyncio
async def test_synthesize(plugin):
    audio = await plugin.synthesize("Hello world")
    assert isinstance(audio, bytes)
    assert len(audio) > 0

def test_health_check(plugin):
    health = plugin.health_check()
    assert health.status == PluginStatus.READY
```

## Best Practices

### 1. Keep Initialization Fast

```python
async def initialize(self, config: dict) -> bool:
    # Load essential config only
    self._config = config

    # Defer heavy loading
    self._model = None  # Load on first use
    return True

async def _ensure_model(self):
    if self._model is None:
        self._model = await load_model(self._config["model_path"])
```

### 2. Handle Errors Gracefully

```python
async def synthesize(self, text: str, voice_id: str = None) -> bytes:
    try:
        return await self._do_synthesis(text, voice_id)
    except ModelError as e:
        self._status = PluginStatus.ERROR
        raise PluginError(1000, f"Synthesis failed: {e}")
```

### 3. Report Accurate Health

```python
def health_check(self) -> HealthStatus:
    if self._model is None:
        return HealthStatus(
            status=PluginStatus.ERROR,
            message="Model not loaded"
        )

    return HealthStatus(
        status=self._status,
        message="Operational",
        memory_mb=self._get_memory_usage()
    )
```

### 4. Clean Up Resources

```python
async def shutdown(self) -> bool:
    if self._model:
        self._model.unload()
        self._model = None

    if self._connection:
        await self._connection.close()
        self._connection = None

    self._status = PluginStatus.STOPPED
    return True
```

### 5. Use Async Properly

```python
# Good: Non-blocking async
async def synthesize(self, text: str, voice_id: str = None) -> bytes:
    return await asyncio.to_thread(self._sync_synthesis, text, voice_id)

# Bad: Blocking in async
async def synthesize(self, text: str, voice_id: str = None) -> bytes:
    return self._sync_synthesis(text, voice_id)  # Blocks event loop!
```

## Debugging

### Enable Debug Logging

```bash
python -m plugins._host --log-level DEBUG
```

### Check Logs

Logs are written to:
- `logs/plugins.log` - Plugin-specific logs
- `logs/launcher.log` - Startup logs

### Common Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| Plugin not discovered | Missing manifest.json | Add manifest to plugin folder |
| Contract mismatch | Wrong base class | Extend correct contract class |
| Import error | Missing dependency | Install dependencies |
| Timeout | Slow initialize | Make initialization async |

## Example: Complete TTS Plugin

```python
"""
Complete TTS plugin example.
"""

import asyncio
from pathlib import Path
from typing import Any, Dict, List, Optional

from contracts.tts_contract import TTSContract
from contracts.base import HealthStatus, PluginStatus


class ExampleTTSPlugin(TTSContract):
    """Example TTS plugin implementation."""

    def __init__(self):
        super().__init__()
        self._engine = None
        self._voices = []

    async def initialize(self, config: Dict[str, Any]) -> bool:
        """Initialize the TTS engine."""
        try:
            # Load configuration
            self._model_path = Path(config.get("model_path", "./models/tts"))
            self._sample_rate = config.get("sample_rate", 24000)

            # Load engine (deferred for speed)
            self._status = PluginStatus.READY
            return True

        except Exception as e:
            self._status = PluginStatus.ERROR
            raise RuntimeError(f"Initialization failed: {e}")

    async def shutdown(self) -> bool:
        """Clean up resources."""
        if self._engine:
            await asyncio.to_thread(self._engine.unload)
            self._engine = None

        self._status = PluginStatus.STOPPED
        return True

    def health_check(self) -> HealthStatus:
        """Report health status."""
        return HealthStatus(
            status=self._status,
            message="TTS engine operational" if self._status == PluginStatus.READY else "Not ready",
            details={
                "engine_loaded": self._engine is not None,
                "voices_count": len(self._voices),
            }
        )

    async def _ensure_engine(self):
        """Lazy-load the TTS engine."""
        if self._engine is None:
            self._engine = await asyncio.to_thread(
                self._load_engine, self._model_path
            )
            self._voices = self._engine.get_voices()

    def _load_engine(self, model_path: Path):
        """Load TTS engine (sync)."""
        # Your engine loading code here
        pass

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None
    ) -> bytes:
        """Convert text to speech audio."""
        await self._ensure_engine()

        if not text.strip():
            raise ValueError("Text cannot be empty")

        voice = voice_id or self._voices[0]["id"] if self._voices else "default"

        # Generate audio
        audio_bytes = await asyncio.to_thread(
            self._engine.synthesize, text, voice
        )

        return audio_bytes

    async def get_voices(self) -> List[Dict[str, Any]]:
        """Return available voices."""
        await self._ensure_engine()
        return self._voices

    async def get_voice_info(self, voice_id: str) -> Dict[str, Any]:
        """Return voice metadata."""
        await self._ensure_engine()

        for voice in self._voices:
            if voice["id"] == voice_id:
                return voice

        raise ValueError(f"Voice not found: {voice_id}")


# Export for plugin loader
Plugin = ExampleTTSPlugin
```

---

*Plugin Development Guide Version: 1.0 | Last Updated: 2025-12-24*
