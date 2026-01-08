"""
services/voice.py
==================
High-Level Voice Service Facade

Provides a simple, AI-friendly API for text-to-speech and speech-to-text.
Automatically manages plugin lifecycle and provides sensible defaults.

Usage:
    from services.voice import VoiceService

    # Simple one-liner usage
    voice = VoiceService()
    audio = await voice.speak("Hello, how can I help you?")
    text = await voice.listen(audio_bytes)

    # Or use context manager for automatic cleanup
    async with VoiceService() as voice:
        audio = await voice.speak("Hello!")
        response = await voice.listen(recorded_audio)
"""

from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from plugins.stt_whisper.plugin import WhisperSTTPlugin
    from plugins.tts_kokoro.plugin import KokoroTTSPlugin


class VoiceService:
    """
    High-level facade for TTS and STT operations.

    Automatically discovers, loads, and manages TTS/STT plugins.
    Provides simple speak() and listen() methods for AI agents.

    Attributes:
        tts_voice: Current TTS voice ID
        stt_model: Current STT model size
        auto_cleanup: Whether to cleanup on shutdown
    """

    def __init__(
        self,
        tts_voice: str = "af_heart",
        tts_lang: str = "a",
        stt_model: str = "small",
        device: str = "auto",
        auto_init: bool = True,
    ):
        """
        Initialize the Voice Service.

        Args:
            tts_voice: Default TTS voice ID (e.g., "af_heart")
            tts_lang: TTS language code (e.g., "a" for American English)
            stt_model: STT model size (e.g., "tiny", "small", "large-v3")
            device: Compute device ("cuda", "cpu", or "auto")
            auto_init: If True, plugins are initialized on first use
        """
        self._tts_plugin: KokoroTTSPlugin | None = None
        self._stt_plugin: WhisperSTTPlugin | None = None
        self._device = device
        self._tts_voice = tts_voice
        self._tts_lang = tts_lang
        self._stt_model = stt_model
        self._auto_init = auto_init
        self._initialized = False

    async def __aenter__(self) -> "VoiceService":
        """Async context manager entry."""
        await self.initialize()
        return self

    async def __aexit__(self, exc_type: Any, exc_val: Any, exc_tb: Any) -> bool:
        """Async context manager exit with cleanup."""
        await self.shutdown()
        return False

    async def initialize(self) -> bool:
        """
        Initialize TTS and STT plugins.

        Returns:
            True if both plugins initialized successfully.
        """
        if self._initialized:
            return True

        # Import and initialize TTS
        from plugins.tts_kokoro.plugin import KokoroTTSPlugin

        self._tts_plugin = KokoroTTSPlugin()
        await self._tts_plugin.initialize(
            {
                "default_voice": self._tts_voice,
                "default_lang_code": self._tts_lang,
                "device": self._device,
                "speed": 1.0,
            }
        )

        # Import and initialize STT
        from plugins.stt_whisper.plugin import WhisperSTTPlugin

        self._stt_plugin = WhisperSTTPlugin()
        await self._stt_plugin.initialize(
            {
                "model_size": self._stt_model,
                "device": self._device,
                "compute_type": "float16",
                "language": None,
                "beam_size": 5,
                "vad_filter": True,
            }
        )

        self._initialized = True
        return True

    async def shutdown(self) -> None:
        """Shutdown and cleanup plugins."""
        if self._tts_plugin:
            await self._tts_plugin.shutdown()
            self._tts_plugin = None

        if self._stt_plugin:
            await self._stt_plugin.shutdown()
            self._stt_plugin = None

        self._initialized = False

    async def _ensure_initialized(self) -> None:
        """Ensure plugins are initialized (lazy loading)."""
        if not self._initialized and self._auto_init:
            await self.initialize()

    # =========================================================================
    # HIGH-LEVEL API - Simple methods for AI agents
    # =========================================================================

    async def speak(self, text: str, voice: str | None = None, speed: float = 1.0, save_to: str | None = None) -> bytes:
        """
        Convert text to speech audio.

        Args:
            text: Text to synthesize
            voice: Voice ID (uses default if None)
            speed: Speech speed multiplier (0.5 to 2.0)
            save_to: Optional file path to save WAV audio

        Returns:
            WAV audio bytes

        Example:
            audio = await voice.speak("Hello, world!")
            audio = await voice.speak("Bonjour!", voice="bf_alice")
        """
        await self._ensure_initialized()

        from contracts.tts_contract import AudioFormat, SynthesisOptions

        options = SynthesisOptions(speed=speed, format=AudioFormat.WAV)

        assert self._tts_plugin is not None, "TTS plugin not initialized"
        result = await self._tts_plugin.synthesize(text, voice_id=voice or self._tts_voice, options=options)

        if save_to:
            Path(save_to).write_bytes(result.audio_data)

        return result.audio_data

    async def listen(
        self, audio: bytes | str, language: str | None = None, translate: bool = False, word_timestamps: bool = False
    ) -> str:
        """
        Transcribe speech audio to text.

        Args:
            audio: WAV audio bytes or path to audio file
            language: Language code (auto-detect if None)
            translate: If True, translate to English
            word_timestamps: If True, include word-level timing

        Returns:
            Transcribed text

        Example:
            text = await voice.listen(audio_bytes)
            text = await voice.listen("recording.wav")
            text = await voice.listen(audio, translate=True)
        """
        await self._ensure_initialized()

        # Load audio from file if path provided
        if isinstance(audio, str):
            audio = Path(audio).read_bytes()

        from contracts.stt_contract import TranscriptionOptions

        options = TranscriptionOptions(
            language=language, task="translate" if translate else "transcribe", word_timestamps=word_timestamps
        )

        assert self._stt_plugin is not None, "STT plugin not initialized"
        result = await self._stt_plugin.transcribe(audio, options)
        return result.text

    async def listen_detailed(
        self, audio: bytes | str, language: str | None = None, translate: bool = False
    ) -> dict[str, Any]:
        """
        Transcribe with detailed information.

        Args:
            audio: WAV audio bytes or path to audio file
            language: Language code (auto-detect if None)
            translate: If True, translate to English

        Returns:
            Dict with text, language, duration, segments

        Example:
            result = await voice.listen_detailed(audio)
            print(f"Text: {result['text']}")
            print(f"Language: {result['language']}")
            print(f"Duration: {result['duration_ms']}ms")
        """
        await self._ensure_initialized()

        if isinstance(audio, str):
            audio = Path(audio).read_bytes()

        from contracts.stt_contract import TranscriptionOptions

        options = TranscriptionOptions(
            language=language, task="translate" if translate else "transcribe", word_timestamps=True
        )

        assert self._stt_plugin is not None, "STT plugin not initialized"
        result = await self._stt_plugin.transcribe(audio, options)

        return {
            "text": result.text,
            "language": result.language,
            "duration_ms": result.duration_ms,
            "segments": [
                {"text": s.text, "start_ms": s.start_ms, "end_ms": s.end_ms, "words": s.words} for s in result.segments
            ],
        }

    async def conversation(self, prompt: str, voice: str | None = None) -> bytes:
        """
        Alias for speak() for more natural conversation flow.

        Args:
            prompt: Text to speak
            voice: Voice ID (uses default if None)

        Returns:
            WAV audio bytes
        """
        return await self.speak(prompt, voice=voice)

    # =========================================================================
    # UTILITY METHODS
    # =========================================================================

    def get_voices(self) -> list[dict[str, str]]:
        """
        Get available TTS voices.

        Returns:
            List of voice dictionaries with id, name, language, gender
        """
        if not self._tts_plugin:
            return []

        return [
            {"id": v.id, "name": v.name, "language": v.language, "gender": v.gender}
            for v in self._tts_plugin.get_voices()
        ]

    def set_voice(self, voice_id: str) -> None:
        """Set the default TTS voice."""
        self._tts_voice = voice_id
        if self._tts_plugin:
            self._tts_plugin.set_voice(voice_id)

    def set_stt_model(self, model_size: str) -> None:
        """
        Set the STT model size.

        Note: Requires re-initialization to take effect.
        """
        self._stt_model = model_size

    @property
    def is_initialized(self) -> bool:
        """Check if service is initialized."""
        return self._initialized

    @property
    def tts_device(self) -> str | None:
        """Get TTS device in use."""
        if self._tts_plugin:
            return self._tts_plugin._device
        return None

    @property
    def stt_device(self) -> str | None:
        """Get STT device in use."""
        if self._stt_plugin:
            return self._stt_plugin._device
        return None
