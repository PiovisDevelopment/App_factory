/**
 * BackendBlueprintPanel - Dynamic Canvas-Aware Architecture Visualization
 * =======================================================================
 * Shows a visual architecture diagram that reflects the actual canvas content.
 * Analyzes canvas elements to determine required plugins and displays data flow.
 *
 * Features:
 * - Reads actual canvas elements and maps them to required plugins
 * - Visual diagram with User (external), React FE, IPC Bridge, Plugin Sidecar zones
 * - Animated data flow with numbered arrows
 * - Health status indicators for plugin slots
 * - Light theme matching the rest of the application
 */

import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { type CanvasElement } from './CanvasEditor';

// ============================================================================
// TYPES
// ============================================================================

export type HealthStatus = 'healthy' | 'degraded' | 'unhealthy' | 'empty';

export interface PluginSlot {
  id: string;
  contract: string;
  name: string;
  pluginName?: string;
  status: HealthStatus;
}

export interface BackendBlueprintPanelProps {
  className?: string;
  compact?: boolean;
  /** Called when user clicks a slot - use to filter sidebar by category */
  onSlotClick?: (slot: PluginSlot) => void;
  /** Called when user wants to add a new manual slot */
  onAddSlot?: (contract: string) => void;
  /** Called when user removes a manual slot */
  onRemoveSlot?: (slotId: string) => void;
  projectName?: string;
  /** Canvas elements to analyze for required plugins */
  canvasElements?: CanvasElement[];
  /** Plugin registry showing available slots and their status */
  pluginRegistry?: PluginSlot[];
  /** Manually added slots (user-created, not auto-detected) */
  manualSlots?: PluginSlot[];
}

/** Available plugin categories for manual slot creation */
export const PLUGIN_CATEGORIES = ['LLM', 'STT', 'TTS', 'Memory', 'Database', 'Custom'] as const;
export type PluginCategory = typeof PLUGIN_CATEGORIES[number];

// ============================================================================
// COMPONENT-TO-PLUGIN MAPPING
// ============================================================================

/**
 * Maps component types/names to the plugins they require.
 * Used to dynamically determine which plugins are needed based on canvas content.
 */
const componentPluginMapping: Record<string, string[]> = {
  // Chat/messaging components → LLM
  'chat': ['LLM'],
  'message': ['LLM'],
  'conversation': ['LLM'],
  'input_textarea': ['LLM'],
  'chat_input': ['LLM'],
  'prompt': ['LLM'],
  'ai': ['LLM'],
  'assistant': ['LLM'],

  // Voice input components → STT
  'voice': ['STT'],
  'microphone': ['STT'],
  'recorder': ['STT'],
  'speech_input': ['STT'],
  'stt': ['STT'],
  'transcribe': ['STT'],
  'dictation': ['STT'],

  // Audio output components → TTS
  'speaker': ['TTS'],
  'audio': ['TTS'],
  'playback': ['TTS'],
  'tts': ['TTS'],
  'read_aloud': ['TTS'],
  'voice_output': ['TTS'],

  // Model selection → LLM
  'model_select': ['LLM'],
  'model_selector': ['LLM'],
  'llm_picker': ['LLM'],

  // Memory/RAG components → Memory
  'memory': ['Memory'],
  'rag': ['Memory'],
  'knowledge': ['Memory'],
  'embeddings': ['Memory'],
  'vector': ['Memory'],

  // Database components → Database
  'database': ['Database'],
  'query': ['Database'],
  'sql': ['Database'],
  'table': ['Database'],
};

/**
 * Analyzes canvas elements and returns a list of required plugin contracts.
 */
