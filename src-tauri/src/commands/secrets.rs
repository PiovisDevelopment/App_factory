//! D079 - src-tauri/src/commands/secrets.rs
//! ==========================================
//! Tauri commands for secure API key management.
//!
//! Provides CRUD operations for API keys stored in .env file.
//! Keys are stored in .env file and persist across app restarts/rebuilds.
//!
//! Architecture: Keys stored as APIKEY_<SERVICE>_<UUID>=<value>
//! Active key tracked as ACTIVE_APIKEY_<SERVICE>=<UUID>
//!
//! Usage (TypeScript):
//!     ```typescript
//!     import { invoke } from '@tauri-apps/api/tauri';
//!
//!     // List all keys for a service
//!     const keys = await invoke('get_api_keys', { service: 'gemini' });
//!
//!     // Add a new key
//!     await invoke('add_api_key', {
//!         service: 'gemini',
//!         name: 'Production Key',
//!         key: 'AIzaSy...'
//!     });
//!
//!     // Set active key
//!     await invoke('set_active_api_key', { service: 'gemini', id: 'uuid-here' });
//!     ```

use chrono::Utc;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::fs;
use std::path::PathBuf;
use uuid::Uuid;

use super::{CommandError, CommandResult};

// ============================================
// TYPES
// ============================================

/// API key entry returned to frontend.
/// Note: `key_masked` contains only first 3 + last 3 characters.
/// Full key is NEVER returned after storage.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ApiKeyEntry {
    /// Unique identifier (UUID)
    pub id: String,
    /// Service type: gemini, openai, anthropic, ollama, tts, stt, vision, embedding
    pub service: String,
    /// User-friendly name
    pub name: String,
    /// Masked key display (e.g., "AIz***xyz")
    pub key_masked: String,
    /// Whether this key is currently active for the service
    pub is_active: bool,
    /// ISO timestamp of when key was created
    pub created_at: String,
}

/// Internal representation with full key (never serialized to frontend).
#[derive(Debug, Clone)]
struct ApiKeyInternal {
    id: String,
    service: String,
    name: String,
    key: String,
    created_at: String,
}

impl ApiKeyInternal {
    /// Convert to frontend-safe entry with masked key.
    fn to_entry(&self, is_active: bool) -> ApiKeyEntry {
        ApiKeyEntry {
            id: self.id.clone(),
            service: self.service.clone(),
            name: self.name.clone(),
            key_masked: mask_key(&self.key),
            is_active,
            created_at: self.created_at.clone(),
        }
    }
}

// ============================================
// HELPER FUNCTIONS
// ============================================

/// Get path to .env file in project root.
/// 
/// The function searches for the project root by looking for the `plugins/` directory.
/// It checks:
/// 1. Parent directories of the executable path
/// 2. Current working directory and its parent
/// 3. Known development paths (src-tauri parent)
fn get_env_path() -> PathBuf {
    // In dev mode, log what we're looking for
    log::debug!("get_env_path: Searching for .env file...");
    
    // Strategy 1: Search up from executable path
    let exe_path = std::env::current_exe().unwrap_or_default();
    log::debug!("get_env_path: exe_path = {:?}", exe_path);
    
    let mut current = exe_path.parent().map(|p| p.to_path_buf());

    for _ in 0..10 {
        if let Some(ref dir) = current {
            let plugins_dir = dir.join("plugins");
            if plugins_dir.exists() && plugins_dir.is_dir() {
                log::debug!("get_env_path: Found via exe path traversal: {:?}", dir);
                return dir.join(".env");
            }
            current = dir.parent().map(|p| p.to_path_buf());
        } else {
            break;
        }
    }

    // Strategy 2: Check current working directory
    let cwd = std::env::current_dir().unwrap_or_default();
    log::debug!("get_env_path: cwd = {:?}", cwd);
    
    if cwd.join("plugins").exists() {
        log::debug!("get_env_path: Found via cwd: {:?}", cwd);
        return cwd.join(".env");
    }
    
    // Strategy 3: If cwd is src-tauri, go up one level
    if cwd.file_name().map(|n| n == "src-tauri").unwrap_or(false) {
        if let Some(parent) = cwd.parent() {
            if parent.join("plugins").exists() {
                log::debug!("get_env_path: Found via src-tauri parent: {:?}", parent);
                return parent.join(".env");
            }
        }
    }
    
    // Strategy 4: Check parent of cwd
    if let Some(parent) = cwd.parent() {
        if parent.join("plugins").exists() {
            log::debug!("get_env_path: Found via cwd parent: {:?}", parent);
            return parent.join(".env");
        }
    }
    
    // Strategy 5: Look for src-tauri sibling (if cwd contains target/)
    // This handles the case where we're running from target/debug
    let mut search = cwd.clone();
    for _ in 0..5 {
        if search.join("src-tauri").exists() && search.join("plugins").exists() {
            log::debug!("get_env_path: Found via src-tauri sibling search: {:?}", search);
            return search.join(".env");
        }
        if let Some(parent) = search.parent() {
            search = parent.to_path_buf();
        } else {
            break;
        }
    }

    // Fallback
    log::warn!("get_env_path: Could not find project root, using cwd: {:?}", cwd);
    cwd.join(".env")
}

