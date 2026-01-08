import { create } from 'zustand';
import { Node, Edge, MarkerType } from 'reactflow';

// ============================================
// TYPE DEFINITIONS
// ============================================

export interface AgentLog {
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    timestamp: number;
}

export interface AgentToolConfig {
    id: string;       // 'brave_search' | 'mcp_context7' | etc.
    name: string;
    enabled: boolean;
}

export interface AgentConfiguration {
    id: string;           // 'orchestrator' | 'researcher' | 'designer' | 'developer' | 'qa'
    name: string;
    provider: string;
    model: string;
    temperature: number;
    systemPrompt: string;
    tools: AgentToolConfig[];
    enabled: boolean;
}

export interface WorkflowProfile {
    id: string;           // 'fe' | 'be' | 'fullstack' | 'research' | 'debug' | 'test'
    name: string;
    agents: Record<string, boolean>;  // agent_id -> enabled
}

export type WorkflowProfileId = 'fe' | 'be' | 'fullstack' | 'research' | 'debug' | 'test';

// ============================================
// DEFAULT CONFIGURATIONS
// ============================================

const DEFAULT_AGENT_TOOLS: Record<string, AgentToolConfig[]> = {
    orchestrator: [],
    researcher: [
        { id: 'brave_search', name: 'Brave Search', enabled: true },
    ],
    designer: [],
    developer: [
        { id: 'mcp_context7', name: 'MCP Context7', enabled: true },
    ],
    qa: [
        { id: 'skills_loader', name: 'Skills Loader', enabled: true },
    ],
};

const DEFAULT_AGENT_CONFIGS: AgentConfiguration[] = [
    {
        id: 'orchestrator',
        name: 'Orchestrator',
        provider: 'gemini',
        model: 'gemini-2.0-flash-exp',
        temperature: 0.0,
        systemPrompt: 'You are the Orchestrator. Your job is to break down the user request into a clear plan and coordinate the specialized agents.',
        tools: DEFAULT_AGENT_TOOLS.orchestrator ?? [],
        enabled: true,
    },
    {
        id: 'researcher',
        name: 'Researcher',
        provider: 'gemini',
        model: 'gemini-2.0-flash-exp',
        temperature: 0.2,
        systemPrompt: 'You are the Research Agent. You are an expert in finding implementation patterns.',
        tools: DEFAULT_AGENT_TOOLS.researcher ?? [],
        enabled: true,
    },
    {
        id: 'designer',
        name: 'Designer',
        provider: 'gemini',
        model: 'gemini-2.0-flash-exp',
        temperature: 0.4,
        systemPrompt: 'You are the Designer Agent. You create architectural blueprints and design documents.',
        tools: DEFAULT_AGENT_TOOLS.designer ?? [],
        enabled: true,
    },
    {
        id: 'developer',
        name: 'Developer',
        provider: 'gemini',
        model: 'gemini-2.0-flash-exp',
        temperature: 0.1,
        systemPrompt: 'You are the Developer Agent. You write code based on design blueprints.',
        tools: DEFAULT_AGENT_TOOLS.developer ?? [],
        enabled: true,
    },
    {
        id: 'qa',
        name: 'QA',
        provider: 'gemini',
        model: 'gemini-2.0-flash-exp',
        temperature: 0.1,
        systemPrompt: 'You are the QA Agent. You validate the code and designs against the requirements.',
        tools: DEFAULT_AGENT_TOOLS.qa ?? [],
        enabled: true,
    },
];

const DEFAULT_WORKFLOW_PROFILES: WorkflowProfile[] = [
    {
        id: 'fe',
        name: 'Frontend Only',
        agents: { orchestrator: true, researcher: true, designer: true, developer: false, qa: false },
    },
    {
        id: 'be',
        name: 'Backend Only',
        agents: { orchestrator: true, researcher: true, designer: false, developer: true, qa: true },
    },
    {
        id: 'fullstack',
        name: 'Full Stack',
        agents: { orchestrator: true, researcher: true, designer: true, developer: true, qa: true },
    },
    {
        id: 'research',
        name: 'Pre-project Research',
        agents: { orchestrator: true, researcher: true, designer: false, developer: false, qa: false },
    },
    {
        id: 'debug',
        name: 'Debug',
        agents: { orchestrator: true, researcher: true, designer: false, developer: true, qa: true },
    },
    {
        id: 'test',
        name: 'Test',
        agents: { orchestrator: true, researcher: false, designer: false, developer: false, qa: true },
    },
];

