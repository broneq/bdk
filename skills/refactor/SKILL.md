---
name: refactor
description: Propose better object-oriented architecture for complex, procedural code
user-invocable: true
model: opus
argument-hint: "[file path, module name, or feature description]"
---

# Refactor

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

Complex refactor needed. Code messy, needs clean class separation.

**Workflow:**
1. Use `explorer` subagent to understand current code structure
2. Propose OO architecture with well-separated classes
3. Identify applicable Gang of Four patterns (Strategy, Factory, Observer, Decorator) and explain fit
4. Create docs in `.bdk/refactor/`:
   - Architecture overview
   - Applicable GoF patterns with rationale
   - Implementation plan

**Problem description:**

$ARGUMENTS