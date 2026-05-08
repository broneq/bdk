---
name: graph-review
description: Risk-aware code review using knowledge graph — detect changes, trace impacted flows, check test coverage, recommend merge decision.
allowed-tools: mcp__plugin_bdk_code-review-graph__detect_changes_tool mcp__plugin_bdk_code-review-graph__get_affected_flows_tool mcp__plugin_bdk_code-review-graph__query_graph_tool mcp__plugin_bdk_code-review-graph__get_impact_radius_tool mcp__plugin_bdk_code-review-graph__get_knowledge_gaps_tool mcp__plugin_bdk_code-review-graph__get_minimal_context_tool
---

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md). Assumes environment discovery has already run (language, test runner, build tool are known).

## Graph Review

Thorough, risk-aware code review using the knowledge graph.

### Steps

1. Run `get_minimal_context(task="review changes")` first.
2. Run `detect_changes` to get risk-scored change analysis.
3. Run `get_affected_flows` to find impacted execution paths.
4. For each high-risk function, run `query_graph` with pattern="tests_for" to check test coverage.
5. Run `get_impact_radius` to understand blast radius.
6. For untested changes, suggest specific test cases.

### Diagnostic shortcuts

- `get_knowledge_gaps_tool` — when a changed file sits in a coverage gap, raise its risk score manually before reviewing; protects against false-confidence on graph-untracked code.

### Output Format

Group findings by risk level (high/medium/low):
- What changed and why it matters
- Test coverage status
- Suggested improvements
- Overall merge recommendation

## Token Efficiency

- Start every session with `get_minimal_context(task="<your task>")`.
- Use `detail_level="minimal"` on all calls. Escalate to "standard" only when minimal is insufficient.
- Target: ≤5 tool calls, ≤800 total output tokens.