function analyzeCanvasForPlugins(elements: CanvasElement[]): string[] {
  const requiredPlugins = new Set<string>();

  elements.forEach(element => {
    const searchTerms = [
      element.name?.toLowerCase() || '',
      element.componentId?.toLowerCase() || '',
      element.type?.toLowerCase() || '',
    ];

    // Check each search term against our mapping
    searchTerms.forEach(term => {
      Object.entries(componentPluginMapping).forEach(([key, plugins]) => {
        if (term.includes(key)) {
          plugins.forEach(p => requiredPlugins.add(p));
        }
      });
    });
  });

  return Array.from(requiredPlugins);
}

/**
 * Extracts FE components from canvas for display in the diagram.
 */
function extractFeComponents(elements: CanvasElement[]): { id: string; name: string; icon: string }[] {
  const iconMap: Record<string, string> = {
    chat: '💬',
    message: '💬',
    input: '✏️',
    button: '🔘',
    voice: '🎤',
    microphone: '🎤',
    speaker: '🔊',
    audio: '🔊',
    model: '🔧',
    sidebar: '📋',
    header: '📰',
    footer: '📑',
    card: '🃏',
    container: '📦',
    list: '📝',
    form: '📄',
    navigation: '🧭',
    default: '🎨',
  };

  return elements.slice(0, 6).map(el => {
    const name = el.name || 'Component';
    const nameLower = name.toLowerCase();

    // Find matching icon
    let icon = iconMap.default;
    for (const [key, value] of Object.entries(iconMap)) {
      if (nameLower.includes(key)) {
        icon = value;
        break;
      }
    }

    return {
      id: el.id,
      name: name.length > 18 ? name.slice(0, 15) + '...' : name,
      icon,
    };
  });
}

// ============================================================================
// PLUGIN METADATA (info about each plugin type)
// ============================================================================

const pluginMetadata: Record<string, { name: string; defaultPlugin?: string }> = {
  'LLM': { name: 'Language Model', defaultPlugin: 'Ollama' },
  'STT': { name: 'Speech-to-Text', defaultPlugin: 'Whisper' },
  'TTS': { name: 'Text-to-Speech', defaultPlugin: 'Kokoro' },
  'Memory': { name: 'Vector Memory' },
  'Database': { name: 'Database Connector' },
};

/**
 * Build plugin slots ONLY for required plugins based on canvas analysis.
 * Merges with provided pluginRegistry to get actual status.
 */
function buildRequiredSlots(
  requiredContracts: string[],
  externalRegistry?: PluginSlot[]
): PluginSlot[] {
  return requiredContracts.map(contract => {
    // Check if there's an external slot with status info
    const externalSlot = externalRegistry?.find(
      s => s.contract.toUpperCase() === contract.toUpperCase()
    );

    const meta = pluginMetadata[contract] || { name: contract };

    if (externalSlot) {
      return externalSlot;
    }

    // Create a slot based on metadata (default to empty)
    return {
      id: contract.toLowerCase(),
      contract,
      name: meta.name,
      pluginName: meta.defaultPlugin,
      status: meta.defaultPlugin ? 'healthy' : 'empty',
    };
  });
}

// ============================================================================
// DATA FLOW DEFINITIONS
// ============================================================================

interface DataFlow {
  step: number;
  from: 'user' | 'fe' | 'ipc' | 'plugin';
  to: 'user' | 'fe' | 'ipc' | 'plugin';
  label: string;
}

/**
 * Generates data flow based on required plugins.
 */
function generateDataFlows(requiredPlugins: string[]): DataFlow[] {
  const flows: DataFlow[] = [];
  let step = 1;

  // Basic flow: User → FE → IPC → Plugin → IPC → FE → User
  flows.push({ step: step++, from: 'user', to: 'fe', label: 'User action' });
  flows.push({ step: step++, from: 'fe', to: 'ipc', label: 'Tauri invoke' });

  if (requiredPlugins.length > 0) {
    flows.push({ step: step++, from: 'ipc', to: 'plugin', label: `${requiredPlugins[0]} call` });
    flows.push({ step: step++, from: 'plugin', to: 'ipc', label: 'Response' });
  }

  flows.push({ step: step++, from: 'ipc', to: 'fe', label: 'Update state' });
  flows.push({ step: step++, from: 'fe', to: 'user', label: 'Render result' });

  return flows;
}

