# Proposal

## Why

Plan: none; `docs/V3-IMPLEMENTATION-PLAN.md` does not list T05, and issue #83 holds its scope. Tracks #83.

`staging/v3` has drifted from the two other lines of history. `origin/main` has 10 commits that `staging/v3` lacks: the T04 backport, releases 2.6.1 and 2.7.0, the stop-hook graph fix and the `bdk-skill-kit` marketplace entry. A trial merge conflicts in 20 files. `origin/improvements-pack` (PRs #40, #41, #42) has 17 commits that are on neither line. It carries the MkDocs user documentation site, the `docs-sync` dev skill and a Python lint toolchain, and a trial merge conflicts in 54 files. The next v3 tasks rewrite the files where these conflicts are: T13 (injection scripts, hooks), T32 (the Python cut), T41 and T42 (skills, agents). Each of those tasks makes the merge larger. T05 reconciles the lines now, so no later task inherits the merge. It also keeps the site and its tooling as the place where T50 writes the v3 user documentation.

## What Changes

- **`main` into `staging/v3`** as a merge commit, not a rebase. In a conflict the v3 side wins, except where `main` carries a fix that `staging/v3` lacks: the release-please manifest and `CHANGELOG.md` at 2.7.0, the plugin version and the marketplace entries. The stop-hook graph fix needs no hunk, because T04 already removed the graph hooks on `staging/v3`.
- **`improvements-pack` into `staging/v3`** as a merge commit with a triaged resolution, so the branch tip becomes an ancestor of `staging/v3`, not a blind merge:
  - Kept: `mkdocs.yml`, the site pages, `.github/workflows/docs.yml` (rewritten), the dev-time `docs-sync` skill (`.claude/skills/docs-sync/`) with its eval, and `.git-blame-ignore-revs`. The `ruff format` commit comes in with the history, so the ignore file stays valid.
  - Kept, reworked: ruff lint and format for the Python scripts until T32. They run from the existing `pytest` CI job and from one `pnpm` script, and there is no `Makefile` or `make check`.
  - Kept, moved: the docs drift guards (`test_docs_coverage.py`, `test_hook_references.py`) become Vitest tests in the `contract` project.
  - Moved: `BUGS.md` goes to the repository root, as on the branch.
  - Not taken: `Makefile`, `.pymarkdown.json`, `.claude-plugin/validator.json`, and the pinned `mypy`, `skilllint`, `actionlint-py` and `pymarkdownlnt`. Also not taken: the frontmatter fixes made for skilllint (a fix comes over only when it removes a baselined `skill-check` finding, followed by `--baseline-prune`), edits to files v3 removed (`bdk-tier-*`, `fragments/tool-tiers/`, graph hooks, `mcp-tool-naming.md`), and the README rewrite where it describes v2 behaviour.
- **Site scope and content:**
  - The site moves into its own subtree under `docs/` (`docs_dir`). Temporary material, task artifacts, ADRs and the `docs/v3/` archive stay outside the site.
  - Pages about removed mechanisms go: `concepts/tool-tiers.md`, `workflows/choosing-a-tier.md`, and the MCP and graph parts of the other pages.
  - Every other page opens with a banner. The banner says the page describes v2 and that T50 rewrites it for v3.
- **Docs workflow:** `mkdocs build --strict` runs on every pull request. The site deploys to GitHub Pages only on a push to `main`. `main` has no site before the 3.0 release, so the first deploy is the 3.0 release.
- **`CLAUDE.md`** names the site in its `docs/` convention. `improvements-pack` is deleted after the merge.

Resolutions of the issue's "To resolve in the spec" (user decisions; alternatives in design.md):

- **`.pymarkdown.json`** goes. Prettier alone covers Markdown. Keeping pymarkdown would mean a second Markdown tool that T32 removes anyway.
- **Docs tests** move to Vitest now, not pytest. T32 then does not need to touch them.
- **Docs deploy** runs on a push to `main` only, and `mkdocs build --strict` runs on every pull request. The default applies: no deploy before 3.0.
- **Concept pages** get the v2 banner and are not rewritten now. The mechanisms they describe change again in T13, T41 and T42, so a rewrite now would go stale. T50 rewrites them.

Inputs carried by citation: ADR-0001 (the removal of the bundled MCP servers and tool tiers), the T04 archive (`plugin-tooling`), the T15 archive (`skill-content-checks`, Baseline for v2 content), `kernel-architecture` CI pipeline and Tests per slice.

Out of scope:

- The v3 user documentation itself (T50). T05 only adds the banners and removes the pages about removed mechanisms.
- Removing the Python scripts and their ruff config (T32).
- Rewriting the injection scripts, hooks, skills and agents that the merge touches (T13, T41, T42). The merge takes the v3 side of these files and adds nothing to them.
- Any change to `main`. `improvements-pack` does not go to `main`, and v2 gets no site.

## Capabilities

### New Capabilities

- `docs-site`: the user documentation site. Covers where the site lives under `docs/`, the strict build, the drift guards (skills, agents, nav, hook paths), the v2 banner, and the absence of pages about removed mechanisms. Also covers when the site deploys and the `docs-sync` dev skill that keeps it true to the code.
- `release-lines`: how `staging/v3` relates to `main` and to side branches. `staging/v3` contains the tip of `main` and of every merged side branch, and it gets them through merge commits, so that history and ancestry checks hold. A reconciliation does not grow the `skill-check` baseline.

### Modified Capabilities

- `kernel-architecture`: requirement "CI pipeline". The Python job also runs ruff lint and ruff format check, and a docs workflow builds the site strictly on every pull request. The claim "the CI jobs of the existing Python suite are unaffected" no longer holds.

## Impact

- New files: `mkdocs.yml`, the site subtree under `docs/`, `.github/workflows/docs.yml`, `.claude/skills/docs-sync/`, `tests/evals/skills/docs-sync/`, `.git-blame-ignore-revs`, `BUGS.md`, and Vitest drift guards under `kernel/tests/`.
- Changed: `pyproject.toml` (`docs` and `lint` dependency groups, ruff config), `uv.lock`, `package.json` (a `lint:py` and a `docs:build` script), `.github/workflows/tests.yml` (ruff steps), `CLAUDE.md`, `CONTRIBUTING.md`, `README.md` (the parts that do not describe v2), `.claude/rules/fragment-system.md` (new path of the injection-flows page), `.github/.release-please-manifest.json`, `.claude-plugin/plugin.json` (2.7.0), and Python files reformatted by ruff.
- Removed: `docs/BUGS.md` (moved), `docs/INJECTION-FLOWS.md` (moved into the site), and the `improvements-pack` branch.
- The PR into `staging/v3` must land with a merge commit. A squash or rebase merge would drop both merge parents and break the ancestry acceptance check.
