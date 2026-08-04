"""Regression tests for tier-1 graph fragment files.

Each `fragments/tool-tiers/*-graph.md` carries its own embedded policy:
coverage check, call budget, and negative-result rule. These assertions
guard the contract so a future edit cannot silently remove the policy.
"""

from __future__ import annotations

from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[3]
GRAPH_FRAGMENTS = [
    REPO_ROOT / "fragments/tool-tiers/explore-graph.md",
    REPO_ROOT / "fragments/tool-tiers/search-graph.md",
    REPO_ROOT / "fragments/tool-tiers/edit-graph.md",
    REPO_ROOT / "fragments/tool-tiers/impact-graph.md",
    REPO_ROOT / "fragments/tool-tiers/review-graph.md",
]


@pytest.mark.parametrize("frag_path", GRAPH_FRAGMENTS, ids=lambda p: p.name)
def test_graph_fragment_has_coverage_reference(frag_path: Path) -> None:
    body = frag_path.read_text(encoding="utf-8")
    assert "coverage" in body or "list_graph_stats_tool" in body, (
        f"{frag_path.name} missing coverage-check reference"
    )


@pytest.mark.parametrize("frag_path", GRAPH_FRAGMENTS, ids=lambda p: p.name)
def test_graph_fragment_has_negative_result_rule(frag_path: Path) -> None:
    body = frag_path.read_text(encoding="utf-8")
    # Each tier states its own negative-result conclusion in its own vocabulary:
    # search/explore say "absent", impact says "no impact", edit says "isolated
    # change". All three are the same rule: a 0-result after retry is an answer.
    assert (
        "absent" in body
        or "Stop" in body
        or "no impact" in body
        or "isolated change" in body
        or "mechanical change" in body
    ), f"{frag_path.name} missing negative-result rule"


@pytest.mark.parametrize("frag_path", GRAPH_FRAGMENTS, ids=lambda p: p.name)
def test_graph_fragment_has_call_budget_phrase(frag_path: Path) -> None:
    body = frag_path.read_text(encoding="utf-8")
    assert "Budget" in body or "calls per question" in body or "max 2" in body, (
        f"{frag_path.name} missing call-budget phrase"
    )


def test_edit_graph_contains_additive_impact_structural() -> None:
    body = (REPO_ROOT / "fragments/tool-tiers/edit-graph.md").read_text(encoding="utf-8")
    assert "impact" in body, "edit-graph.md must contain 'impact'"
    assert "structural" in body or "Structural" in body, "edit-graph.md must contain 'structural'"
    assert "additive" in body or "Additive" in body, "edit-graph.md must contain 'additive'"


def test_impact_graph_leads_with_impact_radius() -> None:
    body = (REPO_ROOT / "fragments/tool-tiers/impact-graph.md").read_text(encoding="utf-8")
    impact_pos = body.find("get_impact_radius_tool")
    flows_pos = body.find("get_affected_flows_tool")
    assert impact_pos != -1, "impact-graph.md missing get_impact_radius_tool"
    assert impact_pos < flows_pos, "get_impact_radius_tool must appear before get_affected_flows_tool"


def test_review_graph_leads_with_detect_changes() -> None:
    body = (REPO_ROOT / "fragments/tool-tiers/review-graph.md").read_text(encoding="utf-8")
    detect_pos = body.find("detect_changes_tool")
    context_pos = body.find("get_review_context_tool")
    assert detect_pos != -1, "review-graph.md missing detect_changes_tool"
    assert detect_pos < context_pos, "detect_changes_tool must appear before get_review_context_tool"
