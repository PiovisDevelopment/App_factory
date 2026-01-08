//! D035 - src-tauri/src/ipc/manager.rs
//! ====================================
//! High-level IPC Manager coordinating subprocess lifecycle.

// Allow dead code - these are library types for external use
#![allow(dead_code)]
//!
//! Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
//! Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)
//!
//! This module provides:
//! - `IpcConfig` for manager configuration
//! - `IpcManagerState` for Tauri state management
//! - `LifecycleState` enum for manager lifecycle
//! - `ManagerStats` for statistics reporting
//! - Coordination between spawn, health, and request handling
//!
//! Dependencies:
//!     - D033: spawn.rs (`SubprocessConfig`, `spawn_plugin_host`)
//!     - D034: health.rs (`HealthMonitor`, `HealthStatus`)
//!
//! Usage:
//!     ```rust
//!     use crate::ipc::manager::{IpcConfig, IpcManagerState};
//!
//!     let config = IpcConfig::default();
//!     let state = IpcManagerState::new(config);
//!
//!     state.start().await?;
//!     let result = state.call("ping", json!({})).await?;
//!     state.shutdown().await?;
//!     ```

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::ChildStdin;
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::{Arc, Mutex};
use std::thread::JoinHandle;
use std::time::{Duration, Instant};
use tokio::sync::{mpsc, oneshot, RwLock};

use super::health::{HealthMonitor, HealthStatus, SubprocessState};
use super::request::{JsonRpcRequest, RequestBuilder};
use super::response::JsonRpcResponse;
use super::spawn::{spawn_plugin_host, SubprocessConfig, SubprocessHandle};
use super::{IpcError, DEFAULT_TIMEOUT_SECS, HEALTH_CHECK_INTERVAL_SECS};

// ============================================
// LIFECYCLE STATE
// ============================================

/// Lifecycle state of the IPC Manager.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "SCREAMING_SNAKE_CASE")]
pub enum LifecycleState {
    /// Manager not initialized
    Uninitialized,
    /// Manager is starting up
    Starting,
    /// Manager is running and ready
    Ready,
    /// Manager is degraded but operational
    Degraded,
    /// Manager is shutting down
    ShuttingDown,
    /// Manager has stopped
    Stopped,
    /// Manager encountered fatal error
    Failed,
}

impl LifecycleState {
    /// Check if manager can accept requests.
    pub fn can_accept_requests(&self) -> bool {
        matches!(self, LifecycleState::Ready | LifecycleState::Degraded)
    }

    /// Check if manager is in terminal state.
    pub fn is_terminal(&self) -> bool {
        matches!(self, LifecycleState::Stopped | LifecycleState::Failed)
    }
}

impl std::fmt::Display for LifecycleState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            LifecycleState::Uninitialized => write!(f, "UNINITIALIZED"),
            LifecycleState::Starting => write!(f, "STARTING"),
            LifecycleState::Ready => write!(f, "READY"),
            LifecycleState::Degraded => write!(f, "DEGRADED"),
            LifecycleState::ShuttingDown => write!(f, "SHUTTING_DOWN"),
            LifecycleState::Stopped => write!(f, "STOPPED"),
            LifecycleState::Failed => write!(f, "FAILED"),
        }
    }
}

// ============================================
// IPC CONFIGURATION
// ============================================

/// Configuration for the IPC Manager.
#[derive(Debug, Clone)]
pub struct IpcConfig {
    /// Python executable path
    pub python_path: String,
    /// Plugin host module path
    pub module_path: String,
    /// Working directory
    pub working_dir: Option<PathBuf>,
    /// Request timeout in seconds
    pub timeout_secs: u64,
    /// Health check interval in seconds
    pub health_check_interval_secs: u64,
    /// Auto-respawn on crash
    pub auto_respawn: bool,
    /// Maximum respawn attempts
    pub max_respawn_attempts: u32,
    /// Enable verbose logging
    pub verbose: bool,
}

impl Default for IpcConfig {
    fn default() -> Self {
        Self {
            python_path: "python".to_string(),
            module_path: "plugins._host".to_string(),
            working_dir: None,
            timeout_secs: DEFAULT_TIMEOUT_SECS,
            health_check_interval_secs: HEALTH_CHECK_INTERVAL_SECS,
            auto_respawn: true,
            max_respawn_attempts: 3,
            verbose: false,
        }
    }
}

