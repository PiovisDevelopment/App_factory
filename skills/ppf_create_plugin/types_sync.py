#!/usr/bin/env python3
"""
TypeScript interface sync tool for Piovis plugins.

Responsibilities:
- Regenerate `src/types/{domain}.ts` from a plugin's manifest.
- Optionally run in `--check` mode to detect drift between the manifest
  and the existing TS interfaces.

Usage:
  python skills/ppf_create_plugin/types_sync.py <plugin_name>
  python skills/ppf_create_plugin/types_sync.py <plugin_name> --check
"""

import logging
import os
import sys
from typing import Any

# Ensure we can import config from this directory
CURRENT_DIR = os.path.dirname(os.path.abspath(__file__))
if CURRENT_DIR not in sys.path:
    sys.path.insert(0, CURRENT_DIR)

try:
    import yaml  # type: ignore
except ImportError:
    print(
        "PyYAML is required for types_sync.\n"
        "Please run 'pip install pyyaml' in your environment and retry."
    )
    sys.exit(1)

from config import TS_INTERFACE_TEMPLATE, TYPE_MAP  # type: ignore

logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
logger = logging.getLogger("TypesSync")


def to_pascal_case(snake_str: str) -> str:
    return "".join(x.capitalize() for x in snake_str.lower().split("_"))


def map_type_to_ts(py_type: str) -> str:
    return TYPE_MAP.get(py_type, "any")


def load_manifest(plugin_name: str) -> dict[str, Any]:
    """
    Load component.yaml for a given plugin.

    plugin_name is the logical name (e.g., "stock_data"), not the folder name.
    """
    # Assume project root is two levels up from this file (skills/ppf_create_plugin)
    project_root = os.path.dirname(os.path.dirname(CURRENT_DIR))
    plugin_dir = os.path.join(project_root, "plugins", f"{plugin_name}_plugin")
    manifest_path = os.path.join(plugin_dir, "component.yaml")

    if not os.path.exists(manifest_path):
        raise FileNotFoundError(f"Manifest not found for plugin '{plugin_name}' at {manifest_path}")

    with open(manifest_path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def build_ts_from_manifest(manifest: dict[str, Any]) -> str:
    """
    Render TS interfaces from the manifest's contract metadata.

    This mirrors `_build_ts_interfaces` semantics for inputs/outputs, using
    METHOD Request/Response types and a domain API interface.
    """
    contract = manifest.get("contract") or {}
    domain = contract.get("domain")
    methods = contract.get("methods") or []

    if not domain:
        raise ValueError("Manifest contract domain is missing.")

    interfaces_parts: list[str] = []
    api_signatures: list[str] = []

    for m in methods:
        name = m.get("name")
        if not name:
            continue

        method_pascal = to_pascal_case(name)

        inputs = m.get("inputs") or {}
        outputs = m.get("outputs") or {}

        # Request interface
        interfaces_parts.append(f"export interface {method_pascal}Request {{")
        if inputs:
            for field_name, py_type in inputs.items():
                interfaces_parts.append(f"  {field_name}: {map_type_to_ts(str(py_type))};")
        interfaces_parts.append("}\n")

        # Response interface
        interfaces_parts.append(f"export interface {method_pascal}Response {{")
        if outputs:
            for field_name, py_type in outputs.items():
                interfaces_parts.append(f"  {field_name}: {map_type_to_ts(str(py_type))};")
        interfaces_parts.append("}\n")

        api_signatures.append(
            f"  {name}(req: {method_pascal}Request): Promise<{method_pascal}Response>;"
        )

    interfaces_str = "\n".join(interfaces_parts)
    class_name = to_pascal_case(domain)

    return TS_INTERFACE_TEMPLATE.format(
        domain=domain,
        interfaces=interfaces_str,
        class_name=class_name,
        method_signatures="\n".join(api_signatures),
    )


def sync_types(plugin_name: str, check_only: bool = False) -> int:
    manifest = load_manifest(plugin_name)
    ts_content = build_ts_from_manifest(manifest)

    project_root = os.path.dirname(os.path.dirname(CURRENT_DIR))
    contract = manifest.get("contract") or {}
    domain = contract.get("domain")
    if not domain:
        raise ValueError("Manifest contract domain is missing.")

    types_dir = os.path.join(project_root, "src", "types")
    os.makedirs(types_dir, exist_ok=True)
    ts_path = os.path.join(types_dir, f"{domain}.ts")

    if check_only and os.path.exists(ts_path):
        existing = ""
        with open(ts_path, encoding="utf-8") as f:
            existing = f.read()

        if existing.strip() == ts_content.strip():
            logger.info("Types for domain '%s' are in sync (%s).", domain, ts_path)
            return 0

        logger.error("Drift detected for domain '%s'.", domain)
        logger.error("Run this tool without --check to regenerate: %s", ts_path)
        return 1

    with open(ts_path, "w", encoding="utf-8") as f:
        f.write(ts_content)

    logger.info("Types for domain '%s' written to %s", domain, ts_path)
    return 0


def main(argv: list[str]) -> int:  # type: ignore[name-defined]
    if len(argv) < 1:
        print("Usage: types_sync.py <plugin_name> [--check]")
        return 1

    plugin_name = argv[0]
    check_only = "--check" in argv[1:]

    try:
        return sync_types(plugin_name, check_only=check_only)
    except Exception as exc:
        logger.error("Failed to sync types for plugin '%s': %s", plugin_name, exc)
        return 1


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))

