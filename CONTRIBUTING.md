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

---

## Writing Fragments

Fragments are conditional Markdown files injected into skills at load time.

### Creating a Leaf Fragment

1. Decide scope: shared (`fragments/<capability>/`) or skill-local (`skills/<name>/fragments/`)
2. Name the file after the tool tier or feature it teaches (e.g. `search-serena.md`)
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
    { "if": ["features.code-review-graph"], "then": "search-graph.md" },
    { "if": ["features.serena"], "then": "search-serena.md" },
    { "then": "search-fallback.md" }
  ]
}
```

### Referencing a Chain from a Skill

```markdown
!`python3 ${CLAUDE_PLUGIN_ROOT}/scripts/inject.py --chain ${CLAUDE_PLUGIN_ROOT}/fragments/tool-tiers/search.chain.json`
```

### Naming Conventions

- Chain files: `<purpose>.chain.json`
- Leaf files: `<purpose>-<tier>.md` (e.g. `search-graph.md`, `search-serena.md`, `search-fallback.md`)
- Tier names: `graph`, `serena`, `fallback`

### When NOT to Use Chains

- **Graph-only skills** (`graph-explore`, `graph-debug`, `graph-review`, `graph-refactor`): these require code-review-graph by design; no chain migration applies
- **Agents**: static markdown, no shell execution at load time; use body text subsections instead
