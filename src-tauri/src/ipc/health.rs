//! D034 - src-tauri/src/ipc/health.rs
//! ===================================
//! Health monitoring for Python subprocess.

// Allow dead code - these are library types for external use
#![allow(dead_code)]
//!
//! Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
//! Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)
//!
//! This module provides:
//! - HealthMonitor for periodic health checks
//! - HealthStatus tracking with history
//! - SubprocessState enum for lifecycle tracking
//! - Automatic crash detection and recovery signaling
//!
//! Dependencies:
//!     - D030: mod.rs (IpcError, constants)
//!     - D031: request.rs (RequestBuilder)
//!
//! Usage:
//!     ```rust
//!     use crate::ipc::health::{HealthMonitor, HealthStatus};
//!
//!     let monitor = HealthMonitor::new(Duration::from_secs(30));
//!
//!     // Record health check result
//!     monitor.record_success(Duration::from_millis(50));
//!
//!     // Get current status
//!     let status = monitor.status();
//!     println!("Healthy: {}, Latency: {:?}", status.is_healthy, status.last_latency);
//!     ```

use serde::{Deserialize, Serialize};
use std::collections::VecDeque;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, RwLock};
use std::time::{Duration, Instant};

use super::{HEALTH_CHECK_INTERVAL_SECS, MAX_RESPAWN_ATTEMPTS};

// ============================================
// SUBPROCESS STATE
// ============================================

/// Current state of the Python subprocess.
///
/// Tracks the lifecycle from spawn to shutdown/crash.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum SubprocessState {
    /// Subprocess not yet started
    NotStarted,
    /// Subprocess is starting up
    Starting,
    /// Subprocess is running and healthy
    Running,
    /// Subprocess is degraded (health checks failing)
    Degraded,
    /// Subprocess is being restarted
    Restarting,
    /// Subprocess is shutting down gracefully
    ShuttingDown,
    /// Subprocess has stopped normally
    Stopped,
    /// Subprocess crashed unexpectedly
    Crashed,
    /// Subprocess was killed forcefully
    Killed,
}

impl SubprocessState {
    /// Check if subprocess is in a running state (Running or Degraded).
    pub fn is_running(&self) -> bool {
        matches!(self, SubprocessState::Running | SubprocessState::Degraded)
    }

    /// Check if subprocess is in a terminal state.
    pub fn is_terminal(&self) -> bool {
        matches!(
            self,
            SubprocessState::Stopped | SubprocessState::Crashed | SubprocessState::Killed
        )
    }

    /// Check if subprocess can accept requests.
    pub fn can_accept_requests(&self) -> bool {
        matches!(self, SubprocessState::Running | SubprocessState::Degraded)
    }

    /// Check if subprocess needs respawn.
    pub fn needs_respawn(&self) -> bool {
        matches!(self, SubprocessState::Crashed)
    }
}

impl std::fmt::Display for SubprocessState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            SubprocessState::NotStarted => write!(f, "NOT_STARTED"),
            SubprocessState::Starting => write!(f, "STARTING"),
            SubprocessState::Running => write!(f, "RUNNING"),
            SubprocessState::Degraded => write!(f, "DEGRADED"),
            SubprocessState::Restarting => write!(f, "RESTARTING"),
            SubprocessState::ShuttingDown => write!(f, "SHUTTING_DOWN"),
            SubprocessState::Stopped => write!(f, "STOPPED"),
            SubprocessState::Crashed => write!(f, "CRASHED"),
            SubprocessState::Killed => write!(f, "KILLED"),
        }
    }
}

// ============================================
// HEALTH CHECK RESULT
// ============================================

/// Result of a single health check.
#[derive(Debug, Clone, Serialize)]
pub struct HealthCheckResult {
    /// Timestamp of the check
    pub timestamp: u64,
    /// Whether the check succeeded
    pub success: bool,
    /// Response latency (if successful)
    pub latency_ms: Option<u64>,
    /// Error message (if failed)
    pub error: Option<String>,
}

