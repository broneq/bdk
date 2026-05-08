"""Audit graph-only skills for diagnostic-tool awareness.

Skills `graph-explore`, `graph-debug`, `graph-review`, `graph-refactor`
are intentionally hardcoded — they require the code-review-graph MCP
by design and do not use the chain system (per `fragment-system.md`).
This audit ensures each skill's instructions name the diagnostic tools
that close the same gaps targeted in the tier-prompt rewrite.
"""

from __future__ import annotations

from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[3]
SKILLS_DIR = REPO_ROOT / "skills"


def _read(skill: str) -> str:
    return (SKILLS_DIR / skill / "SKILL.md").read_text(encoding="utf-8")


def test_graph_explore_mentions_stats_and_communities() -> None:
    body = _read("graph-explore")
    for tool in ("list_graph_stats_tool", "list_communities_tool"):
        assert tool in body, f"graph-explore SKILL.md missing {tool}"


def test_graph_debug_mentions_flow_tools() -> None:
    body = _read("graph-debug")
    for tool in ("get_flow_tool", "list_flows_tool"):
        assert tool in body, f"graph-debug SKILL.md missing {tool}"


def test_graph_review_mentions_knowledge_gaps() -> None:
    body = _read("graph-review")
    assert "get_knowledge_gaps_tool" in body, (
        "graph-review SKILL.md missing get_knowledge_gaps_tool"
    )


def test_graph_refactor_mentions_large_functions() -> None:
    body = _read("graph-refactor")
    assert "find_large_functions_tool" in body, (
        "graph-refactor SKILL.md missing find_large_functions_tool"
    )


def test_no_chain_injection_in_graph_only_skills() -> None:
    """Graph-only skills are hardcoded by design — no `inject.py --chain`."""
    for skill in ("graph-explore", "graph-debug", "graph-review", "graph-refactor"):
        body = _read(skill)
        assert "inject.py --chain" not in body, (
            f"{skill}: graph-only skills must not use chain injection — "
            "they are intentionally hardcoded (fragment-system.md)"
        )
