**Symbol Search & Trace (code-review-graph — Tier 1):** Decision procedure, not try-harder ladder.

- `semantic_search_nodes(query=<single token>)` — locate functions/classes by name or intent
- `query_graph(pattern="callers_of", target=<symbol>)` — trace all callers up the call chain
- `query_graph(pattern="callees_of", target=<symbol>)` — trace all callees down to dependencies
- `query_graph(pattern="tests_for", target=<symbol>)` — find existing tests for a symbol
- `list_graph_stats_tool` — verify graph coverage before relying on a 0-result (once per session)
- `traverse_graph_tool` — walk the dependency graph from a seed node when single-hop queries are insufficient

**Rules:**
- Use a single-token query — not a sentence. One keyword, then one synonym if needed.
- Budget: max 2 Tier 1 calls per question (coverage check excluded from cap).
- 0 hits + one synonym retry = symbol absent. Report and Stop. Do not text-search to confirm absence — on a covered project the structural result is authoritative.
- Pick exactly ONE trace direction (callers, callees, or tests) relevant to the question; do not run all three speculatively.
