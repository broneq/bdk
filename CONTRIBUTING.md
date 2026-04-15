# BDK — Contributing & Development

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

## Prerequisites

- Claude Code CLI installed
- A separate test project to install BDK into (any language/stack)
- (Optional) Serena and CodeGraph MCP servers — see `.mcp.json`

## Workflow

1. Edit skills, agents, or hooks in this repo
2. In a test project's Claude Code session, install locally:
   ```
   /plugin install ~/projects/bdk
   ```
3. Invoke the changed skill in the test project: `/bdk:<skill-name>`
4. Run evals if available — see `.claude/rules/skill-test-eval.md`

---

## Adding a Skill

1. Create `skills/<name>/skill.md`
2. Keep it language-agnostic — no hardcoded tool names, paths, or commands
3. Start with the standard header (see `.claude/rules/portability-check.md`)
4. Add an entry to the Skills table in `README.md`
5. Write an eval in `tests/skills/<name>/`

## Adding an Agent

1. Create `agents/<name>.md`
2. Assign a model (`haiku` / `sonnet` / `opus`) based on task complexity
3. Add an entry to the Agents table in `README.md`

---

## Hooks

- `hooks/hooks.json` — registers all hooks (currently: `SessionStart`)
- Hook scripts live in `hooks/` alongside the JSON
- New hooks: add a script, register it in `hooks.json`

---

## Running Tests

Requires [uv](https://docs.astral.sh/uv/).

```bash
uv run pytest
```

Dev dependencies (`pytest`) are declared in `pyproject.toml` under `[dependency-groups] dev` — uv installs them automatically on first run.

Test files use `*.test.py` naming (e.g. `check.test.py`) alongside `test_*.py`. Both patterns are picked up automatically.

### Hook tests

| Hook | Test file |
|------|-----------|
| `is-skill-exist` | `tests/hooks/is-skill-exist/check.test.py` |

---

## Modifying the Shared Foundation

`STARTUP_INSTRUCTIONS.md` is injected into every user session. Edit with care — it affects all skills and occupies context on every session start. Test in a fresh session after changes.

---

## What Does NOT Go Into BDK

These stay in the project-level `.claude/` of each repo:

- **Rules** — project-specific domain rules (architecture layers, domain logic, etc.)
- **Plans** — generated per-project
- **Project-specific hooks** — drift detection, worktree setup, directory creation
- **Domain skills** — feature-specific workflows
- **Language-specific hooks** — Python formatters, Go linters tied to one stack
