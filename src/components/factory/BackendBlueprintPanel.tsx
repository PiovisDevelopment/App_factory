/**
 * BackendBlueprintPanel - Dynamic Canvas-Aware Architecture Visualization
 * =======================================================================
 * Premium visualization of the Tauri Brownfield architecture.
 *
 * Design Pillars:
 * 1. Visual Excellence: Glassmorphism, subtle gradients, and fluid motion.
 * 2. Spatial Logic: Connections attach to borders (aligned via % grid).
 * 3. Information Density: Compact cards with full text visibility (no truncation).
 * 4. Interactive Feedback: Hover states, active flow indication, and clear status.
 *
 * Layout Coordinates (SVG ViewBox 0-1000):
 * - User Zone (0-10%): Center ~5%.
 * - FE Zone (12-40%): Connections at 125 and 385.
 * - IPC Zone (42-70%): Connections at 425 and 685.
 * - Plugin Zone (72-100%): Connections at 725.
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
  onSlotClick?: (slot: PluginSlot) => void;
  onAddSlot?: (contract: string) => void;
  onRemoveSlot?: (slotId: string) => void;
  projectName?: string;
  canvasElements?: CanvasElement[];
  pluginRegistry?: PluginSlot[];
  manualSlots?: PluginSlot[];
}

export const PLUGIN_CATEGORIES = ['LLM', 'STT', 'TTS', 'Memory', 'Database', 'Custom'] as const;

// ============================================================================
// MAPPINGS & HELPERS
// ============================================================================

const componentPluginMapping: Record<string, string[]> = {
  'chat': ['LLM'], 'message': ['LLM'], 'conversation': ['LLM'], 'input': ['LLM'],
  'voice': ['STT'], 'mic': ['STT'],
  'speaker': ['TTS'], 'audio': ['TTS'],
  'memory': ['Memory'], 'vector': ['Memory'],
  'database': ['Database'], 'sql': ['Database'],
};

function analyzeCanvasForPlugins(elements: CanvasElement[]): string[] {
  const requiredPlugins = new Set<string>();
  elements.forEach(element => {
    const term = (element.name + element.type).toLowerCase();
    Object.entries(componentPluginMapping).forEach(([key, plugins]) => {
      if (term.includes(key)) plugins.forEach(p => requiredPlugins.add(p));
    });
  });
  return Array.from(requiredPlugins);
}

const pluginMetadata: Record<string, { name: string; defaultPlugin?: string }> = {
  'LLM': { name: 'Language Model', defaultPlugin: 'Ollama' },
  'STT': { name: 'Speech-to-Text', defaultPlugin: 'Whisper' },
  'TTS': { name: 'Text-to-Speech', defaultPlugin: 'Kokoro' },
  'Memory': { name: 'Vector Memory' },
  'Database': { name: 'Database Connector' },
};

function buildRequiredSlots(required: string[], registry?: PluginSlot[]): PluginSlot[] {
  return required.map(contract => {
    const existing = registry?.find(s => s.contract.toUpperCase() === contract.toUpperCase());
    const meta = pluginMetadata[contract] || { name: contract };
    if (existing) return existing;
    return {
      id: contract.toLowerCase(),
      contract,
      name: meta.name,
      pluginName: meta.defaultPlugin,
      status: meta.defaultPlugin ? 'healthy' : 'empty',
    };
  });
}

function extractFeComponents(elements: CanvasElement[]) {
  const iconMap: Record<string, string> = {
    chat: '💬', input: '✏️', button: '🔘', voice: '🎤', speaker: '🔊',
    default: '💠'
  };
  return elements.slice(0, 8).map(el => {
    let icon = iconMap.default;
    const nameLower = (el.name || '').toLowerCase();
    for (const [k, v] of Object.entries(iconMap)) {
      if (nameLower.includes(k)) { icon = v; break; }
    }
    return { id: el.id, name: el.name || 'Component', icon };
  });
}

// ============================================================================
// ANIMATION & DATA FLOW
// ============================================================================

interface DataFlow {
  step: number;
  from: 'user' | 'fe' | 'ipc' | 'plugin';
  to: 'user' | 'fe' | 'ipc' | 'plugin';
  label: string;
  description: string;
}

function generateDataFlows(requiredPlugins: string[]): DataFlow[] {
  const flows: DataFlow[] = [];
  let s = 1;
  // Use Case: "Sending a Message" - Simple, Non-Technical Terms
  flows.push({ step: s++, from: 'user', to: 'fe', label: 'Interaction', description: 'Step 1: User types a prompt' });
  flows.push({ step: s++, from: 'fe', to: 'ipc', label: 'Command', description: 'Step 2: App sends text to Core' });
  if (requiredPlugins.length) {
    flows.push({ step: s++, from: 'ipc', to: 'plugin', label: 'Process', description: 'Step 3: Core asks AI to think' });
    flows.push({ step: s++, from: 'plugin', to: 'ipc', label: 'Result', description: 'Step 4: AI Model returns answer' });
  }
  flows.push({ step: s++, from: 'ipc', to: 'fe', label: 'Update', description: 'Step 5: App receives AI reply' });
  flows.push({ step: s++, from: 'fe', to: 'user', label: 'View', description: 'Step 6: User reads the response' });
  return flows;
}

// ============================================================================
// MAIN COMPONENT
// ============================================================================

export const BackendBlueprintPanel: React.FC<BackendBlueprintPanelProps> = ({
  className = '',
  canvasElements = [],
  pluginRegistry,
  manualSlots = [],
  onAddSlot,
  onRemoveSlot,
  onSlotClick
}) => {
  const [isAnimating, setIsAnimating] = useState(false);
  const [activeStep, setActiveStep] = useState<number | null>(null);
  const animationRef = useRef<number>(0);
  const [showAddMenu, setShowAddMenu] = useState(false);

  // Specific Component Targeting State
  const [activeFeComponent, setActiveFeComponent] = useState<string | null>(null);

  // Data processing
  const required = useMemo(() => analyzeCanvasForPlugins(canvasElements), [canvasElements]);
  const autoSlots = useMemo(() => buildRequiredSlots(required, pluginRegistry), [required, pluginRegistry]);
  const allSlots = useMemo(() => {
    return [...autoSlots, ...manualSlots.map(s => ({ ...s, id: `manual-${s.id}` }))];
  }, [autoSlots, manualSlots]);
  const feComponents = useMemo(() => extractFeComponents(canvasElements), [canvasElements]);
  const flows = useMemo(() => generateDataFlows(required), [required]);

  // Current Animation State info
  const currentFlow = useMemo(() =>
    activeStep !== null ? flows.find(f => f.step === activeStep) : null
    , [activeStep, flows]);

  // Animation Loop
  const runAnimation = useCallback(() => {
    let s = 0;
    const animate = () => {
      const flow = flows[s];
      setActiveStep(flow?.step || 1);

      s = (s + 1) % flows.length;
      // REDUCED SPEED: 3000ms per step
      animationRef.current = window.setTimeout(animate, 3000);
    };
    animate();
  }, [flows]);

  // Handle specific component targeting based on active step
  useEffect(() => {
    if (activeStep !== null) {
      const flow = flows.find(f => f.step === activeStep);
      // Strictly highlight a random FE component ONLY when FE is the SOURCE of the action
      if (flow?.from === 'fe' && feComponents.length > 0) {
        const randomIdx = Math.floor(Math.random() * feComponents.length);
        setActiveFeComponent(feComponents[randomIdx].id);
      } else {
        setActiveFeComponent(null);
      }
    } else {
      setActiveFeComponent(null);
    }
  }, [activeStep, flows, feComponents]);

  const toggleAnimation = () => {
    if (isAnimating) {
      clearTimeout(animationRef.current);
      setActiveStep(null);
      setActiveFeComponent(null);
    } else {
      runAnimation();
    }
    setIsAnimating(!isAnimating);
  };

  useEffect(() => () => clearTimeout(animationRef.current), []);

  const isActive = (zone: string) => {
    if (!isAnimating || activeStep === null) return false;
    const current = flows.find(f => f.step === activeStep);
    return current?.from === zone;
  };

  return (
    <div className={`flex flex-col h-full bg-slate-50/50 ${className}`}>
      {/* 1. Header with Glassmorphism */}
      <div className="relative flex items-center justify-between px-5 py-3 bg-white/80 backdrop-blur-sm border-b border-slate-200 sticky top-0 z-40 shrink-0">

        {/* LEFT: Title & Badges */}
        <div className="flex items-center gap-4 z-10">
          <div className="flex items-center gap-2">
            <div className="p-1.5 bg-indigo-50 rounded-lg">
              <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
              </svg>
            </div>
            <h2 className="text-sm font-bold text-slate-800 tracking-tight leading-tight">System Architecture</h2>
          </div>

          <div className="flex gap-2">
            <Badge label={`${canvasElements.length} Components`} color="blue" />
            {required.length > 0 && <Badge label={`${required.length} Plugins`} color="emerald" />}
          </div>
        </div>

        {/* CENTER: Dynamic Status Description (Absolute Center) */}
        {isAnimating && currentFlow && (
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none">
            <div className="px-4 py-1.5 rounded-full bg-indigo-50 border border-indigo-100 shadow-sm animate-in fade-in zoom-in-95 duration-300">
              <span className="text-xs font-bold text-indigo-700 block text-center min-w-[200px] whitespace-nowrap">
                {currentFlow.description}
              </span>
            </div>
          </div>
        )}

        {/* RIGHT: Action Button */}
        <div className="z-10">
          <button
            onClick={toggleAnimation}
            className={`
              relative overflow-hidden px-4 py-1.5 rounded-full text-xs font-semibold shadow-sm transition-all duration-300 border
              ${isAnimating
                ? 'bg-rose-50 text-rose-600 border-rose-200 hover:bg-rose-100'
                : 'bg-indigo-600 text-white border-transparent hover:bg-indigo-700 hover:shadow-md'
              }
            `}
          >
            {isAnimating ? 'Stop' : 'Simulate'}
          </button>
        </div>
      </div>

      {/* 2. Main Visualization Area */}
      <div className="flex-1 p-6 overflow-hidden relative isolate flex flex-col justify-center">

        {/* SVG Overlay: Connections between Borders */}
        <div className="absolute inset-x-6 top-6 bottom-6 z-0 pointer-events-none">
          <svg className="w-full h-full" viewBox="0 0 1000 300" preserveAspectRatio="none">
            <defs>
              <linearGradient id="flowGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" stopOpacity="0.1" />
                <stop offset="100%" stopColor="#8b5cf6" stopOpacity="0.1" />
              </linearGradient>
              <filter id="glowParams" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Static Connection Lines (Dashed) - BRIDGING THE GAPS (Borders) */}
            {/* User Right (85) -> FE Left (125) */}
            <path d="M 85 150 L 125 150" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4,4" opacity="0.5" />
            {/* FE Right (385) -> IPC Left (425) */}
            <path d="M 385 150 L 425 150" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4,4" opacity="0.5" />
            {/* IPC Right (685) -> Plugin Left (725) */}
            <path d="M 685 150 L 725 150" stroke="#cbd5e1" strokeWidth="2" strokeDasharray="4,4" opacity="0.5" />

            {/* Animated Flow Packets */}
            {isAnimating && activeStep !== null && (
              <>
                {/* 1. User -> FE */}
                {activeStep === 1 && <FlowPacket from={85} to={125} color="#3b82f6" />}
                {/* 2. FE -> IPC */}
                {activeStep === 2 && <FlowPacket from={385} to={425} color="#8b5cf6" />}
                {/* 3. IPC -> Plugin */}
                {activeStep === 3 && <FlowPacket from={685} to={725} color="#f59e0b" />}
                {/* 4. Plugin -> IPC (Return) */}
                {activeStep === 4 && <FlowPacket from={725} to={685} color="#f59e0b" />}
                {/* 5. IPC -> FE (Return) */}
                {activeStep === 5 && <FlowPacket from={425} to={385} color="#8b5cf6" />}
                {/* 6. FE -> User (Return) */}
                {activeStep === 6 && <FlowPacket from={125} to={85} color="#3b82f6" />}
              </>
            )}
          </svg>
        </div>

        {/* Grid Layout for Zones - Percentage based to align with SVG 0-1000 scale */}
        <div className="grid grid-cols-[10%_28%_28%_28%] gap-[2%] h-full z-10 relative">

          {/* ZONE 1: USER (External) */}
          <div className="flex flex-col justify-center items-center h-full">
            <div className={`
              w-20 h-20 rounded-2xl flex flex-col items-center justify-center border-2 transition-all duration-500
              ${isActive('user')
                ? 'bg-blue-50 border-blue-500 shadow-[0_0_25px_rgba(59,130,246,0.3)] scale-110 ring-4 ring-blue-100'
                : 'bg-white border-dashed border-slate-300 opacity-80'
              }
            `}>
              <div className={`p-2 rounded-full mb-1 transition-colors duration-500 ${isActive('user') ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-400'}`}>
                <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" /></svg>
              </div>
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">User</span>
            </div>

            {/* Status Indicator */}
            <div className={`mt-4 px-3 py-1 rounded-full text-[10px] bg-slate-100 text-slate-500 font-bold tracking-wide transition-all duration-300 ${isActive('user') ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0'}`}>
              {activeStep === 1 ? 'INPUT' : (activeStep === 6 ? 'VIEW' : 'IDLE')}
            </div>
          </div>

          {/* ZONE 2: FRONTEND */}
          <ZoneCard
            title="React Frontend"
            color="blue"
            active={isActive('fe')}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>}
          >
            {feComponents.length === 0 ? (
              <EmptyState label="Add components" />
            ) : (
              <div className="grid grid-cols-1 gap-2 content-start overflow-y-auto pr-1 custom-scrollbar max-h-full">
                {feComponents.map(c => (
                  <ComponentPill
                    key={c.id}
                    icon={c.icon}
                    name={c.name}
                    // Highlights ONLY when FE is active AND this specific component was selected
                    active={isActive('fe') && (activeFeComponent === c.id)}
                    color="blue"
                  />
                ))}
              </div>
            )}
          </ZoneCard>

          {/* ZONE 3: IPC BRIDGE */}
          <ZoneCard
            title="IPC Bridge"
            subtitle="Tauri Core (Rust)"
            color="purple"
            active={isActive('ipc')}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l3 3-3 3m5 0h3M5 20h14a2 2 0 002-2V6a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>}
          >
            <div className="space-y-2 h-full flex flex-col justify-center">
              <TechPill label="Tauri Commands" detail="invoke()" active={isActive('ipc')} />
              <TechPill label="Process Mgmt" detail="std::process" active={isActive('ipc')} />
              <div className={`p-2 rounded border text-center transition-all duration-500 mt-auto ${isActive('ipc') ? 'bg-purple-50 border-purple-200 shadow-inner scale-105' : 'bg-slate-50 border-slate-100'}`}>
                <div className="text-[9px] font-bold text-slate-400 uppercase mb-1">Protocol</div>
                <div className="text-xs font-mono text-slate-600">JSON-RPC 2.0</div>
                <div className={`h-3 mt-1 text-[9px] text-purple-600 font-bold transition-opacity duration-300 ${isActive('ipc') ? 'opacity-100' : 'opacity-0'}`}>
                  Processing...
                </div>
              </div>
            </div>
          </ZoneCard>

          {/* ZONE 4: PLUGIN SIDECAR */}
          <ZoneCard
            title="Plugin Sidecar"
            subtitle="Python Environment"
            color="amber"
            active={isActive('plugin')}
            icon={<svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>}
            action={
              <button onClick={() => setShowAddMenu(!showAddMenu)} className="hover:bg-amber-100 p-1 rounded-md text-amber-600 transition-colors">
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
              </button>
            }
          >
            {showAddMenu && (
              <div className="absolute right-2 top-10 w-32 bg-white rounded-lg shadow-xl border border-slate-100 z-50 py-1 animate-in fade-in zoom-in-95 duration-200">
                {PLUGIN_CATEGORIES.map(cat => (
                  <button key={cat} onClick={() => { onAddSlot?.(cat); setShowAddMenu(false); }} className="w-full text-left px-3 py-1.5 text-[11px] hover:bg-slate-50 text-slate-600">
                    {cat}
                  </button>
                ))}
              </div>
            )}

            {allSlots.length === 0 ? (
              <EmptyState label="No plugins" />
            ) : (
              <div className="space-y-2 overflow-y-auto pr-1 custom-scrollbar max-h-full">
                {allSlots.map(slot => (
                  <PluginSlotRow key={slot.id} slot={slot} active={isActive('plugin')} />
                ))}
              </div>
            )}
          </ZoneCard>

        </div>
      </div>
    </div>
  );
};

