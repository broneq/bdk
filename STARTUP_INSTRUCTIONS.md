# BDK Shared Foundation

This file is injected into every session via SessionStart hook. It defines the BDK contract inherited by all skills.

## 1. Project Context Discovery Order

When any skill needs to understand the project environment, follow this sequence:
1. Read local `CLAUDE.md` and `.claude/rules/*.md`
2. Detect language/ecosystem from package files (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `composer.json`, `.terraform`, etc.)
3. Infer test runner, build tool, and lint tool from those files
4. Fall back to asking the user only if nothing is detectable

## 2. MCP Tool Preference (Tier System)

- **Tier 1:** CodeGraph — symbol search, callers/callees, impact analysis
- **Tier 2:** Serena — AST-level analysis, referencing symbols, structural analysis
- **Tier 3:** Grep/Glob/Read — always available, used when MCP tools are unavailable

If a Tier 1 or Tier 2 tool is not available, fall back to the next tier silently.

## 3. Common Conventions

- Never modify files unless explicitly asked
- Prefer reading symbols over full files
- Always verify before claiming something is complete

## 4. BDK Skill Pattern

Skills reference this foundation implicitly — they define workflow only and do not repeat these rules.
