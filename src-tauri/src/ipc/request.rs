//! D031 - src-tauri/src/ipc/request.rs
//! ====================================
//! JSON-RPC request building and sending implementation.

// Allow dead code - these are library types for external use
#![allow(dead_code)]
//!
//! Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
//! Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)
//!
//! This module provides:
//! - `JsonRpcRequest` structure matching JSON-RPC 2.0 spec
//! - `RequestBuilder` for fluent request construction
//! - `send_request()` implementation for `IpcManager`
//!
//! Dependencies:
//!     - D030: mod.rs (`IpcManager`, `IpcError`)
//!     - D009: `config/error_codes.yaml` (error codes reference)
//!
//! Usage:
//!     ```rust
//!     // Using RequestBuilder
//!     let request = RequestBuilder::new("plugin/list")
//!         .with_param("filter", "tts")
//!         .build(1);
//!     
//!     // Using IpcManager
//!     let response = manager.send_request("ping", json!({})).await?;
//!     ```

use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::time::Duration;
use tokio::sync::oneshot;
use tokio::time::timeout;

use super::{IpcError, IpcManager, WriterMessage};

// ============================================
// JSON-RPC REQUEST
// ============================================

/// JSON-RPC 2.0 Request object.
///
/// Conforms to the JSON-RPC 2.0 specification:
/// - `jsonrpc`: Always "2.0"
/// - `id`: Request identifier for matching responses
/// - `method`: Method name to invoke
/// - `params`: Method parameters (object or array)
///
/// # Example
///
/// ```rust
/// let request = JsonRpcRequest::new(1, "plugin/load", json!({"name": "tts_kokoro"}));
/// let json_str = request.to_json()?;
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcRequest {
    /// JSON-RPC version (always "2.0")
    pub jsonrpc: String,
    
    /// Request identifier (matches response id)
    pub id: u64,
    
    /// Method name to invoke
    pub method: String,
    
    /// Method parameters
    #[serde(skip_serializing_if = "Value::is_null")]
    pub params: Value,
}

impl JsonRpcRequest {
    /// Create a new JSON-RPC request.
    ///
    /// # Arguments
    ///
    /// * `id` - Unique request identifier
    /// * `method` - Method name to invoke
    /// * `params` - Method parameters (use `json!({})` for empty)
    ///
    /// # Example
    ///
    /// ```rust
    /// let request = JsonRpcRequest::new(
    ///     42,
    ///     "tts/synthesize",
    ///     json!({"text": "Hello", "voice": "default"})
    /// );
    /// ```
    pub fn new(id: u64, method: impl Into<String>, params: Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            method: method.into(),
            params,
        }
    }

    /// Create a notification (request without id).
    ///
    /// Notifications don't expect a response.
    ///
    /// # Arguments
    ///
    /// * `method` - Method name to invoke
    /// * `params` - Method parameters
    ///
    /// # Example
    ///
    /// ```rust
    /// let notification = JsonRpcRequest::notification("log/event", json!({"event": "startup"}));
    /// ```
    pub fn notification(method: impl Into<String>, params: Value) -> JsonRpcNotification {
        JsonRpcNotification {
            jsonrpc: "2.0".to_string(),
            method: method.into(),
            params,
        }
    }

    /// Serialize request to JSON string.
    ///
    /// # Returns
    ///
    /// * `Ok(String)` - JSON string
    /// * `Err(IpcError)` - Serialization failed
    pub fn to_json(&self) -> Result<String, IpcError> {
        serde_json::to_string(self).map_err(|e| IpcError::JsonError(e.to_string()))
    }

    /// Serialize request to JSON string with pretty formatting.
    ///
    /// Useful for logging and debugging.
    pub fn to_json_pretty(&self) -> Result<String, IpcError> {
        serde_json::to_string_pretty(self).map_err(|e| IpcError::JsonError(e.to_string()))
    }
}

// ============================================
// JSON-RPC NOTIFICATION
// ============================================

/// JSON-RPC 2.0 Notification (no id, no response expected).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcNotification {
    pub jsonrpc: String,
    pub method: String,
    #[serde(skip_serializing_if = "Value::is_null")]
    pub params: Value,
}

impl JsonRpcNotification {
    /// Serialize notification to JSON string.
    pub fn to_json(&self) -> Result<String, IpcError> {
        serde_json::to_string(self).map_err(|e| IpcError::JsonError(e.to_string()))
    }
}

