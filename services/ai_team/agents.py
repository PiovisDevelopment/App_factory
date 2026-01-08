import os

from pydantic_ai import Agent
from pydantic_ai.models.gemini import GeminiModel

# Import Config
from services.ai_team.config import get_mcp_config_path, load_agent_config

# Import Tools
from services.ai_team.tools.brave_search import search_web
from services.ai_team.tools.skills_loader import list_skills, load_skill

# --- Factory Functions to Create Agents with Loaded Config ---


def create_research_agent() -> Agent:
    config = load_agent_config("researcher")
    # For now, defaulting to GeminiModel, but could switch based on provider str
    model = GeminiModel(config.model, api_key=os.getenv("GEMINI_API_KEY"))

    agent = Agent(model, system_prompt=config.system_prompt, deps_type=None, retries=2)
    # Register Tools
    agent.tool(search_web)
    return agent


def create_designer_agent() -> Agent:
    config = load_agent_config("designer")
    model = GeminiModel(config.model, api_key=os.getenv("GEMINI_API_KEY"))

    agent = Agent(model, system_prompt=config.system_prompt)
    return agent


def create_developer_agent() -> Agent:
    config = load_agent_config("developer")
    model = GeminiModel(config.model, api_key=os.getenv("GEMINI_API_KEY"))

    # Load MCP Config for Context7
    mcp_config_path = get_mcp_config_path()
    toolsets = []

    if mcp_config_path.exists():
        try:
            import json

            from pydantic_ai.mcp import MCPServerStdio

            with open(mcp_config_path) as f:
                data = json.load(f)

            c7_config = data.get("mcpServers", {}).get("context-7")
            if c7_config:
                # Create the MCP Server Toolset
                # Pattern: https://martinfowler.com/articles/build-own-coding-agent.html
                context7 = MCPServerStdio(
                    command=c7_config["command"], args=c7_config["args"], env=c7_config.get("env")
                )
                toolsets.append(context7)
        except Exception as e:
            print(f"Warning: Failed to load Context7 MCP: {e}")

    agent = Agent(model, system_prompt=config.system_prompt, toolsets=toolsets)
    return agent


def create_qa_agent() -> Agent:
    config = load_agent_config("qa")
    model = GeminiModel(config.model, api_key=os.getenv("GEMINI_API_KEY"))

    agent = Agent(model, system_prompt=config.system_prompt)
    # Register Tools
    agent.tool(list_skills)
    agent.tool(load_skill)
    return agent
