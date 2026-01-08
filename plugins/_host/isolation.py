"""
D028 - plugins/_host/isolation.py
=================================
Crash isolation for plugin execution.

Wraps all plugin method calls in try/except to prevent plugin exceptions
from crashing the Plugin Host. Exceptions are caught and returned as
JSON-RPC error responses without interrupting the host process.

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)

Dependencies:
    - D009: config/error_codes.yaml (error code definitions)
    - D024: manager.py (PluginManager)
    - D026: protocol.py (JSON-RPC protocol)

Key Responsibilities:
    1. Wrap all plugin calls in exception handlers
    2. Capture stack traces for debugging
    3. Convert exceptions to JSON-RPC error responses
    4. Mark crashed plugins as ERROR state without unloading
    5. Support configurable timeout for plugin calls
    6. Rate-limit crash logging to prevent log flooding
"""

import asyncio
import functools
import logging
import time
import traceback
from collections import defaultdict
from collections.abc import Callable, Coroutine
from dataclasses import dataclass, field
from datetime import datetime
from typing import Any, TypeVar

logger = logging.getLogger(__name__)


# Type variable for generic function wrapping
T = TypeVar('T')


# ============================================
# ERROR CODE MAPPING
# ============================================

# Error codes from D009 error_codes.yaml
class ErrorCode:
    """JSON-RPC error codes for crash isolation."""
    INTERNAL_ERROR = -32603
    PLUGIN_NOT_READY = -32001
    PLUGIN_INITIALIZE_FAILED = -32003
    RESOURCE_EXHAUSTED = -32050

    # Isolation-specific codes
    EXECUTION_TIMEOUT = -32060
    PLUGIN_EXCEPTION = -32061
    PLUGIN_CRASHED = -32062


