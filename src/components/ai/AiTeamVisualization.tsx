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

import React, { useEffect, useState } from 'react';
import { invoke } from '@tauri-apps/api/tauri';
import { listen, UnlistenFn } from '@tauri-apps/api/event';
import ReactFlow, {
    Background,
    Controls,
    Handle,
    Position,
    NodeProps,
} from 'reactflow';
import 'reactflow/dist/style.css';

import { useAiTeamStore } from '../../stores/aiTeamStore';
import { useComponentLibraryStore } from '../../stores/componentLibraryStore';
import { useApiKeyInfo, useFetchAllLlmKeys } from '../../stores/apiKeyStore';
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
        addLog,
        resetSimulation,
        setWorkflowRunning,
        loadConfigFromDisk,
        isWorkflowRunning,
        generatedCode,
        setGeneratedCode,
        setQaReport,
        setWorkflowPrompt: storeSetWorkflowPrompt,
        clearWorkflowResult,
    } = useAiTeamStore();

    const { addComponent, selectComponent } = useComponentLibraryStore();

    // API Key integration for agent validation
    const apiKeyInfo = useApiKeyInfo();
    const fetchAllLlmKeys = useFetchAllLlmKeys();

    const [workflowPrompt, setWorkflowPrompt] = useState('');

    // Handler to add generated code to canvas
    const handleAddToCanvas = () => {
        if (!generatedCode) return;

        // Extract component name from code
        const nameMatch = generatedCode.match(/(?:const|function)\s+([A-Z][a-zA-Z0-9]*)/);
        const componentName = nameMatch?.[1] || `AIComponent_${Date.now()}`;

        // Add to component library
        const newComponent = addComponent({
            name: componentName,
            code: generatedCode,
            framework: 'react',
            category: 'other',
            prompt: workflowPrompt,
            description: `Generated by AI Team: ${workflowPrompt.slice(0, 100)}`,
        });

        // Select the new component to show in canvas
        selectComponent(newComponent.id);

        addLog(`Added "${componentName}" to canvas`, 'success');
        clearWorkflowResult();
    };

    const handleRunWorkflow = async () => {
        if (!workflowPrompt.trim()) return;

        setWorkflowRunning(true);
        clearWorkflowResult();
        storeSetWorkflowPrompt(workflowPrompt);
        addLog(`Starting workflow: ${workflowPrompt}`, 'info');

        try {
            const result = await invoke<{
                success: boolean;
                generated_code?: string;
                qa_report?: string;
            }>('ipc_call', {
                method: 'ai_team/run',
                params: { prompt: workflowPrompt }
            });

            if (result.success && result.generated_code) {
                setGeneratedCode(result.generated_code);
                setQaReport(result.qa_report || null);
                addLog('Workflow completed - code ready for canvas!', 'success');
            } else {
                addLog('Workflow completed but no code was generated', 'warning');
            }
        } catch (error) {
            const errorMessage = error instanceof Error
                ? error.message
                : typeof error === 'object'
                    ? JSON.stringify(error)
                    : String(error);
            addLog(`Workflow failed: ${errorMessage}`, 'error');
        } finally {
            setWorkflowRunning(false);
        }
    };

    // Load config from disk and fetch API keys on mount
    useEffect(() => {
        loadConfigFromDisk();
        fetchAllLlmKeys();
    }, [loadConfigFromDisk, fetchAllLlmKeys]);

    // Listen for real-time log events from Python backend
    useEffect(() => {
        let unlisten: UnlistenFn | null = null;

        const setupListener = async () => {
            try {
                unlisten = await listen<{
                    type: string;
                    level: string;
                    agent: string;
                    message: string;
                    timestamp: string;
                }>('ai_team::log', (event) => {
                    const { level, message } = event.payload;
                    // Map Python log levels to our log types
                    const logLevel = level === 'success' ? 'success'
                        : level === 'error' ? 'error'
                            : level === 'warning' ? 'warning'
                                : 'info';
                    addLog(message, logLevel as 'info' | 'success' | 'warning' | 'error');
                });
            } catch (error) {
                console.error('Failed to setup log listener:', error);
            }
        };

        setupListener();

        return () => {
            if (unlisten) {
                unlisten();
            }
        };
    }, [addLog]);

    // Demo simulation effect (runs on mount)
    useEffect(() => {
        resetSimulation();

        /* 
        // DISABLED: Demo simulation
        const runDemoSimulation = async () => {
            // ... (demo code commented out for real implementation)
        };
        // const timeout = setTimeout(runDemoSimulation, 500);
        // return () => clearTimeout(timeout);
        */
        return () => { };
    }, []); // Run once on mount

    return (
        <div className={`h-full w-full flex flex-col bg-[#1a1a1a] ${className}`}>
            {/* Top Bar with Profile Selector */}
            <div className="flex-shrink-0 px-4 py-3 border-b border-neutral-700 bg-neutral-900 flex items-center gap-4">
                <WorkflowProfileSelector />
                <div className="h-6 w-px bg-neutral-700" />
                <div className="flex-1 flex gap-2">
                    <input
                        type="text"
                        value={workflowPrompt}
                        onChange={(e) => setWorkflowPrompt(e.target.value)}
                        placeholder="Describe what you want the AI team to build..."
                        className="flex-1 px-3 py-1.5 bg-neutral-800 border border-neutral-600 rounded text-sm text-white focus:outline-none focus:border-primary-500 transition-colors"
                        disabled={isWorkflowRunning}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && !isWorkflowRunning) handleRunWorkflow();
                        }}
                    />
                    <button
                        onClick={handleRunWorkflow}
                        disabled={isWorkflowRunning || !workflowPrompt.trim()}
                        className="px-4 py-1.5 bg-primary-500 hover:bg-primary-600 disabled:opacity-50 disabled:cursor-not-allowed rounded text-sm font-medium text-white transition-colors"
                    >
                        {isWorkflowRunning ? 'Running...' : 'Run Workflow'}
                    </button>
                    {/* Add to Canvas button - visible when code is ready */}
                    {generatedCode && (
                        <button
                            onClick={handleAddToCanvas}
                            className="px-4 py-1.5 bg-green-500 hover:bg-green-600 rounded text-sm font-medium text-white transition-colors flex items-center gap-2"
                        >
                            <span>✓</span>
                            Add to Canvas
                        </button>
                    )}
                </div>
            </div>

            {/* Main 3-Panel Layout */}
            <div className="flex-1 overflow-hidden">
                <ResizablePanelLayout
                    leftPanel={<StatusPanel />}
                    centerPanel={<ProcessFlowPanel />}
                    rightPanel={<AgentConfigPanel apiKeys={apiKeyInfo} />}
                    leftConfig={{ minWidth: 200, initialPercent: 25 }}
                    rightConfig={{ minWidth: 250, initialPercent: 25 }}
                />
            </div>
        </div>
    );
};

export default AiTeamVisualization;
