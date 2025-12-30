#!/usr/bin/env python3
"""
Heavy Python library detection for Piovis plugins.

Used by ppf_create_plugin to warn users when they select or infer
libraries that are large or commonly conflict-prone in shared environments.
"""

from __future__ import annotations

from typing import Any, Iterable, List, Mapping, Union

# Conservative catalog of heavy / conflict-prone libraries.
HEAVY_PYTHON_LIBRARIES = {
    "torch",
    "torchvision",
    "torchaudio",
    "tensorflow",
    "tensorflow-gpu",
    "jax",
    "pandas",
    "opencv-python",
    "opencv-contrib-python",
    "spacy",
}


def _normalize_name(name: str) -> str:
    return name.replace("_", "-").lower().strip()


def detect_heavy_libraries(
    python_dependencies: Iterable[Union[str, Mapping[str, Any]]]
) -> List[str]:
    """
    Given a list of python dependency entries, return a sorted list of
    those considered heavy.

    Each entry may be:
      - a string package name, or
      - a mapping with a 'name' key.
    """
    heavy: List[str] = []

    for entry in python_dependencies:
        if isinstance(entry, str):
            raw_name = entry
        elif isinstance(entry, Mapping):
            raw_name = str(entry.get("name", ""))
        else:
            continue

        norm = _normalize_name(raw_name)
        if norm in HEAVY_PYTHON_LIBRARIES:
            heavy.append(raw_name)

    # Deduplicate while preserving case-insensitive order.
    seen = set()
    result: List[str] = []
    for name in sorted(heavy, key=lambda n: n.lower()):
        key = name.lower()
        if key not in seen:
            seen.add(key)
            result.append(name)
    return result

