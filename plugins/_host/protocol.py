"""
D026 - plugins/_host/protocol.py
================================
JSON-RPC 2.0 method routing implementation.

Implements the JSON-RPC 2.0 protocol for Plugin Host communication:
- Request parsing and validation
- Method routing to plugin methods
- Response formatting
- Error handling per JSON-RPC spec

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)

Dependencies:
    - D009: config/error_codes.yaml (error code definitions)
    - D024: manager.py (PluginManager)
    - D028: isolation.py (crash isolation)

Supported Methods:
    Plugin Management:
        - plugin/list      : List all discovered plugins
        - plugin/load      : Load a plugin by name
        - plugin/unload    : Unload a plugin
        - plugin/swap      : Hot-swap one plugin for another
        - plugin/health    : Health check a plugin
    
    Plugin Execution:
        - <contract>/<method>  : Route to plugin method
        - tts/synthesize       : Example TTS method
        - llm/complete         : Example LLM method
    
    System:
        - ping             : Health check (returns "pong")
        - shutdown         : Initiate graceful shutdown
        - status           : Get host status
"""

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, Callable, Coroutine, Dict, List, Optional, Tuple, Union

logger = logging.getLogger(__name__)


# ============================================
# JSON-RPC 2.0 DATA STRUCTURES
# ============================================

@dataclass
class JsonRpcRequest:
    """
    JSON-RPC 2.0 Request object.
    
    Attributes:
        jsonrpc: Protocol version (always "2.0")
        id: Request identifier (can be str, int, or None for notifications)
        method: Method name to invoke
        params: Method parameters (dict or list)
        raw: Original raw JSON dict for reference
    """
    jsonrpc: str
    id: Optional[Union[str, int]]
    method: str
    params: Union[Dict[str, Any], List[Any], None] = None
    raw: Dict[str, Any] = field(default_factory=dict, repr=False)
    
    @property
    def is_notification(self) -> bool:
        """Check if this is a notification (no id)."""
        return self.id is None
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "JsonRpcRequest":
        """
        Create a JsonRpcRequest from a parsed dictionary.
        
        Args:
            data: Parsed JSON dictionary
            
        Returns:
            JsonRpcRequest instance
            
        Raises:
            ValueError: If required fields are missing
        """
        # Validate required fields
        if "jsonrpc" not in data:
            raise ValueError("Missing 'jsonrpc' field")
        if data.get("jsonrpc") != "2.0":
            raise ValueError(f"Invalid jsonrpc version: {data.get('jsonrpc')}")
        if "method" not in data:
            raise ValueError("Missing 'method' field")
        if not isinstance(data["method"], str):
            raise ValueError("'method' must be a string")
        
        return cls(
            jsonrpc=data["jsonrpc"],
            id=data.get("id"),
            method=data["method"],
            params=data.get("params"),
            raw=data,
        )
    
    def get_param(self, key: str, default: Any = None) -> Any:
        """Get a parameter by key (for dict params)."""
        if isinstance(self.params, dict):
            return self.params.get(key, default)
        return default


@dataclass
class JsonRpcError:
    """
    JSON-RPC 2.0 Error object.
    
    Attributes:
        code: Error code (int)
        message: Error message (str)
        data: Additional error data (optional)
    """
    code: int
    message: str
    data: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        result = {
            "code": self.code,
            "message": self.message,
        }
        if self.data is not None:
            result["data"] = self.data
        return result


