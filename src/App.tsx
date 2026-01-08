/**
 * B003 - src/App.tsx
 * ==================
 * Root application component with providers and layout.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D018 (ThemeProvider), D049 (FactoryLayout), D040-D048 (Factory components)
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { ThemeProvider, useTheme } from './context/ThemeProvider';
import { FactoryLayout } from './components/factory/FactoryLayout';
import { PluginGallery, type PluginInfo } from './components/factory/PluginGallery';
import { ComponentGallery, type ComponentInfo } from './components/factory/ComponentGallery';
import { CanvasEditor, type CanvasElement, type ElementBounds } from './components/factory/CanvasEditor';
import { PropertyInspector } from './components/factory/PropertyInspector';
import { ProjectLoader, type ProjectInfo } from './components/project/ProjectLoader';
import { useProjectStore, type ProjectFile } from './stores/projectStore';
import { type ComponentFramework } from './stores/componentLibraryStore';
import { isTauri } from './utils/tauriUtils';
import { ThemeCustomizationPanel } from './components/ui/ThemeCustomizationPanel';
import { WindowConfigPanel, useWindowConfigStore } from './components/ui/WindowConfigPanel';
import { Modal } from './components/ui/Modal';
// ProjectDetailsPanel import removed as it does not exist
// Sidebar Icons
const FolderIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />
  </svg>
);
const ComponentIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <line x1="12" y1="3" x2="12" y2="21" />
    <line x1="3" y1="12" x2="21" y2="12" />
  </svg>
);
const PluginIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2" />
  </svg>
);
// New Icons for Sidebar
const LayoutIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
  </svg>
);
const WindowIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <path d="M3 9h18" />
    <path d="M9 21V9" />
    <rect x="7" y="7" width="10" height="10" />
  </svg>
);

// Template Icon for sidebar (EUR-1.1.10)
const TemplateIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="7" height="7" />
    <rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" />
    <rect x="3" y="14" width="7" height="7" />
  </svg>
);

// Backend Blueprint Icon (EUR-1.2.10)
const BlueprintIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <polygon points="12 2 2 7 12 12 22 7 12 2" />
    <polyline points="2 17 12 22 22 17" />
    <polyline points="2 12 12 17 22 12" />
  </svg>
);

// Running Man Icon for User Request
const RunningIcon = ({ className }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <path d="M18.5 12.5L14.5 16.5L18.5 20.5" />
    <circle cx="13" cy="4" r="2.5" />
    <path d="M4 17L9 11L13 14L15 8" />
    <path d="M13 8H9L5 11" />
  </svg>
);

// PreviewPanel and CanvasPreview removed - Canvas now has device viewport selector
import { ComponentGenerator, type GeneratedComponent } from './components/ai/ComponentGenerator';
import { useComponentGenerator } from './hooks/useComponentGenerator';
import { SettingsPanel } from './components/ui/SettingsPanel';
import { useComponentLibraryStore, type ComponentCategory } from './stores/componentLibraryStore';
import { ImportWizard, type ComponentManifest } from './components/wizard/ImportWizard';
import { registerComponent } from './utils/ComponentRegistry';
import { MuiButtonAdapter, DashboardStatsBlock, GitHubRepoPreview } from './components/external/ExternalWrappers';
import { TemplateBrowser } from './components/templates/TemplateBrowser';
import { BackendBlueprintPanel, type PluginSlot } from './components/factory/BackendBlueprintPanel';
import { AiTeamVisualization } from './components/ai/AiTeamVisualization';
import { PluginConfigPanel, type PluginConfigOption } from './components/factory/PluginConfigPanel';

import { AiAppChatPanel, AiAppChatIcon } from './components/ai/AiAppChatPanel';

/**
 * Application mode type.
 * - launcher: Shows project selection screen
 * - editor: Shows the factory editor interface
 */
type AppMode = 'launcher' | 'editor';

/**
 * Extended PluginInfo with configuration options.
 */
interface PluginInfoWithConfig extends PluginInfo {
  config?: PluginConfigOption[];
}

/**
 * Sample plugin data for demonstration.
 */
const samplePlugins: PluginInfoWithConfig[] = [
  {
    id: 'tts_kokoro',
    name: 'Kokoro TTS',
    version: '1.0.0',
    description: 'High-quality text-to-speech using Kokoro model',
    contract: 'tts',
    status: 'unloaded',
    author: 'Piovis',
    builtIn: true,
    tags: ['voice', 'speech', 'synthesis'],
    config: [
      {
        key: 'voice',
        label: 'Voice Model',
        type: 'select',
        value: 'af_sky',
        defaultValue: 'af_sky',
        description: 'The voice model to use for speech synthesis',
        options: [
          { value: 'af_sky', label: 'Sky (Female, American)' },
          { value: 'af_bella', label: 'Bella (Female, American)' },
          { value: 'am_adam', label: 'Adam (Male, American)' },
          { value: 'bf_emma', label: 'Emma (Female, British)' },
        ],
      },
      {
        key: 'speed',
        label: 'Speed',
        type: 'number',
        value: 1.0,
        defaultValue: 1.0,
        description: 'Speech speed multiplier (0.5 - 2.0)',
        validation: { min: 0.5, max: 2.0 },
      },
    ],
  },
  {
    id: 'stt_whisper',
    name: 'Whisper STT',
    version: '1.2.0',
    description: 'Speech-to-text using OpenAI Whisper',
    contract: 'stt',
    status: 'unloaded',
    author: 'Piovis',
    builtIn: true,
    tags: ['voice', 'transcription', 'recognition'],
    config: [
      {
        key: 'model',
        label: 'Model Size',
        type: 'select',
        value: 'base',
        defaultValue: 'base',
        description: 'Whisper model size (larger = more accurate but slower)',
        options: [
          { value: 'tiny', label: 'Tiny (~39M params)' },
          { value: 'base', label: 'Base (~74M params)' },
          { value: 'small', label: 'Small (~244M params)' },
          { value: 'medium', label: 'Medium (~769M params)' },
          { value: 'large-v3', label: 'Large v3 (~1.5B params)' },
        ],
      },
      {
        key: 'language',
        label: 'Language',
        type: 'select',
        value: 'en',
        defaultValue: 'en',
        description: 'Transcription language',
        options: [
          { value: 'en', label: 'English' },
          { value: 'auto', label: 'Auto-detect' },
          { value: 'es', label: 'Spanish' },
          { value: 'fr', label: 'French' },
          { value: 'de', label: 'German' },
        ],
      },
      {
        key: 'useGpu',
        label: 'Use GPU Acceleration',
        type: 'boolean',
        value: true,
        defaultValue: true,
        description: 'Enable CUDA acceleration for faster transcription',
      },
    ],
  },
  {
    id: 'llm_ollama',
    name: 'Ollama LLM',
    version: '2.0.0',
    description: 'Local LLM inference via Ollama',
    contract: 'llm',
    status: 'unloaded',
    author: 'Piovis',
    builtIn: true,
    tags: ['ai', 'inference', 'local'],
    config: [
      {
        key: 'model',
        label: 'Model Name',
        type: 'select',
        value: 'llama3.2',
        defaultValue: 'llama3.2',
        description: 'The LLM model to use for inference',
        options: [
          { value: 'llama3.2', label: 'Llama 3.2' },
          { value: 'llama3.1', label: 'Llama 3.1' },
          { value: 'codellama', label: 'Code Llama' },
          { value: 'mistral', label: 'Mistral' },
          { value: 'phi3', label: 'Phi-3' },
        ],
      },
      {
        key: 'baseUrl',
        label: 'Ollama Server URL',
        type: 'string',
        value: 'http://localhost:11434',
        defaultValue: 'http://localhost:11434',
        description: 'URL of the Ollama server',
      },
      {
        key: 'temperature',
        label: 'Temperature',
        type: 'number',
        value: 0.7,
        defaultValue: 0.7,
        description: 'Sampling temperature (0 = deterministic, 2 = creative)',
        validation: { min: 0, max: 2 },
      },
      {
        key: 'maxTokens',
        label: 'Max Tokens',
        type: 'number',
        value: 2048,
        defaultValue: 2048,
        description: 'Maximum tokens to generate',
        validation: { min: 1, max: 32768 },
      },
    ],
  },
  {
    id: 'mem_chromadb',
    name: 'ChromaDB Memory',
    version: '1.1.0',
    description: 'Vector memory storage using ChromaDB',
    contract: 'memory',
    status: 'unloaded',
    author: 'Piovis',
    tags: ['memory', 'vector', 'embeddings'],
    config: [
      {
        key: 'persistPath',
        label: 'Storage Path',
        type: 'path',
        value: './chroma_db',
        defaultValue: './chroma_db',
        description: 'Path to persist the vector database',
      },
      {
        key: 'collectionName',
        label: 'Collection Name',
        type: 'string',
        value: 'default',
        defaultValue: 'default',
        description: 'Name of the ChromaDB collection',
      },
    ],
  },
];

