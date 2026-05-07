---
name: graph-refactor
description: Plan and execute safe refactoring using dependency analysis — find dead code, preview renames, verify no critical paths broken.
allowed-tools: mcp__plugin_bdk_code-review-graph__refactor_tool mcp__plugin_bdk_code-review-graph__apply_refactor_tool mcp__plugin_bdk_code-review-graph__detect_changes_tool mcp__plugin_bdk_code-review-graph__get_impact_radius_tool mcp__plugin_bdk_code-review-graph__get_affected_flows_tool mcp__plugin_bdk_code-review-graph__find_large_functions_tool mcp__plugin_bdk_code-review-graph__get_minimal_context_tool
---

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

## Graph Refactor

Plan and execute refactoring safely using the knowledge graph.

### Steps

1. Run `get_minimal_context(task="refactor <target>")` first.
2. Use `refactor_tool` with mode="suggest" for community-driven refactoring suggestions.
3. Use `refactor_tool` with mode="dead_code" to find unreferenced code.
4. For renames, use `refactor_tool` with mode="rename" to preview all affected locations.
5. Use `apply_refactor_tool` with the refactor_id to apply renames.
6. After changes, run `detect_changes` to verify refactoring impact.

### Safety Checks

- Always preview before applying (rename mode gives edit list).
- Check `get_impact_radius` before major refactors.
- Use `get_affected_flows` to ensure no critical paths broken.
- Use `find_large_functions` to identify decomposition targets.

## Token Efficiency

- Start every session with `get_minimal_context(task="<your task>")`.
- Use `detail_level="minimal"` on all calls. Escalate to "standard" only when minimal is insufficient.
- Target: ≤5 tool calls, ≤800 total output tokens.
