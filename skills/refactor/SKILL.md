---
name: refactor
description: Propose better object-oriented architecture for complex, procedural code
user-invocable: true
disable-model-invocation: true
model: opus
argument-hint: "[file path, module name, or feature description]"
allowed-tools: Bash(python3 ${CLAUDE_PLUGIN_ROOT}/scripts/*)
---

# Refactor

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

For each `<!-- INJECT: <name> -->` marker below, run `python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject-rules.py <name>` and substitute its stdout in place of the marker before acting on it.

Complex refactor needed. Code messy, needs clean class separation.

**Workflow:**
1. Architecture survey:

!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/explore.chain.json`

   Using the exploration tools above: understand current community structure, identify tightly-coupled communities, detect cross-cutting concerns, and identify dead code with `refactor_tool(mode="dead_code")` if graph is available.
2. Launch `explorer` subagent with architecture findings as context (not blind)
3. Propose OO architecture with well-separated classes — reference community boundaries, address surprising connections
4. Identify applicable design patterns and explain fit — see rules below
5. Create docs in `.bdk/refactor/`:
   - Architecture overview
   - Applicable patterns with rationale
   - Implementation plan

**Problem description:**

$ARGUMENTS

<!-- INJECT: design-patterns -->