@dataclass
class CrashReport:
    """
    Detailed crash report for a plugin exception.

    Captures all information needed for debugging without exposing
    sensitive details in user-facing error messages.

    Attributes:
        plugin_name: Name of the crashed plugin
        method: Method that was called when crash occurred
        exception_type: Type name of the exception
        exception_message: Exception message string
        traceback: Full stack trace as string
        timestamp: When the crash occurred
        call_id: JSON-RPC request ID (if available)
        params: Parameters passed to the method (sanitized)
        context: Additional context for debugging
        recovery_attempted: Whether recovery was attempted
        recovery_success: Whether recovery succeeded
    """
    plugin_name: str
    method: str
    exception_type: str
    exception_message: str
    traceback: str
    timestamp: datetime = field(default_factory=datetime.now)
    call_id: int | None = None
    params: dict[str, Any] | None = None
    context: dict[str, Any] = field(default_factory=dict)
    recovery_attempted: bool = False
    recovery_success: bool = False

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSON-RPC responses."""
        return {
            "plugin_name": self.plugin_name,
            "method": self.method,
            "exception_type": self.exception_type,
            "exception_message": self.exception_message,
            "timestamp": self.timestamp.isoformat(),
            "call_id": self.call_id,
            "recovery_attempted": self.recovery_attempted,
            "recovery_success": self.recovery_success,
            # Note: traceback and params intentionally excluded from serialization
            # to avoid exposing internal details
        }

    def to_error_data(self) -> dict[str, Any]:
        """
        Create error data for JSON-RPC error response.

        Includes only safe information for external consumption.
        """
        return {
            "plugin": self.plugin_name,
            "method": self.method,
            "exception": self.exception_type,
            "timestamp": self.timestamp.isoformat(),
        }

    def log_full_report(self, log: logging.Logger) -> None:
        """Log full crash report including traceback for debugging."""
        log.error("Plugin Crash Report")
        log.error(f"  Plugin: {self.plugin_name}")
        log.error(f"  Method: {self.method}")
        log.error(f"  Exception: {self.exception_type}: {self.exception_message}")
        log.error(f"  Timestamp: {self.timestamp.isoformat()}")
        if self.call_id:
            log.error(f"  Request ID: {self.call_id}")
        log.error(f"  Traceback:\n{self.traceback}")


@dataclass
class ExecutionResult:
    """
    Result of an isolated execution attempt.

    Attributes:
        success: Whether execution completed without exception
        result: Return value if successful
        error_code: JSON-RPC error code if failed
        error_message: Error message if failed
        error_data: Additional error data for JSON-RPC response
        crash_report: Full crash report if exception occurred
        execution_time_ms: How long execution took
    """
    success: bool
    result: Any = None
    error_code: int | None = None
    error_message: str | None = None
    error_data: dict[str, Any] | None = None
    crash_report: CrashReport | None = None
    execution_time_ms: float = 0.0

    def to_json_rpc_error(self) -> dict[str, Any]:
        """Convert to JSON-RPC error object."""
        error = {
            "code": self.error_code or ErrorCode.INTERNAL_ERROR,
            "message": self.error_message or "Unknown error",
        }
        if self.error_data:
            error["data"] = self.error_data
        return error


class CrashRateLimiter:
    """
    Rate limiter for crash logging and notifications.

    Prevents log flooding when a plugin crashes repeatedly.
    Uses a sliding window to track crash frequency.
    """

    def __init__(
        self,
        window_seconds: float = 60.0,
        max_reports: int = 5
    ):
        """
        Initialize rate limiter.

        Args:
            window_seconds: Time window for rate limiting
            max_reports: Maximum reports allowed in window
        """
        self.window_seconds = window_seconds
        self.max_reports = max_reports
        self._crash_times: dict[str, list[float]] = defaultdict(list)
        self._suppressed_counts: dict[str, int] = defaultdict(int)

    def should_report(self, plugin_name: str) -> bool:
        """
        Check if a crash should be reported for a plugin.

        Args:
            plugin_name: Name of the crashed plugin

        Returns:
            True if crash should be logged, False if rate-limited
        """
        now = time.time()
        cutoff = now - self.window_seconds

        # Clean old entries
        self._crash_times[plugin_name] = [
            t for t in self._crash_times[plugin_name]
            if t > cutoff
        ]

        # Check if under limit
        if len(self._crash_times[plugin_name]) < self.max_reports:
            self._crash_times[plugin_name].append(now)

            # Log suppressed count if resuming reporting
            if self._suppressed_counts[plugin_name] > 0:
                logger.warning(
                    f"Plugin {plugin_name}: {self._suppressed_counts[plugin_name]} "
                    f"crashes suppressed in last {self.window_seconds}s"
                )
                self._suppressed_counts[plugin_name] = 0

            return True
        else:
            self._suppressed_counts[plugin_name] += 1
            return False

    def get_crash_count(self, plugin_name: str) -> int:
        """Get number of crashes in current window for a plugin."""
        now = time.time()
        cutoff = now - self.window_seconds
        return len([
            t for t in self._crash_times[plugin_name]
            if t > cutoff
        ])


class IsolatedExecutor:
    """
    Executes plugin methods with crash isolation.

    All plugin method calls should go through this executor to ensure
    exceptions don't crash the Plugin Host.

    Features:
        - Exception catching and conversion to JSON-RPC errors
        - Timeout enforcement
        - Crash rate limiting
        - Plugin state management on crash
        - Stack trace capture for debugging

    Usage:
        executor = IsolatedExecutor()

        # Execute a plugin method
        result = await executor.execute(
            plugin_name="tts_kokoro_plugin",
            method="synthesize",
            callable=plugin.synthesize,
            args=["Hello world"],
            kwargs={"voice_id": "default"},
            timeout_seconds=30.0
        )

        if result.success:
            return result.result
        else:
            return result.to_json_rpc_error()
    """

    def __init__(
        self,
        default_timeout: float = 30.0,
        crash_rate_window: float = 60.0,
        crash_rate_limit: int = 5,
        max_crash_history: int = 100
    ):
        """
        Initialize isolated executor.

        Args:
            default_timeout: Default timeout for plugin calls (seconds)
            crash_rate_window: Time window for rate limiting (seconds)
            crash_rate_limit: Max crashes per window before limiting
            max_crash_history: Maximum crash reports to keep in history
        """
        self.default_timeout = default_timeout
        self.rate_limiter = CrashRateLimiter(
            window_seconds=crash_rate_window,
            max_reports=crash_rate_limit
        )

        # Crash history (ring buffer)
        self._crash_history: list[CrashReport] = []
        self._max_crash_history = max_crash_history

        # Plugin crash counts for health monitoring
        self._crash_counts: dict[str, int] = defaultdict(int)

        logger.debug(
            f"IsolatedExecutor initialized: timeout={default_timeout}s, "
            f"rate_limit={crash_rate_limit}/{crash_rate_window}s"
        )

    def _sanitize_params(self, params: dict[str, Any]) -> dict[str, Any]:
        """
        Sanitize parameters for logging/crash reports.

        Truncates large values and masks sensitive fields.
        """
        sanitized = {}
        sensitive_keys = {"password", "secret", "key", "token", "auth"}

        for key, value in params.items():
            # Mask sensitive values
            if any(s in key.lower() for s in sensitive_keys):
                sanitized[key] = "***MASKED***"
            # Truncate large strings
            elif isinstance(value, str) and len(value) > 200:
                sanitized[key] = f"{value[:200]}... (truncated, {len(value)} chars)"
            # Truncate large bytes
            elif isinstance(value, bytes) and len(value) > 100:
                sanitized[key] = f"<{len(value)} bytes>"
            # Truncate large lists
            elif isinstance(value, list) and len(value) > 10:
                sanitized[key] = f"<list with {len(value)} items>"
            else:
                sanitized[key] = value

        return sanitized

    def _create_crash_report(
        self,
        plugin_name: str,
        method: str,
        exception: Exception,
        call_id: int | None = None,
        params: dict[str, Any] | None = None
    ) -> CrashReport:
        """Create a crash report from an exception."""
        return CrashReport(
            plugin_name=plugin_name,
            method=method,
            exception_type=type(exception).__name__,
            exception_message=str(exception),
            traceback=traceback.format_exc(),
            call_id=call_id,
            params=self._sanitize_params(params) if params else None,
        )

    def _record_crash(self, report: CrashReport) -> None:
        """Record a crash in history."""
        # Add to history (ring buffer)
        self._crash_history.append(report)
        if len(self._crash_history) > self._max_crash_history:
            self._crash_history.pop(0)

        # Increment crash count
        self._crash_counts[report.plugin_name] += 1

        # Log if not rate-limited
        if self.rate_limiter.should_report(report.plugin_name):
            report.log_full_report(logger)
        else:
            logger.debug(
                f"Crash report suppressed for {report.plugin_name} (rate limited)"
            )

    def _exception_to_error_code(self, exception: Exception) -> int:
        """Map exception type to JSON-RPC error code."""
        exception_type = type(exception).__name__

        # Timeout exceptions
        if isinstance(exception, asyncio.TimeoutError):
            return ErrorCode.EXECUTION_TIMEOUT

        # Memory/resource exceptions
        if exception_type in ("MemoryError", "ResourceExhaustedError"):
            return ErrorCode.RESOURCE_EXHAUSTED

        # General plugin exception
        return ErrorCode.PLUGIN_EXCEPTION

    async def execute(
        self,
        plugin_name: str,
        method: str,
        callable: Callable[..., Coroutine[Any, Any, T]],
        args: tuple | None = None,
        kwargs: dict[str, Any] | None = None,
        timeout_seconds: float | None = None,
        call_id: int | None = None
    ) -> ExecutionResult:
        """
        Execute a plugin method with crash isolation.

        Args:
            plugin_name: Name of the plugin
            method: Method name being called
            callable: Async callable to execute
            args: Positional arguments
            kwargs: Keyword arguments
            timeout_seconds: Timeout (uses default if not specified)
            call_id: JSON-RPC request ID for crash reports

        Returns:
            ExecutionResult with success status and result/error
        """
        args = args or ()
        kwargs = kwargs or {}
        timeout = timeout_seconds or self.default_timeout

        start_time = time.perf_counter()

        try:
            # Execute with timeout
            result = await asyncio.wait_for(
                callable(*args, **kwargs),
                timeout=timeout
            )

            execution_time = (time.perf_counter() - start_time) * 1000

            return ExecutionResult(
                success=True,
                result=result,
                execution_time_ms=execution_time
            )

        except TimeoutError:
            execution_time = (time.perf_counter() - start_time) * 1000

            # Create timeout crash report
            report = CrashReport(
                plugin_name=plugin_name,
                method=method,
                exception_type="TimeoutError",
                exception_message=f"Execution timed out after {timeout}s",
                traceback="",
                call_id=call_id,
                params=self._sanitize_params(kwargs) if kwargs else None,
            )
            self._record_crash(report)

            return ExecutionResult(
                success=False,
                error_code=ErrorCode.EXECUTION_TIMEOUT,
                error_message=f"Plugin method timed out after {timeout}s",
                error_data=report.to_error_data(),
                crash_report=report,
                execution_time_ms=execution_time
            )

        except Exception as e:
            execution_time = (time.perf_counter() - start_time) * 1000

            # Create crash report
            report = self._create_crash_report(
                plugin_name=plugin_name,
                method=method,
                exception=e,
                call_id=call_id,
                params=kwargs
            )
            self._record_crash(report)

            return ExecutionResult(
                success=False,
                error_code=self._exception_to_error_code(e),
                error_message=f"Plugin exception: {type(e).__name__}: {str(e)}",
                error_data=report.to_error_data(),
                crash_report=report,
                execution_time_ms=execution_time
            )

    def execute_sync(
        self,
        plugin_name: str,
        method: str,
        callable: Callable[..., T],
        args: tuple | None = None,
        kwargs: dict[str, Any] | None = None,
        call_id: int | None = None
    ) -> ExecutionResult:
        """
        Execute a synchronous plugin method with crash isolation.

        Args:
            plugin_name: Name of the plugin
            method: Method name being called
            callable: Sync callable to execute
            args: Positional arguments
            kwargs: Keyword arguments
            call_id: JSON-RPC request ID for crash reports

        Returns:
            ExecutionResult with success status and result/error
        """
        args = args or ()
        kwargs = kwargs or {}

        start_time = time.perf_counter()

        try:
            result = callable(*args, **kwargs)
            execution_time = (time.perf_counter() - start_time) * 1000

            return ExecutionResult(
                success=True,
                result=result,
                execution_time_ms=execution_time
            )

        except Exception as e:
            execution_time = (time.perf_counter() - start_time) * 1000

            # Create crash report
            report = self._create_crash_report(
                plugin_name=plugin_name,
                method=method,
                exception=e,
                call_id=call_id,
                params=kwargs
            )
            self._record_crash(report)

            return ExecutionResult(
                success=False,
                error_code=self._exception_to_error_code(e),
                error_message=f"Plugin exception: {type(e).__name__}: {str(e)}",
                error_data=report.to_error_data(),
                crash_report=report,
                execution_time_ms=execution_time
            )

    def get_crash_history(
        self,
        plugin_name: str | None = None,
        limit: int = 10
    ) -> list[CrashReport]:
        """
        Get recent crash reports.

        Args:
            plugin_name: Filter by plugin name (None for all)
            limit: Maximum reports to return

        Returns:
            List of CrashReport objects, newest first
        """
        reports = self._crash_history

        if plugin_name:
            reports = [r for r in reports if r.plugin_name == plugin_name]

        # Return newest first
        return list(reversed(reports[-limit:]))

    def get_crash_count(self, plugin_name: str) -> int:
        """Get total crash count for a plugin."""
        return self._crash_counts[plugin_name]

    def get_crash_stats(self) -> dict[str, Any]:
        """
        Get crash statistics summary.

        Returns:
            Dict with crash counts and recent crash info
        """
        recent_window = 300  # 5 minutes
        now = time.time()
        cutoff = datetime.fromtimestamp(now - recent_window)

        recent_crashes = [
            r for r in self._crash_history
            if r.timestamp > cutoff
        ]

        # Group by plugin
        by_plugin: dict[str, int] = defaultdict(int)
        for r in recent_crashes:
            by_plugin[r.plugin_name] += 1

        return {
            "total_crashes": sum(self._crash_counts.values()),
            "crashes_last_5min": len(recent_crashes),
            "crashes_by_plugin": dict(self._crash_counts),
            "recent_by_plugin": dict(by_plugin),
            "history_size": len(self._crash_history),
        }

    def clear_crash_history(self, plugin_name: str | None = None) -> int:
        """
        Clear crash history.

        Args:
            plugin_name: Plugin to clear (None for all)

        Returns:
            Number of records cleared
        """
        if plugin_name:
            before = len(self._crash_history)
            self._crash_history = [
                r for r in self._crash_history
                if r.plugin_name != plugin_name
            ]
            self._crash_counts[plugin_name] = 0
            return before - len(self._crash_history)
        else:
            count = len(self._crash_history)
            self._crash_history.clear()
            self._crash_counts.clear()
            return count


def isolated(
    timeout: float | None = None,
    executor: IsolatedExecutor | None = None
):
    """
    Decorator for isolated plugin method execution.

    Args:
        timeout: Timeout in seconds
        executor: IsolatedExecutor instance (uses default if not specified)

    Usage:
        @isolated(timeout=30.0)
        async def synthesize(self, text: str) -> dict:
            # If this raises, it becomes a JSON-RPC error
            ...
    """
    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def wrapper(self, *args, **kwargs):
            exec_instance = executor or getattr(self, '_executor', None)

            if exec_instance is None:
                # No executor, just run with basic try/except
                try:
                    return await func(self, *args, **kwargs)
                except Exception as e:
                    logger.error(f"Plugin method {func.__name__} failed: {e}")
                    raise

            result = await exec_instance.execute(
                plugin_name=getattr(self, 'name', 'unknown'),
                method=func.__name__,
                callable=lambda: func(self, *args, **kwargs),
                timeout_seconds=timeout
            )

            if result.success:
                return result.result
            else:
                # Re-raise as a standard exception
                raise RuntimeError(result.error_message)

        return wrapper
    return decorator


# Module-level default executor
_default_executor: IsolatedExecutor | None = None


def get_executor() -> IsolatedExecutor:
    """Get or create the default isolated executor."""
    global _default_executor
    if _default_executor is None:
        _default_executor = IsolatedExecutor()
    return _default_executor


def set_executor(executor: IsolatedExecutor) -> None:
    """Set the default isolated executor."""
    global _default_executor
    _default_executor = executor
