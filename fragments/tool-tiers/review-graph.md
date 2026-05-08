**Code Review Scope (code-review-graph — Tier 1):** Decision procedure, not try-harder ladder.

1. `detect_changes_tool(detail_level="minimal")` — risk-scored changed file list; start here every review
2. `get_review_context_tool(node=<symbol>)` — token-efficient source snippets for CRITICAL/HIGH symbols
3. `get_bridge_nodes_tool` — architectural choke points among changed files
4. `get_affected_flows_tool` — execution paths impacted by the change set

- `list_graph_stats_tool` — verify graph coverage before relying on 0-result (once per session)
- `get_knowledge_gaps_tool` — if changed file is in a coverage gap, raise its risk score manually
- `list_flows_tool` — surface every named flow the change set touches; review them end-to-end

**Rules:**
- Always start with `detect_changes_tool`. Prioritise CRITICAL and HIGH risk symbols only.
- Budget: max 2 Tier 1 calls per question (coverage check excluded from cap).
- If change detection returns no risk-flagged nodes: mechanical change — do a sampling check only. Do not read every file in full.
- 0 risk-flagged nodes = answer. Symbol absent from risk list means low risk — Stop and report.
