"""
tts_kokoro/plugin.py
====================
Kokoro TTS Plugin Implementation

High-quality neural TTS using the Kokoro-82M model (82M parameters).
Optimized for NVIDIA RTX 4080 GPU with CUDA acceleration.

Architecture: StyleTTS 2 + ISTFTNet decoder
Model: https://huggingface.co/hexgrad/Kokoro-82M
Package: https://pypi.org/project/kokoro/ (v0.9.4+)

Dependencies:
    - D001: contracts/base.py (PluginBase)
    - D002: contracts/tts_contract.py (TTSContract)

Reference:
    - Official Usage: https://github.com/hexgrad/kokoro
    - Voices List: https://huggingface.co/hexgrad/Kokoro-82M/blob/main/VOICES.md
"""

import asyncio
import io
import struct
from typing import Any, Dict, List, Optional

import torch
import soundfile as sf

from contracts.base import PluginStatus, HealthStatus
from contracts.tts_contract import (
    TTSContract,
    Voice,
    SynthesisResult,
    SynthesisOptions,
    AudioFormat,
)


# Language code to BCP-47 mapping
LANG_CODE_MAP = {
    "a": "en-US",   # American English
    "b": "en-GB",   # British English
    "e": "es",      # Spanish
    "f": "fr-FR",   # French
    "h": "hi",      # Hindi
    "i": "it",      # Italian
    "j": "ja",      # Japanese
    "p": "pt-BR",   # Brazilian Portuguese
    "z": "zh",      # Mandarin Chinese
}

# Default voices per language code (from VOICES.md)
# Format: {lang_code: [(voice_id, display_name, gender), ...]}
DEFAULT_VOICES = {
    "a": [
        ("af_heart", "Heart (Female)", "female"),
        ("af_alloy", "Alloy (Female)", "female"),
        ("af_aoede", "Aoede (Female)", "female"),
        ("af_bella", "Bella (Female)", "female"),
        ("af_jessica", "Jessica (Female)", "female"),
        ("af_kore", "Kore (Female)", "female"),
        ("af_nicole", "Nicole (Female)", "female"),
        ("af_nova", "Nova (Female)", "female"),
        ("af_river", "River (Female)", "female"),
        ("af_sarah", "Sarah (Female)", "female"),
        ("af_sky", "Sky (Female)", "female"),
        ("am_adam", "Adam (Male)", "male"),
        ("am_echo", "Echo (Male)", "male"),
        ("am_eric", "Eric (Male)", "male"),
        ("am_fenrir", "Fenrir (Male)", "male"),
        ("am_liam", "Liam (Male)", "male"),
        ("am_michael", "Michael (Male)", "male"),
        ("am_onyx", "Onyx (Male)", "male"),
        ("am_puck", "Puck (Male)", "male"),
        ("am_santa", "Santa (Male)", "male"),
    ],
    "b": [
        ("bf_alice", "Alice (Female)", "female"),
        ("bf_emma", "Emma (Female)", "female"),
        ("bf_isabella", "Isabella (Female)", "female"),
        ("bf_lily", "Lily (Female)", "female"),
        ("bm_daniel", "Daniel (Male)", "male"),
        ("bm_fable", "Fable (Male)", "male"),
        ("bm_george", "George (Male)", "male"),
        ("bm_lewis", "Lewis (Male)", "male"),
    ],
    "j": [
        ("jf_alpha", "Alpha (Female)", "female"),
        ("jf_gongitsune", "Gongitsune (Female)", "female"),
        ("jf_nezumi", "Nezumi (Female)", "female"),
        ("jf_tebukuro", "Tebukuro (Female)", "female"),
        ("jm_beta", "Beta (Male)", "male"),
        ("jm_kumo", "Kumo (Male)", "male"),
    ],
    "z": [
        ("zf_xiaobei", "Xiaobei (Female)", "female"),
        ("zf_xiaoni", "Xiaoni (Female)", "female"),
        ("zf_xiaoxiao", "Xiaoxiao (Female)", "female"),
        ("zf_xiaoyi", "Xiaoyi (Female)", "female"),
        ("zm_yunjian", "Yunjian (Male)", "male"),
        ("zm_yunxi", "Yunxi (Male)", "male"),
        ("zm_yunxia", "Yunxia (Male)", "male"),
        ("zm_yunyang", "Yunyang (Male)", "male"),
    ],
    "e": [
        ("ef_dora", "Dora (Female)", "female"),
        ("em_alex", "Alex (Male)", "male"),
        ("em_santa", "Santa (Male)", "male"),
    ],
    "f": [
        ("ff_siwis", "Siwis (Female)", "female"),
    ],
    "h": [
        ("hf_alpha", "Alpha (Female)", "female"),
        ("hf_beta", "Beta (Female)", "female"),
        ("hm_omega", "Omega (Male)", "male"),
        ("hm_psi", "Psi (Male)", "male"),
    ],
    "i": [
        ("if_sara", "Sara (Female)", "female"),
        ("im_nicola", "Nicola (Male)", "male"),
    ],
    "p": [
        ("pf_dora", "Dora (Female)", "female"),
        ("pm_alex", "Alex (Male)", "male"),
        ("pm_santa", "Santa (Male)", "male"),
    ],
}


