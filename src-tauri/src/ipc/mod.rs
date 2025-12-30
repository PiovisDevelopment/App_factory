//! D030 - src-tauri/src/ipc/mod.rs
//! =================================
//! IPC module root for Python subprocess communication.

// Allow dead code in this module - these are library types for external use
#![allow(dead_code)]
//!
//! Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
//! Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)
//!
//! This module handles:
//! - Spawning the Python plugin host subprocess (D030)
//! - JSON-RPC send/receive over stdin/stdout (D031, D032)
//! - Request ID tracking with timeout handling (D033)
//! - Subprocess health monitoring and crash recovery (D034)
//!
//! Dependencies:
//!     - D025: plugins/_host/__main__.py (Python plugin host)
//!     - D009: config/error_codes.yaml (error codes)
//!
//! Usage:
//!     ```rust
//!     let mut manager = IpcManager::new()
//!         .with_python_path("python")
//!         .with_module_path("plugins._host")
//!         .with_working_dir("./");
//!     
//!     manager.spawn().await?;
//!     
//!     let response = manager.call("ping", json!({})).await?;
//!     
//!     manager.shutdown().await?;
//!     ```

pub mod request;
pub mod response;
pub mod spawn;
pub mod health;
pub mod manager;

use serde::Serialize;
use std::collections::HashMap;
use std::io::{BufRead, BufReader, Write};
use std::process::{Child, Command, Stdio};
use std::sync::atomic::{AtomicBool, AtomicU32, AtomicU64, Ordering};
use std::sync::Arc;
use std::thread::JoinHandle;
use std::time::Instant;
use tokio::sync::{mpsc, oneshot, RwLock};

// Re-export commonly used types for library consumers
// These are available via crate::ipc::* for convenience
#[allow(unused_imports)]
pub use request::JsonRpcRequest;
#[allow(unused_imports)]
pub use response::JsonRpcResponse;
#[allow(unused_imports)]
pub use spawn::spawn_plugin_host;
#[allow(unused_imports)]
pub use health::HealthStatus;
#[allow(unused_imports)]
pub use manager::{IpcConfig, IpcManagerState, LifecycleState, ManagerStats};

// ============================================
// CONSTANTS
// ============================================

/// Default request timeout in seconds
pub const DEFAULT_TIMEOUT_SECS: u64 = 60;

/// Maximum respawn attempts before giving up
pub const MAX_RESPAWN_ATTEMPTS: u32 = 3;

/// Delay between respawn attempts in milliseconds
pub const RESPAWN_DELAY_MS: u64 = 1000;

/// Health check interval in seconds
pub const HEALTH_CHECK_INTERVAL_SECS: u64 = 30;

// ============================================
// ERROR TYPES
// ============================================

/// IPC Error types
#[derive(Debug, Clone, thiserror::Error)]
pub enum IpcError {
    #[error("Failed to spawn subprocess: {0}")]
    SpawnError(String),

    #[error("Subprocess not running")]
    NotRunning,

    #[error("Failed to send request: {0}")]
    SendError(String),

    #[error("Request timed out after {0} seconds")]
    Timeout(u64),

    #[error("Subprocess crashed")]
    SubprocessCrashed,

    #[error("JSON-RPC error [{code}]: {message}")]
    RpcError { code: i32, message: String },

    #[error("Response missing for request {0}")]
    ResponseMissing(u64),

    #[error("IO error: {0}")]
    IoError(String),

    #[error("JSON serialization error: {0}")]
    JsonError(String),

    #[error("Respawn failed after {0} attempts")]
    RespawnFailed(u32),

    #[error("Channel closed")]
    ChannelClosed,

    #[error("Subprocess not initialized")]
    NotInitialized,

    #[error("Shutdown in progress")]
    ShuttingDown,
}

impl From<std::io::Error> for IpcError {
    fn from(e: std::io::Error) -> Self {
        IpcError::IoError(e.to_string())
    }
}

impl From<serde_json::Error> for IpcError {
    fn from(e: serde_json::Error) -> Self {
        IpcError::JsonError(e.to_string())
    }
}