@dataclass
class JsonRpcResponse:
    """
    JSON-RPC 2.0 Response object.
    
    Either result OR error must be set, not both.
    
    Attributes:
        jsonrpc: Protocol version (always "2.0")
        id: Request identifier (matches request id)
        result: Success result (mutually exclusive with error)
        error: Error object (mutually exclusive with result)
    """
    jsonrpc: str = "2.0"
    id: Optional[Union[str, int]] = None
    result: Any = None
    error: Optional[JsonRpcError] = None
    
    @property
    def is_success(self) -> bool:
        """Check if this is a success response."""
        return self.error is None
    
    def to_dict(self) -> Dict[str, Any]:
        """Convert to JSON-serializable dict."""
        response = {
            "jsonrpc": self.jsonrpc,
            "id": self.id,
        }
        
        if self.error is not None:
            response["error"] = self.error.to_dict()
        else:
            response["result"] = self.result
        
        return response
    
    def to_json(self) -> str:
        """Convert to JSON string."""
        return json.dumps(self.to_dict(), ensure_ascii=False)
    
    @classmethod
    def success(cls, id: Optional[Union[str, int]], result: Any) -> "JsonRpcResponse":
        """Create a success response."""
        return cls(id=id, result=result)
    
    @classmethod
    def error_response(
        cls,
        id: Optional[Union[str, int]],
        code: int,
        message: str,
        data: Optional[Dict[str, Any]] = None
    ) -> "JsonRpcResponse":
        """Create an error response."""
        return cls(id=id, error=JsonRpcError(code=code, message=message, data=data))


# ============================================
# ERROR CODES (from D009)
# ============================================

class ErrorCodes:
    """JSON-RPC 2.0 error codes."""
    # Standard JSON-RPC errors
    PARSE_ERROR = -32700
    INVALID_REQUEST = -32600
    METHOD_NOT_FOUND = -32601
    INVALID_PARAMS = -32602
    INTERNAL_ERROR = -32603
    
    # Server errors (implementation-defined)
    PLUGIN_NOT_FOUND = -32000
    PLUGIN_NOT_READY = -32001
    PLUGIN_LOAD_FAILED = -32002
    PLUGIN_INITIALIZE_FAILED = -32003
    PLUGIN_SHUTDOWN_FAILED = -32004
    PLUGIN_ALREADY_LOADED = -32005
    CONTRACT_MISMATCH = -32010
    CONTRACT_NOT_FOUND = -32011
    MANIFEST_INVALID = -32012
    MANIFEST_MISSING = -32013
    HOTSWAP_FAILED = -32020
    HOTSWAP_ROLLBACK_FAILED = -32021
    DISCOVERY_FAILED = -32030
    HEALTH_CHECK_TIMEOUT = -32040
    RESOURCE_EXHAUSTED = -32050
    DEPENDENCY_MISSING = -32051
    MODEL_NOT_FOUND = -32052


# ============================================
# METHOD HANDLER TYPES
# ============================================

# Handler signature: (params, request_id) -> result
MethodHandler = Callable[
    [Optional[Dict[str, Any]], Optional[Union[str, int]]],
    Coroutine[Any, Any, Any]
]


@dataclass
class MethodRegistration:
    """Registration information for a method handler."""
    handler: MethodHandler
    description: str = ""
    requires_plugin: bool = False
    contract: Optional[str] = None
    timeout_seconds: Optional[float] = None


# ============================================
# JSON-RPC ROUTER
# ============================================

