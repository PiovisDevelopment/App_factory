"""
stt_whisper/plugin.py
=====================
Faster Whisper STT Plugin Implementation

High-performance speech-to-text using OpenAI Whisper models
via the faster-whisper (CTranslate2) inference engine.

Optimized for NVIDIA RTX GPUs with FP16 computation.
4x faster than OpenAI's whisper package with lower VRAM usage.

Repository: https://github.com/SYSTRAN/faster-whisper
Package: https://pypi.org/project/faster-whisper/

Dependencies:
    - D001: contracts/base.py (PluginBase)
    - D003: contracts/stt_contract.py (STTContract)
"""

import asyncio
import io
import tempfile
import os
from typing import Any, Dict, List, Optional, Callable

from contracts.base import PluginStatus, HealthStatus
from contracts.stt_contract import (
    STTContract,
    TranscriptionResult,
    TranscriptionSegment,
    TranscriptionOptions,
    TranscriptionStatus,
    StreamingConfig,
)


# Whisper supported languages (subset of most common)
SUPPORTED_LANGUAGES = [
    "en", "zh", "de", "es", "ru", "ko", "fr", "ja", "pt", "tr",
    "pl", "ca", "nl", "ar", "sv", "it", "id", "hi", "fi", "vi",
    "he", "uk", "el", "ms", "cs", "ro", "da", "hu", "ta", "no",
    "th", "ur", "hr", "bg", "lt", "la", "mi", "ml", "cy", "sk",
    "te", "fa", "lv", "bn", "sr", "az", "sl", "kn", "et", "mk",
    "br", "eu", "is", "hy", "ne", "mn", "bs", "kk", "sq", "sw",
    "gl", "mr", "pa", "si", "km", "sn", "yo", "so", "af", "oc",
    "ka", "be", "tg", "sd", "gu", "am", "yi", "lo", "uz", "fo",
    "ht", "ps", "tk", "nn", "mt", "sa", "lb", "my", "bo", "tl",
    "mg", "as", "tt", "haw", "ln", "ha", "ba", "jw", "su",
]


