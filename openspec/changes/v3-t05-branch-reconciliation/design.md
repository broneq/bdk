# Design

## Context

See proposal.md - Why. The facts below come from trial merges (`git merge-tree --write-tree`) against `origin/staging/v3` at `b47aeaa`. The tips merged by T05, which the ancestry checks of `release-lines` use, are `origin/main` at `f567f04d296a5d4c41b09a0a12786e5ee088ccaa` and `origin/improvements-pack` at `abe1add8d59ef49dccdbac4766b97445ae3d0c2b`:

- **`main` (10 commits, 20 conflicting files).** Most conflicts come from T04, which landed on both lines. Everything else is a file that v3 rewrote since the fork: `scripts/inject.py`, `scripts/get_settings.py`, `hooks/check-bdk-config/*` and their tests (T12), `.claude/rules/*` and `.claude/skills/agent-lint` (T15). `docs/adr/0001-*.md` differs only by Prettier table formatting. The stop-hook graph fix (`cdea721`) is moot, because `hooks/hooks.json` on `staging/v3` has no graph entry after T04. The main-only content that must survive is: `CHANGELOG.md` and `.github/.release-please-manifest.json` at 2.7.0 (neither conflicts), and `plugin.json` at 2.7.0. `marketplace.json` is already identical.
- **`improvements-pack` (17 commits, 54 conflicting files).** Almost all conflicts are in files that v3 removed (`bdk-tier-*`, `fragments/tool-tiers/`, graph hooks, `render_startup.py`, `mcp-tool-naming.md`) or rewrote (injection scripts, their tests, agents, skills). They conflict with three commits on the branch: `f08fe2a` (ruff format), `0697817` (ruff lint fixes) and `c6a05f4` / `ece50d5` (skilllint frontmatter fixes). The branch also adds content that does not conflict: the site pages under `docs/`, `mkdocs.yml`, `docs.yml`, `docs-sync`, `Makefile`, `.pymarkdown.json`, `.claude-plugin/validator.json`, `.git-blame-ignore-revs` and the `lint` and `docs` dependency groups.
- **`docs/INJECTION-FLOWS.md`**, which the branch moves into the site as `contributing/injection-flows.md`, still describes the tool tiers and graph hooks on `staging/v3` (53 matches). It is dev-time material, and T13 rewrites it.
- The repository allows merge commits, and `delete_branch_on_merge` is on.
- The `yaml` package reads the `!!python/name:` tag in `mkdocs.yml` with a warning and an empty value, and does not fail.

## Goals / Non-Goals

**Goals:**

- Two merge commits with an auditable resolution. Each file group is resolved by one stated rule (D-2, D-3), so a reviewer can check the rule instead of every hunk.
- A site that builds strictly, contains nothing about removed mechanisms, and marks every v2 page.
- Every check from the branch that stays (ruff, drift guards, docs build) runs in CI on the PR.

**Non-Goals:**

- Correcting the prose of the v2 pages beyond removing the parts about removed mechanisms. The banner covers the rest until T50.
- Pre-commit hooks for ruff or mkdocs. CI and the `pnpm` scripts are the only entry points.

## Decisions

### D-1 Two sequential merge commits on the task branch, PR landed as a merge commit

The work happens on `v3/T05-branch-reconciliation`. First `git merge origin/main`, then `git merge origin/improvements-pack`, each with its own commit, and follow-up commits after that (site relocation, banners, tests, CI). The PR into `staging/v3` lands with "Create a merge commit". Squash and rebase are forbidden for this PR, because both would drop the merge parents and fail the ancestry check of `release-lines`.

- _Octopus merge:_ lost. Git's octopus strategy refuses to merge with conflicts, and one combined resolution cannot be reviewed per line.
- _Rebase or cherry-pick of the branch commits:_ lost. It rewrites the SHAs, which breaks `.git-blame-ignore-revs` (it names `f08fe2a`) and the ancestry check.
- _`main` last:_ lost. `main` is the smaller, more mechanical merge. Doing it first means the second merge works against a base that already carries the T04 backport on both sides.

### D-2 Resolution rule for `main`

| Files                                                                                                                                                                                      | Side                                     |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------- |
| Everything v3 rewrote or removed (`scripts/`, `hooks/`, `tests/unit/`, `skills/`, `agents/`, `.claude/rules/`, `.claude/skills/agent-lint`, `README.md`, `IDEAS.md`, `docs/adr/0001-*.md`) | `staging/v3`                             |
| `CHANGELOG.md`, `.github/.release-please-manifest.json`, the `version` in `.claude-plugin/plugin.json`                                                                                     | `main` (release-please owns them; 2.7.0) |
| `.claude-plugin/marketplace.json`                                                                                                                                                          | identical, no action                     |

Before a file group is resolved to the v3 side, its `main` diff since the fork is read once. This check makes sure no fix outside T04 is lost. The only such fix known today is `cdea721`, which is moot (see Context). `IDEAS.md` and `README.md` get a hunk-by-hunk look, because they are prose that both lines edit.

