"""
D055 - plugins/_host/scaffold.py
================================
Plugin scaffold generator for creating new plugins.

Generates complete plugin folder structures from templates based on
contract type and manifest configuration.

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Dependencies:
    - D001: contracts/base.py (PluginBase)
    - D005: config/contract_prefixes.yaml
    - D008: config/manifest_schema.json
    - D029: config/contracts_registry.yaml
"""

import json
import logging
import re
import shutil
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml

logger = logging.getLogger(__name__)


@dataclass
class PluginManifest:
    """
    Plugin manifest data for scaffold generation.

    Attributes:
        name: Plugin folder name (e.g., tts_kokoro_plugin)
        display_name: Human-readable name
        version: Semantic version string
        contract: Contract type (tts, stt, llm, etc.)
        entry_point: Python module name (default: plugin)
        description: Plugin description
        author: Plugin author
        license: SPDX license identifier
        dependencies: List of pip requirements
        python_requires: Python version constraint
        gpu_required: Whether GPU is required
        gpu_recommended: Whether GPU is recommended
        min_memory_mb: Minimum RAM in MB
        tags: Search/filter tags
        capabilities: Optional capabilities
        config_schema: JSON Schema for config
        default_config: Default configuration values
    """

    name: str
    display_name: str
    version: str = "1.0.0"
    contract: str = "debug"
    entry_point: str = "plugin"
    description: str = ""
    author: str = ""
    license: str = "MIT"
    dependencies: list[str] = field(default_factory=list)
    python_requires: str = ">=3.11"
    gpu_required: bool = False
    gpu_recommended: bool = False
    min_memory_mb: int = 512
    tags: list[str] = field(default_factory=list)
    capabilities: list[str] = field(default_factory=list)
    config_schema: dict[str, Any] = field(default_factory=dict)
    default_config: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        """Convert to manifest.json format."""
        return {
            "name": self.name,
            "version": self.version,
            "contract": self.contract,
            "entry_point": self.entry_point,
            "display_name": self.display_name,
            "description": self.description,
            "author": self.author,
            "license": self.license,
            "dependencies": self.dependencies,
            "python_requires": self.python_requires,
            "gpu_required": self.gpu_required,
            "gpu_recommended": self.gpu_recommended,
            "min_memory_mb": self.min_memory_mb,
            "tags": self.tags,
            "capabilities": self.capabilities,
            "config_schema": self.config_schema,
            "default_config": self.default_config,
        }

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "PluginManifest":
        """Create from dictionary."""
        return cls(
            name=data.get("name", ""),
            display_name=data.get("display_name", data.get("displayName", "")),
            version=data.get("version", "1.0.0"),
            contract=data.get("contract", "debug"),
            entry_point=data.get("entry_point", data.get("entryPoint", "plugin")),
            description=data.get("description", ""),
            author=data.get("author", ""),
            license=data.get("license", "MIT"),
            dependencies=data.get("dependencies", []),
            python_requires=data.get("python_requires", data.get("pythonRequires", ">=3.11")),
            gpu_required=data.get("gpu_required", data.get("gpuRequired", False)),
            gpu_recommended=data.get("gpu_recommended", data.get("gpuRecommended", False)),
            min_memory_mb=data.get("min_memory_mb", data.get("minMemoryMb", 512)),
            tags=data.get("tags", []),
            capabilities=data.get("capabilities", []),
            config_schema=data.get("config_schema", data.get("configSchema", {})),
            default_config=data.get("default_config", data.get("defaultConfig", {})),
        )


