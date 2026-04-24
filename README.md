# BDK — Broneq Dev Kit

A personal Claude Code plugin packaging reusable dev workflows, skills, agents, and hooks into a single installable unit.

**Core design principle**: Language-agnostic by default. Skills contain workflow logic only; environment discovery is delegated to `STARTUP_INSTRUCTIONS.md` and the local project's `CLAUDE.md`.

---

## Installation

```bash
# From GitHub (once published)
/plugin install bdk@broneq
```

---

## Skills

Invoke with `/bdk:<skill-name>`:

| Skill | Description |
|-------|-------------|
| `/bdk:setup` | Initialize `.bdk/settings.json` — run once per project before using other skills |
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
| `/bdk:graph-review` | Risk-aware code review using knowledge graph — change detection, impact analysis, test coverage |
| `/bdk:graph-explore` | Navigate codebase structure using knowledge graph — stats, architecture, call relationships |
| `/bdk:graph-debug` | Debug issues using graph-powered code navigation — trace call chains, correlate with recent changes |
| `/bdk:graph-refactor` | Safe refactoring using dependency analysis — dead code, rename preview, impact verification |

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
| `log-analyzer` | haiku | Parse and summarize error logs |
| `web-researcher` | haiku | Search web for solutions and docs |

---

## What Does NOT Go Into BDK

These stay in the project-level `.claude/` of each repo:

- **Rules** — project-specific domain rules (architecture layers, domain logic, etc.)
- **Plans** — generated per-project
- **Project-specific hooks** — drift detection, worktree setup, directory creation
- **Domain skills** — feature-specific workflows
- **Language-specific hooks** — Python formatters, Go linters tied to one stack

---

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, authoring conventions, and how to add skills/agents.
