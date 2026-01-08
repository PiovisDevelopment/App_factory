"""
D027 - plugins/_host/shutdown.py
================================
Graceful shutdown handlers for the Plugin Host.

Implements proper shutdown sequences for:
- Normal shutdown via "shutdown" JSON-RPC method
- Stdin EOF (Rust parent closed pipe)
- SIGTERM/SIGINT signals
- Emergency cleanup on unhandled exceptions

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)

Dependencies:
    - D024: manager.py (PluginManager)
    - D028: isolation.py (crash isolation)

Shutdown Sequence:
    1. Set shutdown flag (prevent new requests)
    2. Complete in-flight requests (with timeout)
    3. Shutdown all plugins via manager
    4. Flush output streams
    5. Exit with appropriate code

Exit Codes:
    0: Normal shutdown
    1: Error during shutdown
    2: Interrupted (SIGINT)
    3: Terminated (SIGTERM)
    4: Stdin closed unexpectedly
"""

import asyncio
import atexit
import logging
import signal
import sys
import time
from collections.abc import Callable, Coroutine
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from typing import Any, Optional

logger = logging.getLogger(__name__)


class ShutdownReason(Enum):
    """Reason for shutdown."""

    NORMAL = "normal"  # Shutdown method called
    EOF = "eof"  # Stdin closed
    SIGTERM = "sigterm"  # SIGTERM received
    SIGINT = "sigint"  # SIGINT (Ctrl+C) received
    ERROR = "error"  # Unhandled error
    TIMEOUT = "timeout"  # Shutdown timeout exceeded
    REQUESTED = "requested"  # Programmatic shutdown request


