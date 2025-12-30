
---
name: ppf_manage_dependencies
description: Audits and installs Python, NPM, and System dependencies for Piovis plugins on Windows.
---

# PPF Skill: Manage Dependencies

This skill manages the software environment for Piovis Atomic Components. It reads the `component.yaml` manifest and ensures the Windows environment matches the requirements.

This skill is governed by the global negative constraints in `config/skill_negative_constraints.md` (audio UI neutrality, async safety, TypeScript typing, and environment safety).

## When to Use This Skill

Use this skill when:
- The user adds a new plugin and needs to set it up.
- The user reports "Module Not Found" or "Command Not Found" errors.
- The user asks to "install requirements" or "check dependencies".
- A plugin fails to load during the `create-plugin` or `swap-plugin` process.

## Step 1: Gather Information

**IMPORTANT**: Before running any commands, identify the target.

1.  **Which Plugin?**
    "Which plugin should I check? (e.g., `stock_market_data`, `tts_kokoro`)"
    *If the user says 'all', you will need to iterate through the `plugins/` directory.*

2.  **Permission to Install?**
    "If I find missing libraries, do I have permission to install them immediately?"

## Step 2: Locate and Parse Manifest

You must locate the `component.yaml` file.

1.  Look in `plugins/{plugin_name}_plugin/component.yaml` (Standard naming).
2.  If not found, look in `plugins/{plugin_name}/component.yaml`.
3.  If no manifest exists, this skill cannot proceed. Inform the user they need to generate one using `ppf_create_plugin`.

## Step 3: Execution & Environment

**CRITICAL**: Use the `executor.py` script to perform the audit and installation. This script handles Windows paths and command execution safely.

1.  **Run the Audit**:
    Use the executor to check the current state without changing anything.

    ```python
    import sys
    import os
    
    # Dynamically find the skill directory
    skill_dir = os.path.dirname(os.path.abspath(__file__))
    if skill_dir not in sys.path:
        sys.path.insert(0, skill_dir)

    from executor import audit_dependencies, install_dependencies
    
    # 1. Define the plugin path (adjust based on user input)
    # Example: "D:/Piovis/plugins/stock_market_data_plugin"
    target_plugin_path = "path/to/plugin/folder" 
    
    # 2. Run Audit
    audit_result = audit_dependencies(target_plugin_path)
    
    print("Missing Python:", audit_result['missing']['python'])
    print("Missing NPM:", audit_result['missing']['npm'])
    print("Missing System:", audit_result['missing']['system'])
    ```

2.  **Report and Confirm**:
    Present the `audit_result` to the user.
    *   If `missing` lists are empty: "All dependencies are satisfied. ✅"
    *   If items are missing: "The following are missing: {list}. Proceed with installation?"

3.  **Run Installation**:
    If the user confirmed in Step 1 or Step 2, execute the install.

    ```python
    # 3. Install (only if confirmed)
    install_result = install_dependencies(target_plugin_path, audit_result)
    
    if install_result['success']:
        print("✅ Installation complete.")
    else:
        print(f"❌ Installation failed: {install_result['error']}")
    ```

## Step 4: Verification

After installation, run the audit one last time to confirm everything is green.

```python
# Re-run audit to verify
final_check = audit_dependencies(target_plugin_path)
if not any(final_check['missing'].values()):
    print("Verification Successful: All dependencies installed.")
else:
    print("Warning: Some dependencies are still missing.")
```

## System Tools (Windows)

For `system` dependencies (like `ffmpeg` or `docker`), the executor will **NOT** auto-install them. It will provide the `install_url` from the manifest.

- **Action**: Display the URL to the user and clearly identify the missing tools.
- **Instruction**: "Please download and install this tool manually, then restart Piovis Studio (or the built app) so it can see the updated PATH, and re-run this dependency check."
- **Repeat Guidance**: Each time system tools are reported as missing in an audit, you should repeat this restart advice so users who install tools later still see it without digging into older logs.

Do **not** tell the user to restart when only Python or npm dependencies are missing; restart guidance is specifically for system tools whose availability depends on the OS PATH and process lifetime.

## Safe Process Invocation & Overrides

This skill invokes dependency tools using explicit executables (`pip`/`pip.exe`, `python -m pip`, `npm.cmd`) and **never** through PowerShell `.ps1` scripts.

- The commands used come from `skills/ppf_manage_dependencies/config.py` and can be overridden via environment variables:
  - `PPF_PIP_CMD` (e.g., `python -m pip` or `C:\\Python311\\Scripts\\pip.exe`).
  - `PPF_NPM_CMD` (e.g., `npm.cmd` on Windows).
- Overrides pointing to `.ps1` scripts are rejected as unsafe:
  - You will see an error such as:  
    `"PPF_PIP_CMD/pip_install_cmd points to a PowerShell script (.ps1), which is not supported for dependency operations due to Windows execution policy constraints. Please set it to 'python -m pip', a pip.exe path, or npm.cmd."`
- When pip/npm subprocess calls fail with output indicating Execution Policy or PATH issues, the skill logs a clear hint to check:
  - That `pip.exe` / `python -m pip` and `npm.cmd` are on PATH.
  - That your PowerShell execution policy allows those tools to run.

## Pre-Flight Environment Diagnostics

Before auditing or installing dependencies, this skill runs a lightweight pre-flight check (`run_preflight_env_check`) that verifies:

- `python` is available and meets the minimum version (default `3.11.x`, overridable via `PPF_MIN_PYTHON_VERSION`).
- `pip` is available and responds correctly.
- `node` and `npm` are available and `node` meets the minimum version (default `18.x`, overridable via `PPF_MIN_NODE_VERSION`).

If any required tool is missing or below the recommended version, the audit will fail fast with a summary message explaining:

- Which tools are affected.
- Suggested remediation (installing/upgrading Python/Node/npm and ensuring they are on PATH).

Build operations (via `ppf_build_application`) also rely on this pre-flight check, so environment issues are detected before long-running commands are executed.
```

---
