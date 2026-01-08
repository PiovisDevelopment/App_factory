import json
from pathlib import Path

from pydantic import BaseModel


class AgentConfig(BaseModel):
    provider: str
    model: str
    temperature: float
    system_prompt: str

class TeamConfig(BaseModel):
    orchestrator: AgentConfig
    researcher: AgentConfig
    designer: AgentConfig
    developer: AgentConfig
    qa: AgentConfig

_CONFIG_PATH = Path(__file__).parent.parent.parent / "config" / "agents_config.json"

def load_agent_config(agent_name: str) -> AgentConfig:
    """Loads configuration for a specific agent from the JSON file."""
    if not _CONFIG_PATH.exists():
        raise FileNotFoundError(f"Agent config file not found at {_CONFIG_PATH}")

    with open(_CONFIG_PATH, encoding="utf-8") as f:
        data = json.load(f)

    # Simple validation using Pydantic
    team_config = TeamConfig(**data)

    return getattr(team_config, agent_name)

def get_mcp_config_path() -> Path:
    return _CONFIG_PATH.parent / "mcp_config.json"
