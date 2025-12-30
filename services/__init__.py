"""
services/__init__.py
====================
High-level service facades for AI-friendly plugin usage.

These services provide simple, one-liner APIs for common AI tasks:
- VoiceService: Text-to-speech and speech-to-text
- LLMService: Language model completions and chat
"""

from .voice import VoiceService
from .llm import LLMService

__all__ = ["VoiceService", "LLMService"]
