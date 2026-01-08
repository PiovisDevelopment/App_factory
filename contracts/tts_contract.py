"""
D002 - contracts/tts_contract.py
================================
Text-to-Speech contract defining the interface for TTS plugins.

Extends: PluginBase (D001)
Prefix: tts_ (defined in config/contract_prefixes.yaml D005)

All TTS plugins (Kokoro, Piper, Coqui, etc.) MUST implement this contract.
"""

from abc import abstractmethod
from collections.abc import AsyncIterator
from dataclasses import dataclass, field
from enum import Enum
from typing import Any

# Import from D001 - no forward references
from .base import PluginBase


class AudioFormat(Enum):
    """Supported audio output formats."""
    WAV = "wav"
    MP3 = "mp3"
    OGG = "ogg"
    PCM = "pcm"  # Raw PCM samples
    OPUS = "opus"


@dataclass
class Voice:
    """
    Voice definition for TTS synthesis.

    Attributes:
        id: Unique voice identifier within the plugin
        name: Human-readable voice name
        language: BCP-47 language code (e.g., "en-US", "ja-JP")
        gender: Voice gender ("male", "female", "neutral")
        description: Optional description of voice characteristics
        sample_rate: Native sample rate in Hz (e.g., 22050, 44100)
        preview_url: Optional URL to voice sample audio
    """
    id: str
    name: str
    language: str
    gender: str = "neutral"
    description: str = ""
    sample_rate: int = 22050
    preview_url: str = ""

    def to_dict(self) -> dict[str, Any]:
        """Serialize voice for JSON-RPC responses."""
        return {
            "id": self.id,
            "name": self.name,
            "language": self.language,
            "gender": self.gender,
            "description": self.description,
            "sample_rate": self.sample_rate,
            "preview_url": self.preview_url,
        }


@dataclass
class SynthesisResult:
    """
    Result of TTS synthesis operation.

    Attributes:
        audio_data: Raw audio bytes in specified format
        format: Audio format of the data
        sample_rate: Sample rate in Hz
        duration_ms: Audio duration in milliseconds
        text: Original text that was synthesized
        voice_id: Voice used for synthesis
        metadata: Optional additional metadata
    """
    audio_data: bytes
    format: AudioFormat
    sample_rate: int
    duration_ms: float
    text: str
    voice_id: str
    metadata: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """
        Serialize for JSON-RPC responses.
        Note: audio_data is base64 encoded for JSON transport.
        """
        import base64
        return {
            "audio_data": base64.b64encode(self.audio_data).decode("utf-8"),
            "format": self.format.value,
            "sample_rate": self.sample_rate,
            "duration_ms": self.duration_ms,
            "text": self.text,
            "voice_id": self.voice_id,
            "metadata": self.metadata,
        }


@dataclass
class SynthesisOptions:
    """
    Options for TTS synthesis.

    Attributes:
        speed: Playback speed multiplier (0.5 = half speed, 2.0 = double)
        pitch: Pitch adjustment (-1.0 to 1.0, 0.0 = normal)
        volume: Volume multiplier (0.0 to 1.0)
        format: Desired output audio format
        sample_rate: Desired output sample rate (None = use voice default)
        language: Override language for multilingual voices
    """
    speed: float = 1.0
    pitch: float = 0.0
    volume: float = 1.0
    format: AudioFormat = AudioFormat.WAV
    sample_rate: int | None = None
    language: str | None = None

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "SynthesisOptions":
        """Create options from dictionary."""
        return cls(
            speed=data.get("speed", 1.0),
            pitch=data.get("pitch", 0.0),
            volume=data.get("volume", 1.0),
            format=AudioFormat(data.get("format", "wav")),
            sample_rate=data.get("sample_rate"),
            language=data.get("language"),
        )


class TTSContract(PluginBase):
    """
    Abstract contract for Text-to-Speech plugins.

    All TTS plugins must implement this interface to be compatible
    with the Plugin Host's TTS slot.

    JSON-RPC Methods (routed by Plugin Host):
        - tts/synthesize: Convert text to speech audio
        - tts/voices: List available voices
        - tts/voice/set: Set active voice
        - tts/stream: Stream synthesis for long text (optional)

    Example Implementation:
        class KokoroTTSPlugin(TTSContract):
            async def initialize(self, config):
                self._model = KokoroModel(config["model_path"])
                self._voices = self._model.list_voices()
                self._current_voice = self._voices[0].id
                self._status = PluginStatus.READY
                return True

            async def synthesize(self, text, voice_id=None, options=None):
                voice = voice_id or self._current_voice
                audio = self._model.generate(text, voice)
                return SynthesisResult(
                    audio_data=audio,
                    format=AudioFormat.WAV,
                    ...
                )
    """

    def __init__(self):
        """Initialize TTS plugin instance."""
        super().__init__()
        self._current_voice_id: str | None = None
        self._voices: list[Voice] = []

    @abstractmethod
    async def synthesize(
        self,
        text: str,
        voice_id: str | None = None,
        options: SynthesisOptions | None = None
    ) -> SynthesisResult:
        """
        Synthesize speech from text.

        Args:
            text: Text to convert to speech. May contain SSML if supported.
            voice_id: Voice to use. If None, uses current voice.
            options: Synthesis options (speed, pitch, format, etc.)

        Returns:
            SynthesisResult containing audio data and metadata.

        Raises:
            ValueError: If text is empty or voice_id is invalid.
            RuntimeError: If synthesis fails.
        """
        pass

    @abstractmethod
    def get_voices(self) -> list[Voice]:
        """
        Get list of available voices.

        Returns:
            List of Voice objects supported by this plugin.
        """
        pass

    @abstractmethod
    def set_voice(self, voice_id: str) -> bool:
        """
        Set the active voice for synthesis.

        Args:
            voice_id: ID of voice to activate.

        Returns:
            True if voice was set successfully, False otherwise.

        Raises:
            ValueError: If voice_id is not found.
        """
        pass

    def get_current_voice(self) -> str | None:
        """
        Get the currently active voice ID.

        Returns:
            Current voice ID or None if not set.
        """
        return self._current_voice_id

    async def synthesize_stream(
        self,
        text: str,
        voice_id: str | None = None,
        options: SynthesisOptions | None = None
    ) -> AsyncIterator[bytes]:
        """
        Stream synthesis for long text (optional implementation).

        Default implementation calls synthesize() and yields full result.
        Override for true streaming support.

        Args:
            text: Text to convert to speech.
            voice_id: Voice to use.
            options: Synthesis options.

        Yields:
            Audio data chunks as bytes.
        """
        result = await self.synthesize(text, voice_id, options)
        yield result.audio_data

    def supports_ssml(self) -> bool:
        """
        Check if plugin supports SSML input.

        Returns:
            True if SSML is supported, False otherwise.
        """
        return False

    def supports_streaming(self) -> bool:
        """
        Check if plugin supports true streaming synthesis.

        Returns:
            True if streaming is natively supported, False otherwise.
        """
        return False

    def get_supported_languages(self) -> list[str]:
        """
        Get list of supported language codes.

        Returns:
            List of BCP-47 language codes (e.g., ["en-US", "ja-JP"]).
        """
        return list({v.language for v in self._voices})