@dataclass
class ScaffoldResult:
    """
    Result of scaffold generation.

    Attributes:
        success: Whether generation succeeded
        plugin_path: Path to generated plugin folder
        files_created: List of created file paths
        errors: List of error messages
    """

    success: bool
    plugin_path: Path | None = None
    files_created: list[str] = field(default_factory=list)
    errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSON-RPC response."""
        return {
            "success": self.success,
            "plugin_path": str(self.plugin_path) if self.plugin_path else None,
            "files_created": self.files_created,
            "errors": self.errors,
        }


class PluginScaffold:
    """
    Plugin scaffold generator.

    Creates new plugin folder structures with all required files
    based on contract type and manifest configuration.

    Usage:
        scaffold = PluginScaffold(
            plugins_dir="./plugins",
            templates_dir="./plugins/_host/templates"
        )

        manifest = PluginManifest(
            name="tts_example_plugin",
            display_name="Example TTS",
            contract="tts",
            description="Example TTS plugin"
        )

        result = scaffold.generate(manifest)
        if result.success:
            print(f"Created: {result.plugin_path}")
    """

    def __init__(
        self,
        plugins_dir: str | Path = "./plugins",
        templates_dir: str | Path | None = None,
        config_dir: str | Path = "./config",
    ):
        """
        Initialize scaffold generator.

        Args:
            plugins_dir: Directory where plugins will be created
            templates_dir: Directory containing template files (optional)
            config_dir: Directory containing config files
        """
        self.plugins_dir = Path(plugins_dir).resolve()
        self.config_dir = Path(config_dir).resolve()

        if templates_dir:
            self.templates_dir = Path(templates_dir).resolve()
        else:
            self.templates_dir = Path(__file__).parent / "templates"

        # Load contract registry for method signatures
        self._contracts: dict[str, Any] = {}
        self._load_contracts()

        logger.debug(f"PluginScaffold initialized: plugins={self.plugins_dir}")

    def _load_contracts(self) -> None:
        """Load contract definitions from registry."""
        registry_path = self.config_dir / "contracts_registry.yaml"
        if registry_path.exists():
            with open(registry_path, encoding="utf-8") as f:
                data = yaml.safe_load(f)
                self._contracts = data.get("contracts", {})
                logger.debug(f"Loaded {len(self._contracts)} contract definitions")
        else:
            logger.warning(f"Contracts registry not found: {registry_path}")

    def validate_manifest(self, manifest: PluginManifest) -> list[str]:
        """
        Validate manifest before generation.

        Args:
            manifest: Manifest to validate

        Returns:
            List of validation errors (empty if valid)
        """
        errors = []

        # Validate name format
        if not manifest.name:
            errors.append("Plugin name is required")
        elif not re.match(r"^[a-z][a-z0-9_]*_plugin$", manifest.name):
            errors.append(
                "Plugin name must be lowercase with underscores, ending in _plugin"
            )

        # Validate contract
        if not manifest.contract:
            errors.append("Contract type is required")
        elif manifest.contract not in self._contracts:
            valid_contracts = ", ".join(sorted(self._contracts.keys()))
            errors.append(f"Unknown contract: {manifest.contract}. Valid: {valid_contracts}")

        # Validate name prefix matches contract
        if manifest.name and manifest.contract:
            expected_prefix = f"{manifest.contract}_"
            if not manifest.name.startswith(expected_prefix):
                errors.append(
                    f"Plugin name must start with '{expected_prefix}' for {manifest.contract} contract"
                )

        # Validate version format
        if not re.match(r"^\d+\.\d+\.\d+", manifest.version):
            errors.append("Version must be semantic (e.g., 1.0.0)")

        # Validate entry point
        if manifest.entry_point and not re.match(r"^[a-z_][a-z0-9_]*$", manifest.entry_point):
            errors.append("Entry point must be a valid Python module name")

        # Check if plugin already exists
        plugin_path = self.plugins_dir / manifest.name
        if plugin_path.exists():
            errors.append(f"Plugin folder already exists: {plugin_path}")

        return errors

    def generate(
        self,
        manifest: PluginManifest,
        overwrite: bool = False,
    ) -> ScaffoldResult:
        """
        Generate plugin scaffold.

        Args:
            manifest: Plugin manifest configuration
            overwrite: If True, overwrite existing plugin folder

        Returns:
            ScaffoldResult with outcome
        """
        result = ScaffoldResult(success=False)

        # Validate manifest
        if not overwrite:
            errors = self.validate_manifest(manifest)
            if errors:
                result.errors = errors
                return result

        plugin_path = self.plugins_dir / manifest.name
        result.plugin_path = plugin_path

        try:
            # Create plugin directory
            if overwrite and plugin_path.exists():
                shutil.rmtree(plugin_path)

            plugin_path.mkdir(parents=True, exist_ok=True)
            logger.info(f"Creating plugin scaffold: {plugin_path}")

            # Generate files
            files_to_create = self._get_files_for_contract(manifest)

            for file_info in files_to_create:
                file_path = plugin_path / file_info["path"]
                file_path.parent.mkdir(parents=True, exist_ok=True)

                content = file_info["content"]
                with open(file_path, "w", encoding="utf-8") as f:
                    f.write(content)

                result.files_created.append(str(file_info["path"]))
                logger.debug(f"Created: {file_path}")

            result.success = True
            logger.info(
                f"Scaffold complete: {manifest.name} ({len(result.files_created)} files)"
            )

        except Exception as e:
            result.errors.append(f"Generation failed: {e}")
            logger.error(f"Scaffold generation failed: {e}")

            # Cleanup on failure
            if plugin_path.exists():
                try:
                    shutil.rmtree(plugin_path)
                except Exception:
                    pass

        return result

    def _get_files_for_contract(
        self, manifest: PluginManifest
    ) -> list[dict[str, str]]:
        """
        Get list of files to create for a contract type.

        Args:
            manifest: Plugin manifest

        Returns:
            List of dicts with 'path' and 'content'
        """
        files = []

        # manifest.json
        files.append({
            "path": "manifest.json",
            "content": json.dumps(manifest.to_dict(), indent=2),
        })

        # __init__.py
        files.append({
            "path": "__init__.py",
            "content": self._generate_init(manifest),
        })

        # Main plugin file
        files.append({
            "path": f"{manifest.entry_point}.py",
            "content": self._generate_plugin_code(manifest),
        })

        # requirements.txt (if dependencies exist)
        if manifest.dependencies:
            files.append({
                "path": "requirements.txt",
                "content": "\n".join(manifest.dependencies) + "\n",
            })

        # README.md
        files.append({
            "path": "README.md",
            "content": self._generate_readme(manifest),
        })

        return files

    def _generate_init(self, manifest: PluginManifest) -> str:
        """Generate __init__.py content."""
        return f'''"""
{manifest.name}
{"=" * len(manifest.name)}
{manifest.description or "Plugin package."}
"""

from .{manifest.entry_point} import plugin

__all__ = ["plugin"]
__version__ = "{manifest.version}"
'''

    def _generate_plugin_code(self, manifest: PluginManifest) -> str:
        """Generate main plugin file."""
        # Get class name from display name
        class_name = "".join(
            word.capitalize()
            for word in re.split(r"[\s_-]+", manifest.display_name)
            if word
        ).replace("'", "")

        if not class_name:
            class_name = "Plugin"

        class_name = f"{class_name}Plugin"

        # Contract class name
        contract_class = f"{manifest.contract.capitalize()}Contract"

        # Get contract methods
        contract_info = self._contracts.get(manifest.contract, {})
        methods = contract_info.get("methods", {})
        required_methods = methods.get("required", [])

        # Generate method implementations
        method_impls = self._generate_method_implementations(
            manifest.contract, required_methods
        )

        return f'''"""
{manifest.name}
{"=" * len(manifest.name)}
{manifest.description or "Plugin implementation."}

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Contract: {manifest.contract.upper()}
Author: {manifest.author or "Unknown"}
License: {manifest.license}
"""

import logging
from typing import Any

from contracts.base import PluginBase, PluginStatus, HealthStatus
from contracts.{manifest.contract}_contract import {contract_class}


class {class_name}(PluginBase, {contract_class}):
    """
    {manifest.display_name} plugin implementation.

    Implements the {manifest.contract.upper()} contract.
    """

    def __init__(self):
        """Initialize plugin."""
        super().__init__()
        self.logger = logging.getLogger(__name__)
        self._config: dict = {{}}
        self._status = PluginStatus.CREATED

    def initialize(self, config: dict | None = None) -> bool:
        """
        Initialize plugin with configuration.

        Args:
            config: Plugin configuration dictionary

        Returns:
            True if initialization succeeded
        """
        self.logger.info(f"Initializing {manifest.display_name}...")

        self._config = config or {{}}

        # TODO: Add initialization logic here
        # - Load models
        # - Set up connections
        # - Validate configuration

        self._status = PluginStatus.READY
        self.logger.info("{manifest.display_name} initialized successfully")
        return True

    def shutdown(self) -> None:
        """
        Shutdown plugin and release resources.
        """
        self.logger.info("Shutting down {manifest.display_name}...")

        # TODO: Add cleanup logic here
        # - Release models
        # - Close connections
        # - Save state if needed

        self._status = PluginStatus.STOPPED
        self.logger.info("{manifest.display_name} shutdown complete")

    def health_check(self) -> HealthStatus:
        """
        Perform health check.

        Returns:
            HealthStatus with current status and message
        """
        return HealthStatus(
            status=self._status,
            message="Plugin is healthy" if self._status == PluginStatus.READY else "Plugin not ready",
        )
{method_impls}

# Plugin instance for registration
plugin = {class_name}()
'''

    def _generate_method_implementations(
        self, contract: str, methods: list[dict[str, Any]]
    ) -> str:
        """Generate method implementations for contract."""
        impls = []

        for method in methods:
            name = method.get("name", "")
            params = method.get("params", [])
            returns = method.get("returns", {})
            description = method.get("description", f"Implement {name}")

            # Build parameter signature
            param_strs = ["self"]
            for param in params:
                p_name = param.get("name", "arg")
                p_type = param.get("type", "Any")
                p_required = param.get("required", True)

                # Map types
                type_map = {
                    "str": "str",
                    "int": "int",
                    "float": "float",
                    "bool": "bool",
                    "dict": "dict",
                    "list": "list",
                    "any": "Any",
                }
                p_type = type_map.get(p_type.lower(), "Any")

                if p_required:
                    param_strs.append(f"{p_name}: {p_type}")
                else:
                    param_strs.append(f"{p_name}: {p_type} | None = None")

            params_sig = ", ".join(param_strs)

            # Return type
            ret_type = returns.get("type", "Any")
            type_map = {
                "str": "str",
                "int": "int",
                "float": "float",
                "bool": "bool",
                "dict": "dict",
                "list": "list",
                "any": "Any",
            }
            ret_type = type_map.get(ret_type.lower(), "Any")

            # Generate method body
            if ret_type == "dict":
                body = "        # TODO: Implement\n        return {}"
            elif ret_type == "list":
                body = "        # TODO: Implement\n        return []"
            elif ret_type == "str":
                body = '        # TODO: Implement\n        return ""'
            elif ret_type == "int":
                body = "        # TODO: Implement\n        return 0"
            elif ret_type == "float":
                body = "        # TODO: Implement\n        return 0.0"
            elif ret_type == "bool":
                body = "        # TODO: Implement\n        return False"
            else:
                body = "        # TODO: Implement\n        raise NotImplementedError()"

            impl = f'''
    def {name}({params_sig}) -> {ret_type}:
        """
        {description}
        """
{body}'''

            impls.append(impl)

        return "\n".join(impls)

    def _generate_readme(self, manifest: PluginManifest) -> str:
        """Generate README.md content."""
        deps_section = ""
        if manifest.dependencies:
            deps_list = "\n".join(f"- {dep}" for dep in manifest.dependencies)
            deps_section = f"""
