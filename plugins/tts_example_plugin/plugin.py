"""
B018 - plugins/tts_example_plugin/plugin.py
===========================================
Example TTS plugin demonstrating contract implementation.

This minimal plugin generates silence (zero-filled audio) for testing
the TTS pipeline without requiring actual TTS models.

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Dependencies:
    - D001: contracts/base.py (PluginBase)
    - D002: contracts/tts_contract.py (TTSContract)
"""

import struct
from typing import Any

from contracts.base import HealthStatus, PluginStatus
from contracts.tts_contract import (
    AudioFormat,
    SynthesisOptions,
    SynthesisResult,
    TTSContract,
    Voice,
)


class ExampleTTSPlugin(TTSContract):
    """
    Minimal TTS plugin for testing and demonstration.

    Generates silent audio of appropriate duration based on text length.
    Each character generates ~50ms of silence at the configured sample rate.
    """

    def __init__(self) -> None:
        """Initialize the example TTS plugin."""
        super().__init__()
        self._sample_rate: int = 22050
        self._default_voice: str = "alice"

        # Define example voices
        self._voices = [
            Voice(
                id="alice",
                name="Alice",
                language="en-US",
                gender="female",
                description="Default female voice (example)",
                sample_rate=22050,
            ),
            Voice(
                id="bob",
                name="Bob",
                language="en-US",
                gender="male",
                description="Default male voice (example)",
                sample_rate=22050,
            ),
            Voice(
                id="charlie",
                name="Charlie",
                language="en-GB",
                gender="neutral",
                description="British neutral voice (example)",
                sample_rate=44100,
            ),
        ]

        self._current_voice_id = self._default_voice

    async def initialize(self, config: dict[str, Any]) -> bool:
        """
        Initialize the plugin with configuration.

        Args:
            config: Configuration dictionary from manifest default_config
                    or user overrides.

        Returns:
            True if initialization succeeded.
        """
        self._default_voice = config.get("default_voice", "alice")
        self._sample_rate = config.get("sample_rate", 22050)
        self._current_voice_id = self._default_voice

        # Update voice sample rates based on config
        for voice in self._voices:
            if voice.id in ["alice", "bob"]:
                voice.sample_rate = self._sample_rate

        self._status = PluginStatus.READY
        return True

    async def shutdown(self) -> bool:
        """Clean up plugin resources."""
        self._status = PluginStatus.STOPPED
        return True

    def health_check(self) -> HealthStatus:
        """
        Check plugin health.

        Returns:
            HealthStatus with current state.
        """
        return HealthStatus(
            status=self._status,
            message="Example TTS plugin operational" if self._status == PluginStatus.READY else "Plugin not ready",
            details={
                "voices_available": len(self._voices),
                "current_voice": self._current_voice_id,
                "sample_rate": self._sample_rate,
            },
        )

    async def synthesize(
        self, text: str, voice_id: str | None = None, options: SynthesisOptions | None = None
    ) -> SynthesisResult:
        """
        Synthesize speech from text.

        Generates silent audio with duration proportional to text length.
        ~50ms per character at default settings.

        Args:
            text: Text to "synthesize" (determines duration).
            voice_id: Voice to use (affects sample rate).
            options: Synthesis options.

        Returns:
            SynthesisResult with silent WAV audio.

        Raises:
            ValueError: If text is empty or voice_id is invalid.
        """
        if not text:
            raise ValueError("Text cannot be empty")

        # Resolve voice
        use_voice_id = voice_id or self._current_voice_id
        voice = self._get_voice_by_id(use_voice_id)
        if not voice:
            raise ValueError(f"Voice '{use_voice_id}' not found")

        # Apply options
        opts = options or SynthesisOptions()
        sample_rate = opts.sample_rate or voice.sample_rate
        speed = opts.speed

        # Calculate duration: ~50ms per character, adjusted by speed
        base_duration_ms = len(text) * 50
        duration_ms = base_duration_ms / speed

        # Generate silent audio (16-bit PCM)
        num_samples = int((duration_ms / 1000) * sample_rate)

        # Create WAV file in memory
        if opts.format == AudioFormat.WAV:
            audio_data = self._create_wav(num_samples, sample_rate)
        else:
            # For other formats, just return raw PCM zeros
            audio_data = bytes(num_samples * 2)  # 16-bit = 2 bytes per sample

        return SynthesisResult(
            audio_data=audio_data,
            format=opts.format,
            sample_rate=sample_rate,
            duration_ms=duration_ms,
            text=text,
            voice_id=use_voice_id,
            metadata={
                "plugin": "tts_example_plugin",
                "is_silent": True,
                "char_count": len(text),
            },
        )

    def get_voices(self) -> list[Voice]:
        """
        Get list of available voices.

        Returns:
            List of example Voice objects.
        """
        return self._voices.copy()

    def set_voice(self, voice_id: str) -> bool:
        """
        Set the active voice.

        Args:
            voice_id: ID of voice to activate.

        Returns:
            True if voice was set.

        Raises:
            ValueError: If voice_id not found.
        """
        voice = self._get_voice_by_id(voice_id)
        if not voice:
            raise ValueError(f"Voice '{voice_id}' not found")

        self._current_voice_id = voice_id
        return True

    def _get_voice_by_id(self, voice_id: str) -> Voice | None:
        """Get voice object by ID."""
        for voice in self._voices:
            if voice.id == voice_id:
                return voice
        return None

    def _create_wav(self, num_samples: int, sample_rate: int) -> bytes:
        """
        Create a WAV file with silent audio.

        Args:
            num_samples: Number of samples.
            sample_rate: Sample rate in Hz.

        Returns:
            WAV file bytes.
        """
        # WAV header constants
        channels = 1
        bits_per_sample = 16
        byte_rate = sample_rate * channels * bits_per_sample // 8
        block_align = channels * bits_per_sample // 8
        data_size = num_samples * block_align

        # Build WAV header
        header = bytearray()

        # RIFF header
        header.extend(b"RIFF")
        header.extend(struct.pack("<I", 36 + data_size))  # File size - 8
        header.extend(b"WAVE")

        # fmt chunk
        header.extend(b"fmt ")
        header.extend(struct.pack("<I", 16))  # Chunk size
        header.extend(struct.pack("<H", 1))  # PCM format
        header.extend(struct.pack("<H", channels))
        header.extend(struct.pack("<I", sample_rate))
        header.extend(struct.pack("<I", byte_rate))
        header.extend(struct.pack("<H", block_align))
        header.extend(struct.pack("<H", bits_per_sample))

        # data chunk
        header.extend(b"data")
        header.extend(struct.pack("<I", data_size))

        # Silent audio data (zeros)
        audio_data = bytes(data_size)

        return bytes(header) + audio_data


# Plugin instance for discovery
Plugin = ExampleTTSPlugin
