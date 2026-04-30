**Impact analysis (code-review-graph — Tier 1):**
- `get_impact_radius(node=<symbol or file>)` — full blast radius: what modules and symbols are affected
- `get_affected_flows(target=<symbol>)` — which named execution flows pass through the changed symbol
- `get_bridge_nodes_tool` — architectural choke points that amplify impact if changed

Use before any change with risk ≥ MEDIUM. Report impact to user before proceeding.
