"""
D025 - plugins/_host/__main__.py
================================
Plugin Host entry point with unbuffered stdout JSON-RPC read loop.

This is the main process spawned by Tauri's Rust IPC layer (D030-D036).
It reads JSON-RPC requests from stdin and writes responses to stdout.
All logging goes to stderr to avoid corrupting the JSON-RPC stream.

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)

Dependencies:
    - D001: contracts/base.py (PluginBase, PluginStatus, HealthStatus)
    - D009: config/error_codes.yaml (error code definitions)
    - D020: discovery.py (HybridDiscovery)
    - D024: manager.py (PluginManager)
    - D026: protocol.py (JsonRpcRouter, JsonRpcRequest, JsonRpcResponse)
    - D027: shutdown.py (ShutdownHandler, ShutdownReason)
    - D028: isolation.py (IsolatedExecutor)
    - D029: __init__.py (configure_host_logging, _configure_unbuffered_stdout)

Usage:
    python -m plugins._host [--plugins-dir ./plugins] [--config-dir ./config] [--log-level INFO]

The host reads JSON-RPC requests line-by-line from stdin:
    {"jsonrpc": "2.0", "method": "plugin/list", "params": {}, "id": 1}

And writes JSON-RPC responses to stdout:
    {"jsonrpc": "2.0", "result": [...], "id": 1}

Exit Codes:
    0: Normal shutdown (via shutdown method or EOF)
    1: Error during execution
    2: Interrupted (SIGINT/Ctrl+C)
    3: Terminated (SIGTERM)
    4: Stdin closed unexpectedly
"""

# ============================================
# CRITICAL: UNBUFFERED STDOUT CONFIGURATION
# ============================================
# This MUST be at the very top of the file, before ANY other imports.
# Buffered stdout causes IPC deadlocks with Tauri on Windows.

import io
import os
import sys

# Method 1: Environment variable
os.environ['PYTHONUNBUFFERED'] = '1'

# Method 2: Reconfigure stdout (Python 3.7+)
if hasattr(sys.stdout, 'reconfigure'):
    try:
        sys.stdout.reconfigure(line_buffering=True, write_through=True)
    except Exception:
        pass

# Method 3: Replace stdout with unbuffered wrapper (most reliable on Windows)
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
    pass

# ============================================
# STANDARD IMPORTS (AFTER UNBUFFERED CONFIG)
# ============================================

import argparse
import asyncio
import json
from datetime import datetime
from pathlib import Path
from typing import Any

# ============================================
# LOCAL IMPORTS
# ============================================
# Import package initialization (configures logging infrastructure)
from . import (
    __version__,
    configure_host_logging,
    get_logger,
    log_shutdown_info,
    log_startup_info,
)

# Import core components
from .isolation import IsolatedExecutor, set_executor
from .manager import PluginManager, set_manager
from .protocol import (
    ErrorCodes,
    JsonRpcRouter,
)
from .shutdown import (
    ShutdownHandler,
    ShutdownReason,
    create_shutdown_handler,
)

# ============================================
# MODULE LOGGER
# ============================================

logger = get_logger("main")


# ============================================
# JSON-RPC I/O FUNCTIONS
# ============================================

def send_response(response: dict[str, Any]) -> None:
    """
    Send a JSON-RPC response to stdout.

    Args:
        response: JSON-RPC response dictionary

    Note:
        Uses compact JSON (no whitespace) and explicit flush
        for reliable IPC communication.
    """
    try:
        line = json.dumps(response, ensure_ascii=False, separators=(',', ':'))
        sys.stdout.write(line)
        sys.stdout.write('\n')
        sys.stdout.flush()
    except Exception as e:
        logger.error(f"Failed to send response: {e}")


def send_error(
    request_id: str | int | None,
    code: int,
    message: str,
    data: dict[str, Any] | None = None
) -> None:
    """
    Send a JSON-RPC error response.

    Args:
        request_id: Request ID (None for parse errors)
        code: JSON-RPC error code
        message: Error message
        data: Additional error data
    """
    error_obj = {"code": code, "message": message}
    if data is not None:
        error_obj["data"] = data

    response = {
        "jsonrpc": "2.0",
        "id": request_id,
        "error": error_obj,
    }
    send_response(response)


