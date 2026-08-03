**Symbol Search & Trace (code-review-graph — Tier 1):**

- `semantic_search_nodes(query=<single token>)` — locate by name/intent
- `query_graph(pattern="callers_of"|"callees_of"|"tests_for", target=<symbol>)` — pick ONE direction
- `traverse_graph_tool` — multi-hop walk from a seed when single-hop insufficient
- `list_graph_stats_tool` — verify coverage before trusting 0-result (once/session)

**Rules:**
- Single-token query. One keyword, then one synonym if needed.
- Max 2 Tier 1 calls per question (coverage check excluded).
- 0 hits + one synonym retry = absent. Report and stop. Don't text-search to confirm — structural result is authoritative.
- Pick exactly ONE trace direction relevant to the question; don't speculate all three.
