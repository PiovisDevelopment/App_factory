//! D032 - src-tauri/src/ipc/response.rs
//! =====================================
//! JSON-RPC response parsing and handling implementation.

// Allow dead code - these are library types for external use
#![allow(dead_code)]
//!
//! Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
//! Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)
//!
//! This module provides:
//! - `JsonRpcResponse` structure matching JSON-RPC 2.0 spec
//! - `JsonRpcError` for error responses
//! - `ResponseResult` helper for handling success/error
//! - Response parsing utilities
//!
//! Dependencies:
//!     - D030: mod.rs (`IpcError`)
//!     - D009: `config/error_codes.yaml` (error codes)
//!
//! Usage:
//!     ```rust
//!     let response: JsonRpcResponse = serde_json::from_str(&json_line)?;
//!     
//!     match response.into_result() {
//!         Ok(value) => println!("Success: {:?}", value),
//!         Err(error) => println!("Error: {}", error),
//!     }
//!     ```

use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::fmt;

use super::IpcError;

// ============================================
// JSON-RPC ERROR CODES (from D009)
// ============================================

/// Standard JSON-RPC 2.0 error codes.
pub mod error_codes {
    /// Parse error: Invalid JSON was received.
    pub const PARSE_ERROR: i32 = -32700;
    
    /// Invalid Request: The JSON sent is not a valid Request object.
    pub const INVALID_REQUEST: i32 = -32600;
    
    /// Method not found: The method does not exist / is not available.
    pub const METHOD_NOT_FOUND: i32 = -32601;
    
    /// Invalid params: Invalid method parameter(s).
    pub const INVALID_PARAMS: i32 = -32602;
    
    /// Internal error: Internal JSON-RPC error.
    pub const INTERNAL_ERROR: i32 = -32603;
    
    // Server errors (implementation-defined)
    
    /// Plugin not found: The requested plugin is not loaded.
    pub const PLUGIN_NOT_FOUND: i32 = -32000;
    
    /// Plugin not ready: The plugin exists but is not in READY state.
    pub const PLUGIN_NOT_READY: i32 = -32001;
    
    /// Plugin load failed: Failed to load the plugin.
    pub const PLUGIN_LOAD_FAILED: i32 = -32002;
    
    /// Plugin initialization failed: Plugin loaded but `initialize()` failed.
    pub const PLUGIN_INITIALIZE_FAILED: i32 = -32003;
    
    /// Plugin shutdown failed: Plugin `shutdown()` method failed.
    pub const PLUGIN_SHUTDOWN_FAILED: i32 = -32004;
    
    /// Plugin already loaded: Attempted to load an already loaded plugin.
    pub const PLUGIN_ALREADY_LOADED: i32 = -32005;
    
    /// Contract mismatch: Plugin does not implement expected contract.
    pub const CONTRACT_MISMATCH: i32 = -32010;
    
    /// Contract not found: The specified contract type does not exist.
    pub const CONTRACT_NOT_FOUND: i32 = -32011;
    
    /// Manifest invalid: Plugin manifest.json does not conform to schema.
    pub const MANIFEST_INVALID: i32 = -32012;
    
    /// Manifest missing: Plugin folder does not contain manifest.json.
    pub const MANIFEST_MISSING: i32 = -32013;
    
    /// Hot-swap failed: Failed to swap plugin, original restored.
    pub const HOTSWAP_FAILED: i32 = -32020;
    
    /// Hot-swap rollback failed: Hot-swap and rollback both failed.
    pub const HOTSWAP_ROLLBACK_FAILED: i32 = -32021;
    
    /// Discovery failed: Plugin discovery scan failed.
    pub const DISCOVERY_FAILED: i32 = -32030;
    
    /// Health check timeout: Plugin health check did not respond.
    pub const HEALTH_CHECK_TIMEOUT: i32 = -32040;
    
    /// Resource exhausted: System resources exhausted.
    pub const RESOURCE_EXHAUSTED: i32 = -32050;
    
