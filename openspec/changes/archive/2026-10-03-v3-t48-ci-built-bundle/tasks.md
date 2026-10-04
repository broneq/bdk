## 1. Tests first

- [x] 1.1 Contract test `generated-outputs`: run the schema exporter and `export agents --host claude --out <tmp>` into a temporary directory, list every path written, and assert each is matched by `git check-ignore` and absent from `git ls-files`; also assert `git ls-files` is empty for `dist/`, `schema/settings.json`, `schema/pipeline.json`, `schema/state/`, `schema/cli/output/`; skip the tracked check when HEAD is the distribution ref (fails now)
- [x] 1.2 Same test: `schema/cli/commands.json`, `commands.schema.json`, `cli/common/list-page.json` are tracked (hand-written files stay)
- [x] 1.3 Contract test: `.claude-plugin/marketplace.json` `bdk` entry has `source.source: github`, `repo: broneq/bdk`, `ref: release` (fails now)
- [x] 1.4 Unit and E2E tests of the modeline: the URL carries `dist-v<version>` (`kernel/src/config/schema/schema.ts`, `kernel/src/shared/config/modeline.ts` and their tests) (fails now)
- [x] 1.5 Determinism: CI step "Build is deterministic" hashes `dist/`, `schema/` and `agents/`, builds again and diffs (a vitest test would rewrite files the other contract tests read at the same time)

## 2. Build and ignore

- [x] 2.1 `kernel/build.mjs`: after the bundle and the schema exporter, run `node dist/bdk.mjs export agents --host claude`; update the header comment (generated and untracked, no `git diff --exit-code`); same for the `kernel/scripts/export-schemas.ts` comment
- [x] 2.2 `.gitignore`: `/dist/`, `/schema/settings.json`, `/schema/pipeline.json`, `/schema/state/`, `/schema/cli/output/`, `/schema/cli/common/version.json`, `/schema/cli/common/refusal.json`, and the six adapters `/agents/{lead,reader,reviewer,runner,scout,worker}.md`; remove the `dist/bdk.mjs` line from `.gitattributes`
- [x] 2.3 `git rm --cached` every generated file in the same commit as 2.2 (about 90 files)
- [x] 2.4 `package.json`: `prepare` becomes `husky && node kernel/build.mjs`; `test:e2e` and `test:contract` run `pnpm build` first
- [x] 2.5 Fresh worktree check: `git worktree add`, `pnpm install`; `node dist/bdk.mjs version` exits 0 and the six adapters exist
- [x] 2.6 Readers that assumed tracked files: `evals/harness/plugins.ts`, `evals/suites/*`, `tests/fixtures/host-payloads/*/bdk-tree.json`, `skill-check.config.ts` (reads `agents/`), `kernel/tests/support/schemas.ts`; each builds first or documents `pnpm build`
- [x] 2.7 Modeline tag: change the URL in `kernel/src/config/schema/schema.ts` and the example in `schema/cli` docs to `dist-v<version>`; update `doctor --fix` expectations

## 3. CI and release

- [x] 3.1 `.github/workflows/tests.yml`: remove `git diff --exit-code dist/ schema/` and `export agents --host claude --check`; keep the build step
- [x] 3.2 `.github/workflows/release-please.yml`: expose `release_created` and `tag_name`; add a `publish-bundle` job (`if: release_created`, `permissions: contents: write`): checkout the tag, `pnpm install --frozen-lockfile`, `pnpm build`, `git add -f dist/ schema/ agents/`, commit `chore(release): bundle <tag>`, `git push --force origin HEAD:release`, tag `dist-v<version>` and push it
- [x] 3.3 `workflow_dispatch` with a required `tag` input that runs the same job for an existing tag
- [x] 3.4 `actionlint` clean on both workflows

## 4. Marketplace entry

- [x] 4.1 Fetch https://code.claude.com/docs/en/plugins-reference and the marketplace reference again and confirm `github` source fields and the `agents` rules before the edit
- [x] 4.2 `.claude-plugin/marketplace.json`: the `bdk` entry becomes `{"source": "github", "repo": "broneq/bdk", "ref": "release"}`; keep the other two entries; `claude plugin validate .` passes

## 5. Documentation

- [x] 5.1 `CLAUDE.md` (architecture tree line for `dist/`, development commands) and `CONTRIBUTING.md` (the "committed and generated" paragraph, how to test an unreleased ref, "generated files are never committed")
- [x] 5.2 `README.md` and `docs/guide/`: installation text and any "committed bundle" or "committed schema" statement; run `pnpm docs:build`
- [x] 5.3 `docs/adr/0002-kernel-runtime-node-typescript.md`: an amendment note linking this Change; `docs/V3-IMPLEMENTATION-PLAN.md` T10 decision line
- [x] 5.4 Grep for `git diff --exit-code`, `committed bundle`, `committed ESM`, `committed under schema`, `committed schema` and fix every remaining hit outside `openspec/changes/archive/` and `docs/v3/`
- [x] 5.5 Verify the `$id` of `schema/state/*` is fetched by nothing (open question 3) and record the answer in the PR

## 6. Acceptance

- [x] 6.1 Two scratch branches that each add a settings key in different modules merge into one branch with no conflict
- [x] 6.2 `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip && pnpm test:unit && pnpm test:e2e && pnpm test:contract` green on a fresh worktree after `pnpm install`
- [x] 6.3 Each Acceptance signal of #114 has its evidence in the PR description
- [x] 6.4 `openspec validate v3-t48-ci-built-bundle --strict`

## Follow-up at the first release from `main` (T50, not tracked here)

The change lands on `staging/v3`, where release-please does not run and the marketplace is not read, so these cannot be done in this PR. They are listed in the T50 scope of `docs/V3-IMPLEMENTATION-PLAN.md`.

- Run the `release-please` workflow by hand with `tag` set to an existing tag, to create `release` and `dist-v<version>` before the marketplace entry reaches `main`; verify they hold the tag tree plus `dist/`, `schema/`, `agents/`, each equal to a fresh `pnpm build` of the tag.
- Install `bdk` from the marketplace on a clean project: the plugin directory has `dist/bdk.mjs` and the six adapters, SessionStart prints no `BDK STOP`, and `/bdk:setup` writes a modeline whose URL resolves.
- Confirm by hand that an editor with yaml-language-server completes keys from that modeline URL.
