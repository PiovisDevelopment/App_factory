import os
from pathlib import Path
from typing import List, Dict, Optional

_SKILLS_DIR = Path(__file__).parent.parent.parent.parent / "skills"

def list_skills() -> List[str]:
    """Lists all available skills by scanning the skills directory."""
    skills = []
    if _SKILLS_DIR.exists():
        for item in _SKILLS_DIR.iterdir():
            if item.is_dir() and (item / "SKILL.md").exists():
                skills.append(item.name)
    return skills

def load_skill(skill_name: str) -> str:
    """Loads the content of a specific SKILL.md file."""
    skill_path = _SKILLS_DIR / skill_name / "SKILL.md"
    if skill_path.exists():
        return skill_path.read_text(encoding="utf-8")
    return f"Skill '{skill_name}' not found."