    /// Dependency missing: Required Python package not installed.
    pub const DEPENDENCY_MISSING: i32 = -32051;
    
    /// Model not found: Required model file not available.
    pub const MODEL_NOT_FOUND: i32 = -32052;
    
    /// Check if error code is a standard JSON-RPC error.
    pub fn is_standard_error(code: i32) -> bool {
        (-32700..=-32600).contains(&code)
    }
    
    /// Check if error code is a server error.
    pub fn is_server_error(code: i32) -> bool {
        (-32099..=-32000).contains(&code)
    }
    
    /// Get human-readable description for error code.
    pub fn description(code: i32) -> &'static str {
        match code {
            PARSE_ERROR => "Parse error",
            INVALID_REQUEST => "Invalid Request",
            METHOD_NOT_FOUND => "Method not found",
            INVALID_PARAMS => "Invalid params",
            INTERNAL_ERROR => "Internal error",
            PLUGIN_NOT_FOUND => "Plugin not found",
            PLUGIN_NOT_READY => "Plugin not ready",
            PLUGIN_LOAD_FAILED => "Plugin load failed",
            PLUGIN_INITIALIZE_FAILED => "Plugin initialization failed",
            PLUGIN_SHUTDOWN_FAILED => "Plugin shutdown failed",
            PLUGIN_ALREADY_LOADED => "Plugin already loaded",
            CONTRACT_MISMATCH => "Contract mismatch",
            CONTRACT_NOT_FOUND => "Contract not found",
            MANIFEST_INVALID => "Invalid manifest",
            MANIFEST_MISSING => "Manifest missing",
            HOTSWAP_FAILED => "Hot-swap failed",
            HOTSWAP_ROLLBACK_FAILED => "Hot-swap rollback failed",
            DISCOVERY_FAILED => "Discovery failed",
            HEALTH_CHECK_TIMEOUT => "Health check timeout",
            RESOURCE_EXHAUSTED => "Resource exhausted",
            DEPENDENCY_MISSING => "Dependency missing",
            MODEL_NOT_FOUND => "Model not found",
            _ => "Unknown error",
        }
    }
}

// ============================================
// JSON-RPC ERROR
// ============================================

/// JSON-RPC 2.0 Error object.
///
/// Returned when a request fails. Contains:
/// - `code`: Error code (standard or implementation-defined)
/// - `message`: Human-readable error message
/// - `data`: Optional additional error data
///
/// # Example
///
/// ```rust
/// let error = JsonRpcError {
///     code: -32601,
///     message: "Method not found".to_string(),
///     data: Some(json!({"method": "unknown/method"})),
/// };
/// ```
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
pub struct JsonRpcError {
    /// Error code (integer)
    pub code: i32,
    
    /// Human-readable error message
    pub message: String,
    
    /// Additional error data (optional)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub data: Option<Value>,
}

impl JsonRpcError {
    /// Create a new JSON-RPC error.
    ///
    /// # Arguments
    ///
    /// * `code` - Error code
    /// * `message` - Error message
    ///
    /// # Example
    ///
    /// ```rust
    /// let error = JsonRpcError::new(-32600, "Invalid Request");
    /// ```
    pub fn new(code: i32, message: impl Into<String>) -> Self {
        Self {
            code,
            message: message.into(),
            data: None,
        }
    }

    /// Create a new JSON-RPC error with data.
    ///
    /// # Arguments
    ///
    /// * `code` - Error code
    /// * `message` - Error message
    /// * `data` - Additional error data
    pub fn with_data(code: i32, message: impl Into<String>, data: Value) -> Self {
        Self {
            code,
            message: message.into(),
            data: Some(data),
        }
    }

    /// Create a parse error.
    pub fn parse_error(message: impl Into<String>) -> Self {
        Self::new(error_codes::PARSE_ERROR, message)
    }

