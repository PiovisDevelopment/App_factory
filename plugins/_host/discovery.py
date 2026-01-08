"""
D020 - plugins/_host/discovery.py
=================================
Plugin discovery system using HybridDiscovery pattern.

Scans ./plugins/ directory for valid plugin manifests, validates them
against contract_prefixes.yaml (D005), and returns list of discovered plugins.

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Dependencies:
    - D005: config/contract_prefixes.yaml (valid prefix definitions)
    - D008: config/manifest_schema.json (manifest validation schema)

This module is imported by:
    - D022: validator.py
    - D023: loader.py
    - D024: manager.py
"""

import json
import logging
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

# Configure logging to stderr (NOT stdout - stdout is for JSON-RPC)
logger = logging.getLogger(__name__)


@dataclass
class DiscoveredPlugin:
    """
    Represents a discovered plugin before loading.

    Attributes:
        path: Absolute path to plugin folder
        manifest: Parsed manifest.json contents
        contract: Contract type from manifest (e.g., "tts", "llm")
        name: Plugin name from manifest
        version: Plugin version from manifest
        entry_point: Python module name to import
        valid: Whether manifest passed initial validation
        errors: List of validation errors if not valid
    """
    path: Path
    manifest: dict[str, Any]
    contract: str
    name: str
    version: str
    entry_point: str
    valid: bool = True
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSON-RPC responses."""
        return {
            "path": str(self.path),
            "manifest": self.manifest,
            "contract": self.contract,
            "name": self.name,
            "version": self.version,
            "entry_point": self.entry_point,
            "valid": self.valid,
            "errors": self.errors,
        }


class HybridDiscovery:
    """
    Hybrid plugin discovery system combining:
    1. Static registry (contract_prefixes.yaml) for valid prefixes
    2. Dynamic filesystem scan for installed plugins

    Patterns applied:
        - KISS: Simple folder scan with manifest parsing
        - YAGNI: No caching, lazy loading, or watch mode until needed
        - Contract-first: Validates prefix against static registry

    Usage:
        discovery = HybridDiscovery(plugins_dir="./plugins", config_dir="./config")
        plugins = discovery.scan()
        for plugin in plugins:
            if plugin.valid:
                print(f"Found: {plugin.name} ({plugin.contract})")
    """

    def __init__(
        self,
        plugins_dir: str | Path = "./plugins",
        config_dir: str | Path = "./config"
    ):
        """
        Initialize discovery system.

        Args:
            plugins_dir: Path to plugins directory to scan
            config_dir: Path to config directory containing prefixes yaml
        """
        self.plugins_dir = Path(plugins_dir).resolve()
        self.config_dir = Path(config_dir).resolve()

        # Load valid prefixes from config
        self._prefixes: dict[str, dict[str, Any]] = {}
        self._prefix_pattern: re.Pattern | None = None
        self._load_prefixes()

        logger.debug(f"HybridDiscovery initialized: plugins={self.plugins_dir}")

    def _load_prefixes(self) -> None:
        """
        Load valid contract prefixes from contract_prefixes.yaml (D005).

        Raises:
            FileNotFoundError: If contract_prefixes.yaml not found
            yaml.YAMLError: If YAML parsing fails
        """
        prefixes_path = self.config_dir / "contract_prefixes.yaml"

        if not prefixes_path.exists():
            logger.warning(f"contract_prefixes.yaml not found at {prefixes_path}")
            # Default prefixes if config missing
            self._prefixes = {
                "tts": {"contract": "tts_contract", "description": "TTS plugins"},
                "stt": {"contract": "stt_contract", "description": "STT plugins"},
                "llm": {"contract": "llm_contract", "description": "LLM plugins"},
            }
        else:
            with open(prefixes_path, encoding="utf-8") as f:
                config = yaml.safe_load(f)
                self._prefixes = config.get("prefixes", {})

        # Build regex pattern from prefixes
        prefix_list = "|".join(self._prefixes.keys())
        self._prefix_pattern = re.compile(
            rf"^({prefix_list})_[a-z0-9_]+_plugin$"
        )

        logger.debug(f"Loaded {len(self._prefixes)} valid prefixes: {list(self._prefixes.keys())}")

    @property
    def valid_prefixes(self) -> set[str]:
        """Get set of valid contract prefixes."""
        return set(self._prefixes.keys())

    def get_prefix_info(self, prefix: str) -> dict[str, Any] | None:
        """
        Get information about a contract prefix.

        Args:
            prefix: Contract prefix (e.g., "tts", "llm")

        Returns:
            Prefix configuration dict or None if not found
        """
        return self._prefixes.get(prefix)

    def validate_folder_name(self, folder_name: str) -> tuple[bool, str | None, list[str]]:
        """
        Validate plugin folder name against naming convention.

        Args:
            folder_name: Name of plugin folder (not full path)

        Returns:
            Tuple of (is_valid, extracted_prefix, errors)
        """
        errors = []

        # Skip hidden folders and special folders
        if folder_name.startswith("_") or folder_name.startswith("."):
            return False, None, ["Folder name starts with underscore or dot (reserved)"]

        # Check pattern match
        if not self._prefix_pattern:
            return False, None, ["No prefix pattern loaded"]

        match = self._prefix_pattern.match(folder_name)
        if not match:
            valid_prefixes = ", ".join(sorted(self._prefixes.keys()))
            errors.append(
                f"Folder name '{folder_name}' does not match pattern. "
                f"Expected: <prefix>_<name>_plugin where prefix is one of: {valid_prefixes}"
            )
            return False, None, errors

        prefix = match.group(1)
        return True, prefix, []

    def parse_manifest(self, plugin_path: Path) -> tuple[dict[str, Any] | None, list[str]]:
        """
        Parse and validate manifest.json from plugin folder.

        Args:
            plugin_path: Path to plugin folder

        Returns:
            Tuple of (manifest_dict, errors)
        """
        manifest_path = plugin_path / "manifest.json"
        errors = []

        if not manifest_path.exists():
            return None, [f"manifest.json not found in {plugin_path}"]

        try:
            with open(manifest_path, encoding="utf-8") as f:
                manifest = json.load(f)
        except json.JSONDecodeError as e:
            return None, [f"Invalid JSON in manifest.json: {e}"]
        except Exception as e:
            return None, [f"Error reading manifest.json: {e}"]

        # Validate required fields (basic validation, D022 does full schema validation)
        required_fields = ["name", "version", "contract", "entry_point"]
        for field in required_fields:
            if field not in manifest:
                errors.append(f"Missing required field '{field}' in manifest.json")

        if errors:
            return manifest, errors

        return manifest, []

    def discover_plugin(self, plugin_path: Path) -> DiscoveredPlugin:
        """
        Discover a single plugin from its folder path.

        Args:
            plugin_path: Absolute path to plugin folder

        Returns:
            DiscoveredPlugin with validation results
        """
        folder_name = plugin_path.name
        all_errors: list[str] = []

        # Validate folder name
        name_valid, prefix, name_errors = self.validate_folder_name(folder_name)
        all_errors.extend(name_errors)

        # Parse manifest
        manifest, manifest_errors = self.parse_manifest(plugin_path)
        all_errors.extend(manifest_errors)

        # If manifest parsing failed, return with errors
        if manifest is None:
            return DiscoveredPlugin(
                path=plugin_path,
                manifest={},
                contract="unknown",
                name=folder_name,
                version="0.0.0",
                entry_point="plugin",
                valid=False,
                errors=all_errors,
            )

        # Extract fields from manifest
        name = manifest.get("name", folder_name)
        version = manifest.get("version", "0.0.0")
        contract = manifest.get("contract", "unknown")
        entry_point = manifest.get("entry_point", "plugin")

        # Cross-validate: folder name should match manifest name
        if name != folder_name:
            all_errors.append(
                f"Manifest name '{name}' does not match folder name '{folder_name}'"
            )

        # Cross-validate: prefix should match contract
        if prefix and prefix != contract:
            all_errors.append(
                f"Folder prefix '{prefix}' does not match manifest contract '{contract}'"
            )

        # Validate contract is known
        if contract not in self._prefixes:
            all_errors.append(
                f"Unknown contract type '{contract}'. "
                f"Valid types: {', '.join(sorted(self._prefixes.keys()))}"
            )

        # Check entry point file exists
        entry_file = plugin_path / f"{entry_point}.py"
        if not entry_file.exists():
            all_errors.append(f"Entry point file '{entry_point}.py' not found")

        return DiscoveredPlugin(
            path=plugin_path,
            manifest=manifest,
            contract=contract,
            name=name,
            version=version,
            entry_point=entry_point,
            valid=len(all_errors) == 0,
            errors=all_errors,
        )

    def scan(self, include_invalid: bool = False) -> list[DiscoveredPlugin]:
        """
        Scan plugins directory for all plugins.

        Args:
            include_invalid: If True, include plugins that failed validation

        Returns:
            List of DiscoveredPlugin objects
        """
        discovered: list[DiscoveredPlugin] = []

        if not self.plugins_dir.exists():
            logger.warning(f"Plugins directory does not exist: {self.plugins_dir}")
            return discovered

        if not self.plugins_dir.is_dir():
            logger.error(f"Plugins path is not a directory: {self.plugins_dir}")
            return discovered

        # Scan each subfolder
        for item in self.plugins_dir.iterdir():
            # Skip files, hidden folders, and special folders
            if not item.is_dir():
                continue
            if item.name.startswith("."):
                continue
            if item.name.startswith("_"):
                # Skip _host and other special folders
                continue

            plugin = self.discover_plugin(item)

            if plugin.valid or include_invalid:
                discovered.append(plugin)
                status = "valid" if plugin.valid else "INVALID"
                logger.debug(f"Discovered: {plugin.name} ({plugin.contract}) [{status}]")
                if not plugin.valid:
                    for error in plugin.errors:
                        logger.debug(f"  Error: {error}")

        logger.info(f"Discovery complete: {len(discovered)} plugins found")
        return discovered

    def scan_by_contract(
        self,
        contract: str,
        include_invalid: bool = False
    ) -> list[DiscoveredPlugin]:
        """
        Scan for plugins of a specific contract type.

        Args:
            contract: Contract type to filter by (e.g., "tts", "llm")
            include_invalid: If True, include plugins that failed validation

        Returns:
            List of DiscoveredPlugin objects matching the contract
        """
        all_plugins = self.scan(include_invalid=include_invalid)
        return [p for p in all_plugins if p.contract == contract]

    def find_plugin(self, name: str) -> DiscoveredPlugin | None:
        """
        Find a specific plugin by name.

        Args:
            name: Plugin name to find

        Returns:
            DiscoveredPlugin if found, None otherwise
        """
        plugin_path = self.plugins_dir / name
        if not plugin_path.exists():
            return None
        return self.discover_plugin(plugin_path)

    def get_contracts_summary(self) -> dict[str, list[str]]:
        """
        Get summary of plugins grouped by contract type.

        Returns:
            Dict mapping contract type to list of plugin names
        """
        summary: dict[str, list[str]] = {prefix: [] for prefix in self._prefixes}

        for plugin in self.scan(include_invalid=False):
            if plugin.contract in summary:
                summary[plugin.contract].append(plugin.name)

        return summary


# Module-level convenience function
def discover_plugins(
    plugins_dir: str | Path = "./plugins",
    config_dir: str | Path = "./config",
    include_invalid: bool = False
) -> list[DiscoveredPlugin]:
    """
    Convenience function to discover plugins.

    Args:
        plugins_dir: Path to plugins directory
        config_dir: Path to config directory
        include_invalid: Include invalid plugins in results

    Returns:
        List of DiscoveredPlugin objects
    """
    discovery = HybridDiscovery(plugins_dir, config_dir)
    return discovery.scan(include_invalid=include_invalid)


# Entry point for testing
if __name__ == "__main__":
    # Configure logging for testing
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stderr
    )

    # Determine paths relative to this file
    this_dir = Path(__file__).parent.resolve()
    plugins_dir = this_dir.parent  # ./plugins
    config_dir = this_dir.parent.parent / "config"  # ./config

    print(f"Scanning: {plugins_dir}", file=sys.stderr)
    print(f"Config: {config_dir}", file=sys.stderr)

    discovery = HybridDiscovery(plugins_dir, config_dir)
    plugins = discovery.scan(include_invalid=True)

    print(f"\n=== Discovered {len(plugins)} plugins ===", file=sys.stderr)
    for plugin in plugins:
        status = "✓" if plugin.valid else "✗"
        print(f"{status} {plugin.name} ({plugin.contract}) v{plugin.version}", file=sys.stderr)
        for error in plugin.errors:
            print(f"    └─ {error}", file=sys.stderr)