### D-3 Resolution rule for `improvements-pack`

| Group                                                                                                                                                                            | Rule                                                                                                                                                                                                                                                                                                        |
| -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Files deleted on `staging/v3` (`bdk-tier-*`, `fragments/tool-tiers/`, `hooks/register-graph-repo/`, `scripts/render_startup.py`, `.claude/rules/mcp-tool-naming.md`, tier tests) | stay deleted                                                                                                                                                                                                                                                                                                |
| `skills/`, `agents/`, `STARTUP_INSTRUCTIONS.md`, `.claude/rules/*`                                                                                                               | `staging/v3`. The skilllint hunks are then tried one by one, and a hunk stays only if it removes a `skill-check` baseline entry (`release-lines`)                                                                                                                                                           |
| `scripts/`, `hooks/`, `tests/unit/` (Python)                                                                                                                                     | `staging/v3`, then reformatted by ruff in a follow-up commit (D-8)                                                                                                                                                                                                                                          |
| `mkdocs.yml`, site pages, `.claude/skills/docs-sync/`, `tests/evals/skills/docs-sync/`, `.git-blame-ignore-revs`, `BUGS.md` move                                                 | branch                                                                                                                                                                                                                                                                                                      |
| `Makefile`, `.pymarkdown.json`, `.claude-plugin/validator.json`, `tests/unit/docs/`                                                                                              | removed in the merge commit (not taken; drift guards return as Vitest, D-5)                                                                                                                                                                                                                                 |
| `pyproject.toml`, `uv.lock`, `.gitignore`, `.github/workflows/tests.yml`, `CLAUDE.md`, `CONTRIBUTING.md`, `README.md`, `.claude-plugin/plugin.json`                              | by hand. `pyproject.toml` keeps `docs = ["mkdocs-material"]`, `lint = ["ruff==0.16.7"]` and the ruff config, without the mypy config. `uv.lock` is regenerated with `uv lock`. `tests.yml`, `CONTRIBUTING.md` and `README.md` take the v3 side and drop `make check`. `plugin.json` keeps the result of D-2 |

The merge commit holds only the resolution. The site relocation and all new content come in follow-up commits, so the merge diff shows only what the triage did.

### D-4 The site lives in `docs/guide/`

`mkdocs.yml` sets `docs_dir: docs/guide`, and the branch's pages move there with `git mv`. `edit_uri` becomes `edit/main/docs/guide/`.

- _`docs_dir: docs` with `exclude_docs` for the plan, archive, ADRs and HOST-FACTS:_ lost. Every new temporary document would need a config edit, or else the nav guard would fail. It would also mix a published site with material that `CLAUDE.md` calls temporary.
- _A top-level `site-docs/`:_ lost. `CLAUDE.md` already puts user documentation under `docs/`, and the issue keeps the site under `docs/`.
- _`docs/site/`:_ lost. It reads as the output directory `site/` that `mkdocs build` writes at the root.

`reference/settings.md` goes, together with the troubleshooting sections about `.bdk/settings.json`, `uvx` and graph registration, and the "first session is blocked" passage. They describe the v2 settings file and the `check-bdk-config` hook, which T12 removed, and the hook-path guard (D-5) would fail on them. Links to the settings point at the settings section of `README.md`, which T12 already wrote for v3 (user decision; rewriting the page now was rejected because the settings still change in T13 and T14).

`docs/INJECTION-FLOWS.md` stays where it is and is not a site page. It is contributor material that still describes tiers and graph hooks, and T13 rewrites it. `.claude/rules/fragment-system.md` keeps pointing at it, and `contributing/injection-flows.md` leaves the nav. `contributing/index.md` (a snippet of `CONTRIBUTING.md`) and `changelog.md` (a snippet of `CHANGELOG.md`) stay.

### D-5 Drift guards as Vitest in the `contract` project

The two pytest files become `kernel/tests/docs/coverage.test.ts` and `kernel/tests/docs/hook-references.test.ts`, and a third test, `kernel/tests/docs/banner.test.ts`, is added. The `contract` project's `include` in `vitest.config.ts` gains `kernel/tests/docs/**/*.test.ts`. `mkdocs.yml` is read with the `yaml` package and a custom tag for `!!python/name:`, so the parse has no warnings. User decision: Vitest now, not pytest until T32.

- _Keep pytest until T32:_ lost (user decision). T32 would have to rewrite the tests anyway, and they check repository content, which is what the `contract` project covers.
- _A fourth Vitest project `docs`:_ lost. It needs another CI step and script for three small tests that fit the existing contract step's purpose ("contract, structure and dependency tests over the whole repository").

### D-6 One banner, a `warning` admonition directly under the H1

```markdown
!!! warning "Describes BDK v2"

    This page describes BDK v2. The v3 documentation replaces it (T50).
```

The blank line after the admonition header makes the body an indented code block for Prettier, so `prettier --check` leaves it alone. Python-Markdown still renders it as the admonition body. The first page that gets the banner confirms both. The banner test checks for the exact header line.