// ============================================
// WRITER MESSAGE
// ============================================

/// Internal message type for the writer task
#[derive(Debug)]
enum WriterMessage {
    /// JSON request string to send
    Request(String),
    /// Shutdown signal
    Shutdown,
}

// ============================================
// PENDING REQUEST TYPE
// ============================================

/// Type alias for pending request map
type PendingMap = Arc<RwLock<HashMap<u64, oneshot::Sender<Result<JsonRpcResponse, IpcError>>>>>;

// ============================================
// IPC MANAGER
// ============================================

/// IPC Manager state
///
/// Manages the Python plugin host subprocess lifecycle:
/// - Spawns subprocess with piped stdin/stdout/stderr
/// - Sends JSON-RPC requests via stdin
/// - Receives responses from stdout
/// - Logs stderr output
/// - Handles timeouts and crash recovery
pub struct IpcManager {
    /// Python executable path
    python_path: String,
    
    /// Plugin host module path (e.g., "plugins._host")
    module_path: String,
    
    /// Working directory for subprocess
    working_dir: Option<String>,
    
    /// Child process handle
    child: Option<Child>,
    
    /// Writer channel sender
    writer_tx: Option<mpsc::Sender<WriterMessage>>,
    
    /// Pending request callbacks
    pending: PendingMap,
    
    /// Next request ID (atomic for thread safety)
    next_id: AtomicU64,
    
    /// Is subprocess running
    is_running: Arc<AtomicBool>,
    
    /// Respawn attempt counter
    respawn_attempts: AtomicU32,
    
    /// Is shutdown in progress
    is_shutting_down: AtomicBool,
    
    /// Reader thread handle
    reader_handle: Option<JoinHandle<()>>,
    
    /// Writer thread handle
    writer_handle: Option<JoinHandle<()>>,
    
    /// Stderr thread handle
    stderr_handle: Option<JoinHandle<()>>,
    
    /// Request timeout in seconds
    timeout_secs: u64,
    
    /// Spawn timestamp
    spawn_time: Option<Instant>,
    
    /// Total requests processed
    request_count: AtomicU64,
    
    /// Failed requests count
    error_count: AtomicU64,
}

impl Default for IpcManager {
    fn default() -> Self {
        Self::new()
    }
}

impl IpcManager {
    /// Create a new IPC Manager with default settings.
    ///
    /// # Example
    ///
    /// ```rust
    /// let manager = IpcManager::new();
    /// ```
    pub fn new() -> Self {
        Self {
            python_path: "python".to_string(),
            module_path: "plugins._host".to_string(),
            working_dir: None,
            child: None,
            writer_tx: None,
            pending: Arc::new(RwLock::new(HashMap::new())),
            next_id: AtomicU64::new(1),
            is_running: Arc::new(AtomicBool::new(false)),
            respawn_attempts: AtomicU32::new(0),
            is_shutting_down: AtomicBool::new(false),
            reader_handle: None,
            writer_handle: None,
            stderr_handle: None,
            timeout_secs: DEFAULT_TIMEOUT_SECS,
            spawn_time: None,
            request_count: AtomicU64::new(0),
            error_count: AtomicU64::new(0),
        }
    }

    /// Configure Python executable path.
    ///
    /// # Arguments
    ///
    /// * `path` - Path to Python executable (e.g., "python3", "/usr/bin/python")
    ///
    /// # Example
    ///
    /// ```rust
    /// let manager = IpcManager::new()
    ///     .with_python_path("python3.11");
    /// ```
    pub fn with_python_path(mut self, path: impl Into<String>) -> Self {
        self.python_path = path.into();
        self
    }

    /// Configure module path.
    ///
    /// # Arguments
    ///
    /// * `path` - Python module path (e.g., "plugins._host")
    ///
    /// # Example
    ///
    /// ```rust
    /// let manager = IpcManager::new()
    ///     .with_module_path("my_package.plugin_host");
    /// ```
    pub fn with_module_path(mut self, path: impl Into<String>) -> Self {
        self.module_path = path.into();
        self
    }

