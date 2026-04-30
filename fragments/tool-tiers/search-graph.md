**Search (code-review-graph — Tier 1):**
- `semantic_search_nodes(query=<symbol or keyword>)` — locate functions/classes by name or intent without file browsing
- `query_graph(pattern="callers_of", target=<symbol>)` — trace all callers up the call chain
- `query_graph(pattern="callees_of", target=<symbol>)` — trace all callees down to dependencies
- `query_graph(pattern="tests_for", target=<symbol>)` — find existing tests for a symbol

Prefer graph search over Grep/Read — cheaper and gives structural context.