/// Mask API key for display (first 3 + *** + last 3 characters).
fn mask_key(key: &str) -> String {
    let len = key.len();
    if len <= 6 {
        return "*".repeat(len);
    }
    format!("{}***{}", &key[..3], &key[len - 3..])
}

/// Parse .env file into HashMap.
fn parse_env_file(path: &PathBuf) -> HashMap<String, String> {
    let mut map = HashMap::new();

    if !path.exists() {
        // Create .env from .env.example if it exists
        let example_path = path.with_file_name(".env.example");
        if example_path.exists() {
            if let Ok(content) = fs::read_to_string(&example_path) {
                let _ = fs::write(path, &content);
            }
        } else {
            // Create empty .env
            let _ = fs::write(path, "# App Factory Environment Variables\n");
        }
    }

    if let Ok(content) = fs::read_to_string(path) {
        for line in content.lines() {
            let line = line.trim();
            // Skip comments and empty lines
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            // Parse KEY=VALUE
            if let Some(pos) = line.find('=') {
                let key = line[..pos].trim().to_string();
                let value = line[pos + 1..].trim().to_string();
                map.insert(key, value);
            }
        }
    }

    map
}

/// Write HashMap back to .env file, preserving comments.
fn write_env_file(path: &PathBuf, env_vars: &HashMap<String, String>) -> Result<(), String> {
    let mut lines: Vec<String> = Vec::new();
    let mut written_keys: std::collections::HashSet<String> = std::collections::HashSet::new();

    // Read existing file to preserve comments and structure
    if path.exists() {
        if let Ok(content) = fs::read_to_string(path) {
            for line in content.lines() {
                let trimmed = line.trim();
                if trimmed.is_empty() || trimmed.starts_with('#') {
                    // Preserve comments and empty lines
                    lines.push(line.to_string());
                } else if let Some(pos) = trimmed.find('=') {
                    let key = trimmed[..pos].trim();
                    if let Some(value) = env_vars.get(key) {
                        // Update existing key
                        lines.push(format!("{}={}", key, value));
                        written_keys.insert(key.to_string());
                    }
                    // If key is not in env_vars, it's been deleted - don't write it
                }
            }
        }
    }

    // Add new keys that weren't in the original file
    for (key, value) in env_vars {
        if !written_keys.contains(key) {
            lines.push(format!("{}={}", key, value));
        }
    }

    // Write to file
    let content = lines.join("\n") + "\n";
    fs::write(path, content).map_err(|e| format!("Failed to write .env: {}", e))
}

