---
name: graph-debug
description: Systematically debug issues using graph-powered code navigation — trace call chains, find execution paths, correlate with recent changes.
allowed-tools: mcp__plugin_bdk_code-review-graph__semantic_search_nodes_tool mcp__plugin_bdk_code-review-graph__query_graph_tool mcp__plugin_bdk_code-review-graph__get_flow_tool mcp__plugin_bdk_code-review-graph__detect_changes_tool mcp__plugin_bdk_code-review-graph__get_impact_radius_tool mcp__plugin_bdk_code-review-graph__get_minimal_context_tool
---

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

## Graph Debug

Systematically trace and debug issues using the knowledge graph.

### Steps

1. Run `get_minimal_context(task="debug <issue>")` first.
2. Use `semantic_search_nodes` to find code related to the issue.
3. Use `query_graph` with `callers_of` and `callees_of` to trace call chains.
4. Use `get_flow` to see full execution paths through suspected areas.
5. Run `detect_changes` to check if recent changes caused the issue.
6. Use `get_impact_radius` on suspected files to see what else is affected.

### Tips

- Check both callers and callees to understand full context.
- Look at affected flows to find entry point that triggers the bug.
- Recent changes are the most common source of new issues.

## Token Efficiency

- Start every session with `get_minimal_context(task="<your task>")`.
- Use `detail_level="minimal"` on all calls. Escalate to "standard" only when minimal is insufficient.
- Target: ≤5 tool calls, ≤800 total output tokens.
