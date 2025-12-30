//! D036 - src-tauri/src/commands/mod.rs
//! =====================================
//! Tauri command handlers for frontend-backend communication.
//!
//! Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
//! Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)
//!
//! This module provides:
//! - Tauri commands exposed to React frontend via invoke()
//! - IPC proxy commands for plugin communication
//! - Health and status commands
//! - Plugin management commands
//! - API key management commands (D079)
//!
//! Dependencies:
//!     - D035: manager.rs (IpcManagerState)
//!
//! Usage (Rust):
//!     ```rust
//!     // In main.rs
//!     use commands::*;
//!
//!     tauri::Builder::default()
//!         .manage(IpcManagerState::new(IpcConfig::default()))
//!         .invoke_handler(tauri::generate_handler![
//!             ipc_start,
//!             ipc_stop,
//!             ipc_call,
//!             ipc_status,
//!             plugin_list,
//!             plugin_load,
//!             plugin_unload,
//!             health_check,
//!         ])
//!         .run(tauri::generate_context!())
//!         .expect("error while running tauri application");
//!     ```
//!
//! Usage (TypeScript):
//!     ```typescript
//!     import { invoke } from '@tauri-apps/api/tauri';
//!
//!     // Start IPC
//!     await invoke('ipc_start');
//!
//!     // Call plugin method
//!     const result = await invoke('ipc_call', {
//!         method: 'plugin/list',
//!         params: {}
//!     });
//!
//!     // Get status
//!     const status = await invoke('ipc_status');
//!     ```

pub mod compiler;
pub mod secrets;

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use tauri::State;

use crate::ipc::manager::{IpcManagerState, ManagerStats};
use crate::ipc::health::HealthStatus;
use crate::ipc::IpcError;

// ============================================
// COMMAND ERROR TYPE
// ============================================

/// Error type for Tauri commands.
///
/// Implements `serde::Serialize` as required by Tauri.
#[derive(Debug, Clone, Serialize)]
pub struct CommandError {
    /// Error code
    pub code: String,
    /// Error message
    pub message: String,
    /// Additional details
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<Value>,
}

impl From<IpcError> for CommandError {
    fn from(e: IpcError) -> Self {
        let (code, message) = match &e {
            IpcError::SpawnError(msg) => ("SPAWN_ERROR", msg.clone()),
            IpcError::NotRunning => ("NOT_RUNNING", "Subprocess not running".to_string()),
            IpcError::SendError(msg) => ("SEND_ERROR", msg.clone()),
            IpcError::Timeout(secs) => ("TIMEOUT", format!("Request timed out after {} seconds", secs)),
            IpcError::SubprocessCrashed => ("SUBPROCESS_CRASHED", "Subprocess crashed".to_string()),
            IpcError::RpcError { code, message } => {
                return Self {
                    code: format!("RPC_ERROR_{}", code),
                    message: message.clone(),
                    details: Some(json!({ "rpc_code": code })),
                };
            }
            IpcError::ResponseMissing(id) => ("RESPONSE_MISSING", format!("Response missing for request {}", id)),
            IpcError::IoError(msg) => ("IO_ERROR", msg.clone()),
            IpcError::JsonError(msg) => ("JSON_ERROR", msg.clone()),
            IpcError::RespawnFailed(attempts) => ("RESPAWN_FAILED", format!("Respawn failed after {} attempts", attempts)),
            IpcError::ChannelClosed => ("CHANNEL_CLOSED", "Communication channel closed".to_string()),
            IpcError::NotInitialized => ("NOT_INITIALIZED", "IPC not initialized".to_string()),
            IpcError::ShuttingDown => ("SHUTTING_DOWN", "System is shutting down".to_string()),
        };

        Self {
            code: code.to_string(),
            message,
            details: None,
        }
    }
}

impl std::fmt::Display for CommandError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

// ============================================
// COMMAND RESULT TYPE
// ============================================

/// Result type for Tauri commands.
pub type CommandResult<T> = Result<T, CommandError>;

// ============================================
// IPC LIFECYCLE COMMANDS
// ============================================

/// Start the IPC Manager and Python subprocess.
///
/// # Returns
///
/// * `Ok(())` - IPC started successfully
/// * `Err(CommandError)` - Failed to start
///
/// # Example (TypeScript)
///
/// ```typescript
/// await invoke('ipc_start');
/// ```
#[tauri::command]
pub async fn ipc_start(state: State<'_, IpcManagerState>) -> CommandResult<()> {
    log::info!("Command: ipc_start");
    state.start().await.map_err(CommandError::from)
}