/// Parse API key entries from env vars for a specific service.
fn parse_api_keys(env_vars: &HashMap<String, String>, service: &str) -> Vec<ApiKeyInternal> {
    let prefix = format!("APIKEY_{}_", service.to_uppercase());
    let name_prefix = format!("APIKEY_NAME_{}_", service.to_uppercase());
    let created_prefix = format!("APIKEY_CREATED_{}_", service.to_uppercase());
    let active_key = format!("ACTIVE_APIKEY_{}", service.to_uppercase());
    let _active_id = env_vars.get(&active_key).cloned().unwrap_or_default();

    let mut keys: Vec<ApiKeyInternal> = Vec::new();

    for (key, value) in env_vars {
        if key.starts_with(&prefix) {
            let id = key.strip_prefix(&prefix).unwrap_or("").to_string();
            if id.is_empty() {
                continue;
            }

            let name = env_vars
                .get(&format!("{}{}", name_prefix, id))
                .cloned()
                .unwrap_or_else(|| format!("Key {}", &id[..8.min(id.len())]));

            let created_at = env_vars
                .get(&format!("{}{}", created_prefix, id))
                .cloned()
                .unwrap_or_else(|| Utc::now().to_rfc3339());

            keys.push(ApiKeyInternal {
                id,
                service: service.to_string(),
                name,
                key: value.clone(),
                created_at,
            });
        }
    }

    keys
}

/// Get the active key ID for a service.
fn get_active_id(env_vars: &HashMap<String, String>, service: &str) -> Option<String> {
    let key = format!("ACTIVE_APIKEY_{}", service.to_uppercase());
    env_vars.get(&key).cloned()
}

// ============================================
// TAURI COMMANDS
// ============================================

/// Get all API keys for a service.
///
/// # Arguments
///
/// * `service` - Service type (gemini, openai, anthropic, etc.)
///
/// # Returns
///
/// Array of ApiKeyEntry (with masked keys).
#[tauri::command]
pub fn get_api_keys(service: String) -> CommandResult<Vec<ApiKeyEntry>> {
    log::debug!("Command: get_api_keys service={}", service);

    let env_path = get_env_path();
    let env_vars = parse_env_file(&env_path);
    let keys = parse_api_keys(&env_vars, &service);
    let active_id = get_active_id(&env_vars, &service);

    let entries: Vec<ApiKeyEntry> = keys
        .into_iter()
        .map(|k| {
            let is_active = active_id.as_ref() == Some(&k.id);
            k.to_entry(is_active)
        })
        .collect();

    Ok(entries)
}

/// Add a new API key.
///
/// # Arguments
///
/// * `service` - Service type
/// * `name` - User-friendly name
/// * `key` - The actual API key value
///
/// # Returns
///
/// The created ApiKeyEntry.
#[tauri::command]
pub fn add_api_key(service: String, name: String, key: String) -> CommandResult<ApiKeyEntry> {
    log::info!("Command: add_api_key service={} name={}", service, name);

    let env_path = get_env_path();
    let mut env_vars = parse_env_file(&env_path);

    // Generate new ID
    let id = Uuid::new_v4().to_string();
    let created_at = Utc::now().to_rfc3339();

    // Store key, name, and created timestamp
    let key_var = format!("APIKEY_{}_{}", service.to_uppercase(), id);
    let name_var = format!("APIKEY_NAME_{}_{}", service.to_uppercase(), id);
    let created_var = format!("APIKEY_CREATED_{}_{}", service.to_uppercase(), id);

    env_vars.insert(key_var, key.clone());
    env_vars.insert(name_var, name.clone());
    env_vars.insert(created_var, created_at.clone());

    // If this is the first key for the service, make it active
    let active_key = format!("ACTIVE_APIKEY_{}", service.to_uppercase());
    let is_first = !env_vars.contains_key(&active_key);
    if is_first {
        env_vars.insert(active_key, id.clone());
    }

    // Write back
    write_env_file(&env_path, &env_vars).map_err(|e| CommandError {
        code: "ENV_WRITE_ERROR".to_string(),
        message: e,
        details: None,
    })?;

    Ok(ApiKeyEntry {
        id,
        service,
        name,
        key_masked: mask_key(&key),
        is_active: is_first,
        created_at,
    })
}