// ============================================================================
// ICONS
// ============================================================================

const UserIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
  </svg>
);

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <path d="M8 5v14l11-7z" />
  </svg>
);

const PauseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} fill="currentColor" viewBox="0 0 24 24">
    <rect x="6" y="4" width="4" height="16" rx="1" />
    <rect x="14" y="4" width="4" height="16" rx="1" />
  </svg>
);

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const BackendBlueprintPanel: React.FC<BackendBlueprintPanelProps> = ({
  className = '',
  compact: _compact = false,
  onSlotClick,
  onAddSlot,
  onRemoveSlot,
  projectName = 'App Factory',
  canvasElements = [],
  pluginRegistry,
  manualSlots = [],
}) => {
  // Note: compact prop reserved for future use (condensed view mode)
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeFlowStep, setActiveFlowStep] = useState<number | null>(null);
  const animationRef = useRef<number>(0);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Analyze canvas to determine required plugins
  const requiredPlugins = useMemo(
    () => analyzeCanvasForPlugins(canvasElements),
    [canvasElements]
  );

  // Build plugin slots ONLY for what the canvas needs (auto-detected)
  const autoDetectedSlots = useMemo(
    () => buildRequiredSlots(requiredPlugins, pluginRegistry),
    [requiredPlugins, pluginRegistry]
  );

  // Combine auto-detected slots with manual slots
  const activePluginSlots = useMemo(() => {
    // Group by contract to show multiple slots per category
    const allSlots = [...autoDetectedSlots];

    // Add manual slots, marking them as manual
    manualSlots.forEach(slot => {
      allSlots.push({ ...slot, id: `manual-${slot.id}` });
    });

    return allSlots;
  }, [autoDetectedSlots, manualSlots]);

  // Handle adding a new slot
  const handleAddSlot = useCallback((contract: string) => {
    onAddSlot?.(contract);
    setShowAddMenu(false);
  }, [onAddSlot]);

  // Extract FE components for display
  const feComponents = useMemo(
    () => extractFeComponents(canvasElements),
    [canvasElements]
  );

  // Generate data flows based on required plugins
  const dataFlows = useMemo(
    () => generateDataFlows(requiredPlugins),
    [requiredPlugins]
  );

  // Animation logic
  const runAnimation = useCallback(() => {
    let step = 0;
    const animate = () => {
      setActiveFlowStep(dataFlows[step]?.step || null);
      step = (step + 1) % dataFlows.length;
      animationRef.current = window.setTimeout(animate, 600);
    };
    animate();
  }, [dataFlows]);

  const toggleAnimation = useCallback(() => {
    if (isAnimating) {
      clearTimeout(animationRef.current);
      setActiveFlowStep(null);
    } else {
      runAnimation();
    }
    setIsAnimating(!isAnimating);
  }, [isAnimating, runAnimation]);

  useEffect(() => {
    return () => clearTimeout(animationRef.current);
  }, []);

  // Status styling helpers
  const getStatusDot = (status: HealthStatus) => {
    switch (status) {
      case 'healthy': return 'bg-emerald-500';
      case 'degraded': return 'bg-amber-500';
      case 'unhealthy': return 'bg-red-500';
      case 'empty': return 'bg-neutral-400';
    }
  };

  const getSlotStyles = (slot: PluginSlot, isRequired: boolean) => {
    const baseStyles = 'transition-all duration-200';
    if (slot.status === 'empty') {
      return `${baseStyles} bg-neutral-50 border-dashed border-2 border-neutral-300 text-neutral-500`;
    }
    if (isRequired) {
      return `${baseStyles} bg-emerald-50 border-2 border-emerald-300 text-emerald-700 ring-2 ring-emerald-200`;
    }
    return `${baseStyles} bg-neutral-50 border border-neutral-200 text-neutral-600`;
  };

  // Check if a zone should be highlighted
  const isZoneActive = (zone: 'user' | 'fe' | 'ipc' | 'plugin') => {
    if (!isAnimating || activeFlowStep === null) return false;
    const currentFlow = dataFlows.find(f => f.step === activeFlowStep);
    return currentFlow?.from === zone || currentFlow?.to === zone;
  };

  return (
    <div className={`flex flex-col h-full bg-white ${className}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-neutral-50 border-b border-neutral-200">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-semibold text-neutral-800">Architecture Blueprint</h2>
          <span className="px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded">
            {canvasElements.length} component{canvasElements.length !== 1 ? 's' : ''}
          </span>
          {requiredPlugins.length > 0 && (
            <span className="px-2 py-0.5 text-xs bg-emerald-100 text-emerald-700 rounded">
              {requiredPlugins.length} plugin{requiredPlugins.length !== 1 ? 's' : ''} required
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={toggleAnimation}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium transition-colors ${
            isAnimating
              ? 'bg-red-100 text-red-700 hover:bg-red-200'
              : 'bg-blue-100 text-blue-700 hover:bg-blue-200'
          }`}
        >
          {isAnimating ? (
            <>
              <PauseIcon className="w-3.5 h-3.5" />
              Stop
            </>
          ) : (
            <>
              <PlayIcon className="w-3.5 h-3.5" />
              Animate Flow
            </>
          )}
        </button>
      </div>

      {/* Main Diagram */}
      <div className="flex-1 p-4 overflow-auto">
        <div className="flex items-stretch gap-3 h-full min-h-[280px]">

          {/* USER (External) */}
          <div className={`flex flex-col items-center justify-center w-20 shrink-0 p-2 rounded-lg border-2 border-dashed transition-all duration-200 ${
            isZoneActive('user') ? 'border-blue-400 bg-blue-50' : 'border-neutral-300 bg-neutral-50'
          }`}>
            <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 transition-all duration-200 ${
              isZoneActive('user') ? 'bg-blue-200' : 'bg-neutral-200'
            }`}>
              <UserIcon className={`w-6 h-6 ${isZoneActive('user') ? 'text-blue-700' : 'text-neutral-600'}`} />
            </div>
            <span className="text-xs font-medium text-neutral-700">User</span>
            <span className="text-[9px] text-neutral-500 mt-0.5">External</span>
          </div>

          {/* Arrow 1 */}
          <div className="flex items-center">
            <div className={`flex items-center justify-center w-8 h-8 rounded-full text-[10px] font-bold transition-all duration-200 ${
              activeFlowStep === 1 || activeFlowStep === 6 ? 'bg-blue-500 text-white scale-110' : 'bg-neutral-200 text-neutral-600'
            }`}>
              {activeFlowStep === 6 ? '←' : '→'}
            </div>
          </div>

          {/* APPLICATION BOUNDARY */}
          <div className="flex-1 rounded-lg border border-neutral-200 bg-white overflow-hidden shadow-sm">
            {/* App Header */}
            <div className="px-3 py-2 bg-neutral-50 border-b border-neutral-200">
              <div className="text-xs font-semibold text-neutral-700">{projectName}</div>
              <div className="text-[10px] text-neutral-500">Tauri + React + Python Plugins</div>
            </div>

            <div className="flex divide-x divide-neutral-200 h-[calc(100%-44px)]">

              {/* React Frontend Zone */}
              <div className={`w-1/3 p-3 transition-all duration-200 ${
                isZoneActive('fe') ? 'bg-blue-50' : 'bg-white'
              }`}>
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-blue-500" />
                  <span className="text-xs font-semibold text-neutral-700">React FE</span>
                </div>

                {feComponents.length > 0 ? (
                  <div className="space-y-1.5">
                    {feComponents.map((comp) => (
                      <div
                        key={comp.id}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded border text-[11px] transition-all duration-200 ${
                          isZoneActive('fe')
                            ? 'bg-blue-100 border-blue-300 text-blue-800'
                            : 'bg-neutral-50 border-neutral-200 text-neutral-700'
                        }`}
                      >
                        <span>{comp.icon}</span>
                        <span className="truncate">{comp.name}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-6 text-neutral-400">
                    <div className="text-2xl mb-1">🎨</div>
                    <div className="text-xs">No components</div>
                    <div className="text-[10px]">Add to canvas</div>
                  </div>
                )}
              </div>

              {/* IPC Bridge Zone */}
              <div className={`w-1/3 p-3 transition-all duration-200 ${
                isZoneActive('ipc') ? 'bg-purple-50' : 'bg-white'
              }`}>
                <div className="flex items-center gap-1.5 mb-3">
                  <div className="w-2.5 h-2.5 rounded-full bg-purple-500" />
                  <span className="text-xs font-semibold text-neutral-700">IPC Bridge</span>
                </div>

                <div className="space-y-1.5">
                  <div className={`px-2 py-1.5 rounded border text-[11px] transition-all ${
                    isZoneActive('ipc') ? 'bg-purple-100 border-purple-300' : 'bg-neutral-50 border-neutral-200'
                  }`}>
                    <div className="font-medium text-neutral-700">Tauri Commands</div>
                    <div className="text-[9px] text-neutral-500">invoke() bridge</div>
                  </div>
                  <div className={`px-2 py-1.5 rounded border text-[11px] transition-all ${
                    isZoneActive('ipc') ? 'bg-purple-100 border-purple-300' : 'bg-neutral-50 border-neutral-200'
                  }`}>
                    <div className="font-medium text-neutral-700">Process Manager</div>
                    <div className="text-[9px] text-neutral-500">Python subprocess</div>
                  </div>
                  <div className={`px-2 py-1.5 rounded border transition-all ${
                    isZoneActive('ipc') ? 'bg-purple-100 border-purple-300' : 'bg-neutral-50 border-neutral-200'
                  }`}>
                    <div className="flex items-center gap-1.5">
                      <div className={`w-1.5 h-1.5 rounded-full ${isAnimating ? 'bg-emerald-500 animate-pulse' : 'bg-neutral-400'}`} />
                      <span className="text-[11px] font-medium text-neutral-700">JSON-RPC 2.0</span>
                    </div>
                    <div className="text-[9px] text-neutral-500 mt-0.5">stdio protocol</div>
                  </div>
                </div>

                {/* Active flow label */}
                {isAnimating && activeFlowStep !== null && (
                  <div className="mt-3 px-2 py-1.5 bg-purple-100 rounded text-[10px] text-purple-700 font-medium text-center animate-pulse">
                    {dataFlows.find(f => f.step === activeFlowStep)?.label}
                  </div>
                )}
              </div>

              {/* Plugin Sidecar Zone */}
              <div className={`w-1/3 p-3 transition-all duration-200 ${
                isZoneActive('plugin') ? 'bg-amber-50' : 'bg-white'
              }`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500" />
                    <span className="text-xs font-semibold text-neutral-700">Plugin Sidecar</span>
                  </div>
                  {/* Add Slot Button */}
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowAddMenu(!showAddMenu)}
                      className="w-5 h-5 flex items-center justify-center rounded bg-amber-100 hover:bg-amber-200 text-amber-700 transition-colors"
                      title="Add plugin slot"
                    >
                      <svg className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                    </button>
                    {/* Add Slot Dropdown Menu */}
                    {showAddMenu && (
                      <div className="absolute right-0 top-6 z-10 bg-white border border-neutral-200 rounded-lg shadow-lg py-1 min-w-[140px]">
                        <div className="px-2 py-1 text-[10px] text-neutral-500 font-medium border-b border-neutral-100">
                          Add Plugin Slot
                        </div>
                        {PLUGIN_CATEGORIES.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => handleAddSlot(cat)}
                            className="w-full px-3 py-1.5 text-left text-[11px] text-neutral-700 hover:bg-amber-50 transition-colors"
                          >
                            {cat}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>

                {activePluginSlots.length > 0 ? (
                  <div className="space-y-1.5">
                    {activePluginSlots.map((slot) => {
                      const isManual = slot.id.startsWith('manual-');
                      return (
                        <div
                          key={slot.id}
                          onClick={() => onSlotClick?.(slot)}
                          className={`group flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer hover:shadow-sm ${getSlotStyles(slot, true)}`}
                        >
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center shrink-0 ${
                            slot.status === 'empty'
                              ? 'border-2 border-dashed border-neutral-400'
                              : 'bg-emerald-200'
                          }`}>
                            <div className={`w-2 h-2 rounded-full ${getStatusDot(slot.status)}`} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="text-[11px] font-medium truncate">
                              {slot.pluginName || 'Empty Slot'}
                            </div>
                            <div className="text-[9px] opacity-70 truncate">
                              {slot.contract}{isManual ? ' (manual)' : ''}
                            </div>
                          </div>
                          {/* Remove button for manual slots */}
                          {isManual && onRemoveSlot && (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onRemoveSlot(slot.id.replace('manual-', ''));
                              }}
                              className="opacity-0 group-hover:opacity-100 w-4 h-4 flex items-center justify-center rounded bg-red-100 hover:bg-red-200 text-red-600 transition-all"
                              title="Remove slot"
                            >
                              <svg className="w-2.5 h-2.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                                <path d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          )}
                          {!isManual && (
                            slot.status !== 'empty' ? (
                              <span className="text-[8px] px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded font-medium">
                                OK
                              </span>
                            ) : (
                              <span className="text-[8px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-medium">
                                NEED
                              </span>
                            )
                          )}
                          {isManual && slot.status !== 'empty' && (
                            <span className="text-[8px] px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded font-medium">
                              ALT
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <div className="text-center py-4 text-neutral-400">
                    <div className="text-2xl mb-1">🔌</div>
                    <div className="text-xs">No plugins needed</div>
                    <div className="text-[10px]">Add components or click + above</div>
                  </div>
                )}

                {/* Health Registry Stats - only show if there are slots */}
                {activePluginSlots.length > 0 && (
                  <div className="mt-3 pt-2 border-t border-neutral-200 flex gap-3 text-[10px]">
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span className="text-neutral-600">
                        {activePluginSlots.filter((s: PluginSlot) => s.status === 'healthy').length} ready
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
                      <span className="text-neutral-500">
                        {activePluginSlots.filter((s: PluginSlot) => s.status === 'empty').length} needed
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Data Flow Legend */}
        <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-neutral-600">
          <span className="font-medium text-neutral-700">Data Flow:</span>
          {dataFlows.map((flow, i) => (
            <div key={flow.step} className="flex items-center gap-1.5">
              <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold transition-all ${
                activeFlowStep === flow.step
                  ? 'bg-blue-500 text-white scale-110'
                  : 'bg-neutral-200 text-neutral-600'
              }`}>
                {flow.step}
              </span>
              <span className={`${activeFlowStep === flow.step ? 'text-blue-700 font-medium' : ''}`}>
                {flow.label}
              </span>
              {i < dataFlows.length - 1 && <span className="text-neutral-300 ml-1">→</span>}
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div className="px-4 py-2 bg-neutral-50 border-t border-neutral-200 flex justify-between text-[10px] text-neutral-500">
        <span>Architecture: Tauri 1.8 + React + Python subprocess</span>
        <span>Protocol: JSON-RPC 2.0 over stdio</span>
      </div>
    </div>
  );
};

BackendBlueprintPanel.displayName = 'BackendBlueprintPanel';

export default BackendBlueprintPanel;