def send_result(
    request_id: str | int | None,
    result: Any
) -> None:
    """
    Send a JSON-RPC success response.

    Args:
        request_id: Request ID
        result: Result value
    """
    response = {
        "jsonrpc": "2.0",
        "id": request_id,
        "result": result,
    }
    send_response(response)


# ============================================
# SHUTDOWN METHOD HANDLER
# ============================================

async def handle_shutdown_method(
    params: dict[str, Any] | None,
    request_id: str | int | None,
    shutdown_handler: ShutdownHandler
) -> dict[str, Any]:
    """
    Handle the 'shutdown' JSON-RPC method.

    Args:
        params: Method parameters (optional reason)
        request_id: Request ID
        shutdown_handler: ShutdownHandler instance

    Returns:
        Acknowledgment response
    """
    reason = params.get("reason", "requested") if params else "requested"
    logger.info(f"Shutdown method called: reason={reason}")

    # Signal shutdown (will be picked up by main loop)
    shutdown_handler._initiate_shutdown(ShutdownReason.REQUESTED)

    return {
        "status": "shutting_down",
        "reason": reason,
        "timestamp": datetime.now().isoformat(),
    }


# ============================================
# MAIN READ LOOP
# ============================================

async def run_read_loop(
    router: JsonRpcRouter,
    shutdown_handler: ShutdownHandler
) -> None:
    """
    Main JSON-RPC read loop.

    Reads JSON-RPC requests from stdin line-by-line and processes them.
    Continues until shutdown is requested or stdin is closed.

    Args:
        router: JsonRpcRouter for request handling
        shutdown_handler: ShutdownHandler for graceful shutdown
    """
    logger.info("Starting JSON-RPC read loop")

    loop = asyncio.get_event_loop()

    # Create a reader for stdin
    reader = asyncio.StreamReader()
    protocol = asyncio.StreamReaderProtocol(reader)

    try:
        await loop.connect_read_pipe(lambda: protocol, sys.stdin)
    except Exception as e:
        logger.error(f"Failed to connect stdin pipe: {e}")
        send_error(None, ErrorCodes.INTERNAL_ERROR, f"Stdin connection failed: {e}")
        return

    logger.info("JSON-RPC read loop ready, waiting for requests...")

    request_count = 0

    while not shutdown_handler.is_shutdown_requested():
        try:
            # Read a line from stdin with timeout
            try:
                line_bytes = await asyncio.wait_for(
                    reader.readline(),
                    timeout=1.0  # Check shutdown flag every second
                )
            except TimeoutError:
                continue

            # Check for EOF (stdin closed)
            if not line_bytes:
                logger.info("EOF on stdin, initiating shutdown")
                shutdown_handler._initiate_shutdown(ShutdownReason.EOF)
                break

            # Decode and strip
            line = line_bytes.decode('utf-8', errors='replace').strip()

            # Skip empty lines
            if not line:
                continue

            request_count += 1
            logger.debug(f"Received request #{request_count}: {line[:100]}...")

            # Parse JSON
            try:
                json.loads(line)
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parse error: {e}")
                send_error(None, ErrorCodes.PARSE_ERROR, f"Parse error: {e}")
                continue

            # Parse as JSON-RPC request
            request, error_response = router.parse_request(line)

            if error_response:
                send_response(error_response.to_dict())
                continue

            if not request:
                logger.warning("Failed to parse request")
                send_error(None, ErrorCodes.INVALID_REQUEST, "Invalid request")
                continue

            # Track in-flight request
            if request.id is not None:
                shutdown_handler.request_started(request.id)

            try:
                # Check for shutdown method (handle specially)
                if request.method == "shutdown":
                    result = await handle_shutdown_method(
                        request.params if isinstance(request.params, dict) else {},
                        request.id,
                        shutdown_handler
                    )
                    if not request.is_notification:
                        send_result(request.id, result)
                    break  # Exit loop after shutdown

                # Route to handler
                response = await router.handle_request(request)

                # Send response (skip for notifications)
                if response and not request.is_notification:
                    send_response(response.to_dict())

            except Exception as e:
                logger.exception(f"Error handling request: {e}")
                if not request.is_notification:
                    send_error(
                        request.id,
                        ErrorCodes.INTERNAL_ERROR,
                        f"Internal error: {type(e).__name__}: {str(e)}"
                    )
            finally:
                # Complete request tracking
                if request.id is not None:
                    shutdown_handler.request_completed(request.id)

        except asyncio.CancelledError:
            logger.info("Read loop cancelled")
            break

        except Exception as e:
            logger.exception(f"Unexpected error in read loop: {e}")
            send_error(None, ErrorCodes.INTERNAL_ERROR, f"Read loop error: {e}")

    logger.info(f"Read loop ended after {request_count} requests")


