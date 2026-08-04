"""Drift guard: the herdr role-bootstrap table must match agents/*.md frontmatter.

A Herdr pane agent is a plain CLI session, so it does not inherit an agent
definition's `skills:` preload. fragments/spawn/spawn-herdr.md reconstructs it by
telling the pane agent which meta-skills to invoke. If someone edits `skills:` in
an agent definition and forgets the table, pane agents silently lose their rules,
tool tiers, or return contract. This test fails instead.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

ROOT = Path(__file__).parents[3]
AGENTS_DIR = ROOT / "agents"
FRAGMENT = ROOT / "fragments" / "spawn" / "spawn-herdr.md"

# Roles intentionally absent from the table: they are never dispatched as pane
# agents by any BDK skill.
EXEMPT_ROLES = {"web-researcher"}


def _frontmatter(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    parts = text.split("---\n")
    assert len(parts) >= 3, f"{path.name}: no YAML frontmatter"
    return parts[1]


def _declared_skills(path: Path) -> list[str]:
    """Parse the `skills:` block list from an agent's frontmatter."""
    skills: list[str] = []
    in_block = False
    for line in _frontmatter(path).splitlines():
        if re.match(r"^skills:\s*$", line):
            in_block = True
            continue
        if in_block:
            item = re.match(r"^\s+-\s+(\S+)\s*$", line)
            if item:
                skills.append(item.group(1))
                continue
            if line.strip() and not line.startswith(" "):
                break
    return skills


def _table_rows() -> dict[str, list[str]]:
    """Parse the role-bootstrap table out of the fragment."""
    rows: dict[str, list[str]] = {}
    for line in FRAGMENT.read_text(encoding="utf-8").splitlines():
        match = re.match(r"^\|\s*`([a-z-]+)`\s*\|\s*(.+?)\s*\|$", line)
        if not match:
            continue
        role, cell = match.group(1), match.group(2)
        rows[role] = re.findall(r"`([^`]+)`", cell)
    return rows


def _qualify(skill: str) -> str:
    """Frontmatter name -> the name a pane agent invokes via the Skill tool."""
    return skill if skill.startswith("bdk:") else f"bdk:{skill}"


AGENT_FILES = sorted(AGENTS_DIR.glob("*.md"))


def test_agent_files_found():
    assert AGENT_FILES, "no agent definitions found"


def test_table_parses():
    rows = _table_rows()
    assert rows, "role-bootstrap table not found in spawn-herdr.md"


@pytest.mark.parametrize("agent_file", AGENT_FILES, ids=lambda p: p.stem)
def test_role_bootstrap_matches_agent_skills(agent_file):
    role = agent_file.stem
    declared = _declared_skills(agent_file)
    rows = _table_rows()

    if role in EXEMPT_ROLES:
        assert role not in rows, f"{role} is exempt but present in the table"
        return

    if not declared:
        assert role not in rows, (
            f"{role} declares no skills: but appears in the bootstrap table"
        )
        return

    assert role in rows, (
        f"{role} declares skills: {declared} but has no row in the "
        f"role-bootstrap table of {FRAGMENT.name}"
    )
    assert rows[role] == [_qualify(s) for s in declared], (
        f"{role} bootstrap drift.\n"
        f"  agents/{role}.md skills: {[_qualify(s) for s in declared]}\n"
        f"  fragment table:          {rows[role]}"
    )


def test_table_has_no_unknown_roles():
    known = {p.stem for p in AGENT_FILES}
    unknown = set(_table_rows()) - known
    assert not unknown, f"table rows with no matching agents/*.md: {sorted(unknown)}"
