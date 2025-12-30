# App Factory

> A visual application builder with plugin support for TTS, STT, and LLM integrations.

## Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | 18+ | `node --version` |
| Python | 3.11+ | `python --version` |
| Rust | 1.70+ | `rustc --version` |
| npm | 9+ | `npm --version` |

### Windows-Specific
- [Microsoft Visual C++ Build Tools](https://visualstudio.microsoft.com/visual-cpp-build-tools/)
- [WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/)

## Quick Start

```bash
# 1. Clone the repository
git clone <repository-url>
cd app_factory

# 2. Install frontend dependencies
npm install

# 3. Install Python dependencies
pip install -r requirements.txt

# 4. Run in development mode
npm run tauri dev

# 5. Build for production
npm run tauri build
```

## Project Structure

```
app_factory/
├── src/                    # React frontend
│   ├── components/         # UI components
│   │   ├── ui/            # Atomic components (Button, Input, etc.)
│   │   ├── factory/       # Factory interface components
│   │   ├── wizard/        # Plugin creation wizard
│   │   ├── testing/       # Plugin testing harness
│   │   ├── project/       # Project management
│   │   ├── ai/            # AI-assisted features
│   │   └── gallery/       # Gallery management
│   ├── stores/            # Zustand state stores
│   ├── hooks/             # React hooks
│   ├── context/           # React context providers
│   └── utils/             # Utility functions
├── src-tauri/             # Rust/Tauri backend
│   └── src/
│       ├── ipc/           # IPC layer for Python communication
│       └── commands/      # Tauri command handlers
├── plugins/               # Plugin directory
│   └── _host/            # Python plugin host
├── contracts/             # Plugin contract definitions
├── config/                # Configuration files
├── templates/             # Export templates
└── docs/                  # Documentation
```

## Architecture

App Factory uses **Plugin Option C**: Tauri + React + Python subprocess via stdio IPC.

- **Frontend**: React 18 + TypeScript + Tailwind CSS
- **Desktop**: Tauri 1.8.x (Rust)
- **Backend**: Python 3.11 subprocess
- **IPC**: JSON-RPC 2.0 over stdin/stdout

See [Architecture Documentation](docs/ARCHITECTURE.md) for details.

## Documentation

| Document | Description |
|----------|-------------|
| [Architecture](docs/ARCHITECTURE.md) | System architecture and design |
| [Plugin Development](docs/PLUGIN_DEVELOPMENT.md) | How to create plugins |
| [API Reference](docs/API_REFERENCE.md) | JSON-RPC API documentation |
| [Troubleshooting](docs/TROUBLESHOOTING.md) | Common issues and solutions |
| [Changelog](docs/CHANGELOG.md) | Version history |

## Plugin Contracts

App Factory supports three plugin contracts:

| Contract | Description | Example |
|----------|-------------|---------|
| TTS | Text-to-Speech synthesis | Kokoro, Piper |
| STT | Speech-to-Text recognition | Whisper, Moonshine |
| LLM | Language Model inference | Ollama, OpenAI |

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start Vite dev server |
| `npm run build` | Build frontend for production |
| `npm run tauri dev` | Run Tauri in development mode |
| `npm run tauri build` | Build Tauri application |

## Environment Variables

Copy `.env.example` to `.env` and configure:

```env
LOG_LEVEL=info
PLUGIN_HOST_LOG_LEVEL=info
```

## License

MIT License - see LICENSE file for details.

---

*Built with Tauri, React, and Python*
