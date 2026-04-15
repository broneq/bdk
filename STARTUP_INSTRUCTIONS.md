# BDK Shared Foundation

This file is injected into every session via SessionStart hook. It defines the BDK contract inherited by all skills.

## MCP Tool Preference (Tier System)

- **Tier 1:** CodeGraph — symbol search, callers/callees, impact analysis
- **Tier 2:** Serena — AST-level analysis, referencing symbols, structural analysis
- **Tier 3:** Grep/Glob/Read — always available, used when MCP tools are unavailable

If a Tier 1 or Tier 2 tool is not available, fall back to the next tier silently.