class WhisperSTTPlugin(STTContract):
    """
    Faster Whisper STT Plugin - High-performance speech-to-text.
    
    Uses CTranslate2 inference engine for 4x speedup over original Whisper.
    Optimized for NVIDIA RTX 4080 with FP16 computation.
    
    Features:
        - 4x faster than openai-whisper
        - Lower VRAM usage (can run large-v3 on 10GB)
        - FP16/INT8 quantization support
        - Silero VAD integration for silence filtering
        - Word-level timestamps
        - Translation to English
    """

    def __init__(self):
        """Initialize the Whisper STT plugin."""
        super().__init__()
        self._model = None
        self._model_size: str = "large-v3"
        self._device: str = "cpu"
        self._compute_type: str = "float16"
        self._default_language: Optional[str] = None
        self._beam_size: int = 5
        self._vad_filter: bool = True
        self._initialized: bool = False

    async def initialize(self, config: Dict[str, Any]) -> bool:
        """
        Initialize the Whisper STT plugin.
        
        Lazy-loads the model to avoid blocking. The actual model
        download happens on first transcription.
        
        Args:
            config: Configuration from manifest or user overrides.
                - model_size: str (e.g., "large-v3", "turbo")
                - device: str ("cuda", "cpu", or "auto")
                - compute_type: str ("float16", "int8_float16", etc.)
                - language: str (default language or null for auto)
                - beam_size: int (1-10)
                - vad_filter: bool
        
        Returns:
            True if initialization succeeded.
        """
        try:
            # Apply configuration
            self._model_size = config.get("model_size", "large-v3")
            self._default_language = config.get("language")
            self._beam_size = config.get("beam_size", 5)
            self._vad_filter = config.get("vad_filter", True)
            self._compute_type = config.get("compute_type", "float16")
            
            # Determine device
            device_config = config.get("device", "auto")
            if device_config == "auto":
                # Check for CUDA availability via CTranslate2
                try:
                    import ctranslate2
                    cuda_types = ctranslate2.get_supported_compute_types("cuda")
                    cuda_available = len(cuda_types) > 0
                except Exception:
                    cuda_available = False
                self._device = "cuda" if cuda_available else "cpu"
            else:
                self._device = device_config
            
            # Defer model loading to first use (lazy loading)
            self._initialized = True
            self._status = PluginStatus.READY
            
            return True
            
        except Exception as e:
            self._status = PluginStatus.ERROR
            raise RuntimeError(f"Whisper STT initialization failed: {e}")

    async def shutdown(self) -> None:
        """Clean up plugin resources."""
        self._model = None
        self._initialized = False
        self._status = PluginStatus.UNLOADED

    async def health_check(self) -> HealthStatus:
        """
        Check plugin health.
        
        Returns:
            HealthStatus with current state and diagnostics.
        """
        details = {
            "initialized": self._initialized,
            "model_loaded": self._model is not None,
            "model_size": self._model_size,
            "device": self._device,
            "compute_type": self._compute_type,
            "vad_enabled": self._vad_filter,
            "default_language": self._default_language,
        }
        
        return HealthStatus(
            status=self._status,
            message="Whisper STT operational" if self._initialized else "Not initialized",
            details=details
        )

    async def _ensure_model(self) -> None:
        """
        Lazy-load the Whisper model.
        
        The model is created on first use to avoid blocking during
        plugin initialization. Models are auto-downloaded from HuggingFace.
        """
        if self._model is not None:
            return
        
        from faster_whisper import WhisperModel
        
        def load_model():
            return WhisperModel(
                self._model_size,
                device=self._device,
                compute_type=self._compute_type
            )
        
        # Run in thread to avoid blocking async event loop
        self._model = await asyncio.to_thread(load_model)

    async def transcribe(
        self,
        audio_data: bytes,
        options: Optional[TranscriptionOptions] = None
    ) -> TranscriptionResult:
        """
        Transcribe audio data to text.
        
        Args:
            audio_data: Raw audio bytes (WAV, MP3, or raw PCM).
            options: Transcription options.
        
        Returns:
            TranscriptionResult containing text and segments.
        
        Raises:
            ValueError: If audio data is invalid or empty.
            RuntimeError: If transcription fails.
        """
        if not audio_data or len(audio_data) == 0:
            raise ValueError("Audio data cannot be empty")
        
        # Ensure model is loaded
        await self._ensure_model()
        
        opts = options or TranscriptionOptions()
        
        try:
            # Write audio to temp file (faster-whisper accepts file paths)
            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(audio_data)
                tmp_path = tmp.name
            
            try:
                def do_transcribe():
                    segments, info = self._model.transcribe(
                        tmp_path,
                        language=opts.language or self._default_language,
                        task=opts.task,
                        beam_size=opts.beam_size or self._beam_size,
                        word_timestamps=opts.word_timestamps,
                        vad_filter=self._vad_filter,
                        temperature=opts.temperature if opts.temperature > 0 else 0.0,
                        initial_prompt=opts.initial_prompt,
                    )
                    
                    # Collect all segments (generator)
                    segment_list = list(segments)
                    return segment_list, info
                
                segments, info = await asyncio.to_thread(do_transcribe)
                
            finally:
                # Clean up temp file
                os.unlink(tmp_path)
            
            # Convert to our segment format
            result_segments = []
            full_text_parts = []
            
            for seg in segments:
                result_segments.append(TranscriptionSegment(
                    text=seg.text.strip(),
                    start_ms=seg.start * 1000,
                    end_ms=seg.end * 1000,
                    confidence=seg.avg_logprob if hasattr(seg, 'avg_logprob') else 1.0,
                    language=info.language,
                    words=[
                        {
                            "word": w.word,
                            "start_ms": w.start * 1000,
                            "end_ms": w.end * 1000,
                            "probability": w.probability
                        }
                        for w in (seg.words or [])
                    ] if opts.word_timestamps else []
                ))
                full_text_parts.append(seg.text.strip())
            
            full_text = " ".join(full_text_parts)
            duration_ms = info.duration * 1000 if hasattr(info, 'duration') else 0
            
            return TranscriptionResult(
                text=full_text,
                segments=result_segments,
                language=info.language,
                duration_ms=duration_ms,
                status=TranscriptionStatus.COMPLETE,
                metadata={
                    "plugin": "stt_whisper",
                    "model": self._model_size,
                    "device": self._device,
                    "language_probability": info.language_probability,
                    "task": opts.task,
                }
            )
            
        except Exception as e:
            raise RuntimeError(f"Whisper transcription failed: {e}")

    async def start_streaming(
        self,
        config: StreamingConfig,
        callback: Optional[Callable[[TranscriptionSegment], None]] = None
    ) -> bool:
        """
        Start streaming transcription session.
        
        Note: faster-whisper does not natively support streaming.
        This is a stub that raises NotImplementedError.
        For real-time STT, consider using a dedicated streaming model.
        """
        raise NotImplementedError(
            "Streaming is not supported by faster-whisper. "
            "Use batch transcription or a streaming-capable model."
        )

    async def feed_audio(self, chunk: bytes) -> Optional[TranscriptionSegment]:
        """Feed audio chunk to streaming session (not supported)."""
        raise NotImplementedError("Streaming is not supported by faster-whisper.")

    async def stop_streaming(self) -> TranscriptionResult:
        """Stop streaming session (not supported)."""
        raise NotImplementedError("Streaming is not supported by faster-whisper.")

    def get_supported_languages(self) -> List[str]:
        """
        Get list of supported language codes.
        
        Returns:
            List of ISO 639-1 language codes.
        """
        return SUPPORTED_LANGUAGES.copy()

    def supports_streaming(self) -> bool:
        """Check if plugin supports streaming (No)."""
        return False

    def supports_diarization(self) -> bool:
        """Check if plugin supports speaker diarization (No)."""
        return False

    def supports_translation(self) -> bool:
        """Check if plugin supports translation to English (Yes)."""
        return True

    def get_available_models(self) -> List[Dict[str, Any]]:
        """
        Get list of available Whisper models.
        
        Returns:
            List of model info dictionaries.
        """
        return [
            {"id": "tiny", "params": "39M", "vram_gb": 1, "quality": "low"},
            {"id": "base", "params": "74M", "vram_gb": 1, "quality": "low"},
            {"id": "small", "params": "244M", "vram_gb": 2, "quality": "medium"},
            {"id": "medium", "params": "769M", "vram_gb": 5, "quality": "high"},
            {"id": "large-v2", "params": "1550M", "vram_gb": 10, "quality": "best"},
            {"id": "large-v3", "params": "1550M", "vram_gb": 10, "quality": "best"},
            {"id": "turbo", "params": "809M", "vram_gb": 6, "quality": "high"},
            {"id": "distil-large-v3", "params": "756M", "vram_gb": 5, "quality": "high"},
        ]


# Export for plugin discovery
Plugin = WhisperSTTPlugin
