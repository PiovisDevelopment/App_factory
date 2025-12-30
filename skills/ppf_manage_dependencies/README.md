
# ppf_manage_dependencies

**The automated Package Manager for the Piovis Plugin Framework (Windows Native).**

## What It Does

This skill acts as the "IT Support Technician" for your application. It ensures that every Atomic Component has the software it needs to run.

- **Manifest Scanning**: Reads the `component.yaml` file in any plugin directory to find the "shopping list" of requirements.
- **Environment Auditing**: Checks if Python libraries (`pip`), Frontend libraries (`npm`), and System tools (e.g., `ffmpeg`) are actually installed.
- **Safe Installation**: Installs missing dependencies automatically (for pip/npm) or guides you to download system tools.
- **Windows Native**: Optimized for Windows paths, commands, and execution policies.

## When to Use

Use `ppf_manage_dependencies` when you want to:
- **Set up a new plugin**: "I just added the Stock Data plugin, get it ready."
- **Fix crashes**: "The app says 'Module Not Found', please fix it."
- **Audit your system**: "Check if I have everything installed for the Image Gen plugin."

## Example Prompts

```text
"Check dependencies for the stock_market_data plugin"
"Install missing requirements for the tts_kokoro plugin"
"Audit the environment for all plugins"
"Do I have the system tools required for the video_editor plugin?"
```

## Files

| File | Purpose |
|------|---------|
| `config.py` | Configuration for pip, npm, and system check commands |
| `executor.py` | Automation scripts to run install commands |
| `SKILL.md` | Detailed instructions for the AI agent |
| `README.md` | This file |

## Configuration

Edit `config.py` if your package managers are not in the system PATH:

```python
DEPENDENCY_CONFIG = {
    'pip_cmd': 'pip',       # or 'python -m pip'
    'npm_cmd': 'npm.cmd',   # Windows specific
    'check_cmd': 'where'    # Windows 'which' equivalent
}
```

## Prerequisites

- **Python** installed and added to PATH.
- **Node.js/NPM** installed and added to PATH.
- **Windows OS** (Command Prompt or PowerShell).
```

---
