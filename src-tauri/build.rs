//! B020 - src-tauri/build.rs
//! =========================
//! Tauri build script for pre-build tasks.
//!
//! Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)

fn main() {
    tauri_build::build();
}