// ============================================
// REQUEST BUILDER
// ============================================

/// Fluent builder for constructing JSON-RPC requests.
///
/// Provides a convenient way to build requests with method chaining.
///
/// # Example
///
/// ```rust
/// let request = RequestBuilder::new("plugin/swap")
///     .with_param("old", "tts_old_plugin")
///     .with_param("new", "tts_new_plugin")
///     .with_param("config", json!({"voice": "en-us"}))
///     .build(request_id);
/// ```
#[derive(Debug, Clone)]
pub struct RequestBuilder {
    method: String,
    params: serde_json::Map<String, Value>,
}

impl RequestBuilder {
    /// Create a new request builder.
    ///
    /// # Arguments
    ///
    /// * `method` - Method name to invoke
    ///
    /// # Example
    ///
    /// ```rust
    /// let builder = RequestBuilder::new("ping");
    /// ```
    pub fn new(method: impl Into<String>) -> Self {
        Self {
            method: method.into(),
            params: serde_json::Map::new(),
        }
    }

    /// Add a parameter to the request.
    ///
    /// # Arguments
    ///
    /// * `key` - Parameter name
    /// * `value` - Parameter value (must be serializable)
    ///
    /// # Example
    ///
    /// ```rust
    /// let builder = RequestBuilder::new("tts/synthesize")
    ///     .with_param("text", "Hello world")
    ///     .with_param("speed", 1.0);
    /// ```
    pub fn with_param<V: Serialize>(mut self, key: impl Into<String>, value: V) -> Self {
        let key = key.into();
        match serde_json::to_value(value) {
            Ok(v) => {
                self.params.insert(key, v);
            }
            Err(e) => {
                log::warn!("Failed to serialize param '{key}': {e}");
            }
        }
        self
    }

    /// Add multiple parameters from a JSON value.
    ///
    /// # Arguments
    ///
    /// * `params` - JSON object with parameters to add
    ///
    /// # Example
    ///
    /// ```rust
    /// let builder = RequestBuilder::new("plugin/load")
    ///     .with_params(json!({"name": "my_plugin", "auto_init": true}));
    /// ```
    pub fn with_params(mut self, params: Value) -> Self {
        if let Value::Object(map) = params {
            for (k, v) in map {
                self.params.insert(k, v);
            }
        } else {
            log::warn!("with_params expected object, got: {params:?}");
        }
        self
    }

    /// Build the final request.
    ///
    /// # Arguments
    ///
    /// * `id` - Request identifier
    ///
    /// # Returns
    ///
    /// Complete `JsonRpcRequest` ready to send
    pub fn build(self, id: u64) -> JsonRpcRequest {
        let params = if self.params.is_empty() {
            Value::Null
        } else {
            Value::Object(self.params)
        };

        JsonRpcRequest::new(id, self.method, params)
    }

    /// Build and serialize to JSON string.
    ///
    /// # Arguments
    ///
    /// * `id` - Request identifier
    ///
    /// # Returns
    ///
    /// * `Ok(String)` - JSON string
    /// * `Err(IpcError)` - Serialization failed
    pub fn build_json(self, id: u64) -> Result<String, IpcError> {
        self.build(id).to_json()
    }
}

// ============================================
// IPC MANAGER SEND IMPLEMENTATION
// ============================================

impl IpcManager {
    /// Send a JSON-RPC request and wait for response.
    ///
    /// This is the primary method for communicating with the Python subprocess.
    /// It handles:
    /// - Request ID generation
    /// - JSON serialization
    /// - Sending via stdin channel
    /// - Response matching by ID
    /// - Timeout handling
    ///
    /// # Arguments
    ///
    /// * `method` - Method name to invoke
    /// * `params` - Method parameters
    ///
    /// # Returns
    ///
    /// * `Ok(Value)` - Success result from JSON-RPC response
    /// * `Err(IpcError)` - Request failed
    ///
    /// # Example
    ///
    /// ```rust
    /// let result = manager.send_request("plugin/list", json!({})).await?;
    /// let plugins: Vec<Plugin> = serde_json::from_value(result)?;
    /// ```
    pub async fn send_request(
        &self,
        method: impl Into<String>,
        params: Value,
    ) -> Result<Value, IpcError> {
        // Check state
        if !self.is_running() {
            return Err(IpcError::NotRunning);
        }

        if self.is_shutting_down() {
            return Err(IpcError::ShuttingDown);
        }

        let method = method.into();
        let id = self.next_request_id();

        log::debug!("Sending request: id={id}, method={method}");

        // Build request
        let request = JsonRpcRequest::new(id, &method, params);
        let json = request.to_json()?;

        // Create response channel
        let (tx, rx) = oneshot::channel();

        // Register pending request
        {
            let mut pending = self.pending.write().await;
            pending.insert(id, tx);
        }

        // Send request to writer task
        let writer_tx = self
            .writer_tx
            .as_ref()
            .ok_or(IpcError::NotInitialized)?;

        writer_tx
            .send(WriterMessage::Request(json))
            .await
            .map_err(|_| IpcError::ChannelClosed)?;

        // Update stats
        self.request_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);