    /// Configure working directory.
    ///
    /// # Arguments
    ///
    /// * `dir` - Working directory for the subprocess
    ///
    /// # Example
    ///
    /// ```rust
    /// let manager = IpcManager::new()
    ///     .with_working_dir("/path/to/project");
    /// ```
    pub fn with_working_dir(mut self, dir: impl Into<String>) -> Self {
        self.working_dir = Some(dir.into());
        self
    }

    /// Configure request timeout.
    ///
    /// # Arguments
    ///
    /// * `secs` - Timeout in seconds
    ///
    /// # Example
    ///
    /// ```rust
    /// let manager = IpcManager::new()
    ///     .with_timeout(30);
    /// ```
    pub fn with_timeout(mut self, secs: u64) -> Self {
        self.timeout_secs = secs;
        self
    }

    /// Check if subprocess is running.
    pub fn is_running(&self) -> bool {
        self.is_running.load(Ordering::SeqCst)
    }

    /// Check if shutdown is in progress.
    pub fn is_shutting_down(&self) -> bool {
        self.is_shutting_down.load(Ordering::SeqCst)
    }

    /// Get total request count.
    pub fn request_count(&self) -> u64 {
        self.request_count.load(Ordering::SeqCst)
    }

    /// Get error count.
    pub fn error_count(&self) -> u64 {
        self.error_count.load(Ordering::SeqCst)
    }

    /// Get subprocess uptime in seconds.
    pub fn uptime_secs(&self) -> Option<u64> {
        self.spawn_time.map(|t| t.elapsed().as_secs())
    }

    /// Get subprocess PID.
    pub fn pid(&self) -> Option<u32> {
        self.child.as_ref().map(|c| c.id())
    }

    /// Spawn the Python plugin host subprocess.
    ///
    /// Creates the subprocess with piped stdin/stdout/stderr and starts
    /// background threads for reading/writing.
    ///
    /// # Returns
    ///
    /// * `Ok(())` if spawn successful
    /// * `Err(IpcError)` if spawn fails
    ///
    /// # Example
    ///
    /// ```rust
    /// let mut manager = IpcManager::new();
    /// manager.spawn()?;
    /// ```
    pub fn spawn(&mut self) -> Result<(), IpcError> {
        if self.is_running() {
            log::warn!("Subprocess already running");
            return Ok(());
        }

        if self.is_shutting_down() {
            return Err(IpcError::ShuttingDown);
        }

        log::info!(
            "Spawning Python plugin host: {} -m {}",
            self.python_path,
            self.module_path
        );

        // Build command
        let mut cmd = Command::new(&self.python_path);
        cmd.args(["-m", &self.module_path])
            .stdin(Stdio::piped())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        // Set working directory if configured
        if let Some(ref dir) = self.working_dir {
            cmd.current_dir(dir);
        }

        // Set environment variables for unbuffered output
        cmd.env("PYTHONUNBUFFERED", "1");

        // Spawn process
        let mut child = cmd
            .spawn()
            .map_err(|e| IpcError::SpawnError(format!("Failed to spawn: {}", e)))?;

        let pid = child.id();
        log::info!("Python subprocess spawned with PID: {}", pid);

        // Get stdio handles
        let stdin = child
            .stdin
            .take()
            .ok_or_else(|| IpcError::SpawnError("Failed to get stdin".to_string()))?;
        let stdout = child
            .stdout
            .take()
            .ok_or_else(|| IpcError::SpawnError("Failed to get stdout".to_string()))?;
        let stderr = child
            .stderr
            .take()
            .ok_or_else(|| IpcError::SpawnError("Failed to get stderr".to_string()))?;

        // Create writer channel
        let (writer_tx, writer_rx) = mpsc::channel::<WriterMessage>(100);

        // Spawn writer thread
        let writer_handle = std::thread::Builder::new()
            .name("ipc-writer".to_string())
            .spawn(move || {
                Self::writer_task(stdin, writer_rx);
            })
            .map_err(|e| IpcError::SpawnError(format!("Failed to spawn writer thread: {}", e)))?;

        // Spawn reader thread
        let pending_clone = Arc::clone(&self.pending);
        let is_running_clone = Arc::clone(&self.is_running);
        let reader_handle = std::thread::Builder::new()
            .name("ipc-reader".to_string())
            .spawn(move || {
                Self::reader_task(stdout, pending_clone, is_running_clone);
            })
            .map_err(|e| IpcError::SpawnError(format!("Failed to spawn reader thread: {}", e)))?;

        // Spawn stderr logger thread
        let stderr_handle = std::thread::Builder::new()
            .name("ipc-stderr".to_string())
            .spawn(move || {
                Self::stderr_task(stderr);
            })
            .map_err(|e| IpcError::SpawnError(format!("Failed to spawn stderr thread: {}", e)))?;

        // Update state
        self.child = Some(child);
        self.writer_tx = Some(writer_tx);
        self.reader_handle = Some(reader_handle);
        self.writer_handle = Some(writer_handle);
        self.stderr_handle = Some(stderr_handle);
        self.is_running.store(true, Ordering::SeqCst);
        self.respawn_attempts.store(0, Ordering::SeqCst);
        self.spawn_time = Some(Instant::now());

        log::info!("IPC Manager initialized successfully");
        Ok(())
    }