impl IpcConfig {
    /// Create a new configuration with default values.
    pub fn new() -> Self {
        Self::default()
    }

    /// Set Python path.
    pub fn with_python_path(mut self, path: impl Into<String>) -> Self {
        self.python_path = path.into();
        self
    }

    /// Set module path.
    pub fn with_module_path(mut self, path: impl Into<String>) -> Self {
        self.module_path = path.into();
        self
    }

    /// Set working directory.
    pub fn with_working_dir(mut self, dir: impl Into<PathBuf>) -> Self {
        self.working_dir = Some(dir.into());
        self
    }

    /// Set request timeout.
    pub fn with_timeout(mut self, secs: u64) -> Self {
        self.timeout_secs = secs;
        self
    }

    /// Enable/disable auto-respawn.
    pub fn with_auto_respawn(mut self, enabled: bool) -> Self {
        self.auto_respawn = enabled;
        self
    }

    /// Convert to `SubprocessConfig`.
    pub fn to_subprocess_config(&self) -> SubprocessConfig {
        let mut config = SubprocessConfig::new()
            .with_python_path(&self.python_path)
            .with_module(&self.module_path)
            .with_shutdown_timeout(self.timeout_secs)
            .with_max_respawn_attempts(self.max_respawn_attempts)
            .with_verbose(self.verbose);

        if let Some(ref dir) = self.working_dir {
            config = config.with_working_dir(dir);
        }

        config
    }
}

// ============================================
// MANAGER STATISTICS
// ============================================

/// Statistics for the IPC Manager.
#[derive(Debug, Clone, Serialize)]
pub struct ManagerStats {
    /// Current lifecycle state
    pub lifecycle_state: LifecycleState,
    /// Subprocess health status
    pub health_status: HealthStatus,
    /// Total requests sent
    pub total_requests: u64,
    /// Total successful requests
    pub successful_requests: u64,
    /// Total failed requests
    pub failed_requests: u64,
    /// Current pending request count
    pub pending_requests: usize,
    /// Manager uptime in seconds
    pub uptime_secs: Option<u64>,
    /// Subprocess PID
    pub subprocess_pid: Option<u32>,
}

// ============================================
// PENDING REQUEST
// ============================================

/// Pending request tracking.
type PendingRequests = Arc<RwLock<std::collections::HashMap<u64, oneshot::Sender<Result<JsonRpcResponse, IpcError>>>>>;

/// Writer message type.
#[derive(Debug)]
enum WriterMessage {
    Request(String),
    Shutdown,
}

// ============================================
// IPC MANAGER STATE
// ============================================

/// Main IPC Manager state for Tauri.
///
/// This struct is designed to be stored in Tauri's managed state
/// and provides thread-safe access to the subprocess.
///
/// # Example
///
/// ```rust
/// // In Tauri setup
/// let config = IpcConfig::default();
/// let state = IpcManagerState::new(config);
/// app.manage(state);
///
/// // In command handler
/// #[tauri::command]
/// async fn call_plugin(state: State<'_, IpcManagerState>) -> Result<Value, String> {
///     state.call("plugin/list", json!({})).await.map_err(|e| e.to_string())
/// }
/// ```
pub struct IpcManagerState {
    /// Configuration
    config: IpcConfig,

    /// Current lifecycle state
    lifecycle: Arc<RwLock<LifecycleState>>,

    /// Health monitor
    health: Arc<HealthMonitor>,

    /// Subprocess handle
    subprocess: Arc<Mutex<Option<SubprocessHandle>>>,

    /// Writer channel
    writer_tx: Arc<RwLock<Option<mpsc::Sender<WriterMessage>>>>,

    /// Pending requests
    pending: PendingRequests,

    /// Next request ID
    next_id: AtomicU64,

    /// Is shutting down
    is_shutting_down: AtomicBool,

    /// Start time
    start_time: Arc<RwLock<Option<Instant>>>,

    /// Total requests
    total_requests: AtomicU64,

    /// Successful requests
    successful_requests: AtomicU64,

    /// Failed requests
    failed_requests: AtomicU64,