/// Stop the IPC Manager and Python subprocess.
///
/// # Returns
///
/// * `Ok(())` - IPC stopped successfully
/// * `Err(CommandError)` - Failed to stop
///
/// # Example (TypeScript)
///
/// ```typescript
/// await invoke('ipc_stop');
/// ```
#[tauri::command]
pub async fn ipc_stop(state: State<'_, IpcManagerState>) -> CommandResult<()> {
    log::info!("Command: ipc_stop");
    state.shutdown().await.map_err(CommandError::from)
}

/// Get IPC Manager status and statistics.
///
/// # Returns
///
/// Manager statistics including lifecycle state, health, and request counts.
///
/// # Example (TypeScript)
///
/// ```typescript
/// const status = await invoke('ipc_status');
/// console.log(status.lifecycle_state, status.health_status);
/// ```
#[tauri::command]
pub async fn ipc_status(state: State<'_, IpcManagerState>) -> CommandResult<ManagerStats> {
    log::debug!("Command: ipc_status");
    Ok(state.stats().await)
}

/// Check if IPC is ready to accept requests.
///
/// # Returns
///
/// `true` if IPC is ready, `false` otherwise.
///
/// # Example (TypeScript)
///
/// ```typescript
/// const ready = await invoke('ipc_ready');
/// if (ready) {
///     // Safe to make IPC calls
/// }
/// ```
#[tauri::command]
pub async fn ipc_ready(state: State<'_, IpcManagerState>) -> CommandResult<bool> {
    Ok(state.is_ready().await)
}

// ============================================
// IPC CALL COMMANDS
// ============================================

/// Generic IPC call to Python subprocess.
///
/// # Arguments
///
/// * `method` - JSON-RPC method name
/// * `params` - Method parameters (optional, defaults to empty object)
///
/// # Returns
///
/// JSON-RPC result value.
///
/// # Example (TypeScript)
///
/// ```typescript
/// const result = await invoke('ipc_call', {
///     method: 'plugin/list',
///     params: { filter: 'tts' }
/// });
/// ```
#[tauri::command]
pub async fn ipc_call(
    state: State<'_, IpcManagerState>,
    method: String,
    params: Option<Value>,
) -> CommandResult<Value> {
    log::debug!("Command: ipc_call method={}", method);
    let params = params.unwrap_or(json!({}));
    state.call(method, params).await.map_err(CommandError::from)
}