        // Wait for response with timeout
        let timeout_duration = Duration::from_secs(self.timeout_secs);
        
        match timeout(timeout_duration, rx).await {
            Ok(Ok(Ok(response))) => {
                // Response received successfully
                log::debug!("Response received: id={id}");
                
                // Check for JSON-RPC error
                if let Some(error) = response.error {
                    self.error_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                    return Err(IpcError::RpcError {
                        code: error.code,
                        message: error.message,
                    });
                }

                // Return result
                Ok(response.result.unwrap_or(Value::Null))
            }
            Ok(Ok(Err(e))) => {
                // IpcError from reader task
                self.error_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                log::error!("Request error: id={id}, error={e}");
                Err(e)
            }
            Ok(Err(_)) => {
                // Channel was dropped
                self.error_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                
                // Remove from pending
                let mut pending = self.pending.write().await;
                pending.remove(&id);
                
                log::error!("Response channel closed: id={id}");
                Err(IpcError::ChannelClosed)
            }
            Err(_) => {
                // Timeout
                self.error_count.fetch_add(1, std::sync::atomic::Ordering::SeqCst);
                
                // Remove from pending
                let mut pending = self.pending.write().await;
                pending.remove(&id);
                
                log::error!("Request timeout: id={id}, method={method}");
                Err(IpcError::Timeout(self.timeout_secs))
            }
        }
    }

    /// Send a request using `RequestBuilder`.
    ///
    /// Convenience method for using the builder pattern.
    ///
    /// # Arguments
    ///
    /// * `builder` - Configured `RequestBuilder`
    ///
    /// # Returns
    ///
    /// * `Ok(Value)` - Success result
    /// * `Err(IpcError)` - Request failed
    ///
    /// # Example
    ///
    /// ```rust
    /// let result = manager.send_builder(
    ///     RequestBuilder::new("plugin/load")
    ///         .with_param("name", "tts_kokoro")
    /// ).await?;
    /// ```
    pub async fn send_builder(&self, builder: RequestBuilder) -> Result<Value, IpcError> {
        let id = self.next_request_id();
        let request = builder.build(id);
        self.send_request(request.method, request.params).await
    }

    /// Send a notification (no response expected).
    ///
    /// Notifications are fire-and-forget requests without an ID.
    ///
    /// # Arguments
    ///
    /// * `method` - Method name
    /// * `params` - Method parameters
    ///
    /// # Returns
    ///
    /// * `Ok(())` - Notification sent
    /// * `Err(IpcError)` - Send failed
    ///
    /// # Example
    ///
    /// ```rust
    /// manager.send_notification("log/event", json!({"type": "user_action"})).await?;
    /// ```
    pub async fn send_notification(
        &self,
        method: impl Into<String>,
        params: Value,
    ) -> Result<(), IpcError> {
        if !self.is_running() {
            return Err(IpcError::NotRunning);
        }

        let notification = JsonRpcRequest::notification(method, params);
        let json = notification.to_json()?;

        let writer_tx = self
            .writer_tx
            .as_ref()
            .ok_or(IpcError::NotInitialized)?;

        writer_tx
            .send(WriterMessage::Request(json))
            .await
            .map_err(|_| IpcError::ChannelClosed)?;

        Ok(())
    }

    /// Convenience method: call with method name and params.
    ///
    /// Alias for `send_request` with simpler name.
    ///
    /// # Example
    ///
    /// ```rust
    /// let result = manager.call("ping", json!({})).await?;
    /// assert_eq!(result, json!("pong"));
    /// ```
    pub async fn call(
        &self,
        method: impl Into<String>,
        params: Value,
    ) -> Result<Value, IpcError> {
        self.send_request(method, params).await
    }

    /// Convenience method: call with no parameters.
    ///
    /// # Example
    ///
    /// ```rust
    /// let result = manager.call_no_params("status").await?;
    /// ```
    pub async fn call_no_params(&self, method: impl Into<String>) -> Result<Value, IpcError> {
        self.send_request(method, json!({})).await
    }
}

