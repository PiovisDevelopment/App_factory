from __future__ import annotations

import asyncio
from dataclasses import dataclass, field

from pydantic_graph import BaseNode, End, Graph, GraphRunContext

from services.ai_team.agents import (
    create_designer_agent,
    create_developer_agent,
    create_qa_agent,
    create_research_agent,
)


# --- State Definition ---
@dataclass
class AgentState:
    user_prompt: str
    research_results: list[str] = field(default_factory=list)
    design_blueprint: str | None = None
    generated_code: str | None = None
    qa_report: str | None = None
    history: list[str] = field(default_factory=list)


# --- Node Definitions ---


@dataclass
class ResearchNode(BaseNode[AgentState]):
    """Step 1: Research the user request."""

    async def run(self, ctx: GraphRunContext[AgentState]) -> DesignNode:
        print(f"--- [Research Node] Starting for: {ctx.state.user_prompt} ---")
        agent = create_research_agent()

        # In a real app, we might feed previous history or more context
        result = await agent.run(f"Research implementation details for: {ctx.state.user_prompt}")

        ctx.state.research_results.append(result.data)
        ctx.state.history.append(f"Research: {result.data}")
        print("--- [Research Node] Completed ---")

        return DesignNode()


@dataclass
class DesignNode(BaseNode[AgentState]):
    """Step 2: Create a blueprint based on research."""

    async def run(self, ctx: GraphRunContext[AgentState]) -> DeveloperNode:
        print("--- [Design Node] Starting ---")
        agent = create_designer_agent()

        research_context = "\n".join(ctx.state.research_results)
        prompt = f"Create a design blueprint for '{ctx.state.user_prompt}' based on these findings:\n{research_context}"

        result = await agent.run(prompt)
        ctx.state.design_blueprint = result.data
        ctx.state.history.append(f"Design: {result.data}")
        print("--- [Design Node] Completed ---")

        return DeveloperNode()


@dataclass
class DeveloperNode(BaseNode[AgentState]):
    """Step 3: Write code based on the blueprint."""

    async def run(self, ctx: GraphRunContext[AgentState]) -> QANode:
        print("--- [Developer Node] Starting ---")
        agent = await create_developer_agent()  # async factory for MCP

        blueprint = ctx.state.design_blueprint
        prompt = f"Write the code for this design:\n{blueprint}"

        result = await agent.run(prompt)
        ctx.state.generated_code = result.data
        ctx.state.history.append(f"Dev: {result.data}")
        print("--- [Developer Node] Completed ---")

        return QANode()


@dataclass
class QANode(BaseNode[AgentState]):
    """Step 4: Verify the code using skills."""

    async def run(self, ctx: GraphRunContext[AgentState]) -> End[AgentState]:
        print("--- [QA Node] Starting ---")
        agent = create_qa_agent()

        code = ctx.state.generated_code
        prompt = f"Verify this code against available skills:\n{code}"

        result = await agent.run(prompt)
        ctx.state.qa_report = result.data
        ctx.state.history.append(f"QA: {result.data}")
        print("--- [QA Node] Completed ---")

        return End(ctx.state)


# --- Graph Definition ---
workflow_graph = Graph(nodes=[ResearchNode, DesignNode, DeveloperNode, QANode], state_type=AgentState)


# --- Public API Hook ---
async def run_workflow_api(user_prompt: str) -> AgentState:
    """
    Entry point for external apps (like the Chat UI).
    Runs the full Reseach -> QA lifecycle.
    """
    initial_state = AgentState(user_prompt=user_prompt)

    # We start at ResearchNode
    final_state = await workflow_graph.run(ResearchNode(), state=initial_state)
    return final_state


# --- CLI Entry Point ---
if __name__ == "__main__":

    async def main():
        prompt = "Create a Pydantic model for a User Profile"
        print(f"Starting workflow for: {prompt}")
        final_state = await run_workflow_api(prompt)
        print("\n\n=== FINAL OUTPUT ===")
        print(f"Code:\n{final_state.generated_code}")
        print(f"QA Report:\n{final_state.qa_report}")

    asyncio.run(main())