    /// Reader thread handle
    reader_handle: Arc<Mutex<Option<JoinHandle<()>>>>,

    /// Writer thread handle
    writer_handle: Arc<Mutex<Option<JoinHandle<()>>>>,

    /// Stderr thread handle
    stderr_handle: Arc<Mutex<Option<JoinHandle<()>>>>,
}

impl Clone for IpcManagerState {
    fn clone(&self) -> Self {
        Self {
            config: self.config.clone(),
            lifecycle: Arc::clone(&self.lifecycle),
            health: Arc::clone(&self.health),
            subprocess: Arc::clone(&self.subprocess),
            writer_tx: Arc::clone(&self.writer_tx),
            pending: Arc::clone(&self.pending),
            next_id: AtomicU64::new(self.next_id.load(Ordering::SeqCst)),
            is_shutting_down: AtomicBool::new(self.is_shutting_down.load(Ordering::SeqCst)),
            start_time: Arc::clone(&self.start_time),
            total_requests: AtomicU64::new(self.total_requests.load(Ordering::SeqCst)),
            successful_requests: AtomicU64::new(self.successful_requests.load(Ordering::SeqCst)),
            failed_requests: AtomicU64::new(self.failed_requests.load(Ordering::SeqCst)),
            reader_handle: Arc::clone(&self.reader_handle),
            writer_handle: Arc::clone(&self.writer_handle),
            stderr_handle: Arc::clone(&self.stderr_handle),
        }
    }
}

impl IpcManagerState {
    /// Create a new IPC Manager with the specified configuration.
    pub fn new(config: IpcConfig) -> Self {
        let health_interval = Duration::from_secs(config.health_check_interval_secs);

        Self {
            config,
            lifecycle: Arc::new(RwLock::new(LifecycleState::Uninitialized)),
            health: Arc::new(HealthMonitor::new(health_interval)),
            subprocess: Arc::new(Mutex::new(None)),
            writer_tx: Arc::new(RwLock::new(None)),
            pending: Arc::new(RwLock::new(std::collections::HashMap::new())),
            next_id: AtomicU64::new(1),
            is_shutting_down: AtomicBool::new(false),
            start_time: Arc::new(RwLock::new(None)),
            total_requests: AtomicU64::new(0),
            successful_requests: AtomicU64::new(0),
            failed_requests: AtomicU64::new(0),
            reader_handle: Arc::new(Mutex::new(None)),
            writer_handle: Arc::new(Mutex::new(None)),
            stderr_handle: Arc::new(Mutex::new(None)),
        }
    }

    /// Create with default configuration.
    pub fn with_defaults() -> Self {
        Self::new(IpcConfig::default())
    }

    /// Get current lifecycle state.
    pub async fn lifecycle_state(&self) -> LifecycleState {
        *self.lifecycle.read().await
    }

    /// Set lifecycle state.
    async fn set_lifecycle(&self, state: LifecycleState) {
        let mut guard = self.lifecycle.write().await;
        let old = *guard;
        *guard = state;
        log::info!("IPC Manager lifecycle: {old} -> {state}");
    }

    /// Get health monitor.
    pub fn health(&self) -> &HealthMonitor {
        &self.health
    }

    /// Get configuration.
    pub fn config(&self) -> &IpcConfig {
        &self.config
    }

    /// Check if manager is ready.
    pub async fn is_ready(&self) -> bool {
        self.lifecycle_state().await.can_accept_requests()
    }

