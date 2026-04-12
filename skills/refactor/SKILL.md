---
name: refactor
description: Propose better object-oriented architecture for complex, procedural code
user-invocable: true
model: opus
arguments:
  - name: instruction
    description: "What to refactor (file path, module name, or feature description)"
    required: true
---

# Refactor

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

I would like to do complex refactoring of my feature.
The code is complex and not well-organized. I believe we can make it cleaner with well-separated classes.

**Workflow:**
1. Use `explorer` subagent to understand the current code structure
2. Propose new object-oriented architecture with well-separated classes
3. Create documentation in `docs/plans/` with:
   - Architecture overview
   - Implementation plan

**Problem description:**

$ARGUMENT
