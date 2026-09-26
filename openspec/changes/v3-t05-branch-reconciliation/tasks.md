# Tasks

## 1. Merge `main` (design D-1, D-2)

- [x] 1.1 Record the tips of `origin/main` and `origin/improvements-pack` in this change's `design.md` Context (they are the SHAs the acceptance check uses), and verify both with `git rev-parse`
- [x] 1.2 For each D-2 file group, read `git diff $(git merge-base HEAD origin/main) origin/main -- <group>` and note any fix outside T04 in the merge commit body. Verify that every one of the 10 main-only commits is accounted for
- [ ] 1.3 `git merge --no-ff origin/main` and resolve by D-2: v3 side for rewritten or removed files, `main` side for `CHANGELOG.md`, `.github/.release-please-manifest.json` and the `plugin.json` version (2.7.0). Verify `git diff --check`, `grep -c 2.7.0 .github/.release-please-manifest.json .claude-plugin/plugin.json`, and that `hooks/hooks.json` has no graph entry
- [ ] 1.4 Commit the merge. Verify `pytest tests/unit/`, `pnpm test:contract` and `pnpm skill-check` pass, and that `skill-check.baseline.json` has not changed from `b47aeaa`

## 2. Merge `improvements-pack` (design D-3)

- [ ] 2.1 `git merge --no-ff --no-commit origin/improvements-pack`. Keep deleted every file that `staging/v3` deleted, and take the v3 side for `skills/`, `agents/`, `STARTUP_INSTRUCTIONS.md`, `.claude/rules/`, `scripts/`, `hooks/` and `tests/unit/`. Verify `git diff --name-only --diff-filter=U` is empty for those paths
- [ ] 2.2 Take the branch side for `mkdocs.yml`, the site pages, `.claude/skills/docs-sync/`, `tests/evals/skills/docs-sync/`, `.git-blame-ignore-revs` and the `BUGS.md` move. Remove `Makefile`, `.pymarkdown.json`, `.claude-plugin/validator.json` and `tests/unit/docs/`. Verify with `git status`
- [ ] 2.3 Resolve by hand: `pyproject.toml` (`docs` group, a `lint` group with only `ruff==0.16.7`, the ruff config, no mypy config), `.gitignore` (union), `tests.yml`, `CLAUDE.md`, `CONTRIBUTING.md` and `README.md` (v3 side, no `make check`), and `plugin.json` (the task 1 result). Run `uv lock` and verify `uv lock --check`
- [ ] 2.4 Commit the merge. Verify `pytest tests/unit/`, `pnpm test:contract` and `pnpm skill-check` pass, and that the baseline has not grown
- [ ] 2.5 Try each hunk of `c6a05f4` and `ece50d5` on files that still exist, one at a time, and keep a hunk only if `pnpm skill-check --baseline-prune` removes an entry. Commit what stays with the pruned baseline. Verify that `pnpm skill-check` passes and that `git diff b47aeaa -- skill-check.baseline.json` shows only removals

## 3. Site location and content (design D-4, D-6, D-10)

- [ ] 3.1 Write `kernel/tests/docs/coverage.test.ts` (skills in `README.md` and in the skills reference, agents in the agents reference, nav equals the pages under `docs/guide/`) and `banner.test.ts` (D-6). Add `kernel/tests/docs/**/*.test.ts` to the `contract` project. Verify `pnpm test:contract` fails because `docs/guide/` does not exist yet
- [ ] 3.2 `git mv` the site pages into `docs/guide/`. Set `docs_dir: docs/guide` and `edit_uri: edit/main/docs/guide/`. Delete `concepts/tool-tiers.md`, `workflows/choosing-a-tier.md` and `contributing/injection-flows.md` and their nav entries, and keep `docs/INJECTION-FLOWS.md` in place. Verify that the coverage test's nav case passes
- [ ] 3.3 Remove the MCP, Serena-as-bundled, code-review-graph and tier passages from the remaining pages (`troubleshooting.md`, `reference/hooks.md`, `reference/settings.md`, `concepts/shared-foundation.md`, `getting-started/installation.md`, `getting-started/setup.md`, `workflows/trivial.md`, `index.md` and the rest), and fix the links into deleted pages. Verify that `grep -rniE 'tool.?tier|choosing-a-tier|register-graph-repo|\.mcp\.json|code-review-graph' docs/guide mkdocs.yml` has no match, and that every remaining Serena mention calls it a tool the user installs
- [ ] 3.4 Add the D-6 banner to one page and run `uv run --group docs mkdocs build --strict`. Check the built HTML for a rendered admonition and run `pnpm format:check`. Then add the banner to every page except the two snippet pages, and verify that `banner.test.ts` and the coverage test pass
- [ ] 3.5 Add `"docs:build": "uv run --group docs mkdocs build --strict"` to `package.json`, and verify that `pnpm docs:build` exits 0
- [ ] 3.6 Run `pnpm format` over `docs/guide/` and `mkdocs.yml` and commit it as its own `style:` commit. Verify `pnpm format:check` and `pnpm docs:build`
- [ ] 3.7 Move `BUGS.md` to the root and drop its MCP row. Update the `docs/` line, the Architecture tree and Development Commands in `CLAUDE.md`, and the docs section of `CONTRIBUTING.md`. Verify that `grep -rn 'docs/BUGS.md\|make check' --exclude-dir=node_modules --exclude-dir=archive --exclude-dir=v3 .` has no match outside history files

