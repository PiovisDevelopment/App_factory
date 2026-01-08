"""
D100 - plugins/_host/config_models.py
=====================================
Pydantic BaseSettings models for plugin configuration.

Enables:
1. Validation: Strict type checking via Pydantic.
2. Schema Generation: `model_json_schema()` for dynamic UI.
3. Persistence: Load from config/plugins.yaml or env vars.

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Reference: https://docs.pydantic.dev/latest/concepts/pydantic_settings/
"""

from typing import Any, Literal

from pydantic import Field
from pydantic_settings import BaseSettings

# ============================================
# STT PLUGIN CONFIGS
# ============================================

class WhisperConfig(BaseSettings):
    """
    Configuration for Whisper STT plugin.

    Reference: https://github.com/SYSTRAN/faster-whisper
    """

    model_size: Literal["tiny", "base", "small", "medium", "large-v2", "large-v3", "turbo"] = Field(
        default="large-v3",
        description="Whisper model size. Larger models are more accurate but slower."
    )
    device: Literal["auto", "cuda", "cpu"] = Field(
        default="auto",
        description="Compute device. 'auto' selects CUDA if available."
    )
    compute_type: Literal["float16", "int8_float16", "int8"] = Field(
        default="float16",
        description="Compute type for inference. float16 is fastest on modern GPUs."
    )
    beam_size: int = Field(
        default=5,
        ge=1,
        le=10,
        description="Beam search width. Higher values may improve accuracy at cost of speed."
    )
    vad_filter: bool = Field(
        default=True,
        description="Enable Voice Activity Detection to filter silent segments."
    )
    language: str | None = Field(
        default=None,
        description="Default language code (e.g., 'en'). None for auto-detection."
    )

    class Config:
        env_prefix = "WHISPER_"


# ============================================
# TTS PLUGIN CONFIGS
# ============================================

class KokoroConfig(BaseSettings):
    """
    Configuration for Kokoro TTS plugin.

    Reference: https://huggingface.co/hexgrad/Kokoro-82M
    """

    default_voice: Literal["af_heart", "af_bella", "am_adam", "am_michael", "bf_emma", "bm_george"] = Field(
        default="af_heart",
        title="Voice"
    )
    speed: float = Field(
        default=1.0,
        ge=0.5,
        le=2.0,
        description="Speech speed multiplier. 1.0 is normal speed."
    )
    device: Literal["auto", "cuda", "cpu"] = Field(
        default="auto",
        description="Compute device. 'auto' selects CUDA if available."
    )

    class Config:
        env_prefix = "KOKORO_"


# ============================================
# LLM PROVIDER CONFIGS
# ============================================

class GeminiConfig(BaseSettings):
    """Configuration for Google Gemini LLM provider."""

    model: Literal[
        "gemini-3-flash-preview",
        "gemini-2.5-flash",
        "gemini-2.5-flash-preview-09-2025",
        "gemini-2.5-flash-image",
        "gemini-2.5-flash-native-audio-preview-12-2025",
    ] = Field(
        default="gemini-3-flash-preview",
        title="Model"
    )
    temperature: float = Field(
        default=0.0,
        ge=0.0,
        le=2.0,
        description="Sampling temperature. Lower is more deterministic."
    )
    max_tokens: int = Field(
        default=4096,
        ge=1,
        le=32768,
        description="Maximum output tokens."
    )

    class Config:
        env_prefix = "GEMINI_"


class OpenAIConfig(BaseSettings):
    """Configuration for OpenAI LLM provider."""

    model: Literal[
        "gpt-4o",
        "gpt-4o-mini",
        "gpt-4-turbo",
        "o1",
        "o1-mini",
        "gpt-5-mini",
        "gpt-5-nano",
    ] = Field(
        default="gpt-4o",
        title="Model"
    )
    temperature: float = Field(
        default=0.0,
        ge=0.0,
        le=2.0,
        description="Sampling temperature."
    )
    max_tokens: int = Field(
        default=4096,
        ge=1,
        le=128000,
        description="Maximum output tokens."
    )

    class Config:
        env_prefix = "OPENAI_"


class AnthropicConfig(BaseSettings):
    """Configuration for Anthropic Claude provider."""

    model: str = Field(
        default="claude-3-5-sonnet-20241022",
        description="Claude model to use."
    )
    temperature: float = Field(
        default=0.0,
        ge=0.0,
        le=1.0,
        description="Sampling temperature."
    )
    max_tokens: int = Field(
        default=4096,
        ge=1,
        le=200000,
        description="Maximum output tokens."
    )

    class Config:
        env_prefix = "ANTHROPIC_"


class OllamaConfig(BaseSettings):
    """Configuration for Ollama local LLM provider."""

    model: Literal["llama3.2", "mistral", "codellama", "qwen2.5-coder", "deepseek-coder"] = Field(
        default="llama3.2",
        title="Model"
    )
    temperature: float = Field(
        default=0.0,
        ge=0.0,
        le=2.0,
        description="Sampling temperature."
    )
    base_url: str = Field(
        default="http://localhost:11434",
        description="Ollama API base URL."
    )

    class Config:
        env_prefix = "OLLAMA_"


# ============================================
# EMBEDDING PROVIDER CONFIGS
# ============================================

class OpenAIEmbeddingConfig(BaseSettings):
    """Configuration for OpenAI Embedding provider."""

    model: Literal["text-embedding-3-small", "text-embedding-3-large"] = Field(
        default="text-embedding-3-small",
        description="Embedding model to use."
    )
    dimensions: int | None = Field(
        default=None,
        description="Output dimensions (optional, model-dependent)."
    )

    class Config:
        env_prefix = "OPENAI_EMBED_"


# ============================================
# PLUGIN CONFIG REGISTRY
# ============================================

# Map plugin IDs to their config models
PLUGIN_CONFIG_MAP: dict[str, type[BaseSettings]] = {
    # STT
    "stt_whisper": WhisperConfig,
    # TTS
    "tts_kokoro": KokoroConfig,
    # LLM
    "llm_gemini": GeminiConfig,
    "llm_openai": OpenAIConfig,
    "llm_anthropic": AnthropicConfig,
    "llm_ollama": OllamaConfig,
    # Embedding
    "embedding_openai": OpenAIEmbeddingConfig,
}


def get_config_schema(plugin_id: str) -> dict[str, Any]:
    """
    Get the JSON Schema for a plugin's configuration.

    Args:
        plugin_id: Plugin identifier (e.g., 'stt_whisper').

    Returns:
        JSON Schema dictionary.

    Raises:
        ValueError: If plugin_id is not found.
    """
    config_model = PLUGIN_CONFIG_MAP.get(plugin_id)
    if config_model is None:
        raise ValueError(f"Unknown plugin: {plugin_id}")
    return config_model.model_json_schema()


def validate_config(plugin_id: str, config: dict[str, Any]) -> BaseSettings:
    """
    Validate and parse configuration for a plugin.

    Args:
        plugin_id: Plugin identifier.
        config: Configuration dictionary.

    Returns:
        Validated configuration instance.

    Raises:
        ValueError: If plugin_id is not found.
        pydantic.ValidationError: If config is invalid.
    """
    config_model = PLUGIN_CONFIG_MAP.get(plugin_id)
    if config_model is None:
        raise ValueError(f"Unknown plugin: {plugin_id}")
    return config_model(**config)
