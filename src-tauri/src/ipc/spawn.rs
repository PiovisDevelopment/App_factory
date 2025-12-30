//! D033 - src-tauri/src/ipc/spawn.rs
//! ==================================
//! Python subprocess spawn utilities using Tauri sidecar pattern.

// Allow dead code - these are library types for external use
#![allow(dead_code)]
//!
//! Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
//! Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)
//!
//! This module provides:
//! - SubprocessConfig for configurable spawn parameters
//! - Sidecar-style spawn using tauri::api::process::Command
//! - Environment setup for unbuffered Python output
//! - Graceful shutdown with timeout
//! - Process state tracking
//!
//! Dependencies:
//!     - D030: mod.rs (IpcError, constants)
//!
//! Reference: https://v1.tauri.app/v1/guides/building/sidecar/
//!
//! Usage:
//!     ```rust
//!     use crate::ipc::spawn::{SubprocessConfig, SubprocessHandle, spawn_plugin_host};
//!
//!     let config = SubprocessConfig::default()
//!         .with_python_path("python")
//!         .with_module("plugins._host")
//!         .with_working_dir("./");
//!
//!     let handle = spawn_plugin_host(config)?;
//!
//!     // Use handle.stdin, handle.stdout, handle.stderr
//!
//!     handle.shutdown(Duration::from_secs(5))?;
//!     ```

use std::io::{BufRead, BufReader, Write};
use std::path::PathBuf;
use std::process::{Child, ChildStderr, ChildStdin, ChildStdout, Command, ExitStatus, Stdio};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

use super::{IpcError, DEFAULT_TIMEOUT_SECS, MAX_RESPAWN_ATTEMPTS, RESPAWN_DELAY_MS};

// ============================================
// SUBPROCESS CONFIGURATION
// ============================================

/// Configuration for spawning the Python plugin host subprocess.
///
/// Uses builder pattern for flexible configuration.
///
/// # Example
///
/// ```rust
/// let config = SubprocessConfig::default()
///     .with_python_path("python3.11")
///     .with_module("plugins._host")
///     .with_working_dir("/path/to/project")
///     .with_env("DEBUG", "1");
/// ```
#[derive(Debug, Clone)]
pub struct SubprocessConfig {
    /// Path to Python executable
    pub python_path: String,

    /// Python module to run (e.g., "plugins._host")
    pub module_path: String,

    /// Working directory for the subprocess
    pub working_dir: Option<PathBuf>,

    /// Additional environment variables
    pub env_vars: Vec<(String, String)>,

    /// Timeout for graceful shutdown in seconds
    pub shutdown_timeout_secs: u64,

    /// Maximum respawn attempts
    pub max_respawn_attempts: u32,

    /// Delay between respawn attempts in milliseconds
    pub respawn_delay_ms: u64,

    /// Enable verbose logging
    pub verbose: bool,
}

impl Default for SubprocessConfig {
    fn default() -> Self {
        Self {
            python_path: "python".to_string(),
            module_path: "plugins._host".to_string(),
            working_dir: None,
            env_vars: Vec::new(),
            shutdown_timeout_secs: DEFAULT_TIMEOUT_SECS,
            max_respawn_attempts: MAX_RESPAWN_ATTEMPTS,
            respawn_delay_ms: RESPAWN_DELAY_MS,
            verbose: false,
        }
    }
}

impl SubprocessConfig {
    /// Create a new configuration with default values.
    pub fn new() -> Self {
        Self::default()
    }

    /// Set Python executable path.
    ///
    /// # Arguments
    ///
    /// * `path` - Path to Python executable
    ///
    /// # Example
    ///
    /// ```rust
    /// let config = SubprocessConfig::new()
    ///     .with_python_path("python3.11");
    /// ```
    pub fn with_python_path(mut self, path: impl Into<String>) -> Self {
        self.python_path = path.into();
        self
    }

    /// Set Python module path.
    ///
    /// # Arguments
    ///
    /// * `module` - Module path (e.g., "plugins._host")
    ///
    /// # Example
    ///
    /// ```rust
    /// let config = SubprocessConfig::new()
    ///     .with_module("my_package.main");
    /// ```
    pub fn with_module(mut self, module: impl Into<String>) -> Self {
        self.module_path = module.into();
        self
    }

