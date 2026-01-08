"""
services/__init__.py
====================
High-level service facades for AI-friendly plugin usage.

These services provide simple, one-liner APIs for common AI tasks:
- VoiceService: Text-to-speech and speech-to-text
- LLMService: Language model completions and chat
"""

from .llm import LLMService
from .voice import VoiceService

__all__ = ["VoiceService", "LLMService"]
