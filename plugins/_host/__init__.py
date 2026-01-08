"""
D029 - plugins/_host/__init__.py
================================
Plugin Host package initialization with stderr logging configuration.

This module configures the logging system for the Plugin Host, ensuring
all log output goes to stderr (NOT stdout) to avoid corrupting the
JSON-RPC communication channel.

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)

CRITICAL: All logging MUST go to stderr. Stdout is reserved for JSON-RPC only.
          Violating this will cause IPC protocol corruption and deadlocks.

Dependencies:
    - D009: config/error_codes.yaml (error code definitions)

Usage:
    from plugins._host import configure_host_logging
    configure_host_logging(level="INFO")

    # Or import individual components
    from plugins._host.discovery import HybridDiscovery
    from plugins._host.manager import PluginManager
    from plugins._host.protocol import JsonRpcRouter
"""

import io
import logging
import os
import sys
from datetime import datetime
from pathlib import Path
from typing import Optional

# Package version
__version__ = "1.0.0"

# Package metadata
__author__ = "Piovis Consulting"
__license__ = "Proprietary"


# ============================================
# CRITICAL: UNBUFFERED STDOUT CONFIGURATION
# ============================================
# This MUST be executed before ANY other imports that might write to stdout.
# Buffered stdout causes IPC deadlocks with Tauri.

def _configure_unbuffered_stdout() -> None:
    """
    Configure stdout for unbuffered, line-by-line output.

    CRITICAL: This prevents IPC deadlocks in the JSON-RPC communication.
    Must be called at module import time.
    """
    # Method 1: Environment variable (affects child processes too)
    os.environ['PYTHONUNBUFFERED'] = '1'

    # Method 2: Reconfigure stdout (Python 3.7+)
    if hasattr(sys.stdout, 'reconfigure'):
        try:
            sys.stdout.reconfigure(line_buffering=True, write_through=True)
        except Exception:
            pass  # Fall through to method 3

    # Method 3: Replace stdout with unbuffered wrapper
    # This is the most reliable method, especially on Windows
    try:
        sys.stdout = io.TextIOWrapper(
            io.BufferedWriter(
                io.FileIO(sys.stdout.fileno(), mode='wb', closefd=False)
            ),
            encoding='utf-8',
            line_buffering=True,
            write_through=True
        )
    except Exception:
        # Last resort: simple flush-through wrapper
        pass


# Execute immediately at import time
_configure_unbuffered_stdout()


# ============================================
# LOGGING CONFIGURATION
# ============================================

# Default log format matching our standard pattern
DEFAULT_LOG_FORMAT = "%(asctime)s [%(levelname)s] %(name)s: %(message)s"

# Default date format
DEFAULT_DATE_FORMAT = "%Y-%m-%d %H:%M:%S"

# Logger name prefix for all Plugin Host loggers
LOGGER_PREFIX = "plugin_host"

# Log levels mapping
LOG_LEVELS = {
    "DEBUG": logging.DEBUG,
    "INFO": logging.INFO,
    "WARNING": logging.WARNING,
    "WARN": logging.WARNING,
    "ERROR": logging.ERROR,
    "CRITICAL": logging.CRITICAL,
}


class StderrHandler(logging.StreamHandler):
    """
    A StreamHandler that ALWAYS writes to stderr.

    This ensures log messages never contaminate the stdout JSON-RPC channel,
    even if sys.stderr is reassigned elsewhere.
    """

    def __init__(self):
        """Initialize with stderr as the stream."""
        super().__init__(stream=sys.stderr)

    def emit(self, record: logging.LogRecord) -> None:
        """
        Emit a record to stderr.

        Overrides parent to explicitly use sys.stderr at emit time,
        in case stderr was reassigned after handler creation.
        """
        try:
            self.stream = sys.stderr
            super().emit(record)
            self.flush()
        except Exception:
            self.handleError(record)


class JsonRpcSafeFormatter(logging.Formatter):
    """
    A formatter that ensures log output doesn't look like JSON-RPC.

    Prefixes all log lines with a marker that the Rust IPC layer can
    filter out if needed.
    """

    LOG_PREFIX = "[LOG] "

    def format(self, record: logging.LogRecord) -> str:
        """Format the record with a non-JSON prefix."""
        formatted = super().format(record)
        # Prefix each line to distinguish from JSON-RPC
        lines = formatted.split('\n')
        prefixed = '\n'.join(f"{self.LOG_PREFIX}{line}" for line in lines)
        return prefixed


def configure_host_logging(
    level: str = "INFO",
    log_format: str | None = None,
    date_format: str | None = None,
    use_json_safe: bool = False
) -> logging.Logger:
    """
    Configure logging for the Plugin Host.

    All logging is directed to stderr to keep stdout clean for JSON-RPC.

    Args:
        level: Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL)
        log_format: Custom log format string (defaults to DEFAULT_LOG_FORMAT)
        date_format: Custom date format string (defaults to DEFAULT_DATE_FORMAT)
        use_json_safe: If True, prefix logs to distinguish from JSON-RPC

    Returns:
        The root plugin host logger

    Example:
        >>> configure_host_logging(level="DEBUG")
        >>> logger = logging.getLogger("plugin_host.discovery")
        >>> logger.info("Starting discovery...")  # Goes to stderr
    """
    # Get numeric level
    numeric_level = LOG_LEVELS.get(level.upper(), logging.INFO)

    # Get root logger for plugin host
    root_logger = logging.getLogger(LOGGER_PREFIX)
    root_logger.setLevel(numeric_level)

    # Remove any existing handlers
    root_logger.handlers.clear()

    # Create stderr handler
    handler = StderrHandler()
    handler.setLevel(numeric_level)

    # Create formatter
    fmt = log_format or DEFAULT_LOG_FORMAT
    datefmt = date_format or DEFAULT_DATE_FORMAT

    if use_json_safe:
        formatter = JsonRpcSafeFormatter(fmt=fmt, datefmt=datefmt)
    else:
        formatter = logging.Formatter(fmt=fmt, datefmt=datefmt)

    handler.setFormatter(formatter)

    # Add handler to root logger
    root_logger.addHandler(handler)

    # Prevent propagation to root logger (which might have stdout handlers)
    root_logger.propagate = False

    return root_logger


