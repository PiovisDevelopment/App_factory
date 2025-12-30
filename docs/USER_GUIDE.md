# D091 - App Factory User Guide

> **User-focused documentation with step-by-step instructions**
> **Satisfies Matrix Req D1.1 (line 390)**
> **Last Updated:** 2025-12-25

---

## Table of Contents

1. [Quick Start](#1-quick-start)
2. [Creating Your First Plugin](#2-creating-your-first-plugin)
3. [Using the Factory Interface](#3-using-the-factory-interface)
4. [Exporting Your Application](#4-exporting-your-application)
5. [Testing Plugins](#5-testing-plugins)
6. [Troubleshooting Common Issues](#6-troubleshooting-common-issues)
7. [Keyboard Shortcuts](#7-keyboard-shortcuts)
8. [Importing Third-Party Components](#8-importing-third-party-components)
9. [Project Backup and Restore](#9-project-backup-and-restore)

---

## 1. Quick Start

### 1.1 Prerequisites

Before using App Factory, ensure you have:

| Requirement | Version | Verification Command |
|-------------|---------|---------------------|
| Node.js | 18.x or later | `node --version` |
| Python | 3.11.x | `python --version` |
| Rust | Latest stable | `rustc --version` |
| Git | Any recent | `git --version` |

### 1.2 Installation

```bash
# 1. Clone the repository
git clone <repository-url>
cd app_factory

# 2. Install Python dependencies
pip install -r requirements.txt

# 3. Install Node dependencies
npm install

# 4. Start the development server
npm run tauri dev
```

### 1.3 First Launch

When App Factory starts, you'll see the main Factory Layout:

```
┌─────────────────────────────────────────────────────────────────┐
│  App Factory                                            [─][□][×]│
├─────────────────────────────────────────────────────────────────┤
│ ┌───────────────┐ ┌───────────────────────────┐ ┌─────────────┐ │
│ │ Component     │ │                           │ │ Property    │ │
│ │ Gallery       │ │     Live Preview          │ │ Inspector   │ │
│ │               │ │                           │ │             │ │
│ │ [Button]      │ │  ┌─────────────────────┐  │ │ Name: _____ │ │
│ │ [Input]       │ │  │                     │  │ │ Size: _____ │ │
│ │ [Select]      │ │  │   Your App Here     │  │ │ Color: ____ │ │
│ │ [Modal]       │ │  │                     │  │ │             │ │
│ │ [Panel]       │ │  └─────────────────────┘  │ │ [Apply]     │ │
│ └───────────────┘ └───────────────────────────┘ └─────────────┘ │
│ ┌───────────────────────────────────────────────────────────────┐│
│ │ Plugin Gallery: [TTS] [STT] [LLM] [Vision] [+Add Plugin]     ││
│ └───────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

### 1.4 Five-Minute Overview

1. **Browse Components** — Left panel shows available UI components
2. **Drag & Drop** — Add components to the canvas in the center
3. **Configure** — Right panel lets you edit component properties
4. **Add Plugins** — Bottom panel shows backend plugin slots
5. **Export** — When ready, export your complete application

---

## 2. Creating Your First Plugin

App Factory uses a **contract-based plugin system**. Each plugin implements a contract (interface) that defines its capabilities.

### 2.1 Using the Plugin Wizard

1. Click **Create Plugin** in the Plugin Gallery
2. Select a contract type:
   - **TTS** — Text-to-Speech synthesis
   - **STT** — Speech-to-Text transcription
   - **LLM** — Large Language Model integration
   - **Custom** — Define your own contract

3. Fill in plugin details:
   ```
   ┌─────────────────────────────────────┐
   │ Create New Plugin                   │
   ├─────────────────────────────────────┤
   │ Name: [my_tts_plugin          ]     │
   │ Contract: [TTS ▼]                   │
   │ Author: [Your Name            ]     │
   │ Description: [________________]     │
   │                                     │
   │           [Cancel] [Create]         │
   └─────────────────────────────────────┘
   ```

4. Click **Create** to generate the plugin scaffold

### 2.2 Plugin Structure

Your new plugin will have this structure:

```
plugins/
└── my_tts_plugin/
    ├── manifest.json      # Plugin metadata
    ├── plugin.py          # Main implementation
    └── README.md          # Documentation
```

### 2.3 Implementing the Contract

Open `plugin.py` and implement the required methods:

```python
# plugins/my_tts_plugin/plugin.py
from contracts.tts_contract import TTSContract

class MyTTSPlugin(TTSContract):
    """My custom TTS plugin implementation."""

    def synthesize(self, text: str, voice_id: str = "default") -> bytes:
        """Convert text to speech audio."""
        # Your implementation here
        pass

    def get_voices(self) -> list[dict]:
        """Return available voices."""
        return [{"id": "default", "name": "Default Voice"}]

    def set_voice(self, voice_id: str) -> bool:
        """Set the active voice."""
        return True
```

### 2.4 Testing Your Plugin

1. Save your plugin code
2. Go to **Testing** panel
3. Select your plugin from the dropdown
4. Click **Run Health Check**
5. Use **Method Invoker** to test individual methods

---

## 3. Using the Factory Interface

### 3.1 Component Gallery

The Component Gallery (`src/components/factory/ComponentGallery.tsx`) displays all available UI components.

**Features:**
- **Search** — Type to filter components by name
- **Categories** — Filter by component type (Atoms, Molecules, Organisms)
- **Multi-select** — Check multiple components to add them at once
- **Preview** — Hover to see a component preview

**Adding Components:**
1. Find the component you need
2. Click or drag it to the canvas
3. Position it using the grid guides

### 3.2 Plugin Gallery

The Plugin Gallery (`src/components/factory/PluginGallery.tsx`) manages backend plugins.

```
┌─────────────────────────────────────────────────────────────┐
│ Plugin Gallery                                    [+ Add]   │
├─────────────────────────────────────────────────────────────┤
│ ┌─────────────┐ ┌─────────────┐ ┌─────────────┐            │
│ │ tts_kokoro  │ │ stt_moon    │ │ llm_ollama  │            │
│ │ ─────────── │ │ ─────────── │ │ ─────────── │            │
│ │ TTS Plugin  │ │ STT Plugin  │ │ LLM Plugin  │            │
│ │ ● Active    │ │ ○ Inactive  │ │ ● Active    │            │
│ │ [Swap]      │ │ [Load]      │ │ [Swap]      │            │
│ └─────────────┘ └─────────────┘ └─────────────┘            │
└─────────────────────────────────────────────────────────────┘
```

**Features:**
- **Status Indicators** — See which plugins are loaded
- **Health Badges** — View plugin health status
- **Quick Swap** — Replace plugins without restarting
- **Configuration** — Click to edit plugin settings

### 3.3 Live Preview

The Preview Panel (`src/components/factory/PreviewPanel.tsx`) shows real-time updates.

**Features:**
- **Instant Updates** — Changes reflect immediately
- **Theme Switching** — Toggle between light/dark modes
- **Device Frames** — Preview on different screen sizes
- **Interaction Mode** — Test component interactions

### 3.4 Theme Customization

Customize your app's appearance using the Theme Panel.

1. Click **Theme** in the toolbar
2. Adjust colors using the color pickers:
   - Primary Color
   - Secondary Color
   - Background
   - Text Colors
3. Changes preview in real-time
4. Click **Apply** to save

**Theme Components:**
- `ThemePreview.tsx` (D016) — Color preview swatches
- `ThemeCustomizationPanel.tsx` (D017) — Full theme editor
- `ThemeProvider.tsx` (D018) — Theme state management

---

## 4. Exporting Your Application

### 4.1 Export Workflow

1. Ensure all plugins pass health checks
2. Click **Export Project** in the toolbar
3. Configure export options:

```
┌─────────────────────────────────────────┐
│ Export Project                          │
├─────────────────────────────────────────┤
│ Project Name: [MyApp                ]   │
│ Version: [1.0.0                     ]   │
│                                         │
│ ☑ Include Python runtime                │
│ ☑ Generate install script               │
│ ☑ Include source code                   │
│ ☐ Minify JavaScript                     │
│                                         │
│ Output: [C:\exports\MyApp.zip      ] 📁 │
│                                         │
│              [Cancel] [Export]          │
└─────────────────────────────────────────┘
```

4. Click **Export**
5. Wait for the build to complete

### 4.2 Export Contents

The exported ZIP contains:

```
MyApp/
├── MyApp.exe                    # Windows executable
├── install_dependencies.bat     # Dependency installer
├── start.bat                    # Application launcher
├── requirements.txt             # Python dependencies
├── package.json                 # Node dependencies
├── .env                         # Environment variables (secrets)
├── plugins/                     # Your plugins
│   └── ...
├── config/                      # Configuration files
│   └── ...
└── src/                         # Source code (if included)
    └── ...
```

### 4.3 Running the Exported App

On a fresh Windows machine:

```batch
# 1. Extract the ZIP
# 2. Open Command Prompt in the extracted folder
# 3. Run the dependency installer
install_dependencies.bat

# 4. Start the application
start.bat
```

---

## 5. Testing Plugins

### 5.1 Plugin Tester

The Plugin Tester (`src/components/testing/PluginTester.tsx`) provides a comprehensive testing interface.

**Accessing the Tester:**
1. Click **Testing** in the sidebar
2. Select a plugin from the dropdown
3. View plugin status and methods

### 5.2 Method Invoker

Test individual plugin methods:

1. Select a method from the list
2. Fill in the parameters:
   ```
   ┌─────────────────────────────────────┐
   │ Method: synthesize                  │
   ├─────────────────────────────────────┤
   │ Parameters:                         │
   │   text: [Hello, World!        ]     │
   │   voice_id: [af_bella         ]     │
   │                                     │
   │              [Invoke Method]        │
   └─────────────────────────────────────┘
   ```
3. Click **Invoke Method**
4. View the result in the output panel

### 5.3 Health Dashboard

Monitor plugin health in real-time:

```
┌───────────────────────────────────────────────────────────┐
│ Health Dashboard                              [Refresh]   │
├───────────────────────────────────────────────────────────┤
│ Plugin          Status    Last Check    Response Time    │
│ ─────────────────────────────────────────────────────────│
│ tts_kokoro      ● OK      2s ago        45ms            │
│ stt_moon        ● OK      2s ago        32ms            │
│ llm_ollama      ⚠ WARN    5s ago        1250ms          │
│ custom_plugin   ✗ ERROR   10s ago       timeout         │
└───────────────────────────────────────────────────────────┘
```

**Status Indicators:**
- ● OK — Plugin is healthy
- ⚠ WARN — Plugin responding slowly or with warnings
- ✗ ERROR — Plugin failed health check

### 5.4 Log Viewer

View plugin logs for debugging:

1. Go to **Testing > Logs**
2. Filter by plugin or log level
3. Use timestamps to correlate events

---

## 6. Troubleshooting Common Issues

For detailed troubleshooting, see [docs/TROUBLESHOOTING.md](TROUBLESHOOTING.md).

### 6.1 Plugin Won't Load

**Symptoms:** Plugin shows "Load Failed" status

**Solutions:**
1. Check `manifest.json` is valid JSON
2. Verify the contract type exists
3. Ensure all dependencies are installed
4. Check the log viewer for specific errors

### 6.2 IPC Connection Failed

**Symptoms:** "Failed to connect to Python subprocess"

**Solutions:**
1. Verify Python 3.11 is installed: `python --version`
2. Check `requirements.txt` dependencies are installed
3. Look for Python errors in the terminal
4. Restart the application

### 6.3 Theme Changes Not Applying

**Symptoms:** Color changes don't reflect in preview

**Solutions:**
1. Ensure you clicked "Apply" after changes
2. Check `design_tokens.css` was updated
3. Clear browser cache (Ctrl+Shift+R)
4. Restart the dev server

### 6.4 Export Fails

**Symptoms:** Export process errors or incomplete ZIP

**Solutions:**
1. Ensure all plugins pass health checks
2. Check available disk space
3. Verify write permissions on output folder
4. Review build logs for specific errors

### 6.5 Hot-Swap Doesn't Work

**Symptoms:** Plugin swap appears stuck or fails

**Solutions:**
1. Ensure the new plugin implements the same contract
2. Wait for current operations to complete
3. Check plugin health before swapping
4. Use the rollback feature if swap fails

---

## 7. Keyboard Shortcuts

### 7.1 General

| Shortcut | Action |
|----------|--------|
| `Ctrl + N` | New Project |
| `Ctrl + O` | Open Project |
| `Ctrl + S` | Save Project |
| `Ctrl + Shift + S` | Save As |
| `Ctrl + E` | Export Project |
| `Ctrl + Z` | Undo |
| `Ctrl + Y` | Redo |
| `F5` | Refresh Preview |
| `F11` | Toggle Fullscreen |

### 7.2 Canvas Editor

| Shortcut | Action |
|----------|--------|
| `Delete` | Remove selected component |
| `Ctrl + C` | Copy component |
| `Ctrl + V` | Paste component |
| `Ctrl + D` | Duplicate component |
| `Arrow Keys` | Move component |
| `Shift + Arrow` | Move component by 10px |
| `Ctrl + A` | Select all |
| `Escape` | Deselect all |

### 7.3 Plugin Testing

| Shortcut | Action |
|----------|--------|
| `Ctrl + T` | Open Testing Panel |
| `Ctrl + H` | Run Health Check |
| `Ctrl + L` | Open Log Viewer |
| `Ctrl + Enter` | Invoke Method |

### 7.4 Navigation

| Shortcut | Action |
|----------|--------|
| `Ctrl + 1` | Component Gallery |
| `Ctrl + 2` | Plugin Gallery |
| `Ctrl + 3` | Preview Panel |
| `Ctrl + 4` | Property Inspector |
| `Ctrl + 5` | Testing Panel |

---

## 8. Importing Third-Party Components

App Factory allows you to import components and plugins from external sources like GitHub repositories or direct URLs.

### 8.1 Using the Import Wizard

1. Click **Import** in the Gallery toolbar
2. Select your import source type:
   - **GitHub** — Import from a GitHub repository
   - **Direct URL** — Import from a raw JSON manifest URL
   - **Local File** — Import from a local file path

3. Enter the source URL:
   ```
   ┌─────────────────────────────────────────┐
   │ Import Component                        │
   ├─────────────────────────────────────────┤
   │ Source: [GitHub ▼]                      │
   │                                         │
   │ GitHub URL:                             │
   │ [https://github.com/user/repo/...    ]  │
   │                                         │
   │              [Cancel] [Continue]        │
   └─────────────────────────────────────────┘
   ```

4. The wizard will fetch and validate the component manifest
5. Review the component metadata before installing:
   - Name, version, and description
   - Author and license
   - Dependencies required
   - Tags and categories

6. Click **Install** to add the component to your project

### 8.2 Supported Import Sources

| Source | Format | Example |
|--------|--------|---------|
| GitHub | Repository URL or raw file | `https://github.com/user/component` |
| Direct URL | Raw JSON manifest | `https://example.com/manifest.json` |
| Local | File path | `C:/components/manifest.json` |

### 8.3 Component Manifest Format

Imported components must include a valid `manifest.json`:

```json
{
  "name": "my_component",
  "displayName": "My Component",
  "version": "1.0.0",
  "description": "Component description",
  "author": "Author Name",
  "license": "MIT",
  "type": "component",
  "dependencies": [],
  "tags": ["utility", "ui"]
}
```

---

## 9. Project Backup and Restore

App Factory provides backup functionality to protect your project data during updates and modifications.

### 9.1 Creating a Backup

1. Open your project in the editor
2. Go to **File > Backup Project** or press `Ctrl + B`
3. Optionally add a description for the backup
4. The backup will be created in `project/backups/` folder

```
┌─────────────────────────────────────────┐
│ Create Backup                           │
├─────────────────────────────────────────┤
│ Project: MyApp                          │
│ Location: C:/Projects/MyApp/backups/    │
│                                         │
│ Description (optional):                 │
│ [Before major refactoring         ]     │
│                                         │
│              [Cancel] [Create Backup]   │
└─────────────────────────────────────────┘
```

### 9.2 Backup Contents

Each backup is a ZIP archive containing:

```
backups/
└── 2025-12-25T10-30-00_MyApp.zip
    ├── project.json      # Project configuration
    ├── plugins.yaml      # Plugin settings
    ├── screens/          # Screen definitions
    ├── components/       # Custom components
    └── config/           # Configuration files
```

**Excluded from backups:**
- `node_modules/`
- `.git/`
- `dist/` and `build/`
- `__pycache__/`
- `.env.local` (sensitive data)

### 9.3 Restoring from Backup

1. Go to **File > Restore from Backup**
2. Select a backup from the list
3. Choose restore options:
   - **Restore in Place** — Overwrites current project
   - **Restore to New Location** — Creates a copy

```
┌─────────────────────────────────────────────────┐
│ Restore Backup                                  │
├─────────────────────────────────────────────────┤
│ Available Backups:                              │
│                                                 │
│ ● 2025-12-25 10:30 AM                          │
│   "Before major refactoring"                    │
│   Size: 2.4 MB                                  │
│                                                 │
│ ○ 2025-12-24 03:15 PM                          │
│   Size: 2.1 MB                                  │
│                                                 │
│           [Cancel] [Restore Selected]           │
└─────────────────────────────────────────────────┘
```

### 9.4 Automatic Backup Cleanup

By default, App Factory keeps the 5 most recent backups. Older backups are automatically deleted to save disk space.

To change retention settings:
1. Go to **Settings > Backup**
2. Adjust "Keep recent backups" value

### 9.5 Verifying Backups

You can verify backup integrity:
1. Right-click on a backup in the list
2. Select **Verify Backup**
3. The system will check the archive for corruption

---

## Additional Resources

- **Architecture Documentation:** [docs/ARCHITECTURE.md](ARCHITECTURE.md)
- **Plugin Development Guide:** [docs/PLUGIN_DEVELOPMENT.md](PLUGIN_DEVELOPMENT.md)
- **API Reference:** [docs/API_REFERENCE.md](API_REFERENCE.md)
- **Changelog:** [docs/CHANGELOG.md](CHANGELOG.md)

---

*User Guide Version: 1.1 | Last Updated: 2025-12-25*
