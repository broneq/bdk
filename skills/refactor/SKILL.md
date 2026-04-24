---
name: refactor
description: Propose better object-oriented architecture for complex, procedural code
user-invocable: true
model: opus
argument-hint: "[file path, module name, or feature description]"
allowed-tools: mcp__code-review-graph__get_architecture_overview_tool mcp__code-review-graph__list_communities_tool mcp__code-review-graph__get_surprising_connections_tool mcp__code-review-graph__refactor_tool
---

# Refactor

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Complex refactor needed. Code messy, needs clean class separation.

**Workflow:**
1. Graph-first architecture survey:
   - `get_architecture_overview(detail_level="minimal")` — current community structure and layer boundaries
   - `list_communities` — identify tightly-coupled communities the refactor should clean up
   - `get_surprising_connections_tool` — cross-cutting concerns that violate layering
   - `refactor_tool(mode="dead_code")` — identify dead code to remove during refactor
2. Launch `explorer` subagent with architecture findings as context (not blind)
3. Propose OO architecture with well-separated classes — reference community boundaries, address surprising connections
4. Identify applicable Gang of Four patterns (Strategy, Factory, Observer, Decorator) and explain fit
5. Create docs in `.bdk/refactor/`:
   - Architecture overview
   - Applicable GoF patterns with rationale
   - Implementation plan

**Problem description:**

$ARGUMENTS