"""
D023 - plugins/_host/loader.py
==============================
Dynamic plugin module loading using importlib.

Loads validated plugins, instantiates plugin classes, and manages
the import process including dependency handling.

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Dependencies:
    - D001: contracts/base.py (PluginBase, PluginManifest)
    - D020: discovery.py (DiscoveredPlugin)
    - D022: validator.py (ValidationResult)
"""

import importlib
import importlib.util
import inspect
import logging
import subprocess
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from contracts.base import PluginBase, PluginManifest, PluginStatus

logger = logging.getLogger(__name__)


@dataclass
class LoadedPlugin:
    """
    Represents a loaded and instantiated plugin.

    Attributes:
        name: Plugin name from manifest
        instance: Instantiated plugin object
        manifest: Parsed PluginManifest
        module: Imported Python module
        plugin_class: Plugin class type
        path: Path to plugin folder
        initialized: Whether initialize() has been called
        status: Current plugin status
        load_errors: Any errors during loading (may still be usable)
    """
    name: str
    instance: PluginBase
    manifest: PluginManifest
    module: Any
    plugin_class: type[PluginBase]
    path: Path
    initialized: bool = False
    status: PluginStatus = PluginStatus.UNLOADED
    load_errors: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSON-RPC responses."""
        return {
            "name": self.name,
            "version": self.manifest.version,
            "contract": self.manifest.contract,
            "path": str(self.path),
            "initialized": self.initialized,
            "status": self.status.value,
            "display_name": self.manifest.display_name or self.name,
            "description": self.manifest.description,
            "load_errors": self.load_errors,
        }


class PluginLoader:
    """
    Dynamically loads plugins using importlib.

    Loading process:
        1. Validate plugin is discoverable
        2. Install any missing dependencies (optional)
        3. Add plugin path to sys.path
        4. Import the entry point module
        5. Find and instantiate the plugin class
        6. Set manifest on plugin instance
        7. Return LoadedPlugin wrapper

    Usage:
        loader = PluginLoader()
        loaded = loader.load(discovered_plugin)
        if loaded:
            await loaded.instance.initialize(config)
    """

    def __init__(
        self,
        auto_install_deps: bool = False,
        pip_executable: str = "pip"
    ):
        """
        Initialize plugin loader.

        Args:
            auto_install_deps: If True, auto-install missing dependencies
            pip_executable: Path to pip executable for dependency installation
        """
        self.auto_install_deps = auto_install_deps
        self.pip_executable = pip_executable

        # Track modules we've loaded to enable hot-reload
        self._loaded_modules: dict[str, Any] = {}

        logger.debug(f"PluginLoader initialized: auto_deps={auto_install_deps}")

    def check_dependencies(
        self,
        dependencies: list[str]
    ) -> tuple[list[str], list[str]]:
        """
        Check which dependencies are installed.

        Args:
            dependencies: List of pip requirement strings

        Returns:
            Tuple of (installed, missing) dependency lists
        """
        installed = []
        missing = []

        for dep in dependencies:
            # Parse package name from requirement string
            # e.g., "torch>=2.0.0" -> "torch"
            package_name = dep.split(">=")[0].split("<=")[0].split("==")[0].split("<")[0].split(">")[0].strip()
            package_name = package_name.split("[")[0]  # Handle extras like "package[extra]"

            try:
                importlib.import_module(package_name.replace("-", "_"))
                installed.append(dep)
            except ImportError:
                missing.append(dep)

        return installed, missing

    def install_dependencies(self, dependencies: list[str]) -> bool:
        """
        Install dependencies using pip.

        Args:
            dependencies: List of pip requirement strings

        Returns:
            True if installation successful
        """
        if not dependencies:
            return True

        try:
            cmd = [self.pip_executable, "install"] + dependencies
            logger.info(f"Installing dependencies: {' '.join(dependencies)}")

            result = subprocess.run(
                cmd,
                capture_output=True,
                text=True,
                timeout=300  # 5 minute timeout
            )

            if result.returncode != 0:
                logger.error(f"Pip install failed: {result.stderr}")
                return False

            logger.info("Dependencies installed successfully")
            return True

        except subprocess.TimeoutExpired:
            logger.error("Dependency installation timed out")
            return False
        except Exception as e:
            logger.error(f"Failed to install dependencies: {e}")
            return False

    def import_module(
        self,
        plugin_path: Path,
        entry_point: str,
        force_reload: bool = False
    ) -> Any | None:
        """
        Import a plugin module.

        Args:
            plugin_path: Absolute path to plugin folder
            entry_point: Module name to import (e.g., "plugin")
            force_reload: If True, reload even if already imported

        Returns:
            Imported module or None if failed
        """
        # Create a unique module name to avoid conflicts
        module_key = f"{plugin_path.name}.{entry_point}"

        # Check if already loaded
        if module_key in self._loaded_modules and not force_reload:
            logger.debug(f"Using cached module: {module_key}")
            return self._loaded_modules[module_key]

        # Prepare module path
        module_file = plugin_path / f"{entry_point}.py"
        if not module_file.exists():
            logger.error(f"Entry point not found: {module_file}")
            return None

        # Add plugin path to sys.path
        plugin_path_str = str(plugin_path)
        path_added = False
        if plugin_path_str not in sys.path:
            sys.path.insert(0, plugin_path_str)
            path_added = True

        # Also add parent directory for absolute imports
        parent_path_str = str(plugin_path.parent)
        parent_added = False
        if parent_path_str not in sys.path:
            sys.path.insert(0, parent_path_str)
            parent_added = True

        try:
            # Use importlib.util for more control
            spec = importlib.util.spec_from_file_location(
                module_key,
                str(module_file)
            )

            if spec is None or spec.loader is None:
                logger.error(f"Failed to create module spec for {module_file}")
                return None

            module = importlib.util.module_from_spec(spec)

            # Add to sys.modules before execution for proper imports
            sys.modules[module_key] = module

            # Execute the module
            spec.loader.exec_module(module)

            # Cache the module
            self._loaded_modules[module_key] = module

            logger.debug(f"Successfully imported module: {module_key}")
            return module

        except Exception as e:
            logger.error(f"Failed to import module {module_key}: {e}")
            # Clean up sys.modules on failure
            if module_key in sys.modules:
                del sys.modules[module_key]
            return None

        finally:
            # Clean up sys.path
            if path_added and plugin_path_str in sys.path:
                sys.path.remove(plugin_path_str)
            if parent_added and parent_path_str in sys.path:
                sys.path.remove(parent_path_str)

    def find_plugin_class(
        self,
        module: Any,
        contract: str
    ) -> type[PluginBase] | None:
        """
        Find the plugin class in an imported module.

        Args:
            module: Imported module to search
            contract: Expected contract type

        Returns:
            Plugin class or None if not found
        """
        # Look for classes that inherit from PluginBase
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

            # Skip contract base classes
            if name.endswith("Contract"):
                continue

            # Prefer classes ending with "Plugin"
            if name.endswith("Plugin"):
                logger.debug(f"Found plugin class: {name}")
                return obj

        # If no class ending with "Plugin", return first PluginBase subclass
        for name, obj in inspect.getmembers(module, inspect.isclass):
            if obj.__module__ != module.__name__:
                continue
            if issubclass(obj, PluginBase) and obj is not PluginBase and not name.endswith("Contract"):
                logger.debug(f"Found plugin class (fallback): {name}")
                return obj

        return None

    def load(
        self,
        discovered: "DiscoveredPlugin",
        force_reload: bool = False
    ) -> LoadedPlugin | None:
        """
        Load a discovered plugin.

        Args:
            discovered: DiscoveredPlugin from discovery system
            force_reload: If True, reload even if already loaded

        Returns:
            LoadedPlugin if successful, None otherwise
        """
        load_errors: list[str] = []

        # Validate discovery result
        if not discovered.valid:
            logger.error(f"Cannot load invalid plugin: {discovered.name}")
            return None

        # Check dependencies
        dependencies = discovered.manifest.get("dependencies", [])
        if dependencies:
            installed, missing = self.check_dependencies(dependencies)

            if missing:
                if self.auto_install_deps:
                    if not self.install_dependencies(missing):
                        load_errors.append(f"Failed to install dependencies: {missing}")
                else:
                    load_errors.append(
                        f"Missing dependencies: {missing}. "
                        f"Run: pip install {' '.join(missing)}"
                    )
                    # Continue anyway, might work with optional deps

        # Import module
        module = self.import_module(
            discovered.path,
            discovered.entry_point,
            force_reload=force_reload
        )

        if module is None:
            logger.error(f"Failed to import plugin module: {discovered.name}")
            return None

        # Find plugin class
        plugin_class = self.find_plugin_class(module, discovered.contract)

        if plugin_class is None:
            logger.error(f"No plugin class found in {discovered.name}")
            return None

        # Instantiate plugin
        try:
            instance = plugin_class()
            logger.debug(f"Instantiated plugin: {plugin_class.__name__}")
        except Exception as e:
            logger.error(f"Failed to instantiate plugin {discovered.name}: {e}")
            return None

        # Create manifest dataclass
        manifest = PluginManifest.from_dict(discovered.manifest)
        instance.set_manifest(manifest)

        # Create LoadedPlugin wrapper
        loaded = LoadedPlugin(
            name=discovered.name,
            instance=instance,
            manifest=manifest,
            module=module,
            plugin_class=plugin_class,
            path=discovered.path,
            status=PluginStatus.UNLOADED,
            load_errors=load_errors,
        )

        logger.info(f"Loaded plugin: {discovered.name} (v{manifest.version})")
        return loaded

    def unload(self, loaded: LoadedPlugin) -> bool:
        """
        Unload a loaded plugin.

        Args:
            loaded: LoadedPlugin to unload

        Returns:
            True if unloaded successfully
        """
        module_key = f"{loaded.path.name}.{loaded.manifest.entry_point if hasattr(loaded.manifest, 'entry_point') else 'plugin'}"

        # Remove from cache
        if module_key in self._loaded_modules:
            del self._loaded_modules[module_key]

        # Remove from sys.modules
        if module_key in sys.modules:
            del sys.modules[module_key]

        logger.info(f"Unloaded plugin: {loaded.name}")
        return True

    def reload(
        self,
        discovered: "DiscoveredPlugin"
    ) -> LoadedPlugin | None:
        """
        Reload a plugin (unload then load fresh).

        Args:
            discovered: DiscoveredPlugin to reload

        Returns:
            New LoadedPlugin if successful
        """
        return self.load(discovered, force_reload=True)


# Import DiscoveredPlugin for type hints
def get_discovered_plugin_type():
    """Get DiscoveredPlugin type."""
    from .discovery import DiscoveredPlugin
    return DiscoveredPlugin


class DiscoveredPlugin:
    """Type stub for DiscoveredPlugin from discovery.py."""
    name: str
    path: Path
    manifest: dict[str, Any]
    contract: str
    entry_point: str
    valid: bool
    errors: list[str]


# Async helper for initialization
async def initialize_plugin(
    loaded: LoadedPlugin,
    config: dict[str, Any]
) -> bool:
    """
    Initialize a loaded plugin with configuration.

    Args:
        loaded: LoadedPlugin to initialize
        config: Plugin configuration dictionary

    Returns:
        True if initialization successful
    """
    if loaded.initialized:
        logger.warning(f"Plugin {loaded.name} already initialized")
        return True

    loaded.status = PluginStatus.INITIALIZING

    try:
        success = await loaded.instance.initialize(config)

        if success:
            loaded.initialized = True
            loaded.status = PluginStatus.READY
            logger.info(f"Plugin {loaded.name} initialized successfully")
        else:
            loaded.status = PluginStatus.ERROR
            logger.error(f"Plugin {loaded.name} initialization returned False")

        return success

    except Exception as e:
        loaded.status = PluginStatus.ERROR
        loaded.load_errors.append(f"Initialization failed: {e}")
        logger.error(f"Plugin {loaded.name} initialization failed: {e}")
        return False


async def shutdown_plugin(loaded: LoadedPlugin) -> bool:
    """
    Shutdown a loaded plugin.

    Args:
        loaded: LoadedPlugin to shutdown

    Returns:
        True if shutdown successful
    """
    if not loaded.initialized:
        logger.warning(f"Plugin {loaded.name} not initialized, nothing to shutdown")
        return True

    loaded.status = PluginStatus.SHUTTING_DOWN

    try:
        success = await loaded.instance.shutdown()

        if success:
            loaded.initialized = False
            loaded.status = PluginStatus.STOPPED
            logger.info(f"Plugin {loaded.name} shutdown successfully")
        else:
            loaded.status = PluginStatus.ERROR
            logger.error(f"Plugin {loaded.name} shutdown returned False")

        return success

    except Exception as e:
        loaded.status = PluginStatus.ERROR
        loaded.load_errors.append(f"Shutdown failed: {e}")
        logger.error(f"Plugin {loaded.name} shutdown failed: {e}")
        return False


# Entry point for testing
if __name__ == "__main__":
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stderr
    )

    from .discovery import HybridDiscovery

    this_dir = Path(__file__).parent.resolve()
    plugins_dir = this_dir.parent
    config_dir = this_dir.parent.parent / "config"

    discovery = HybridDiscovery(plugins_dir, config_dir)
    loader = PluginLoader()

    for plugin in discovery.scan():
        print(f"\n=== Loading: {plugin.name} ===", file=sys.stderr)
        loaded = loader.load(plugin)

        if loaded:
            print(f"Loaded: {loaded.name} v{loaded.manifest.version}", file=sys.stderr)
            print(f"Status: {loaded.status.value}", file=sys.stderr)
        else:
            print(f"Failed to load {plugin.name}", file=sys.stderr)