    /// Create an invalid request error.
    pub fn invalid_request(message: impl Into<String>) -> Self {
        Self::new(error_codes::INVALID_REQUEST, message)
    }

    /// Create a method not found error.
    pub fn method_not_found(method: impl Into<String>) -> Self {
        let method = method.into();
        Self::with_data(
            error_codes::METHOD_NOT_FOUND,
            format!("Method not found: {method}"),
            serde_json::json!({"method": method}),
        )
    }

    /// Create an invalid params error.
    pub fn invalid_params(message: impl Into<String>) -> Self {
        Self::new(error_codes::INVALID_PARAMS, message)
    }

    /// Create an internal error.
    pub fn internal_error(message: impl Into<String>) -> Self {
        Self::new(error_codes::INTERNAL_ERROR, message)
    }

    /// Check if this is a standard JSON-RPC error.
    pub fn is_standard_error(&self) -> bool {
        error_codes::is_standard_error(self.code)
    }

    /// Check if this is a server error.
    pub fn is_server_error(&self) -> bool {
        error_codes::is_server_error(self.code)
    }

    /// Check if error is recoverable (can retry).
    pub fn is_recoverable(&self) -> bool {
        matches!(
            self.code,
            error_codes::PLUGIN_NOT_READY
                | error_codes::HEALTH_CHECK_TIMEOUT
                | error_codes::RESOURCE_EXHAUSTED
        )
    }

    /// Get error code description.
    pub fn code_description(&self) -> &'static str {
        error_codes::description(self.code)
    }

    /// Convert to `IpcError`.
    pub fn into_ipc_error(self) -> IpcError {
        IpcError::RpcError {
            code: self.code,
            message: self.message,
        }
    }
}

impl fmt::Display for JsonRpcError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        write!(f, "[{}] {}", self.code, self.message)
    }
}

impl std::error::Error for JsonRpcError {}

// ============================================
// JSON-RPC RESPONSE
// ============================================

/// JSON-RPC 2.0 Response object.
///
/// Contains either a successful result OR an error, never both.
///
/// # Example Success Response
///
/// ```json
/// {
///     "jsonrpc": "2.0",
///     "id": 1,
///     "result": {"status": "ready"}
/// }
/// ```
///
/// # Example Error Response
///
/// ```json
/// {
///     "jsonrpc": "2.0",
///     "id": 1,
///     "error": {"code": -32601, "message": "Method not found"}
/// }
/// ```
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonRpcResponse {
    /// JSON-RPC version (always "2.0")
    pub jsonrpc: String,
    
    /// Request identifier (matches request id, null for notifications)
    pub id: Option<u64>,
    
    /// Successful result (mutually exclusive with error)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub result: Option<Value>,
    
    /// Error object (mutually exclusive with result)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<JsonRpcError>,
}

