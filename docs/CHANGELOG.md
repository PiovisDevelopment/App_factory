# D090 - Changelog

> All notable changes to App Factory are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [1.0.0] - 2025-12-24

### Added

#### Phase 0: Foundations (D001-D009)
- **D001**: `contracts/base.py` - PluginBase ABC with lifecycle methods
- **D002**: `contracts/tts_contract.py` - TTS contract interface
- **D003**: `contracts/stt_contract.py` - STT contract interface
- **D004**: `contracts/llm_contract.py` - LLM contract interface
- **D005**: `config/contract_prefixes.yaml` - Plugin category prefixes
- **D006**: `config/design_tokens.css` - CSS custom properties
- **D007**: `tailwind.config.js` - Tailwind token integration
- **D008**: `config/manifest_schema.json` - Plugin manifest JSON schema
- **D009**: `config/error_codes.yaml` - JSON-RPC error codes

#### Phase 1: Atomic UI Components (D010-D019)
- **D010**: `Button.tsx` - Button atom component
- **D011**: `Input.tsx` - Input atom component
- **D012**: `Select.tsx` - Select atom component
- **D013**: `Checkbox.tsx` - Checkbox atom component
- **D014**: `Panel.tsx` - Panel container component
- **D015**: `Modal.tsx` - Modal dialog component
- **D016**: `ThemePreview.tsx` - Theme preview component
- **D017**: `ThemeCustomizationPanel.tsx` - Theme editor
- **D018**: `ThemeProvider.tsx` - Theme context provider
- **D019**: `WindowConfigPanel.tsx` - Window configuration UI

#### Phase 2: Plugin Infrastructure (D020-D029)
- **D020**: `discovery.py` - HybridDiscovery class for plugin scanning
- **D021**: `__init__.py` - Host package init with logging
- **D022**: `validator.py` - PluginValidator for manifest validation
- **D023**: `loader.py` - PluginLoader for module loading
- **D024**: `manager.py` - PluginManager for lifecycle management
- **D025**: `__main__.py` - Plugin host entry point with JSON-RPC loop
- **D026**: `protocol.py` - JsonRpcRouter for request handling
- **D027**: `shutdown.py` - Graceful shutdown handler
- **D028**: `isolation.py` - IsolatedExecutor for plugin isolation
- **D029**: `contracts_registry.yaml` - Contract registry configuration

#### Phase 3: Rust IPC Layer (D030-D036)
- **D030**: `ipc/mod.rs` - IPC module root
- **D031**: `ipc/request.rs` - JSON-RPC request builder
- **D032**: `ipc/response.rs` - JSON-RPC response parser
- **D033**: `ipc/spawn.rs` - Python subprocess spawn
- **D034**: `ipc/health.rs` - Health monitoring
- **D035**: `ipc/manager.rs` - IpcManager struct
- **D036**: `commands/mod.rs` - Tauri command handlers

#### Phase 4: Frontend Integration (D040-D049)
- **D040**: `PluginGallery.tsx` - Plugin gallery grid
- **D041**: `PluginCard.tsx` - Plugin card component
- **D042**: `ComponentGallery.tsx` - Frontend component gallery
- **D043**: `ComponentCard.tsx` - Component card
- **D044**: `PreviewPanel.tsx` - Live preview panel
- **D045**: `CanvasEditor.tsx` - Layout canvas editor
- **D046**: `PropertyInspector.tsx` - Property editor panel
- **D047**: `ExportModal.tsx` - Export configuration modal
- **D048**: `ScreenTree.tsx` - Screen/widget tree view
- **D049**: `FactoryLayout.tsx` - Main factory layout

#### Phase 5: Plugin Creation Pipeline (D050-D062)
- **D050**: `PluginWizard.tsx` - Plugin creation wizard
- **D051**: `ContractSelector.tsx` - Contract type selector
- **D052**: `ManifestEditor.tsx` - Manifest editor form
- **D053**: `DependencySelector.tsx` - Dependency picker
- **D054**: `ScaffoldPreview.tsx` - Generated code preview
- **D055**: `scaffold.py` - Plugin scaffold generator
- **D056**: `templates/` - Plugin templates directory
- **D057**: `PluginTester.tsx` - Plugin test harness UI
- **D058**: `MethodInvoker.tsx` - Method test invoker
- **D059**: `HealthDashboard.tsx` - Health status dashboard
- **D060**: `LogViewer.tsx` - Plugin log viewer
- **D061**: `test_runner.py` - Python test runner
- **D062**: `test_fixtures.yaml` - Test fixture definitions

