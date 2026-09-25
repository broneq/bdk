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

BDK ships no MCP server (see `docs/adr/0001-remove-bundled-mcp-servers.md`). Skills and agents explore code with the host's built-in tools: `Grep`, `Glob` and `Read` in subagents, and `Bash` with `rg`, `grep`, `find` or `git` where a session has no `Grep` / `Glob`. The tool guidance lives in the `fragments/tool-tiers/` chains, one text per purpose.

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

### Creating a Leaf Fragment

1. Decide scope: shared (`fragments/<capability>/`) or skill-local (`skills/<name>/fragments/`)
2. Name the file after the purpose or feature it teaches (e.g. `search-fallback.md`, `react.md`)
3. Write content that teaches Claude WHEN and HOW to use the tools — not just a tool list
4. Keep content under 10 lines; longer content should be split into multiple fragments

### Creating a Chain File

1. Create `<purpose>.chain.json` in the same directory as the leaf files
2. Choose mode:
   - `exclusive` — fallback tiers (first match wins)
   - `additive` — complementary tools (all matches combined)
3. Paths are relative to the chain file's own directory
4. The last entry in an exclusive chain may have no `"if"` — unconditional fallback

```json
{
  "mode": "exclusive",
  "chain": [
    { "if": ["features.react"], "then": "components-react.md" },
    { "if": ["features.vue"], "then": "components-vue.md" },
    { "then": "components-plain.md" }
  ]
}
```

### Referencing a Chain from a Skill

```markdown
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json`
```

### Naming Conventions

- Chain files: `<purpose>.chain.json`
- Leaf files: `<purpose>-<variant>.md` (e.g. `components-react.md`, `components-plain.md`)
- The tool-tier chains hold one entry each, `<purpose>-fallback.md`; the name stays so a future tier can be added without renaming consumers

### When NOT to Use Chains

- **Agents**: static markdown, no shell execution at load time; preload a `bdk-tier-*` meta-skill via `skills:` frontmatter instead