/**
 * Sample UI components for the Component Gallery (UJ-1.1.2).
 */
const sampleComponents: ComponentInfo[] = [
  {
    id: 'button_primary',
    name: 'Primary Button',
    category: 'atoms',
    type: 'button',
    description: 'Standard primary action button with hover and focus states',
    builtIn: true,
    tags: ['action', 'interactive', 'primary'],
    version: '1.0.0',
  },
  {
    id: 'button_secondary',
    name: 'Secondary Button',
    category: 'atoms',
    type: 'button',
    description: 'Secondary action button for less prominent actions',
    builtIn: true,
    tags: ['action', 'interactive', 'secondary'],
    version: '1.0.0',
  },
  {
    id: 'input_text',
    name: 'Text Input',
    category: 'atoms',
    type: 'input',
    description: 'Single-line text input field with validation support',
    builtIn: true,
    tags: ['form', 'input', 'text'],
    version: '1.0.0',
  },
  {
    id: 'input_textarea',
    name: 'Text Area',
    category: 'atoms',
    type: 'input',
    description: 'Multi-line text input for longer content',
    builtIn: true,
    tags: ['form', 'input', 'multiline'],
    version: '1.0.0',
  },
  {
    id: 'select_dropdown',
    name: 'Dropdown Select',
    category: 'atoms',
    type: 'select',
    description: 'Dropdown selection component with search capability',
    builtIn: true,
    tags: ['form', 'select', 'dropdown'],
    version: '1.0.0',
  },
  {
    id: 'checkbox_standard',
    name: 'Checkbox',
    category: 'atoms',
    type: 'checkbox',
    description: 'Standard checkbox for boolean selections',
    builtIn: true,
    tags: ['form', 'checkbox', 'boolean'],
    version: '1.0.0',
  },
  {
    id: 'card_basic',
    name: 'Basic Card',
    category: 'molecules',
    type: 'card',
    description: 'Container card with header, body, and footer sections',
    builtIn: true,
    tags: ['container', 'content', 'card'],
    version: '1.0.0',
  },
  {
    id: 'card_media',
    name: 'Media Card',
    category: 'molecules',
    type: 'card',
    description: 'Card with image/media header and content area',
    builtIn: true,
    tags: ['container', 'media', 'image'],
    version: '1.0.0',
  },
  {
    id: 'panel_collapsible',
    name: 'Collapsible Panel',
    category: 'molecules',
    type: 'panel',
    description: 'Expandable panel with header toggle',
    builtIn: true,
    tags: ['container', 'collapsible', 'accordion'],
    version: '1.0.0',
  },
  {
    id: 'modal_dialog',
    name: 'Modal Dialog',
    category: 'molecules',
    type: 'modal',
    description: 'Overlay dialog for confirmations and forms',
    builtIn: true,
    tags: ['overlay', 'dialog', 'popup'],
    version: '1.0.0',
  },
  {
    id: 'list_standard',
    name: 'Standard List',
    category: 'molecules',
    type: 'list',
    description: 'Vertical list with configurable item rendering',
    builtIn: true,
    tags: ['list', 'items', 'collection'],
    version: '1.0.0',
  },
  {
    id: 'form_login',
    name: 'Login Form',
    category: 'organisms',
    type: 'form',
    description: 'Complete login form with validation',
    builtIn: true,
    tags: ['form', 'auth', 'login'],
    version: '1.0.0',
  },
  {
    id: 'nav_sidebar',
    name: 'Sidebar Navigation',
    category: 'organisms',
    type: 'navigation',
    description: 'Vertical sidebar navigation with nested items',
    builtIn: true,
    tags: ['navigation', 'sidebar', 'menu'],
    version: '1.0.0',
  },
  {
    id: 'nav_header',
    name: 'Header Navigation',
    category: 'organisms',
    type: 'navigation',
    description: 'Horizontal header with logo and nav links',
    builtIn: true,
    tags: ['navigation', 'header', 'topbar'],
    version: '1.0.0',
  },
  {
    id: 'layout_split',
    name: 'Split Layout',
    category: 'layouts',
    type: 'container',
    description: 'Two-column resizable split layout',
    builtIn: true,
    tags: ['layout', 'split', 'columns'],
    version: '1.0.0',
  },
  {
    id: 'layout_dashboard',
    name: 'Dashboard Layout',
    category: 'templates',
    type: 'container',
    description: 'Full dashboard template with sidebar, header, and content',
    builtIn: true,
    tags: ['template', 'dashboard', 'admin'],
    version: '1.0.0',
  },
  // New Container Components
  {
    id: 'container_fluid',
    name: 'Fluid Container',
    category: 'containers',
    type: 'container',
    description: 'Full-size responsive container',
    builtIn: true,
    tags: ['layout', 'fluid', 'full'],
    version: '1.0.0',
    // Default size for drag-and-drop
    defaultSize: { width: 400, height: 300 }
  },
  {
    id: 'container_header',
    name: 'Header Bar',
    category: 'containers',
    type: 'container',
    description: 'Top navigation bar container',
    builtIn: true,
    tags: ['layout', 'header', 'nav'],
    version: '1.0.0',
    defaultSize: { width: 800, height: 64 }
  },
  {
    id: 'container_sidebar',
    name: 'Sidebar',
    category: 'containers',
    type: 'container',
    description: 'Vertical sidebar navigation container',
    builtIn: true,
    tags: ['layout', 'sidebar', 'nav'],
    version: '1.0.0',
    defaultSize: { width: 250, height: 600 }
  },
  {
    id: 'container_footer',
    name: 'Footer',
    category: 'containers',
    type: 'container',
    description: 'Bottom footer container area',
    builtIn: true,
    tags: ['layout', 'footer'],
    version: '1.0.0',
    defaultSize: { width: 800, height: 60 }
  },
  {
    id: 'container_card',
    name: 'Card Container',
    category: 'containers',
    type: 'container',
    description: 'Content box with standard layout',
    builtIn: true,
    tags: ['layout', 'card', 'box'],
    version: '1.0.0',
    defaultSize: { width: 300, height: 200 }
  },
];

/**
 * Initial canvas elements.
 * Starts empty to provide a clean slate.
 */
const initialCanvasElements: CanvasElement[] = [];

/**
 * Header component with app title and toolbar.
 */
interface AppHeaderProps {
  projectName?: string;
  projectFileName?: string;
  onBackToLauncher?: () => void;
  isThemePanelOpen?: boolean;
  onToggleThemePanel?: () => void;
  isWindowConfigOpen?: boolean;
  onToggleWindowConfig?: () => void;
  showPreview?: boolean;
  onTogglePreview?: () => void;
  showBackendBlueprint?: boolean;
  onToggleBackendBlueprint?: () => void;
  onToggleSettings?: () => void;
  onSaveProject?: () => void;

  onSaveProjectAs?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  projectName,
  projectFileName,
  onBackToLauncher,
  isThemePanelOpen = false,
  onToggleThemePanel,
  isWindowConfigOpen = false,
  onToggleWindowConfig,
  showPreview = false,
  onTogglePreview,
  showBackendBlueprint = false,
  onToggleBackendBlueprint,
  onToggleSettings,
  onSaveProject,

