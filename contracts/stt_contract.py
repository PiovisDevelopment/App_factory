"""
D003 - contracts/stt_contract.py
================================
Speech-to-Text contract defining the interface for STT plugins.

Extends: PluginBase (D001)
Prefix: stt_ (defined in config/contract_prefixes.yaml D005)

All STT plugins (Moonshine, Whisper, Vosk, etc.) MUST implement this contract.
"""

from abc import abstractmethod
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, AsyncIterator, Callable
from enum import Enum

# Import from D001 - no forward references
from .base import PluginBase, PluginStatus, HealthStatus


class TranscriptionStatus(Enum):
    """Status of transcription operation."""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETE = "complete"
    ERROR = "error"
    CANCELLED = "cancelled"


@dataclass
class TranscriptionSegment:
    """
    A segment of transcribed text with timing information.
    
    Attributes:
        text: Transcribed text for this segment
        start_ms: Start time in milliseconds from audio beginning
        end_ms: End time in milliseconds
        confidence: Confidence score (0.0 to 1.0)
        speaker: Speaker identifier for diarization (optional)
        language: Detected language code (optional)
        words: Word-level timing (optional)
    """
    text: str
    start_ms: float
    end_ms: float
    confidence: float = 1.0
    speaker: Optional[str] = None
    language: Optional[str] = None
    words: List[Dict[str, Any]] = field(default_factory=list)
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize segment for JSON-RPC responses."""
        result = {
            "text": self.text,
            "start_ms": self.start_ms,
            "end_ms": self.end_ms,
            "confidence": self.confidence,
        }
        if self.speaker:
            result["speaker"] = self.speaker
        if self.language:
            result["language"] = self.language
        if self.words:
            result["words"] = self.words
        return result


@dataclass
class TranscriptionResult:
    """
    Result of STT transcription operation.
    
    Attributes:
        text: Full transcribed text
        segments: List of transcription segments with timing
        language: Detected or specified language code
        duration_ms: Total audio duration in milliseconds
        status: Transcription status
        metadata: Optional additional metadata
    """
    text: str
    segments: List[TranscriptionSegment]
    language: str
    duration_ms: float
    status: TranscriptionStatus = TranscriptionStatus.COMPLETE
    metadata: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize result for JSON-RPC responses."""
        return {
            "text": self.text,
            "segments": [s.to_dict() for s in self.segments],
            "language": self.language,
            "duration_ms": self.duration_ms,
            "status": self.status.value,
            "metadata": self.metadata,
        }


@dataclass
class TranscriptionOptions:
    """
    Options for STT transcription.
    
    Attributes:
        language: Target language code (None = auto-detect)
        task: "transcribe" or "translate" (translate to English)
        word_timestamps: Include word-level timing
        speaker_diarization: Enable speaker identification
        max_speakers: Maximum speakers for diarization
        beam_size: Beam size for decoding (quality vs speed)
        temperature: Sampling temperature
        initial_prompt: Prompt to guide transcription
        suppress_tokens: Token IDs to suppress
    """
    language: Optional[str] = None
    task: str = "transcribe"
    word_timestamps: bool = False
    speaker_diarization: bool = False
    max_speakers: int = 2
    beam_size: int = 5
    temperature: float = 0.0
    initial_prompt: Optional[str] = None
    suppress_tokens: List[int] = field(default_factory=list)
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "TranscriptionOptions":
        """Create options from dictionary."""
        return cls(
            language=data.get("language"),
            task=data.get("task", "transcribe"),
            word_timestamps=data.get("word_timestamps", False),
            speaker_diarization=data.get("speaker_diarization", False),
            max_speakers=data.get("max_speakers", 2),
            beam_size=data.get("beam_size", 5),
            temperature=data.get("temperature", 0.0),
            initial_prompt=data.get("initial_prompt"),
            suppress_tokens=data.get("suppress_tokens", []),
        )