impl JsonRpcResponse {
    /// Create a success response.
    ///
    /// # Arguments
    ///
    /// * `id` - Request identifier
    /// * `result` - Success result value
    ///
    /// # Example
    ///
    /// ```rust
    /// let response = JsonRpcResponse::success(1, json!({"status": "ok"}));
    /// ```
    pub fn success(id: u64, result: Value) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id: Some(id),
            result: Some(result),
            error: None,
        }
    }

    /// Create an error response.
    ///
    /// # Arguments
    ///
    /// * `id` - Request identifier (None if request couldn't be parsed)
    /// * `error` - Error object
    ///
    /// # Example
    ///
    /// ```rust
    /// let response = JsonRpcResponse::error(
    ///     Some(1),
    ///     JsonRpcError::method_not_found("unknown/method")
    /// );
    /// ```
    pub fn error(id: Option<u64>, error: JsonRpcError) -> Self {
        Self {
            jsonrpc: "2.0".to_string(),
            id,
            result: None,
            error: Some(error),
        }
    }

    /// Create an error response from code and message.
    ///
    /// # Arguments
    ///
    /// * `id` - Request identifier
    /// * `code` - Error code
    /// * `message` - Error message
    pub fn error_from_code(id: Option<u64>, code: i32, message: impl Into<String>) -> Self {
        Self::error(id, JsonRpcError::new(code, message))
    }

    /// Check if this is a success response.
    pub fn is_success(&self) -> bool {
        self.error.is_none() && self.result.is_some()
    }

    /// Check if this is an error response.
    pub fn is_error(&self) -> bool {
        self.error.is_some()
    }

    /// Get the result value if successful.
    pub fn get_result(&self) -> Option<&Value> {
        self.result.as_ref()
    }

    /// Get the error if present.
    pub fn get_error(&self) -> Option<&JsonRpcError> {
        self.error.as_ref()
    }

    /// Convert to Result type.
    ///
    /// # Returns
    ///
    /// * `Ok(Value)` if success response
    /// * `Err(JsonRpcError)` if error response
    ///
    /// # Example
    ///
    /// ```rust
    /// match response.into_result() {
    ///     Ok(value) => handle_success(value),
    ///     Err(error) => handle_error(error),
    /// }
    /// ```
    pub fn into_result(self) -> Result<Value, JsonRpcError> {
        if let Some(error) = self.error {
            Err(error)
        } else {
            Ok(self.result.unwrap_or(Value::Null))
        }
    }

    /// Serialize response to JSON string.
    pub fn to_json(&self) -> Result<String, IpcError> {
        serde_json::to_string(self).map_err(|e| IpcError::JsonError(e.to_string()))
    }

    /// Parse response from JSON string.
    ///
    /// # Arguments
    ///
    /// * `json` - JSON string
    ///
    /// # Returns
    ///
    /// * `Ok(JsonRpcResponse)` if parsing succeeds
    /// * `Err(IpcError)` if parsing fails
    pub fn from_json(json: &str) -> Result<Self, IpcError> {
        serde_json::from_str(json).map_err(|e| IpcError::JsonError(e.to_string()))
    }

    /// Extract typed result from success response.
    ///
    /// # Type Parameters
    ///
    /// * `T` - Target type (must implement Deserialize)
    ///
    /// # Returns
    ///
    /// * `Ok(T)` if response is success and result deserializes
    /// * `Err(IpcError)` if error response or deserialization fails
    ///
    /// # Example
    ///
    /// ```rust
    /// #[derive(Deserialize)]
    /// struct PluginInfo {
    ///     name: String,
    ///     version: String,
    /// }
    ///
    /// let info: PluginInfo = response.extract_result()?;
    /// ```
    pub fn extract_result<T: serde::de::DeserializeOwned>(self) -> Result<T, IpcError> {
        match self.into_result() {
            Ok(value) => serde_json::from_value(value)
                .map_err(|e| IpcError::JsonError(e.to_string())),
            Err(e) => Err(e.into_ipc_error()),
        }
    }
}

impl fmt::Display for JsonRpcResponse {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        if let Some(ref error) = self.error {
            write!(f, "Error: {error}")
        } else if let Some(ref result) = self.result {
            write!(f, "Result: {result}")
        } else {
            write!(f, "Empty response")
        }
    }
}

// ============================================
// RESPONSE RESULT TYPE
// ============================================

/// Convenience type for JSON-RPC response results.
///
/// Wraps the common pattern of Result<Value, `JsonRpcError`>.
pub type ResponseResult = Result<Value, JsonRpcError>;

/// Extension trait for `ResponseResult`.
pub trait ResponseResultExt {
    /// Extract typed value from result.
    fn extract<T: serde::de::DeserializeOwned>(self) -> Result<T, IpcError>;
    
    /// Check if result is empty (null or empty object/array).
    fn is_empty(&self) -> bool;
}

impl ResponseResultExt for ResponseResult {
    fn extract<T: serde::de::DeserializeOwned>(self) -> Result<T, IpcError> {
        match self {
            Ok(value) => serde_json::from_value(value)
                .map_err(|e| IpcError::JsonError(e.to_string())),
            Err(e) => Err(e.into_ipc_error()),
        }
    }

