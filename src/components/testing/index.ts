/**
 * B014 - src/components/testing/index.ts
 * =======================================
 * Barrel exports for testing components.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 */

// D057-D060: Plugin Testing Components
export { PluginTester } from './PluginTester';
export { MethodInvoker } from './MethodInvoker';
export { HealthDashboard } from './HealthDashboard';
export { LogViewer } from './LogViewer';
