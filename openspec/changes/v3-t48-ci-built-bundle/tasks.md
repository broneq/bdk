## 1. Tests first

- [ ] 1.1 Contract test `generated-outputs`: run the schema exporter and `export agents --host claude --out <tmp>` into a temporary directory, list every path written, and assert each is matched by `git check-ignore` and absent from `git ls-files`; also assert `git ls-files` is empty for `dist/`, `schema/settings.json`, `schema/pipeline.json`, `schema/state/`, `schema/cli/output/`; skip the tracked check when HEAD is the distribution ref (fails now)
- [ ] 1.2 Same test: `schema/cli/commands.json`, `commands.schema.json`, `cli/common/list-page.json` are tracked (hand-written files stay)
- [ ] 1.3 Contract test: `.claude-plugin/marketplace.json` `bdk` entry has `source.source: github`, `repo: broneq/bdk`, `ref: release` (fails now)
- [ ] 1.4 Unit and E2E tests of the modeline: the URL carries `dist-v<version>` (`kernel/src/config/schema/schema.ts`, `kernel/src/shared/config/modeline.ts` and their tests) (fails now)
- [ ] 1.5 Test that two consecutive `pnpm build` runs change no generated file (determinism, which the release job relies on)

## 2. Build and ignore

- [ ] 2.1 `kernel/build.mjs`: after the bundle and the schema exporter, run `node dist/bdk.mjs export agents --host claude`; update the header comment (generated and untracked, no `git diff --exit-code`); same for the `kernel/scripts/export-schemas.ts` comment
- [ ] 2.2 `.gitignore`: `/dist/`, `/schema/settings.json`, `/schema/pipeline.json`, `/schema/state/`, `/schema/cli/output/`, `/schema/cli/common/version.json`, `/schema/cli/common/refusal.json`, and the six adapters `/agents/{lead,reader,reviewer,runner,scout,worker}.md`; remove the `dist/bdk.mjs` line from `.gitattributes`
- [ ] 2.3 `git rm --cached` every generated file in the same commit as 2.2 (about 90 files)
- [ ] 2.4 `package.json`: `prepare` becomes `husky && node kernel/build.mjs`; `test:e2e` and `test:contract` run `pnpm build` first
- [ ] 2.5 Fresh worktree check: `git worktree add`, `pnpm install`; `node dist/bdk.mjs --version` exits 0 and the six adapters exist
- [ ] 2.6 Readers that assumed tracked files: `evals/harness/plugins.ts`, `evals/suites/*`, `tests/fixtures/host-payloads/*/bdk-tree.json`, `skill-check.config.ts` (reads `agents/`), `kernel/tests/support/schemas.ts`; each builds first or documents `pnpm build`
- [ ] 2.7 Modeline tag: change the URL in `kernel/src/config/schema/schema.ts` and the example in `schema/cli` docs to `dist-v<version>`; update `doctor --fix` expectations

## 3. CI and release

- [ ] 3.1 `.github/workflows/tests.yml`: remove `git diff --exit-code dist/ schema/` and `export agents --host claude --check`; keep the build step
- [ ] 3.2 `.github/workflows/release-please.yml`: expose `release_created` and `tag_name`; add a `publish-bundle` job (`if: release_created`, `permissions: contents: write`): checkout the tag, `pnpm install --frozen-lockfile`, `pnpm build`, `git add -f dist/ schema/ agents/`, commit `chore(release): bundle <tag>`, `git push --force origin HEAD:release`, tag `dist-v<version>` and push it
- [ ] 3.3 `workflow_dispatch` with a required `tag` input that runs the same job for an existing tag
- [ ] 3.4 `actionlint` clean on both workflows
- [ ] 3.5 Run the dispatch job once on the latest tag; verify `release` holds the tag tree plus `dist/`, `schema/`, `agents/`, that each equals a local `pnpm build` of that tag, and that `dist-v<version>` exists

## 4. Marketplace entry

- [ ] 4.1 Fetch https://code.claude.com/docs/en/plugins-reference and the marketplace reference again and confirm `github` source fields and the `agents` rules before the edit
- [ ] 4.2 `.claude-plugin/marketplace.json`: the `bdk` entry becomes `{"source": "github", "repo": "broneq/bdk", "ref": "release"}`; keep the other two entries; `claude plugin validate .` passes
- [ ] 4.3 Clean-project install from the marketplace after 3.5: the plugin dir has `dist/bdk.mjs` and the six adapters, SessionStart prints no `BDK STOP`, `/bdk:setup` writes a modeline whose URL resolves
- [ ] 4.4 Confirm by hand that an editor with yaml-language-server completes keys from the new modeline URL (the scenario of `kernel-settings`)

## 5. Documentation

- [ ] 5.1 `CLAUDE.md` (architecture tree line for `dist/`, development commands) and `CONTRIBUTING.md` (the "committed and generated" paragraph, how to test an unreleased ref, "generated files are never committed")
- [ ] 5.2 `README.md` and `docs/guide/`: installation text and any "committed bundle" or "committed schema" statement; run `pnpm docs:build`
- [ ] 5.3 `docs/adr/0002-kernel-runtime-node-typescript.md`: an amendment note linking this Change; `docs/V3-IMPLEMENTATION-PLAN.md` T10 decision line
- [ ] 5.4 Grep for `git diff --exit-code`, `committed bundle`, `committed ESM`, `committed under schema`, `committed schema` and fix every remaining hit outside `openspec/changes/archive/` and `docs/v3/`
- [ ] 5.5 Verify the `$id` of `schema/state/*` is fetched by nothing (open question 3) and record the answer in the PR

## 6. Acceptance

- [ ] 6.1 Two scratch branches that each add a settings key in different modules merge into one branch with no conflict
- [ ] 6.2 `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip && pnpm test:unit && pnpm test:e2e && pnpm test:contract` green on a fresh worktree after `pnpm install`
- [ ] 6.3 Each Acceptance signal of #114 has its evidence in the PR description
- [ ] 6.4 `openspec validate v3-t48-ci-built-bundle --strict`
