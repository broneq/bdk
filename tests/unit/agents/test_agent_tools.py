"""Regression tests for agent `tools:` allowlists.

Narrow agents stay narrow: agents with tightly scoped tool sets
(test-runner, static-analyse, web-researcher, log-analyzer, fixer,
implementer) keep their declared sets. Adding a tool to one of these
requires updating the spec inline. MCP tool names in any agent are
rejected by `tests/unit/test_no_mcp_names.py`.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
AGENTS_DIR = REPO_ROOT / "agents"


def _extract_frontmatter(path: Path) -> str:
    text = path.read_text(encoding="utf-8")
    match = re.match(r"^---\n(.*?)\n---", text, flags=re.DOTALL)
    if not match:
        raise AssertionError(f"{path}: no frontmatter delimited by --- markers")
    return match.group(1)


def _parse_tools_field(frontmatter: str) -> set[str] | str | None:
    """Return tools as set, the raw string if scalar, or None if absent.

    Hand-rolled parser keeps the test dependency-free. Handles:
      - `tools: Bash` (scalar)
      - `tools: WebSearch WebFetch Read` (space-separated scalar)
      - YAML list with `- entry` lines below `tools:`
    """
    lines = frontmatter.splitlines()
    for i, line in enumerate(lines):
        if not line.startswith("tools:"):
            continue
        rest = line[len("tools:"):].strip()
        if rest:
            tokens = [t.strip() for t in re.split(r"[\s,]+", rest) if t.strip()]
            if len(tokens) == 1:
                return tokens[0]
            return set(tokens)
        items: set[str] = set()
        for next_line in lines[i + 1:]:
            stripped = next_line.lstrip()
            if not stripped:
                continue
            if not next_line.startswith((" ", "\t", "-")) and ":" in next_line:
                break
            if stripped.startswith("- "):
                items.add(stripped[2:].strip())
                continue
            if not next_line.startswith((" ", "\t")):
                break
        return items
    return None


def _tools(path: Path) -> set[str] | str | None:
    return _parse_tools_field(_extract_frontmatter(path))


def _expect_tool_set(path: Path) -> set[str]:
    result = _tools(path)
    assert isinstance(result, set), (
        f"{path.name}: expected list-form tools, got {type(result).__name__}"
    )
    return result


# ---------------------------------------------------------------------------
# Narrow-agent regression guard (Task 9)
# ---------------------------------------------------------------------------

NARROW_AGENT_TOOLS: dict[str, set[str] | str] = {
    "test-runner": "Bash",
    "static-analyse": "ALL",
    "web-researcher": {"WebSearch", "WebFetch", "Read", "Grep", "Glob"},
    "log-analyzer": {
        "Read",
        "Grep",
        "Glob",
    },
    "fixer": {
        "Read",
        "Edit",
        "Write",
        "Bash",
        "Grep",
        "Glob",
    },
    "implementer": {
        "Read",
        "Edit",
        "Write",
        "Bash",
        "Grep",
        "Glob",
    },
}


def test_narrow_agent_spec_covers_only_existing_agents() -> None:
    """Guard against the spec drifting to reference deleted agents."""
    missing = [n for n in NARROW_AGENT_TOOLS if not (AGENTS_DIR / f"{n}.md").exists()]
    assert not missing, f"NARROW_AGENT_TOOLS names agents that no longer exist: {missing}"


@pytest.mark.parametrize("name,expected", sorted(NARROW_AGENT_TOOLS.items()))
def test_narrow_agent_tools_unchanged(name: str, expected) -> None:
    actual = _tools(AGENTS_DIR / f"{name}.md")
    if expected == "ALL":
        assert actual is None, (
            f"{name}: expected no tools field (all tools), got {actual!r}"
        )
        return
    if isinstance(expected, str):
        assert actual == expected, (
            f"{name}: expected scalar tools={expected!r}, got {actual!r}"
        )
        return
    assert isinstance(actual, set), (
        f"{name}: expected list-form tools, got {type(actual).__name__}"
    )
    assert actual == expected, (
        f"{name}: tools changed from spec — update NARROW_AGENT_TOOLS "
        f"intentionally if needed.\n  added: {actual - expected}\n  "
        f"removed: {expected - actual}"
    )