    /// Start the IPC Manager.
    ///
    /// Spawns the Python subprocess and starts reader/writer threads.
    pub async fn start(&self) -> Result<(), IpcError> {
        let current = self.lifecycle_state().await;
        if current != LifecycleState::Uninitialized && current != LifecycleState::Stopped {
            log::warn!("Cannot start from state: {current}");
            return Err(IpcError::SpawnError(format!(
                "Cannot start from state: {current}"
            )));
        }

        self.set_lifecycle(LifecycleState::Starting).await;
        self.health.set_state(SubprocessState::Starting);

        // Spawn subprocess
        let subprocess_config = self.config.to_subprocess_config();
        let mut handle = spawn_plugin_host(subprocess_config)?;

        let pid = handle.pid;
        log::info!("Subprocess started with PID: {pid}");

        // Take stdio handles
        let stdin = handle
            .take_stdin()
            .ok_or_else(|| IpcError::SpawnError("Failed to get stdin".to_string()))?;
        let stdout = handle
            .take_stdout()
            .ok_or_else(|| IpcError::SpawnError("Failed to get stdout".to_string()))?;
        let stderr = handle
            .take_stderr()
            .ok_or_else(|| IpcError::SpawnError("Failed to get stderr".to_string()))?;

        // Create writer channel
        let (writer_tx, writer_rx) = mpsc::channel::<WriterMessage>(100);
        *self.writer_tx.write().await = Some(writer_tx);

        // Start writer thread
        let writer_handle = std::thread::Builder::new()
            .name("ipc-writer".to_string())
            .spawn(move || {
                Self::writer_task(stdin, writer_rx);
            })
            .map_err(|e| IpcError::SpawnError(e.to_string()))?;

        // Start reader thread
        let pending_clone = Arc::clone(&self.pending);
        let health_clone = Arc::clone(&self.health);
        let reader_handle = std::thread::Builder::new()
            .name("ipc-reader".to_string())
            .spawn(move || {
                Self::reader_task(stdout, pending_clone, health_clone);
            })
            .map_err(|e| IpcError::SpawnError(e.to_string()))?;

        // Start stderr thread
        let stderr_handle = std::thread::Builder::new()
            .name("ipc-stderr".to_string())
            .spawn(move || {
                Self::stderr_task(stderr);
            })
            .map_err(|e| IpcError::SpawnError(e.to_string()))?;

        // Store handles
        *self.subprocess.lock().unwrap() = Some(handle);
        *self.reader_handle.lock().unwrap() = Some(reader_handle);
        *self.writer_handle.lock().unwrap() = Some(writer_handle);
        *self.stderr_handle.lock().unwrap() = Some(stderr_handle);

        // Update state
        *self.start_time.write().await = Some(Instant::now());
        self.health.mark_started();
        self.set_lifecycle(LifecycleState::Ready).await;

        log::info!("IPC Manager started successfully");
        Ok(())
    }

    /// Writer task - sends requests to subprocess stdin.
    fn writer_task(mut stdin: ChildStdin, mut rx: mpsc::Receiver<WriterMessage>) {
        log::debug!("Writer task started");

        while let Some(msg) = rx.blocking_recv() {
            match msg {
                WriterMessage::Request(json) => {
                    log::debug!("Sending: {json}");
                    if let Err(e) = writeln!(stdin, "{json}") {
                        log::error!("Failed to write: {e}");
                        break;
                    }
                    if let Err(e) = stdin.flush() {
                        log::error!("Failed to flush: {e}");
                        break;
                    }
                }
                WriterMessage::Shutdown => {
                    log::debug!("Writer received shutdown");
                    break;
                }
            }
        }

        log::debug!("Writer task exited");
    }

    /// Reader task - reads responses from subprocess stdout.
    fn reader_task(
        stdout: std::process::ChildStdout,
        pending: PendingRequests,
        health: Arc<HealthMonitor>,
    ) {
        log::debug!("Reader task started");

        let reader = BufReader::new(stdout);

        for line in reader.lines() {
            match line {
                Ok(json) => {
                    if json.trim().is_empty() {
                        continue;
                    }

                    log::debug!("Received: {json}");

                    match serde_json::from_str::<JsonRpcResponse>(&json) {
                        Ok(response) => {
                            if let Some(id) = response.id {
                                let mut pending_guard =
                                    futures::executor::block_on(pending.write());
                                if let Some(tx) = pending_guard.remove(&id) {
                                    let _ = tx.send(Ok(response));
                                }
                            }
                        }
                        Err(e) => {
                            log::error!("Failed to parse response: {e}");
                        }
                    }
                }
                Err(e) => {
                    log::error!("Read error: {e}");
                    break;
                }
            }
        }

        log::warn!("Reader detected subprocess exit");
        health.mark_crashed("Subprocess stdout closed");

        // Cancel pending requests
        let mut pending_guard = futures::executor::block_on(pending.write());
        for (id, tx) in pending_guard.drain() {
            log::warn!("Cancelling request {id}");
            let _ = tx.send(Err(IpcError::SubprocessCrashed));
        }

        log::debug!("Reader task exited");
    }