/// Update an existing API key.
///
/// # Arguments
///
/// * `service` - Service type
/// * `id` - Key ID to update
/// * `name` - New name (optional)
/// * `key` - New key value (optional)
#[tauri::command]
pub fn update_api_key(
    service: String,
    id: String,
    name: Option<String>,
    key: Option<String>,
) -> CommandResult<ApiKeyEntry> {
    log::info!("Command: update_api_key service={} id={}", service, id);

    let env_path = get_env_path();
    let mut env_vars = parse_env_file(&env_path);

    // Check key exists
    let key_var = format!("APIKEY_{}_{}", service.to_uppercase(), id);
    if !env_vars.contains_key(&key_var) {
        return Err(CommandError {
            code: "KEY_NOT_FOUND".to_string(),
            message: format!("API key with ID {} not found", id),
            details: None,
        });
    }

    // Update name if provided
    if let Some(new_name) = name.clone() {
        let name_var = format!("APIKEY_NAME_{}_{}", service.to_uppercase(), id);
        env_vars.insert(name_var, new_name);
    }

    // Update key if provided
    if let Some(new_key) = key.clone() {
        env_vars.insert(key_var.clone(), new_key);
    }

    // Write back
    write_env_file(&env_path, &env_vars).map_err(|e| CommandError {
        code: "ENV_WRITE_ERROR".to_string(),
        message: e,
        details: None,
    })?;

    // Get updated entry
    let stored_key = env_vars.get(&key_var).cloned().unwrap_or_default();
    let name_var = format!("APIKEY_NAME_{}_{}", service.to_uppercase(), id);
    let created_var = format!("APIKEY_CREATED_{}_{}", service.to_uppercase(), id);
    let active_id = get_active_id(&env_vars, &service);

    Ok(ApiKeyEntry {
        id: id.clone(),
        service,
        name: env_vars.get(&name_var).cloned().unwrap_or_else(|| name.unwrap_or_default()),
        key_masked: mask_key(&stored_key),
        is_active: active_id.as_ref() == Some(&id),
        created_at: env_vars.get(&created_var).cloned().unwrap_or_default(),
    })
}

/// Delete an API key.
///
/// # Arguments
///
/// * `service` - Service type
/// * `id` - Key ID to delete
#[tauri::command]
pub fn delete_api_key(service: String, id: String) -> CommandResult<()> {
    log::info!("Command: delete_api_key service={} id={}", service, id);

    let env_path = get_env_path();
    let mut env_vars = parse_env_file(&env_path);

    // Remove key, name, and created timestamp
    let key_var = format!("APIKEY_{}_{}", service.to_uppercase(), id);
    let name_var = format!("APIKEY_NAME_{}_{}", service.to_uppercase(), id);
    let created_var = format!("APIKEY_CREATED_{}_{}", service.to_uppercase(), id);

    if !env_vars.contains_key(&key_var) {
        return Err(CommandError {
            code: "KEY_NOT_FOUND".to_string(),
            message: format!("API key with ID {} not found", id),
            details: None,
        });
    }

    env_vars.remove(&key_var);
    env_vars.remove(&name_var);
    env_vars.remove(&created_var);

    // If this was the active key, clear active or set to another key
    let active_key = format!("ACTIVE_APIKEY_{}", service.to_uppercase());
    if env_vars.get(&active_key) == Some(&id) {
        // Find another key for this service
        let remaining_keys = parse_api_keys(&env_vars, &service);
        if let Some(first) = remaining_keys.first() {
            env_vars.insert(active_key, first.id.clone());
        } else {
            env_vars.remove(&active_key);
        }
    }

    // Write back
    write_env_file(&env_path, &env_vars).map_err(|e| CommandError {
        code: "ENV_WRITE_ERROR".to_string(),
        message: e,
        details: None,
    })?;

    Ok(())
}

/// Get the currently active API key for a service (masked version).
///
/// # Arguments
///
/// * `service` - Service type
///
/// # Returns
///
/// The active ApiKeyEntry or None.
#[tauri::command]
pub fn get_active_api_key(service: String) -> CommandResult<Option<ApiKeyEntry>> {
    log::debug!("Command: get_active_api_key service={}", service);

    let env_path = get_env_path();
    let env_vars = parse_env_file(&env_path);
    let active_id = get_active_id(&env_vars, &service);

    if let Some(id) = active_id {
        let keys = parse_api_keys(&env_vars, &service);
        if let Some(key) = keys.into_iter().find(|k| k.id == id) {
            return Ok(Some(key.to_entry(true)));
        }
    }

    Ok(None)
}

