import { create } from 'zustand';
import { Node, Edge, MarkerType } from 'reactflow';

export interface AgentLog {
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: number;
}

export interface AiTeamState {
    nodes: Node[];
    edges: Edge[];
    logs: AgentLog[];
    overallProgress: number;

    // Actions
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    updateNodeStatus: (nodeId: string, status: { active?: boolean; subLabel?: string }) => void;
    addLog: (message: string, type?: AgentLog['type']) => void;
    setProgress: (progress: number) => void;
    resetSimulation: () => void;
}

const initialNodes: Node[] = [
    {
        id: 'orchestrator',
        type: 'agent',
        position: { x: 400, y: 50 },
        data: { label: 'Orchestrator', active: false },
    },
    {
        id: 'researcher',
        type: 'agent',
        position: { x: 100, y: 350 },
        data: { label: 'Researcher', active: false, subLabel: 'Idle' },
    },
    {
        id: 'designer',
        type: 'agent',
        position: { x: 400, y: 350 },
        data: { label: 'Designer', active: false, subLabel: 'Idle' },
    },
    {
        id: 'developer',
        type: 'agent',
        position: { x: 700, y: 350 },
        data: { label: 'Developer', active: false, subLabel: 'Idle' },
    },
];

const initialEdges: Edge[] = [
    // Orchestrator Down to Agents
    {
        id: 'orch-res',
        source: 'orchestrator',
        target: 'researcher',
        animated: false,
        style: { stroke: '#525252', strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#525252' },
    },
    {
        id: 'orch-des',
        source: 'orchestrator',
        target: 'designer',
        animated: false,
        style: { stroke: '#525252', strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#525252' },
    },
    {
        id: 'orch-dev',
        source: 'orchestrator',
        target: 'developer',
        animated: false,
        style: { stroke: '#525252', strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#525252' },
    },
    // Horizontal Flow
    {
        id: 'res-des',
        source: 'researcher',
        sourceHandle: 'r',
        target: 'designer',
        targetHandle: 'l',
        animated: false,
        label: 'Specs',
        labelStyle: { fill: '#666', fontWeight: 500 },
        labelBgStyle: { fill: '#1a1a1a', fillOpacity: 0.8 },
        style: { stroke: '#525252', strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#525252' },
    },
    {
        id: 'des-dev',
        source: 'designer',
        sourceHandle: 'r',
        target: 'developer',
        targetHandle: 'l',
        label: 'Blueprints',
        labelStyle: { fill: '#666', fontWeight: 500 },
        labelBgStyle: { fill: '#1a1a1a', fillOpacity: 0.8 },
        style: { stroke: '#525252', strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#525252' },
    },
];

export const useAiTeamStore = create<AiTeamState>((set) => ({
    nodes: initialNodes,
    edges: initialEdges,
    logs: [],
    overallProgress: 0,

    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

    updateNodeStatus: (nodeId, status) => set((state) => ({
        nodes: state.nodes.map((node) =>
            node.id === nodeId
                ? { ...node, data: { ...node.data, ...status } }
                : node
        ),
    })),

    addLog: (message, type = 'info') => set((state) => ({
        logs: [...state.logs, { id: Date.now().toString(), message, type, timestamp: Date.now() }].slice(-10) // Keep last 10
    })),

    setProgress: (progress) => set({ overallProgress: progress }),

    resetSimulation: () => set({
        nodes: initialNodes,
        edges: initialEdges,
        logs: [],
        overallProgress: 0
    }),
}));
