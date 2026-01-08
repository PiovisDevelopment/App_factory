"""
D061 - plugins/_host/test_runner.py
===================================
Plugin test runner for executing plugin tests and validation.

Provides automated testing capabilities for plugins:
- Method invocation tests
- Contract compliance verification
- Performance benchmarking
- Fixture-based test cases

Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
Protocol: JSON-RPC 2.0 over stdin/stdout

Dependencies:
    - D001: contracts/base.py (PluginBase, HealthStatus)
    - D009: config/error_codes.yaml (error codes)
    - D024: manager.py (PluginManager)
    - D026: protocol.py (JsonRpcRouter, ErrorCodes)
    - D062: config/test_fixtures.yaml (test fixtures)
"""

import asyncio
import json
import logging
import time
from collections.abc import Callable
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)


# ============================================
# TEST RESULT TYPES
# ============================================


class TestStatus(Enum):
    """Test execution status."""

    PENDING = "pending"
    RUNNING = "running"
    PASSED = "passed"
    FAILED = "failed"
    SKIPPED = "skipped"
    ERROR = "error"
    TIMEOUT = "timeout"


@dataclass
class TestResult:
    """
    Result of a single test execution.

    Attributes:
        test_id: Unique test identifier
        test_name: Human-readable test name
        status: Test execution status
        duration_ms: Execution time in milliseconds
        expected: Expected result (if applicable)
        actual: Actual result from execution
        error_message: Error message if failed/error
        error_code: JSON-RPC error code if applicable
        timestamp: When the test was executed
        metadata: Additional test metadata
    """

    test_id: str
    test_name: str
    status: TestStatus
    duration_ms: float = 0.0
    expected: Any | None = None
    actual: Any | None = None
    error_message: str | None = None
    error_code: int | None = None
    timestamp: datetime = field(default_factory=datetime.now)
    metadata: dict[str, Any] = field(default_factory=dict)

    @property
    def passed(self) -> bool:
        """Check if test passed."""
        return self.status == TestStatus.PASSED

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSON-RPC responses."""
        return {
            "test_id": self.test_id,
            "test_name": self.test_name,
            "status": self.status.value,
            "duration_ms": self.duration_ms,
            "expected": self.expected,
            "actual": self.actual,
            "error_message": self.error_message,
            "error_code": self.error_code,
            "timestamp": self.timestamp.isoformat(),
            "metadata": self.metadata,
        }


@dataclass
class TestSuiteResult:
    """
    Result of executing a test suite.

    Attributes:
        suite_name: Name of the test suite
        plugin_name: Plugin being tested
        results: Individual test results
        total_duration_ms: Total execution time
        started_at: When suite started
        finished_at: When suite finished
    """

    suite_name: str
    plugin_name: str
    results: list[TestResult] = field(default_factory=list)
    total_duration_ms: float = 0.0
    started_at: datetime | None = None
    finished_at: datetime | None = None

    @property
    def total(self) -> int:
        """Total number of tests."""
        return len(self.results)

    @property
    def passed(self) -> int:
        """Number of passed tests."""
        return sum(1 for r in self.results if r.status == TestStatus.PASSED)

    @property
    def failed(self) -> int:
        """Number of failed tests."""
        return sum(1 for r in self.results if r.status == TestStatus.FAILED)

    @property
    def errors(self) -> int:
        """Number of tests with errors."""
        return sum(1 for r in self.results if r.status == TestStatus.ERROR)

    @property
    def skipped(self) -> int:
        """Number of skipped tests."""
        return sum(1 for r in self.results if r.status == TestStatus.SKIPPED)

    @property
    def success_rate(self) -> float:
        """Success rate as percentage."""
        if self.total == 0:
            return 0.0
        return (self.passed / self.total) * 100

    @property
    def all_passed(self) -> bool:
        """Check if all tests passed."""
        return self.failed == 0 and self.errors == 0

    def to_dict(self) -> dict[str, Any]:
        """Serialize for JSON-RPC responses."""
        return {
            "suite_name": self.suite_name,
            "plugin_name": self.plugin_name,
            "summary": {
                "total": self.total,
                "passed": self.passed,
                "failed": self.failed,
                "errors": self.errors,
                "skipped": self.skipped,
                "success_rate": round(self.success_rate, 1),
                "all_passed": self.all_passed,
            },
            "total_duration_ms": self.total_duration_ms,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "results": [r.to_dict() for r in self.results],
        }


# ============================================
# TEST CASE TYPES
# ============================================


@dataclass
class TestCase:
    """
    Definition of a test case.

    Attributes:
        id: Unique test identifier
        name: Human-readable name
        description: Test description
        method: Plugin method to call
        params: Parameters to pass
        expected_result: Expected return value (optional)
        expected_error: Expected error code (optional)
        timeout_seconds: Test timeout
        skip: Whether to skip this test
        skip_reason: Reason for skipping
        tags: Test tags for filtering
    """

    id: str
    name: str
    description: str = ""
    method: str = ""
    params: dict[str, Any] = field(default_factory=dict)
    expected_result: Any | None = None
    expected_error: int | None = None
    timeout_seconds: float = 30.0
    skip: bool = False
    skip_reason: str = ""
    tags: list[str] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TestCase":
        """Create from dictionary."""
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            method=data.get("method", ""),
            params=data.get("params", {}),
            expected_result=data.get("expected_result"),
            expected_error=data.get("expected_error"),
            timeout_seconds=data.get("timeout_seconds", 30.0),
            skip=data.get("skip", False),
            skip_reason=data.get("skip_reason", ""),
            tags=data.get("tags", []),
        )


@dataclass
class TestFixture:
    """
    Test fixture definition.

    Attributes:
        name: Fixture name
        contract: Contract type this fixture is for
        description: Fixture description
        setup: Setup parameters
        teardown: Teardown parameters
        test_cases: List of test cases
    """

    name: str
    contract: str
    description: str = ""
    setup: dict[str, Any] = field(default_factory=dict)
    teardown: dict[str, Any] = field(default_factory=dict)
    test_cases: list[TestCase] = field(default_factory=list)

    @classmethod
    def from_dict(cls, data: dict[str, Any]) -> "TestFixture":
        """Create from dictionary."""
        cases = [TestCase.from_dict(tc) for tc in data.get("test_cases", [])]
        return cls(
            name=data.get("name", ""),
            contract=data.get("contract", ""),
            description=data.get("description", ""),
            setup=data.get("setup", {}),
            teardown=data.get("teardown", {}),
            test_cases=cases,
        )


# ============================================
# TEST RUNNER
# ============================================


class PluginTestRunner:
    """
    Test runner for plugin testing.

    Features:
        - Execute test cases against plugins
        - Load fixtures from YAML files
        - Contract compliance testing
        - Performance benchmarking
        - Result aggregation and reporting

    Usage:
        runner = PluginTestRunner(manager=plugin_manager)

        # Run a single test
        result = await runner.run_test(plugin_name="tts_kokoro", test_case=test)

        # Run fixture tests
        suite_result = await runner.run_fixture(plugin_name="tts_kokoro", fixture=fixture)

        # Run contract compliance
        compliance = await runner.run_contract_compliance(plugin_name="tts_kokoro")
    """

    def __init__(
        self, manager: Optional["PluginManager"] = None, config_dir: Path | None = None, default_timeout: float = 30.0
    ):
        """
        Initialize test runner.

        Args:
            manager: PluginManager for invoking methods
            config_dir: Path to config directory for fixtures
            default_timeout: Default test timeout in seconds
        """
        self.manager = manager
        self.config_dir = Path(config_dir) if config_dir else None
        self.default_timeout = default_timeout

        # Loaded fixtures
        self._fixtures: dict[str, TestFixture] = {}

        # Test history
        self._history: list[TestResult] = []
        self._max_history = 1000

        # Progress callback
        self._progress_callback: Callable[[str, int, int], None] | None = None

        logger.debug("PluginTestRunner initialized")

    def set_progress_callback(self, callback: Callable[[str, int, int], None]) -> None:
        """
        Set progress callback for test execution.

        Args:
            callback: Function(test_name, current, total)
        """
        self._progress_callback = callback

    def _report_progress(self, test_name: str, current: int, total: int) -> None:
        """Report test progress."""
        if self._progress_callback:
            try:
                self._progress_callback(test_name, current, total)
            except Exception as e:
                logger.error(f"Error in progress callback: {e}")

    def load_fixtures_from_yaml(self, yaml_path: Path) -> int:
        """
        Load test fixtures from a YAML file.

        Args:
            yaml_path: Path to YAML file

        Returns:
            Number of fixtures loaded
        """
        try:
            import yaml
        except ImportError:
            logger.warning("PyYAML not installed, cannot load fixtures")
            return 0

        try:
            with open(yaml_path, encoding="utf-8") as f:
                data = yaml.safe_load(f)
        except Exception as e:
            logger.error(f"Failed to load fixtures from {yaml_path}: {e}")
            return 0

        if not data or "fixtures" not in data:
            logger.warning(f"No fixtures found in {yaml_path}")
            return 0

        count = 0
        for fixture_data in data.get("fixtures", []):
            fixture = TestFixture.from_dict(fixture_data)
            self._fixtures[fixture.name] = fixture
            count += 1
            logger.debug(f"Loaded fixture: {fixture.name}")

        return count

    def get_fixture(self, name: str) -> TestFixture | None:
        """Get a loaded fixture by name."""
        return self._fixtures.get(name)

    def get_fixtures_for_contract(self, contract: str) -> list[TestFixture]:
        """Get all fixtures for a specific contract."""
        return [f for f in self._fixtures.values() if f.contract == contract]

    def list_fixtures(self) -> list[dict[str, Any]]:
        """List all loaded fixtures."""
        return [
            {
                "name": f.name,
                "contract": f.contract,
                "description": f.description,
                "test_count": len(f.test_cases),
            }
            for f in self._fixtures.values()
        ]

    async def _invoke_method(
        self, plugin_name: str, method: str, params: dict[str, Any], timeout: float
    ) -> tuple[bool, Any, str | None, int | None]:
        """
        Invoke a plugin method.

        Args:
            plugin_name: Plugin to invoke
            method: Method name
            params: Method parameters
            timeout: Timeout in seconds

        Returns:
            Tuple of (success, result, error_message, error_code)
        """
        if not self.manager:
            return False, None, "Plugin manager not available", None

        loaded = self.manager.get_plugin(plugin_name)
        if not loaded:
            return False, None, f"Plugin not loaded: {plugin_name}", -32000

        if not loaded.initialized:
            return False, None, f"Plugin not initialized: {plugin_name}", -32001

        # Get method from instance
        method_callable = getattr(loaded.instance, method, None)
        if method_callable is None:
            return False, None, f"Method not found: {method}", -32601

        if not callable(method_callable):
            return False, None, f"Method not callable: {method}", -32601

        try:
            # Execute with timeout
            if asyncio.iscoroutinefunction(method_callable):
                result = await asyncio.wait_for(method_callable(**params), timeout=timeout)
            else:
                # Wrap sync function in executor
                loop = asyncio.get_event_loop()
                result = await asyncio.wait_for(
                    loop.run_in_executor(None, lambda: method_callable(**params)), timeout=timeout
                )

            return True, result, None, None

        except TimeoutError:
            return False, None, f"Method timed out after {timeout}s", -32603
        except TypeError as e:
            return False, None, f"Invalid parameters: {e}", -32602
        except Exception as e:
            return False, None, f"Method error: {type(e).__name__}: {e}", -32603

    def _compare_results(self, expected: Any, actual: Any) -> tuple[bool, str]:
        """
        Compare expected and actual results.

        Args:
            expected: Expected value
            actual: Actual value

        Returns:
            Tuple of (match, message)
        """
        if expected is None:
            # No expectation, just check for any result
            return True, "No expectation set"

        # Handle special comparison types
        if isinstance(expected, dict) and "__type__" in expected:
            type_check = expected["__type__"]
            if type_check == "any":
                return True, "Any value accepted"
            elif type_check == "not_none":
                if actual is None:
                    return False, "Expected non-None value"
                return True, "Value is not None"
            elif type_check == "type":
                expected_type = expected.get("name", "object")
                actual_type = type(actual).__name__
                if actual_type == expected_type:
                    return True, f"Type matches: {expected_type}"
                return False, f"Type mismatch: expected {expected_type}, got {actual_type}"
            elif type_check == "contains":
                key = expected.get("key", "")
                if isinstance(actual, dict) and key in actual:
                    return True, f"Result contains key: {key}"
                return False, f"Result missing key: {key}"

        # Direct comparison
        if expected == actual:
            return True, "Values match"

        # JSON serialization comparison for complex objects
        try:
            expected_json = json.dumps(expected, sort_keys=True)
            actual_json = json.dumps(actual, sort_keys=True)
            if expected_json == actual_json:
                return True, "JSON representations match"
        except (TypeError, ValueError):
            pass

        return False, f"Values differ: expected {expected!r}, got {actual!r}"

    async def run_test(self, plugin_name: str, test_case: TestCase) -> TestResult:
        """
        Run a single test case against a plugin.

        Args:
            plugin_name: Plugin to test
            test_case: Test case to execute

        Returns:
            TestResult
        """
        result = TestResult(
            test_id=test_case.id,
            test_name=test_case.name,
            status=TestStatus.PENDING,
            metadata={
                "plugin": plugin_name,
                "method": test_case.method,
                "tags": test_case.tags,
            },
        )

        # Check if skipped
        if test_case.skip:
            result.status = TestStatus.SKIPPED
            result.error_message = test_case.skip_reason or "Test skipped"
            return result

        # Execute test
        result.status = TestStatus.RUNNING
        start_time = time.perf_counter()

        try:
            success, actual, error_msg, error_code = await self._invoke_method(
                plugin_name=plugin_name,
                method=test_case.method,
                params=test_case.params,
                timeout=test_case.timeout_seconds,
            )

            result.duration_ms = (time.perf_counter() - start_time) * 1000
            result.actual = actual

            if not success:
                # Check if we expected an error
                if test_case.expected_error is not None:
                    if error_code == test_case.expected_error:
                        result.status = TestStatus.PASSED
                        result.expected = f"Error code {test_case.expected_error}"
                    else:
                        result.status = TestStatus.FAILED
                        result.expected = f"Error code {test_case.expected_error}"
                        result.error_message = error_msg
                        result.error_code = error_code
                else:
                    result.status = TestStatus.ERROR
                    result.error_message = error_msg
                    result.error_code = error_code
            else:
                # Compare results
                result.expected = test_case.expected_result

                if test_case.expected_error is not None:
                    # Expected an error but got success
                    result.status = TestStatus.FAILED
                    result.error_message = f"Expected error {test_case.expected_error} but method succeeded"
                else:
                    match, compare_msg = self._compare_results(test_case.expected_result, actual)
                    if match:
                        result.status = TestStatus.PASSED
                    else:
                        result.status = TestStatus.FAILED
                        result.error_message = compare_msg

        except Exception as e:
            result.duration_ms = (time.perf_counter() - start_time) * 1000
            result.status = TestStatus.ERROR
            result.error_message = f"Test execution error: {type(e).__name__}: {e}"
            logger.exception(f"Error running test {test_case.id}")

        # Add to history
        self._history.append(result)
        if len(self._history) > self._max_history:
            self._history = self._history[-self._max_history :]

        return result

    async def run_fixture(self, plugin_name: str, fixture: TestFixture) -> TestSuiteResult:
        """
        Run all tests in a fixture against a plugin.

        Args:
            plugin_name: Plugin to test
            fixture: Fixture containing test cases

        Returns:
            TestSuiteResult
        """
        suite = TestSuiteResult(suite_name=fixture.name, plugin_name=plugin_name, started_at=datetime.now())

        start_time = time.perf_counter()
        total_tests = len(fixture.test_cases)

        logger.info(f"Running fixture '{fixture.name}' against '{plugin_name}' ({total_tests} tests)")

        for i, test_case in enumerate(fixture.test_cases):
            self._report_progress(test_case.name, i + 1, total_tests)

            result = await self.run_test(plugin_name, test_case)
            suite.results.append(result)

            status_char = "✓" if result.passed else "✗"
            logger.debug(f"  {status_char} {test_case.name} ({result.duration_ms:.1f}ms)")

        suite.total_duration_ms = (time.perf_counter() - start_time) * 1000
        suite.finished_at = datetime.now()

        logger.info(
            f"Fixture complete: {suite.passed}/{suite.total} passed "
            f"({suite.success_rate:.1f}%) in {suite.total_duration_ms:.1f}ms"
        )

        return suite

    async def run_contract_compliance(self, plugin_name: str, contract: str | None = None) -> TestSuiteResult:
        """
        Run contract compliance tests against a plugin.

        Tests that all required contract methods exist and are callable.

        Args:
            plugin_name: Plugin to test
            contract: Contract type (auto-detected if not provided)

        Returns:
            TestSuiteResult
        """
        suite = TestSuiteResult(
            suite_name=f"Contract Compliance: {plugin_name}", plugin_name=plugin_name, started_at=datetime.now()
        )

        start_time = time.perf_counter()

        if not self.manager:
            result = TestResult(
                test_id="compliance_check",
                test_name="Manager Check",
                status=TestStatus.ERROR,
                error_message="Plugin manager not available",
            )
            suite.results.append(result)
            return suite

        loaded = self.manager.get_plugin(plugin_name)
        if not loaded:
            result = TestResult(
                test_id="plugin_loaded",
                test_name="Plugin Loaded",
                status=TestStatus.ERROR,
                error_message=f"Plugin not loaded: {plugin_name}",
            )
            suite.results.append(result)
            return suite

        # Get contract type
        actual_contract = contract or loaded.manifest.contract

        # Get contract class
        contract_classes = {
            "tts": "contracts.tts_contract.TTSContract",
            "stt": "contracts.stt_contract.STTContract",
            "llm": "contracts.llm_contract.LLMContract",
        }

        contract_module_path = contract_classes.get(actual_contract)
        if not contract_module_path:
            result = TestResult(
                test_id="contract_known",
                test_name="Contract Known",
                status=TestStatus.FAILED,
                error_message=f"Unknown contract type: {actual_contract}",
            )
            suite.results.append(result)
            return suite

        # Test: Plugin loaded
        suite.results.append(
            TestResult(
                test_id="plugin_loaded",
                test_name="Plugin Loaded",
                status=TestStatus.PASSED,
                metadata={"plugin": plugin_name, "contract": actual_contract},
            )
        )

        # Test: Plugin initialized
        init_status = TestStatus.PASSED if loaded.initialized else TestStatus.FAILED
        suite.results.append(
            TestResult(
                test_id="plugin_initialized",
                test_name="Plugin Initialized",
                status=init_status,
                error_message=None if loaded.initialized else "Plugin not initialized",
            )
        )

        # Test: Health check
        try:
            health = loaded.instance.health_check()
            health_status = TestStatus.PASSED if health.status.value != "error" else TestStatus.FAILED
            suite.results.append(
                TestResult(
                    test_id="health_check",
                    test_name="Health Check",
                    status=health_status,
                    actual={"status": health.status.value, "message": health.message},
                )
            )
        except Exception as e:
            suite.results.append(
                TestResult(
                    test_id="health_check", test_name="Health Check", status=TestStatus.ERROR, error_message=str(e)
                )
            )

        # Test: Required methods exist
        required_methods = {
            "tts": ["synthesize", "get_voices"],
            "stt": ["transcribe", "get_languages"],
            "llm": ["complete", "get_models"],
        }

        methods = required_methods.get(actual_contract, [])
        for method_name in methods:
            method = getattr(loaded.instance, method_name, None)
            if method is None:
                suite.results.append(
                    TestResult(
                        test_id=f"method_{method_name}_exists",
                        test_name=f"Method Exists: {method_name}",
                        status=TestStatus.FAILED,
                        error_message=f"Method not found: {method_name}",
                    )
                )
            elif not callable(method):
                suite.results.append(
                    TestResult(
                        test_id=f"method_{method_name}_callable",
                        test_name=f"Method Callable: {method_name}",
                        status=TestStatus.FAILED,
                        error_message=f"Method not callable: {method_name}",
                    )
                )
            else:
                suite.results.append(
                    TestResult(
                        test_id=f"method_{method_name}", test_name=f"Method: {method_name}", status=TestStatus.PASSED
                    )
                )

        suite.total_duration_ms = (time.perf_counter() - start_time) * 1000
        suite.finished_at = datetime.now()

        return suite

    async def benchmark_method(
        self, plugin_name: str, method: str, params: dict[str, Any], iterations: int = 10, warmup: int = 2
    ) -> dict[str, Any]:
        """
        Benchmark a plugin method.

        Args:
            plugin_name: Plugin to test
            method: Method to benchmark
            params: Method parameters
            iterations: Number of test iterations
            warmup: Number of warmup iterations

        Returns:
            Benchmark results
        """
        times: list[float] = []
        errors: list[str] = []

        # Warmup
        for _ in range(warmup):
            await self._invoke_method(plugin_name, method, params, self.default_timeout)

        # Benchmark
        for i in range(iterations):
            start = time.perf_counter()
            success, result, error, code = await self._invoke_method(plugin_name, method, params, self.default_timeout)
            elapsed = (time.perf_counter() - start) * 1000

            if success:
                times.append(elapsed)
            else:
                errors.append(error or "Unknown error")

        if not times:
            return {
                "plugin": plugin_name,
                "method": method,
                "iterations": iterations,
                "success_count": 0,
                "error_count": len(errors),
                "errors": errors[:5],
            }

        times.sort()
        return {
            "plugin": plugin_name,
            "method": method,
            "iterations": iterations,
            "success_count": len(times),
            "error_count": len(errors),
            "min_ms": round(times[0], 2),
            "max_ms": round(times[-1], 2),
            "mean_ms": round(sum(times) / len(times), 2),
            "median_ms": round(times[len(times) // 2], 2),
            "p95_ms": round(times[int(len(times) * 0.95)], 2) if len(times) >= 20 else None,
            "p99_ms": round(times[int(len(times) * 0.99)], 2) if len(times) >= 100 else None,
        }

    def get_history(
        self, limit: int = 100, plugin_name: str | None = None, status: TestStatus | None = None
    ) -> list[TestResult]:
        """
        Get test history.

        Args:
            limit: Maximum results to return
            plugin_name: Filter by plugin
            status: Filter by status

        Returns:
            List of TestResult
        """
        results = self._history

        if plugin_name:
            results = [r for r in results if r.metadata.get("plugin") == plugin_name]

        if status:
            results = [r for r in results if r.status == status]

        return results[-limit:]

    def clear_history(self) -> int:
        """Clear test history. Returns number of items cleared."""
        count = len(self._history)
        self._history = []
        return count


# Type hints for lazy imports
PluginManager = Any  # From manager.py