    /// Writer task - sends requests to subprocess stdin.
    ///
    /// Runs in a dedicated thread, receives messages from the channel
    /// and writes them to stdin with newline delimiter.
    fn writer_task(
        mut stdin: std::process::ChildStdin,
        mut rx: mpsc::Receiver<WriterMessage>,
    ) {
        log::debug!("Writer task started");

        // Use blocking receiver in thread context
        while let Some(msg) = rx.blocking_recv() {
            match msg {
                WriterMessage::Request(json) => {
                    log::debug!("Sending request: {}", json);
                    
                    // Write JSON line
                    if let Err(e) = writeln!(stdin, "{}", json) {
                        log::error!("Failed to write to stdin: {}", e);
                        break;
                    }
                    
                    // Flush immediately (critical for IPC)
                    if let Err(e) = stdin.flush() {
                        log::error!("Failed to flush stdin: {}", e);
                        break;
                    }
                }
                WriterMessage::Shutdown => {
                    log::debug!("Writer task received shutdown signal");
                    break;
                }
            }
        }

        log::debug!("Writer task exited");
    }

    /// Reader task - reads responses from subprocess stdout.
    ///
    /// Runs in a dedicated thread, reads lines from stdout,
    /// parses JSON-RPC responses, and completes pending requests.
    fn reader_task(
        stdout: std::process::ChildStdout,
        pending: PendingMap,
        is_running: Arc<AtomicBool>,
    ) {
        log::debug!("Reader task started");

        let reader = BufReader::new(stdout);

        for line in reader.lines() {
            match line {
                Ok(json) => {
                    // Skip empty lines
                    if json.trim().is_empty() {
                        continue;
                    }

                    log::debug!("Received response: {}", json);

                    // Parse JSON-RPC response
                    match serde_json::from_str::<JsonRpcResponse>(&json) {
                        Ok(response) => {
                            if let Some(id) = response.id {
                                // Find and complete the pending request
                                let mut pending_guard =
                                    futures::executor::block_on(pending.write());
                                
                                if let Some(tx) = pending_guard.remove(&id) {
                                    let _ = tx.send(Ok(response));
                                } else {
                                    log::warn!("No pending request for id {}", id);
                                }
                            } else {
                                // Notification (no id) - log and ignore
                                log::debug!("Received notification: {:?}", response);
                            }
                        }
                        Err(e) => {
                            log::error!("Failed to parse response: {} - {}", e, json);
                        }
                    }
                }
                Err(e) => {
                    log::error!("Failed to read from stdout: {}", e);
                    break;
                }
            }
        }

        // Subprocess has exited or pipe closed
        log::warn!("Reader task detected subprocess exit");
        is_running.store(false, Ordering::SeqCst);

        // Cancel all pending requests
        let mut pending_guard = futures::executor::block_on(pending.write());
        for (id, tx) in pending_guard.drain() {
            log::warn!("Cancelling pending request {}", id);
            let _ = tx.send(Err(IpcError::SubprocessCrashed));
        }

        log::debug!("Reader task exited");
    }

