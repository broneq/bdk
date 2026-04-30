**Codebase exploration (code-review-graph — Tier 1):**
- `get_architecture_overview(detail_level="minimal")` — community map and cross-community coupling
- `list_communities` — module groupings and their members
- `semantic_search_nodes(query=<keyword>)` — find relevant symbols without manual browsing
- `get_hub_nodes_tool` — high-dependency symbols (understand these first)
- `get_surprising_connections_tool` — unexpected cross-module dependencies

Start exploration with `get_architecture_overview` to orient before reading any files.