impl HealthCheckResult {
    /// Create a successful health check result.
    pub fn success(latency: Duration) -> Self {
        Self {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            success: true,
            latency_ms: Some(latency.as_millis() as u64),
            error: None,
        }
    }

    /// Create a failed health check result.
    pub fn failure(error: impl Into<String>) -> Self {
        Self {
            timestamp: std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs(),
            success: false,
            latency_ms: None,
            error: Some(error.into()),
        }
    }
}

// ============================================
// HEALTH STATUS
// ============================================

/// Current health status of the subprocess.
#[derive(Debug, Clone, Serialize)]
pub struct HealthStatus {
    /// Current subprocess state
    pub state: SubprocessState,
    /// Is the subprocess considered healthy
    pub is_healthy: bool,
    /// Last successful health check timestamp
    pub last_success_time: Option<u64>,
    /// Last health check latency in milliseconds
    pub last_latency_ms: Option<u64>,
    /// Consecutive failure count
    pub consecutive_failures: u32,
    /// Total successful checks
    pub total_successes: u64,
    /// Total failed checks
    pub total_failures: u64,
    /// Average latency in milliseconds
    pub avg_latency_ms: Option<u64>,
    /// Subprocess uptime in seconds
    pub uptime_secs: Option<u64>,
    /// Current respawn attempt count
    pub respawn_attempts: u32,
}

impl Default for HealthStatus {
    fn default() -> Self {
        Self {
            state: SubprocessState::NotStarted,
            is_healthy: false,
            last_success_time: None,
            last_latency_ms: None,
            consecutive_failures: 0,
            total_successes: 0,
            total_failures: 0,
            avg_latency_ms: None,
            uptime_secs: None,
            respawn_attempts: 0,
        }
    }
}

// ============================================
// HEALTH MONITOR
// ============================================

/// Health monitor for the Python subprocess.
///
/// Tracks health check results, detects degradation,
/// and provides status information.
///
/// # Example
///
/// ```rust
/// let monitor = HealthMonitor::new(Duration::from_secs(30));
///
/// // Start monitoring
/// monitor.set_state(SubprocessState::Running);
///
/// // Record health check results
/// monitor.record_success(Duration::from_millis(50));
/// monitor.record_failure("Connection timeout");
///
/// // Get current status
/// let status = monitor.status();
/// ```
pub struct HealthMonitor {
    /// Current subprocess state
    state: Arc<RwLock<SubprocessState>>,

    /// Health check interval
    check_interval: Duration,

    /// Maximum consecutive failures before marking degraded
    max_consecutive_failures: u32,

    /// Is currently healthy
    is_healthy: AtomicBool,

    /// Consecutive failure count
    consecutive_failures: AtomicU64,

    /// Total successful checks
    total_successes: AtomicU64,

    /// Total failed checks
    total_failures: AtomicU64,

    /// Recent health check results (ring buffer)
    recent_results: Arc<RwLock<VecDeque<HealthCheckResult>>>,

    /// Maximum results to keep in history
    max_history: usize,

    /// Last successful check timestamp
    last_success_time: Arc<RwLock<Option<Instant>>>,

    /// Last latency measurement
    last_latency: Arc<RwLock<Option<Duration>>>,

    /// Subprocess start time
    start_time: Arc<RwLock<Option<Instant>>>,

    /// Respawn attempt counter
    respawn_attempts: AtomicU64,
}

impl HealthMonitor {
    /// Create a new health monitor with the specified check interval.
    ///
    /// # Arguments
    ///
    /// * `check_interval` - Interval between health checks
    ///
    /// # Example
    ///
    /// ```rust
    /// let monitor = HealthMonitor::new(Duration::from_secs(30));
    /// ```
    pub fn new(check_interval: Duration) -> Self {
        Self {
            state: Arc::new(RwLock::new(SubprocessState::NotStarted)),
            check_interval,
            max_consecutive_failures: 3,
            is_healthy: AtomicBool::new(false),
            consecutive_failures: AtomicU64::new(0),
            total_successes: AtomicU64::new(0),
            total_failures: AtomicU64::new(0),
            recent_results: Arc::new(RwLock::new(VecDeque::with_capacity(100))),
            max_history: 100,
            last_success_time: Arc::new(RwLock::new(None)),
            last_latency: Arc::new(RwLock::new(None)),
            start_time: Arc::new(RwLock::new(None)),
            respawn_attempts: AtomicU64::new(0),
        }
    }