@dataclass
class StreamingConfig:
    """
    Configuration for streaming transcription.
    
    Attributes:
        sample_rate: Audio sample rate in Hz
        channels: Number of audio channels (1 = mono, 2 = stereo)
        encoding: Audio encoding ("pcm_s16le", "pcm_f32le", etc.)
        chunk_duration_ms: Duration of each audio chunk
        vad_enabled: Enable voice activity detection
        vad_threshold: VAD confidence threshold (0.0 to 1.0)
    """
    sample_rate: int = 16000
    channels: int = 1
    encoding: str = "pcm_s16le"
    chunk_duration_ms: int = 100
    vad_enabled: bool = True
    vad_threshold: float = 0.5


class STTContract(PluginBase):
    """
    Abstract contract for Speech-to-Text plugins.
    
    All STT plugins must implement this interface to be compatible
    with the Plugin Host's STT slot.
    
    JSON-RPC Methods (routed by Plugin Host):
        - stt/transcribe: Transcribe audio file or buffer
        - stt/stream/start: Start streaming transcription
        - stt/stream/feed: Feed audio chunk to stream
        - stt/stream/stop: Stop streaming and get final result
        - stt/languages: List supported languages
    
    Example Implementation:
        class MoonshineSTTPlugin(STTContract):
            async def initialize(self, config):
                self._model = MoonshineModel(config["model_size"])
                self._status = PluginStatus.READY
                return True
            
            async def transcribe(self, audio_data, options=None):
                result = self._model.transcribe(audio_data)
                return TranscriptionResult(
                    text=result.text,
                    segments=[...],
                    ...
                )
    """
    
    def __init__(self):
        """Initialize STT plugin instance."""
        super().__init__()
        self._is_streaming: bool = False
        self._stream_config: Optional[StreamingConfig] = None
        self._stream_callback: Optional[Callable[[TranscriptionSegment], None]] = None
    
    @abstractmethod
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
        pass
    
    @abstractmethod
    async def start_streaming(
        self,
        config: StreamingConfig,
        callback: Optional[Callable[[TranscriptionSegment], None]] = None
    ) -> bool:
        """
        Start streaming transcription session.
        
        Args:
            config: Streaming configuration (sample rate, encoding, etc.)
            callback: Optional callback for real-time segments.
        
        Returns:
            True if streaming started successfully.
        
        Raises:
            RuntimeError: If already streaming or startup fails.
        """
        pass
    
    @abstractmethod
    async def feed_audio(self, chunk: bytes) -> Optional[TranscriptionSegment]:
        """
        Feed audio chunk to streaming session.
        
        Args:
            chunk: Raw audio bytes matching StreamingConfig.
        
        Returns:
            TranscriptionSegment if new segment available, None otherwise.
        
        Raises:
            RuntimeError: If not currently streaming.
        """
        pass
    
    @abstractmethod
    async def stop_streaming(self) -> TranscriptionResult:
        """
        Stop streaming and get final transcription result.
        
        Returns:
            Final TranscriptionResult with all segments.
        
        Raises:
            RuntimeError: If not currently streaming.
        """
        pass
    
    def get_supported_languages(self) -> List[str]:
        """
        Get list of supported language codes.
        
        Returns:
            List of BCP-47 language codes (e.g., ["en", "ja", "de"]).
        """
        return ["en"]  # Default: English only
    
    def supports_streaming(self) -> bool:
        """
        Check if plugin supports streaming transcription.
        
        Returns:
            True if streaming is supported, False otherwise.
        """
        return False
    
    def supports_diarization(self) -> bool:
        """
        Check if plugin supports speaker diarization.
        
        Returns:
            True if diarization is supported, False otherwise.
        """
        return False
    
    def supports_translation(self) -> bool:
        """
        Check if plugin supports translation to English.
        
        Returns:
            True if translation is supported, False otherwise.
        """
        return False
    
    @property
    def is_streaming(self) -> bool:
        """Check if currently in streaming mode."""
        return self._is_streaming
