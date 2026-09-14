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

- [uv](https://docs.astral.sh/uv/) - installs and pins every lint/test tool
- GNU Make - `make` is the single entrypoint for every check
- Claude Code CLI on `PATH` - **required**, not optional: the `plugin` gate
  shells out to `claude plugin validate`. The gate does not skip itself when
  the CLI is missing, on purpose. A gate that quietly opts out is worse than
  no gate, because it goes green on every machine where nobody installed it.
- A separate test project to install BDK into (any language/stack)
- (Optional) Serena and code-review-graph MCP servers - see `.mcp.json`

One-time local setup, so `git blame` skips the formatting commit the way
GitHub's web blame already does:

```bash
git config blame.ignoreRevsFile .git-blame-ignore-revs
```

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

## Checks

One command validates the whole repo, and it is the same command CI runs:

```bash
make check        # every gate, including the test suite (~45s)
make check-fast   # everything except pytest (~7s) - the pre-push loop
make fix          # autofix what is autofixable, then report what is left
make help         # the target list, plus what `check` is composed of
```

`make check` runs **every** gate even after one fails, then prints the full
list of failures. The gates are mutually independent, so stopping at the first
one would turn a branch with three problems into three CI round-trips.

Each gate is also a target on its own, which is what the failure summary tells
you to re-run:

| Target | What it runs |
|---|---|
| `format-check` | `ruff format --check` |
| `lint` | `ruff check` |
| `typecheck` | `mypy`, one invocation per source directory |
| `actions` | `actionlint` on `.github/workflows` |
| `plugin` | `claude plugin validate` on `skills/` and `agents/` |
| `skills` | `skilllint` - skill/agent frontmatter and manifests |
| `markdown` | `pymarkdown` on `docs/` |
| `docs` | `mkdocs build --strict` |
| `test` | `pytest tests/unit/ -q` |

Tool versions are pinned exactly in `pyproject.toml` under
`[dependency-groups] lint` and locked in `uv.lock`, so a bump arrives as a
reviewable diff instead of as a red build one morning. `uv` installs them on
first run.

`.github/workflows/tests.yml` has exactly one command, `make check`. Keep it
that way: the moment a workflow step inlines a tool invocation, local and CI
can drift and the Makefile stops being the answer to "what does CI run".

### Suppressed findings

`.claude-plugin/validator.json` silences two skilllint codes repo-wide:

- **AG002** (~160 hits, "MCP tool not found"). skilllint's
  `rules/_mcp_tool_discovery.py::collect_plugin_names_from_ancestry` reads
  `mcpServers` only from `.claude-plugin/plugin.json` and never from a
  `.mcp.json` at the plugin root. The plugins reference allows both spellings,
  and BDK uses `.mcp.json` - so this is a gap in the linter, not in BDK.
  Duplicating the server definitions into `plugin.json` to appease it would
  create two places to drift. Nothing is blinded by the suppression: the
  `mcp__plugin_bdk_` prefix is enforced by
  `tests/unit/agents/test_agent_tools.py`, which parametrizes over every agent
  and carries a negative test. To be reported upstream.
- **AS008**, plus **SK007** scoped to `skills/subagent-execute-plan` (that
  skill's body is over the token budget; splitting it is a product change and
  gets its own PR).

`SK005`, `FM007` and `FM004` are deliberately left on: they are readable,
non-blocking, and occasionally right. Only errors fail a gate; skilllint
warnings do not.

### Test layout

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

`.github/workflows/docs.yml` deploys to GitHub Pages on merge to `main`, and
does nothing else. There is no manual publish step.

The build is verified by the `docs` gate in `make check`, which runs on every
pull request without a path filter. That ordering matters: the workflow used
to carry its own path-filtered build job, so a change under `skills/` could
break the drift guard in `tests/unit/docs/test_docs_coverage.py` and still
never run `mkdocs build --strict`.

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