    fn is_empty(&self) -> bool {
        match self {
            Ok(Value::Null) => true,
            Ok(Value::Object(map)) => map.is_empty(),
            Ok(Value::Array(arr)) => arr.is_empty(),
            Ok(Value::String(s)) => s.is_empty(),
            _ => false,
        }
    }
}

// ============================================
// BATCH RESPONSE
// ============================================

/// Batch response for multiple requests.
///
/// JSON-RPC 2.0 allows sending multiple requests in a single call,
/// receiving multiple responses back.
#[derive(Debug, Clone)]
pub struct BatchResponse {
    pub responses: Vec<JsonRpcResponse>,
}

impl BatchResponse {
    /// Create a new batch response.
    pub fn new(responses: Vec<JsonRpcResponse>) -> Self {
        Self { responses }
    }

    /// Parse batch response from JSON.
    pub fn from_json(json: &str) -> Result<Self, IpcError> {
        let responses: Vec<JsonRpcResponse> = serde_json::from_str(json)
            .map_err(|e| IpcError::JsonError(e.to_string()))?;
        Ok(Self::new(responses))
    }

    /// Get response by request ID.
    pub fn get_by_id(&self, id: u64) -> Option<&JsonRpcResponse> {
        self.responses.iter().find(|r| r.id == Some(id))
    }

    /// Check if all responses are successful.
    pub fn all_success(&self) -> bool {
        self.responses.iter().all(JsonRpcResponse::is_success)
    }

    /// Get all errors.
    pub fn errors(&self) -> Vec<&JsonRpcError> {
        self.responses
            .iter()
            .filter_map(|r| r.error.as_ref())
            .collect()
    }

    /// Number of responses.
    pub fn len(&self) -> usize {
        self.responses.len()
    }

    /// Check if empty.
    pub fn is_empty(&self) -> bool {
        self.responses.is_empty()
    }
}

// ============================================
// LINE READER UTILITIES
// ============================================

/// Utilities for reading responses from stdio.
pub mod reader {
    use super::{JsonRpcResponse, IpcError};
    use std::io::{BufRead, BufReader, Read};

    /// Read a single JSON-RPC response from a reader.
    ///
    /// Reads one line and parses it as a JSON-RPC response.
    ///
    /// # Arguments
    ///
    /// * `reader` - Any type implementing Read
    ///
    /// # Returns
    ///
    /// * `Ok(Some(response))` - Successfully parsed response
    /// * `Ok(None)` - End of stream
    /// * `Err(IpcError)` - Read or parse error
    pub fn read_response<R: Read>(reader: &mut BufReader<R>) -> Result<Option<JsonRpcResponse>, IpcError> {
        let mut line = String::new();
        
        match reader.read_line(&mut line) {
            Ok(0) => Ok(None), // EOF
            Ok(_) => {
                let trimmed = line.trim();
                if trimmed.is_empty() {
                    // Skip empty lines
                    read_response(reader)
                } else {
                    let response = JsonRpcResponse::from_json(trimmed)?;
                    Ok(Some(response))
                }
            }
            Err(e) => Err(IpcError::IoError(e.to_string())),
        }
    }

    /// Read responses until a specific ID is found.
    ///
    /// Useful when waiting for a specific response while other
    /// notifications may arrive.
    ///
    /// # Arguments
    ///
    /// * `reader` - Any type implementing Read
    /// * `target_id` - Request ID to wait for
    ///
    /// # Returns
    ///
    /// * `Ok(response)` - Response with matching ID
    /// * `Err(IpcError)` - Error or EOF before finding response
    pub fn read_until_id<R: Read>(
        reader: &mut BufReader<R>,
        target_id: u64,
    ) -> Result<JsonRpcResponse, IpcError> {
        loop {
            match read_response(reader)? {
                Some(response) => {
                    if response.id == Some(target_id) {
                        return Ok(response);
                    }
                    // Log and skip non-matching responses (notifications)
                    log::debug!("Skipping response with id {:?}", response.id);
                }
                None => return Err(IpcError::ResponseMissing(target_id)),
            }
        }
    }
}

