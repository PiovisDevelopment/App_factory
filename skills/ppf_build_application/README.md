
# ppf_build_application

**The Release Manager for the Piovis Plugin Framework.**

## What It Does

This skill compiles your development project into a standalone Windows executable (`.exe` or `.msi`). It handles the complex build process, ensuring that:

- **Frontend Compilation**: React/TypeScript code is bundled and optimized.
- **Backend Compilation**: The Rust core is compiled in release mode.
- **Asset Bundling**: All plugins, Python scripts, and the `.env` file are correctly packaged with the installer.
- **Output Location**: It tells you exactly where to find the installer to share with friends.

## When to Use

Use `ppf_build_application` when you want to:
- **Finish a project**: "I'm done with the Stock Dashboard, make it an app."
- **Share with others**: "Create an installer for my friend."
- **Test release mode**: "Verify the app works outside of the dev environment."

## Example Prompts

```text
"Build the application"
"Create a Windows installer"
"Compile the project for release"
"Where is my .exe file?"
```

## Files

| File | Purpose |
|------|---------|
| `config.py` | Configuration for build commands and output paths |
| `executor.py` | Scripts to run the Tauri build process |
| `SKILL.md` | Detailed instructions for the AI agent |
| `README.md` | This file |

## Configuration

Edit `config.py` if you need to change the bundle identifier or version number before building.

## Prerequisites

- **Rust** installed (`rustc`, `cargo`).
- **Visual Studio Build Tools** (C++ workload) installed.
- **WiX Toolset** (optional, but recommended for MSI creation on Windows).
- **Node.js/NPM** installed.
```

---