- _A site-wide `announce` bar through a theme override:_ lost. T50 rewrites the pages one at a time, and a per-page banner lets each rewritten page drop its own banner. A global bar would say "v2" over v3 pages.
- _Rewrite the concept pages now:_ lost (user decision). T13, T41 and T42 change what they describe.

### D-7 Docs workflow: build everywhere, deploy only from `main`

`.github/workflows/docs.yml` triggers on `pull_request` and on `push` to `main` and `staging/v3`. The `build` job runs `uv run --group docs mkdocs build --strict`. The `deploy` job has `needs: build` and `if: github.event_name == 'push' && github.ref == 'refs/heads/main'`, and runs `mkdocs gh-deploy --force` with `contents: write`. It keeps the branch's git identity step. Action versions follow `tests.yml` (`actions/checkout@v7`). `pnpm docs:build` runs the same build locally. User decision: no deploy before 3.0.

- _The branch's deploy-only workflow with the build in `make check`:_ lost with the `Makefile`.
- _`workflow_dispatch` deploy:_ lost (user decision). It allows a deploy of v2 pages to the public URL before 3.0.

### D-8 ruff runs in the Python job and in `pnpm lint:py`

The `pytest` job in `tests.yml` gains two steps before the tests: `uv run --group lint ruff check` and `uv run --group lint ruff format --check`. `package.json` gains `"lint:py": "uv run --group lint ruff check && uv run --group lint ruff format --check"`. After the merge, the v3-side Python files are brought to ruff's state in one commit, `style: apply ruff format to the v3 scripts`, and its SHA is appended to `.git-blame-ignore-revs` in a later commit. The merge-commit landing of D-1 keeps that SHA. Lint findings in v3-side files are fixed in a separate `fix:` commit, because they change code.

- _mypy, actionlint-py, pymarkdown, skilllint from the `lint` group:_ lost. mypy guards code that T32 deletes. `tests.yml` already lints the workflows. pymarkdown is a user decision (Prettier covers Markdown). skilllint is replaced by `skill-check` (T15).

### D-9 `docs-sync` repointed at the v3 tree

The skill's step 1 runs `pnpm test:contract` instead of pytest. The docs map drops rows for removed files (`render_startup.py`, `register-graph-repo`, `.mcp.json`, `fragments/tool-tiers/`, `get_settings.py`, `hooks/check-bdk-config/settings.schema.json`, `Makefile`) and repoints settings rows at `kernel/src/ctx/config.ts` and `schema/settings.schema.json`. All page paths become `docs/guide/...`. The skill stays under `.claude/skills/`, so it does not ship with the plugin. `skill-check` targets only `skills/` and `agents/`.

### D-10 Small items

- `BUGS.md` moves to the root. Its one row ("Add MCP tool injections into newly added agents") is dropped, because ADR-0001 removed the bundled MCP servers, and the file says a row goes when it lands or dies.
- `CLAUDE.md`'s `docs/` line becomes: temporary material, task artifacts, ADRs and the user documentation site (`docs/guide/`). The Architecture tree gains `mkdocs.yml`, and Development Commands gains `pnpm lint:py` and `pnpm docs:build`.
- `improvements-pack` is deleted on `origin` after the PR merges. The branch tip is then reachable from `staging/v3`, so nothing is lost.

## Risks / Trade-offs

- [A reviewer merges the PR with squash out of habit] → The PR body opens with the landing instruction, and the acceptance check (`git merge-base --is-ancestor`) runs after the merge. If it fails, the fix is to revert the squash and re-land.
- [A "v3 side wins" resolution silently drops a `main` fix outside T04] → D-2 reads each file group's `main` diff since the fork before resolving it. The commit list is short (10 commits), and all 10 are named in Context.
- [Prettier reformats the imported pages (tables) and makes the format diff noisy] → The formatting is its own `style:` commit after the relocation, so the content commits stay readable.
- [A banner rendered wrong by the blank-line form] → Checked on the first page with `mkdocs build --strict` and a look at the built HTML before the rest of the pages get it.
- [The `docs` group pulls a large dependency tree into `uv.lock`] → It is a dependency group that only the docs workflow installs. The pytest job syncs without it.

## Migration Plan

1. Merge `main` (D-2) and commit. Run `pytest tests/unit/`, `pnpm test:contract` and `pnpm skill-check`.
2. Merge `improvements-pack` (D-3) and commit. Run the same checks plus `uv lock --check`.
3. Follow-up commits: site relocation and removals, banners, Vitest guards (test first), ruff format and fixes, CI and scripts, `docs-sync`, `CLAUDE.md`, `BUGS.md`.
4. Full CI on the PR, then land it with a merge commit, run the ancestry checks, delete `improvements-pack` and close #83.

Rollback before landing: reset the task branch. After landing: `git revert -m 1 <PR merge commit>` on `staging/v3`, which restores the pre-T05 tree. The merged tips stay ancestors, so a later retry needs a revert of the revert.
