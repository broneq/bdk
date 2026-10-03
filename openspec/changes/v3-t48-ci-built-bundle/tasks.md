## 1. Tests first

- [ ] 1.1 Contract test: `git ls-files dist` is empty unless HEAD is the distribution ref; `.gitignore` lists `/dist/` (fails now)
- [ ] 1.2 Contract test: `.claude-plugin/marketplace.json` `bdk` entry has `source.source: github`, `repo: broneq/bdk`, `ref: release` (fails now)
- [ ] 1.3 Unit or E2E-support test: `kernel/tests/support/run.ts` throws a message naming `pnpm build` when the bundle file is missing (fails now)

## 2. Untrack the bundle

- [ ] 2.1 Add `/dist/` to `.gitignore`, remove the `dist/bdk.mjs` line from `.gitattributes`, run `git rm --cached dist/bdk.mjs` in the same commit
- [ ] 2.2 `package.json`: `prepare` becomes `husky && node kernel/build.mjs`; confirm a fresh worktree (`git worktree add`, `pnpm install`) leaves a bundle that answers `node dist/bdk.mjs --version`
- [ ] 2.3 `kernel/build.mjs` and `kernel/scripts/export-schemas.ts` header comments: the bundle is a build output, `schema/` stays committed and guarded
- [ ] 2.4 `kernel/tests/support/run.ts`: explicit failure when the bundle is missing (task 1.3)
- [ ] 2.5 Check other readers of `dist/bdk.mjs` that assumed it in git: `evals/harness/plugins.ts`, `evals/suites/*`, `tests/fixtures/host-payloads/*/bdk-tree.json`; each either builds first or documents `pnpm build`

## 3. CI and release

- [ ] 3.1 `.github/workflows/tests.yml`: the guard step runs `git diff --exit-code schema/` and is renamed accordingly; remove nothing else
- [ ] 3.2 `.github/workflows/release-please.yml`: expose `release_created` and `tag_name`; add a `publish-bundle` job (needs the release job, `if: release_created`, `permissions: contents: write`) that checks out the tag, `pnpm install --frozen-lockfile`, `pnpm build`, `git add -f dist/bdk.mjs`, commits `chore(release): bundle <tag>` and `git push --force origin HEAD:release`
- [ ] 3.3 Add a `workflow_dispatch` trigger with a `tag` input that runs the same job for an existing tag
- [ ] 3.4 `actionlint` clean on both workflows (`pnpm exec` is not needed; CI runs it)
- [ ] 3.5 Run the dispatch job once on the latest tag; verify `release` holds the tag tree plus `dist/bdk.mjs` and that the file equals a local `pnpm build` of that tag

## 4. Marketplace entry

- [ ] 4.1 `.claude-plugin/marketplace.json`: the `bdk` entry becomes `{"source": "github", "repo": "broneq/bdk", "ref": "release"}`; keep the other two entries
- [ ] 4.2 Fetch https://code.claude.com/docs/en/plugins-reference and the marketplace reference again and confirm the fields before the edit; `claude plugin validate .` passes
- [ ] 4.3 Clean-project install from the marketplace after step 3.5: the plugin dir contains `dist/bdk.mjs`, SessionStart prints no `BDK STOP`

## 5. Documentation

- [ ] 5.1 `CLAUDE.md` (architecture tree line for `dist/`, development commands) and `CONTRIBUTING.md` (the "committed and generated" paragraph, how to test an unreleased ref)
- [ ] 5.2 `README.md` and `docs/guide/`: installation text and any "committed bundle" statement; run `pnpm docs:build`
- [ ] 5.3 `docs/adr/0002-kernel-runtime-node-typescript.md`: an amendment note that links this Change; `docs/V3-IMPLEMENTATION-PLAN.md` T10 decision line
- [ ] 5.4 Grep the repository for `git diff --exit-code dist`, `committed bundle`, `committed ESM` and fix every remaining hit outside `openspec/changes/archive/` and `docs/v3/`

## 6. Acceptance

- [ ] 6.1 Two scratch branches that each change a different file under `kernel/src/` merge into one branch with no conflict
- [ ] 6.2 `pnpm lint && pnpm format:check && pnpm typecheck && pnpm knip && pnpm test:unit && pnpm test:e2e && pnpm test:contract` green on a fresh worktree after `pnpm install`
- [ ] 6.3 Each Acceptance signal of #114 has its evidence in the PR description
- [ ] 6.4 `openspec validate v3-t48-ci-built-bundle --strict`
