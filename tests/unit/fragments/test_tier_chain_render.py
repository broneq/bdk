"""End-to-end render tests for tier chains.

Subagents read tier guidance through `bdk-tier-*` preload skills, which
run `inject.py --chain` at preload time. The rendered string is what
the subagent sees — a regression in `inject.py`, the chain JSON, or a
tier fragment would silently break the prompt rewrite.

Since ADR-0001 the plugin ships no MCP server, so every chain renders one
built-in-tools text, whatever `features` a project sets.
"""

from __future__ import annotations

import importlib.util
import json
import re
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

ALL_CHAINS = sorted(p.name for p in CHAINS_DIR.glob("*.chain.json"))

NO_FEATURES = {"features": {}}
# Every declared feature on, plus a key the schema no longer declares (a
# project that still sets one of the flags ADR-0001 removed). Either way the
# guidance must not change.
SCHEMA_PATH = REPO_ROOT / "hooks" / "check-bdk-config" / "settings.schema.json"
_DECLARED = json.loads(SCHEMA_PATH.read_text())["properties"]["features"]["properties"]
ALL_FEATURES_ON = {"features": {**{k: True for k in _DECLARED}, "retired-server": True}}

MCP_TOOL_NAME = re.compile(r"mcp__\w+|_tool\b")


def test_all_five_chains_exist() -> None:
    assert ALL_CHAINS == [
        "edit.chain.json",
        "explore.chain.json",
        "impact.chain.json",
        "review.chain.json",
        "search.chain.json",
    ]


@pytest.mark.parametrize("chain_name", ALL_CHAINS)
def test_chain_renders_built_in_tools_with_no_features(chain_name: str) -> None:
    """An empty render leaves the consumer with no tool guidance, silently."""
    out = inject_chain(CHAINS_DIR / chain_name, settings=NO_FEATURES)
    assert out.strip(), f"{chain_name} rendered empty"
    for tool in ("Grep", "Read", "Bash"):
        assert tool in out, f"{chain_name} does not name {tool}"
    assert not MCP_TOOL_NAME.search(out), f"{chain_name} names an MCP tool"


@pytest.mark.parametrize("chain_name", ALL_CHAINS)
def test_chain_text_is_independent_of_features(chain_name: str) -> None:
    plain = inject_chain(CHAINS_DIR / chain_name, settings=NO_FEATURES)
    flagged = inject_chain(CHAINS_DIR / chain_name, settings=ALL_FEATURES_ON)
    assert plain == flagged, f"{chain_name} output changes with features"


@pytest.mark.parametrize("chain_name", ALL_CHAINS)
def test_chain_text_does_not_describe_other_tiers(chain_name: str) -> None:
    out = inject_chain(CHAINS_DIR / chain_name, settings=NO_FEATURES)
    assert not re.search(r"\bTier \d\b|at this tier", out), (
        f"{chain_name} still describes itself as one tier among several"
    )


@pytest.mark.parametrize("chain_name", ALL_CHAINS)
def test_additive_chain_fallbacks_guard_with_prefer(chain_name: str) -> None:
    """`.claude/rules/fragment-system.md`: in an additive chain a bare
    unconditional entry stacks on top of every matching tier, so it must
    carry `prefer`."""
    config = json.loads((CHAINS_DIR / chain_name).read_text(encoding="utf-8"))
    if config["mode"] != "additive":
        return
    for entry in config["chain"]:
        if "if" not in entry:
            assert entry.get("prefer"), (
                f"{chain_name}: unconditional entry {entry['then']} lacks prefer"
            )
