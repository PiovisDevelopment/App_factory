//! B007 - src-tauri/src/main.rs
//! =============================
//! Tauri application entry point with IPC manager initialization.
//!
//! Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
//! Protocol: JSON-RPC 2.0 over stdin/stdout (newline-delimited)
//!
//! Dependencies:
//!     - D030: ipc/mod.rs (IPC module)
//!     - D035: ipc/manager.rs (IpcManagerState)
//!     - D036: commands/mod.rs (Tauri commands)

#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

mod commands;
mod ipc;

use ipc::manager::{IpcConfig, IpcManagerState};
use std::path::PathBuf;
use tauri::Manager;

/// Get the project root directory (parent of src-tauri).
///
/// In development, this is the directory containing both `src-tauri` and `plugins`.
/// In production builds, this will need to be adjusted based on bundle structure.
fn get_project_root() -> PathBuf {
    // During development, the executable runs from src-tauri/target/debug
    // We need to go up to find the project root (where plugins/ is)
    let exe_path = std::env::current_exe().unwrap_or_default();
    log::debug!("Executable path: {:?}", exe_path);

    // Try to find project root by looking for plugins directory
    let mut current = exe_path.parent().map(|p| p.to_path_buf());

    // Walk up the directory tree looking for the plugins directory
    for _ in 0..10 {
        if let Some(ref dir) = current {
            let plugins_dir = dir.join("plugins");
            if plugins_dir.exists() && plugins_dir.is_dir() {
                log::info!("Found project root: {:?}", dir);
                return dir.clone();
            }
            current = dir.parent().map(|p| p.to_path_buf());
        } else {
            break;
        }
    }

    // Fallback: try current working directory
    let cwd = std::env::current_dir().unwrap_or_default();
    log::warn!(
        "Could not find plugins directory, using current working directory: {:?}",
        cwd
    );

    // Check if cwd has plugins, if not try parent
    if cwd.join("plugins").exists() {
        return cwd;
    }

    // Try parent of cwd (common when running from src-tauri)
    if let Some(parent) = cwd.parent() {
        if parent.join("plugins").exists() {
            return parent.to_path_buf();
        }
    }

    cwd
}

fn main() {
    // Initialize logging
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info"))
        .format_timestamp_millis()
        .init();

    log::info!("Starting App Factory v1.0.0");

    // Determine project root (where plugins/ directory is located)
    let project_root = get_project_root();
    log::info!("Project root: {:?}", project_root);

    // Create IPC configuration with correct working directory
    let config = IpcConfig::default()
        .with_python_path("python")
        .with_module_path("plugins._host")
        .with_working_dir(project_root)
        .with_timeout(60)
        .with_auto_respawn(true);

    // Create IPC Manager state
    let ipc_state = IpcManagerState::new(config);

    log::info!("IPC Manager configured");

    // Build and run Tauri application
    tauri::Builder::default()
        .manage(ipc_state)
        .invoke_handler(commands::generate_command_handler!())
        .setup(|app| {
            log::info!("Tauri application setup complete");

            // Get the IPC state and start it
            let state = app.state::<IpcManagerState>();

            // Start IPC in a background task
            let state_clone = state.inner().clone();
            tauri::async_runtime::spawn(async move {
                log::info!("Starting IPC Manager...");
                match state_clone.start().await {
                    Ok(()) => log::info!("IPC Manager started successfully"),
                    Err(e) => log::error!("Failed to start IPC Manager: {}", e),
                }
            });

            Ok(())
        })
        .on_window_event(|event| {
            if let tauri::WindowEvent::CloseRequested { .. } = event.event() {
                log::info!("Window close requested, shutting down...");
            }
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
