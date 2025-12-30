"""
B018 - plugins/tts_example_plugin/__init__.py
==============================================
Example TTS plugin package initialization.

Exports the Plugin class for discovery by the plugin host.
"""

from .plugin import ExampleTTSPlugin, Plugin

__all__ = ["ExampleTTSPlugin", "Plugin"]