    /// Set working directory.
    ///
    /// # Arguments
    ///
    /// * `dir` - Working directory path
    ///
    /// # Example
    ///
    /// ```rust
    /// let config = SubprocessConfig::new()
    ///     .with_working_dir("/path/to/project");
    /// ```
    pub fn with_working_dir(mut self, dir: impl Into<PathBuf>) -> Self {
        self.working_dir = Some(dir.into());
        self
    }

    /// Add environment variable.
    ///
    /// # Arguments
    ///
    /// * `key` - Environment variable name
    /// * `value` - Environment variable value
    ///
    /// # Example
    ///
    /// ```rust
    /// let config = SubprocessConfig::new()
    ///     .with_env("DEBUG", "1")
    ///     .with_env("LOG_LEVEL", "debug");
    /// ```
    pub fn with_env(mut self, key: impl Into<String>, value: impl Into<String>) -> Self {
        self.env_vars.push((key.into(), value.into()));
        self
    }

    /// Add multiple environment variables.
    ///
    /// # Arguments
    ///
    /// * `vars` - Iterator of (key, value) pairs
    pub fn with_envs<I, K, V>(mut self, vars: I) -> Self
    where
        I: IntoIterator<Item = (K, V)>,
        K: Into<String>,
        V: Into<String>,
    {
        for (k, v) in vars {
            self.env_vars.push((k.into(), v.into()));
        }
        self
    }

    /// Set shutdown timeout.
    ///
    /// # Arguments
    ///
    /// * `secs` - Timeout in seconds
    pub fn with_shutdown_timeout(mut self, secs: u64) -> Self {
        self.shutdown_timeout_secs = secs;
        self
    }

    /// Set maximum respawn attempts.
    ///
    /// # Arguments
    ///
    /// * `attempts` - Maximum number of respawn attempts
    pub fn with_max_respawn_attempts(mut self, attempts: u32) -> Self {
        self.max_respawn_attempts = attempts;
        self
    }

    /// Set respawn delay.
    ///
    /// # Arguments
    ///
    /// * `ms` - Delay in milliseconds
    pub fn with_respawn_delay(mut self, ms: u64) -> Self {
        self.respawn_delay_ms = ms;
        self
    }

    /// Enable verbose logging.
    pub fn with_verbose(mut self, verbose: bool) -> Self {
        self.verbose = verbose;
        self
    }

    /// Build the command arguments.
    fn build_args(&self) -> Vec<String> {
        vec!["-m".to_string(), self.module_path.clone()]
    }
}

// ============================================
// SUBPROCESS STATE
// ============================================

/// Current state of the subprocess.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProcessState {
    /// Not started yet
    NotStarted,
    /// Currently running
    Running,
    /// Gracefully stopped
    Stopped,
    /// Crashed unexpectedly
    Crashed,
    /// Killed forcefully
    Killed,
}

impl std::fmt::Display for ProcessState {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            ProcessState::NotStarted => write!(f, "NOT_STARTED"),
            ProcessState::Running => write!(f, "RUNNING"),
            ProcessState::Stopped => write!(f, "STOPPED"),
            ProcessState::Crashed => write!(f, "CRASHED"),
            ProcessState::Killed => write!(f, "KILLED"),
        }
    }
}

// ============================================
// SUBPROCESS HANDLE
// ============================================

/// Handle to a spawned subprocess.
///
/// Provides access to stdin/stdout/stderr and lifecycle management.
///
/// # Example
///
/// ```rust
/// let handle = spawn_plugin_host(config)?;
///
/// // Write to stdin
/// writeln!(handle.stdin.as_mut().unwrap(), "{{...}}")?;
///
/// // Read from stdout
/// let mut reader = BufReader::new(handle.stdout.as_mut().unwrap());
/// let mut line = String::new();
/// reader.read_line(&mut line)?;
///
/// // Shutdown
/// handle.shutdown(Duration::from_secs(5))?;
/// ```
pub struct SubprocessHandle {
    /// Child process
    child: Child,

    /// Process stdin (for sending requests)
    pub stdin: Option<ChildStdin>,

    /// Process stdout (for receiving responses)
    pub stdout: Option<ChildStdout>,

    /// Process stderr (for logging)
    pub stderr: Option<ChildStderr>,

    /// Process ID
    pub pid: u32,

    /// Current state
    state: ProcessState,

    /// Spawn timestamp
    spawn_time: Instant,

    /// Configuration used for spawning
    config: SubprocessConfig,

    /// Is shutdown in progress
    shutting_down: Arc<AtomicBool>,
}

