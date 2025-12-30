"""
D056 - plugins/_host/templates/
===============================
Plugin template files for scaffold generation.

This package contains template files used by scaffold.py (D055) to
generate new plugin skeletons based on contract type.

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Dependencies:
    - D055: scaffold.py (uses these templates)

Template files:
    - base_plugin.py.template: Base plugin class template
    - tts_plugin.py.template: TTS contract implementation template
    - stt_plugin.py.template: STT contract implementation template
    - llm_plugin.py.template: LLM contract implementation template
    - manifest.json.template: Manifest file template
    - readme.md.template: README file template
"""

from pathlib import Path

# Template directory path
TEMPLATES_DIR = Path(__file__).parent

# Available templates
TEMPLATES = {
    "base_plugin": "base_plugin.py.template",
    "tts_plugin": "tts_plugin.py.template",
    "stt_plugin": "stt_plugin.py.template",
    "llm_plugin": "llm_plugin.py.template",
    "manifest": "manifest.json.template",
    "readme": "readme.md.template",
}


def get_template_path(template_name: str) -> Path | None:
    """
    Get the path to a template file.

    Args:
        template_name: Template identifier (e.g., 'base_plugin', 'tts_plugin')

    Returns:
        Path to template file or None if not found
    """
    if template_name not in TEMPLATES:
        return None
    return TEMPLATES_DIR / TEMPLATES[template_name]


def load_template(template_name: str) -> str | None:
    """
    Load template content as string.

    Args:
        template_name: Template identifier

    Returns:
        Template content or None if not found
    """
    path = get_template_path(template_name)
    if path is None or not path.exists():
        return None
    return path.read_text(encoding="utf-8")


def list_templates() -> list[str]:
    """
    List available template names.

    Returns:
        List of template identifiers
    """
    return list(TEMPLATES.keys())


__all__ = [
    "TEMPLATES_DIR",
    "TEMPLATES",
    "get_template_path",
    "load_template",
    "list_templates",
]