## 4. Hook-path guard (design D-5)

- [ ] 4.1 Write `kernel/tests/docs/hook-references.test.ts`, ported from the branch's pytest file (same scanned globs, with `docs/guide/**/*.md` in place of `docs/**/*.md`, and the same path regex). Seed a temporary skill line naming `hooks/nope/x.py`, verify that the test fails and names file, line and path, then remove the seed
- [ ] 4.2 Verify that the test passes on the tree. If a real dangling path exists, fix the prose that names it

## 5. ruff (design D-8)

- [ ] 5.1 Add the ruff steps to the `pytest` job in `tests.yml` and the `lint:py` script to `package.json`. Verify that `pnpm lint:py` fails on the merged tree (the v3-side files were never formatted)
- [ ] 5.2 Run `uv run --group lint ruff format` and commit only that as `style: apply ruff format to the v3 scripts`. Verify that `ruff format --check` passes and that `pytest tests/unit/` still passes
- [ ] 5.3 Fix the `ruff check` findings in a `fix:` commit. Verify that `pnpm lint:py` exits 0 and `pytest tests/unit/` passes
- [ ] 5.4 Append the task 5.2 SHA with its subject to `.git-blame-ignore-revs`, and verify that `git blame --ignore-revs-file .git-blame-ignore-revs scripts/inject.py` runs without error

## 6. Docs workflow and docs-sync (design D-7, D-9)

- [ ] 6.1 Rewrite `.github/workflows/docs.yml` with a `build` job (pull request and push to `main` and `staging/v3`) and a `deploy` job gated on a push to `main`, using `actions/checkout@v7` and `astral-sh/setup-uv`. Verify with the workflow lint step's tool (`actionlint`) locally
- [ ] 6.2 Repoint `.claude/skills/docs-sync/SKILL.md` step 1 at `pnpm test:contract`. Update `references/docs-map.md`: drop rows for removed files, repoint settings rows at `kernel/src/ctx/config.ts` and `schema/settings.schema.json`, and prefix page paths with `docs/guide/`. Verify with a script that every backticked repository path in the map exists
- [ ] 6.3 Update the `tests/evals/skills/docs-sync/` eval for the new test command and paths, and verify that the JSON parses

## 7. Acceptance

- [ ] 7.1 Run locally: `pnpm build && git diff --exit-code dist/ schema/`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm knip`, `pnpm test:unit`, `pnpm test:e2e`, `pnpm test:contract`, `pnpm skill-check`, `pnpm lint:py`, `pnpm docs:build` and `pytest tests/unit/`. Verify that all pass
- [ ] 7.2 Verify `git merge-base --is-ancestor <main tip> HEAD` and `git merge-base --is-ancestor <improvements-pack tip> HEAD` on the task branch
- [ ] 7.3 Run `openspec validate v3-t05-branch-reconciliation --strict`, then open the PR into `staging/v3`. The PR body opens with "Land with a merge commit, not squash or rebase". Verify that the full CI is green, including the docs workflow and the ruff steps
- [ ] 7.4 After the PR lands with a merge commit, verify both ancestry checks against `origin/staging/v3`. Then delete `origin/improvements-pack`, run `gh issue close 83 -c "Done in #<PR>"` and move the board card to Done