// ============================================
// COMMON REQUEST HELPERS
// ============================================

/// Pre-built request for common operations.
pub struct CommonRequests;

impl CommonRequests {
    /// Build a ping request.
    pub fn ping() -> RequestBuilder {
        RequestBuilder::new("ping")
    }

    /// Build a status request.
    pub fn status() -> RequestBuilder {
        RequestBuilder::new("status")
    }

    /// Build a shutdown request.
    pub fn shutdown() -> RequestBuilder {
        RequestBuilder::new("shutdown")
    }

    /// Build a plugin/list request.
    pub fn plugin_list() -> RequestBuilder {
        RequestBuilder::new("plugin/list")
    }

    /// Build a plugin/load request.
    pub fn plugin_load(name: impl Into<String>) -> RequestBuilder {
        RequestBuilder::new("plugin/load").with_param("name", name.into())
    }

    /// Build a plugin/unload request.
    pub fn plugin_unload(name: impl Into<String>) -> RequestBuilder {
        RequestBuilder::new("plugin/unload").with_param("name", name.into())
    }

    /// Build a plugin/swap request.
    pub fn plugin_swap(
        old_name: impl Into<String>,
        new_name: impl Into<String>,
    ) -> RequestBuilder {
        RequestBuilder::new("plugin/swap")
            .with_param("old", old_name.into())
            .with_param("new", new_name.into())
    }

    /// Build a plugin/health request.
    pub fn plugin_health(name: Option<String>) -> RequestBuilder {
        let mut builder = RequestBuilder::new("plugin/health");
        if let Some(n) = name {
            builder = builder.with_param("name", n);
        }
        builder
    }
}

// ============================================
// TESTS
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_json_rpc_request() {
        let request = JsonRpcRequest::new(1, "test/method", json!({"key": "value"}));
        
        assert_eq!(request.jsonrpc, "2.0");
        assert_eq!(request.id, 1);
        assert_eq!(request.method, "test/method");
        assert_eq!(request.params, json!({"key": "value"}));
    }

    #[test]
    fn test_request_serialization() {
        let request = JsonRpcRequest::new(42, "ping", json!({}));
        let json = request.to_json().unwrap();
        
        let parsed: Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["jsonrpc"], "2.0");
        assert_eq!(parsed["id"], 42);
        assert_eq!(parsed["method"], "ping");
    }

    #[test]
    fn test_request_builder() {
        let request = RequestBuilder::new("plugin/load")
            .with_param("name", "test_plugin")
            .with_param("auto_init", true)
            .build(100);
        
        assert_eq!(request.method, "plugin/load");
        assert_eq!(request.params["name"], "test_plugin");
        assert_eq!(request.params["auto_init"], true);
    }

    #[test]
    fn test_request_builder_with_params() {
        let request = RequestBuilder::new("tts/synthesize")
            .with_params(json!({
                "text": "Hello",
                "voice": "default"
            }))
            .build(1);
        
        assert_eq!(request.params["text"], "Hello");
        assert_eq!(request.params["voice"], "default");
    }

    #[test]
    fn test_notification() {
        let notification = JsonRpcRequest::notification("log/event", json!({"type": "test"}));
        let json = notification.to_json().unwrap();
        
        let parsed: Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["jsonrpc"], "2.0");
        assert_eq!(parsed["method"], "log/event");
        assert!(parsed.get("id").is_none());
    }

    #[test]
    fn test_common_requests() {
        let ping = CommonRequests::ping().build(1);
        assert_eq!(ping.method, "ping");
        
        let load = CommonRequests::plugin_load("my_plugin").build(2);
        assert_eq!(load.method, "plugin/load");
        assert_eq!(load.params["name"], "my_plugin");
        
        let swap = CommonRequests::plugin_swap("old", "new").build(3);
        assert_eq!(swap.params["old"], "old");
        assert_eq!(swap.params["new"], "new");
    }

    #[test]
    fn test_empty_params() {
        let request = RequestBuilder::new("ping").build(1);
        
        // Empty params should serialize as null or be omitted
        assert!(request.params.is_null());
    }
}
