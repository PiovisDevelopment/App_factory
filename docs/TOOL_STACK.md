# Consolidated Tool Stack

### **JavaScript / TypeScript**

| Tool | Version | Purpose |
| :--- | :--- | :--- |
| **TypeScript (tsc)** | `v5.9.3` | **Type Safety / Compiler**<br>The hard correctness gate for CI. |
| **ESLint** | `v9.6.0` | **Semantic Linting (CI)**<br>Authoritative, typed correctness checks. |
| **typescript-eslint** | `v8.51.0` | **TS Integration**<br>Parses TS for ESLint (Parser + Plugin). |
| **react-hooks** | `v7.0.1` | **React Safety**<br>Enforces Hooks rules (Native Flat Config). |
| **Oxlint** | `v1.0` | **Fast Feedback (Local)**<br>Advisory-only speed linting. |

### **Python**

| Tool | Version | Purpose |
| :--- | :--- | :--- |
| **Ruff** | `v0.14.9` | **Linting & Formatting**<br>High-performance syntax checks. |
| **Mypy** | `v1.9+` | **Static Type Checking**<br>The semantic correctness gate. |

### **Rust (Tauri)**

| Tool | Version | Purpose |
| :--- | :--- | :--- |
| **Rust Toolchain** | `1.92.0` | **Core Language**<br>Stable compiler version. |
| **Clippy** | `stable` | **Linter**<br>Catching idiomatic Rust issues. |
