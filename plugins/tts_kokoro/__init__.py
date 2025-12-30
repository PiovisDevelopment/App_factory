"""
tts_kokoro - Kokoro TTS Plugin
==============================
High-quality neural TTS using the Kokoro-82M model.
Implements the TTSContract for integration with the Plugin Host.

Model: https://huggingface.co/hexgrad/Kokoro-82M
Package: https://pypi.org/project/kokoro/
"""

from .plugin import KokoroTTSPlugin, Plugin

__all__ = ["KokoroTTSPlugin", "Plugin"]
