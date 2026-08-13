"""End-to-end render tests for tier chains.

Subagents read tier guidance through `bdk-tier-*` preload skills, which
run `inject.py --chain` at preload time. The rendered string is what
the subagent sees — a regression in `inject.py`, the chain JSON, or a
tier fragment would silently break the prompt rewrite.

These tests render each chain against synthetic settings and assert the
policy content lands end-to-end.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
INJECT_PATH = REPO_ROOT / "scripts" / "inject.py"
CHAINS_DIR = REPO_ROOT / "fragments" / "tool-tiers"


def _load_inject():
    spec = importlib.util.spec_from_file_location("inject", INJECT_PATH)
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


inject_mod = _load_inject()
inject_chain = inject_mod.inject_chain


# Each chain must inject coverage / budget / negative-result content
# AND a fragment-specific tool name that proves the menu fragment was pulled in.
CHAIN_EXPECTATIONS = [
    ("explore.chain.json", "list_communities_tool"),
    ("search.chain.json", "semantic_search_nodes"),
    ("impact.chain.json", "get_impact_radius_tool"),
    ("review.chain.json", "detect_changes_tool"),
    ("edit.chain.json", "get_impact_radius_tool"),
]


@pytest.mark.parametrize("chain_name,fragment_marker", CHAIN_EXPECTATIONS)
def test_chain_renders_policy_with_graph_enabled(
    chain_name: str, fragment_marker: str
) -> None:
    settings = {"features": {"code-review-graph": True, "serena": True}}
    out = inject_chain(CHAINS_DIR / chain_name, settings=settings)

    assert "coverage" in out or "list_graph_stats_tool" in out, (
        f"{chain_name}: rendered chain missing coverage check reference"
    )
    assert "Budget" in out or "calls per question" in out or "max 2" in out, (
        f"{chain_name}: rendered chain missing call budget phrase"
    )
    # Per-tier vocabulary for the same rule — see test_tier_graph_fragments.py.
    assert (
        "absent" in out
        or "Stop" in out
        or "no impact" in out
        or "isolated change" in out
        or "mechanical change" in out
    ), f"{chain_name}: rendered chain missing negative-result rule"
    assert fragment_marker in out, (
        f"{chain_name}: menu fragment marker {fragment_marker!r} missing"
    )


def test_explore_chain_empty_when_no_features() -> None:
    """When no chain entry matches, the chain must produce empty output."""
    settings = {"features": {"code-review-graph": False, "serena": False}}
    out = inject_chain(CHAINS_DIR / "explore.chain.json", settings=settings)
    assert out == "", (
        "explore.chain.json must produce empty output when no entry matches"
    )


def test_edit_chain_contains_additive_and_impact_and_structural() -> None:
    """edit-graph.md must carry both 'impact' and 'structural' and 'additive'."""
    settings = {"features": {"code-review-graph": True, "serena": False}}
    out = inject_chain(CHAINS_DIR / "edit.chain.json", settings=settings)
    assert "impact" in out, "edit chain missing 'impact' wording"
    assert "structural" in out or "Structural" in out, "edit chain missing 'structural' wording"
    assert "additive" in out or "Additive" in out, "edit chain missing 'additive' wording"


def test_impact_chain_leads_with_impact_radius() -> None:
    """impact-graph.md must lead with get_impact_radius_tool."""
    settings = {"features": {"code-review-graph": True}}
    out = inject_chain(CHAINS_DIR / "impact.chain.json", settings=settings)
    impact_pos = out.find("get_impact_radius_tool")
    flows_pos = out.find("get_affected_flows_tool")
    assert impact_pos != -1, "impact chain missing get_impact_radius_tool"
    assert impact_pos < flows_pos, "get_impact_radius_tool must appear before get_affected_flows_tool"


def test_review_chain_leads_with_detect_changes() -> None:
    """review-graph.md must lead with detect_changes_tool."""
    settings = {"features": {"code-review-graph": True}}
    out = inject_chain(CHAINS_DIR / "review.chain.json", settings=settings)
    detect_pos = out.find("detect_changes_tool")
    context_pos = out.find("get_review_context_tool")
    assert detect_pos != -1, "review chain missing detect_changes_tool"
    assert detect_pos < context_pos, "detect_changes_tool must appear before get_review_context_tool"
