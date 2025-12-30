"""
D001 - contracts/base.py
========================
Base plugin contract defining the core interface all plugins must implement.

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

This is the foundational ABC that ALL plugin contracts extend.
No forward references - this file has zero dependencies.
"""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from enum import Enum
from typing import Any, Dict, List, Optional
import json


class PluginStatus(Enum):
    """
    Plugin lifecycle states.
    Used by health_check() to report current operational status.
    """
    UNLOADED = "unloaded"      # Not yet initialized
    INITIALIZING = "initializing"  # In process of starting up
    READY = "ready"            # Fully operational
    BUSY = "busy"              # Processing a request
    ERROR = "error"            # Recoverable error state
    SHUTTING_DOWN = "shutting_down"  # In process of stopping
    STOPPED = "stopped"        # Cleanly stopped


@dataclass
class PluginManifest:
    """
    Plugin metadata structure matching config/manifest_schema.json (D008).
    
    Attributes:
        name: Unique plugin identifier (must match folder name)
        version: Semantic version string (e.g., "1.0.0")
        contract: Contract type this plugin implements (e.g., "tts", "stt", "llm")
        entry_point: Python module path relative to plugin folder
        display_name: Human-readable name for UI display
        description: Brief description of plugin functionality
        author: Plugin author name or organization
        dependencies: List of pip package requirements
        config_schema: JSON Schema for plugin-specific configuration
    """
    name: str
    version: str
    contract: str
    entry_point: str
    display_name: str = ""
    description: str = ""
    author: str = ""
    dependencies: List[str] = field(default_factory=list)
    config_schema: Dict[str, Any] = field(default_factory=dict)
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize manifest to dictionary for JSON-RPC responses."""
        return {
            "name": self.name,
            "version": self.version,
            "contract": self.contract,
            "entry_point": self.entry_point,
            "display_name": self.display_name or self.name,
            "description": self.description,
            "author": self.author,
            "dependencies": self.dependencies,
            "config_schema": self.config_schema,
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "PluginManifest":
        """Deserialize manifest from dictionary (e.g., from manifest.json)."""
        return cls(
            name=data["name"],
            version=data["version"],
            contract=data["contract"],
            entry_point=data["entry_point"],
            display_name=data.get("display_name", ""),
            description=data.get("description", ""),
            author=data.get("author", ""),
            dependencies=data.get("dependencies", []),
            config_schema=data.get("config_schema", {}),
        )


@dataclass
class HealthStatus:
    """
    Health check response structure.
    
    Attributes:
        status: Current plugin status from PluginStatus enum
        message: Human-readable status message
        details: Optional dictionary with additional diagnostic info
        latency_ms: Optional response time measurement
        memory_mb: Optional memory usage in megabytes
    """
    status: PluginStatus
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    latency_ms: Optional[float] = None
    memory_mb: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Serialize health status for JSON-RPC responses."""
        result = {
            "status": self.status.value,
            "message": self.message,
            "details": self.details,
        }
        if self.latency_ms is not None:
            result["latency_ms"] = self.latency_ms
        if self.memory_mb is not None:
            result["memory_mb"] = self.memory_mb
        return result


class PluginBase(ABC):
    """
    Abstract base class for all plugins.
    
    All plugin contracts (TTS, STT, LLM, MCP, etc.) MUST extend this class.
    Provides the core lifecycle methods required by the Plugin Host.
    
    Lifecycle:
        1. __init__() - Plugin instantiated by loader
        2. initialize(config) - Called once to set up resources
        3. health_check() - Called periodically to verify status
        4. [contract-specific methods] - Called as needed
        5. shutdown() - Called once to release resources
    
    Example:
        class MyTTSPlugin(TTSContract):
            async def initialize(self, config):
                self._engine = load_tts_engine(config["model_path"])
                return True
            
            async def shutdown(self):
                self._engine.unload()
                return True
            
            def health_check(self):
                return HealthStatus(
                    status=PluginStatus.READY,
                    message="TTS engine operational"
                )
    """
    
    def __init__(self):
        """
        Initialize plugin instance.
        
        Note: Heavy initialization should be done in initialize(), not here.
        The constructor should only set up instance variables.
        """
        self._status: PluginStatus = PluginStatus.UNLOADED
        self._manifest: Optional[PluginManifest] = None
        self._config: Dict[str, Any] = {}
    
    @abstractmethod
    async def initialize(self, config: Dict[str, Any]) -> bool:
        """
        Initialize plugin with configuration.
        
        Called once after plugin is loaded. Should set up any resources
        needed for operation (models, connections, file handles, etc.).
        
        Args:
            config: Plugin-specific configuration dictionary.
                    Schema defined in manifest.config_schema.
        
        Returns:
            True if initialization successful, False otherwise.
        
        Raises:
            Exception: If initialization fails critically.
        """
        pass
    
    @abstractmethod
    async def shutdown(self) -> bool:
        """
        Shutdown plugin and release resources.
        
        Called once when plugin is being unloaded. Should cleanly
        release all resources acquired during initialize().
        
        Returns:
            True if shutdown successful, False otherwise.
        """
        pass
    
    @abstractmethod
    def health_check(self) -> HealthStatus:
        """
        Check plugin health status.
        
        Called periodically by Plugin Host to verify plugin is operational.
        Should be fast and non-blocking.
        
        Returns:
            HealthStatus with current plugin state and diagnostics.
        """
        pass
    
    def get_manifest(self) -> Optional[PluginManifest]:
        """
        Get plugin manifest.
        
        Returns:
            PluginManifest if set, None otherwise.
        """
        return self._manifest
    
    def set_manifest(self, manifest: PluginManifest) -> None:
        """
        Set plugin manifest (called by loader).
        
        Args:
            manifest: Parsed manifest from manifest.json
        """
        self._manifest = manifest
    
    @property
    def status(self) -> PluginStatus:
        """Get current plugin status."""
        return self._status
    
    @property
    def name(self) -> str:
        """Get plugin name from manifest."""
        return self._manifest.name if self._manifest else "unknown"
    
    @property
    def version(self) -> str:
        """Get plugin version from manifest."""
        return self._manifest.version if self._manifest else "0.0.0"
    
    @property
    def contract_type(self) -> str:
        """Get contract type from manifest."""
        return self._manifest.contract if self._manifest else "base"


# Type alias for plugin factory functions
PluginFactory = type  # Class type that can be instantiated
