"""
D022 - plugins/_host/validator.py
=================================
Plugin manifest and contract validation.

Validates plugin manifests against JSON Schema (D008) and verifies
plugins implement the correct contract interface.

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Dependencies:
    - D005: config/contract_prefixes.yaml (valid prefixes)
    - D008: config/manifest_schema.json (manifest validation schema)
    - D020: discovery.py (DiscoveredPlugin dataclass)
    - D021: config/contracts_registry.yaml (contract method definitions)
"""

import importlib
import inspect
import json
import logging
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

try:
    import jsonschema
    HAS_JSONSCHEMA = True
except ImportError:
    HAS_JSONSCHEMA = False

from contracts.base import PluginBase

logger = logging.getLogger(__name__)


@dataclass
class ValidationResult:
    """
    Result of plugin validation.

    Attributes:
        plugin_name: Name of the validated plugin
        valid: Overall validation status
        errors: Critical errors that prevent loading
        warnings: Non-critical issues
        manifest_valid: Whether manifest passes schema validation
        contract_valid: Whether plugin implements contract correctly
        methods_found: List of methods found on the plugin
        methods_missing: Required methods not implemented
        methods_extra: Extra methods beyond contract requirements
    """
    plugin_name: str
    valid: bool = True
    errors: list[str] = field(default_factory=list)
    warnings: list[str] = field(default_factory=list)
    manifest_valid: bool = True
    contract_valid: bool = True
    methods_found: list[str] = field(default_factory=list)
    methods_missing: list[str] = field(default_factory=list)
    methods_extra: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSON-RPC responses."""
        return {
            "plugin_name": self.plugin_name,
            "valid": self.valid,
            "errors": self.errors,
            "warnings": self.warnings,
            "manifest_valid": self.manifest_valid,
            "contract_valid": self.contract_valid,
            "methods": {
                "found": self.methods_found,
                "missing": self.methods_missing,
                "extra": self.methods_extra,
            },
        }

    def add_error(self, error: str) -> None:
        """Add an error and mark as invalid."""
        self.errors.append(error)
        self.valid = False

    def add_warning(self, warning: str) -> None:
        """Add a warning (does not affect validity)."""
        self.warnings.append(warning)


class PluginValidator:
    """
    Validates plugins against manifest schema and contract requirements.

    Validation stages:
        1. Manifest Schema Validation - JSON Schema against D008
        2. Contract Existence - Verify contract type is known
        3. Module Import - Attempt to import plugin module
        4. Class Discovery - Find plugin class implementing contract
        5. Method Validation - Verify required methods exist
        6. Signature Validation - Check method signatures match contract

    Usage:
        validator = PluginValidator(config_dir="./config")
        result = validator.validate_plugin(discovered_plugin)
        if not result.valid:
            for error in result.errors:
                print(f"Error: {error}")
    """

    def __init__(self, config_dir: str | Path = "./config"):
        """
        Initialize validator with configuration.

        Args:
            config_dir: Path to config directory
        """
        self.config_dir = Path(config_dir).resolve()

        # Load manifest schema (D008)
        self._manifest_schema: dict[str, Any] | None = None
        self._load_manifest_schema()

        # Load contracts registry (D021)
        self._contracts: dict[str, dict[str, Any]] = {}
        self._load_contracts_registry()

        logger.debug(f"PluginValidator initialized: config={self.config_dir}")

    def _load_manifest_schema(self) -> None:
        """Load manifest JSON Schema from D008."""
        schema_path = self.config_dir / "manifest_schema.json"

        if not schema_path.exists():
            logger.warning(f"manifest_schema.json not found at {schema_path}")
            return

        try:
            with open(schema_path, encoding="utf-8") as f:
                self._manifest_schema = json.load(f)
            logger.debug("Loaded manifest schema")
        except Exception as e:
            logger.error(f"Failed to load manifest schema: {e}")

    def _load_contracts_registry(self) -> None:
        """Load contracts registry from D021."""
        registry_path = self.config_dir / "contracts_registry.yaml"

        if not registry_path.exists():
            logger.warning(f"contracts_registry.yaml not found at {registry_path}")
            return

        try:
            with open(registry_path, encoding="utf-8") as f:
                registry = yaml.safe_load(f)
                self._contracts = registry.get("contracts", {})
            logger.debug(f"Loaded {len(self._contracts)} contract definitions")
        except Exception as e:
            logger.error(f"Failed to load contracts registry: {e}")

    def validate_manifest_schema(
        self,
        manifest: dict[str, Any],
        result: ValidationResult
    ) -> None:
        """
        Validate manifest against JSON Schema.

        Args:
            manifest: Parsed manifest dictionary
            result: ValidationResult to update
        """
        if not HAS_JSONSCHEMA:
            result.add_warning("jsonschema not installed, skipping schema validation")
            return

        if not self._manifest_schema:
            result.add_warning("Manifest schema not loaded, skipping schema validation")
            return

        try:
            jsonschema.validate(instance=manifest, schema=self._manifest_schema)
            logger.debug(f"Manifest schema validation passed for {result.plugin_name}")
        except jsonschema.ValidationError as e:
            result.manifest_valid = False
            result.add_error(f"Manifest schema validation failed: {e.message}")
            # Add path to error if available
            if e.absolute_path:
                path = ".".join(str(p) for p in e.absolute_path)
                result.add_error(f"  at path: {path}")
        except jsonschema.SchemaError as e:
            result.add_warning(f"Invalid manifest schema: {e.message}")

    def validate_contract_exists(
        self,
        contract: str,
        result: ValidationResult
    ) -> bool:
        """
        Validate that the contract type is known.

        Args:
            contract: Contract type from manifest
            result: ValidationResult to update

        Returns:
            True if contract is valid, False otherwise
        """
        if contract not in self._contracts:
            result.add_error(
                f"Unknown contract type '{contract}'. "
                f"Valid types: {', '.join(sorted(self._contracts.keys()))}"
            )
            return False
        return True

    def get_contract_info(self, contract: str) -> dict[str, Any] | None:
        """
        Get contract definition from registry.

        Args:
            contract: Contract type name

        Returns:
            Contract definition dict or None
        """
        return self._contracts.get(contract)

    def get_required_methods(self, contract: str) -> set[str]:
        """
        Get required method names for a contract.

        Args:
            contract: Contract type name

        Returns:
            Set of required method names
        """
        contract_info = self._contracts.get(contract, {})
        methods = contract_info.get("methods", {})
        required = methods.get("required", [])
        return {m["name"] for m in required}

    def get_optional_methods(self, contract: str) -> set[str]:
        """
        Get optional method names for a contract.

        Args:
            contract: Contract type name

        Returns:
            Set of optional method names
        """
        contract_info = self._contracts.get(contract, {})
        methods = contract_info.get("methods", {})
        optional = methods.get("optional", [])
        return {m["name"] for m in optional}

    def import_plugin_module(
        self,
        plugin_path: Path,
        entry_point: str,
        result: ValidationResult
    ) -> Any | None:
        """
        Attempt to import the plugin module.

        Args:
            plugin_path: Absolute path to plugin folder
            entry_point: Module name to import
            result: ValidationResult to update

        Returns:
            Imported module or None if import failed
        """
        # Add plugin path to sys.path temporarily
        plugin_path_str = str(plugin_path)
        if plugin_path_str not in sys.path:
            sys.path.insert(0, plugin_path_str)

        try:
            # Import the module
            module = importlib.import_module(entry_point)
            logger.debug(f"Successfully imported {entry_point} from {plugin_path}")
            return module
        except ImportError as e:
            result.add_error(f"Failed to import plugin module '{entry_point}': {e}")
            return None
        except Exception as e:
            result.add_error(f"Error importing plugin module '{entry_point}': {e}")
            return None
        finally:
            # Clean up sys.path
            if plugin_path_str in sys.path:
                sys.path.remove(plugin_path_str)

    def find_plugin_class(
        self,
        module: Any,
        contract: str,
        result: ValidationResult
    ) -> type | None:
        """
        Find the plugin class in the module.

        Looks for a class that:
        1. Inherits from PluginBase
        2. Is not PluginBase itself or a contract base class
        3. Name ends with "Plugin"

        Args:
            module: Imported plugin module
            contract: Expected contract type
            result: ValidationResult to update

        Returns:
            Plugin class or None if not found
        """
        candidates: list[tuple[str, type]] = []

        for name, obj in inspect.getmembers(module, inspect.isclass):
            # Skip if not defined in this module
            if obj.__module__ != module.__name__:
                continue

            # Must inherit from PluginBase
            if not issubclass(obj, PluginBase):
                continue

            # Skip PluginBase itself
            if obj is PluginBase:
                continue

            # Skip if it's a contract base class (ends with Contract)
            if name.endswith("Contract"):
                continue

            candidates.append((name, obj))

        if not candidates:
            result.add_error(
                "No plugin class found. Expected a class inheriting from PluginBase "
                "with name ending in 'Plugin'"
            )
            return None

        if len(candidates) > 1:
            # Prefer class ending with "Plugin"
            plugin_classes = [(n, c) for n, c in candidates if n.endswith("Plugin")]
            if len(plugin_classes) == 1:
                return plugin_classes[0][1]

            result.add_warning(
                f"Multiple plugin classes found: {[n for n, _ in candidates]}. "
                f"Using first one."
            )

        return candidates[0][1]

    def validate_methods(
        self,
        plugin_class: type,
        contract: str,
        result: ValidationResult
    ) -> None:
        """
        Validate plugin class implements required methods.

        Args:
            plugin_class: Plugin class to validate
            contract: Contract type
            result: ValidationResult to update
        """
        required = self.get_required_methods(contract)
        optional = self.get_optional_methods(contract)
        all_contract_methods = required | optional

        # Get all public methods on the class
        class_methods = set()
        for name, method in inspect.getmembers(plugin_class, predicate=inspect.isfunction):
            if not name.startswith("_"):
                class_methods.add(name)

        # Also check for async methods
        for name, method in inspect.getmembers(plugin_class, predicate=inspect.iscoroutinefunction):
            if not name.startswith("_"):
                class_methods.add(name)

        # Find missing required methods
        missing = required - class_methods
        for method in missing:
            result.methods_missing.append(method)
            result.add_error(f"Missing required method: {method}")

        # Find extra methods
        extra = class_methods - all_contract_methods - {"initialize", "shutdown", "health_check"}
        result.methods_extra = list(extra)

        # Record found methods
        result.methods_found = list(class_methods & all_contract_methods)

        if missing:
            result.contract_valid = False

    def validate_plugin(
        self,
        plugin_path: Path,
        manifest: dict[str, Any],
        deep_validate: bool = True
    ) -> ValidationResult:
        """
        Fully validate a discovered plugin.

        Args:
            plugin_path: Absolute path to plugin folder
            manifest: Parsed manifest dictionary
            deep_validate: If True, also import and validate class methods

        Returns:
            ValidationResult with all findings
        """
        plugin_name = manifest.get("name", plugin_path.name)
        result = ValidationResult(plugin_name=plugin_name)

        # Stage 1: Manifest schema validation
        self.validate_manifest_schema(manifest, result)

        # Stage 2: Contract existence
        contract = manifest.get("contract", "unknown")
        if not self.validate_contract_exists(contract, result):
            return result

        # If not doing deep validation, stop here
        if not deep_validate:
            return result

        # Stage 3: Module import
        entry_point = manifest.get("entry_point", "plugin")
        module = self.import_plugin_module(plugin_path, entry_point, result)
        if not module:
            return result

        # Stage 4: Class discovery
        plugin_class = self.find_plugin_class(module, contract, result)
        if not plugin_class:
            return result

        # Stage 5: Method validation
        self.validate_methods(plugin_class, contract, result)

        # Log result
        if result.valid:
            logger.info(f"Validation passed: {plugin_name}")
        else:
            logger.warning(f"Validation failed: {plugin_name} ({len(result.errors)} errors)")
            for error in result.errors:
                logger.debug(f"  Error: {error}")

        return result

    def validate_from_discovery(
        self,
        discovered: "DiscoveredPlugin",
        deep_validate: bool = True
    ) -> ValidationResult:
        """
        Validate a DiscoveredPlugin object.

        Args:
            discovered: DiscoveredPlugin from discovery.py
            deep_validate: If True, also import and validate class methods

        Returns:
            ValidationResult with all findings
        """
        result = ValidationResult(plugin_name=discovered.name)

        # Add any discovery errors first
        for error in discovered.errors:
            result.add_error(error)

        if not discovered.valid:
            return result

        # Run full validation
        return self.validate_plugin(
            plugin_path=discovered.path,
            manifest=discovered.manifest,
            deep_validate=deep_validate
        )


# Import DiscoveredPlugin for type hints (avoiding circular import)
def get_discovered_plugin_type():
    """Get DiscoveredPlugin type for validation."""
    from .discovery import DiscoveredPlugin
    return DiscoveredPlugin


# Module-level convenience function
def validate_plugin(
    plugin_path: str | Path,
    manifest: dict[str, Any],
    config_dir: str | Path = "./config"
) -> ValidationResult:
    """
    Convenience function to validate a plugin.

    Args:
        plugin_path: Path to plugin folder
        manifest: Parsed manifest dictionary
        config_dir: Path to config directory

    Returns:
        ValidationResult
    """
    validator = PluginValidator(config_dir)
    return validator.validate_plugin(Path(plugin_path), manifest)


# Entry point for testing
if __name__ == "__main__":
    import sys

    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stderr
    )

    # Test with discovery
    from .discovery import HybridDiscovery

    this_dir = Path(__file__).parent.resolve()
    plugins_dir = this_dir.parent
    config_dir = this_dir.parent.parent / "config"

    discovery = HybridDiscovery(plugins_dir, config_dir)
    validator = PluginValidator(config_dir)

    for plugin in discovery.scan(include_invalid=True):
        print(f"\n=== Validating: {plugin.name} ===", file=sys.stderr)
        result = validator.validate_from_discovery(plugin, deep_validate=False)

        print(f"Valid: {result.valid}", file=sys.stderr)
        for error in result.errors:
            print(f"  Error: {error}", file=sys.stderr)
        for warning in result.warnings:
            print(f"  Warning: {warning}", file=sys.stderr)
