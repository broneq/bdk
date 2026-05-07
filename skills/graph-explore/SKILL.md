---
name: graph-explore
description: Navigate and understand codebase structure using the knowledge graph — stats, architecture overview, community modules, call relationships.
allowed-tools: mcp__plugin_bdk_code-review-graph__list_graph_stats_tool mcp__plugin_bdk_code-review-graph__get_architecture_overview_tool mcp__plugin_bdk_code-review-graph__list_communities_tool mcp__plugin_bdk_code-review-graph__get_community_tool mcp__plugin_bdk_code-review-graph__semantic_search_nodes_tool mcp__plugin_bdk_code-review-graph__query_graph_tool mcp__plugin_bdk_code-review-graph__list_flows_tool mcp__plugin_bdk_code-review-graph__get_flow_tool mcp__plugin_bdk_code-review-graph__find_large_functions_tool mcp__plugin_bdk_code-review-graph__get_minimal_context_tool
---

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

## Graph Explore

Navigate and understand codebase structure using the knowledge graph.

### Steps

1. Run `get_minimal_context(task="explore codebase")` first.
2. Run `list_graph_stats` to see overall codebase metrics.
3. Run `get_architecture_overview` for high-level community structure.
4. Use `list_communities` to find major modules, then `get_community` for details.
5. Use `semantic_search_nodes` to find specific functions or classes.
6. Use `query_graph` with patterns like `callers_of`, `callees_of`, `imports_of` to trace relationships.
7. Use `list_flows` and `get_flow` to understand execution paths.

### Tips

- Start broad (stats, architecture) then narrow to specific areas.
- Use `children_of` on a file to see all its functions and classes.
- Use `find_large_functions` to identify complex code.

## Token Efficiency

- Start every session with `get_minimal_context(task="<your task>")`.
- Use `detail_level="minimal"` on all calls. Escalate to "standard" only when minimal is insufficient.
- Target: ≤5 tool calls, ≤800 total output tokens.
