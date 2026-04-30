**Before editing (code-review-graph — Tier 1):**
- `get_impact_radius(node=<symbol or file>)` — understand what breaks if this symbol changes
- `get_affected_flows(target=<symbol>)` — identify execution paths impacted by the change
- `query_graph(pattern="callers_of", target=<symbol>)` — find all callers that must be updated

Run impact analysis BEFORE making edits to avoid missing call sites.
