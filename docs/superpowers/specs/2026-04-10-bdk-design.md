# BDK — Broneq Dev Kit: Design Spec

**Date:** 2026-04-10
**Status:** Approved

---

## Overview

BDK is a personal Claude Code plugin packaging reusable dev workflows, skills, agents, and hooks into a single installable unit. The core design principle is **language-agnostic by default** — skills contain workflow logic only, with all environment assumptions delegated to a shared foundation and the local project's `CLAUDE.md` / `.claude/rules/`.

---

## Architecture: Convention-Driven with Shared Foundation

Skills are thin workflow definitions. Environment discovery (language detection, test runner, build tool, lint tool) is handled by a shared `STARTUP_INSTRUCTIONS.md` injected at session start via a `SessionStart` hook. This means:

- Single source of truth for BDK conventions
- Skills stay clean — workflow logic only, no environment assumptions
- New skills automatically inherit all rules
- Changes to conventions require editing one file, not 13

---

## Plugin Structure

```
bdk/
├── .claude-plugin/
│   └── plugin.json              # Plugin metadata
├── STARTUP_INSTRUCTIONS.md      # BDK shared foundation (injected via SessionStart hook)
├── .mcp.json                    # Serena + CodeGraph with default binary paths
├── hooks/
│   └── hooks.json               # SessionStart → inject STARTUP_INSTRUCTIONS.md
├── skills/
│   ├── cr/SKILL.md
│   ├── commit/SKILL.md
│   ├── create-plan/SKILL.md
│   ├── execute-plan/SKILL.md
│   ├── verify-plan/SKILL.md
│   ├── debug/SKILL.md
│   ├── refactor/SKILL.md
│   ├── test-driven-development/SKILL.md
│   ├── brainstorming-session/SKILL.md
│   ├── create-adr/SKILL.md
│   ├── save-progress/SKILL.md
│   ├── restore-progress/SKILL.md
│   └── explain-complex-code/SKILL.md
├── agents/
│   ├── code-reviewer.md
│   ├── explorer.md
│   ├── test-runner.md
│   ├── dead-code-detector.md
│   ├── duplicate-detector.md
│   ├── architecture-reviewer.md
│   ├── static-analyse.md
│   ├── step-simulator.md
│   ├── helper-writer.md
│   ├── log-analyzer.md
│   └── web-researcher.md
└── README.md
```

Skills are invoked as `/bdk:cr`, `/bdk:commit`, `/bdk:debug`, etc. Agents appear as `bdk:code-reviewer`, etc.

---

## STARTUP_INSTRUCTIONS.md — Shared Foundation

Injected into every session via `SessionStart` hook. Defines the BDK contract inherited by all skills:

### 1. Project Context Discovery Order
When any skill needs to understand the project environment, Claude follows this sequence:
1. Read local `CLAUDE.md` and `.claude/rules/*.md`
2. Detect language/ecosystem from package files (`package.json`, `go.mod`, `Cargo.toml`, `pyproject.toml`, `composer.json`, `.terraform`, etc.)
3. Infer test runner, build tool, and lint tool from those files
4. Fall back to asking the user only if nothing is detectable

### 2. MCP Tool Preference (Tier System)
- **Tier 1:** CodeGraph — symbol search, callers/callees, impact analysis
- **Tier 2:** Serena — AST-level analysis, referencing symbols, structural analysis
- **Tier 3:** Grep/Glob/Read — always available, used when MCP tools are unavailable

If a Tier 1 or Tier 2 tool is not available, fall back to the next tier silently.

### 3. Common Conventions
- Never modify files unless explicitly asked
- Prefer reading symbols over full files
- Always verify before claiming something is complete

### 4. BDK Skill Pattern
Skills reference this foundation implicitly — they define workflow only and do not repeat these rules.

---

## MCP Configuration

**`.mcp.json`** ships Serena and CodeGraph with default `npx`-based invocation (no global install required):

```json
{
  "mcpServers": {
    "serena": {
      "command": "uvx",
      "args": ["--from", "serena-mcp", "serena-mcp"]
    },
    "codegraph": {
      "command": "npx",
      "args": ["-y", "@codegraph/mcp-server"]
    }
  }
}
```

Servers start automatically if the runtime (`uvx`/`npx`) is present; fail silently if not. No user configuration required. `STARTUP_INSTRUCTIONS.md` guides skills to fall back to Tier 3 tools when MCP is unavailable.

No `userConfig` in `plugin.json` — zero friction installation.

> **Note:** Exact package names for Serena and CodeGraph MCP servers must be confirmed before implementation.

---

## plugin.json

```json
{
  "name": "bdk",
  "description": "Broneq Dev Kit — reusable dev workflows, skills, and agents for any project",
  "version": "1.0.0",
  "author": { "name": "broneq" },
  "repository": "https://github.com/broneq/bdk",
  "license": "MIT"
}
```

---

## hooks/hooks.json

`SessionStart` hook injects `STARTUP_INSTRUCTIONS.md` content into Claude's context via `additionalContext`:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "cat ${CLAUDE_PLUGIN_ROOT}/STARTUP_INSTRUCTIONS.md"
          }
        ]
      }
    ]
  }
}
```

---

## Skills — Rewrite Strategy

### Significant rewrite needed (Python/project-specific hardcoding)
| Skill | What changes |
|-------|-------------|
| `cr` | Remove or-migrator architecture layers; replace with CLAUDE.md-driven layer discovery |
| `execute-plan` | Remove `uv run`, `bin/cleanup.sh`; replace with detected build/lint/test commands |
| `create-plan` | Remove pytest path assumptions; use detected test conventions |
| `test-driven-development` | Remove `tests/unit/`, `tests/helpers/`, pytest imports; use detected paths |
| `debug` | Remove pytest references |
| `explain-complex-code` | Remove Python prototype examples; make language-neutral |

### Minimal rewrite needed (already mostly generic)
`commit`, `verify-plan`, `brainstorming-session`, `create-adr`, `save-progress`, `restore-progress`, `refactor`

### Agents
Copied as-is from or-migrator. Only change: remove `.claude/rules/code-quality.md` reference from `code-reviewer.md` (or-migrator-specific).

---

## Skill Authoring Convention

Every BDK skill follows this structure:

```markdown
---
description: ...
---

# Skill Name

> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md) for project context and MCP tool preference.

## When to use
...

## Process
1. [workflow steps only — no environment assumptions]
...
```

**Rules:**
- Never hardcode test runner, build tool, lint command, or file paths
- Write "run tests using the project's test runner" — not `pytest` or `go test`
- Never repeat MCP tool priority — the foundation covers it
- Reference project context as "read project context" — not explicit file paths
- Skills invoke agents by short name: `code-reviewer`, `explorer` — not `bdk:code-reviewer`
- Skills cross-reference other BDK skills using full namespace: `/bdk:create-plan`, `/bdk:debug`

---

## What Does NOT Go Into BDK

- Rules — project-specific (Froala, SEA, domain logic, etc.)
- Plans — generated per-project
- Project-specific hooks — drift detection, worktree setup
- Domain skills — `analyze-migration`, `create-fixture`, `graphviz-docs-compiler`
- Language-specific hooks — `format-python.sh`, `typecheck-python.sh` (too language-specific for a generic kit)
