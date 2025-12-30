/**
 * B003 - src/App.tsx
 * ==================
 * Root application component with providers and layout.
 *
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 * Dependencies: D018 (ThemeProvider), D049 (FactoryLayout), D040-D048 (Factory components)
 */

import React, { useState, useCallback } from 'react';
import { ThemeProvider } from './context/ThemeProvider';
import { FactoryLayout } from './components/factory/FactoryLayout';
import { PluginGallery, type PluginInfo } from './components/factory/PluginGallery';
import { ComponentGallery, type ComponentInfo } from './components/factory/ComponentGallery';
import { CanvasEditor, type CanvasElement, type ElementBounds } from './components/factory/CanvasEditor';
import { PropertyInspector } from './components/factory/PropertyInspector';
import { ProjectLoader, type ProjectInfo } from './components/project/ProjectLoader';
import { useProjectStore, type ProjectFile } from './stores/projectStore';
import { ThemeCustomizationPanel } from './components/ui/ThemeCustomizationPanel';
import { Modal } from './components/ui/Modal';
// PreviewPanel and CanvasPreview removed - Canvas now has device viewport selector
import { ComponentGenerator } from './components/ai/ComponentGenerator';
import { useComponentGenerator } from './hooks/useComponentGenerator';
import { SettingsPanel } from './components/ui/SettingsPanel';
import { useComponentLibraryStore } from './stores/componentLibraryStore';
import { ImportWizard, type ComponentManifest } from './components/wizard/ImportWizard';
import { registerComponent } from './utils/ComponentRegistry';
import { MuiButtonAdapter, DashboardStatsBlock, GitHubRepoPreview } from './components/external/ExternalWrappers';

/**
 * Application mode type.
 * - launcher: Shows project selection screen
 * - editor: Shows the factory editor interface
 */
type AppMode = 'launcher' | 'editor';

/**
 * Sample plugin data for demonstration.
 */
const samplePlugins: PluginInfo[] = [
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
];

/**
 * Initial canvas elements for demonstration.
 */
const initialCanvasElements: CanvasElement[] = [
  {
    id: 'header',
    type: 'container',
    name: 'Header',
    bounds: { x: 0, y: 0, width: 800, height: 64 },
    zIndex: 1,
  },
  {
    id: 'main-content',
    type: 'container',
    name: 'Main Content',
    bounds: { x: 0, y: 80, width: 800, height: 400 },
    zIndex: 1,
  },
];

/**
 * Header component with app title and toolbar.
 */
interface AppHeaderProps {
  projectName?: string;
  onBackToLauncher?: () => void;
  isThemePanelOpen?: boolean;
  onToggleThemePanel?: () => void;
  showPreview?: boolean;
  onTogglePreview?: () => void;
  onToggleSettings?: () => void;
}

const AppHeader: React.FC<AppHeaderProps> = ({
  projectName,
  onBackToLauncher,
  isThemePanelOpen = false,
  onToggleThemePanel,
  showPreview = false,
  onTogglePreview,
  onToggleSettings,
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
          <span className="text-xs text-neutral-500">{projectName}</span>
        )}
      </div>
    </div>
    <div className="flex items-center gap-2">
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

/**
 * Sample recent projects for demonstration.
 */