    /// Stderr task - logs stderr output.
    fn stderr_task(stderr: std::process::ChildStderr) {
        log::debug!("Stderr task started");

        let reader = BufReader::new(stderr);

        for line in reader.lines() {
            match line {
                Ok(text) => {
                    if text.contains("ERROR") {
                        log::error!("[Python] {text}");
                    } else if text.contains("WARNING") {
                        log::warn!("[Python] {text}");
                    } else if text.contains("DEBUG") {
                        log::debug!("[Python] {text}");
                    } else {
                        log::info!("[Python] {text}");
                    }
                }
                Err(e) => {
                    log::error!("Stderr read error: {e}");
                    break;
                }
            }
        }

        log::debug!("Stderr task exited");
    }

    /// Generate next request ID.
    fn next_request_id(&self) -> u64 {
        self.next_id.fetch_add(1, Ordering::SeqCst)
    }

    /// Send a JSON-RPC request.
    pub async fn call(
        &self,
        method: impl Into<String>,
        params: Value,
    ) -> Result<Value, IpcError> {
        if !self.is_ready().await {
            return Err(IpcError::NotRunning);
        }

        if self.is_shutting_down.load(Ordering::SeqCst) {
            return Err(IpcError::ShuttingDown);
        }

        let method = method.into();
        let id = self.next_request_id();

        log::debug!("Calling: id={id}, method={method}");

        // Build request
        let request = JsonRpcRequest::new(id, &method, params);
        let json = request.to_json()?;

        // Create response channel
        let (tx, rx) = oneshot::channel();

        // Register pending
        {
            let mut pending = self.pending.write().await;
            pending.insert(id, tx);
        }

        // Send request
        let writer_tx = self.writer_tx.read().await;
        let writer = writer_tx
            .as_ref()
            .ok_or(IpcError::NotInitialized)?;

        writer
            .send(WriterMessage::Request(json))
            .await
            .map_err(|_| IpcError::ChannelClosed)?;

        self.total_requests.fetch_add(1, Ordering::SeqCst);

        // Wait with timeout
        let timeout = Duration::from_secs(self.config.timeout_secs);
        match tokio::time::timeout(timeout, rx).await {
            Ok(Ok(Ok(response))) => {
                self.successful_requests.fetch_add(1, Ordering::SeqCst);

                if let Some(error) = response.error {
                    self.failed_requests.fetch_add(1, Ordering::SeqCst);
                    return Err(IpcError::RpcError {
                        code: error.code,
                        message: error.message,
                    });
                }

                Ok(response.result.unwrap_or(Value::Null))
            }
            Ok(Ok(Err(e))) => {
                self.failed_requests.fetch_add(1, Ordering::SeqCst);
                Err(e)
            }
            Ok(Err(_)) => {
                self.failed_requests.fetch_add(1, Ordering::SeqCst);
                self.pending.write().await.remove(&id);
                Err(IpcError::ChannelClosed)
            }
            Err(_) => {
                self.failed_requests.fetch_add(1, Ordering::SeqCst);
                self.pending.write().await.remove(&id);
                Err(IpcError::Timeout(self.config.timeout_secs))
            }
        }
    }

    /// Send using `RequestBuilder`.
    pub async fn send_builder(&self, builder: RequestBuilder) -> Result<Value, IpcError> {
        let id = self.next_request_id();
        let request = builder.build(id);
        self.call(request.method, request.params).await
    }

    /// Shutdown the IPC Manager.
    pub async fn shutdown(&self) -> Result<(), IpcError> {
        if self.is_shutting_down.load(Ordering::SeqCst) {
            return Ok(());
        }

        self.is_shutting_down.store(true, Ordering::SeqCst);
        self.set_lifecycle(LifecycleState::ShuttingDown).await;
        self.health.set_state(SubprocessState::ShuttingDown);

        log::info!("Shutting down IPC Manager");

        // Send shutdown to writer
        if let Some(tx) = self.writer_tx.write().await.take() {
            let _ = tx.send(WriterMessage::Shutdown).await;
        }

        // Shutdown subprocess
        if let Some(mut handle) = self.subprocess.lock().unwrap().take() {
            let timeout = Duration::from_secs(self.config.timeout_secs);
            if let Err(e) = handle.shutdown(timeout) {
                log::error!("Subprocess shutdown error: {e}");
            }
        }

        self.set_lifecycle(LifecycleState::Stopped).await;
        self.health.set_state(SubprocessState::Stopped);

        log::info!("IPC Manager shutdown complete");
        Ok(())
    }

