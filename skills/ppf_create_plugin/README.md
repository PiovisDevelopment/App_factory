
# ppf_create_plugin

**The Universal Component Generator for the Piovis Plugin Framework.**

## What It Does

This skill transforms the framework from a simple Voice Assistant builder into a Universal App Factory. It generates "Atomic Components"—self-contained units of functionality that include:

- **The Manifest (`component.yaml`)**: A machine-readable "shopping list" of dependencies and metadata.
- **The Contract**: Strict Pydantic data models (Python) and TypeScript interfaces (Frontend) to ensure type safety.
- **The Backend**: Python code that implements the logic.
- **The Glue**: Automatic registration with the Universal Dispatcher.

## When to Use

Use `ppf_create_plugin` when you want to:
- **Add a new capability**: "Create a Stock Market Data plugin."
- **Integrate an external tool**: "Create a plugin for my local ComfyUI server."
- **Define a new data type**: "I need a plugin that handles IoT sensor data."
- **Ensure portability**: "Make a self-contained plugin I can share with others."

## Example Prompts

```text
"Create a stock_market plugin using yfinance"
"Create a plugin for ComfyUI image generation"
"Create a crypto_ticker plugin that streams prices"
"Create a system_monitor plugin to check CPU usage"
```

## Files

| File | Purpose |
|------|---------|
| `config.py` | Templates for Manifests, Contracts, and Plugin code |
| `executor.py` | Scripts to scaffold folders and generate files |
| `SKILL.md` | Detailed instructions for the AI agent (The "Contract Wizard") |
| `README.md` | This file |

## Configuration

Edit `config.py` to modify the default templates or Pydantic base classes.

## Prerequisites

- **Python 3.10+**
- **Pydantic** (`pip install pydantic`)
- **PyYAML** (`pip install pyyaml`)
```

---