// ============================================================================
// SUB-COMPONENTS
// ============================================================================

const Badge = ({ label, color }: { label: string, color: string }) => (
  <span className={`px-2 py-0.5 rounded-md text-[10px] font-bold bg-${color}-50 text-${color}-600 border border-${color}-100 whitespace-nowrap`}>
    {label}
  </span>
);

const FlowPacket = ({ from, to, color }: { from: number, to: number, color: string }) => (
  <g>
    <path d={`M ${from} 150 L ${to} 150`} stroke={color} strokeWidth="3" fill="none" strokeLinecap="round" opacity="0.4" />
    <circle r="5" fill={color} filter="url(#glowParams)">
      <animateMotion dur="1.2s" repeatCount="1" path={`M ${from} 150 L ${to} 150`} keyPoints="0;1" keyTimes="0;1" />
    </circle>
  </g>
);

const ZoneCard = ({ title, subtitle, color, icon, children, active, action }: any) => {
  const borderColors: any = { blue: 'border-blue-400', purple: 'border-purple-400', amber: 'border-amber-400' };
  const bgColors: any = { blue: 'bg-blue-50', purple: 'bg-purple-50', amber: 'bg-amber-50' };
  const activeShadows: any = {
    blue: 'shadow-[0_0_30px_rgba(59,130,246,0.3)] ring-4 ring-blue-100',
    purple: 'shadow-[0_0_30px_rgba(139,92,246,0.3)] ring-4 ring-purple-100',
    amber: 'shadow-[0_0_30px_rgba(245,158,11,0.3)] ring-4 ring-orange-100'
  };

  return (
    <div className={`
      flex flex-col rounded-xl border backdrop-blur-sm transition-all duration-500 relative h-full overflow-hidden
      ${active ? `${bgColors[color]} ${borderColors[color]} ${activeShadows[color]} scale-105 z-20` : `bg-white/60 border-slate-200 z-10`}
    `}>
      <div className={`px-3 py-2 border-b border-slate-100 flex items-center justify-between bg-white/40 shrink-0`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-md shrink-0 transition-colors duration-500 ${active ? `bg-${color}-100 text-${color}-600` : 'bg-slate-100 text-slate-400'}`}>
            {icon}
          </div>
          <div className="min-w-0">
            <div className={`text-xs font-bold truncate transition-colors duration-500 ${active ? `text-${color}-900` : 'text-slate-700'}`}>{title}</div>
            {subtitle && <div className="text-[9px] text-slate-400 truncate">{subtitle}</div>}
          </div>
        </div>
        {action}
      </div>
      <div className="p-2 flex-1 overflow-hidden flex flex-col min-h-0">
        {children}
      </div>
    </div>
  );
};

const ComponentPill = ({ icon, name, active, color }: any) => (
  <div className={`
    flex items-center gap-2 px-2 py-2 rounded-lg border text-[11px] font-medium transition-all duration-500
    ${active
      ? `bg-white border-${color}-300 shadow-md text-${color}-700 ring-2 ring-${color}-100 scale-105`
      : 'bg-slate-50 border-slate-100 text-slate-500'
    }
  `}>
    <span className="shrink-0">{icon}</span>
    <span className="whitespace-normal leading-tight break-words">{name}</span>
  </div>
);

const TechPill = ({ label, detail, active }: any) => (
  <div className={`
     px-2 py-2 rounded-lg border transition-all duration-500 flex justify-between items-center
     ${active ? 'bg-white border-purple-200 shadow-sm scale-105' : 'bg-slate-50 border-slate-100'}
  `}>
    <span className={`text-[10px] font-semibold transition-colors duration-500 ${active ? 'text-purple-700' : 'text-slate-600'}`}>{label}</span>
    <span className="text-[9px] font-mono text-slate-400">{detail}</span>
  </div>
);

const PluginSlotRow = ({ slot, active }: { slot: PluginSlot, active: boolean }) => (
  <div className={`
    flex items-center gap-2 px-2 py-2 rounded-lg border transition-all duration-500
    ${active ? 'bg-white border-amber-200 shadow-md scale-105 ring-2 ring-orange-100' : 'bg-slate-50 border-slate-100'}
  `}>
    <div className={`w-2 h-2 rounded-full shrink-0 ${slot.status === 'healthy' ? 'bg-emerald-400' : 'bg-amber-300'}`} />
    <div className="flex-1 min-w-0">
      <div className={`text-[10px] font-bold truncate transition-colors duration-500 ${active ? 'text-amber-800' : 'text-slate-600'}`}>{slot.pluginName || 'Empty Slot'}</div>
      <div className="text-[9px] text-slate-400 truncate">{slot.contract}</div>
    </div>
    <div className={`text-[9px] px-1.5 py-0.5 rounded shrink-0 ${slot.status === 'healthy' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-200 text-slate-500'}`}>
      {slot.status === 'healthy' ? 'RDY' : '...'}
    </div>
  </div>
);

const EmptyState = ({ label }: { label: string }) => (
  <div className="h-full flex flex-col items-center justify-center text-slate-300 p-4">
    <div className="text-2xl mb-1 opacity-50">⚡</div>
    <div className="text-[10px] font-medium text-center">{label}</div>
  </div>
);

export default BackendBlueprintPanel;
