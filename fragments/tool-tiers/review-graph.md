**Code Review Scope (code-review-graph — Tier 1):**

1. `detect_changes_tool(detail_level="minimal")` — risk-scored changed files; start here
2. `get_review_context_tool(node=<symbol>)` — source snippets for CRITICAL/HIGH symbols
3. `get_bridge_nodes_tool` — choke points among changed files
4. `get_affected_flows_tool` — execution paths impacted

- `list_graph_stats_tool` — verify coverage before trusting 0-result (once/session)
- `get_knowledge_gaps_tool` — if changed file is in a coverage gap, raise risk manually
- `list_flows_tool` — surface every named flow the change set touches

**Rules:**
- Always start with `detect_changes_tool`. Prioritise CRITICAL/HIGH only.
- Max 2 Tier 1 calls per question (coverage check excluded).
- 0 risk-flagged nodes = mechanical change. Sampling check only; don't read every file in full. Stop and report.