  onSaveProjectAs,
}) => (
  <div className="flex items-center justify-between w-full">
    <div className="flex items-center gap-3">
      {onBackToLauncher && (
        <button
          type="button"
          onClick={onBackToLauncher}
          className="p-1.5 rounded-md text-neutral-500 hover:text-neutral-700 hover:bg-neutral-100 transition-colors"
          title="Back to Projects"
        >
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <line x1="19" y1="12" x2="5" y2="12" />
            <polyline points="12 19 5 12 12 5" />
          </svg>
        </button>
      )}
      <div className="h-8 w-8 rounded-lg bg-primary-500 flex items-center justify-center">
        <svg className="h-5 w-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <line x1="3" y1="9" x2="21" y2="9" />
          <line x1="9" y1="21" x2="9" y2="9" />
        </svg>
      </div>
      <div className="flex flex-col">
        <span className="font-semibold text-neutral-800">App Factory</span>
        {projectName && projectName !== 'Untitled Project' && (
          <span className="text-xs text-neutral-500">
            {projectName}
            {projectFileName && ` (${projectFileName})`}
          </span>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2">
      {/* Save Button */}
      {onSaveProject && (
        <button
          type="button"
          onClick={onSaveProject}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
          title="Save Project"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
          </svg>
          Save
        </button>
      )}
      {/* Save As Button */}
      {onSaveProjectAs && (
        <button
          type="button"
          onClick={onSaveProjectAs}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
          title="Save As"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
            <polyline points="17 21 17 13 7 13 7 21" />
            <polyline points="7 3 7 8 15 8" />
            <line x1="12" y1="7" x2="12" y2="12" />
            <line x1="9.5" y1="9.5" x2="14.5" y2="9.5" />
          </svg>
          Save As
        </button>
      )}
      {/* Theme Button */}
      {onToggleThemePanel && (
        <button
          type="button"
          onClick={onToggleThemePanel}
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            isThemePanelOpen
              ? "bg-primary-100 text-primary-700"
              : "text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100",
          ].join(" ")}
          title="Theme Customization"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="5" />
            <line x1="12" y1="1" x2="12" y2="3" />
            <line x1="12" y1="21" x2="12" y2="23" />
            <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
            <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
            <line x1="1" y1="12" x2="3" y2="12" />
            <line x1="21" y1="12" x2="23" y2="12" />
            <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
            <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
          </svg>
          Theme
        </button>
      )}
      {/* Window Config Button */}
      {onToggleWindowConfig && (
        <button
          type="button"
          onClick={onToggleWindowConfig}
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            isWindowConfigOpen
              ? "bg-primary-100 text-primary-700"
              : "text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100",
          ].join(" ")}
          title="Window Configuration"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
            <line x1="3" y1="9" x2="21" y2="9" />
          </svg>
          Window
        </button>
      )}
      {/* Preview Button */}
      {onTogglePreview && (
        <button
          type="button"
          onClick={onTogglePreview}
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            showPreview
              ? "bg-primary-100 text-primary-700"
              : "text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100",
          ].join(" ")}
          title="Toggle Preview Panel"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
            <circle cx="12" cy="12" r="3" />
          </svg>
          Preview
        </button>
      )}
      {/* Backend Blueprint Button (EUR-1.2.10) */}
      {onToggleBackendBlueprint && (
        <button
          type="button"
          onClick={onToggleBackendBlueprint}
          className={[
            "flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors",
            showBackendBlueprint
              ? "bg-primary-100 text-primary-700"
              : "text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100",
          ].join(" ")}
          title="Backend Architecture Blueprint"
        >
          <BlueprintIcon className="h-4 w-4" />
          Blueprint
        </button>
      )}
      {/* Settings Button */}
      {onToggleSettings && (
        <button
          type="button"
          onClick={onToggleSettings}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium text-neutral-600 hover:text-neutral-800 hover:bg-neutral-100 transition-colors"
          title="Settings"
        >
          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z" />
          </svg>
          Settings
        </button>
      )}
      <span className="text-xs text-neutral-500">v1.0.0</span>
    </div>
  </div>
);

// sampleProjects removed - projects are now loaded dynamically from outputs/projects folder

/**
 * Root application component.
 *
 * Wraps the entire application with necessary providers:
 * - ThemeProvider: Manages light/dark theme and design tokens
 *
 * Renders:
 * - ProjectLoader: When in launcher mode (start screen)
 * - FactoryLayout: When in editor mode (main factory interface)
 */

/**
 * Calculates the initial size of a component based on "Smart Rules" relative to canvas size.
 */
const calculateInitialSize = (
  component: { id: string; type?: string; defaultSize?: { width: number; height: number }; category?: string },
  canvasWidth: number,
  canvasHeight: number
) => {
  const normalizeId = (id: string) => id.toLowerCase();
  const id = normalizeId(component.id);
  const type = component.type?.toLowerCase();
  const category = component.category?.toLowerCase();

  // 1. Stats Card / Dashboard Block (Specific Fix for User)
  if (id.includes('stats') || id.includes('dashboard_stats')) {
    return { width: 340, height: 180 }; // Increased from 280x160 to prevent truncation
  }

  // 2. Navigation Components
  if (type === 'navigation' || id.includes('nav')) {
    if (id.includes('sidebar')) {
      return { width: 250, height: Math.round(canvasHeight * 0.8) };
    }
    if (id.includes('header')) {
      return { width: canvasWidth, height: 64 };
    }
  }

  // 3. Form & Input Components
  if (type === 'form' || id.includes('form')) {
    return { width: 400, height: 500 };
  }
  if (type === 'input') {
    if (id.includes('textarea') || id.includes('multiline')) {
      return { width: 300, height: 120 };
    }
    return { width: 240, height: 48 }; // Standard input
  }
  if (type === 'select' || id.includes('dropdown')) {
    return { width: 240, height: 48 };
  }
  if (type === 'checkbox' || type === 'radio') {
    return { width: 160, height: 32 };
  }

  // 4. Buttons
  if (type === 'button' || id.includes('btn') || id.includes('button')) {
    return { width: 140, height: 44 };
  }

  // 5. Containers & Layouts
  if (type === 'container' || category === 'layouts') {
    if (id.includes('fluid')) {
      return { width: Math.round(canvasWidth * 0.9), height: Math.round(canvasHeight * 0.9) };
    }
    if (id.includes('split')) {
      return { width: Math.round(canvasWidth * 0.8), height: Math.round(canvasHeight * 0.6) };
    }
    return { width: Math.round(canvasWidth * 0.5), height: Math.round(canvasHeight * 0.5) };
  }

  // 6. Cards & Panels
  if (type === 'card' || id.includes('card')) {
    if (id.includes('media')) {
      return { width: 320, height: 360 }; // Taller for media
    }
    return { width: 320, height: 220 }; // Generous default card
  }
  if (type === 'panel' || type === 'modal') {
    return { width: 400, height: 300 };
  }
  if (type === 'list') {
    return { width: 300, height: 400 };
  }

  // 7. Specific Library Components (MUI, etc)
  if (id.includes('mui/monorepo') || id === 'github-repo') {
    return { width: 340, height: 120 };
  }

  // 8. Fallback
  return {
    width: component.defaultSize?.width || 200, // Generous fallback
    height: component.defaultSize?.height || 100
  };
};