# ============================================
# SYNCHRONOUS READ LOOP (WINDOWS-COMPATIBLE)
# ============================================

def run_sync_read_loop(
    router: JsonRpcRouter,
    shutdown_handler: ShutdownHandler,
    event_loop: asyncio.AbstractEventLoop | None = None
) -> None:
    """
    Synchronous read loop for Windows and environments without async stdin.

    Uses sys.stdin directly for line-by-line reading. This is the PRIMARY
    mode for Windows because ProactorEventLoop doesn't support connect_read_pipe
    for piped stdin.

    Args:
        router: JsonRpcRouter for request handling
        shutdown_handler: ShutdownHandler for graceful shutdown
        event_loop: Optional existing event loop to use for async handlers.
                   If None, creates a new loop per request.
    """
    logger.info("Starting synchronous JSON-RPC read loop (Windows-compatible)")
    logger.info(f"Platform: {sys.platform}")
    logger.info(f"Event loop provided: {event_loop is not None}")
    logger.info("Ready, waiting for requests on stdin...")

    request_count = 0

    # If no event loop provided, we'll create one for the duration
    # This is the standalone mode (not called from async context)
    own_loop = False
    if event_loop is None:
        event_loop = asyncio.new_event_loop()
        asyncio.set_event_loop(event_loop)
        own_loop = True
        logger.debug("Created new event loop for sync mode")

    try:
        for line in sys.stdin:
            # Check shutdown
            if shutdown_handler.is_shutdown_requested():
                logger.info("Shutdown requested, exiting read loop")
                break

            line = line.strip()

            # Skip empty lines
            if not line:
                continue

            request_count += 1
            logger.debug(f"Received request #{request_count}: {line[:100]}...")

            # Parse JSON
            try:
                json.loads(line)
            except json.JSONDecodeError as e:
                logger.warning(f"JSON parse error: {e}")
                send_error(None, ErrorCodes.PARSE_ERROR, f"Parse error: {e}")
                continue

            # Parse as JSON-RPC request
            request, error_response = router.parse_request(line)

            if error_response:
                logger.warning(f"Invalid request: {error_response.error}")
                send_response(error_response.to_dict())
                continue

            if not request:
                logger.warning("Failed to parse request (null result)")
                send_error(None, ErrorCodes.INVALID_REQUEST, "Invalid request")
                continue

            logger.debug(f"Processing method: {request.method} (id={request.id})")

            # Track request
            if request.id is not None:
                shutdown_handler.request_started(request.id)

            try:
                # Check for shutdown method
                if request.method == "shutdown":
                    logger.info("Shutdown method called")
                    result = {
                        "status": "shutting_down",
                        "timestamp": datetime.now().isoformat(),
                    }
                    if not request.is_notification:
                        send_result(request.id, result)
                    shutdown_handler._initiate_shutdown(ShutdownReason.REQUESTED)
                    break

                # Route to handler using the event loop
                # Use run_until_complete which is safe for sync context
                response = event_loop.run_until_complete(
                    router.handle_request(request)
                )

                # Send response
                if response and not request.is_notification:
                    logger.debug(f"Sending response for id={request.id}")
                    send_response(response.to_dict())

            except Exception as e:
                logger.exception(f"Error handling request {request.method}: {e}")
                if not request.is_notification:
                    send_error(
                        request.id,
                        ErrorCodes.INTERNAL_ERROR,
                        f"Internal error: {type(e).__name__}: {str(e)}"
                    )
            finally:
                if request.id is not None:
                    shutdown_handler.request_completed(request.id)

    except KeyboardInterrupt:
        logger.info("Interrupted by keyboard (Ctrl+C)")
        shutdown_handler._initiate_shutdown(ShutdownReason.SIGINT)

    except BrokenPipeError:
        logger.info("Pipe broken (parent process closed stdin)")
        shutdown_handler._initiate_shutdown(ShutdownReason.EOF)

    except EOFError:
        logger.info("EOF on stdin")
        shutdown_handler._initiate_shutdown(ShutdownReason.EOF)

    except Exception as e:
        logger.exception(f"Fatal error in sync read loop: {e}")
        shutdown_handler._initiate_shutdown(ShutdownReason.ERROR)

    finally:
        if own_loop:
            logger.debug("Closing owned event loop")
            event_loop.close()

    logger.info(f"Sync read loop ended after {request_count} requests")


