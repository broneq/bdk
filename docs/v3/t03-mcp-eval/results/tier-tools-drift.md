# Tier menu vs agent `tools:` drift (BDK `cdea721`)

For every agent that preloads a `bdk-tier-*` meta-skill, the MCP tools the tier fragments of that skill name (graph and serena tiers of its chain) against the MCP tools the agent's `tools:` frontmatter grants. A named tool that is not granted is one the agent is told to use and cannot call. Computed from `agents/*.md`, `skills/bdk-tier-*/SKILL.md` and `fragments/tool-tiers/*`; tool names in fragments are matched with or without the `_tool` suffix (fragments write `semantic_search_nodes`, the server exposes `semantic_search_nodes_tool`).

| Agent | Preloaded tiers | Named in the graph tier, not granted | Named in the serena tier, not granted |
|---|---|---|---|
| `architecture-reviewer` | explore, search, impact | `find_large_functions_tool`, `get_community_tool`, `get_knowledge_gaps_tool`, `traverse_graph_tool` | - |
| `design-verifier` | search, explore | `find_large_functions_tool`, `get_community_tool`, `get_flow_tool`, `get_hub_nodes_tool`, `get_knowledge_gaps_tool`, `get_surprising_connections_tool`, `list_graph_stats_tool`, `traverse_graph_tool` | - |
| `explorer` | explore, search | `get_community_tool`, `get_hub_nodes_tool`, `get_surprising_connections_tool` | - |
| `plan-verifier` | search, impact, explore | `find_large_functions_tool`, `get_community_tool`, `get_hub_nodes_tool`, `get_knowledge_gaps_tool`, `get_surprising_connections_tool`, `list_communities_tool` | - |
| `implementer` | search, impact, edit | - | `rename_symbol`, `safe_delete_symbol` |
| `fixer` | search, impact, edit | - | `rename_symbol`, `safe_delete_symbol` |

The other agents (`code-reviewer`, `dead-code-detector`, `duplicate-detector`, `log-analyzer`, and the agents without MCP tools) have no gap. No test ties the two lists together.

Observed consequence in the value runs: none of the 96 Haiku runs called a tool that its session did not have, except two calls to a misspelt name, `mcp__plugin_bdk_code-review_graph__query_graph_tool` (underscore for the hyphen in the server name), in V7 CG (`runs/haiku/V7/CG-r1.jsonl`, `CG-r2.jsonl`).
