**Before Editing (code-review-graph — Tier 1):**

Additive pairing — run impact lookup BEFORE structural edit; both this menu and the edit menu apply.

- `get_impact_radius_tool(node=<symbol or file>)` — blast radius
- `get_affected_flows_tool(target=<symbol>)` — impacted execution paths
- `query_graph(pattern="callers_of", target=<symbol>)` — callers to update
- `list_graph_stats_tool` — verify coverage before trusting 0-result (once/session)

**Rules:**
- Run impact analysis BEFORE edits — avoids missing call sites.
- Max 2 Tier 1 calls per question (coverage check excluded).
- 0 affected nodes on first lookup: retry with sibling symbol or enclosing file/module. Private/recent/unindexed symbols return empty — reframe before falling through.
- 0 affected AND 0 callers after retry = isolated change; proceed.