    /// Create a health monitor with default settings.
    pub fn with_defaults() -> Self {
        Self::new(Duration::from_secs(HEALTH_CHECK_INTERVAL_SECS))
    }

    /// Set maximum consecutive failures before marking degraded.
    pub fn with_max_failures(mut self, max: u32) -> Self {
        self.max_consecutive_failures = max;
        self
    }

    /// Set maximum history size.
    pub fn with_max_history(mut self, max: usize) -> Self {
        self.max_history = max;
        self
    }

    /// Get current subprocess state.
    pub fn state(&self) -> SubprocessState {
        *self.state.read().unwrap()
    }

    /// Set subprocess state.
    pub fn set_state(&self, state: SubprocessState) {
        let mut guard = self.state.write().unwrap();
        let old_state = *guard;
        *guard = state;

        log::info!("Subprocess state: {} -> {}", old_state, state);

        // Update health based on state
        match state {
            SubprocessState::Running => {
                self.is_healthy.store(true, Ordering::SeqCst);
                if old_state == SubprocessState::Starting {
                    *self.start_time.write().unwrap() = Some(Instant::now());
                }
            }
            SubprocessState::Degraded => {
                self.is_healthy.store(false, Ordering::SeqCst);
            }
            SubprocessState::Crashed | SubprocessState::Killed => {
                self.is_healthy.store(false, Ordering::SeqCst);
            }
            SubprocessState::Starting => {
                self.reset();
            }
            _ => {}
        }
    }

    /// Check if subprocess is healthy.
    pub fn is_healthy(&self) -> bool {
        self.is_healthy.load(Ordering::SeqCst)
    }

    /// Get health check interval.
    pub fn check_interval(&self) -> Duration {
        self.check_interval
    }

    /// Record a successful health check.
    ///
    /// # Arguments
    ///
    /// * `latency` - Response latency
    pub fn record_success(&self, latency: Duration) {
        self.total_successes.fetch_add(1, Ordering::SeqCst);
        self.consecutive_failures.store(0, Ordering::SeqCst);
        self.is_healthy.store(true, Ordering::SeqCst);

        *self.last_latency.write().unwrap() = Some(latency);
        *self.last_success_time.write().unwrap() = Some(Instant::now());

        // Add to history
        let result = HealthCheckResult::success(latency);
        self.add_to_history(result);

        // Ensure state is Running if was Degraded
        let current_state = self.state();
        if current_state == SubprocessState::Degraded {
            self.set_state(SubprocessState::Running);
        }

        log::debug!("Health check success: latency={:?}", latency);
    }

    /// Record a failed health check.
    ///
    /// # Arguments
    ///
    /// * `error` - Error message
    pub fn record_failure(&self, error: impl Into<String>) {
        let error = error.into();
        self.total_failures.fetch_add(1, Ordering::SeqCst);
        let failures = self.consecutive_failures.fetch_add(1, Ordering::SeqCst) + 1;

        // Add to history
        let result = HealthCheckResult::failure(&error);
        self.add_to_history(result);

        log::warn!("Health check failure #{}: {}", failures, error);

        // Check if we should mark as degraded
        if failures >= self.max_consecutive_failures as u64 {
            self.is_healthy.store(false, Ordering::SeqCst);
            let current_state = self.state();
            if current_state == SubprocessState::Running {
                self.set_state(SubprocessState::Degraded);
            }
        }
    }