## Dependencies

{deps_list}
"""

        return f"""# {manifest.display_name}

{manifest.description or "Plugin description."}

## Installation

1. Copy this folder to `plugins/`
2. Install dependencies: `pip install -r requirements.txt`
3. Restart the Plugin Host
{deps_section}
## Contract

This plugin implements the **{manifest.contract.upper()}** contract.

## Configuration

```json
{json.dumps(manifest.default_config or {}, indent=2)}
```

## Author

{manifest.author or "Unknown"}

## License

{manifest.license}
"""


# Module-level convenience functions


def create_plugin(
    manifest_data: dict[str, Any],
    plugins_dir: str | Path = "./plugins",
    config_dir: str | Path = "./config",
) -> ScaffoldResult:
    """
    Convenience function to create a plugin from manifest data.

    Args:
        manifest_data: Manifest as dictionary
        plugins_dir: Plugins directory
        config_dir: Config directory

    Returns:
        ScaffoldResult
    """
    manifest = PluginManifest.from_dict(manifest_data)
    scaffold = PluginScaffold(plugins_dir, config_dir=config_dir)
    return scaffold.generate(manifest)


# Entry point for testing
if __name__ == "__main__":
    import sys

    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stderr,
    )

    # Test scaffold generation
    this_dir = Path(__file__).parent.resolve()
    plugins_dir = this_dir.parent
    config_dir = this_dir.parent.parent / "config"

    scaffold = PluginScaffold(plugins_dir, config_dir=config_dir)

    test_manifest = PluginManifest(
        name="debug_test_plugin",
        display_name="Test Debug Plugin",
        version="1.0.0",
        contract="debug",
        description="A test plugin for scaffolding",
        author="Test Author",
    )

    # Validate
    errors = scaffold.validate_manifest(test_manifest)
    if errors:
        print("Validation errors:", file=sys.stderr)
        for error in errors:
            print(f"  - {error}", file=sys.stderr)
    else:
        print("Manifest valid", file=sys.stderr)

    # Don't actually create in test mode
    print("\n(Scaffold generation skipped in test mode)", file=sys.stderr)