class KokoroTTSPlugin(TTSContract):
    """
    Kokoro TTS Plugin - High-quality neural text-to-speech.
    
    Uses the Kokoro-82M model with KPipeline for synthesis.
    Optimized for GPU inference on NVIDIA RTX cards.
    
    Features:
        - 82M parameter model with quality comparable to larger models
        - ~90x real-time generation on RTX 3090/4080 with PyTorch
        - Multi-language support (English, Japanese, Chinese, etc.)
        - Apache 2.0 licensed weights
    """

    def __init__(self):
        """Initialize the Kokoro TTS plugin."""
        super().__init__()
        self._pipeline = None
        self._device: str = "cpu"
        self._default_voice: str = "af_heart"
        self._default_lang_code: str = "a"
        self._default_speed: float = 1.0
        self._sample_rate: int = 24000  # Kokoro outputs 24kHz audio
        self._initialized: bool = False

    async def initialize(self, config: Dict[str, Any]) -> bool:
        """
        Initialize the Kokoro TTS plugin.
        
        Lazy-loads the KPipeline to avoid blocking. The actual model
        download happens on first synthesis.
        
        Args:
            config: Configuration from manifest or user overrides.
                - default_voice: str (e.g., "af_heart")
                - default_lang_code: str (e.g., "a" for American English)
                - device: str ("cuda", "cpu", or "auto")
                - speed: float (0.5 to 2.0)
        
        Returns:
            True if initialization succeeded.
        """
        try:
            # Apply configuration
            self._default_voice = config.get("default_voice", "af_heart")
            self._default_lang_code = config.get("default_lang_code", "a")
            self._default_speed = config.get("speed", 1.0)
            self._current_voice_id = self._default_voice
            
            # Determine device
            device_config = config.get("device", "auto")
            if device_config == "auto":
                self._device = "cuda" if torch.cuda.is_available() else "cpu"
            else:
                self._device = device_config
            
            # Build voice list from all languages
            self._voices = self._build_voice_list()
            
            # Defer pipeline creation to first use (lazy loading)
            # This prevents blocking during plugin initialization
            self._initialized = True
            self._status = PluginStatus.READY
            
            return True
            
        except Exception as e:
            self._status = PluginStatus.ERROR
            raise RuntimeError(f"Kokoro initialization failed: {e}")

    async def shutdown(self) -> None:
        """Clean up plugin resources."""
        self._pipeline = None
        self._initialized = False
        self._status = PluginStatus.UNLOADED
        
        # Clear CUDA cache if using GPU
        if self._device == "cuda" and torch.cuda.is_available():
            torch.cuda.empty_cache()

    async def health_check(self) -> HealthStatus:
        """
        Check plugin health.
        
        Returns:
            HealthStatus with current state and diagnostics.
        """
        details = {
            "initialized": self._initialized,
            "pipeline_loaded": self._pipeline is not None,
            "device": self._device,
            "cuda_available": torch.cuda.is_available(),
            "current_voice": self._current_voice_id,
            "voices_count": len(self._voices),
            "sample_rate": self._sample_rate,
        }
        
        if self._device == "cuda" and torch.cuda.is_available():
            details["gpu_name"] = torch.cuda.get_device_name(0)
            details["gpu_memory_allocated_mb"] = round(
                torch.cuda.memory_allocated(0) / 1024 / 1024, 2
            )
        
        return HealthStatus(
            status=self._status,
            message="Kokoro TTS operational" if self._initialized else "Not initialized",
            details=details
        )

    async def _ensure_pipeline(self, lang_code: str) -> None:
        """
        Lazy-load the Kokoro pipeline.
        
        The pipeline is created on first use to avoid blocking during
        plugin initialization. Models are auto-downloaded by kokoro package.
        
        Args:
            lang_code: Language code for the pipeline (a, b, j, z, etc.)
        """
        if self._pipeline is not None:
            # Check if we need to reinitialize for a different language
            current_lang = getattr(self._pipeline, '_lang_code', None)
            if current_lang == lang_code:
                return
        
        # Import here to defer loading until needed
        from kokoro import KPipeline
        
        # Create pipeline for the specified language
        # Run in thread to avoid blocking async event loop
        def create_pipeline():
            return KPipeline(lang_code=lang_code)
        
        self._pipeline = await asyncio.to_thread(create_pipeline)
        self._pipeline._lang_code = lang_code  # Track current language

    def _get_lang_code_for_voice(self, voice_id: str) -> str:
        """
        Determine the language code from a voice ID.
        
        Voice IDs follow the pattern: {lang}{gender}_{name}
        e.g., af_heart = American (a) Female (f) Heart
        
        Args:
            voice_id: The voice identifier.
            
        Returns:
            Single-character language code.
        """
        if voice_id and len(voice_id) >= 2:
            first_char = voice_id[0].lower()
            if first_char in LANG_CODE_MAP:
                return first_char
        return self._default_lang_code

    def _build_voice_list(self) -> List[Voice]:
        """Build the complete voice list from all languages."""
        voices = []
        
        for lang_code, voice_list in DEFAULT_VOICES.items():
            bcp47 = LANG_CODE_MAP.get(lang_code, "en-US")
            
            for voice_id, display_name, gender in voice_list:
                voices.append(Voice(
                    id=voice_id,
                    name=display_name,
                    language=bcp47,
                    gender=gender,
                    description=f"Kokoro {display_name} voice",
                    sample_rate=self._sample_rate,
                ))
        
        return voices

    async def synthesize(
        self,
        text: str,
        voice_id: Optional[str] = None,
        options: Optional[SynthesisOptions] = None
    ) -> SynthesisResult:
        """
        Synthesize speech from text using Kokoro-82M.
        
        Args:
            text: Text to convert to speech.
            voice_id: Voice to use (e.g., "af_heart"). If None, uses current voice.
            options: Synthesis options (speed, format, etc.)
        
        Returns:
            SynthesisResult containing audio data and metadata.
        
        Raises:
            ValueError: If text is empty.
            RuntimeError: If synthesis fails.
        """
        if not text or not text.strip():
            raise ValueError("Text cannot be empty")
        
        # Resolve voice and options
        use_voice = voice_id or self._current_voice_id
        opts = options or SynthesisOptions()
        speed = opts.speed if opts.speed != 1.0 else self._default_speed
        
        # Determine language from voice
        lang_code = self._get_lang_code_for_voice(use_voice)
        
        # Ensure pipeline is loaded
        await self._ensure_pipeline(lang_code)
        
        try:
            # Generate audio using Kokoro
            # KPipeline returns a generator of (graphemes, phonemes, audio) tuples
            def do_synthesis():
                audio_segments = []
                generator = self._pipeline(
                    text,
                    voice=use_voice,
                    speed=speed,
                    split_pattern=r'\n+'  # Split on newlines for long text
                )
                
                for _, _, audio in generator:
                    audio_segments.append(audio)
                
                # Concatenate all segments
                if audio_segments:
                    import numpy as np
                    return np.concatenate(audio_segments)
                return None
            
            audio_array = await asyncio.to_thread(do_synthesis)
            
            if audio_array is None or len(audio_array) == 0:
                raise RuntimeError("Synthesis produced no audio")
            
            # Convert to requested format
            audio_bytes = self._encode_audio(audio_array, opts.format)
            
            # Calculate duration
            duration_ms = (len(audio_array) / self._sample_rate) * 1000
            
            return SynthesisResult(
                audio_data=audio_bytes,
                format=opts.format,
                sample_rate=self._sample_rate,
                duration_ms=duration_ms,
                text=text,
                voice_id=use_voice,
                metadata={
                    "plugin": "tts_kokoro",
                    "model": "Kokoro-82M",
                    "device": self._device,
                    "lang_code": lang_code,
                    "speed": speed,
                }
            )
            
        except Exception as e:
            raise RuntimeError(f"Kokoro synthesis failed: {e}")

    def _encode_audio(self, audio_array, output_format: AudioFormat) -> bytes:
        """
        Encode audio array to the requested format.
        
        Args:
            audio_array: NumPy array of audio samples (float32, -1 to 1).
            output_format: Desired output format.
        
        Returns:
            Encoded audio bytes.
        """
        buffer = io.BytesIO()
        
        if output_format == AudioFormat.WAV:
            sf.write(buffer, audio_array, self._sample_rate, format='WAV')
        elif output_format == AudioFormat.PCM:
            # Raw 16-bit PCM
            import numpy as np
            pcm_data = (audio_array * 32767).astype(np.int16)
            buffer.write(pcm_data.tobytes())
        elif output_format == AudioFormat.OGG:
            sf.write(buffer, audio_array, self._sample_rate, format='OGG')
        else:
            # Default to WAV for unsupported formats
            sf.write(buffer, audio_array, self._sample_rate, format='WAV')
        
        buffer.seek(0)
        return buffer.read()

    def get_voices(self) -> List[Voice]:
        """
        Get list of available voices.
        
        Returns:
            List of Voice objects for all supported languages.
        """
        return self._voices.copy()

    def set_voice(self, voice_id: str) -> bool:
        """
        Set the active voice for synthesis.
        
        Args:
            voice_id: ID of voice to activate (e.g., "af_heart").
        
        Returns:
            True if voice was set successfully.
        
        Raises:
            ValueError: If voice_id is not found.
        """
        # Validate voice exists
        found = any(v.id == voice_id for v in self._voices)
        if not found:
            raise ValueError(f"Voice '{voice_id}' not found")
        
        self._current_voice_id = voice_id
        return True

    def get_supported_languages(self) -> List[str]:
        """
        Get list of supported language codes.
        
        Returns:
            List of BCP-47 language codes.
        """
        return list(LANG_CODE_MAP.values())


# Export for plugin discovery
Plugin = KokoroTTSPlugin