export const App: React.FC = () => {
  // Application mode state (launcher vs editor)
  const [appMode, setAppMode] = useState<AppMode>('launcher');
  const [saveNotice, setSaveNotice] = useState<string | null>(null);
  const saveNoticeTimerRef = useRef<number | null>(null);

  const showSaveNotice = useCallback((filePath: string) => {
    const fileName = filePath.replace(/\\/g, "/").split("/").pop() || filePath;
    setSaveNotice(fileName);
    if (saveNoticeTimerRef.current) {
      clearTimeout(saveNoticeTimerRef.current);
    }
    saveNoticeTimerRef.current = window.setTimeout(() => {
      setSaveNotice(null);
      saveNoticeTimerRef.current = null;
    }, 3000);
  }, []);

  useEffect(() => {
    return () => {
      if (saveNoticeTimerRef.current) {
        clearTimeout(saveNoticeTimerRef.current);
      }
    };
  }, []);

  // Theme Sync Logic
  const { theme, setTheme } = useTheme();
  const setProjectTheme = useProjectStore((state) => state.setTheme);

  // Sync visual theme changes to project store for persistence
  useEffect(() => {
    setProjectTheme(theme);
  }, [theme, setProjectTheme]);


  // Project store actions
  const saveProject = useProjectStore((state) => state.saveProject);
  const saveProjectAs = useProjectStore((state) => state.saveProjectAs);
  const setMetadata = useProjectStore((state) => state.setMetadata);

  const handleSaveProject = useCallback(async () => {
    const savedPath = await saveProject();
    if (savedPath) {
      showSaveNotice(savedPath);
    }
  }, [saveProject, showSaveNotice]);

  const handleSaveProjectAs = useCallback(async () => {
    const savedPath = await saveProjectAs();
    if (savedPath) {
      showSaveNotice(savedPath);
    }
  }, [saveProjectAs, showSaveNotice]);

  // Sidebar tab state (UJ-1.1.2): includes templates tab for EUR-1.1.10, AI chat tab
  const [activeSidebarTab, setActiveSidebarTab] = useState<'project' | 'components' | 'containers' | 'modals' | 'templates' | 'plugins' | 'aichat'>('project');

  // Loaded template name (EUR-1.1.10) - displayed in canvas toolbar
  const [loadedTemplateName, setLoadedTemplateName] = useState<string | null>(null);

  // Register external components on mount (EUR-1.1.3b)
  React.useEffect(() => {
    registerComponent('@mui/monorepo', GitHubRepoPreview);
    registerComponent('mui-button', MuiButtonAdapter);
    registerComponent('dashboard-stat', DashboardStatsBlock);

    // Add sample imported components to the list so they are available immediately for demo
    const demoComponents: ComponentInfo[] = [
      {
        id: '@mui/monorepo',
        name: 'MUI Monorepo',
        category: 'molecules',
        type: '@mui/monorepo' as any,
        description: 'Imported from GitHub',
        builtIn: false,
        version: 'v7.3.6',
        tags: ['github', 'imported']
      },
      {
        id: 'mui-button',
        name: 'Material Button',
        category: 'atoms',
        type: 'mui-button' as any,
        description: 'Standard MUI Button',
        builtIn: false,
        version: '5.15.0',
        tags: ['mui', 'atom']
      },
      {
        id: 'dashboard-stat',
        name: 'Stats Card',
        category: 'molecules',
        type: 'dashboard-stat' as any,
        description: 'ReactComponents.com Block 1056',
        builtIn: false,
        version: '1.0.0',
        tags: ['dashboard', 'card']
      }
    ];

    // Append to sampleComponents if not exists
    demoComponents.forEach(comp => {
      if (!sampleComponents.some(c => c.id === comp.id)) {
        sampleComponents.push(comp);
      }
    });

    // Force refresh of gallery... this might benefit from state if I were using state for components
    // But sampleComponents is a static imported array. This hack relies on re-render.
  }, []);

  // Project store actions
  const loadProjectFromFile = useProjectStore((state) => state.loadProjectFromFile);
  const projectName = useProjectStore((state) => state.metadata.name);
  const projectFilePath = useProjectStore((state) => state.metadata.filePath);
  const projectFileName = projectFilePath ? projectFilePath.replace(/\\/g, "/").split("/").pop() : undefined;
  const projectDescription = useProjectStore((state) => state.metadata.description);
  // Subscribe to project theme for canvas (isolated from App Factory theme)
  const projectTheme = useProjectStore((state) => state.theme);

  // Dynamic project loading from outputs/projects folder
  const [projects, setProjects] = useState<ProjectInfo[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();
  const [isLoadingProjects, setIsLoadingProjects] = useState(true);

  // Load projects from outputs/projects folder on mount
  useEffect(() => {
    const loadProjects = async () => {
      setIsLoadingProjects(true);
      try {
        const { isTauri } = await import('./utils/tauriUtils');
        if (!isTauri()) {
          console.warn('Project loading requires Tauri environment');
          setIsLoadingProjects(false);
          return;
        }

        const { readDir, readTextFile } = await import('@tauri-apps/api/fs');

        // Absolute path to projects directory
        const projectsDir = 'C:\\Users\\anujd\\Documents\\01_AI\\173_piovisstudio\\app_factory\\outputs\\projects';
        console.log('Loading projects from:', projectsDir);

        try {
          const entries = await readDir(projectsDir);
          const projectFiles = entries.filter(e => e.name?.endsWith('.json'));

          // Load ALL project files (no grouping - show every file)
          const loadedProjects: ProjectInfo[] = [];

          for (const file of projectFiles) {
            if (!file.path) continue;

            try {
              const content = await readTextFile(file.path);
              const projectData = JSON.parse(content) as ProjectFile;

              loadedProjects.push({
                id: file.path,
                name: projectData.metadata?.name || file.name?.replace('.json', '') || 'Unknown',
                path: file.path,
                description: projectData.metadata?.description || '',
                version: projectData.metadata?.version || '1.0.0',
                createdAt: new Date(projectData.metadata?.createdAt || Date.now()),
                updatedAt: new Date(projectData.metadata?.modifiedAt || Date.now()),
                plugins: [],
                screens: Object.values(projectData.screens || {}).map(s => ({
                  id: s.id,
                  name: s.name,
                  route: s.route,
                  componentCount: Object.keys(projectData.components || {}).length,
                })),
                status: 'ready',
              });
            } catch {
              // Skip files that can't be parsed
            }
          }

          // Sort by updatedAt (most recent first)
          loadedProjects.sort((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime());
          setProjects(loadedProjects);
        } catch (err) {
          console.warn('Could not read projects directory:', err);
        }
      } catch (err) {
        console.error('Failed to load projects:', err);
      } finally {
        setIsLoadingProjects(false);
      }
    };

    loadProjects();
  }, []);

  // Plugin state
  const [plugins, setPlugins] = useState<PluginInfo[]>(samplePlugins);
  const [selectedPluginId, setSelectedPluginId] = useState<string | undefined>();

  // Derive plugin slots for BackendBlueprintPanel from plugins state
  const pluginSlots: PluginSlot[] = React.useMemo(() => {
    return plugins.map(p => ({
      id: p.id,
      contract: p.contract.toUpperCase(),
      name: p.name,
      ...(p.status === 'loaded' ? { pluginName: p.name } : {}),
      status: p.status === 'loaded' ? 'healthy' as const :
        p.status === 'loading' ? 'degraded' as const :
          p.status === 'error' ? 'unhealthy' as const : 'empty' as const,
    }));
  }, [plugins]);

  // Manual plugin slots (user-added via + button in Blueprint)
  const [manualPluginSlots, setManualPluginSlots] = useState<PluginSlot[]>([]);

  // Plugin filter for sidebar (when user clicks a slot in Blueprint)
  const [pluginCategoryFilter, setPluginCategoryFilter] = useState<string | null>(null);

  // Selected plugin for configuration panel (when user clicks a slot or selects a plugin)
  const [selectedPluginForConfig, setSelectedPluginForConfig] = useState<PluginInfoWithConfig | null>(null);


  // Component Gallery state (UJ-1.1.2)
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);

  // Component Generator state (UJ-1.1.3)
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const { state: generatorState, generate: generateComponent } = useComponentGenerator();
  const addComponentToLibrary = useComponentLibraryStore((state) => state.addComponent);
  // Subscribe to components array to trigger re-renders when AI updates library
  const libraryComponents = useComponentLibraryStore((state) => state.components);

  // Window Config State (for linking canvas size)
  const windowConfig = useWindowConfigStore((state) => state.config);


  // Canvas state
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>(initialCanvasElements);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  // Undo history state - stores snapshots of canvasElements before each mutation
  const [canvasHistory, setCanvasHistory] = useState<CanvasElement[][]>([]);

  // Theme panel and Preview state (UJ-1.1.1)
  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false);
  const [isWindowConfigOpen, setIsWindowConfigOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Backend Blueprint state (EUR-1.2.10)
  const [showBackendBlueprint, setShowBackendBlueprint] = useState(false);

  // AI Team Visualization state
  const [isAiTeamOpen, setIsAiTeamOpen] = useState(false);


  // Settings panel state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Import wizard state (EUR-1.1.3b)
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Toggle handlers for Theme and Preview panels
  const handleToggleThemePanel = useCallback(() => {
    setIsThemePanelOpen((prev) => !prev);
    // Close window config if opening theme
    setIsWindowConfigOpen(false);
  }, []);

  const handleToggleWindowConfig = useCallback(() => {
    setIsWindowConfigOpen((prev) => !prev);
    // Close theme panel if opening window config
    setIsThemePanelOpen(false);
  }, []);

  const handleTogglePreview = useCallback(() => {
    setShowPreview((prev) => !prev);
  }, []);

  const handleToggleBackendBlueprint = useCallback(() => {
    setShowBackendBlueprint((prev) => !prev);
  }, []);

  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen((prev) => !prev);
  }, []);

  const handleAddGeneratedComponent = useCallback((component: GeneratedComponent) => {
    const categoryMap: Record<GeneratedComponent['type'], ComponentCategory> = {
      button: 'buttons',
      input: 'forms',
      card: 'cards',
      form: 'forms',
      list: 'other',
      modal: 'modals',
      navigation: 'navigation',
      layout: 'layout',
      custom: 'other',
    };

    addComponentToLibrary({
      name: component.name,
      code: component.code,
      framework: component.framework,
      description: component.prompt,
      category: categoryMap[component.type],
      tags: [component.type, component.framework],
      prompt: component.prompt,
    });
  }, [addComponentToLibrary]);

  /**
   * Handle applying AI-generated code from Chat to canvas.
   * Parses component name, adds to library, and places on canvas.
   */
  const handleApplyAiCode = useCallback((code: string, language: string) => {
    // Parse component name from code
    const nameMatch = code.match(/(?:const|function)\s+(\w+)/);
    const componentName = nameMatch?.[1] || `AiComponent_${Date.now()}`;

    // Add to component library
    const componentId = `ai-chat-${Date.now()}`;
    addComponentToLibrary({
      name: componentName,
      code: code,
      framework: language === 'tsx' || language === 'jsx' || language === 'javascript' || language === 'react' ? 'react' : 'html',
      description: 'Generated by AI Chat',
      category: 'other',
      tags: ['ai-generated', language],
      prompt: 'AI Chat generated component',
    });

    // Add to canvas
    const newElement: CanvasElement = {
      id: `element-${Date.now()}`,
      type: 'component',
      name: componentName,
      componentId: componentId,
      bounds: {
        x: 100 + (canvasElements.length * 20),
        y: 100 + (canvasElements.length * 20),
        width: 200,
        height: 100,
      },
      zIndex: canvasElements.length + 1,
    };

    setCanvasElements((prev) => [...prev, newElement]);
    setSelectedElementIds([newElement.id]);

    console.log('[App] Applied AI code to canvas:', componentName);
  }, [addComponentToLibrary, canvasElements.length]);

  /**
   * Handle applying structured canvas changes from AI.
   * Updates existing components in-place or adds new ones.
   */
  const handleApplyCanvasChanges = useCallback((changes: Array<{
    elementId?: string;
    action?: 'add' | 'update' | 'delete';
    name?: string;
    code: string;
  }>) => {
    const { updateComponent, addComponent } = useComponentLibraryStore.getState();

    changes.forEach(change => {
      // Validate code is present and is a string
      if (!change.code || typeof change.code !== 'string') {
        console.error('[App] Invalid change code:', change);
        alert(`Failed to apply changes: Invalid code generated for ${change.name || change.elementId}`);
        return;
      }

      if (change.elementId) {
        // Try exact ID match first
        let element = canvasElements.find(el => el.id === change.elementId);

        // Fallback: try matching by element name (case-insensitive partial match)
        if (!element) {
          const searchTerm = change.elementId.toLowerCase().replace(/[^a-z0-9]/g, '');
          element = canvasElements.find(el => {
            const elName = el.name.toLowerCase().replace(/[^a-z0-9]/g, '');
            return elName.includes(searchTerm) || searchTerm.includes(elName);
          });
          if (element) {
            console.log('[App] Found element by name fallback:', element.name, 'for:', change.elementId);
          }
        }

        if (element?.componentId) {
          // Check if component exists in library
          const { getComponentById } = useComponentLibraryStore.getState();
          const existingComponent = getComponentById(element.componentId);

          if (existingComponent) {
            // Update the component code in the library
            updateComponent(element.componentId, { code: change.code });
            console.log('[App] ✅ Updated component:', element.componentId, 'for element:', element.id);
            // Temporary debug alert
            alert(`Updated component for ${element.name}`);
          } else {
            // Component not in library (built-in/template) -> Create new AI component (Fork)
            console.log('[App] Component not in library, creating fork:', element.componentId);

            const newComp = addComponent({
              name: `${element.name} (AI)`,
              code: change.code,
              framework: 'react',
              description: `AI modification of ${element.name}`,
              category: 'other',
              tags: ['ai-generated', 'fork'],
              prompt: 'AI Chat modification'
            });

            // Update element to point to new component
            setCanvasElements(prev => prev.map(el =>
              el.id === change.elementId ? { ...el, componentId: newComp.id } : el
            ));

            alert(`Converted ${element.name} to custom AI component and applied changes.`);
          }
        } else {
          console.warn('[App] ❌ Element not found:', change.elementId);
          console.log('[App] Available elements:', canvasElements.map(el => ({ id: el.id, name: el.name })));

          // Alert user if element not found
          alert(`Could not find element to update:\nID: ${change.elementId}\n\nTry selecting the component first, or checking the name.`);
        }
      } else if (change.action === 'add' && change.code) {
        // Add new component
        const newComp = addComponent({
          name: change.name || `AiComponent_${Date.now()}`,
          code: change.code,
          framework: 'react',
          description: 'Generated by AI Chat',
          category: 'other',
          tags: ['ai-generated'],
        });

        // Add to canvas
        const newElement: CanvasElement = {
          id: `element-${Date.now()}`,
          type: 'component',
          name: newComp.name,
          componentId: newComp.id,
          bounds: {
            x: 100 + (canvasElements.length * 20),
            y: 100 + (canvasElements.length * 20),
            width: 200,
            height: 100,
          },
          zIndex: canvasElements.length + 1,
        };

        setCanvasElements((prev) => [...prev, newElement]);
        setSelectedElementIds([newElement.id]);
        console.log('[App] Added new AI component to canvas:', newComp.name);
      }
    });
  }, [canvasElements]);

  // Project loading handlers
  const handleSelectProject = useCallback((project: ProjectInfo) => {
    setSelectedProjectId(project.id);
  }, []);

  const handleOpenProject = useCallback(async (project: ProjectInfo) => {
    // Read actual project file from disk in Tauri mode
    if (isTauri()) {
      try {
        const { readTextFile } = await import('@tauri-apps/api/fs');
        const content = await readTextFile(project.path);
        const projectFile = JSON.parse(content) as ProjectFile;

        // Load into project store
        loadProjectFromFile(project.path, projectFile);

        // Sync theme from loaded project to visual ThemeProvider
        if (projectFile.theme) {
          setTheme(projectFile.theme);
        }

        // Sync windowConfig from loaded project to WindowConfigStore
        if (projectFile.windowConfig) {
          useWindowConfigStore.getState().setConfig(projectFile.windowConfig);
        }

        // Sync canvas elements to local state
        if (projectFile.canvasElements) {
          setCanvasElements(projectFile.canvasElements as unknown as CanvasElement[]);
        }

        setAppMode('editor');
      } catch (error) {
        console.error('Failed to load project:', error);
        // Fallback: still open editor with default state
        setAppMode('editor');
      }
    } else {
      // Browser mode: use sample data (for demo purposes)
      const projectFile: ProjectFile = {
        version: 2,
        metadata: {
          name: project.name,
          description: project.description || '',
          author: 'User',
          version: project.version,
          createdAt: project.createdAt.getTime(),
          modifiedAt: project.updatedAt.getTime(),
          filePath: project.path,
          tags: [],
        },
        screens: {},
        components: {},
        theme: theme, // Use current theme instead of hardcoded
        buildConfig: {
          outputDir: './dist',
          platform: 'windows',
          mode: 'development',
          includePythonRuntime: true,
          bundledPlugins: [],
          appIcon: null,
          version: project.version,
          publisher: '',
          identifier: 'com.appfactory.app',
        },
      };

      loadProjectFromFile(project.path, projectFile);
      setAppMode('editor');
    }
  }, [loadProjectFromFile, setTheme, theme, setCanvasElements]);

  const handleNewProject = useCallback(() => {
    // In real app, would show new project wizard
    setAppMode('editor');
  }, []);

  const handleBrowseProject = useCallback(async () => {
    // Use store's browseAndLoadProject which handles file picker and loading
    const browseAndLoadProject = useProjectStore.getState().browseAndLoadProject;
    const success = await browseAndLoadProject();

    if (success) {
      // Get the loaded project state from store
      const state = useProjectStore.getState();

      // Sync theme from loaded project to visual ThemeProvider
      if (state.theme) {
        setTheme(state.theme);
      }

      // Sync windowConfig from loaded project to WindowConfigStore
      if (state.windowConfig) {
        useWindowConfigStore.getState().setConfig(state.windowConfig);
      }

      // Sync canvas elements to local state
      if (state.canvasElements && state.canvasElements.length > 0) {
        setCanvasElements(state.canvasElements as unknown as CanvasElement[]);
      }

      setAppMode('editor');
    }
  }, [setTheme, setCanvasElements]);

  const handleBackToLauncher = useCallback(() => {
    setAppMode('launcher');
  }, []);

  // Plugin handlers
  const handlePluginSelect = useCallback((plugin: PluginInfo) => {
    setSelectedPluginId(plugin.id);
    // Also set it as the selected plugin for configuration
    const pluginWithConfig = (plugins as PluginInfoWithConfig[]).find(p => p.id === plugin.id);
    if (pluginWithConfig) {
      setSelectedPluginForConfig(pluginWithConfig);
      setSelectedElementIds([]); // Clear canvas selection
    }
  }, [plugins]);

  // Component Gallery handlers (UJ-1.1.2)
  const handleComponentSelectionChange = useCallback((component: ComponentInfo, selected: boolean) => {
    setSelectedComponentIds((prev) => {
      if (selected) {
        // Add to selection if not already present
        return prev.includes(component.id) ? prev : [...prev, component.id];
      } else {
        // Remove from selection
        return prev.filter((id) => id !== component.id);
      }
    });
  }, []);

  // Handle adding component to canvas from gallery
  const handleAddComponent = useCallback((component: ComponentInfo) => {
    const newElement: CanvasElement = {
      id: `element-${Date.now()}`,
      type: 'component',
      name: component.name,
      componentId: component.id,
      bounds: {
        x: 100 + (canvasElements.length * 20), // Offset each new element
        y: 100 + (canvasElements.length * 20),
        ...calculateInitialSize(component, windowConfig.width, windowConfig.height),
      },
      zIndex: canvasElements.length + 1,
    };
    setCanvasElements((prev) => [...prev, newElement]);
    setSelectedElementIds([newElement.id]);
  }, [canvasElements.length]);

  // Handle importing component from external URL (EUR-1.1.3b)
  const handleImportComponent = useCallback(async (manifest: ComponentManifest, _sourceUrl: string) => {
    // Add imported component to the sample components list
    const newComponent: ComponentInfo = {
      id: manifest.name,
      name: manifest.displayName,
      category: manifest.type === 'component' ? 'molecules' : 'organisms',
      type: manifest.name as any, // Use unique name as type key for registry lookup
      description: manifest.description,
      builtIn: false,
      tags: manifest.tags || [],
      version: manifest.version,
    };
    // Note: In a real app, this would persist to a store
    sampleComponents.push(newComponent);
    console.log('Imported component:', newComponent);
  }, []);

  const handlePluginLoad = useCallback((plugin: PluginInfo) => {
    setPlugins((prev) =>
      prev.map((p) =>
        p.id === plugin.id ? { ...p, status: 'loading' as const } : p
      )
    );
    // Simulate loading delay
    setTimeout(() => {
      setPlugins((prev) =>
        prev.map((p) =>
          p.id === plugin.id ? { ...p, status: 'loaded' as const } : p
        )
      );
    }, 1000);
  }, []);

  const handlePluginUnload = useCallback((plugin: PluginInfo) => {
    setPlugins((prev) =>
      prev.map((p) =>
        p.id === plugin.id ? { ...p, status: 'unloaded' as const } : p
      )
    );
  }, []);

  // Blueprint slot handlers
  const handleBlueprintSlotClick = useCallback((slot: PluginSlot) => {
    // Find a plugin that matches this slot's contract
    const matchingPlugin = (plugins as PluginInfoWithConfig[]).find(
      p => p.contract.toUpperCase() === slot.contract.toUpperCase()
    );
    if (matchingPlugin) {
      setSelectedPluginForConfig(matchingPlugin);
      setSelectedElementIds([]); // Clear canvas selection when showing plugin config
    }
    // Switch to plugins tab and filter by this slot's category
    setActiveSidebarTab('plugins');
    setPluginCategoryFilter(slot.contract.toUpperCase());
  }, [plugins]);

  const handleAddManualSlot = useCallback((contract: string) => {
    const newSlot: PluginSlot = {
      id: `slot-${Date.now()}`,
      contract: contract.toUpperCase(),
      name: `${contract} Slot`,
      status: 'empty',
    };
    setManualPluginSlots((prev) => [...prev, newSlot]);
  }, []);

  const handleRemoveManualSlot = useCallback((slotId: string) => {
    setManualPluginSlots((prev) => prev.filter((s) => s.id !== slotId));
  }, []);

  const handleClearPluginFilter = useCallback(() => {
    setPluginCategoryFilter(null);
  }, []);

  // Canvas handlers

  // Helper to push current state to undo history before mutation
  const pushToHistory = useCallback(() => {
    setCanvasHistory((prev) => [...prev, canvasElements]);
  }, [canvasElements]);

  // Undo handler - pops last state from history and restores it
  const handleUndo = useCallback(() => {
    if (canvasHistory.length === 0) return;
    const previousState = canvasHistory[canvasHistory.length - 1]!;
    setCanvasHistory((prev) => prev.slice(0, -1));
    setCanvasElements(previousState);
    setSelectedElementIds([]);
  }, [canvasHistory]);

  // Clear canvas handler - clears all elements (with undo support)
  const handleClearCanvas = useCallback(() => {
    if (canvasElements.length === 0) return;
    pushToHistory();
    setCanvasElements([]);
    setSelectedElementIds([]);
  }, [canvasElements.length, pushToHistory]);

  const handleElementSelect = useCallback((ids: string[]) => {
    setSelectedElementIds(ids);
    // Clear plugin config selection when canvas element is selected
    if (ids.length > 0) {
      setSelectedPluginForConfig(null);
    }
  }, []);

  const handleElementMove = useCallback((id: string, bounds: ElementBounds) => {
    setCanvasElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, bounds } : el))
    );
  }, []);

  const handleElementDelete = useCallback((ids: string[]) => {
    pushToHistory();
    setCanvasElements((prev) => prev.filter((el) => !ids.includes(el.id)));
    setSelectedElementIds([]);
  }, [pushToHistory]);

  // Handle property changes from PropertyInspector
  const handlePropertyChange = useCallback((key: string, value: unknown) => {
    if (selectedElementIds.length !== 1) return;
    const elementId = selectedElementIds[0];

    setCanvasElements((prev) =>
      prev.map((el) => {
        if (el.id !== elementId) return el;

        // Update bounds properties
        if (['x', 'y', 'width', 'height'].includes(key)) {
          return {
            ...el,
            bounds: {
              ...el.bounds,
              [key]: Number(value),
            },
          };
        }

        // Update component props (for text, variant, etc.)
        return {
          ...el,
          props: {
            ...el.props,
            [key]: value,
          },
        };
      })
    );
  }, [selectedElementIds]);

  // Handle element drop from ComponentGallery (Phase 5: Drag-and-Drop)
  const handleElementDrop = useCallback((
    element: Partial<CanvasElement>,
    position: { x: number; y: number }
  ) => {
    // Extract component info from dropped data (comes from ComponentGallery)
    const droppedComponent = element as unknown as { id?: string; name?: string };
    const newElement: CanvasElement = {
      id: `element-${Date.now()}`,
      type: 'component',
      name: droppedComponent.name || 'New Component',
      ...(droppedComponent.id ? { componentId: droppedComponent.id } : {}),
      bounds: {
        x: position.x,
        y: position.y,
        ...calculateInitialSize(droppedComponent as any, windowConfig.width, windowConfig.height),
      },
      zIndex: canvasElements.length + 1,
    };
    setCanvasElements((prev) => [...prev, newElement]);
    setSelectedElementIds([newElement.id]);
  }, [canvasElements.length]);

  // Get component code by ID for live canvas preview
  // Checks both componentLibraryStore (AI-generated) and sampleComponents (built-in)
  const getComponentCode = useCallback((componentId: string): { code: string; framework: ComponentFramework } | null => {
    // First check componentLibraryStore for AI-generated components
    const libraryComponent = useComponentLibraryStore.getState().getComponentById(componentId);
    if (libraryComponent) {
      return { code: libraryComponent.code, framework: libraryComponent.framework };
    }

    // Then check sampleComponents for built-in components
    // Return undefined so CanvasEditor falls back to TemplateComponentRenderer using componentId
    const sampleComponent = sampleComponents.find(c => c.id === componentId);
    if (sampleComponent) {
      return null;
    }

    return null;
  }, [libraryComponents]); // Re-create when components change to pick up AI updates

  // Get selected element for property inspector
  const selectedElement = canvasElements.find((el) => selectedElementIds.includes(el.id));

  // Render launcher mode (project selection screen)
  if (appMode === 'launcher') {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-8">
          <div className="w-full max-w-4xl">
            <div className="text-center mb-8">
              <div className="inline-flex items-center justify-center h-16 w-16 rounded-2xl bg-primary-500 mb-4">
                <svg className="h-10 w-10 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  <line x1="3" y1="9" x2="21" y2="9" />
                  <line x1="9" y1="21" x2="9" y2="9" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-neutral-900">App Factory</h1>
              <p className="text-neutral-600 mt-2">Create plugin-powered desktop applications</p>
            </div>
            <ProjectLoader
              projects={projects}
              {...(selectedProjectId ? { selectedProjectId } : {})}
              onSelectProject={handleSelectProject}
              onOpenProject={handleOpenProject}
              onNewProject={handleNewProject}
              onBrowseProject={handleBrowseProject}
              onToggleSettings={handleToggleSettings}
              isLoading={isLoadingProjects}
              className="h-[500px]"
            />
          </div>
        </div>
      </ThemeProvider>
    );
  }

  // Render editor mode (factory interface)
  return (
    <ThemeProvider>
      <div className="min-h-screen bg-bg-primary text-text-primary">
        <FactoryLayout
          key={`layout-${showBackendBlueprint ? 'with-blueprint' : 'no-blueprint'}`}
          header={
            <AppHeader
              projectName={projectName}
              {...(projectFileName ? { projectFileName } : {})}
              onBackToLauncher={handleBackToLauncher}
              isThemePanelOpen={isThemePanelOpen}
              onToggleThemePanel={handleToggleThemePanel}
              isWindowConfigOpen={isWindowConfigOpen}
              onToggleWindowConfig={handleToggleWindowConfig}
              showPreview={showPreview}
              onTogglePreview={handleTogglePreview}
              showBackendBlueprint={showBackendBlueprint}
              onToggleBackendBlueprint={handleToggleBackendBlueprint}
              onToggleSettings={handleToggleSettings}

              onSaveProject={handleSaveProject}
              onSaveProjectAs={handleSaveProjectAs}
            />
          }
          leftSidebar={
            <div className="h-full flex flex-col">
              {/* Tab Switcher */}
              <div className="p-2 border-b border-neutral-200">
                <div className="flex flex-wrap gap-1 rounded-lg bg-neutral-100 p-1">
                  {[
                    { id: 'project', label: 'Proj', icon: FolderIcon },
                    { id: 'components', label: 'Comp', icon: ComponentIcon },
                    { id: 'containers', label: 'Cont', icon: LayoutIcon },
                    { id: 'modals', label: 'Mod', icon: WindowIcon },
                    { id: 'templates', label: 'Tmpl', icon: TemplateIcon },
                    { id: 'plugins', label: 'Plug', icon: PluginIcon },
                    { id: 'aichat', label: 'AI', icon: AiAppChatIcon },
                    { id: 'aiteam', label: 'Team', icon: RunningIcon },
                  ].map((tab) => {
                    const Icon = tab.icon;
                    const isActive = activeSidebarTab === tab.id;
                    const isAiTeam = tab.id === 'aiteam';

                    return (
                      <button
                        key={tab.id}
                        type="button"
                        onClick={() => {
                          if (isAiTeam) {
                            setIsAiTeamOpen(true);
                          } else {
                            setActiveSidebarTab(tab.id as any);
                          }
                        }}
                        className={[
                          "flex-1 min-w-[3rem] px-2 py-1.5 flex flex-col items-center justify-center gap-1 text-[10px] font-medium rounded-md transition-colors",
                          isActive
                            ? "bg-white text-neutral-900 shadow-sm"
                            : "text-neutral-500 hover:text-neutral-700 hover:bg-neutral-200/50",
                        ].join(" ")}
                        title={isAiTeam ? "AI Team Visualization" : tab.label}
                      >
                        <Icon className="h-5 w-5" />
                        <span>{tab.label}</span>
                      </button>
                    );

                  })}
                </div>
              </div>

              {/* Gallery Content */}
              <div className="flex-1 overflow-auto p-3">
                {activeSidebarTab === 'plugins' ? (
                  <div className="space-y-3">
                    {/* Category Filter Banner */}
                    {pluginCategoryFilter && (
                      <div className="flex items-center justify-between px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <span className="text-xs text-amber-800">
                          Showing: <span className="font-semibold">{pluginCategoryFilter}</span> plugins
                        </span>
                        <button
                          type="button"
                          onClick={handleClearPluginFilter}
                          className="text-xs text-amber-600 hover:text-amber-800 underline"
                        >
                          Show all
                        </button>
                      </div>
                    )}
                    <PluginGallery
                      plugins={pluginCategoryFilter
                        ? plugins.filter(p => p.contract.toUpperCase() === pluginCategoryFilter)
                        : plugins
                      }
                      {...(selectedPluginId ? { selectedId: selectedPluginId } : {})}
                      onSelect={handlePluginSelect}
                      onLoad={handlePluginLoad}
                      onUnload={handlePluginUnload}
                      gridColumns={2}
                      showViewToggle={false}
                    />
                  </div>
                ) : activeSidebarTab === 'containers' ? (
                  <div className="space-y-3">
                    <ComponentGallery
                      key="containers"
                      components={sampleComponents.filter(c =>
                        ['containers', 'layouts'].includes(c.category)
                      )}
                      selectedIds={selectedComponentIds}
                      onSelectionChange={handleComponentSelectionChange}
                      onAdd={handleAddComponent}
                      gridColumns={2}
                      showViewToggle={false}
                      showFilters={false}
                      draggable
                    />
                  </div>
                ) : activeSidebarTab === 'modals' ? (
                  <div className="space-y-3">
                    <ComponentGallery
                      key="modals"
                      components={sampleComponents.filter(c => c.type === 'modal')}
                      selectedIds={selectedComponentIds}
                      onSelectionChange={handleComponentSelectionChange}
                      onAdd={handleAddComponent}
                      gridColumns={2}
                      showViewToggle={false}
                      showFilters={false}
                      draggable
                    />
                  </div>
                ) : activeSidebarTab === 'components' ? (
                  <div className="space-y-3">
                    {/* New Component Button (UJ-1.1.3) */}
                    <button
                      type="button"
                      onClick={() => setShowGeneratorModal(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <line x1="12" y1="5" x2="12" y2="19" />
                        <line x1="5" y1="12" x2="19" y2="12" />
                      </svg>
                      New Component
                    </button>
                    {/* Import Component Button (EUR-1.1.3b) */}
                    <button
                      type="button"
                      onClick={() => setShowImportWizard(true)}
                      className="w-full flex items-center justify-center gap-2 px-3 py-2 bg-neutral-100 text-neutral-700 text-sm font-medium rounded-lg hover:bg-neutral-200 transition-colors border border-neutral-200"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      Import Component
                    </button>
                    <ComponentGallery
                      key="components-filtered"
                      components={sampleComponents.filter(c =>
                        ['atoms', 'molecules', 'organisms'].includes(c.category) && c.type !== 'modal'
                      )}
                      selectedIds={selectedComponentIds}
                      onSelectionChange={handleComponentSelectionChange}
                      onAdd={handleAddComponent}
                      gridColumns={2}
                      showViewToggle={false}
                      showFilters={false}
                      draggable
                    />
                  </div>
                ) : activeSidebarTab === 'templates' ? (
                  // Templates tab content (EUR-1.1.10)
                  <TemplateBrowser
                    onLoadTemplate={(elements, windowSize, templateInfo) => {
                      // Replace canvas with template elements
                      setCanvasElements(elements);
                      setSelectedElementIds([]);
                      // Set the loaded template name for display
                      setLoadedTemplateName(templateInfo?.name || null);
                      // Optionally update window config if template specifies size
                      if (windowSize) {
                        useWindowConfigStore.getState().setConfig({
                          width: windowSize.width,
                          height: windowSize.height,
                        });
                      }
                    }}
                    onSaveAsTemplate={() => {
                      // The TemplateBrowser handles its own save modal
                    }}
                  />
                ) : activeSidebarTab === 'aichat' ? (
                  // AI App Chat panel - full panel takeover
                  <AiAppChatPanel
                    className="h-full -m-3"
                    onApplyCode={handleApplyAiCode}
                    canvasElements={canvasElements}
                    getComponentCode={getComponentCode}
                    onApplyCanvasChanges={handleApplyCanvasChanges}
                  />
                ) : (
                  // Default or 'project' tab content - shows loaded project details
                  <div className="p-3 space-y-4">
                    <div className="space-y-2">
                      {/* Editable App Name */}
                      <input
                        type="text"
                        value={projectName || ''}
                        onChange={(e) => setMetadata({ name: e.target.value })}
                        onBlur={() => saveProject()}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.currentTarget.blur();
                          }
                        }}
                        className="w-full font-semibold text-neutral-900 text-sm bg-transparent border-b border-transparent hover:border-neutral-300 focus:border-primary-500 focus:outline-none transition-colors px-0 py-1"
                        placeholder="Untitled Project"
                      />
                      {/* Editable Description */}
                      <textarea
                        value={projectDescription || ''}
                        onChange={(e) => setMetadata({ description: e.target.value })}
                        onBlur={() => saveProject()}
                        className="w-full text-xs text-neutral-500 bg-transparent border border-transparent hover:border-neutral-300 focus:border-primary-500 focus:outline-none resize-none transition-colors rounded px-1 py-1"
                        placeholder="Add a description..."
                        rows={2}
                      />
                    </div>

                    {/* Project Stats */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="bg-neutral-50 rounded-md p-2">
                        <div className="text-lg font-semibold text-primary-600">{canvasElements.length}</div>
                        <div className="text-xs text-neutral-500">Elements</div>
                      </div>
                      <div className="bg-neutral-50 rounded-md p-2">
                        <div className="text-lg font-semibold text-primary-600">{Object.keys(useProjectStore.getState().screens).length}</div>
                        <div className="text-xs text-neutral-500">Screens</div>
                      </div>
                    </div>

                    {/* Canvas/Window Size */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-neutral-700 uppercase tracking-wide">Canvas Size</h4>
                      <div className="flex items-center gap-2 text-sm text-neutral-600 bg-neutral-50 rounded-md p-2">
                        <span>{windowConfig.width} x {windowConfig.height}px</span>
                      </div>
                    </div>

                    {/* Theme Info */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-neutral-700 uppercase tracking-wide">Project Theme</h4>
                      <div className="flex items-center gap-2 text-sm text-neutral-600 bg-neutral-50 rounded-md p-2">
                        <div
                          className="w-4 h-4 rounded-full border border-neutral-200"
                          style={{ backgroundColor: projectTheme?.colors?.primary?.[500] || '#3b82f6' }}
                        />
                        <span>{projectTheme?.name || 'Default'}</span>
                        <span className="text-xs text-neutral-400 ml-auto">{projectTheme?.mode || 'light'}</span>
                      </div>
                    </div>

                    {/* Version & Status */}
                    <div className="space-y-2">
                      <h4 className="text-xs font-medium text-neutral-700 uppercase tracking-wide">Project Info</h4>
                      <div className="space-y-1 text-xs text-neutral-600">
                        <div className="flex justify-between">
                          <span>Version</span>
                          <span className="font-medium">{useProjectStore.getState().metadata.version}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Author</span>
                          <span className="font-medium">{useProjectStore.getState().metadata.author || 'Unknown'}</span>
                        </div>
                      </div>
                    </div>

                    {/* File Path (if saved) */}
                    {useProjectStore.getState().metadata.filePath && (
                      <div className="space-y-1">
                        <h4 className="text-xs font-medium text-neutral-700 uppercase tracking-wide">File Location</h4>
                        <p className="text-xs text-neutral-500 font-mono truncate" title={useProjectStore.getState().metadata.filePath || ''}>
                          {useProjectStore.getState().metadata.filePath}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Selection Summary (UJ-1.1.2) */}
              {activeSidebarTab === 'components' && selectedComponentIds.length > 0 && (
                <div className="p-3 border-t border-neutral-200 bg-primary-50">
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-primary-700 font-medium">
                      {selectedComponentIds.length} component{selectedComponentIds.length !== 1 ? 's' : ''} selected
                    </span>
                    <button
                      type="button"
                      onClick={() => setSelectedComponentIds([])}
                      className="text-xs text-primary-600 hover:text-primary-800 underline"
                    >
                      Clear
                    </button>
                  </div>
                </div>
              )}
            </div>
          }
          mainContent={
            <CanvasEditor
              elements={canvasElements}
              selectedIds={selectedElementIds}
              onSelect={handleElementSelect}
              onMove={handleElementMove}
              onResize={handleElementMove}
              onDelete={handleElementDelete}
              onDrop={handleElementDrop}
              onClear={handleClearCanvas}
              onUndo={handleUndo}
              canUndo={canvasHistory.length > 0}
              // Link canvas size to window config
              canvasWidth={windowConfig.width}
              canvasHeight={windowConfig.height}
              getComponentCode={getComponentCode}
              {...(loadedTemplateName ? { templateName: loadedTemplateName } : {})}
              className="bg-neutral-100" // Add a background to distinguish the canvas area
              initialZoom={0.6}
              gridSettings={{ size: 16, snap: true, visible: true }}
              canvasTheme={projectTheme} // Use project theme (isolated from App Factory theme)
            />
          }
          bottomPanel={
            <BackendBlueprintPanel
              className="h-full"
              compact
              projectName={projectName}
              canvasElements={canvasElements}
              pluginRegistry={pluginSlots}
              manualSlots={manualPluginSlots}
              onSlotClick={handleBlueprintSlotClick}
              onAddSlot={handleAddManualSlot}
              onRemoveSlot={handleRemoveManualSlot}
            />
          }
          rightSidebar={
            <div className="h-full flex flex-col">
              {selectedPluginForConfig ? (
                // Show plugin configuration panel when a plugin is selected
                <PluginConfigPanel
                  plugin={{
                    id: selectedPluginForConfig.id,
                    name: selectedPluginForConfig.name,
                    version: selectedPluginForConfig.version,
                    contract: selectedPluginForConfig.contract,
                    description: selectedPluginForConfig.description,
                    config: selectedPluginForConfig.config || [],
                  }}
                  onChange={(key, value) => {
                    // Update the plugin config in the plugins array
                    setPlugins((prev) =>
                      prev.map((p) =>
                        p.id === selectedPluginForConfig?.id
                          ? {
                            ...p,
                            config: (p as PluginInfoWithConfig).config?.map((opt) =>
                              opt.key === key ? { ...opt, value } : opt
                            ),
                          }
                          : p
                      )
                    );
                  }}
                  onApply={(config) => {
                    console.log('Applied plugin config:', selectedPluginForConfig?.id, config);
                  }}
                  onClose={() => setSelectedPluginForConfig(null)}
                />
              ) : (
                // Show element properties when a canvas element is selected
                <>
                  <div className="p-3 border-b border-neutral-200">
                    <h2 className="text-sm font-semibold text-neutral-700">Properties</h2>
                  </div>
                  <div className="flex-1 overflow-auto">
                    <PropertyInspector
                      {...(selectedElement
                        ? {
                          selectedElement: {
                            id: selectedElement.id,
                            name: selectedElement.name,
                            type: selectedElement.type,
                            ...(selectedElement.componentId
                              ? { componentId: selectedElement.componentId }
                              : {}),
                          },
                        }
                        : {})}
                      properties={
                        selectedElement
                          ? [
                            {
                              key: 'x',
                              label: 'X Position',
                              type: 'number',
                              value: selectedElement.bounds.x,
                              category: 'Position',
                            },
                            {
                              key: 'y',
                              label: 'Y Position',
                              type: 'number',
                              value: selectedElement.bounds.y,
                              category: 'Position',
                            },
                            {
                              key: 'width',
                              label: 'Width',
                              type: 'number',
                              value: selectedElement.bounds.width,
                              min: 1,
                              category: 'Size',
                            },
                            {
                              key: 'height',
                              label: 'Height',
                              type: 'number',
                              value: selectedElement.bounds.height,
                              min: 1,
                              category: 'Size',
                            },
                            // Add component-specific properties if available
                            ...(selectedElement.type === 'component' ? [
                              {
                                key: 'children',
                                label: 'Label/Content',
                                type: 'string' as const,
                                value: selectedElement.props?.children || selectedElement.props?.label || '',
                                category: 'Content'
                              },
                              {
                                key: 'variant',
                                label: 'Variant',
                                type: 'select' as const,
                                value: selectedElement.props?.variant || 'contained',
                                options: [
                                  { label: 'Contained', value: 'contained' },
                                  { label: 'Outlined', value: 'outlined' },
                                  { label: 'Text', value: 'text' }
                                ],
                                category: 'Style'
                              },
                              {
                                key: 'color',
                                label: 'Color',
                                type: 'select' as const,
                                value: selectedElement.props?.color || 'primary',
                                options: [
                                  { label: 'Primary', value: 'primary' },
                                  { label: 'Secondary', value: 'secondary' },
                                  { label: 'Success', value: 'success' },
                                  { label: 'Error', value: 'error' }
                                ],
                                category: 'Style'
                              },
                              // Stats Card Props
                              ...(selectedElement.componentId?.includes('stats') ? [
                                { key: 'title', label: 'Title', type: 'string' as const, value: selectedElement.props?.title || 'Total Revenue', category: 'Content' },
                                { key: 'value', label: 'Value', type: 'string' as const, value: selectedElement.props?.value || '$45,231.89', category: 'Content' },
                                { key: 'trend', label: 'Trend', type: 'string' as const, value: selectedElement.props?.trend || '+20.1%', category: 'Content' },
                                { key: 'progress', label: 'Progress %', type: 'number' as const, value: selectedElement.props?.progress || 70, category: 'Content' }
                              ] : [])
                            ] : [])
                          ]
                          : []
                      }
                      onChange={handlePropertyChange}
                      editable
                    />
                  </div>
                </>
              )}
            </div>
          }

          initialPanels={{
            left: { type: 'plugins', visible: true },
            right: { type: 'properties', visible: true },
            bottom: { type: 'preview', visible: showBackendBlueprint, size: showBackendBlueprint ? 400 : 0 },
          }}
          preset="split"
          resizable
          collapsible
        />
        {saveNotice && (
          <div className="fixed top-16 right-4 z-50 pointer-events-none">
            <div className="flex items-center gap-2 rounded-md border border-success-200 bg-success-50 px-3 py-1.5 text-xs text-success-700 shadow-sm">
              <span className="font-medium">Saved</span>
              <span className="font-mono truncate" title={saveNotice}>
                {saveNotice}
              </span>
            </div>
          </div>
        )}
        {/* Theme Customization Panel Overlay (UJ-1.1.1) */}
        <ThemeCustomizationPanel
          isOpen={isThemePanelOpen}
          onClose={() => setIsThemePanelOpen(false)}
          position="right"
          width="380px"
          onApplyToCanvas={(themeConfig) => {
            // Update project store theme - this will flow to CanvasEditor via projectTheme prop
            useProjectStore.getState().setTheme(themeConfig);
          }}
        />
        {/* Window Config Panel Overlay (UJ-1.1.6) */}
        <WindowConfigPanel
          isOpen={isWindowConfigOpen}
          onClose={() => setIsWindowConfigOpen(false)}
          position="right"
          width="380px"
        />
        {/* Component Generator Full-Screen Modal (UJ-1.1.3) */}
        <Modal
          isOpen={showGeneratorModal}
          onClose={() => setShowGeneratorModal(false)}
          title="AI Component Generator"
          size="full"
        >
          <div className="h-[80vh]">
            <ComponentGenerator
              onGenerate={async (prompt, type, framework) => {
                const result = await generateComponent(prompt, type, framework);
                return result;
              }}
              onSave={(component) => {
                handleAddGeneratedComponent(component);
                setShowGeneratorModal(false);
              }}
              onCopy={(code) => {
                navigator.clipboard.writeText(code);
              }}
              isGenerating={generatorState.isGenerating}
              className="h-full"
            />
          </div>
        </Modal>
        {/* Settings Panel */}
        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
        {/* AI Team Visualization Modal (New) */}
        <Modal
          isOpen={isAiTeamOpen}
          onClose={() => setIsAiTeamOpen(false)}
          title="AI Agent Team"
          size="full"
        >
          <div className="h-[80vh]">
            <AiTeamVisualization />
          </div>
        </Modal>
        {/* Import Wizard (EUR-1.1.3b) */}
        <ImportWizard
          isOpen={showImportWizard}
          onClose={() => setShowImportWizard(false)}
          onImport={handleImportComponent}
        />
      </div>
    </ThemeProvider>
  );
};

export default App;