impl SubprocessHandle {
    /// Get current process state.
    pub fn state(&self) -> ProcessState {
        self.state
    }

    /// Check if process is running.
    pub fn is_running(&self) -> bool {
        self.state == ProcessState::Running
    }

    /// Check if shutdown is in progress.
    pub fn is_shutting_down(&self) -> bool {
        self.shutting_down.load(Ordering::SeqCst)
    }

    /// Get process uptime.
    pub fn uptime(&self) -> Duration {
        self.spawn_time.elapsed()
    }

    /// Get configuration.
    pub fn config(&self) -> &SubprocessConfig {
        &self.config
    }

    /// Try to get exit status without blocking.
    ///
    /// Returns `Some(status)` if process has exited, `None` if still running.
    pub fn try_wait(&mut self) -> Result<Option<ExitStatus>, IpcError> {
        match self.child.try_wait() {
            Ok(Some(status)) => {
                self.state = if status.success() {
                    ProcessState::Stopped
                } else {
                    ProcessState::Crashed
                };
                Ok(Some(status))
            }
            Ok(None) => Ok(None),
            Err(e) => Err(IpcError::IoError(e.to_string())),
        }
    }

    /// Wait for process to exit (blocking).
    pub fn wait(&mut self) -> Result<ExitStatus, IpcError> {
        let status = self.child.wait().map_err(|e| IpcError::IoError(e.to_string()))?;

        self.state = if status.success() {
            ProcessState::Stopped
        } else {
            ProcessState::Crashed
        };

        Ok(status)
    }

    /// Send graceful shutdown signal and wait.
    ///
    /// Attempts graceful shutdown first, then kills if timeout exceeded.
    ///
    /// # Arguments
    ///
    /// * `timeout` - Maximum time to wait for graceful shutdown
    ///
    /// # Returns
    ///
    /// * `Ok(())` if shutdown successful
    /// * `Err(IpcError)` if shutdown failed
    ///
    /// # Example
    ///
    /// ```rust
    /// handle.shutdown(Duration::from_secs(5))?;
    /// ```
    pub fn shutdown(&mut self, timeout: Duration) -> Result<(), IpcError> {
        if self.state != ProcessState::Running {
            log::debug!("Subprocess not running (state: {})", self.state);
            return Ok(());
        }

        self.shutting_down.store(true, Ordering::SeqCst);
        log::info!("Initiating graceful shutdown of subprocess (PID: {})", self.pid);

        // Try to send shutdown request via stdin
        if let Some(ref mut stdin) = self.stdin {
            let shutdown_request = r#"{"jsonrpc":"2.0","id":0,"method":"shutdown","params":{}}"#;
            if let Err(e) = writeln!(stdin, "{}", shutdown_request) {
                log::warn!("Failed to send shutdown request: {}", e);
            } else if let Err(e) = stdin.flush() {
                log::warn!("Failed to flush shutdown request: {}", e);
            }
        }

        // Wait for graceful exit with timeout
        let start = Instant::now();
        loop {
            match self.try_wait()? {
                Some(status) => {
                    log::info!(
                        "Subprocess exited gracefully (PID: {}, status: {:?})",
                        self.pid,
                        status
                    );
                    return Ok(());
                }
                None => {
                    if start.elapsed() >= timeout {
                        log::warn!(
                            "Graceful shutdown timeout exceeded, killing subprocess (PID: {})",
                            self.pid
                        );
                        return self.kill();
                    }
                    std::thread::sleep(Duration::from_millis(50));
                }
            }
        }
    }

    /// Kill the subprocess forcefully.
    ///
    /// # Returns
    ///
    /// * `Ok(())` if kill successful
    /// * `Err(IpcError)` if kill failed
    pub fn kill(&mut self) -> Result<(), IpcError> {
        if self.state != ProcessState::Running {
            return Ok(());
        }

        log::warn!("Killing subprocess (PID: {})", self.pid);

        self.child
            .kill()
            .map_err(|e| IpcError::IoError(format!("Failed to kill subprocess: {}", e)))?;

        // Wait for process to actually exit
        let _ = self.child.wait();
        self.state = ProcessState::Killed;

        log::info!("Subprocess killed (PID: {})", self.pid);
        Ok(())
    }

    /// Take ownership of stdin.
    pub fn take_stdin(&mut self) -> Option<ChildStdin> {
        self.stdin.take()
    }

