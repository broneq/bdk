"""The shipped plugin relies on built-in host tools only (ADR-0001).

Guards the `plugin-tooling` spec: no bundled MCP server, and no
plugin-namespaced MCP tool name (`mcp__plugin_<plugin>_<server>__<tool>`)
in any shipped agent, skill, fragment, rule, hook or script. The pattern
is generic on purpose: an agent `tools:` entry for a server the host does
not run fails silently, whichever plugin it names.
"""

from __future__ import annotations

import re
from pathlib import Path

import pytest

REPO_ROOT = Path(__file__).resolve().parents[2]

SHIPPED_DIRS = ("agents", "skills", "fragments", "rules", "hooks", "scripts")
SHIPPED_FILES = ("STARTUP_INSTRUCTIONS.md",)
TEXT_SUFFIXES = {".md", ".json", ".py", ".sh", ".yaml", ".yml", ".txt"}

MCP_TOOL_NAME = re.compile(r"mcp__plugin_[\w-]+__[\w-]+")

# Tools of the two servers ADR-0001 removed, as prose names them without
# the namespace. A skill or agent that tells the model to call one points
# it at a tool the session does not have.
REMOVED_SERVER_TOOLS = re.compile(
    r"\b("
    r"find_symbol|find_referencing_symbols|get_symbols_overview|search_for_pattern"
    r"|find_file|list_dir|replace_symbol_body|insert_(?:after|before)_symbol"
    r"|rename_symbol|activate_project|read_memory|list_memories"
    r"|semantic_search_nodes|query_graph|get_impact_radius|get_affected_flows"
    r"|get_review_context|detect_changes|get_architecture_overview|list_communities"
    r"|get_community|refactor_tool|traverse_graph|get_surprising_connections"
    r"|get_hub_nodes|get_bridge_nodes|list_graph_stats|list_flows|get_flow"
    r"|get_knowledge_gaps|find_large_functions|build_or_update_graph"
    r"|get_minimal_context|get_suggested_questions|cross_repo_search|embed_graph"
    r"|generate_wiki|get_wiki_page|get_docs_section|list_repos|run_postprocess"
    r"|apply_refactor|find_declaration|find_implementations|get_diagnostics_for_file"
    r"|initial_instructions|open_dashboard|replace_in_files|safe_delete_symbol"
    r")(?:_tool)?\b"
)

REMOVED_PATHS = (".mcp.json", ".serena", "hooks/register-graph-repo")


def _shipped_files() -> list[Path]:
    files = [REPO_ROOT / name for name in SHIPPED_FILES]
    for directory in SHIPPED_DIRS:
        files.extend(
            p
            for p in (REPO_ROOT / directory).rglob("*")
            if p.is_file() and p.suffix in TEXT_SUFFIXES and "__pycache__" not in p.parts
        )
    return sorted(files)


def test_shipped_files_name_no_plugin_mcp_tool() -> None:
    hits = []
    for path in _shipped_files():
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for name in MCP_TOOL_NAME.findall(line):
                hits.append(f"{path.relative_to(REPO_ROOT)}:{lineno}: {name}")
    assert not hits, "plugin MCP tool names in shipped files:\n" + "\n".join(hits)


def test_shipped_files_name_no_removed_server_tool() -> None:
    hits = []
    for path in _shipped_files():
        for lineno, line in enumerate(path.read_text(encoding="utf-8").splitlines(), 1):
            for match in REMOVED_SERVER_TOOLS.finditer(line):
                hits.append(f"{path.relative_to(REPO_ROOT)}:{lineno}: {match.group(0)}")
    assert not hits, "removed MCP server tools named in shipped files:\n" + "\n".join(hits)


@pytest.mark.parametrize("relative", REMOVED_PATHS)
def test_removed_mcp_wiring_is_absent(relative: str) -> None:
    assert not (REPO_ROOT / relative).exists(), f"{relative} must not exist (ADR-0001)"
