# BDK — Broneq Dev Kit

A personal Claude Code plugin packaging reusable dev workflows, skills, agents, and hooks into a single installable unit.

**Core design principle**: Language-agnostic by default. Skills contain workflow logic only; environment discovery is delegated to `STARTUP_INSTRUCTIONS.md` and the local project's `CLAUDE.md`.

---

## Installation

**From GitHub directly (recommended until marketplace listing is live):**

1. Add the BDK marketplace source:
   ```
   /plugin marketplace add broneq/bdk
   ```
2. Install:
   ```
   /plugin install bdk@bdk
   ```

---

## Skills

Invoke with `/bdk:<skill-name>`:

| Skill | Description                                                                                         |
|-------|-----------------------------------------------------------------------------------------------------|
| `/bdk:setup` | Initialize `.bdk/settings.json` — run once per project before using other skills                    |
| `/bdk:cr` | Dynamic code review (3-13 parallel agents based on change size)                                     |
| `/bdk:commit` | Generate conventional commit message from git changes                                               |
| `/bdk:create-plan` | Create TDD-driven implementation plans                                                              |
| `/bdk:execute-plan` | Execute a plan with task tracking and verification                                                  |
| `/bdk:verify-plan` | Verify a plan against real code before execution                                                    |
| `/bdk:debug` | Structured debugging: investigate → failing tests → fix or plan                                     |
| `/bdk:refactor` | Propose object-oriented architecture for complex code                                               |
| `/bdk:test-driven-development` | Rigid TDD cycle: red → green                                                                        |
| `/bdk:brainstorming` | Design sessions before implementation                                                               |
| `/bdk:create-adr` | Generate Architecture Decision Records (MADR format)                                                |
| `/bdk:save-progress` | Checkpoint in-progress work to `.bdk/save-progress/`                                                |
| `/bdk:restore-progress` | Resume work from a saved checkpoint                                                                 |
| `/bdk:explain-complex-code` | Generate architecture docs with Graphviz diagrams                                                   |
| `/bdk:update-docs` | Refresh existing architecture docs after code changes                                               |
| `/bdk:graphviz-docs-compiler` | Compile `.dot` files to SVG and update markdown references                                          |
| `/bdk:graph-review` | Risk-aware code review using knowledge graph — change detection, impact analysis, test coverage     |
| `/bdk:graph-explore` | Navigate codebase structure using knowledge graph — stats, architecture, call relationships         |
| `/bdk:graph-debug` | Debug issues using graph-powered code navigation — trace call chains, correlate with recent changes |
| `/bdk:graph-refactor` | Safe refactoring using dependency analysis — dead code, rename preview, impact verification         |

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

## Quality Rules

BDK ships language-agnostic rule sets (`code-quality`, `architecture`) injected into `/bdk:cr` and `/bdk:create-plan` outputs.

### Four usage patterns

**1. Zero config (recommended for most projects).** No settings entry. BDK defaults are used as-is.

**2. Extend defaults.** Point `.bdk/settings.json` at a file with project-specific additions:

```json
{
  "quality": {
    "code-quality": "docs/standards/coding.md"
  }
}
```

The BDK default content is emitted first, then your file's content appended.

**3. Replace defaults.** When your project has its own complete rule set:

```json
{
  "quality": {
    "code-quality": {
      "path": "docs/standards/coding.md",
      "mode": "replace"
    }
  }
}
```

**4. Point at existing project doc.** Same as pattern 2, but the path can be any existing standards doc — no copy needed.

### Behaviour on misconfiguration

If `.bdk/settings.json` references a file that doesn't exist (or is unreadable), `inject-rules.py` exits 1 with a clear error. `/bdk:cr` and `/bdk:create-plan` will surface the error and stop, rather than silently dropping the rule context.

### Adding a new rule category

See `.claude/rules/quality-rules.md` (BDK-dev convention).

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
