**Codebase Exploration (code-review-graph — Tier 1):** Decision procedure, not try-harder ladder.

- `list_communities_tool` — module groupings and their members; names alone often answer "is X here?"
- `get_community_tool(community=<name>)` — drill into a specific community's symbols
- `semantic_search_nodes(query=<single token>)` — find relevant symbols without manual browsing
- `get_architecture_overview_tool(detail_level="minimal")` — community map and cross-community coupling
- `get_hub_nodes_tool` — high-dependency symbols (understand these first)
- `get_surprising_connections_tool` — unexpected cross-module dependencies
- `list_flows_tool` — survey named execution flows (HTTP entry points, CLI commands, jobs)
- `get_flow_tool(flow=<name>)` — trace one named flow end-to-end
- `find_large_functions_tool` — complexity hotspots without reading every file
- `get_knowledge_gaps_tool` — distinguish "feature absent" from "graph missing files" on 0-result
- `list_graph_stats_tool` — verify graph coverage before relying on a 0-result (once per session)

**Entry-point sequence:**
1. `list_communities_tool` first — if a name matches the query domain, drill in with `get_community_tool` or `semantic_search_nodes`.
2. Architecture questions → `get_architecture_overview_tool` + `get_hub_nodes_tool`.
3. Flow questions → `list_flows_tool` then `get_flow_tool`.
4. Symbol questions → `semantic_search_nodes` with a single token, then one synonym.

**Rules:**
- Budget: max 2 Tier 1 calls per question (coverage check excluded from cap).
- 0 hits + one synonym retry = feature absent. Report and stop. Do not chain text-search to confirm absence.
- Domain reframe before fallback: Next.js → check `actions/`; Django → `@api_view`, `urlpatterns`; Express → `app.get`/`app.post` inline.
- Scoped to session cwd. For paths outside cwd, skip Tier 1 entirely and go to fallback — Tier 1 will return data for the wrong project.
