**Before Editing (code-review-graph — Tier 1):** Decision procedure, not try-harder ladder.

**Additive pairing — run impact lookup BEFORE applying the structural edit; both this menu and the edit menu apply.**

- `get_impact_radius_tool(node=<symbol or file>)` — full blast radius before any change
- `get_affected_flows_tool(target=<symbol>)` — execution paths impacted by the change
- `query_graph(pattern="callers_of", target=<symbol>)` — find all callers that must be updated
- `list_graph_stats_tool` — verify graph coverage before relying on a 0-result (once per session)

**Rules:**
- Run impact analysis BEFORE making edits — avoids missing call sites.
- Budget: max 2 Tier 1 calls per question (coverage check excluded from cap).
- If impact lookup returns 0 affected nodes: retry with a sibling symbol or the enclosing file/module. The symbol may be private, recently added, or in an unindexed file — reframe before falling through.
- 0 affected nodes AND 0 callers after retry = isolated change. Symbol absent from impact graph means no dependency review needed; proceed.
