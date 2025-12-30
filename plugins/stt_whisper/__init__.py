"""
stt_whisper - Faster Whisper STT Plugin
========================================
High-performance speech-to-text using faster-whisper (CTranslate2).
Implements the STTContract for integration with the Plugin Host.

Repository: https://github.com/SYSTRAN/faster-whisper
"""

from .plugin import WhisperSTTPlugin, Plugin

__all__ = ["WhisperSTTPlugin", "Plugin"]