    /// Stderr task - logs stderr output from subprocess.
    ///
    /// Runs in a dedicated thread, reads lines from stderr
    /// and logs them at appropriate levels.
    fn stderr_task(stderr: std::process::ChildStderr) {
        log::debug!("Stderr task started");

        let reader = BufReader::new(stderr);

        for line in reader.lines() {
            match line {
                Ok(text) => {
                    // Detect log level from Python logging format
                    if text.contains("[ERROR]") || text.contains("ERROR:") {
                        log::error!("[Python] {}", text);
                    } else if text.contains("[WARNING]") || text.contains("WARNING:") {
                        log::warn!("[Python] {}", text);
                    } else if text.contains("[DEBUG]") || text.contains("DEBUG:") {
                        log::debug!("[Python] {}", text);
                    } else {
                        log::info!("[Python] {}", text);
                    }
                }
                Err(e) => {
                    log::error!("Failed to read from stderr: {}", e);
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

    /// Get manager statistics.
    pub fn get_stats(&self) -> IpcStats {
        IpcStats {
            is_running: self.is_running(),
            pid: self.pid(),
            uptime_secs: self.uptime_secs(),
            request_count: self.request_count(),
            error_count: self.error_count(),
            pending_count: futures::executor::block_on(async {
                self.pending.read().await.len()
            }),
            respawn_attempts: self.respawn_attempts.load(Ordering::SeqCst),
        }
    }
}

// ============================================
// IPC STATISTICS
// ============================================

/// IPC Manager statistics
#[derive(Debug, Clone, Serialize)]
pub struct IpcStats {
    pub is_running: bool,
    pub pid: Option<u32>,
    pub uptime_secs: Option<u64>,
    pub request_count: u64,
    pub error_count: u64,
    pub pending_count: usize,
    pub respawn_attempts: u32,
}

// ============================================
// DROP IMPLEMENTATION
// ============================================

impl Drop for IpcManager {
    fn drop(&mut self) {
        log::debug!("IpcManager drop called");
        
        // Signal shutdown
        self.is_shutting_down.store(true, Ordering::SeqCst);
        
        // Send shutdown message to writer
        if let Some(tx) = self.writer_tx.take() {
            let _ = tx.blocking_send(WriterMessage::Shutdown);
        }
        
        // Kill child process if still running
        if let Some(mut child) = self.child.take() {
            log::info!("Killing Python subprocess (PID: {})", child.id());
            let _ = child.kill();
            let _ = child.wait();
        }
        
        log::debug!("IpcManager dropped");
    }
}

// ============================================
// TESTS
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ipc_manager_builder() {
        let manager = IpcManager::new()
            .with_python_path("python3")
            .with_module_path("my.module")
            .with_working_dir("/tmp")
            .with_timeout(30);
        
        assert_eq!(manager.python_path, "python3");
        assert_eq!(manager.module_path, "my.module");
        assert_eq!(manager.working_dir, Some("/tmp".to_string()));
        assert_eq!(manager.timeout_secs, 30);
    }

    #[test]
    fn test_initial_state() {
        let manager = IpcManager::new();
        
        assert!(!manager.is_running());
        assert!(!manager.is_shutting_down());
        assert_eq!(manager.request_count(), 0);
        assert_eq!(manager.error_count(), 0);
        assert!(manager.pid().is_none());
        assert!(manager.uptime_secs().is_none());
    }

    #[test]
    fn test_request_id_generation() {
        let manager = IpcManager::new();
        
        let id1 = manager.next_request_id();
        let id2 = manager.next_request_id();
        let id3 = manager.next_request_id();
        
        assert_eq!(id1, 1);
        assert_eq!(id2, 2);
        assert_eq!(id3, 3);
    }
}