    /// Take ownership of stdout.
    pub fn take_stdout(&mut self) -> Option<ChildStdout> {
        self.stdout.take()
    }

    /// Take ownership of stderr.
    pub fn take_stderr(&mut self) -> Option<ChildStderr> {
        self.stderr.take()
    }
}

impl Drop for SubprocessHandle {
    fn drop(&mut self) {
        if self.state == ProcessState::Running {
            log::debug!("SubprocessHandle dropped, killing subprocess");
            let _ = self.kill();
        }
    }
}

// ============================================
// SPAWN FUNCTION
// ============================================

/// Spawn the Python plugin host subprocess.
///
/// Creates a new subprocess with piped stdin/stdout/stderr.
/// Sets PYTHONUNBUFFERED=1 to ensure immediate output.
///
/// # Arguments
///
/// * `config` - Subprocess configuration
///
/// # Returns
///
/// * `Ok(SubprocessHandle)` - Handle to the spawned subprocess
/// * `Err(IpcError)` - Spawn failed
///
/// # Example
///
/// ```rust
/// let config = SubprocessConfig::default();
/// let mut handle = spawn_plugin_host(config)?;
///
/// // Now use handle.stdin, handle.stdout, handle.stderr
/// ```
pub fn spawn_plugin_host(config: SubprocessConfig) -> Result<SubprocessHandle, IpcError> {
    log::info!(
        "Spawning plugin host: {} -m {}",
        config.python_path,
        config.module_path
    );

    // Build command
    let mut cmd = Command::new(&config.python_path);
    cmd.args(config.build_args())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped());

    // Set working directory if configured
    if let Some(ref dir) = config.working_dir {
        log::debug!("Working directory: {:?}", dir);
        cmd.current_dir(dir);
    }

    // CRITICAL: Set PYTHONUNBUFFERED for immediate stdout
    // Without this, Python buffers stdout and Tauri receives nothing
    // until the buffer fills or the process exits.
    // Reference: TECHNICAL_REFERENCES.md §5
    cmd.env("PYTHONUNBUFFERED", "1");

    // Add additional environment variables
    for (key, value) in &config.env_vars {
        cmd.env(key, value);
    }

    // Windows-specific: Prevent console window from appearing
    #[cfg(target_os = "windows")]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }

    // Spawn the process
    let mut child = cmd
        .spawn()
        .map_err(|e| IpcError::SpawnError(format!("Failed to spawn subprocess: {}", e)))?;

    let pid = child.id();
    log::info!("Plugin host spawned with PID: {}", pid);

    // Extract stdio handles
    let stdin = child.stdin.take();
    let stdout = child.stdout.take();
    let stderr = child.stderr.take();

    if stdin.is_none() {
        return Err(IpcError::SpawnError("Failed to get stdin handle".to_string()));
    }
    if stdout.is_none() {
        return Err(IpcError::SpawnError("Failed to get stdout handle".to_string()));
    }
    if stderr.is_none() {
        return Err(IpcError::SpawnError("Failed to get stderr handle".to_string()));
    }

    Ok(SubprocessHandle {
        child,
        stdin,
        stdout,
        stderr,
        pid,
        state: ProcessState::Running,
        spawn_time: Instant::now(),
        config,
        shutting_down: Arc::new(AtomicBool::new(false)),
    })
}

// ============================================
// RESPAWN UTILITIES
// ============================================

/// Attempt to respawn the subprocess with exponential backoff.
///
/// # Arguments
///
/// * `config` - Subprocess configuration
/// * `attempt` - Current attempt number (1-indexed)
///
/// # Returns
///
/// * `Ok(SubprocessHandle)` - Successfully respawned
/// * `Err(IpcError)` - Respawn failed after max attempts
pub fn respawn_with_backoff(
    config: SubprocessConfig,
    attempt: u32,
) -> Result<SubprocessHandle, IpcError> {
    if attempt > config.max_respawn_attempts {
        return Err(IpcError::RespawnFailed(config.max_respawn_attempts));
    }

    // Exponential backoff: base_delay * 2^(attempt-1)
    let delay_ms = config.respawn_delay_ms * (1 << (attempt - 1).min(5));
    log::info!(
        "Respawn attempt {}/{} after {}ms delay",
        attempt,
        config.max_respawn_attempts,
        delay_ms
    );

    std::thread::sleep(Duration::from_millis(delay_ms));

    spawn_plugin_host(config)
}

// ============================================
// STDIO UTILITIES
// ============================================