/// Batch IPC call - send multiple requests.
///
/// # Arguments
///
/// * `requests` - Array of {method, params} objects
///
/// # Returns
///
/// Array of results (or errors) in the same order.
///
/// # Example (TypeScript)
///
/// ```typescript
/// const results = await invoke('ipc_batch', {
///     requests: [
///         { method: 'plugin/list', params: {} },
///         { method: 'health', params: {} }
///     ]
/// });
/// ```
#[derive(Debug, Deserialize)]
pub struct BatchRequest {
    pub method: String,
    pub params: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct BatchResult {
    pub success: bool,
    pub result: Option<Value>,
    pub error: Option<CommandError>,
}

#[tauri::command]
pub async fn ipc_batch(
    state: State<'_, IpcManagerState>,
    requests: Vec<BatchRequest>,
) -> CommandResult<Vec<BatchResult>> {
    log::debug!("Command: ipc_batch count={}", requests.len());

    let mut results = Vec::with_capacity(requests.len());

    for req in requests {
        let params = req.params.unwrap_or(json!({}));
        let result = match state.call(&req.method, params).await {
            Ok(value) => BatchResult {
                success: true,
                result: Some(value),
                error: None,
            },
            Err(e) => BatchResult {
                success: false,
                result: None,
                error: Some(CommandError::from(e)),
            },
        };
        results.push(result);
    }

    Ok(results)
}

// ============================================
// PLUGIN MANAGEMENT COMMANDS
// ============================================

/// List all available plugins.
///
/// # Returns
///
/// Array of plugin information objects.
///
/// # Example (TypeScript)
///
/// ```typescript
/// const plugins = await invoke('plugin_list');
/// for (const plugin of plugins) {
///     console.log(plugin.name, plugin.status);
/// }
/// ```
#[tauri::command]
pub async fn plugin_list(state: State<'_, IpcManagerState>) -> CommandResult<Value> {
    log::debug!("Command: plugin_list");
    state.call("plugin/list", json!({})).await.map_err(CommandError::from)
}

/// Get information about a specific plugin.
///
/// # Arguments
///
/// * `name` - Plugin name
///
/// # Returns
///
/// Plugin information object.
///
/// # Example (TypeScript)
///
/// ```typescript
/// const info = await invoke('plugin_info', { name: 'tts_kokoro' });
/// ```
#[tauri::command]
pub async fn plugin_info(
    state: State<'_, IpcManagerState>,
    name: String,
) -> CommandResult<Value> {
    log::debug!("Command: plugin_info name={}", name);
    state.call("plugin/info", json!({ "name": name })).await.map_err(CommandError::from)
}

/// Load a plugin.
///
/// # Arguments
///
/// * `name` - Plugin name to load
///
/// # Returns
///
/// Plugin load result.
///
/// # Example (TypeScript)
///
/// ```typescript
/// await invoke('plugin_load', { name: 'tts_kokoro' });
/// ```
#[tauri::command]
pub async fn plugin_load(
    state: State<'_, IpcManagerState>,
    name: String,
) -> CommandResult<Value> {
    log::info!("Command: plugin_load name={}", name);
    state.call("plugin/load", json!({ "name": name })).await.map_err(CommandError::from)
}

/// Unload a plugin.
///
/// # Arguments
///
/// * `name` - Plugin name to unload
///
/// # Returns
///
/// Plugin unload result.
///
/// # Example (TypeScript)
///
/// ```typescript
/// await invoke('plugin_unload', { name: 'tts_kokoro' });
/// ```
#[tauri::command]
pub async fn plugin_unload(
    state: State<'_, IpcManagerState>,
    name: String,
) -> CommandResult<Value> {
    log::info!("Command: plugin_unload name={}", name);
    state.call("plugin/unload", json!({ "name": name })).await.map_err(CommandError::from)
}

/// Hot-swap a plugin with another.
///
/// # Arguments
///
/// * `old_name` - Plugin to unload
/// * `new_name` - Plugin to load in its place
///
/// # Returns
///
/// Swap result.
///
/// # Example (TypeScript)
///
/// ```typescript
/// await invoke('plugin_swap', {
///     old_name: 'tts_old',
///     new_name: 'tts_new'
/// });
/// ```
#[tauri::command]
pub async fn plugin_swap(
    state: State<'_, IpcManagerState>,
    old_name: String,
    new_name: String,
) -> CommandResult<Value> {
    log::info!("Command: plugin_swap {} -> {}", old_name, new_name);
    state.call("plugin/swap", json!({
        "old": old_name,
        "new": new_name
    })).await.map_err(CommandError::from)
}

/// Call a method on a specific plugin.
///
/// # Arguments
///
/// * `plugin` - Plugin name
/// * `method` - Method name
/// * `args` - Method arguments
///
/// # Returns
///
/// Method result.
///
/// # Example (TypeScript)
///
/// ```typescript
/// const audio = await invoke('plugin_call', {
///     plugin: 'tts_kokoro',
///     method: 'synthesize',
///     args: { text: 'Hello world', voice: 'af_bella' }
/// });
/// ```
#[tauri::command]
pub async fn plugin_call(
    state: State<'_, IpcManagerState>,
    plugin: String,
    method: String,
    args: Option<Value>,
) -> CommandResult<Value> {
    log::debug!("Command: plugin_call plugin={} method={}", plugin, method);
    state.call("plugin/call", json!({
        "plugin": plugin,
        "method": method,
        "args": args.unwrap_or(json!({}))
    })).await.map_err(CommandError::from)
}

// ============================================
// HEALTH COMMANDS
// ============================================

/// Get health status of the subprocess.
///
/// # Returns
///
/// Health status object.
///
/// # Example (TypeScript)
///
/// ```typescript
/// const health = await invoke('health_check');
/// console.log(health.is_healthy, health.last_latency_ms);
/// ```
#[tauri::command]
pub async fn health_check(state: State<'_, IpcManagerState>) -> CommandResult<HealthStatus> {
    log::debug!("Command: health_check");
    Ok(state.health().status())
}

/// Ping the subprocess to check connectivity.
///
/// # Returns
///
/// * `Ok("pong")` if subprocess responds
/// * `Err(CommandError)` if ping fails
///
/// # Example (TypeScript)
///
/// ```typescript
/// const response = await invoke('ping');
/// console.log(response); // "pong"
/// ```
#[tauri::command]
pub async fn ping(state: State<'_, IpcManagerState>) -> CommandResult<Value> {
    log::debug!("Command: ping");
    state.call("ping", json!({})).await.map_err(CommandError::from)
}

// ============================================
// DISCOVERY COMMANDS
// ============================================

/// Discover available plugins in the plugins directory.
///
/// # Returns
///
/// Array of discovered plugin metadata.
///
/// # Example (TypeScript)
///
/// ```typescript
/// const discovered = await invoke('discover_plugins');
/// ```
#[tauri::command]
pub async fn discover_plugins(state: State<'_, IpcManagerState>) -> CommandResult<Value> {
    log::info!("Command: discover_plugins");
    state.call("plugin/discover", json!({})).await.map_err(CommandError::from)
}

/// Scan for new plugins and refresh the registry.
///
/// # Returns
///
/// Scan results.
///
/// # Example (TypeScript)
///
/// ```typescript
/// const result = await invoke('scan_plugins');
/// console.log(`Found ${result.new_plugins} new plugins`);
/// ```
#[tauri::command]
pub async fn scan_plugins(state: State<'_, IpcManagerState>) -> CommandResult<Value> {
    log::info!("Command: scan_plugins");
    state.call("plugin/scan", json!({})).await.map_err(CommandError::from)
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/// Generate the Tauri invoke handler with all commands.
///
/// # Usage
///
/// ```rust
/// tauri::Builder::default()
///     .invoke_handler(commands::get_invoke_handler())
///     .run(tauri::generate_context!())
/// ```
#[macro_export]
macro_rules! generate_command_handler {
    () => {
        tauri::generate_handler![
            // IPC lifecycle commands
            $crate::commands::ipc_start,
            $crate::commands::ipc_stop,
            $crate::commands::ipc_status,
            $crate::commands::ipc_ready,
            $crate::commands::ipc_call,
            $crate::commands::ipc_batch,
            // Plugin management commands
            $crate::commands::plugin_list,
            $crate::commands::plugin_info,
            $crate::commands::plugin_load,
            $crate::commands::plugin_unload,
            $crate::commands::plugin_swap,
            $crate::commands::plugin_call,
            // Health commands
            $crate::commands::health_check,
            $crate::commands::ping,
            // Discovery commands
            $crate::commands::discover_plugins,
            $crate::commands::scan_plugins,
            // API Key management commands (D079)
            $crate::commands::secrets::get_api_keys,
            $crate::commands::secrets::add_api_key,
            $crate::commands::secrets::update_api_key,
            $crate::commands::secrets::delete_api_key,
            $crate::commands::secrets::get_active_api_key,
            $crate::commands::secrets::set_active_api_key,
            $crate::commands::secrets::get_active_api_key_value,
            $crate::commands::secrets::get_configured_services,
            // Compiler command
            $crate::commands::compiler::compile_tsx,
        ]
    };
}

pub use generate_command_handler;

// ============================================
// TESTS
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_command_error_from_ipc_error() {
        let error = CommandError::from(IpcError::NotRunning);
        assert_eq!(error.code, "NOT_RUNNING");

        let error = CommandError::from(IpcError::Timeout(30));
        assert_eq!(error.code, "TIMEOUT");
        assert!(error.message.contains("30"));

        let error = CommandError::from(IpcError::RpcError {
            code: -32601,
            message: "Method not found".to_string(),
        });
        assert_eq!(error.code, "RPC_ERROR_-32601");
    }

    #[test]
    fn test_batch_request() {
        let json = r#"{"method": "test", "params": {"key": "value"}}"#;
        let req: BatchRequest = serde_json::from_str(json).unwrap();

        assert_eq!(req.method, "test");
        assert!(req.params.is_some());
    }

    #[test]
    fn test_batch_result_serialization() {
        let result = BatchResult {
            success: true,
            result: Some(json!("ok")),
            error: None,
        };

        let json = serde_json::to_string(&result).unwrap();
        assert!(json.contains("\"success\":true"));
        assert!(json.contains("\"result\":\"ok\""));
    }
}
