# BDK Shared Foundation

This file is injected into every session via SessionStart hook. It defines the BDK contract inherited by all skills.

## MCP Tool Preference (Tier System)

- **Tier 1:** code-review-graph — structural graph, impact analysis, code review context
- **Tier 2:** Serena — AST-level analysis, referencing symbols, structural analysis
- **Tier 3:** Grep/Glob/Read — always available, used when MCP tools are unavailable

If a Tier 1 or Tier 2 tool is not available, fall back to the next tier silently.

## When to Use code-review-graph (Tier 1)

Use `mcp__code-review-graph__*` tools BEFORE Grep/Glob/Read for:

- **Symbol/code search** → `semantic_search_nodes` or `query_graph`
- **Impact of a change** → `get_impact_radius` (what breaks if I touch X?)
- **Code review** → `detect_changes` + `get_review_context` (risk-scored diff analysis)
- **Call chains** → `query_graph` with `callers_of` / `callees_of`
- **Test coverage** → `query_graph` with `tests_for`
- **Architecture** → `get_architecture_overview` + `list_communities`

Fall back to Serena or Grep only when graph returns no results or tool unavailable.
