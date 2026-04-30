#!/usr/bin/env python3
"""UserPromptSubmit hook: verify a named skill is installed.

Usage: check.py <skill-name>

Searches for skill files in:
  - ~/.claude/skills/
  - .claude/skills/  (project-local)
  - ~/.claude/plugins/marketplaces/*/skills/  (installed plugins)

Matches by frontmatter `name:` field. Warns via stderr when skill is
missing. Exits silently when skill is found.

Runs on every turn (no once-per-session deduplication).
"""

from __future__ import annotations

import sys
from pathlib import Path


def _search_dirs() -> list[Path]:
    dirs = [
        Path.home() / ".claude" / "skills",
        Path(".claude") / "skills",
    ]
    marketplaces = Path.home() / ".claude" / "plugins" / "marketplaces"
    if marketplaces.is_dir():
        for marketplace in marketplaces.iterdir():
            skills_dir = marketplace / "skills"
            if skills_dir.is_dir():
                dirs.append(skills_dir)
    return dirs


def extract_name_from_frontmatter(skill_file: Path) -> str | None:
    """Return value of `name:` from YAML frontmatter, or None if absent."""
    try:
        text = skill_file.read_text(encoding="utf-8")
    except OSError:
        return None

    lines = text.splitlines()
    if not lines or lines[0].strip() != "---":
        return None

    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line.startswith("name:"):
            return line.removeprefix("name:").strip().strip("\"'")

    return None


def skill_installed(skill_name: str) -> bool:
    """Return True if any skill file in search dirs has name: <skill_name>."""
    for skills_dir in _search_dirs():
        if not skills_dir.is_dir():
            continue
        for skill_file in skills_dir.rglob("*"):
            if skill_file.is_file() and extract_name_from_frontmatter(skill_file) == skill_name:
                return True
    return False


def main() -> None:
    if len(sys.argv) < 2:
        sys.exit(0)

    skill_name = sys.argv[1]

    if not skill_installed(skill_name):
        print(
            f"[BDK] Skill '{skill_name}' not installed. "
            f"Install it for full functionality. "
            f"Expected location: ~/.claude/skills/ or .claude/skills/",
            file=sys.stderr,
        )
        sys.exit(2)

    sys.exit(0)


if __name__ == "__main__":
    main()
