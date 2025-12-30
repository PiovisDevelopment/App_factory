"""
contracts/__init__.py
=====================
Public API for plugin contracts.

Exports all contract classes and supporting types for plugin development.
"""

# D001 - Base contract and types
from .base import (
    PluginBase,
    PluginStatus,
    PluginManifest,
    HealthStatus,
    PluginFactory,
)

# D002 - TTS contract and types
from .tts_contract import (
    TTSContract,
    Voice,
    SynthesisResult,
    SynthesisOptions,
    AudioFormat,
)

# D003 - STT contract and types
from .stt_contract import (
    STTContract,
    TranscriptionResult,
    TranscriptionSegment,
    TranscriptionOptions,
    TranscriptionStatus,
    StreamingConfig,
)

# D004 - LLM contract and types
from .llm_contract import (
    LLMContract,
    Message,
    MessageRole,
    Model,
    CompletionResult,
    CompletionOptions,
    StreamChunk,
    TokenUsage,
    FinishReason,
)

__all__ = [
    # Base
    "PluginBase",
    "PluginStatus",
    "PluginManifest",
    "HealthStatus",
    "PluginFactory",
    # TTS
    "TTSContract",
    "Voice",
    "SynthesisResult",
    "SynthesisOptions",
    "AudioFormat",
    # STT
    "STTContract",
    "TranscriptionResult",
    "TranscriptionSegment",
    "TranscriptionOptions",
    "TranscriptionStatus",
    "StreamingConfig",
    # LLM
    "LLMContract",
    "Message",
    "MessageRole",
    "Model",
    "CompletionResult",
    "CompletionOptions",
    "StreamChunk",
    "TokenUsage",
    "FinishReason",
]