#### Phase 6: App Management + AI (D063-D079)
- **D063**: `ProjectLoader.tsx` - Load existing project
- **D064**: `ComponentEditor.tsx` - Edit frontend components
- **D065**: `ScreenEditor.tsx` - Edit screens/widgets
- **D066**: `PluginSlotManager.tsx` - Plugin slot view
- **D067**: `AddSlotModal.tsx` - Add component slot
- **D068**: `SwapPluginModal.tsx` - Hot-swap plugin UI
- **D069**: `ChatInterface.tsx` - AI chat UI
- **D070**: `ComponentGenerator.tsx` - AI component generation
- **D071**: `ConversationFlow.tsx` - AI conversation wizard
- **D072**: `ContractWizard.tsx` - AI contract creator
- **D073**: `FixSuggestions.tsx` - AI fix suggestions
- **D074**: `GalleryManager.tsx` - Gallery CRUD UI
- **D075**: `factoryStore.ts` - Zustand factory store
- **D076**: `pluginStore.ts` - Zustand plugin store
- **D077**: `projectStore.ts` - Zustand project store
- **D078**: `useIpc.ts` - IPC React hook
- **D079**: `usePlugin.ts` - Plugin management hook

#### Phase 7: Production Export + Docs (D080-D090)
- **D080**: `exporter.ts` - Project export logic
- **D081**: `tauri.conf.template.json` - Tauri config template
- **D082**: `plugins.yaml.template` - Plugin config template
- **D083**: `start.bat.template` - Windows launcher template
- **D084**: `.env.template` - Environment template
- **D085**: `README.md.template` - Project README template
- **D086**: `ARCHITECTURE.md` - Architecture documentation
- **D087**: `PLUGIN_DEVELOPMENT.md` - Plugin development guide
- **D088**: `API_REFERENCE.md` - API reference documentation
- **D089**: `TROUBLESHOOTING.md` - Troubleshooting guide
- **D090**: `CHANGELOG.md` - Project changelog

### Architecture

- **Plugin Option C**: Tauri + React + Python subprocess via stdio IPC
- **Protocol**: JSON-RPC 2.0 over stdin/stdout (newline-delimited)
- **Plugin Framework**: Pluggy pattern with contract-based discovery

### Technical Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Frontend | React + TypeScript | ^18.3.1 / ^5.4.5 |
| Build | Vite + Tailwind CSS | ^5.2.0 / ^3.4.3 |
| Desktop | Tauri (Rust) | 1.8.x |
| Backend | Python subprocess | 3.11.x |
| IPC | JSON-RPC 2.0 over stdio | N/A |
| Plugins | Pluggy pattern | 1.5.0+ |
| State | Zustand | ^4.x |

### Features

- **Contract-Based Plugins**: TTS, STT, LLM contracts with validation
- **Hot-Swap Support**: Replace plugins at runtime without restart
- **Health Monitoring**: Periodic health checks with auto-recovery
- **Design Token System**: Centralized styling via CSS variables
- **Dark Mode**: Full dark theme support
- **Export System**: Generate standalone Tauri applications
- **AI Integration**: AI-assisted component and contract creation

### Security

- Content Security Policy (CSP) enforcement
- Plugin isolation with resource limits
- No exposed network ports (stdio IPC only)
- Manifest validation against JSON Schema

---

## [Unreleased]

### Planned Features

- [ ] MCP (Model Context Protocol) contract support
- [ ] Plugin marketplace integration
- [ ] Collaborative editing support
- [ ] Additional export targets (macOS, Linux)
- [ ] Plugin signing and verification
- [ ] Performance profiling tools

### Planned Improvements

- [ ] Improved hot-swap state preservation
- [ ] Plugin dependency resolution
- [ ] Incremental export builds
- [ ] WebSocket streaming support

---

## Version History

| Version | Date | Status |
|---------|------|--------|
| 1.0.0 | 2025-12-24 | Released |

---

## Migration Notes

### Upgrading from Beta

If upgrading from a beta version:

1. **Backup your plugins**
   ```batch
   xcopy /e /i plugins plugins_backup
   ```

2. **Update manifests**
   - Ensure `version` follows semver format
   - Add `config_schema` if using configuration

3. **Update plugin code**
   - Extend from new contract classes
   - Implement `health_check()` method
   - Use async `initialize()` and `shutdown()`

4. **Clear cache**
   ```batch
   rmdir /s /q cache
   rmdir /s /q logs
   ```

---

## Contributors

- Piovis Development Team

---

*Changelog maintained following [Keep a Changelog](https://keepachangelog.com/) principles.*
