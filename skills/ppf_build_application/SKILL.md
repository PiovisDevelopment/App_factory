
---
name: ppf_build_application
description: Compiles the Piovis project into a standalone Windows executable (.exe/.msi).
---

# PPF Skill: Build Application

This skill manages the compilation and packaging process. It transforms the source code into a distributable Windows installer.

This skill is governed by the global negative constraints in `config/skill_negative_constraints.md` (audio UI neutrality, async safety, TypeScript typing, and environment safety).

## When to Use This Skill

Use this skill when:
- The user asks to "build", "compile", or "release" the app.
- The user wants to create an installer or executable.
- The user asks "How do I share this?"

## Step 1: Pre-Flight Check

**CRITICAL**: Building takes time. Verify prerequisites *before* starting.

1.  **Check Configuration**:
    "I will check `src-tauri/tauri.conf.json` to ensure the bundle identifier is unique (not `com.tauri.dev`)."
    *If it is default, ask the user for a unique ID (e.g., `com.mycompany.stockapp`).*

2.  **Check Environment**:
    "Do you have **Visual Studio Build Tools** and **Rust** installed? These are required for compilation."

   Additionally, PiovisStudio build operations are **Windows-native only**:
   - Builds must be run from a standard Windows terminal (CMD or PowerShell), not from WSL or Unix shells.
   - If run under WSL or a non-Windows environment, the build executor will fail fast with a clear message indicating that WSL/non-Windows is unsupported for this flow.

## Step 2: Execution (The Build)

Use the `executor.py` script to run the build process. This script wraps the Tauri CLI and captures output.

```python
import sys
import os

# Dynamically find the skill directory
skill_dir = os.path.dirname(os.path.abspath(__file__))
if skill_dir not in sys.path:
    sys.path.insert(0, skill_dir)

from executor import build_application

# Execute build
print("🚀 Starting build process... This may take several minutes.")
result = build_application()

if result['success']:
    print(f"✅ Build Complete!")
    print(f"📂 Installer location: {result['installer_path']}")
    print(f"📂 Executable location: {result['exe_path']}")
else:
    print(f"❌ Build Failed: {result['error']}")
    print("Tip: Ensure 'WiX Toolset' is installed if building MSI.")
```

## Step 3: Post-Build Verification

After the script finishes, verify the artifact actually exists.

1.  **Locate Output**:
    Standard path: `src-tauri/target/release/bundle/msi/` (for MSI) or `nsis/` (for EXE).
2.  **Report to User**:
    "Your application is ready. You can find the installer here:
    `[Path to .msi]`
    
    You can zip this file and share it with anyone running Windows."

## Common Issues & Fixes

*   **Error: "WiX Toolset not found"**
    *   *Fix*: "You need to install WiX Toolset v3 to build MSI installers. Alternatively, we can build a setup.exe using NSIS."
*   **Error: "Identifier cannot be default"**
    *   *Fix*: Edit `tauri.conf.json` and change `tauri.bundle.identifier`.
```
