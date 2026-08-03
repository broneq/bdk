**Impact Analysis (code-review-graph — Tier 1):**

- `get_impact_radius_tool(node=<symbol or file>)` — blast radius (first call)
- `get_affected_flows_tool(target=<symbol>)` — impacted execution flows (second call)
- `get_bridge_nodes_tool` — choke points that amplify impact
- `list_flows_tool` / `get_flow_tool(flow=<name>)` — confirm and trace impacted flows
- `list_graph_stats_tool` — verify coverage before trusting 0-result (once/session)

**Rules:**
- Max 2 Tier 1 calls per question (coverage check excluded).
- 0 affected nodes AND 0 affected flows = self-contained. Report "no impact" and stop. Don't text-search — Tier 1 already saw every reference.
- Report impact to user before any risk ≥ MEDIUM change.