# ============================================
# MAIN ENTRY POINT
# ============================================

async def async_main(args: argparse.Namespace) -> int:
    """
    Async main function.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code
    """
    # Configure logging
    configure_host_logging(level=args.log_level)
    log_startup_info(logger)

    logger.info(f"Plugins directory: {args.plugins_dir}")
    logger.info(f"Config directory: {args.config_dir}")

    # Resolve paths
    plugins_dir = Path(args.plugins_dir).resolve()
    config_dir = Path(args.config_dir).resolve()

    # Validate directories exist
    if not plugins_dir.exists():
        logger.error(f"Plugins directory not found: {plugins_dir}")
        send_error(None, ErrorCodes.INTERNAL_ERROR, f"Plugins directory not found: {plugins_dir}")
        return 1

    if not config_dir.exists():
        logger.warning(f"Config directory not found: {config_dir}, creating...")
        config_dir.mkdir(parents=True, exist_ok=True)

    # Initialize components
    logger.info("Initializing plugin infrastructure...")

    # Create isolated executor
    executor = IsolatedExecutor(
        default_timeout=30.0,
        crash_rate_window=60.0,
        crash_rate_limit=5
    )
    set_executor(executor)

    # Create plugin manager
    manager = PluginManager(
        plugins_dir=plugins_dir,
        config_dir=config_dir,
        auto_install_deps=args.auto_install_deps
    )
    set_manager(manager)

    # Start plugin manager (performs initial discovery)
    await manager.start()

    # Create shutdown handler
    loop = asyncio.get_event_loop()
    shutdown_handler = create_shutdown_handler(
        manager=manager,
        install_signals=True,
        loop=loop
    )

    # Create JSON-RPC router
    router = JsonRpcRouter(
        manager=manager,
        executor=executor,
        default_timeout=30.0
    )

    # ============================================
    # AI TEAM WORKFLOW HANDLER
    # ============================================

    async def handle_ai_team_run(params: dict[str, Any] | None, request_id: str | int | None) -> dict[str, Any]:
        """
        Handle ai_team/run JSON-RPC method.

        Args:
            params: Workflow parameters (must include 'prompt')
            request_id: Request ID

        Returns:
            Workflow execution results
        """
        logger.info(f"AI Team Workflow triggered (id={request_id})")

        # dynamic import to avoid circular dependencies or loading issues at startup
        try:
            # Note: app_factory must be in PYTHONPATH
            from services.ai_team.orchestrator import run_workflow_api
        except ImportError:
            # Fallback for dev environment path issues
            import sys
            sys.path.append(str(Path(__file__).parents[2]))
            from services.ai_team.orchestrator import run_workflow_api

        if not params:
            raise ValueError("Missing parameters")

        user_prompt = params.get("prompt", "")
        if not user_prompt:
            raise ValueError("Parameter 'prompt' is required")

        logger.info(f"Starting workflow for prompt: {user_prompt[:50]}...")

        try:
            # Execute workflow
            result = await run_workflow_api(user_prompt)

            logger.info("Workflow completed successfully")

            return {
                "success": True,
                "generated_code": result.generated_code,
                "qa_report": result.qa_report,
                "history": result.history,
            }
        except Exception as e:
            logger.exception("Workflow failed")
            raise RuntimeError(f"Workflow execution failed: {str(e)}")

    # Register the handler
    router.register_method(
        name="ai_team/run",
        handler=handle_ai_team_run,
        description="Run AI Team workflow",
        timeout=300.0  # Allow 5 minutes for workflow
    )


    logger.info("Plugin Host initialized successfully")

    # Auto-load plugins if requested
    if args.auto_load:
        logger.info("Auto-loading plugins...")
        discovered = manager.discover_plugins(include_invalid=False)
        for plugin in discovered:
            try:
                await manager.load_plugin(plugin.name)
                logger.info(f"Loaded: {plugin.name}")
            except Exception as e:
                logger.warning(f"Failed to auto-load {plugin.name}: {e}")

    # Run read loop
    exit_code = 0

    try:
        if args.sync_mode:
            # Run synchronous read loop
            run_sync_read_loop(router, shutdown_handler)
        else:
            # Run async read loop
            await run_read_loop(router, shutdown_handler)

    except asyncio.CancelledError:
        logger.info("Main task cancelled")
    except Exception as e:
        logger.exception(f"Fatal error: {e}")
        exit_code = 1

    # Perform graceful shutdown
    if shutdown_handler.is_shutdown_requested():
        exit_code = await shutdown_handler.shutdown(
            reason=shutdown_handler.get_state().reason or ShutdownReason.NORMAL
        )
    else:
        exit_code = await shutdown_handler.shutdown(ShutdownReason.NORMAL)

    log_shutdown_info(logger, reason=str(shutdown_handler.get_state().reason))

    return exit_code


