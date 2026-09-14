# BDK - Contributing & Development

## Architecture

### Convention-Driven with Shared Foundation

Skills are thin workflow definitions. Environment discovery is handled by `STARTUP_INSTRUCTIONS.md`, injected at session start via the `SessionStart` hook.

**Benefits:**
- Single source of truth for BDK conventions
- Skills stay clean - workflow logic only, no environment assumptions
- New skills automatically inherit all rules
- Changes to conventions require editing one file, not 13

### MCP Tool Preference (Tier System)

All BDK skills follow this tier system for codebase exploration:

- **Tier 1:** code-review-graph - symbol search, callers/callees, impact analysis
- **Tier 2:** Serena - AST-level analysis, referencing symbols
- **Tier 3:** Grep/Glob/Read - always available fallback

### Skill Authoring Convention

Every BDK skill:
1. Starts with `> Relies on BDK foundation (STARTUP_INSTRUCTIONS.md)...`
2. Never hardcodes test runners, build tools, lint commands, or file paths
3. References other skills with full namespace: `/bdk:create-plan`, `/bdk:debug`
4. Uses "run the project's test suite" - not `pytest` or `go test`

---

## Prerequisites

- Claude Code CLI installed
- A separate test project to install BDK into (any language/stack)
- (Optional) Serena and code-review-graph MCP servers - see `.mcp.json`

## Workflow

1. Edit skills, agents, or hooks in this repo
2. Launch Claude Code from the test project directory with the local plugin directory:
   ```bash
   claude --plugin-dir ~/projects/bdk
   ```
3. Invoke the changed skill in the test project: `/bdk:<skill-name>`
4. Run evals if available - see `.claude/rules/skill-test-eval.md`

---

## Adding a Skill

1. Create `skills/<name>/SKILL.md`
2. Keep it language-agnostic - no hardcoded tool names, paths, or commands
3. Start with the standard header (see `.claude/rules/portability-check.md`)
4. Add an entry to the Skills table in `README.md`
5. Write an eval in `tests/evals/skills/<name>/`

## Adding an Agent

1. Create `agents/<name>.md`
2. Assign a model (`haiku` / `sonnet` / `opus`) based on task complexity
3. Add an entry to the Agents table in `README.md`

---

## Hooks

- `hooks/hooks.json` - registers all hooks (currently: `SessionStart` and `Stop`)
- Hook scripts live in `hooks/` alongside the JSON
- New hooks: add a script, register it in `hooks.json`

---

## Running Tests

Requires [uv](https://docs.astral.sh/uv/).

```bash
uv run pytest
```

Dev dependencies (`pytest`) are declared in `pyproject.toml` under `[dependency-groups] dev` - uv installs them automatically on first run.

Both `test_*.py` and `*.test.py` are collected (see `[tool.pytest.ini_options] python_files` in `pyproject.toml`); new tests should use `test_*.py`.

Tests mirror the layout of what they cover: `tests/unit/scripts/`, `tests/unit/hooks/<hook-name>/`, `tests/unit/skills/<skill-name>/`, `tests/unit/agents/`, `tests/unit/fragments/`. Hook tests therefore live at `tests/unit/hooks/is-skill-exist/test_check.py`, not under a top-level `tests/hooks/`.

---

## Documentation

User-facing documentation is an MkDocs Material site built from `docs/`.

```bash
uv run --group docs mkdocs serve             # local preview on http://127.0.0.1:8000
uv run --group docs mkdocs build --strict    # the gate CI runs
```

### Where a page goes

The `docs/` tree follows Diátaxis. Pick the folder by what the page *does*, not by which skill it happens to mention:

| Kind of page | Answers | Folder |
|---|---|---|
| Tutorial | "Walk me through my first one." | `docs/getting-started/` |
| How-to | "How do I get this specific job done?" | `docs/workflows/` |
| Explanation | "Why is it built this way?" | `docs/concepts/` |
| Reference | "What exactly are the fields, flags, and paths?" | `docs/reference/` |

A page that fits two of these is two pages. Every new page must also be added to `nav` in `mkdocs.yml`: `mkdocs build --strict` fails on a nav entry with no file, and the drift test below fails on a file with no nav entry.

### Drift guard

`tests/unit/docs/test_docs_coverage.py` fails when:

- a user-invocable skill is missing from the Skills table in `README.md` or has no `## /bdk:<name>` heading in `docs/reference/skills.md`
- an agent from `agents/` is missing from `docs/reference/agents.md`
- a `.md` file under `docs/` is not referenced in the `mkdocs.yml` `nav`

So adding a skill or an agent means updating the docs in the same commit.

### Deployment

`.github/workflows/docs.yml` builds the site on every pull request and deploys it to GitHub Pages on merge to `main`. There is no manual publish step.

### Writing rules

- English. Plain dash only, never an em dash.
- Skill and agent names in namespaced form: `/bdk:cr`, `bdk:explorer`.
- MCP tool names in the plugin-prefixed form, per `.claude/rules/mcp-tool-naming.md`.
- Terminal output blocks are copied from the `SKILL.md` that emits them, not paraphrased.
- No invented behaviour: every factual statement traces to a file in the repo.
- `CHANGELOG.md` is auto-generated by release-please and is never edited by hand; the site includes it by snippet.

---

## Modifying the Shared Foundation

`STARTUP_INSTRUCTIONS.md` is injected into every user session. Edit with care - it affects all skills and occupies context on every session start. Test in a fresh session after changes.

---

## What Does NOT Go Into BDK

These stay in the project-level `.claude/` of each repo:

- **Rules** - project-specific domain rules (architecture layers, domain logic, etc.)
- **Plans** - generated per-project
- **Project-specific hooks** - drift detection, worktree setup, directory creation
- **Domain skills** - feature-specific workflows
- **Language-specific hooks** - Python formatters, Go linters tied to one stack

---

## Writing Fragments

Fragments are conditional Markdown files injected into skills at load time.

### Creating a Leaf Fragment

1. Decide scope: shared (`fragments/<capability>/`) or skill-local (`skills/<name>/fragments/`)
2. Name the file after the tool tier or feature it teaches (e.g. `search-serena.md`)
3. Write content that teaches Claude WHEN and HOW to use the tools - not just a tool list
4. Keep content under 10 lines; longer content should be split into multiple fragments

### Creating a Chain File

1. Create `<purpose>.chain.json` in the same directory as the leaf files
2. Choose mode:
   - `exclusive` - fallback tiers (first match wins)
   - `additive` - complementary tools (all matches combined)
3. Paths are relative to the chain file's own directory
4. The last entry in an exclusive chain may have no `"if"` - unconditional fallback

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

- **Graph-only skills**: a skill that requires code-review-graph by design has no lower tier to fall back to; no chain migration applies
- **Agents**: static markdown, no shell execution at load time; preload a `bdk-tier-*` meta-skill via `skills:` frontmatter instead
