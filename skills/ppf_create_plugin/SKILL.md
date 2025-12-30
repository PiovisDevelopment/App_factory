
---
name: ppf_create_plugin
description: Generates Universal Atomic Components (Manifest + Contract + Backend) for the Piovis Framework.
---

# PPF Skill: Create Plugin (Universal)

This skill generates "Atomic Components" for the Piovis Framework. Unlike previous versions, it does not assume the plugin is for voice/audio. It uses a "Manifest-First" approach to ensure portability and reliability.

Generated plugins follow the portable plugin folder contract described in `config/plugin_folder_contract.md`: each plugin folder contains its own manifest, implementation, and package marker and is designed to be copied between Piovis Studio installations as a self-contained unit (once dependencies are installed).

This skill is governed by the global negative constraints in `config/skill_negative_constraints.md` (audio UI neutrality, async safety, TypeScript typing, and environment safety).

## When to Use This Skill

Use this skill when:
- The user wants to add a new backend capability (Finance, IoT, AI, Tools).
- The user wants to wrap an external API or Library (e.g., `yfinance`, `openai`).
- The user needs a self-contained, shareable plugin.

## Step 1: The Contract Wizard (Gather Information)

**CRITICAL**: Do not write code yet. You must define the "Shape" of the component. Ask the user:

1.  **Domain & Name**: "What is the domain (e.g., `finance`) and unique name (e.g., `stock_data`)?"
2.  **Verbs (Methods)**: "What actions can this plugin perform? (e.g., `get_quote`, `fetch_history`)"
3.  **Nouns (Data)**: "What are the inputs and outputs for each method? (e.g., Input: `ticker: str`, Output: `price: float`)"
4.  **Dependencies**: "Which Python libraries (pip) or System tools are required? (e.g., `yfinance`, `ffmpeg`)"

## Step 2: Generate the Manifest

Construct the `component.yaml` data structure in your mind (or scratchpad).
- **Type**: `backend_frontend_hybrid` (usually).
- **Dependencies**: List everything the user mentioned.
- **Contract**: Map the Verbs and Nouns to the schema.

## Step 3: Execution (Scaffolding)

Use the `executor.py` script to generate the files. This script handles the directory creation and template rendering.

```python
import sys
import os

# Dynamically find the skill directory
skill_dir = os.path.dirname(os.path.abspath(__file__))
if skill_dir not in sys.path:
    sys.path.insert(0, skill_dir)

from executor import generate_component

# Define the component structure based on Step 1
component_data = {
    "name": "stock_data",
    "domain": "finance",
    "description": "Fetches real-time stock info",
    "methods": [
        {
            "name": "get_quote",
            "inputs": {"ticker": "str"},
            "outputs": {"symbol": "str", "price": "float"},
            "is_async": True
        }
    ],
    "dependencies": {
        "python": [{"name": "yfinance", "version": "^0.2.0"}],
        "npm": [{"name": "recharts", "version": "latest"}]
    }
}

# Execute generation
result = generate_component(component_data)

if result['success']:
    print(f"✅ Component created at: {result['path']}")
    print(f"✅ Contract created at: {result['contract_path']}")
else:
    print(f"❌ Error: {result['error']}")
```

## Step 4: Post-Generation Actions

Once the files are created:

1.  **Trigger Dependency Management**:
    "I have created the component. Now checking dependencies..."
    *Refer to `ppf_manage_dependencies` skill to install the requirements.*

2.  **Notify User**:
    "Component `stock_data` created.
    - Manifest: `plugins/stock_data_plugin/component.yaml`
    - Contract: `contracts/finance.py`
    - Backend: `plugins/stock_data_plugin/plugin.py`"

## Design Principles

1.  **Async First**: All generated Python methods should be `async def` to prevent blocking the UI.
2.  **Type Safety**: The executor automatically generates Pydantic models (Python) and TypeScript interfaces (Frontend) to match.
3.  **No Audio Bias**: Do not assume the plugin needs `synthesize` or `transcribe` methods unless the domain is explicitly `tts` or `stt`. Do not pre-emptively design microphone/recording UIs for plugins; any audio-related UI must be driven by explicit user intent via `ppf_create_application` and its `audio_intent` feature flag.
4.  **TS Interface Sync**: Whenever you create or evolve a plugin contract, ensure that `src/types/{domain}.ts` is generated or updated either via `generate_component` or the `types_sync.py` helper (so frontend UIs can consume accurate, strongly-typed interfaces).
5.  **Heavy Library Warnings**: When dependencies include heavy/conflict-prone libraries (for example: `torch`, `pandas`, `opencv-python`, `tensorflow`), surface a clear warning to the user. Explain that these packages can bloat the shared venv or conflict with other plugins, and recommend considering a dedicated virtual environment or project. Actual version conflicts will still be detected later by `ppf_manage_dependencies` and the REQ-U2.5 conflict checks.
6.  **Portable Folder Contract**: When describing or manipulating plugins, assume that everything a plugin needs at runtime (other than the platform itself) lives under `plugins/{name}_plugin/`. Avoid hard-coded absolute paths; use plugin-relative paths for local assets, and rely on `config/plugin_folder_contract.md` as the source of truth for what makes a plugin portable.
```

---
