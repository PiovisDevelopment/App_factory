/**
 * AiTeamVisualization.tsx
 * =======================
 * Three-panel AI Team visualization with:
 * - Left: Overall Status + Activity Log
 * - Center: ReactFlow process flow diagram
 * - Right: Agent Configuration panels
 * 
 * Architecture: Plugin Option C (Tauri + React + Python subprocess via stdio IPC)
 */

import React, { useEffect } from 'react';
import ReactFlow, {
    Background,
    Controls,
    Handle,
    Position,
    NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useAiTeamStore } from '../../stores/aiTeamStore';
import { ResizablePanelLayout } from '../ui/ResizablePanelLayout';
import { WorkflowProfileSelector } from './WorkflowProfileSelector';
import { AgentConfigPanel } from './AgentConfigPanel';

// ============================================
// CUSTOM AGENT NODE
// ============================================

/**
 * Custom AgentNode for ReactFlow.
 * Supports: active (processing), enabled (in workflow), disabled (greyed out).
 */
const AgentNode = ({ data }: NodeProps) => {
    const isEnabled = data.enabled !== false;
    const isActive = data.active && isEnabled;

    // Determine appearance based on state
    let containerClass = 'bg-neutral-800 border-neutral-700';
    let textClass = 'text-neutral-400';
    let subTextClass = 'text-neutral-500';
    let handleClass = '!bg-neutral-600 !border-neutral-500';

    if (!isEnabled) {
        // Disabled/greyed out state
        containerClass = 'bg-neutral-900 border-neutral-800 opacity-40';
        textClass = 'text-neutral-600';
        subTextClass = 'text-neutral-700';
        handleClass = '!bg-neutral-700 !border-neutral-700';
    } else if (isActive) {
        // Active/processing state
        containerClass = 'bg-yellow-400 border-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.4)]';
        textClass = 'text-neutral-900';
        subTextClass = 'text-neutral-800 opacity-80';
        handleClass = '!bg-neutral-900 !border-yellow-400';
    }

    return (
        <div className={`
            w-32 h-28 rounded-xl flex flex-col items-center justify-center 
            shadow-lg border-2 transition-all duration-500 
            ${isEnabled ? 'hover:scale-105' : ''} 
            group relative overflow-hidden 
            ${containerClass}
        `}>
            {/* Active gradient background */}
            {isActive && (
                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />
            )}

            {/* Top Handle */}
            <Handle
                type="target"
                position={Position.Top}
                className={`!w-2.5 !h-2.5 !border-2 ${handleClass}`}
            />

            {/* Agent Label */}
            <div className={`font-bold text-sm z-10 transition-colors duration-300 ${textClass}`}>
                {data.label}
            </div>

            {/* Sub-label / Status */}
            <div className={`text-xs mt-1 z-10 font-medium transition-colors duration-300 ${subTextClass}`}>
                {isEnabled ? (data.subLabel || 'Idle') : 'Disabled'}
            </div>

            {/* Processing indicator */}
            {isActive && (
                <div className="mt-2 flex gap-1 z-10">
                    <div className="w-1.5 h-1.5 bg-neutral-900 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-neutral-900 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-neutral-900 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            )}

            {/* Bottom Handle */}
            <Handle
                type="source"
                position={Position.Bottom}
                className={`!w-2.5 !h-2.5 !border-2 ${handleClass}`}
            />

            {/* Side Handles */}
            <Handle
                type="target"
                position={Position.Left}
                id="l"
                className={`!w-2.5 !h-2.5 !border-2 ${handleClass}`}
                style={{ top: '50%' }}
            />
            <Handle
                type="source"
                position={Position.Right}
                id="r"
                className={`!w-2.5 !h-2.5 !border-2 ${handleClass}`}
                style={{ top: '50%' }}
            />
        </div>
    );
};

const nodeTypes = {
    agent: AgentNode,
};

// ============================================
// LEFT PANEL: STATUS + ACTIVITY LOG
// ============================================

const StatusPanel: React.FC = () => {
    const { logs, overallProgress, isWorkflowRunning } = useAiTeamStore();

    return (
        <div className="h-full flex flex-col bg-neutral-900 border-r border-neutral-700">
            {/* Overall Status Section */}
            <div className="p-4 border-b border-neutral-700">
                <h3 className="text-sm font-semibold text-neutral-100 mb-3 flex items-center gap-2">
                    Overall Status
                    {isWorkflowRunning && (
                        <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                    )}
                </h3>

                {/* Progress Bar */}
                <div className="flex items-center gap-3">
                    <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden">
                        <div
                            className="h-full transition-all duration-500 shadow-[0_0_10px_rgba(250,204,21,0.5)]"
                            style={{
                                width: `${overallProgress}%`,
                                backgroundColor: overallProgress === 100 ? '#4ade80' : '#facc15'
                            }}
                        />
                    </div>
                    <span className={`text-sm font-mono min-w-[3rem] text-right ${overallProgress === 100 ? 'text-green-400' : 'text-yellow-400'
                        }`}>
                        {overallProgress}%
                    </span>
                </div>
            </div>

            {/* Activity Log Section */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <div className="px-4 py-2 border-b border-neutral-800">
                    <h4 className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                        Activity Log
                    </h4>
                </div>

                <div className="flex-1 overflow-y-auto p-3 font-mono text-xs custom-scrollbar">
                    <div className="space-y-2">
                        {logs.length === 0 ? (
                            <div className="text-neutral-600 text-center py-4">
                                No activity yet
                            </div>
                        ) : (
                            [...logs].reverse().map((log) => (
                                <div
                                    key={log.id}
                                    className="flex items-start gap-2 animate-fade-in"
                                >
                                    <span className={`mt-0.5 ${log.type === 'success' ? 'text-green-500' :
                                        log.type === 'error' ? 'text-red-500' :
                                            log.type === 'warning' ? 'text-orange-500' :
                                                'text-blue-400'
                                        }`}>
                                        {log.type === 'success' ? '✓' :
                                            log.type === 'error' ? '✗' : '▶'}
                                    </span>
                                    <span className="text-neutral-300 flex-1 break-words">
                                        {log.message}
                                    </span>
                                    <span className="text-neutral-600 text-[10px] whitespace-nowrap">
                                        {new Date(log.timestamp).toLocaleTimeString()}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>
            </div>

            {/* Legend */}
            <div className="p-3 border-t border-neutral-800 bg-neutral-900/50">
                <div className="flex flex-wrap gap-3 text-[10px] text-neutral-500">
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-yellow-400" />
                        <span>Processing</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-green-500" />
                        <span>Complete</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full bg-neutral-600" />
                        <span>Idle</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

// ============================================
// CENTER PANEL: PROCESS FLOW
// ============================================

const ProcessFlowPanel: React.FC = () => {
    const { nodes, edges } = useAiTeamStore();

    return (
        <div className="h-full w-full bg-[#1a1a1a] relative">
            {/* Header Overlay */}
            <div className="absolute top-4 left-4 z-10 pointer-events-none">
                <h2 className="text-neutral-100 text-lg font-semibold">Process Flow</h2>
                <p className="text-neutral-500 text-xs">Agent collaboration graph</p>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                fitViewOptions={{ padding: 0.3 }}
                attributionPosition="bottom-right"
                className="bg-[#1a1a1a]"
                minZoom={0.5}
                maxZoom={1.5}
            >
                <Background color="#333" gap={20} size={1} />
                <Controls
                    className="!bg-neutral-800 !border-neutral-700 !fill-white [&>button]:!fill-white hover:[&>button]:!bg-neutral-700"
                    showInteractive={false}
                />
            </ReactFlow>
        </div>
    );
};

// ============================================
// MAIN COMPONENT
// ============================================

interface AiTeamVisualizationProps {
    className?: string;
}

export const AiTeamVisualization: React.FC<AiTeamVisualizationProps> = ({
    className = '',
}) => {
    const {
        updateNodeStatus,
        addLog,
        setProgress,
        resetSimulation,
        setWorkflowRunning,
        agentConfigs,
    } = useAiTeamStore();

    // Demo simulation effect (runs on mount)
    useEffect(() => {
        resetSimulation();

        const runDemoSimulation = async () => {
            // Only run simulation with enabled agents
            const enabledAgents = agentConfigs.filter(a => a.enabled);
            if (enabledAgents.length === 0) {
                addLog('No agents enabled for this workflow', 'warning');
                return;
            }

            setWorkflowRunning(true);

            try {
                // Step 1: Orchestrator Start
                await new Promise(r => setTimeout(r, 800));
                if (agentConfigs.find(a => a.id === 'orchestrator')?.enabled) {
                    updateNodeStatus('orchestrator', { active: true, subLabel: 'Planning...' });
                    addLog('Orchestrator initialized workflow', 'info');
                }
                setProgress(10);

                // Step 2: Researcher
                await new Promise(r => setTimeout(r, 1200));
                updateNodeStatus('orchestrator', { active: false, subLabel: 'Done' });
                if (agentConfigs.find(a => a.id === 'researcher')?.enabled) {
                    updateNodeStatus('researcher', { active: true, subLabel: 'Researching...' });
                    addLog('Researcher analyzing requirements', 'info');
                }
                setProgress(25);

                await new Promise(r => setTimeout(r, 1500));
                if (agentConfigs.find(a => a.id === 'researcher')?.enabled) {
                    updateNodeStatus('researcher', { active: false, subLabel: 'Done' });
                    addLog('Research complete: 3 patterns found', 'success');
                }
                setProgress(40);

                // Step 3: Designer
                if (agentConfigs.find(a => a.id === 'designer')?.enabled) {
                    await new Promise(r => setTimeout(r, 1000));
                    updateNodeStatus('designer', { active: true, subLabel: 'Designing...' });
                    addLog('Designer creating blueprints', 'info');
                    setProgress(55);

                    await new Promise(r => setTimeout(r, 1500));
                    updateNodeStatus('designer', { active: false, subLabel: 'Done' });
                    addLog('Design complete: 2 blueprints', 'success');
                }
                setProgress(70);

                // Step 4: Developer
                if (agentConfigs.find(a => a.id === 'developer')?.enabled) {
                    await new Promise(r => setTimeout(r, 1000));
                    updateNodeStatus('developer', { active: true, subLabel: 'Coding...' });
                    addLog('Developer implementing code', 'info');
                    setProgress(80);

                    await new Promise(r => setTimeout(r, 1500));
                    updateNodeStatus('developer', { active: false, subLabel: 'Done' });
                    addLog('Implementation complete', 'success');
                }
                setProgress(90);

                // Step 5: QA
                if (agentConfigs.find(a => a.id === 'qa')?.enabled) {
                    await new Promise(r => setTimeout(r, 1000));
                    updateNodeStatus('qa', { active: true, subLabel: 'Testing...' });
                    addLog('QA validating output', 'info');

                    await new Promise(r => setTimeout(r, 1200));
                    updateNodeStatus('qa', { active: false, subLabel: 'Done' });
                    addLog('QA passed: All tests green', 'success');
                }

                setProgress(100);
                addLog('Workflow completed successfully', 'success');

            } finally {
                setWorkflowRunning(false);
            }
        };

        // Start demo after short delay
        const timeout = setTimeout(runDemoSimulation, 500);
        return () => clearTimeout(timeout);
    }, []); // Run once on mount

    return (
        <div className={`h-full w-full flex flex-col bg-[#1a1a1a] ${className}`}>
            {/* Top Bar with Profile Selector */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-neutral-700 bg-neutral-900">
                <WorkflowProfileSelector />
            </div>

            {/* Main 3-Panel Layout */}
            <div className="flex-1 overflow-hidden">
                <ResizablePanelLayout
                    leftPanel={<StatusPanel />}
                    centerPanel={<ProcessFlowPanel />}
                    rightPanel={<AgentConfigPanel />}
                    leftConfig={{ minWidth: 200, initialPercent: 25 }}
                    rightConfig={{ minWidth: 250, initialPercent: 25 }}
                />
            </div>
        </div>
    );
};

export default AiTeamVisualization;