@dataclass
class ShutdownState:
    """Current state of shutdown process."""

    initiated: bool = False
    reason: ShutdownReason | None = None
    timestamp: datetime | None = None
    in_flight_count: int = 0
    plugins_shutdown: bool = False
    exit_code: int = 0

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSON-RPC responses."""
        return {
            "initiated": self.initiated,
            "reason": self.reason.value if self.reason else None,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
            "in_flight_count": self.in_flight_count,
            "plugins_shutdown": self.plugins_shutdown,
            "exit_code": self.exit_code,
        }


class ShutdownHandler:
    """
    Manages graceful shutdown of the Plugin Host.

    Features:
        - Signal handling (SIGTERM, SIGINT)
        - In-flight request tracking
        - Timeout-based forced shutdown
        - Plugin manager integration
        - Cleanup callback registration

    Usage:
        handler = ShutdownHandler(manager=plugin_manager)
        handler.register_cleanup(cleanup_function)

        # In main loop
        if handler.is_shutdown_requested():
            break

        # Start tracking request
        handler.request_started(request_id=1)
        ...process request...
        handler.request_completed(request_id=1)

        # Initiate shutdown
        await handler.shutdown(reason=ShutdownReason.NORMAL)
    """

    # Exit codes by reason
    EXIT_CODES = {
        ShutdownReason.NORMAL: 0,
        ShutdownReason.EOF: 4,
        ShutdownReason.SIGTERM: 3,
        ShutdownReason.SIGINT: 2,
        ShutdownReason.ERROR: 1,
        ShutdownReason.TIMEOUT: 1,
        ShutdownReason.REQUESTED: 0,
    }

    def __init__(
        self, manager: Optional["PluginManager"] = None, shutdown_timeout: float = 10.0, request_timeout: float = 5.0
    ):
        """
        Initialize shutdown handler.

        Args:
            manager: PluginManager instance for plugin cleanup
            shutdown_timeout: Maximum time for shutdown process
            request_timeout: Maximum time to wait for in-flight requests
        """
        self.manager = manager
        self.shutdown_timeout = shutdown_timeout
        self.request_timeout = request_timeout

        # State
        self._state = ShutdownState()
        self._in_flight: set[int] = set()
        self._cleanup_callbacks: list[Callable[[], Coroutine[Any, Any, None]]] = []
        self._sync_cleanup_callbacks: list[Callable[[], None]] = []

        # Original signal handlers
        self._original_sigterm = None
        self._original_sigint = None

        # Event loop reference for async shutdown from signal
        self._loop: asyncio.AbstractEventLoop | None = None

        logger.debug(
            f"ShutdownHandler initialized: shutdown_timeout={shutdown_timeout}s, request_timeout={request_timeout}s"
        )

    def install_signal_handlers(self, loop: asyncio.AbstractEventLoop | None = None) -> None:
        """
        Install signal handlers for graceful shutdown.

        Args:
            loop: Event loop to use for async shutdown
        """
        self._loop = loop or asyncio.get_event_loop()

        # Store original handlers
        self._original_sigterm = signal.getsignal(signal.SIGTERM)
        self._original_sigint = signal.getsignal(signal.SIGINT)

        # Install new handlers
        signal.signal(signal.SIGTERM, self._handle_sigterm)
        signal.signal(signal.SIGINT, self._handle_sigint)

        # Register atexit handler for emergency cleanup
        atexit.register(self._atexit_cleanup)

        logger.debug("Signal handlers installed")

    def uninstall_signal_handlers(self) -> None:
        """Restore original signal handlers."""
        if self._original_sigterm is not None:
            signal.signal(signal.SIGTERM, self._original_sigterm)
        if self._original_sigint is not None:
            signal.signal(signal.SIGINT, self._original_sigint)

        logger.debug("Signal handlers uninstalled")

    def _handle_sigterm(self, signum: int, frame) -> None:
        """Handle SIGTERM signal."""
        logger.info(f"Received SIGTERM (signal {signum})")
        self._initiate_shutdown(ShutdownReason.SIGTERM)

    def _handle_sigint(self, signum: int, frame) -> None:
        """Handle SIGINT signal."""
        logger.info(f"Received SIGINT (signal {signum})")
        self._initiate_shutdown(ShutdownReason.SIGINT)

    def _initiate_shutdown(self, reason: ShutdownReason) -> None:
        """
        Set shutdown flag (called from signal handler).

        The main loop should check is_shutdown_requested() and call
        the async shutdown() method.
        """
        if not self._state.initiated:
            self._state.initiated = True
            self._state.reason = reason
            self._state.timestamp = datetime.now()
            self._state.exit_code = self.EXIT_CODES.get(reason, 1)

            logger.info(f"Shutdown initiated: {reason.value}")

    def _atexit_cleanup(self) -> None:
        """Emergency cleanup on exit."""
        if self._in_flight:
            logger.warning(f"Exiting with {len(self._in_flight)} in-flight requests")

        # Run sync cleanup callbacks
        for callback in self._sync_cleanup_callbacks:
            try:
                callback()
            except Exception as e:
                logger.error(f"Error in sync cleanup callback: {e}")

    def register_cleanup(self, callback: Callable[[], Coroutine[Any, Any, None]]) -> None:
        """
        Register an async cleanup callback.

        Args:
            callback: Async function to call during shutdown
        """
        self._cleanup_callbacks.append(callback)

    def register_sync_cleanup(self, callback: Callable[[], None]) -> None:
        """
        Register a sync cleanup callback.

        Args:
            callback: Sync function to call during shutdown
        """
        self._sync_cleanup_callbacks.append(callback)

    def is_shutdown_requested(self) -> bool:
        """Check if shutdown has been requested."""
        return self._state.initiated

    def get_state(self) -> ShutdownState:
        """Get current shutdown state."""
        self._state.in_flight_count = len(self._in_flight)
        return self._state

    def request_started(self, request_id: int) -> None:
        """
        Track that a request has started processing.

        Args:
            request_id: JSON-RPC request ID
        """
        if not self._state.initiated:
            self._in_flight.add(request_id)

    def request_completed(self, request_id: int) -> None:
        """
        Track that a request has completed.

        Args:
            request_id: JSON-RPC request ID
        """
        self._in_flight.discard(request_id)

    async def wait_for_in_flight(self) -> bool:
        """
        Wait for in-flight requests to complete.

        Returns:
            True if all requests completed, False if timeout
        """
        if not self._in_flight:
            return True

        logger.info(f"Waiting for {len(self._in_flight)} in-flight requests...")

        start = time.time()
        while self._in_flight and (time.time() - start) < self.request_timeout:
            await asyncio.sleep(0.1)

        if self._in_flight:
            logger.warning(f"Timeout: {len(self._in_flight)} requests still in-flight")
            return False

        logger.info("All in-flight requests completed")
        return True

    async def shutdown_plugins(self) -> bool:
        """
        Shutdown all plugins via manager.

        Returns:
            True if shutdown successful
        """
        if self.manager is None:
            logger.debug("No plugin manager, skipping plugin shutdown")
            return True

        if self._state.plugins_shutdown:
            logger.debug("Plugins already shutdown")
            return True

        logger.info("Shutting down plugins...")

        try:
            await self.manager.shutdown()
            self._state.plugins_shutdown = True
            logger.info("All plugins shutdown successfully")
            return True
        except Exception as e:
            logger.error(f"Error shutting down plugins: {e}")
            return False

    async def run_cleanup_callbacks(self) -> bool:
        """
        Run all registered cleanup callbacks.

        Returns:
            True if all callbacks succeeded
        """
        success = True

        # Run async callbacks
        for callback in self._cleanup_callbacks:
            try:
                await callback()
            except Exception as e:
                logger.error(f"Error in cleanup callback: {e}")
                success = False

        # Run sync callbacks
        for callback in self._sync_cleanup_callbacks:
            try:
                callback()
            except Exception as e:
                logger.error(f"Error in sync cleanup callback: {e}")
                success = False

        return success

    async def shutdown(self, reason: ShutdownReason = ShutdownReason.NORMAL) -> int:
        """
        Perform graceful shutdown.

        Args:
            reason: Reason for shutdown

        Returns:
            Exit code
        """
        # Set shutdown state if not already set
        if not self._state.initiated:
            self._initiate_shutdown(reason)

        logger.info(f"Beginning shutdown sequence ({reason.value})...")

        shutdown_start = time.time()

        try:
            # Step 1: Wait for in-flight requests
            await self.wait_for_in_flight()

            # Step 2: Shutdown plugins
            await self.shutdown_plugins()

            # Step 3: Run cleanup callbacks
            await self.run_cleanup_callbacks()

            # Step 4: Uninstall signal handlers
            self.uninstall_signal_handlers()

            # Step 5: Flush streams
            try:
                sys.stdout.flush()
                sys.stderr.flush()
            except Exception:
                pass

            elapsed = time.time() - shutdown_start
            logger.info(f"Shutdown complete in {elapsed:.2f}s")

        except TimeoutError:
            logger.error("Shutdown timed out")
            self._state.reason = ShutdownReason.TIMEOUT
            self._state.exit_code = 1

        except Exception as e:
            logger.error(f"Error during shutdown: {e}")
            self._state.exit_code = 1

        return self._state.exit_code

    def shutdown_sync(self, reason: ShutdownReason = ShutdownReason.NORMAL) -> int:
        """
        Perform synchronous shutdown (for non-async contexts).

        Args:
            reason: Reason for shutdown

        Returns:
            Exit code
        """
        # Set shutdown state
        if not self._state.initiated:
            self._initiate_shutdown(reason)

        logger.info(f"Beginning sync shutdown sequence ({reason.value})...")

        # Run sync cleanup only
        for callback in self._sync_cleanup_callbacks:
            try:
                callback()
            except Exception as e:
                logger.error(f"Error in sync cleanup: {e}")

        # Uninstall signal handlers
        self.uninstall_signal_handlers()

        # Flush streams
        try:
            sys.stdout.flush()
            sys.stderr.flush()
        except Exception:
            pass

        logger.info("Sync shutdown complete")
        return self._state.exit_code


class ShutdownContext:
    """
    Context manager for shutdown-aware operations.

    Usage:
        async with ShutdownContext(handler) as ctx:
            ctx.check_shutdown()  # Raises if shutdown requested
            ...do work...
    """

    class ShutdownRequestedError(Exception):
        """Raised when shutdown is requested during operation."""

        pass

    def __init__(self, handler: ShutdownHandler, request_id: int | None = None):
        """
        Initialize context.

        Args:
            handler: ShutdownHandler instance
            request_id: Optional request ID to track
        """
        self.handler = handler
        self.request_id = request_id

    async def __aenter__(self) -> "ShutdownContext":
        """Enter context and track request."""
        if self.request_id is not None:
            self.handler.request_started(self.request_id)
        return self

    async def __aexit__(self, exc_type, exc_val, exc_tb) -> bool:
        """Exit context and complete request tracking."""
        if self.request_id is not None:
            self.handler.request_completed(self.request_id)
        return False

    def check_shutdown(self) -> None:
        """
        Check if shutdown is requested.

        Raises:
            ShutdownRequestedError: If shutdown is in progress
        """
        if self.handler.is_shutdown_requested():
            raise self.ShutdownRequestedError("Shutdown requested")


# Module-level default handler
_default_handler: ShutdownHandler | None = None


def get_shutdown_handler() -> ShutdownHandler | None:
    """Get the default shutdown handler."""
    return _default_handler


def set_shutdown_handler(handler: ShutdownHandler) -> None:
    """Set the default shutdown handler."""
    global _default_handler
    _default_handler = handler


def create_shutdown_handler(
    manager: Optional["PluginManager"] = None,
    install_signals: bool = True,
    loop: asyncio.AbstractEventLoop | None = None,
) -> ShutdownHandler:
    """
    Create and configure a shutdown handler.

    Args:
        manager: PluginManager for plugin cleanup
        install_signals: Whether to install signal handlers
        loop: Event loop for async shutdown from signals

    Returns:
        Configured ShutdownHandler
    """
    handler = ShutdownHandler(manager=manager)

    if install_signals:
        handler.install_signal_handlers(loop)

    set_shutdown_handler(handler)

    return handler


# Type hints for lazy import
PluginManager = Any  # Will be imported from manager.py