// ============================================
// REACTFLOW NODE/EDGE DEFAULTS
// ============================================

const createInitialNodes = (agentConfigs: AgentConfiguration[]): Node[] => [
    {
        id: 'orchestrator',
        type: 'agent',
        position: { x: 400, y: 50 },
        data: {
            label: 'Orchestrator',
            active: false,
            enabled: agentConfigs.find(a => a.id === 'orchestrator')?.enabled ?? true,
        },
    },
    {
        id: 'researcher',
        type: 'agent',
        position: { x: 100, y: 200 },
        data: {
            label: 'Researcher',
            active: false,
            subLabel: 'Idle',
            enabled: agentConfigs.find(a => a.id === 'researcher')?.enabled ?? true,
        },
    },
    {
        id: 'designer',
        type: 'agent',
        position: { x: 300, y: 350 },
        data: {
            label: 'Designer',
            active: false,
            subLabel: 'Idle',
            enabled: agentConfigs.find(a => a.id === 'designer')?.enabled ?? true,
        },
    },
    {
        id: 'developer',
        type: 'agent',
        position: { x: 500, y: 350 },
        data: {
            label: 'Developer',
            active: false,
            subLabel: 'Idle',
            enabled: agentConfigs.find(a => a.id === 'developer')?.enabled ?? true,
        },
    },
    {
        id: 'qa',
        type: 'agent',
        position: { x: 700, y: 200 },
        data: {
            label: 'QA',
            active: false,
            subLabel: 'Idle',
            enabled: agentConfigs.find(a => a.id === 'qa')?.enabled ?? true,
        },
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
    {
        id: 'orch-qa',
        source: 'orchestrator',
        target: 'qa',
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
    {
        id: 'dev-qa',
        source: 'developer',
        sourceHandle: 'r',
        target: 'qa',
        targetHandle: 'l',
        label: 'Code',
        labelStyle: { fill: '#666', fontWeight: 500 },
        labelBgStyle: { fill: '#1a1a1a', fillOpacity: 0.8 },
        style: { stroke: '#525252', strokeWidth: 2, strokeDasharray: '5,5' },
        markerEnd: { type: MarkerType.ArrowClosed, color: '#525252' },
    },
];

// ============================================
// STORE STATE INTERFACE
// ============================================

export interface AiTeamState {
    // ReactFlow visualization
    nodes: Node[];
    edges: Edge[];

    // Activity logging
    logs: AgentLog[];
    overallProgress: number;

    // Agent configuration
    agentConfigs: AgentConfiguration[];

    // Workflow profiles
    workflowProfiles: WorkflowProfile[];
    selectedProfileId: WorkflowProfileId;

    // Workflow execution state
    isWorkflowRunning: boolean;

    // Actions - Visualization
    setNodes: (nodes: Node[]) => void;
    setEdges: (edges: Edge[]) => void;
    updateNodeStatus: (nodeId: string, status: { active?: boolean; subLabel?: string }) => void;

    // Actions - Logging
    addLog: (message: string, type?: AgentLog['type']) => void;
    clearLogs: () => void;
    setProgress: (progress: number) => void;

    // Actions - Agent configuration
    updateAgentConfig: (agentId: string, config: Partial<AgentConfiguration>) => void;
    toggleAgent: (agentId: string, enabled: boolean) => void;
    toggleAgentTool: (agentId: string, toolId: string, enabled: boolean) => void;

    // Actions - Workflow profiles
    setSelectedProfile: (profileId: WorkflowProfileId) => void;
    applyProfile: (profileId: WorkflowProfileId) => void;
    updateProfile: (profileId: string, agents: Record<string, boolean>) => void;

    // Actions - Workflow execution
    setWorkflowRunning: (running: boolean) => void;

    // Actions - Reset
    resetSimulation: () => void;
}

// ============================================
// STORE IMPLEMENTATION
// ============================================

export const useAiTeamStore = create<AiTeamState>((set, get) => ({
    nodes: createInitialNodes(DEFAULT_AGENT_CONFIGS),
    edges: initialEdges,
    logs: [],
    overallProgress: 0,
    agentConfigs: DEFAULT_AGENT_CONFIGS,
    workflowProfiles: DEFAULT_WORKFLOW_PROFILES,
    selectedProfileId: 'fullstack',
    isWorkflowRunning: false,

    // Visualization actions
    setNodes: (nodes) => set({ nodes }),
    setEdges: (edges) => set({ edges }),

    updateNodeStatus: (nodeId, status) => set((state) => ({
        nodes: state.nodes.map((node) =>
            node.id === nodeId
                ? { ...node, data: { ...node.data, ...status } }
                : node
        ),
    })),

    // Logging actions
    addLog: (message, type = 'info') => set((state) => ({
        logs: [...state.logs, {
            id: Date.now().toString(),
            message,
            type,
            timestamp: Date.now()
        }].slice(-50) // Keep last 50 logs for real-time streaming
    })),

    clearLogs: () => set({ logs: [] }),

    setProgress: (progress) => set({ overallProgress: progress }),

    // Agent configuration actions
    updateAgentConfig: (agentId, config) => set((state) => ({
        agentConfigs: state.agentConfigs.map((agent) =>
            agent.id === agentId
                ? { ...agent, ...config }
                : agent
        ),
    })),

    toggleAgent: (agentId, enabled) => {
        set((state) => ({
            agentConfigs: state.agentConfigs.map((agent) =>
                agent.id === agentId
                    ? { ...agent, enabled }
                    : agent
            ),
            // Also update the ReactFlow node
            nodes: state.nodes.map((node) =>
                node.id === agentId
                    ? { ...node, data: { ...node.data, enabled } }
                    : node
            ),
        }));
    },

    toggleAgentTool: (agentId, toolId, enabled) => set((state) => ({
        agentConfigs: state.agentConfigs.map((agent) =>
            agent.id === agentId
                ? {
                    ...agent,
                    tools: agent.tools.map((tool) =>
                        tool.id === toolId
                            ? { ...tool, enabled }
                            : tool
                    ),
                }
                : agent
        ),
    })),

    // Workflow profile actions
    setSelectedProfile: (profileId) => set({ selectedProfileId: profileId }),

    applyProfile: (profileId) => {
        const state = get();
        const profile = state.workflowProfiles.find((p) => p.id === profileId);
        if (!profile) return;

        // Update agent enabled states based on profile
        const updatedAgentConfigs = state.agentConfigs.map((agent) => ({
            ...agent,
            enabled: profile.agents[agent.id] ?? true,
        }));

        // Update nodes with enabled state
        const updatedNodes = state.nodes.map((node) => ({
            ...node,
            data: {
                ...node.data,
                enabled: profile.agents[node.id] ?? true,
            },
        }));

        set({
            selectedProfileId: profileId,
            agentConfigs: updatedAgentConfigs,
            nodes: updatedNodes,
        });
    },

    updateProfile: (profileId, agents) => set((state) => ({
        workflowProfiles: state.workflowProfiles.map((profile) =>
            profile.id === profileId
                ? { ...profile, agents }
                : profile
        ),
    })),

    // Workflow execution actions
    setWorkflowRunning: (running) => set({ isWorkflowRunning: running }),

    // Reset
    resetSimulation: () => {
        const state = get();
        set({
            nodes: createInitialNodes(state.agentConfigs),
            edges: initialEdges,
            logs: [],
            overallProgress: 0,
            isWorkflowRunning: false,
        });
    },
}));