// ============================================
// TESTS
// ============================================

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    #[test]
    fn test_success_response() {
        let response = JsonRpcResponse::success(1, json!({"status": "ready"}));
        
        assert!(response.is_success());
        assert!(!response.is_error());
        assert_eq!(response.id, Some(1));
        assert_eq!(response.result, Some(json!({"status": "ready"})));
        assert!(response.error.is_none());
    }

    #[test]
    fn test_error_response() {
        let error = JsonRpcError::method_not_found("unknown/method");
        let response = JsonRpcResponse::error(Some(1), error);
        
        assert!(response.is_error());
        assert!(!response.is_success());
        assert!(response.error.is_some());
    }

    #[test]
    fn test_response_into_result() {
        let success = JsonRpcResponse::success(1, json!("pong"));
        assert_eq!(success.into_result().unwrap(), json!("pong"));
        
        let error_resp = JsonRpcResponse::error(
            Some(1),
            JsonRpcError::new(-32601, "Method not found"),
        );
        let result = error_resp.into_result();
        assert!(result.is_err());
        assert_eq!(result.unwrap_err().code, -32601);
    }

    #[test]
    fn test_response_serialization() {
        let response = JsonRpcResponse::success(42, json!({"plugins": ["a", "b"]}));
        let json = response.to_json().unwrap();
        
        let parsed: Value = serde_json::from_str(&json).unwrap();
        assert_eq!(parsed["jsonrpc"], "2.0");
        assert_eq!(parsed["id"], 42);
        assert!(parsed["result"]["plugins"].is_array());
    }

    #[test]
    fn test_response_deserialization() {
        let json = r#"{"jsonrpc":"2.0","id":1,"result":"pong"}"#;
        let response = JsonRpcResponse::from_json(json).unwrap();
        
        assert!(response.is_success());
        assert_eq!(response.id, Some(1));
        assert_eq!(response.result, Some(json!("pong")));
    }

    #[test]
    fn test_error_codes() {
        assert!(error_codes::is_standard_error(-32700));
        assert!(error_codes::is_standard_error(-32600));
        assert!(!error_codes::is_standard_error(-32000));
        
        assert!(error_codes::is_server_error(-32000));
        assert!(!error_codes::is_server_error(-32700));
        
        assert_eq!(error_codes::description(-32601), "Method not found");
    }

    #[test]
    fn test_json_rpc_error() {
        let error = JsonRpcError::method_not_found("test/method");
        
        assert_eq!(error.code, error_codes::METHOD_NOT_FOUND);
        assert!(error.message.contains("test/method"));
        assert!(error.data.is_some());
        assert!(error.is_standard_error());
    }

    #[test]
    fn test_extract_result() {
        #[derive(Debug, Deserialize, PartialEq)]
        struct TestResult {
            name: String,
            count: i32,
        }
        
        let response = JsonRpcResponse::success(
            1,
            json!({"name": "test", "count": 42}),
        );
        
        let result: TestResult = response.extract_result().unwrap();
        assert_eq!(result.name, "test");
        assert_eq!(result.count, 42);
    }

    #[test]
    fn test_batch_response() {
        let batch = BatchResponse::new(vec![
            JsonRpcResponse::success(1, json!("a")),
            JsonRpcResponse::success(2, json!("b")),
            JsonRpcResponse::error(Some(3), JsonRpcError::internal_error("fail")),
        ]);
        
        assert_eq!(batch.len(), 3);
        assert!(!batch.all_success());
        assert_eq!(batch.errors().len(), 1);
        assert!(batch.get_by_id(2).is_some());
        assert!(batch.get_by_id(99).is_none());
    }
}