/// Write a JSON-RPC request to subprocess stdin.
///
/// Writes the JSON string followed by a newline and flushes.
///
/// # Arguments
///
/// * `stdin` - Subprocess stdin handle
/// * `json` - JSON string to write
///
/// # Returns
///
/// * `Ok(())` if write successful
/// * `Err(IpcError)` if write failed
pub fn write_request(stdin: &mut ChildStdin, json: &str) -> Result<(), IpcError> {
    writeln!(stdin, "{}", json)
        .map_err(|e| IpcError::SendError(format!("Failed to write to stdin: {}", e)))?;

    stdin
        .flush()
        .map_err(|e| IpcError::SendError(format!("Failed to flush stdin: {}", e)))?;

    Ok(())
}

/// Create a buffered reader for subprocess stdout.
///
/// # Arguments
///
/// * `stdout` - Subprocess stdout handle
///
/// # Returns
///
/// Buffered reader wrapping stdout
pub fn create_stdout_reader(stdout: ChildStdout) -> BufReader<ChildStdout> {
    BufReader::new(stdout)
}

/// Create a buffered reader for subprocess stderr.
///
/// # Arguments
///
/// * `stderr` - Subprocess stderr handle
///
/// # Returns
///
/// Buffered reader wrapping stderr
pub fn create_stderr_reader(stderr: ChildStderr) -> BufReader<ChildStderr> {
    BufReader::new(stderr)
}

/// Read a single line from a buffered reader.
///
/// # Arguments
///
/// * `reader` - Buffered reader
///
/// # Returns
///
/// * `Ok(Some(line))` - Line read successfully
/// * `Ok(None)` - End of stream
/// * `Err(IpcError)` - Read error
pub fn read_line<R: BufRead>(reader: &mut R) -> Result<Option<String>, IpcError> {
    let mut line = String::new();
    match reader.read_line(&mut line) {
        Ok(0) => Ok(None), // EOF
        Ok(_) => Ok(Some(line)),
        Err(e) => Err(IpcError::IoError(e.to_string())),
    }
}

// ============================================
// TESTS
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_subprocess_config_default() {
        let config = SubprocessConfig::default();

        assert_eq!(config.python_path, "python");
        assert_eq!(config.module_path, "plugins._host");
        assert!(config.working_dir.is_none());
        assert!(config.env_vars.is_empty());
    }

    #[test]
    fn test_subprocess_config_builder() {
        let config = SubprocessConfig::new()
            .with_python_path("python3.11")
            .with_module("my.module")
            .with_working_dir("/tmp")
            .with_env("DEBUG", "1")
            .with_shutdown_timeout(30)
            .with_max_respawn_attempts(5)
            .with_respawn_delay(2000);

        assert_eq!(config.python_path, "python3.11");
        assert_eq!(config.module_path, "my.module");
        assert_eq!(config.working_dir, Some(PathBuf::from("/tmp")));
        assert_eq!(config.env_vars.len(), 1);
        assert_eq!(config.env_vars[0], ("DEBUG".to_string(), "1".to_string()));
        assert_eq!(config.shutdown_timeout_secs, 30);
        assert_eq!(config.max_respawn_attempts, 5);
        assert_eq!(config.respawn_delay_ms, 2000);
    }

    #[test]
    fn test_subprocess_config_multiple_envs() {
        let config = SubprocessConfig::new()
            .with_env("A", "1")
            .with_env("B", "2")
            .with_envs([("C", "3"), ("D", "4")]);

        assert_eq!(config.env_vars.len(), 4);
    }

    #[test]
    fn test_build_args() {
        let config = SubprocessConfig::new().with_module("test.module");

        let args = config.build_args();

        assert_eq!(args, vec!["-m", "test.module"]);
    }

    #[test]
    fn test_process_state_display() {
        assert_eq!(format!("{}", ProcessState::NotStarted), "NOT_STARTED");
        assert_eq!(format!("{}", ProcessState::Running), "RUNNING");
        assert_eq!(format!("{}", ProcessState::Stopped), "STOPPED");
        assert_eq!(format!("{}", ProcessState::Crashed), "CRASHED");
        assert_eq!(format!("{}", ProcessState::Killed), "KILLED");
    }

    #[test]
    fn test_process_state_equality() {
        assert_eq!(ProcessState::Running, ProcessState::Running);
        assert_ne!(ProcessState::Running, ProcessState::Stopped);
    }
}