def sync_main(args: argparse.Namespace) -> int:
    """
    Synchronous main function for Windows.

    Windows doesn't support async stdin reading with ProactorEventLoop,
    so we use a fully synchronous approach with a single event loop
    for handling async plugin operations.

    Args:
        args: Parsed command-line arguments

    Returns:
        Exit code
    """
    # Configure logging first
    configure_host_logging(level=args.log_level)
    log_startup_info(logger)

    logger.info("Running in SYNCHRONOUS mode (Windows-compatible)")
    logger.info(f"Plugins directory: {args.plugins_dir}")
    logger.info(f"Config directory: {args.config_dir}")

    # Resolve paths
    plugins_dir = Path(args.plugins_dir).resolve()
    config_dir = Path(args.config_dir).resolve()

    # Validate directories exist
    if not plugins_dir.exists():
        logger.error(f"Plugins directory not found: {plugins_dir}")
        send_error(None, ErrorCodes.INTERNAL_ERROR, f"Plugins directory not found: {plugins_dir}")
        return 1

    if not config_dir.exists():
        logger.warning(f"Config directory not found: {config_dir}, creating...")
        config_dir.mkdir(parents=True, exist_ok=True)

    # Create event loop for async operations
    # On Windows, use SelectorEventLoop for compatibility (not Proactor)
    if sys.platform == "win32":
        # SelectorEventLoop works better for our use case
        loop = asyncio.SelectorEventLoop()
    else:
        loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    logger.info(f"Event loop type: {type(loop).__name__}")

    exit_code = 0

    try:
        # Initialize components
        logger.info("Initializing plugin infrastructure...")

        # Create isolated executor
        executor = IsolatedExecutor(
            default_timeout=30.0,
            crash_rate_window=60.0,
            crash_rate_limit=5
        )
        set_executor(executor)

        # Create plugin manager
        manager = PluginManager(
            plugins_dir=plugins_dir,
            config_dir=config_dir,
            auto_install_deps=args.auto_install_deps
        )
        set_manager(manager)

        # Start plugin manager (performs initial discovery)
        loop.run_until_complete(manager.start())

        # Create shutdown handler (don't install signals in sync mode - handle manually)
        shutdown_handler = create_shutdown_handler(
            manager=manager,
            install_signals=False,  # We handle signals manually in sync mode
            loop=loop
        )

        # Create JSON-RPC router
        router = JsonRpcRouter(
            manager=manager,
            executor=executor,
            default_timeout=30.0
        )

        # ============================================
        # AI TEAM WORKFLOW HANDLER (SYNC MODE)
        # ============================================

        async def handle_ai_team_run(params: dict[str, Any] | None, request_id: str | int | None) -> dict[str, Any]:
            """Handle ai_team/run JSON-RPC method (Sync Mode)."""
            logger.info(f"AI Team Workflow triggered (id={request_id})")

            try:
                from services.ai_team.orchestrator import run_workflow_api
            except ImportError:
                import sys
                sys.path.append(str(Path(__file__).parents[2]))
                from services.ai_team.orchestrator import run_workflow_api

            if not params or not params.get("prompt"):
                raise ValueError("Parameter 'prompt' is required")

            user_prompt = params.get("prompt", "")
            logger.info(f"Starting workflow for prompt: {user_prompt[:50]}...")

            try:
                result = await run_workflow_api(user_prompt)
                logger.info("Workflow completed successfully")
                return {
                    "success": True,
                    "generated_code": result.generated_code,
                    "qa_report": result.qa_report,
                    "history": result.history,
                }
            except Exception as e:
                logger.exception("Workflow failed")
                raise RuntimeError(f"Workflow execution failed: {str(e)}")

        # Register the handler
        router.register_method(
            name="ai_team/run",
            handler=handle_ai_team_run,
            description="Run AI Team workflow",
            timeout=300.0
        )


        logger.info("Plugin Host initialized successfully")

        # Auto-load plugins if requested
        if args.auto_load:
            logger.info("Auto-loading plugins...")
            discovered = manager.discover_plugins(include_invalid=False)
            for plugin in discovered:
                try:
                    loop.run_until_complete(manager.load_plugin(plugin.name))
                    logger.info(f"Loaded: {plugin.name}")
                except Exception as e:
                    logger.warning(f"Failed to auto-load {plugin.name}: {e}")

        # Run synchronous read loop with the event loop
        run_sync_read_loop(router, shutdown_handler, event_loop=loop)

        # Perform graceful shutdown
        if shutdown_handler.is_shutdown_requested():
            exit_code = loop.run_until_complete(
                shutdown_handler.shutdown(
                    reason=shutdown_handler.get_state().reason or ShutdownReason.NORMAL
                )
            )
        else:
            exit_code = loop.run_until_complete(
                shutdown_handler.shutdown(ShutdownReason.NORMAL)
            )

        log_shutdown_info(logger, reason=str(shutdown_handler.get_state().reason))

    except KeyboardInterrupt:
        logger.info("Interrupted by keyboard")
        exit_code = 2

    except Exception as e:
        logger.exception(f"Fatal error in sync_main: {e}")
        send_error(None, ErrorCodes.INTERNAL_ERROR, f"Plugin Host crashed: {e}")
        exit_code = 1

    finally:
        # Clean up the event loop
        try:
            loop.run_until_complete(loop.shutdown_asyncgens())
        except Exception:
            pass
        loop.close()
        logger.debug("Event loop closed")

    return exit_code


