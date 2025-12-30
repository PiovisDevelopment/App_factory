"""
D024 - plugins/_host/manager.py
===============================
Plugin lifecycle manager with hot-swap support.

Manages plugin lifecycle: load, unload, hot-swap, and health-check.
Acts as the central coordinator between discovery, validation, and loading.

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Dependencies:
    - D001: contracts/base.py (PluginBase, PluginStatus, HealthStatus)
    - D020: discovery.py (HybridDiscovery, DiscoveredPlugin)
    - D022: validator.py (PluginValidator, ValidationResult)
    - D023: loader.py (PluginLoader, LoadedPlugin)
"""

import asyncio
import logging
import time
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any, Callable, Dict, List, Optional, Set

from contracts.base import HealthStatus, PluginBase, PluginStatus

from .discovery import DiscoveredPlugin, HybridDiscovery
from .loader import LoadedPlugin, PluginLoader, initialize_plugin, shutdown_plugin
from .validator import PluginValidator, ValidationResult

logger = logging.getLogger(__name__)


@dataclass
class HotSwapResult:
    """
    Result of a hot-swap operation.
    
    Attributes:
        success: Whether swap completed successfully
        old_plugin: Name of plugin that was replaced
        new_plugin: Name of plugin that is now active
        rollback_performed: Whether we had to rollback to old plugin
        errors: Any errors during the swap
        swap_duration_ms: Time taken for swap
    """
    success: bool
    old_plugin: str
    new_plugin: str
    rollback_performed: bool = False
    errors: List[str] = field(default_factory=list)
    swap_duration_ms: float = 0.0
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize for JSON-RPC responses."""
        return {
            "success": self.success,
            "old_plugin": self.old_plugin,
            "new_plugin": self.new_plugin,
            "rollback_performed": self.rollback_performed,
            "errors": self.errors,
            "swap_duration_ms": self.swap_duration_ms,
        }


class PluginManager:
    """
    Central plugin lifecycle manager.
    
    Responsibilities:
        - Discover available plugins
        - Load and unload plugins
        - Initialize and shutdown plugins
        - Hot-swap plugins with rollback support
        - Health monitoring
    
    Usage:
        manager = PluginManager(plugins_dir="./plugins", config_dir="./config")
        await manager.start()
        
        # Load a specific plugin
        loaded = await manager.load_plugin("tts_kokoro_plugin")
        
        # Hot-swap plugins
        result = await manager.hot_swap("tts_kokoro_plugin", "tts_piper_plugin")
        
        # Shutdown
        await manager.shutdown()
    """
    
    def __init__(
        self,
        plugins_dir: str | Path = "./plugins",
        config_dir: str | Path = "./config",
        auto_install_deps: bool = False
    ):
        """
        Initialize plugin manager.
        
        Args:
            plugins_dir: Path to plugins directory
            config_dir: Path to config directory
            auto_install_deps: Auto-install missing dependencies
        """
        self.plugins_dir = Path(plugins_dir).resolve()
        self.config_dir = Path(config_dir).resolve()
        
        # Initialize subsystems
        self.discovery = HybridDiscovery(plugins_dir, config_dir)
        self.validator = PluginValidator(config_dir)
        self.loader = PluginLoader(auto_install_deps=auto_install_deps)
        
        # Active plugins by name
        self._plugins: Dict[str, LoadedPlugin] = {}
        
        # Plugin configurations
        self._configs: Dict[str, Dict[str, Any]] = {}
        
        # Callbacks for plugin events
        self._on_load_callbacks: List[Callable[[LoadedPlugin], None]] = []
        self._on_unload_callbacks: List[Callable[[str], None]] = []
        self._on_swap_callbacks: List[Callable[[HotSwapResult], None]] = []
        
        # Manager state
        self._started = False
        self._shutting_down = False
        
        logger.debug(f"PluginManager initialized: plugins={self.plugins_dir}")
    
    @property
    def is_started(self) -> bool:
        """Check if manager has been started."""
        return self._started
    
    @property
    def loaded_plugins(self) -> Dict[str, LoadedPlugin]:
        """Get dictionary of loaded plugins."""
        return self._plugins.copy()
    
    @property
    def plugin_names(self) -> Set[str]:
        """Get set of loaded plugin names."""
        return set(self._plugins.keys())
    
    def on_load(self, callback: Callable[[LoadedPlugin], None]) -> None:
        """Register callback for plugin load events."""
        self._on_load_callbacks.append(callback)
    
    def on_unload(self, callback: Callable[[str], None]) -> None:
        """Register callback for plugin unload events."""
        self._on_unload_callbacks.append(callback)
    
    def on_swap(self, callback: Callable[[HotSwapResult], None]) -> None:
        """Register callback for hot-swap events."""
        self._on_swap_callbacks.append(callback)
    
    async def start(self) -> None:
        """
        Start the plugin manager.
        
        Performs initial discovery but does not auto-load plugins.
        """
        if self._started:
            logger.warning("PluginManager already started")
            return
        
        logger.info("Starting PluginManager...")
        
        # Perform initial discovery
        discovered = self.discovery.scan()
        logger.info(f"Discovered {len(discovered)} plugins")
        
        self._started = True
        logger.info("PluginManager started")
    
    async def shutdown(self) -> None:
        """
        Shutdown the plugin manager.
        
        Shuts down and unloads all plugins gracefully.
        """
        if not self._started:
            return
        
        if self._shutting_down:
            logger.warning("Shutdown already in progress")
            return
        
        self._shutting_down = True
        logger.info("Shutting down PluginManager...")
        
        # Shutdown all plugins
        plugin_names = list(self._plugins.keys())
        for name in plugin_names:
            try:
                await self.unload_plugin(name)
            except Exception as e:
                logger.error(f"Error unloading {name} during shutdown: {e}")
        
        self._started = False
        self._shutting_down = False
        logger.info("PluginManager shutdown complete")
    
    def discover_plugins(
        self,
        include_invalid: bool = False
    ) -> List[DiscoveredPlugin]:
        """
        Discover available plugins.
        
        Args:
            include_invalid: Include plugins that failed validation
            
        Returns:
            List of DiscoveredPlugin objects
        """
        return self.discovery.scan(include_invalid=include_invalid)
    
    def discover_by_contract(
        self,
        contract: str,
        include_invalid: bool = False
    ) -> List[DiscoveredPlugin]:
        """
        Discover plugins of a specific contract type.
        
        Args:
            contract: Contract type (e.g., "tts", "llm")
            include_invalid: Include invalid plugins
            
        Returns:
            List of matching plugins
        """
        return self.discovery.scan_by_contract(contract, include_invalid)
    
    def validate_plugin(
        self,
        plugin_name: str,
        deep_validate: bool = True
    ) -> ValidationResult:
        """
        Validate a plugin.
        
        Args:
            plugin_name: Name of plugin to validate
            deep_validate: If True, also validate class methods
            
        Returns:
            ValidationResult
        """
        discovered = self.discovery.find_plugin(plugin_name)
        if not discovered:
            result = ValidationResult(plugin_name=plugin_name)
            result.add_error(f"Plugin not found: {plugin_name}")
            return result
        
        return self.validator.validate_from_discovery(discovered, deep_validate)
    
    def get_plugin(self, name: str) -> Optional[LoadedPlugin]:
        """
        Get a loaded plugin by name.
        
        Args:
            name: Plugin name
            
        Returns:
            LoadedPlugin or None if not loaded
        """
        return self._plugins.get(name)
    
    def get_plugin_instance(self, name: str) -> Optional[PluginBase]:
        """
        Get a plugin instance by name.
        
        Args:
            name: Plugin name
            
        Returns:
            Plugin instance or None
        """
        loaded = self._plugins.get(name)
        return loaded.instance if loaded else None
    
    def is_loaded(self, name: str) -> bool:
        """Check if a plugin is loaded."""
        return name in self._plugins
    
    async def load_plugin(
        self,
        name: str,
        config: Optional[Dict[str, Any]] = None,
        auto_initialize: bool = True
    ) -> Optional[LoadedPlugin]:
        """
        Load a plugin by name.
        
        Args:
            name: Plugin name to load
            config: Optional configuration for initialization
            auto_initialize: If True, also call initialize()
            
        Returns:
            LoadedPlugin if successful, None otherwise
        """
        # Check if already loaded
        if name in self._plugins:
            logger.warning(f"Plugin {name} already loaded")
            return self._plugins[name]
        
        # Discover plugin
        discovered = self.discovery.find_plugin(name)
        if not discovered:
            logger.error(f"Plugin not found: {name}")
            return None
        
        # Validate
        validation = self.validator.validate_from_discovery(discovered, deep_validate=False)
        if not validation.valid:
            logger.error(f"Plugin validation failed: {name}")
            for error in validation.errors:
                logger.error(f"  {error}")
            return None
        
        # Load
        loaded = self.loader.load(discovered)
        if not loaded:
            logger.error(f"Failed to load plugin: {name}")
            return None
        
        # Store configuration
        if config:
            self._configs[name] = config
        
        # Initialize if requested
        if auto_initialize:
            plugin_config = self._configs.get(name, {})
            
            # Merge with default config from manifest
            default_config = discovered.manifest.get("default_config", {})
            merged_config = {**default_config, **plugin_config}
            
            success = await initialize_plugin(loaded, merged_config)
            if not success:
                logger.error(f"Failed to initialize plugin: {name}")
                # Unload on init failure
                self.loader.unload(loaded)
                return None
        
        # Add to active plugins
        self._plugins[name] = loaded
        
        # Fire callbacks
        for callback in self._on_load_callbacks:
            try:
                callback(loaded)
            except Exception as e:
                logger.error(f"Error in load callback: {e}")
        
        logger.info(f"Plugin loaded: {name} (v{loaded.manifest.version})")
        return loaded
    
    async def unload_plugin(self, name: str) -> bool:
        """
        Unload a plugin.
        
        Args:
            name: Plugin name to unload
            
        Returns:
            True if unloaded successfully
        """
        loaded = self._plugins.get(name)
        if not loaded:
            logger.warning(f"Plugin not loaded: {name}")
            return False
        
        # Shutdown if initialized
        if loaded.initialized:
            await shutdown_plugin(loaded)
        
        # Unload module
        self.loader.unload(loaded)
        
        # Remove from active plugins
        del self._plugins[name]
        
        # Clear config
        if name in self._configs:
            del self._configs[name]
        
        # Fire callbacks
        for callback in self._on_unload_callbacks:
            try:
                callback(name)
            except Exception as e:
                logger.error(f"Error in unload callback: {e}")
        
        logger.info(f"Plugin unloaded: {name}")
        return True
    
    async def reload_plugin(
        self,
        name: str,
        config: Optional[Dict[str, Any]] = None
    ) -> Optional[LoadedPlugin]:
        """
        Reload a plugin (unload then load fresh).
        
        Args:
            name: Plugin name to reload
            config: New configuration (uses previous if not provided)
            
        Returns:
            New LoadedPlugin if successful
        """
        # Save old config if not providing new one
        if config is None:
            config = self._configs.get(name, {})
        
        # Unload
        await self.unload_plugin(name)
        
        # Load fresh
        return await self.load_plugin(name, config, auto_initialize=True)
    
    async def hot_swap(
        self,
        old_name: str,
        new_name: str,
        new_config: Optional[Dict[str, Any]] = None
    ) -> HotSwapResult:
        """
        Hot-swap one plugin for another with rollback support.
        
        Process:
            1. Load new plugin (don't initialize yet)
            2. Shutdown old plugin
            3. Initialize new plugin
            4. If init fails, rollback to old plugin
            5. Unload old plugin on success
        
        Args:
            old_name: Currently active plugin name
            new_name: New plugin to swap in
            new_config: Configuration for new plugin
            
        Returns:
            HotSwapResult with outcome
        """
        start_time = time.perf_counter()
        result = HotSwapResult(
            success=False,
            old_plugin=old_name,
            new_plugin=new_name
        )
        
        # Validate old plugin exists and is loaded
        old_loaded = self._plugins.get(old_name)
        if not old_loaded:
            result.errors.append(f"Old plugin not loaded: {old_name}")
            return result
        
        # Validate new plugin exists
        new_discovered = self.discovery.find_plugin(new_name)
        if not new_discovered:
            result.errors.append(f"New plugin not found: {new_name}")
            return result
        
        # Validate contract compatibility
        if old_loaded.manifest.contract != new_discovered.contract:
            result.errors.append(
                f"Contract mismatch: {old_loaded.manifest.contract} vs {new_discovered.contract}"
            )
            return result
        
        logger.info(f"Hot-swap: {old_name} -> {new_name}")
        
        # Step 1: Load new plugin without initialization
        new_loaded = self.loader.load(new_discovered)
        if not new_loaded:
            result.errors.append(f"Failed to load new plugin: {new_name}")
            return result
        
        # Step 2: Shutdown old plugin
        old_config = self._configs.get(old_name, {})
        
        try:
            await shutdown_plugin(old_loaded)
        except Exception as e:
            result.errors.append(f"Error shutting down old plugin: {e}")
            # Continue anyway, try to initialize new plugin
        
        # Step 3: Initialize new plugin
        config = new_config or self._configs.get(new_name, {})
        default_config = new_discovered.manifest.get("default_config", {})
        merged_config = {**default_config, **config}
        
        init_success = await initialize_plugin(new_loaded, merged_config)
        
        if not init_success:
            # Step 4: Rollback to old plugin
            logger.warning(f"New plugin init failed, rolling back to {old_name}")
            result.errors.append(f"New plugin initialization failed: {new_name}")
            result.rollback_performed = True
            
            # Unload failed new plugin
            self.loader.unload(new_loaded)
            
            # Re-initialize old plugin
            try:
                rollback_success = await initialize_plugin(old_loaded, old_config)
                if not rollback_success:
                    result.errors.append("CRITICAL: Rollback also failed!")
                else:
                    logger.info(f"Rollback successful: {old_name} restored")
            except Exception as e:
                result.errors.append(f"CRITICAL: Rollback exception: {e}")
            
            result.swap_duration_ms = (time.perf_counter() - start_time) * 1000
            return result
        
        # Step 5: Swap successful
        # Unload old plugin module
        self.loader.unload(old_loaded)
        
        # Update plugin registry
        del self._plugins[old_name]
        self._plugins[new_name] = new_loaded
        
        # Update config
        if old_name in self._configs:
            del self._configs[old_name]
        self._configs[new_name] = config
        
        result.success = True
        result.swap_duration_ms = (time.perf_counter() - start_time) * 1000
        
        # Fire callbacks
        for callback in self._on_swap_callbacks:
            try:
                callback(result)
            except Exception as e:
                logger.error(f"Error in swap callback: {e}")
        
        logger.info(
            f"Hot-swap complete: {old_name} -> {new_name} "
            f"({result.swap_duration_ms:.1f}ms)"
        )
        return result
    
    def health_check(self, name: str) -> Optional[HealthStatus]:
        """
        Perform health check on a plugin.
        
        Args:
            name: Plugin name
            
        Returns:
            HealthStatus or None if plugin not loaded
        """
        loaded = self._plugins.get(name)
        if not loaded:
            return None
        
        try:
            return loaded.instance.health_check()
        except Exception as e:
            logger.error(f"Health check failed for {name}: {e}")
            return HealthStatus(
                status=PluginStatus.ERROR,
                message=f"Health check exception: {e}"
            )
    
    def health_check_all(self) -> Dict[str, HealthStatus]:
        """
        Perform health check on all loaded plugins.
        
        Returns:
            Dict mapping plugin name to HealthStatus
        """
        results = {}
        for name in self._plugins:
            status = self.health_check(name)
            if status:
                results[name] = status
        return results
    
    def get_status_summary(self) -> Dict[str, Any]:
        """
        Get summary of all plugin statuses.
        
        Returns:
            Status summary dictionary
        """
        summary = {
            "total_loaded": len(self._plugins),
            "plugins": {},
            "by_contract": {},
            "by_status": {},
        }
        
        for name, loaded in self._plugins.items():
            contract = loaded.manifest.contract
            status = loaded.status.value
            
            summary["plugins"][name] = {
                "version": loaded.manifest.version,
                "contract": contract,
                "status": status,
                "initialized": loaded.initialized,
            }
            
            # Group by contract
            if contract not in summary["by_contract"]:
                summary["by_contract"][contract] = []
            summary["by_contract"][contract].append(name)
            
            # Group by status
            if status not in summary["by_status"]:
                summary["by_status"][status] = []
            summary["by_status"][status].append(name)
        
        return summary
    
    def list_plugins(self) -> List[Dict[str, Any]]:
        """
        List all loaded plugins.
        
        Returns:
            List of plugin info dicts
        """
        return [loaded.to_dict() for loaded in self._plugins.values()]
    
    def list_available(self) -> List[Dict[str, Any]]:
        """
        List all available (discovered) plugins.
        
        Returns:
            List of discovered plugin info dicts
        """
        discovered = self.discovery.scan(include_invalid=True)
        return [
            {
                "name": p.name,
                "version": p.version,
                "contract": p.contract,
                "path": str(p.path),
                "valid": p.valid,
                "loaded": p.name in self._plugins,
                "errors": p.errors,
            }
            for p in discovered
        ]


# Module-level singleton (optional)
_manager: Optional[PluginManager] = None


def get_manager() -> Optional[PluginManager]:
    """Get the global plugin manager instance."""
    return _manager


def set_manager(manager: PluginManager) -> None:
    """Set the global plugin manager instance."""
    global _manager
    _manager = manager


# Entry point for testing
if __name__ == "__main__":
    import sys
    
    logging.basicConfig(
        level=logging.DEBUG,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        stream=sys.stderr
    )
    
    async def test_manager():
        this_dir = Path(__file__).parent.resolve()
        plugins_dir = this_dir.parent
        config_dir = this_dir.parent.parent / "config"
        
        manager = PluginManager(plugins_dir, config_dir)
        await manager.start()
        
        print("\n=== Available Plugins ===", file=sys.stderr)
        for plugin in manager.list_available():
            status = "✓" if plugin["valid"] else "✗"
            loaded = "[LOADED]" if plugin["loaded"] else ""
            print(f"{status} {plugin['name']} ({plugin['contract']}) {loaded}", file=sys.stderr)
        
        await manager.shutdown()
    
    asyncio.run(test_manager())
