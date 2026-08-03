**Codebase Exploration (code-review-graph — Tier 1):**

- `list_communities_tool` — module groupings; names alone often answer "is X here?"
- `get_community_tool(community=<name>)` — drill into one community's symbols
- `semantic_search_nodes(query=<single token>)` — find symbols without browsing
- `get_architecture_overview_tool(detail_level="minimal")` — community map + cross-coupling
- `get_hub_nodes_tool` — high-dependency symbols
- `get_surprising_connections_tool` — unexpected cross-module deps
- `list_flows_tool` / `get_flow_tool(flow=<name>)` — named flows (HTTP, CLI, jobs); survey then trace
- `find_large_functions_tool` — complexity hotspots
- `get_knowledge_gaps_tool` — distinguish "absent" from "graph missing files" on 0-result
- `list_graph_stats_tool` — verify coverage before trusting 0-result (once/session)

**Entry sequence:** communities → architecture (if architectural) → flows (if flow-shaped) → semantic_search (single token, then one synonym).

**Rules:**
- Max 2 Tier 1 calls per question (coverage check excluded).
- 0 hits + one synonym retry = absent. Report and stop. Don't text-search to confirm.
- Domain reframe before fallback: Next.js → `actions/`; Django → `@api_view`, `urlpatterns`; Express → `app.get`/`app.post`.
- Scoped to session cwd — outside cwd → skip to fallback.