def main() -> int:
    """
    Main entry point.

    Automatically selects sync mode on Windows because ProactorEventLoop
    doesn't support async stdin reading with piped input.

    Returns:
        Exit code
    """
    # Parse arguments
    parser = argparse.ArgumentParser(
        description="Plugin Host - JSON-RPC subprocess for Tauri IPC",
        formatter_class=argparse.ArgumentDefaultsHelpFormatter
    )

    parser.add_argument(
        "--plugins-dir",
        type=str,
        default="./plugins",
        help="Path to plugins directory"
    )

    parser.add_argument(
        "--config-dir",
        type=str,
        default="./config",
        help="Path to config directory"
    )

    parser.add_argument(
        "--log-level",
        type=str,
        default="INFO",
        choices=["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"],
        help="Log level"
    )

    parser.add_argument(
        "--auto-load",
        action="store_true",
        default=False,
        help="Auto-load all valid plugins on startup"
    )

    parser.add_argument(
        "--auto-install-deps",
        action="store_true",
        default=False,
        help="Auto-install missing plugin dependencies"
    )

    parser.add_argument(
        "--sync-mode",
        action="store_true",
        default=False,
        help="Force synchronous read loop (auto-enabled on Windows)"
    )

    parser.add_argument(
        "--force-async",
        action="store_true",
        default=False,
        help="Force async mode even on Windows (may cause issues)"
    )

    parser.add_argument(
        "--version",
        action="version",
        version=f"Plugin Host v{__version__}"
    )

    args = parser.parse_args()

    # Determine mode: Windows requires sync mode unless force-async is set
    use_sync_mode = args.sync_mode or (sys.platform == "win32" and not args.force_async)

    if sys.platform == "win32" and not args.force_async:
        # Log why we're using sync mode
        # (Can't use logger yet - not configured)
        pass

    if use_sync_mode:
        # Use fully synchronous main for Windows compatibility
        return sync_main(args)

    # Use async main for Unix/Linux/macOS
    try:
        exit_code = asyncio.run(async_main(args))

    except KeyboardInterrupt:
        logger.info("Interrupted by keyboard")
        exit_code = 2

    except Exception as e:
        logger.exception(f"Fatal error in main: {e}")
        # Send error to stdout for Rust to see
        send_error(None, ErrorCodes.INTERNAL_ERROR, f"Plugin Host crashed: {e}")
        exit_code = 1

    return exit_code


if __name__ == "__main__":
    sys.exit(main())
