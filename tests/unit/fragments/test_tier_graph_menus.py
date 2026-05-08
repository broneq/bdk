"""Regression tests for tier-graph menu fragments.

Menu fragments name the tools available at each tier. They are
user-facing prose injected via chains — NOT allowlist syntax. So they
must use the unprefixed tool form. The plugin-namespaced
(`mcp__plugin_bdk_*`) form belongs only in `tools:` lists and
`allowed-tools:` frontmatter (`mcp-tool-naming.md:43-47`).
"""

from __future__ import annotations

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
MENU_DIR = REPO_ROOT / "fragments/tool-tiers"


def _read(name: str) -> str:
    return (MENU_DIR / name).read_text(encoding="utf-8")


def test_explore_graph_lists_diagnostic_tools() -> None:
    body = _read("explore-graph.md")
    expected = [
        "list_graph_stats_tool",
        "list_communities_tool",
        "list_flows_tool",
        "get_knowledge_gaps_tool",
        "get_flow_tool",
        "find_large_functions_tool",
    ]
    missing = [t for t in expected if t not in body]
    assert not missing, f"explore-graph.md missing diagnostic tools: {missing}"


def test_search_graph_lists_diagnostic_tools() -> None:
    body = _read("search-graph.md")
    expected = ["list_graph_stats_tool", "traverse_graph_tool"]
    missing = [t for t in expected if t not in body]
    assert not missing, f"search-graph.md missing diagnostic tools: {missing}"


def test_impact_graph_lists_flow_tools() -> None:
    body = _read("impact-graph.md")
    for tool in ("list_flows_tool", "get_flow_tool"):
        assert tool in body, f"impact-graph.md missing {tool}"


def test_review_graph_lists_gap_and_flow_tools() -> None:
    body = _read("review-graph.md")
    for tool in ("get_knowledge_gaps_tool", "list_flows_tool"):
        assert tool in body, f"review-graph.md missing {tool}"


def test_no_plugin_prefix_in_menu_fragments() -> None:
    """Menus are user-facing prose; allowlist prefix is for `tools:` only.

    Drift guard: globs every menu fragment under `fragments/tool-tiers/`
    and asserts none uses the `mcp__plugin_bdk_` prefix in tool mentions.
    """
    patterns = ["*-graph.md", "*-serena.md", "*-fallback.md"]
    files = [p for pat in patterns for p in MENU_DIR.glob(pat)]
    assert files, "no menu fragments found — glob misconfigured"
    for f in files:
        body = f.read_text(encoding="utf-8")
        assert "mcp__plugin_bdk_" not in body, (
            f"{f.name}: menus use unprefixed tool names; "
            "plugin_bdk_ prefix is for allowlists only"
        )
