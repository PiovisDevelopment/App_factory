/**
 * B012 - src/components/factory/index.ts
 * =======================================
 * Barrel exports for factory components.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 */

// D040-D049: Factory Components
export { PluginGallery } from './PluginGallery';
export { PluginCard } from './PluginCard';
export { ComponentGallery } from './ComponentGallery';
export { ComponentCard } from './ComponentCard';
export { PreviewPanel } from './PreviewPanel';
export { CanvasEditor } from './CanvasEditor';
export { PropertyInspector } from './PropertyInspector';
export { ExportModal } from './ExportModal';
export { ScreenTree } from './ScreenTree';
export { FactoryLayout } from './FactoryLayout';

// Sidebar (UJ-1.1.3)
export { Sidebar } from './Sidebar';
export type { SidebarProps, SidebarTab } from './Sidebar';
