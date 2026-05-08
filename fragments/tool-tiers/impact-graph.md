**Impact Analysis (code-review-graph — Tier 1):** Decision procedure, not try-harder ladder.

- `get_impact_radius_tool(node=<symbol or file>)` — full blast radius: affected modules and symbols
- `get_affected_flows_tool(target=<symbol>)` — which named execution flows pass through the change
- `get_bridge_nodes_tool` — architectural choke points that amplify impact if changed
- `list_flows_tool` — survey all named flows to confirm which are touched end-to-end
- `get_flow_tool(flow=<name>)` — trace one impacted flow before recommending mitigation
- `list_graph_stats_tool` — verify graph coverage before relying on a 0-result (once per session)

**Rules:**
- `get_impact_radius_tool` first; `get_affected_flows_tool` second.
- Budget: max 2 Tier 1 calls per question (coverage check excluded from cap).
- 0 affected nodes AND 0 affected flows = self-contained change. Report "no impact" and Stop. Do not text-search to confirm absence — on a covered project Tier 1 already saw every reference.
- Report impact to user before proceeding with any risk ≥ MEDIUM change.