    /// Add result to history ring buffer.
    fn add_to_history(&self, result: HealthCheckResult) {
        let mut history = self.recent_results.write().unwrap();
        if history.len() >= self.max_history {
            history.pop_front();
        }
        history.push_back(result);
    }

    /// Get current health status.
    pub fn status(&self) -> HealthStatus {
        let uptime = self
            .start_time
            .read()
            .unwrap()
            .map(|t| t.elapsed().as_secs());

        let last_success = self.last_success_time.read().unwrap().map(|t| {
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap_or_default()
                .as_secs()
                - t.elapsed().as_secs()
        });

        let last_latency = self
            .last_latency
            .read()
            .unwrap()
            .map(|d| d.as_millis() as u64);

        let avg_latency = self.calculate_avg_latency();

        HealthStatus {
            state: self.state(),
            is_healthy: self.is_healthy(),
            last_success_time: last_success,
            last_latency_ms: last_latency,
            consecutive_failures: self.consecutive_failures.load(Ordering::SeqCst) as u32,
            total_successes: self.total_successes.load(Ordering::SeqCst),
            total_failures: self.total_failures.load(Ordering::SeqCst),
            avg_latency_ms: avg_latency,
            uptime_secs: uptime,
            respawn_attempts: self.respawn_attempts.load(Ordering::SeqCst) as u32,
        }
    }

    /// Calculate average latency from recent results.
    fn calculate_avg_latency(&self) -> Option<u64> {
        let history = self.recent_results.read().unwrap();
        let latencies: Vec<u64> = history
            .iter()
            .filter_map(|r| r.latency_ms)
            .collect();

        if latencies.is_empty() {
            None
        } else {
            Some(latencies.iter().sum::<u64>() / latencies.len() as u64)
        }
    }

    /// Get recent health check results.
    pub fn recent_results(&self) -> Vec<HealthCheckResult> {
        self.recent_results.read().unwrap().iter().cloned().collect()
    }

    /// Increment respawn attempt counter.
    pub fn increment_respawn(&self) -> u32 {
        let attempts = self.respawn_attempts.fetch_add(1, Ordering::SeqCst) + 1;
        log::info!("Respawn attempt: {}/{}", attempts, MAX_RESPAWN_ATTEMPTS);
        attempts as u32
    }

    /// Reset respawn counter.
    pub fn reset_respawn_counter(&self) {
        self.respawn_attempts.store(0, Ordering::SeqCst);
    }

    /// Check if max respawn attempts exceeded.
    pub fn respawn_limit_exceeded(&self) -> bool {
        self.respawn_attempts.load(Ordering::SeqCst) >= MAX_RESPAWN_ATTEMPTS as u64
    }

    /// Reset all counters (typically on fresh start).
    pub fn reset(&self) {
        self.is_healthy.store(false, Ordering::SeqCst);
        self.consecutive_failures.store(0, Ordering::SeqCst);
        self.total_successes.store(0, Ordering::SeqCst);
        self.total_failures.store(0, Ordering::SeqCst);
        self.recent_results.write().unwrap().clear();
        *self.last_success_time.write().unwrap() = None;
        *self.last_latency.write().unwrap() = None;
        *self.start_time.write().unwrap() = None;
    }

    /// Mark subprocess as started.
    pub fn mark_started(&self) {
        *self.start_time.write().unwrap() = Some(Instant::now());
        self.set_state(SubprocessState::Running);
    }

    /// Mark subprocess as crashed.
    pub fn mark_crashed(&self, error: impl Into<String>) {
        let error = error.into();
        log::error!("Subprocess crashed: {}", error);
        self.set_state(SubprocessState::Crashed);
        self.record_failure(error);
    }

    /// Get uptime duration.
    pub fn uptime(&self) -> Option<Duration> {
        self.start_time.read().unwrap().map(|t| t.elapsed())
    }

    /// Check if enough time has passed for next health check.
    pub fn should_check(&self) -> bool {
        match *self.last_success_time.read().unwrap() {
            Some(t) => t.elapsed() >= self.check_interval,
            None => true,
        }
    }
}

