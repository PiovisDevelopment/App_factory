"""
llm_ollama_v2 - Ollama LLM Plugin
=================================
Local LLM inference via Ollama server.
Implements the LLMContract for integration with the Plugin Host.

Repository: https://ollama.com
API Docs: https://github.com/ollama/ollama/blob/main/docs/api.md
"""

from .plugin import OllamaLLMPlugin, Plugin

__all__ = ["OllamaLLMPlugin", "Plugin"]
