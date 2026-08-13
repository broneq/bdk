"""Regression tests for agent `tools:` allowlists.

Two contracts are guarded:

1. **Targeted gap-fill** — discovery agents that need the diagnostic
   graph tools must list them in their `tools:` allowlist using the
   plugin-namespaced form (`mcp__plugin_bdk_code-review-graph__*`,
   per `mcp-tool-naming.md`).
2. **Narrow agents stay narrow** - agents with tightly scoped tool sets
   (test-runner, static-analyse, web-researcher, log-analyzer, fixer,
   implementer) keep their declared sets. Adding a tool to one of these
   requires updating the spec inline.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
AGENTS_DIR = REPO_ROOT / "agents"
CRG_PREFIX = "mcp__plugin_bdk_code-review-graph__"


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
# Task 7 — explorer agent gap-fill
# ---------------------------------------------------------------------------


def test_explorer_has_diagnostic_graph_tools() -> None:
    tools = _expect_tool_set(AGENTS_DIR / "explorer.md")
    expected = {
        f"{CRG_PREFIX}list_graph_stats_tool",
        f"{CRG_PREFIX}list_flows_tool",
        f"{CRG_PREFIX}get_flow_tool",
        f"{CRG_PREFIX}get_knowledge_gaps_tool",
        f"{CRG_PREFIX}find_large_functions_tool",
    }
    missing = expected - tools
    assert not missing, f"explorer.md missing diagnostic graph tools: {missing}"


# ---------------------------------------------------------------------------
# Task 8 — code-reviewer + architecture-reviewer gap-fill
# ---------------------------------------------------------------------------


def test_code_reviewer_has_gap_and_flow_tools() -> None:
    tools = _expect_tool_set(AGENTS_DIR / "code-reviewer.md")
    for tool in ("get_knowledge_gaps_tool", "list_flows_tool"):
        assert f"{CRG_PREFIX}{tool}" in tools, (
            f"code-reviewer.md missing {CRG_PREFIX}{tool}"
        )


def test_architecture_reviewer_has_diagnostic_tools() -> None:
    tools = _expect_tool_set(AGENTS_DIR / "architecture-reviewer.md")
    for tool in ("list_graph_stats_tool", "list_flows_tool", "get_flow_tool"):
        assert f"{CRG_PREFIX}{tool}" in tools, (
            f"architecture-reviewer.md missing {CRG_PREFIX}{tool}"
        )


# ---------------------------------------------------------------------------
# Task 9 — specialist agent gap-fill
# ---------------------------------------------------------------------------


def test_dead_code_detector_has_specialist_tools() -> None:
    tools = _expect_tool_set(AGENTS_DIR / "dead-code-detector.md")
    for tool in ("find_large_functions_tool", "list_flows_tool"):
        assert f"{CRG_PREFIX}{tool}" in tools, (
            f"dead-code-detector.md missing {CRG_PREFIX}{tool}"
        )


def test_duplicate_detector_has_large_function_tool() -> None:
    tools = _expect_tool_set(AGENTS_DIR / "duplicate-detector.md")
    expected = f"{CRG_PREFIX}find_large_functions_tool"
    assert expected in tools, f"duplicate-detector.md missing {expected}"


# ---------------------------------------------------------------------------
# Convention — every CRG tool entry uses the plugin_bdk_ prefix
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    "agent_name",
    sorted(p.name for p in AGENTS_DIR.glob("*.md")),
)
def test_every_crg_tool_uses_plugin_prefix(agent_name: str) -> None:
    tools = _tools(AGENTS_DIR / agent_name)
    if not isinstance(tools, set):
        return
    for entry in tools:
        if "code-review-graph" in entry and not entry.startswith(CRG_PREFIX):
            raise AssertionError(
                f"{agent_name}: tool {entry!r} references code-review-graph "
                f"without the {CRG_PREFIX} prefix (mcp-tool-naming.md)"
            )


def test_synthetic_agent_missing_prefix_fails(tmp_path: Path) -> None:
    bad = tmp_path / "bad-agent.md"
    bad.write_text(
        "---\n"
        "name: bad\n"
        "tools:\n"
        "  - mcp__code-review-graph__query_graph_tool\n"
        "---\n"
    )
    tools = _tools(bad)
    assert isinstance(tools, set)
    with pytest.raises(AssertionError, match="without the .* prefix"):
        for entry in tools:
            if "code-review-graph" in entry and not entry.startswith(CRG_PREFIX):
                raise AssertionError(
                    f"tool {entry!r} references code-review-graph "
                    f"without the {CRG_PREFIX} prefix"
                )


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
        "mcp__plugin_bdk_serena__list_dir",
        "mcp__plugin_bdk_serena__find_file",
        "mcp__plugin_bdk_serena__search_for_pattern",
        "mcp__plugin_bdk_serena__get_symbols_overview",
        "mcp__plugin_bdk_serena__find_symbol",
        "mcp__plugin_bdk_serena__find_referencing_symbols",
        "mcp__plugin_bdk_code-review-graph__semantic_search_nodes_tool",
        "mcp__plugin_bdk_code-review-graph__query_graph_tool",
        "mcp__plugin_bdk_code-review-graph__traverse_graph_tool",
        "mcp__plugin_bdk_code-review-graph__list_graph_stats_tool",
    },
    "fixer": {
        "Read",
        "Edit",
        "Write",
        "Bash",
        "Grep",
        "Glob",
        "mcp__plugin_bdk_serena__list_dir",
        "mcp__plugin_bdk_serena__find_file",
        "mcp__plugin_bdk_serena__search_for_pattern",
        "mcp__plugin_bdk_serena__get_symbols_overview",
        "mcp__plugin_bdk_serena__find_symbol",
        "mcp__plugin_bdk_serena__find_referencing_symbols",
        "mcp__plugin_bdk_serena__replace_symbol_body",
        "mcp__plugin_bdk_serena__insert_before_symbol",
        "mcp__plugin_bdk_serena__insert_after_symbol",
        "mcp__plugin_bdk_code-review-graph__detect_changes_tool",
        "mcp__plugin_bdk_code-review-graph__query_graph_tool",
        "mcp__plugin_bdk_code-review-graph__semantic_search_nodes_tool",
        "mcp__plugin_bdk_code-review-graph__traverse_graph_tool",
        "mcp__plugin_bdk_code-review-graph__list_graph_stats_tool",
        "mcp__plugin_bdk_code-review-graph__get_impact_radius_tool",
        "mcp__plugin_bdk_code-review-graph__get_affected_flows_tool",
        "mcp__plugin_bdk_code-review-graph__get_bridge_nodes_tool",
        "mcp__plugin_bdk_code-review-graph__list_flows_tool",
        "mcp__plugin_bdk_code-review-graph__get_flow_tool",
    },
    "implementer": {
        "Read",
        "Edit",
        "Write",
        "Bash",
        "Grep",
        "Glob",
        "mcp__plugin_bdk_serena__list_dir",
        "mcp__plugin_bdk_serena__find_file",
        "mcp__plugin_bdk_serena__search_for_pattern",
        "mcp__plugin_bdk_serena__get_symbols_overview",
        "mcp__plugin_bdk_serena__find_symbol",
        "mcp__plugin_bdk_serena__find_referencing_symbols",
        "mcp__plugin_bdk_serena__replace_symbol_body",
        "mcp__plugin_bdk_serena__insert_after_symbol",
        "mcp__plugin_bdk_serena__insert_before_symbol",
        "mcp__plugin_bdk_code-review-graph__detect_changes_tool",
        "mcp__plugin_bdk_code-review-graph__query_graph_tool",
        "mcp__plugin_bdk_code-review-graph__semantic_search_nodes_tool",
        "mcp__plugin_bdk_code-review-graph__traverse_graph_tool",
        "mcp__plugin_bdk_code-review-graph__list_graph_stats_tool",
        "mcp__plugin_bdk_code-review-graph__get_impact_radius_tool",
        "mcp__plugin_bdk_code-review-graph__get_affected_flows_tool",
        "mcp__plugin_bdk_code-review-graph__get_bridge_nodes_tool",
        "mcp__plugin_bdk_code-review-graph__list_flows_tool",
        "mcp__plugin_bdk_code-review-graph__get_flow_tool",
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
