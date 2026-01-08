"""
contracts/__init__.py
=====================
Public API for plugin contracts.

Exports all contract classes and supporting types for plugin development.
"""

# D001 - Base contract and types
from .base import (
    HealthStatus,
    PluginBase,
    PluginFactory,
    PluginManifest,
    PluginStatus,
)

# D004 - LLM contract and types
from .llm_contract import (
    CompletionOptions,
    CompletionResult,
    FinishReason,
    LLMContract,
    Message,
    MessageRole,
    Model,
    StreamChunk,
    TokenUsage,
)

# D003 - STT contract and types
from .stt_contract import (
    StreamingConfig,
    STTContract,
    TranscriptionOptions,
    TranscriptionResult,
    TranscriptionSegment,
    TranscriptionStatus,
)

# D002 - TTS contract and types
from .tts_contract import (
    AudioFormat,
    SynthesisOptions,
    SynthesisResult,
    TTSContract,
    Voice,
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
