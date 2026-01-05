import React, { useCallback, useEffect } from 'react';
import ReactFlow, {
    Background,
    Controls,
    Edge,
    Node,
    Handle,
    Position,
    NodeProps,
    MarkerType,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useAiTeamStore } from '../../stores/aiTeamStore';

// --- Custom Node Component ---
const AgentNode = ({ data }: NodeProps) => {
    return (
        <div className={`w-40 h-40 rounded-2xl flex flex-col items-center justify-center shadow-lg border-2 transition-all duration-500 hover:scale-105 group relative overflow-hidden ${data.active
                ? 'bg-yellow-400 border-yellow-500 shadow-[0_0_20px_rgba(250,204,21,0.4)]'
                : 'bg-neutral-800 border-neutral-700'
            }`}>
            {/* active gradient background */}
            {data.active && <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent pointer-events-none" />}

            <Handle type="target" position={Position.Top} className={`!w-3 !h-3 !border-2 ${data.active ? '!bg-neutral-900 !border-yellow-400' : '!bg-neutral-600 !border-neutral-500'}`} />

            <div className={`font-bold text-lg z-10 transition-colors duration-300 ${data.active ? 'text-neutral-900' : 'text-neutral-400'}`}>{data.label}</div>

            <div className={`text-xs mt-1 z-10 font-medium transition-colors duration-300 ${data.active ? 'text-neutral-800 opacity-80' : 'text-neutral-500'}`}>
                {data.subLabel || 'Idle'}
            </div>

            {/* Visual indicator of 'processing' */}
            {data.active && (
                <div className="mt-3 flex gap-1 z-10">
                    <div className="w-1.5 h-1.5 bg-neutral-900 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-neutral-900 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-neutral-900 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
            )}

            <Handle type="source" position={Position.Bottom} className={`!w-3 !h-3 !border-2 ${data.active ? '!bg-neutral-900 !border-yellow-400' : '!bg-neutral-600 !border-neutral-500'}`} />
            <Handle type="target" position={Position.Left} id="l" className={`!w-3 !h-3 !border-2 ${data.active ? '!bg-neutral-900 !border-yellow-400' : '!bg-neutral-600 !border-neutral-500'}`} style={{ top: '50%' }} />
            <Handle type="source" position={Position.Right} id="r" className={`!w-3 !h-3 !border-2 ${data.active ? '!bg-neutral-900 !border-yellow-400' : '!bg-neutral-600 !border-neutral-500'}`} style={{ top: '50%' }} />
        </div>
    );
};

const nodeTypes = {
    agent: AgentNode,
};

export const AiTeamVisualization: React.FC = () => {
    const { nodes, edges, logs, overallProgress, updateNodeStatus, addLog, setProgress, resetSimulation, setEdges } = useAiTeamStore();

    // Simulation Effect (Demo Dynamic Behavior)
    useEffect(() => {
        resetSimulation();

        const runSimulation = async () => {
            // Step 1: Orchestrator Start
            await new Promise(r => setTimeout(r, 1000));
            updateNodeStatus('orchestrator', { active: true, subLabel: 'Initializing...' });
            addLog('Orchestrator starting new workflow', 'info');
            setProgress(10);

            // Step 2: Assign to Researcher
            await new Promise(r => setTimeout(r, 1500));
            updateNodeStatus('orchestrator', { active: false, subLabel: 'Waiting' });
            updateNodeStatus('researcher', { active: true, subLabel: 'Researching...' });

            // Activate Edge
            setEdges(edges.map(e => e.id === 'orch-res' ? { ...e, animated: true, style: { ...e.style, stroke: '#fbbf24' } } : e));

            addLog('Task assigned to Researcher', 'info');
            setProgress(30);

            // Step 3: Researcher Working
            await new Promise(r => setTimeout(r, 2000));
            addLog('Researcher found 3 relevant architectural patterns', 'success');

            // Step 4: Handover to Designer
            await new Promise(r => setTimeout(r, 1500));
            updateNodeStatus('researcher', { active: false, subLabel: 'Done' });
            updateNodeStatus('designer', { active: true, subLabel: 'Designing...' });

            // Update Horizontal Edge
            setEdges(edges.map(e => {
                if (e.id === 'orch-res') return { ...e, animated: false, style: { ...e.style, stroke: '#525252' } }; // dim previous
                if (e.id === 'res-des') return { ...e, animated: true, style: { ...e.style, stroke: '#22c55e' }, labelStyle: { fill: '#fff' } }; // activate new
                return e;
            }));

            addLog('Specs passed to Designer', 'info');
            setProgress(60);

            // Step 5: Designer Working
            await new Promise(r => setTimeout(r, 2000));
            addLog('Designer created 2 component blueprints', 'success');

            // Step 6: Handover to Developer
            await new Promise(r => setTimeout(r, 1500));
            updateNodeStatus('designer', { active: false, subLabel: 'Done' });
            updateNodeStatus('developer', { active: true, subLabel: 'Coding...' });

            // Update Edge
            setEdges(edges.map(e => {
                if (e.id === 'res-des') return { ...e, animated: false, style: { ...e.style, stroke: '#22c55e' } };
                if (e.id === 'des-dev') return { ...e, animated: true, style: { ...e.style, stroke: '#fbbf24' }, labelStyle: { fill: '#fff' } };
                return e;
            }));

            addLog('Blueprints sent to Developer', 'info');
            setProgress(80);

            // Step 7: Finish
            await new Promise(r => setTimeout(r, 2000));
            updateNodeStatus('developer', { active: false, subLabel: 'Completed' });
            addLog('Developer implemented components', 'success');
            setProgress(100);

            // Dim last edge
            setEdges(edges.map(e => {
                if (e.id === 'des-dev') return { ...e, animated: false, style: { ...e.style, stroke: '#fbbf24' } };
                return e;
            }));
        };

        runSimulation();
    }, []); // Run once on mount

    return (
        <div className="w-full h-[700px] bg-[#1a1a1a] relative overflow-hidden flex flex-col rounded-xl shadow-2xl ring-1 ring-white/10">
            {/* Header Overlay */}
            <div className="absolute top-6 left-6 z-10 pointer-events-none">
                <h2 className="text-white text-2xl font-bold tracking-tight">AI Agent Workflows</h2>
                <p className="text-neutral-400 text-sm mt-1">Real-time collaboration graph</p>
            </div>

            <ReactFlow
                nodes={nodes}
                edges={edges}
                nodeTypes={nodeTypes}
                fitView
                attributionPosition="bottom-right"
                className="bg-[#1a1a1a]"
            >
                <Background color="#333" gap={24} size={1} />
                <Controls className="!bg-neutral-800 !border-neutral-700 !fill-white [&>button]:!fill-white hover:[&>button]:!bg-neutral-700" />
            </ReactFlow>

            {/* Status Console Overlay (Bottom) */}
            <div className="absolute bottom-0 left-0 right-0 p-6 bg-gradient-to-t from-black via-black/90 to-transparent pt-12">
                <div className="bg-[#111] backdrop-blur-md rounded-xl border border-neutral-800 p-6 shadow-2xl max-w-4xl mx-auto">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-white font-semibold text-lg flex items-center gap-2">
                            Overall Status
                            <span className={`font-mono transition-colors ${overallProgress === 100 ? 'text-green-400' : 'text-yellow-400'}`}>
                                {overallProgress}%
                            </span>
                        </h3>
                        <div className="w-48 h-2 bg-neutral-800 rounded-full overflow-hidden">
                            <div
                                className="h-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)] transition-all duration-500"
                                style={{ width: `${overallProgress}%`, backgroundColor: overallProgress === 100 ? '#4ade80' : '#facc15' }}
                            />
                        </div>
                    </div>

                    <div className="border border-neutral-800 rounded-lg bg-black/50 p-4 font-mono text-sm shadow-inner h-32 overflow-y-auto custom-scrollbar">
                        <h4 className="text-neutral-500 text-xs uppercase tracking-wider mb-2 font-semibold sticky top-0 bg-black/50 backdrop-blur-sm pb-2">Activity Log</h4>
                        <div className="space-y-2 flex flex-col-reverse">
                            {[...logs].reverse().map((log) => (
                                <div key={log.id} className="flex items-start gap-3 animate-slide-in-up">
                                    <span className={`mt-0.5 ${log.type === 'success' ? 'text-green-500' :
                                            log.type === 'error' ? 'text-red-500' :
                                                log.type === 'warning' ? 'text-orange-500' : 'text-blue-400'
                                        }`}>
                                        {log.type === 'success' ? '✓' : '▶'}
                                    </span>
                                    <span className="text-neutral-300">{log.message}</span>
                                    <span className="text-neutral-600 text-xs ml-auto">{new Date(log.timestamp).toLocaleTimeString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Legend */}
                    <div className="mt-4 flex gap-6 text-xs text-neutral-500 font-medium">
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(34,197,94,0.6)]" /> Active Data Flow</div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-yellow-400 shadow-[0_0_8px_rgba(250,204,21,0.6)]" /> Processing Agent</div>
                        <div className="flex items-center gap-2"><div className="w-2 h-2 rounded-full bg-neutral-700" /> Idle / Pending</div>
                    </div>
                </div>
            </div>
        </div>
    );
};
