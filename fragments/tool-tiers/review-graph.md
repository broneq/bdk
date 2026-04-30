**Code review scope (code-review-graph — Tier 1):**
1. `detect_changes(detail_level="minimal")` — risk-scored changed file list
2. `get_bridge_nodes_tool` — identify architectural choke points among changed files
3. `get_affected_flows` — execution paths impacted by the change set
4. `get_review_context(node=<symbol>)` — token-efficient source snippets for high-risk symbols

Start every review with `detect_changes`. Prioritise CRITICAL and HIGH risk symbols.