/// Set the active API key for a service.
///
/// # Arguments
///
/// * `service` - Service type
/// * `id` - Key ID to set as active
#[tauri::command]
pub fn set_active_api_key(service: String, id: String) -> CommandResult<()> {
    log::info!("Command: set_active_api_key service={} id={}", service, id);

    let env_path = get_env_path();
    let mut env_vars = parse_env_file(&env_path);

    // Verify key exists
    let key_var = format!("APIKEY_{}_{}", service.to_uppercase(), id);
    if !env_vars.contains_key(&key_var) {
        return Err(CommandError {
            code: "KEY_NOT_FOUND".to_string(),
            message: format!("API key with ID {} not found", id),
            details: None,
        });
    }

    // Set active
    let active_key = format!("ACTIVE_APIKEY_{}", service.to_uppercase());
    env_vars.insert(active_key, id);

    // Write back
    write_env_file(&env_path, &env_vars).map_err(|e| CommandError {
        code: "ENV_WRITE_ERROR".to_string(),
        message: e,
        details: None,
    })?;

    Ok(())
}

/// Get the actual (unmasked) value of the active API key.
/// This is used by services to make API calls.
///
/// # Arguments
///
/// * `service` - Service type
///
/// # Returns
///
/// The actual API key value or None if no active key.
#[tauri::command]
pub fn get_active_api_key_value(service: String) -> CommandResult<Option<String>> {
    log::debug!("Command: get_active_api_key_value service={}", service);

    let env_path = get_env_path();
    let env_vars = parse_env_file(&env_path);
    let active_id = get_active_id(&env_vars, &service);

    if let Some(id) = active_id {
        let key_var = format!("APIKEY_{}_{}", service.to_uppercase(), id);
        return Ok(env_vars.get(&key_var).cloned());
    }

    Ok(None)
}

/// Get all services that have API keys configured.
///
/// # Returns
///
/// Array of service names with at least one key.
#[tauri::command]
pub fn get_configured_services() -> CommandResult<Vec<String>> {
    log::debug!("Command: get_configured_services");

    let env_path = get_env_path();
    let env_vars = parse_env_file(&env_path);

    let mut services: std::collections::HashSet<String> = std::collections::HashSet::new();

    for key in env_vars.keys() {
        if key.starts_with("APIKEY_") && !key.starts_with("APIKEY_NAME_") && !key.starts_with("APIKEY_CREATED_") {
            // Parse service from APIKEY_<SERVICE>_<UUID>
            let parts: Vec<&str> = key.split('_').collect();
            if parts.len() >= 3 {
                services.insert(parts[1].to_lowercase());
            }
        }
    }

    Ok(services.into_iter().collect())
}

// ============================================
// TESTS
// ============================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mask_key_normal() {
        assert_eq!(mask_key("AIzaSyABCDEFGHIJKLMNOP"), "AIz***NOP");
    }

    #[test]
    fn test_mask_key_short() {
        assert_eq!(mask_key("abc"), "***");
        assert_eq!(mask_key("abcdef"), "******");
    }

    #[test]
    fn test_mask_key_7_chars() {
        assert_eq!(mask_key("abcdefg"), "abc***efg");
    }

    #[test]
    fn test_parse_env_line() {
        let mut map = HashMap::new();
        let content = "KEY=value\n# comment\nANOTHER=test";

        for line in content.lines() {
            let line = line.trim();
            if line.is_empty() || line.starts_with('#') {
                continue;
            }
            if let Some(pos) = line.find('=') {
                let key = line[..pos].trim().to_string();
                let value = line[pos + 1..].trim().to_string();
                map.insert(key, value);
            }
        }

        assert_eq!(map.get("KEY"), Some(&"value".to_string()));
        assert_eq!(map.get("ANOTHER"), Some(&"test".to_string()));
        assert_eq!(map.len(), 2);
    }
}
