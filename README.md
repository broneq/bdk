# BDK — Broneq Dev Kit

A personal Claude Code plugin packaging reusable dev workflows, skills, agents, and hooks into a single installable unit.

**Core design principle**: Language-agnostic by default. Skills contain workflow logic only; environment discovery is delegated to `STARTUP_INSTRUCTIONS.md` and the local project's `CLAUDE.md`.

---

## Installation

```bash
# Local development
/plugin install ~/projects/bdk

# From GitHub (once published)
/plugin install bdk@broneq
```

---

## Skills

Invoke with `/bdk:<skill-name>`:

| Skill | Description |
|-------|-------------|
| `/bdk:cr` | Dynamic code review (3-13 parallel agents based on change size) |
| `/bdk:commit` | Generate conventional commit message from git changes |
| `/bdk:create-plan` | Create TDD-driven implementation plans |
| `/bdk:execute-plan` | Execute a plan with task tracking and verification |
| `/bdk:verify-plan` | Verify a plan against real code before execution |
| `/bdk:debug` | Structured debugging: investigate → failing tests → fix or plan |
| `/bdk:refactor` | Propose object-oriented architecture for complex code |
| `/bdk:test-driven-development` | Rigid TDD cycle: red → green |
| `/bdk:brainstorming-session` | Design sessions before implementation |
| `/bdk:create-adr` | Generate Architecture Decision Records (MADR format) |
| `/bdk:save-progress` | Checkpoint in-progress work to `docs/progress/` |
| `/bdk:restore-progress` | Resume work from a saved checkpoint |
| `/bdk:explain-complex-code` | Generate architecture docs with Graphviz diagrams |
| `/bdk:update-docs` | Refresh existing architecture docs after code changes |
| `/bdk:graphviz-docs-compiler` | Compile `.dot` files to SVG and update markdown references |
| `/bdk:analyze-migration` | Analyse migration tasks and risks |

---

## Agents

Used by skills internally (invoke via `subagent_type`):

| Agent | Model | Purpose |
|-------|-------|---------|
| `code-reviewer` | sonnet | Layer-group deep code review |
| `explorer` | haiku | Fast codebase exploration (CodeGraph → Serena → Grep) |
| `test-runner` | haiku | Run tests, parse and report results |
| `dead-code-detector` | haiku | Find unreachable/unused code |
| `duplicate-detector` | haiku | Find code duplication |
| `architecture-reviewer` | opus | Audit against architectural rules |
| `static-analyse` | haiku | Detect and run project lint/format/type-check |
| `step-simulator` | opus | Dry-run plans with concrete data traces |
| `helper-writer` | sonnet | Write utility functions and helpers |
| `log-analyzer` | haiku | Parse and summarize error logs |
| `web-researcher` | haiku | Search web for solutions and docs |

---

## Architecture

### Convention-Driven with Shared Foundation

Skills are thin workflow definitions. Environment discovery is handled by `STARTUP_INSTRUCTIONS.md`, injected at session start via the `SessionStart` hook.

**Benefits:**
- Single source of truth for BDK conventions
- Skills stay clean — workflow logic only, no environment assumptions
- New skills automatically inherit all rules
- Changes to conventions require editing one file, not 13

### MCP Tool Preference (Tier System)

All BDK skills follow this tier system for codebase exploration:

- **Tier 1:** CodeGraph — symbol search, callers/callees, impact analysis
- **Tier 2:** Serena — AST-level analysis, referencing symbols
- **Tier 3:** Grep/Glob/Read — always available fallback

### Skill Authoring Convention

Every BDK skill:
1. Starts with `> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md)...`
2. Never hardcodes test runners, build tools, lint commands, or file paths
3. References other skills with full namespace: `/bdk:create-plan`, `/bdk:debug`
4. Uses "run the project's test suite" — not `pytest` or `go test`

---

## What Does NOT Go Into BDK

These stay in the project-level `.claude/` of each repo:

- **Rules** — project-specific domain rules (architecture layers, domain logic, etc.)
- **Plans** — generated per-project
- **Project-specific hooks** — drift detection, worktree setup, directory creation
- **Domain skills** — feature-specific workflows
- **Language-specific hooks** — Python formatters, Go linters tied to one stack