def get_logger(name: str) -> logging.Logger:
    """
    Get a logger for a Plugin Host module.

    Args:
        name: Logger name (will be prefixed with "plugin_host.")

    Returns:
        Configured logger instance

    Example:
        >>> logger = get_logger("discovery")
        >>> logger.info("Scanning plugins...")
    """
    if not name.startswith(LOGGER_PREFIX):
        name = f"{LOGGER_PREFIX}.{name}"
    return logging.getLogger(name)


# ============================================
# FILE LOGGING (OPTIONAL)
# ============================================

def add_file_logging(
    log_file: str | Path,
    level: str = "DEBUG",
    max_bytes: int = 10_000_000,  # 10MB
    backup_count: int = 5
) -> None:
    """
    Add rotating file logging in addition to stderr.

    Args:
        log_file: Path to log file
        level: Log level for file handler
        max_bytes: Maximum file size before rotation
        backup_count: Number of backup files to keep
    """
    from logging.handlers import RotatingFileHandler

    # Ensure log directory exists
    log_path = Path(log_file)
    log_path.parent.mkdir(parents=True, exist_ok=True)

    # Get root logger
    root_logger = logging.getLogger(LOGGER_PREFIX)

    # Create rotating file handler
    file_handler = RotatingFileHandler(
        filename=str(log_path),
        maxBytes=max_bytes,
        backupCount=backup_count,
        encoding='utf-8'
    )

    # Configure handler
    numeric_level = LOG_LEVELS.get(level.upper(), logging.DEBUG)
    file_handler.setLevel(numeric_level)

    formatter = logging.Formatter(
        fmt=DEFAULT_LOG_FORMAT,
        datefmt=DEFAULT_DATE_FORMAT
    )
    file_handler.setFormatter(formatter)

    # Add to root logger
    root_logger.addHandler(file_handler)


# ============================================
# SHUTDOWN LOGGING
# ============================================

def log_startup_info(logger: logging.Logger) -> None:
    """
    Log startup information for debugging.

    Args:
        logger: Logger to use for output
    """
    logger.info("=" * 60)
    logger.info("Plugin Host Starting")
    logger.info("=" * 60)
    logger.info(f"Version: {__version__}")
    logger.info(f"Python: {sys.version}")
    logger.info(f"Platform: {sys.platform}")
    logger.info(f"Working Directory: {Path.cwd()}")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info("=" * 60)


def log_shutdown_info(logger: logging.Logger, reason: str = "Normal") -> None:
    """
    Log shutdown information for debugging.

    Args:
        logger: Logger to use for output
        reason: Reason for shutdown
    """
    logger.info("=" * 60)
    logger.info(f"Plugin Host Shutting Down: {reason}")
    logger.info(f"Timestamp: {datetime.now().isoformat()}")
    logger.info("=" * 60)


# ============================================
# PACKAGE EXPORTS
# ============================================

# Core modules (lazy imports to avoid circular dependencies)
def _import_discovery():
    from .discovery import DiscoveredPlugin, HybridDiscovery, discover_plugins
    return HybridDiscovery, DiscoveredPlugin, discover_plugins

def _import_validator():
    from .validator import PluginValidator, ValidationResult, validate_plugin
    return PluginValidator, ValidationResult, validate_plugin

def _import_loader():
    from .loader import LoadedPlugin, PluginLoader, initialize_plugin, shutdown_plugin
    return PluginLoader, LoadedPlugin, initialize_plugin, shutdown_plugin

def _import_manager():
    from .manager import HotSwapResult, PluginManager, get_manager, set_manager
    return PluginManager, HotSwapResult, get_manager, set_manager

def _import_protocol():
    from .protocol import JsonRpcError, JsonRpcRequest, JsonRpcResponse, JsonRpcRouter
    return JsonRpcRouter, JsonRpcRequest, JsonRpcResponse, JsonRpcError

def _import_isolation():
    from .isolation import CrashReport, ExecutionResult, IsolatedExecutor
    return IsolatedExecutor, CrashReport, ExecutionResult

def _import_shutdown():
    from .shutdown import ShutdownHandler, ShutdownReason
    return ShutdownHandler, ShutdownReason


# Public API
__all__ = [
    # Version
    "__version__",

    # Logging
    "configure_host_logging",
    "get_logger",
    "add_file_logging",
    "log_startup_info",
    "log_shutdown_info",
    "StderrHandler",
    "JsonRpcSafeFormatter",

    # Constants
    "LOGGER_PREFIX",
    "DEFAULT_LOG_FORMAT",
    "DEFAULT_DATE_FORMAT",
    "LOG_LEVELS",

    # Lazy import helpers (for avoiding circular imports)
    "_import_discovery",
    "_import_validator",
    "_import_loader",
    "_import_manager",
    "_import_protocol",
    "_import_isolation",
    "_import_shutdown",
]