class JsonRpcRouter:
    """
    Routes JSON-RPC requests to method handlers.
    
    Features:
        - Static method registration
        - Dynamic plugin method routing
        - Request validation
        - Error handling
        - Timeout enforcement
    
    Usage:
        router = JsonRpcRouter(manager=plugin_manager)
        
        # Register static method
        @router.method("ping")
        async def handle_ping(params, id):
            return "pong"
        
        # Process request
        response = await router.handle_request(request)
    """
    
    # Separator between contract and method
    METHOD_SEPARATOR = "/"
    
    def __init__(
        self,
        manager: Optional["PluginManager"] = None,
        executor: Optional["IsolatedExecutor"] = None,
        default_timeout: float = 30.0
    ):
        """
        Initialize router.
        
        Args:
            manager: PluginManager for plugin method routing
            executor: IsolatedExecutor for crash isolation
            default_timeout: Default timeout for method calls
        """
        self.manager = manager
        self.executor = executor
        self.default_timeout = default_timeout
        
        # Registered methods
        self._methods: Dict[str, MethodRegistration] = {}
        
        # Statistics
        self._request_count = 0
        self._error_count = 0
        self._last_request_time: Optional[datetime] = None
        
        # Register built-in methods
        self._register_builtin_methods()
        
        logger.debug("JsonRpcRouter initialized")
    
    def _register_builtin_methods(self) -> None:
        """Register built-in system methods."""
        
        # ping - basic health check
        async def handle_ping(params, id):
            return "pong"
        
        self._methods["ping"] = MethodRegistration(
            handler=handle_ping,
            description="Basic health check"
        )
        
        # status - get host status
        async def handle_status(params, id):
            return {
                "version": "1.0.0",
                "request_count": self._request_count,
                "error_count": self._error_count,
                "last_request": (
                    self._last_request_time.isoformat()
                    if self._last_request_time else None
                ),
                "registered_methods": list(self._methods.keys()),
            }
        
        self._methods["status"] = MethodRegistration(
            handler=handle_status,
            description="Get host status"
        )
        
        # plugin/list - list plugins
        async def handle_plugin_list(params, id):
            if not self.manager:
                return []
            return self.manager.list_available()
        
        self._methods["plugin/list"] = MethodRegistration(
            handler=handle_plugin_list,
            description="List all discovered plugins"
        )
        
        # plugin/load - load a plugin
        async def handle_plugin_load(params, id):
            if not self.manager:
                raise RuntimeError("Plugin manager not available")
            
            name = params.get("name") if params else None
            if not name:
                raise ValueError("Missing 'name' parameter")
            
            config = params.get("config", {}) if params else {}
            loaded = await self.manager.load_plugin(name, config=config)
            
            if loaded:
                return loaded.to_dict()
            else:
                raise RuntimeError(f"Failed to load plugin: {name}")
        
        self._methods["plugin/load"] = MethodRegistration(
            handler=handle_plugin_load,
            description="Load a plugin by name"
        )
        
        # plugin/unload - unload a plugin
        async def handle_plugin_unload(params, id):
            if not self.manager:
                raise RuntimeError("Plugin manager not available")
            
            name = params.get("name") if params else None
            if not name:
                raise ValueError("Missing 'name' parameter")
            
            success = await self.manager.unload_plugin(name)
            return {"success": success, "plugin": name}
        
        self._methods["plugin/unload"] = MethodRegistration(
            handler=handle_plugin_unload,
            description="Unload a plugin"
        )
        
        # plugin/swap - hot-swap plugins
        async def handle_plugin_swap(params, id):
            if not self.manager:
                raise RuntimeError("Plugin manager not available")
            
            old_name = params.get("old") if params else None
            new_name = params.get("new") if params else None
            
            if not old_name or not new_name:
                raise ValueError("Missing 'old' or 'new' parameter")
            
            config = params.get("config", {}) if params else {}
            result = await self.manager.hot_swap(old_name, new_name, new_config=config)
            
            return result.to_dict()
        
        self._methods["plugin/swap"] = MethodRegistration(
            handler=handle_plugin_swap,
            description="Hot-swap one plugin for another"
        )
        
        # plugin/health - health check a plugin
        async def handle_plugin_health(params, id):
            if not self.manager:
                raise RuntimeError("Plugin manager not available")
            
            name = params.get("name") if params else None
            
            if name:
                health = self.manager.health_check(name)
                if health is None:
                    raise RuntimeError(f"Plugin not found: {name}")
                return {
                    "plugin": name,
                    "status": health.status.value,
                    "message": health.message,
                    "details": health.details,
                }
            else:
                # Health check all
                results = self.manager.health_check_all()
                return {
                    name: {
                        "status": h.status.value,
                        "message": h.message,
                    }
                    for name, h in results.items()
                }
        
        self._methods["plugin/health"] = MethodRegistration(
            handler=handle_plugin_health,
            description="Health check plugins"
        )

    def method(
        self,
        name: str,
        description: str = "",
        timeout: Optional[float] = None
    ):
        """
        Decorator to register a method handler.
        
        Args:
            name: Method name
            description: Method description
            timeout: Timeout in seconds
            
        Usage:
            @router.method("my/method")
            async def handle_my_method(params, id):
                return {"result": "success"}
        """
        def decorator(handler: MethodHandler) -> MethodHandler:
            self._methods[name] = MethodRegistration(
                handler=handler,
                description=description,
                timeout_seconds=timeout
            )
            return handler
        return decorator
    
    def register_method(
        self,
        name: str,
        handler: MethodHandler,
        description: str = "",
        requires_plugin: bool = False,
        contract: Optional[str] = None,
        timeout: Optional[float] = None
    ) -> None:
        """
        Register a method handler.
        
        Args:
            name: Method name
            handler: Async handler function
            description: Method description
            requires_plugin: Whether method requires plugin to be loaded
            contract: Contract type for plugin method routing
            timeout: Timeout in seconds
        """
        self._methods[name] = MethodRegistration(
            handler=handler,
            description=description,
            requires_plugin=requires_plugin,
            contract=contract,
            timeout_seconds=timeout
        )
        logger.debug(f"Registered method: {name}")
    
    def parse_request(self, line: str) -> Tuple[Optional[JsonRpcRequest], Optional[JsonRpcResponse]]:
        """
        Parse a JSON-RPC request from a line.
        
        Args:
            line: Raw JSON string
            
        Returns:
            Tuple of (request, error_response)
            If parsing succeeds: (request, None)
            If parsing fails: (None, error_response)
        """
        # Parse JSON
        try:
            data = json.loads(line)
        except json.JSONDecodeError as e:
            return None, JsonRpcResponse.error_response(
                id=None,
                code=ErrorCodes.PARSE_ERROR,
                message=f"Parse error: {e}"
            )
        
        # Validate request object
        try:
            request = JsonRpcRequest.from_dict(data)
        except ValueError as e:
            request_id = data.get("id") if isinstance(data, dict) else None
            return None, JsonRpcResponse.error_response(
                id=request_id,
                code=ErrorCodes.INVALID_REQUEST,
                message=str(e)
            )
        
        return request, None
    
    def _get_plugin_method(
        self,
        method: str
    ) -> Tuple[Optional[str], Optional[str], Optional[str]]:
        """
        Parse a plugin method name.
        
        Args:
            method: Method name (e.g., "tts/synthesize")
            
        Returns:
            Tuple of (contract, method_name, plugin_name)
            Returns (None, None, None) if not a plugin method
        """
        if self.METHOD_SEPARATOR not in method:
            return None, None, None
        
        parts = method.split(self.METHOD_SEPARATOR)
        if len(parts) != 2:
            return None, None, None
        
        contract, method_name = parts
        
        # Check if this is a plugin management method
        if contract == "plugin":
            return None, None, None
        
        return contract, method_name, None
    
    async def _invoke_plugin_method(
        self,
        contract: str,
        method_name: str,
        params: Optional[Dict[str, Any]],
        request_id: Optional[Union[str, int]]
    ) -> Any:
        """
        Invoke a method on a loaded plugin.
        
        Args:
            contract: Contract type
            method_name: Method name on the plugin
            params: Method parameters
            request_id: Request ID for crash reports
            
        Returns:
            Method result
            
        Raises:
            RuntimeError: If plugin not found or method fails
        """
        if not self.manager:
            raise RuntimeError("Plugin manager not available")
        
        # Find loaded plugin for this contract
        loaded = None
        for name, plugin in self.manager.loaded_plugins.items():
            if plugin.manifest.contract == contract:
                loaded = plugin
                break
        
        if not loaded:
            raise RuntimeError(f"No plugin loaded for contract: {contract}")
        
        if not loaded.initialized:
            raise RuntimeError(f"Plugin not initialized: {loaded.name}")
        
        # Get method from plugin instance
        method = getattr(loaded.instance, method_name, None)
        if method is None:
            raise RuntimeError(f"Method not found: {method_name}")
        
        if not callable(method):
            raise RuntimeError(f"Method not callable: {method_name}")
        
        # Invoke with isolation if executor available
        if self.executor:
            from .isolation import ExecutionResult
            
            result: ExecutionResult = await self.executor.execute(
                plugin_name=loaded.name,
                method=method_name,
                callable=lambda: method(**(params or {})),
                call_id=request_id
            )
            
            if result.success:
                return result.result
            else:
                raise RuntimeError(result.error_message)
        else:
            # Direct call without isolation
            return await method(**(params or {}))
    
    async def handle_request(
        self,
        request: JsonRpcRequest
    ) -> Optional[JsonRpcResponse]:
        """
        Handle a JSON-RPC request and return response.
        
        Args:
            request: Parsed JsonRpcRequest
            
        Returns:
            JsonRpcResponse, or None for notifications
        """
        self._request_count += 1
        self._last_request_time = datetime.now()
        
        method = request.method
        params = request.params if isinstance(request.params, dict) else {}
        
        logger.debug(f"Handling request: method={method}, id={request.id}")
        
        try:
            # Check for static method first
            if method in self._methods:
                registration = self._methods[method]
                timeout = registration.timeout_seconds or self.default_timeout
                
                result = await asyncio.wait_for(
                    registration.handler(params, request.id),
                    timeout=timeout
                )
                
                # Don't return response for notifications
                if request.is_notification:
                    return None
                
                return JsonRpcResponse.success(request.id, result)
            
            # Check for plugin method
            contract, method_name, _ = self._get_plugin_method(method)
            
            if contract and method_name:
                result = await self._invoke_plugin_method(
                    contract, method_name, params, request.id
                )
                
                if request.is_notification:
                    return None
                
                return JsonRpcResponse.success(request.id, result)
            
            # Method not found
            self._error_count += 1
            return JsonRpcResponse.error_response(
                id=request.id,
                code=ErrorCodes.METHOD_NOT_FOUND,
                message=f"Method not found: {method}"
            )
            
        except asyncio.TimeoutError:
            self._error_count += 1
            logger.error(f"Method timed out: {method}")
            return JsonRpcResponse.error_response(
                id=request.id,
                code=ErrorCodes.INTERNAL_ERROR,
                message=f"Method timed out: {method}"
            )
            
        except ValueError as e:
            self._error_count += 1
            return JsonRpcResponse.error_response(
                id=request.id,
                code=ErrorCodes.INVALID_PARAMS,
                message=str(e)
            )
            
        except RuntimeError as e:
            self._error_count += 1
            error_msg = str(e)
            
            # Map specific errors to codes
            if "not found" in error_msg.lower():
                code = ErrorCodes.PLUGIN_NOT_FOUND
            elif "not initialized" in error_msg.lower():
                code = ErrorCodes.PLUGIN_NOT_READY
            else:
                code = ErrorCodes.INTERNAL_ERROR
            
            return JsonRpcResponse.error_response(
                id=request.id,
                code=code,
                message=error_msg
            )
            
        except Exception as e:
            self._error_count += 1
            logger.exception(f"Error handling request: {method}")
            return JsonRpcResponse.error_response(
                id=request.id,
                code=ErrorCodes.INTERNAL_ERROR,
                message=f"Internal error: {type(e).__name__}: {str(e)}"
            )
    
    async def process_line(self, line: str) -> Optional[str]:
        """
        Process a single line of input.
        
        Args:
            line: Raw input line
            
        Returns:
            JSON response string, or None for notifications
        """
        # Skip empty lines
        line = line.strip()
        if not line:
            return None
        
        # Parse request
        request, error = self.parse_request(line)
        
        if error:
            return error.to_json()
        
        if request:
            response = await self.handle_request(request)
            if response:
                return response.to_json()
        
        return None
    
    def get_methods(self) -> Dict[str, str]:
        """Get registered methods with descriptions."""
        return {
            name: reg.description
            for name, reg in self._methods.items()
        }
    
    def get_stats(self) -> Dict[str, Any]:
        """Get router statistics."""
        return {
            "request_count": self._request_count,
            "error_count": self._error_count,
            "method_count": len(self._methods),
            "last_request": (
                self._last_request_time.isoformat()
                if self._last_request_time else None
            ),
        }


# Type hints for lazy imports
PluginManager = Any  # From manager.py
IsolatedExecutor = Any  # From isolation.py
