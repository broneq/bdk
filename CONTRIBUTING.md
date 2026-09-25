# BDK — Contributing & Development

## Architecture

### Convention-Driven with Shared Foundation

Skills are thin workflow definitions. Environment discovery is handled by `STARTUP_INSTRUCTIONS.md`, injected at session start via the `SessionStart` hook.

**Benefits:**
- Single source of truth for BDK conventions
- Skills stay clean — workflow logic only, no environment assumptions
- New skills automatically inherit all rules
- Changes to conventions require editing one file, not 13

### Built-in Tools Only

BDK ships no MCP server (see `docs/adr/0001-remove-bundled-mcp-servers.md`). Skills and agents run on the host's built-in tools, and the host already tells the model how to use them. So BDK adds no tool guidance: a skill or agent step says what to find or check, not which tool to use for it.

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

Both `test_*.py` and `*.test.py` are collected (see `[tool.pytest.ini_options] python_files` in `pyproject.toml`); new tests should use `test_*.py`.

Tests mirror the layout of what they cover: `tests/unit/scripts/`, `tests/unit/hooks/<hook-name>/`, `tests/unit/skills/<skill-name>/`, `tests/unit/agents/`, `tests/unit/fragments/`. Hook tests therefore live at `tests/unit/hooks/is-skill-exist/test_check.py`, not under a top-level `tests/hooks/`.

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

---

## Writing Fragments

Fragments are conditional Markdown files injected into skills at load time.

### Creating a Fragment

1. Decide scope: shared (`fragments/<capability>/`) or skill-local (`skills/<name>/fragments/`)
2. Name the file after the feature it serves (e.g. `lavish.md`, `react.md`)
3. Keep content under 10 lines; longer content should be split into multiple fragments
4. Inject it with one `inject.py --if` call placed right before the section it augments:

```markdown
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --if features.react --then ${CLAUDE_SKILL_DIR}/fragments/react.md`
```

Agents are static markdown with no shell execution at load time: they get dynamic content by preloading a `bdk-rules-*` (or other meta-) skill via `skills:` frontmatter.