const sampleProjects: ProjectInfo[] = [
  {
    id: 'proj-1',
    name: 'Voice Assistant App',
    path: 'C:/Projects/voice-assistant',
    description: 'AI-powered voice assistant with TTS and STT',
    version: '1.2.0',
    createdAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 2 * 60 * 60 * 1000),
    plugins: [
      { id: 'tts_kokoro', name: 'Kokoro TTS', contract: 'tts', version: '1.0.0', enabled: true },
      { id: 'stt_whisper', name: 'Whisper STT', contract: 'stt', version: '1.2.0', enabled: true },
    ],
    screens: [
      { id: 's1', name: 'Main', route: '/', componentCount: 5 },
      { id: 's2', name: 'Settings', route: '/settings', componentCount: 8 },
    ],
    status: 'ready',
  },
  {
    id: 'proj-2',
    name: 'Chat Application',
    path: 'C:/Projects/chat-app',
    description: 'Real-time chat with LLM integration',
    version: '2.0.0',
    createdAt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
    updatedAt: new Date(Date.now() - 24 * 60 * 60 * 1000),
    plugins: [
      { id: 'llm_ollama', name: 'Ollama LLM', contract: 'llm', version: '2.0.0', enabled: true },
    ],
    screens: [
      { id: 's1', name: 'Chat', route: '/', componentCount: 12 },
    ],
    status: 'ready',
  },
];

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
export const App: React.FC = () => {
  // Application mode state (launcher vs editor)
  const [appMode, setAppMode] = useState<AppMode>('launcher');

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

  // Recent projects state (in real app, would come from store)
  const [projects] = useState<ProjectInfo[]>(sampleProjects);
  const [selectedProjectId, setSelectedProjectId] = useState<string | undefined>();

  // Plugin state
  const [plugins, setPlugins] = useState<PluginInfo[]>(samplePlugins);
  const [selectedPluginId, setSelectedPluginId] = useState<string | undefined>();

  // Component Gallery state (UJ-1.1.2)
  const [selectedComponentIds, setSelectedComponentIds] = useState<string[]>([]);

  // Sidebar tab state (UJ-1.1.2): 'plugins' or 'components'
  type SidebarTab = 'plugins' | 'components';
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('plugins');

  // Component Generator state (UJ-1.1.3)
  const [showGeneratorModal, setShowGeneratorModal] = useState(false);
  const { state: generatorState, generate: generateComponent } = useComponentGenerator();


  // Canvas state
  const [canvasElements, setCanvasElements] = useState<CanvasElement[]>(initialCanvasElements);
  const [selectedElementIds, setSelectedElementIds] = useState<string[]>([]);

  // Theme panel and Preview state (UJ-1.1.1)
  const [isThemePanelOpen, setIsThemePanelOpen] = useState(false);
  const [showPreview, setShowPreview] = useState(true);

  // Settings panel state
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);

  // Import wizard state (EUR-1.1.3b)
  const [showImportWizard, setShowImportWizard] = useState(false);

  // Toggle handlers for Theme and Preview panels
  const handleToggleThemePanel = useCallback(() => {
    setIsThemePanelOpen((prev) => !prev);
  }, []);

  const handleTogglePreview = useCallback(() => {
    setShowPreview((prev) => !prev);
  }, []);

  const handleToggleSettings = useCallback(() => {
    setIsSettingsOpen((prev) => !prev);
  }, []);

  // Project loading handlers
  const handleSelectProject = useCallback((project: ProjectInfo) => {
    setSelectedProjectId(project.id);
  }, []);

  const handleOpenProject = useCallback((project: ProjectInfo) => {
    // Load project from file (simulated here, in real app would read from disk)
    const projectFile: ProjectFile = {
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
      theme: {
        name: 'Default',
        primaryColor: '#3b82f6',
        secondaryColor: '#64748b',
        accentColor: '#8b5cf6',
        backgroundColor: '#ffffff',
        textColor: '#0f172a',
        borderRadius: 'md',
        fontFamily: 'system-ui, -apple-system, sans-serif',
        darkMode: false,
        customVariables: {},
      },
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
  }, [loadProjectFromFile]);

  const handleNewProject = useCallback(() => {
    // In real app, would show new project wizard
    setAppMode('editor');
  }, []);

  const handleBrowseProject = useCallback(() => {
    // In real app, would open native file picker via Tauri
    console.log('Browse for project...');
  }, []);

  const handleBackToLauncher = useCallback(() => {
    setAppMode('launcher');
  }, []);

  // Plugin handlers
  const handlePluginSelect = useCallback((plugin: PluginInfo) => {
    setSelectedPluginId(plugin.id);
  }, []);

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
        // Material Design: 48dp minimum touch target
        // Reasonable default: button-like width, single-line height
        width: 120,
        height: 48,
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

  // Canvas handlers
  const handleElementSelect = useCallback((ids: string[]) => {
    setSelectedElementIds(ids);
  }, []);

  const handleElementMove = useCallback((id: string, bounds: ElementBounds) => {
    setCanvasElements((prev) =>
      prev.map((el) => (el.id === id ? { ...el, bounds } : el))
    );
  }, []);

  const handleElementDelete = useCallback((ids: string[]) => {
    setCanvasElements((prev) => prev.filter((el) => !ids.includes(el.id)));
    setSelectedElementIds([]);
  }, []);

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
        return el;
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
      componentId: droppedComponent.id,
      bounds: {
        x: position.x,
        y: position.y,
        width: 200,
        height: 100,
      },
      zIndex: canvasElements.length + 1,
    };
    setCanvasElements((prev) => [...prev, newElement]);
    setSelectedElementIds([newElement.id]);
  }, [canvasElements.length]);

  // Get component code by ID for live canvas preview
  // Checks both componentLibraryStore (AI-generated) and sampleComponents (built-in)
  const getComponentCode = useCallback((componentId: string) => {
    // First check componentLibraryStore for AI-generated components
    const libraryComponent = useComponentLibraryStore.getState().getComponentById(componentId);
    if (libraryComponent) {
      return { code: libraryComponent.code, framework: libraryComponent.framework };
    }

    // Then check sampleComponents for built-in components
    const sampleComponent = sampleComponents.find(c => c.id === componentId);
    if (sampleComponent) {
      // Return componentType for registry-based rendering
      return { componentType: sampleComponent.type };
    }

    return null;
  }, []);

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
              selectedProjectId={selectedProjectId}
              onSelectProject={handleSelectProject}
              onOpenProject={handleOpenProject}
              onNewProject={handleNewProject}
              onBrowseProject={handleBrowseProject}
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
          header={
            <AppHeader
              projectName={projectName}
              onBackToLauncher={handleBackToLauncher}
              isThemePanelOpen={isThemePanelOpen}
              onToggleThemePanel={handleToggleThemePanel}
              showPreview={showPreview}
              onTogglePreview={handleTogglePreview}
              onToggleSettings={handleToggleSettings}
            />
          }
          leftSidebar={
            <div className="h-full flex flex-col">
              {/* Tab Switcher (UJ-1.1.2) */}
              <div className="p-2 border-b border-neutral-200">
                <div className="flex rounded-lg bg-neutral-100 p-1">
                  <button
                    type="button"
                    onClick={() => setSidebarTab('plugins')}
                    className={[
                      "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                      sidebarTab === 'plugins'
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-600 hover:text-neutral-900",
                    ].join(" ")}
                  >
                    Plugins
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarTab('components')}
                    className={[
                      "flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-colors",
                      sidebarTab === 'components'
                        ? "bg-white text-neutral-900 shadow-sm"
                        : "text-neutral-600 hover:text-neutral-900",
                    ].join(" ")}
                  >
                    Components
                  </button>
                </div>
              </div>

              {/* Gallery Content */}
              <div className="flex-1 overflow-auto p-3">
                {sidebarTab === 'plugins' ? (
                  <PluginGallery
                    plugins={plugins}
                    selectedId={selectedPluginId}
                    onSelect={handlePluginSelect}
                    onLoad={handlePluginLoad}
                    onUnload={handlePluginUnload}
                    gridColumns={2}
                    showViewToggle={false}
                  />
                ) : (
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
                      components={sampleComponents}
                      selectedIds={selectedComponentIds}
                      onSelectionChange={handleComponentSelectionChange}
                      onAdd={handleAddComponent}
                      gridColumns={2}
                      showViewToggle={false}
                      showFilters={false}
                      draggable
                    />
                  </div>
                )}
              </div>

              {/* Selection Summary (UJ-1.1.2) */}
              {sidebarTab === 'components' && selectedComponentIds.length > 0 && (
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
              canvasWidth={1280}
              canvasHeight={720}
              initialZoom={0.6}
              gridSettings={{ size: 16, snap: true, visible: true }}
              onSelect={handleElementSelect}
              onMove={handleElementMove}
              onResize={handleElementMove}
              onDelete={handleElementDelete}
              onDrop={handleElementDrop}
              getComponentCode={getComponentCode}
              editable
            />
          }
          rightSidebar={
            <div className="h-full flex flex-col">
              <div className="p-3 border-b border-neutral-200">
                <h2 className="text-sm font-semibold text-neutral-700">Properties</h2>
              </div>
              <div className="flex-1 overflow-auto">
                <PropertyInspector
                  selectedElement={
                    selectedElement
                      ? {
                        id: selectedElement.id,
                        name: selectedElement.name,
                        type: selectedElement.type,
                        componentId: selectedElement.componentId,
                      }
                      : undefined
                  }
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
                      ]
                      : []
                  }
                  onChange={handlePropertyChange}
                  editable
                />
              </div>
            </div>
          }
          initialPanels={{
            left: { type: 'plugins', visible: true },
            right: { type: 'properties', visible: true },
            bottom: { type: 'preview', visible: false, size: 0 },
          }}
          preset="split"
          resizable
          collapsible
        />
        {/* Theme Customization Panel Overlay (UJ-1.1.1) */}
        <ThemeCustomizationPanel
          isOpen={isThemePanelOpen}
          onClose={() => setIsThemePanelOpen(false)}
          position="right"
          width="380px"
        />
        {/* Component Generator Modal (UJ-1.1.3) */}
        <Modal
          isOpen={showGeneratorModal}
          onClose={() => setShowGeneratorModal(false)}
          title="Generate New Component"
          size="lg"
        >
          <ComponentGenerator
            onGenerate={async (prompt, type, framework) => {
              const result = await generateComponent(prompt, type, framework);
              return result;
            }}
            isGenerating={generatorState.isGenerating}
          />
        </Modal>
        {/* Settings Panel */}
        <SettingsPanel
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
        />
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
