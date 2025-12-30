/**
 * B015 - src/components/project/index.ts
 * =======================================
 * Barrel exports for project components.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 */

// D063-D068: Project Management Components
export { ProjectLoader } from './ProjectLoader';
export { ComponentEditor } from './ComponentEditor';
export { ScreenEditor } from './ScreenEditor';
export { PluginSlotManager } from './PluginSlotManager';
export { AddSlotModal } from './AddSlotModal';
export { SwapPluginModal } from './SwapPluginModal';