impl Default for HealthMonitor {
    fn default() -> Self {
        Self::with_defaults()
    }
}

// ============================================
// TESTS
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subprocess_state() {
        assert!(SubprocessState::Running.is_running());
        assert!(SubprocessState::Degraded.is_running());
        assert!(!SubprocessState::Stopped.is_running());

        assert!(SubprocessState::Stopped.is_terminal());
        assert!(SubprocessState::Crashed.is_terminal());
        assert!(!SubprocessState::Running.is_terminal());

        assert!(SubprocessState::Running.can_accept_requests());
        assert!(!SubprocessState::ShuttingDown.can_accept_requests());

        assert!(SubprocessState::Crashed.needs_respawn());
        assert!(!SubprocessState::Stopped.needs_respawn());
    }

    #[test]
    fn test_health_check_result() {
        let success = HealthCheckResult::success(Duration::from_millis(50));
        assert!(success.success);
        assert_eq!(success.latency_ms, Some(50));
        assert!(success.error.is_none());

        let failure = HealthCheckResult::failure("Timeout");
        assert!(!failure.success);
        assert!(failure.latency_ms.is_none());
        assert_eq!(failure.error, Some("Timeout".to_string()));
    }

    #[test]
    fn test_health_monitor_basic() {
        let monitor = HealthMonitor::new(Duration::from_secs(30));

        assert!(!monitor.is_healthy());
        assert_eq!(monitor.state(), SubprocessState::NotStarted);

        monitor.set_state(SubprocessState::Running);
        assert!(monitor.is_healthy());
        assert_eq!(monitor.state(), SubprocessState::Running);
    }

    #[test]
    fn test_health_monitor_success() {
        let monitor = HealthMonitor::new(Duration::from_secs(30));
        monitor.set_state(SubprocessState::Running);

        monitor.record_success(Duration::from_millis(50));
        monitor.record_success(Duration::from_millis(60));

        let status = monitor.status();
        assert_eq!(status.total_successes, 2);
        assert_eq!(status.consecutive_failures, 0);
        assert!(status.is_healthy);
    }

    #[test]
    fn test_health_monitor_failure() {
        let monitor = HealthMonitor::new(Duration::from_secs(30))
            .with_max_failures(2);
        monitor.set_state(SubprocessState::Running);

        monitor.record_failure("Error 1");
        assert!(monitor.is_healthy()); // Still healthy after 1 failure

        monitor.record_failure("Error 2");
        assert!(!monitor.is_healthy()); // Degraded after 2 failures
        assert_eq!(monitor.state(), SubprocessState::Degraded);
    }

    #[test]
    fn test_health_monitor_recovery() {
        let monitor = HealthMonitor::new(Duration::from_secs(30))
            .with_max_failures(1);
        monitor.set_state(SubprocessState::Running);

        monitor.record_failure("Error");
        assert!(!monitor.is_healthy());
        assert_eq!(monitor.state(), SubprocessState::Degraded);

        monitor.record_success(Duration::from_millis(50));
        assert!(monitor.is_healthy());
        assert_eq!(monitor.state(), SubprocessState::Running);
    }

    #[test]
    fn test_health_monitor_history() {
        let monitor = HealthMonitor::new(Duration::from_secs(30))
            .with_max_history(5);
        monitor.set_state(SubprocessState::Running);

        for i in 0..10 {
            monitor.record_success(Duration::from_millis(i * 10));
        }

        let results = monitor.recent_results();
        assert_eq!(results.len(), 5); // Max history is 5
    }

    #[test]
    fn test_respawn_counter() {
        let monitor = HealthMonitor::new(Duration::from_secs(30));

        assert_eq!(monitor.increment_respawn(), 1);
        assert_eq!(monitor.increment_respawn(), 2);
        assert_eq!(monitor.increment_respawn(), 3);
        assert!(monitor.respawn_limit_exceeded());

        monitor.reset_respawn_counter();
        assert!(!monitor.respawn_limit_exceeded());
    }
}