    /// Get manager statistics.
    pub async fn stats(&self) -> ManagerStats {
        let uptime = self
            .start_time
            .read()
            .await
            .map(|t| t.elapsed().as_secs());

        let pid = self
            .subprocess
            .lock()
            .unwrap()
            .as_ref()
            .map(|h| h.pid);

        let pending_count = self.pending.read().await.len();

        ManagerStats {
            lifecycle_state: self.lifecycle_state().await,
            health_status: self.health.status(),
            total_requests: self.total_requests.load(Ordering::SeqCst),
            successful_requests: self.successful_requests.load(Ordering::SeqCst),
            failed_requests: self.failed_requests.load(Ordering::SeqCst),
            pending_requests: pending_count,
            uptime_secs: uptime,
            subprocess_pid: pid,
        }
    }
}

impl Drop for IpcManagerState {
    fn drop(&mut self) {
        // Only kill subprocess if we're the last owner (Arc strong_count == 1)
        // This prevents clones from killing the subprocess when they're dropped
        if Arc::strong_count(&self.subprocess) == 1 {
            log::debug!("IpcManagerState dropping (last owner), cleaning up subprocess");

            // Kill subprocess if still running
            if let Some(mut handle) = self.subprocess.lock().unwrap().take() {
                log::info!("Terminating subprocess (PID: {}) on final drop", handle.pid);
                let _ = handle.kill();
            }
        } else {
            log::debug!(
                "IpcManagerState dropping (clone), {} owners remain",
                Arc::strong_count(&self.subprocess) - 1
            );
        }
    }
}

// ============================================
// TESTS
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_lifecycle_state() {
        assert!(LifecycleState::Ready.can_accept_requests());
        assert!(LifecycleState::Degraded.can_accept_requests());
        assert!(!LifecycleState::Starting.can_accept_requests());
        assert!(!LifecycleState::Stopped.can_accept_requests());

        assert!(LifecycleState::Stopped.is_terminal());
        assert!(LifecycleState::Failed.is_terminal());
        assert!(!LifecycleState::Ready.is_terminal());
    }

    #[test]
    fn test_ipc_config_default() {
        let config = IpcConfig::default();

        assert_eq!(config.python_path, "python");
        assert_eq!(config.module_path, "plugins._host");
        assert!(config.working_dir.is_none());
        assert_eq!(config.timeout_secs, DEFAULT_TIMEOUT_SECS);
        assert!(config.auto_respawn);
    }

    #[test]
    fn test_ipc_config_builder() {
        let config = IpcConfig::new()
            .with_python_path("python3.11")
            .with_module_path("my.module")
            .with_working_dir("/tmp")
            .with_timeout(30)
            .with_auto_respawn(false);

        assert_eq!(config.python_path, "python3.11");
        assert_eq!(config.module_path, "my.module");
        assert_eq!(config.working_dir, Some(PathBuf::from("/tmp")));
        assert_eq!(config.timeout_secs, 30);
        assert!(!config.auto_respawn);
    }

    #[test]
    fn test_config_to_subprocess_config() {
        let config = IpcConfig::new()
            .with_python_path("python3")
            .with_module_path("test.module")
            .with_working_dir("/tmp");

        let subprocess_config = config.to_subprocess_config();

        assert_eq!(subprocess_config.python_path, "python3");
        assert_eq!(subprocess_config.module_path, "test.module");
        assert_eq!(subprocess_config.working_dir, Some(PathBuf::from("/tmp")));
    }

    #[tokio::test]
    async fn test_manager_state_creation() {
        let config = IpcConfig::default();
        let state = IpcManagerState::new(config);

        assert_eq!(state.lifecycle_state().await, LifecycleState::Uninitialized);
        assert!(!state.is_ready().await);
    }
}
