# Tasks

## 1. Workspace and toolchain

- [x] 1.1 Add root `package.json` (private, `type: module`, `engines.node >= 22.18`, `packageManager: pnpm@12.6.0`, scripts `lint`, `format`, `format:check`, `typecheck`, `test`, `build`, `check`), `pnpm-workspace.yaml` (`plugins/*`, `docs`, `allowBuilds`), `.nvmrc`, `.editorconfig`; verify `pnpm install --frozen-lockfile` succeeds and `pnpm exec claude --version` prints the pinned version
- [x] 1.2 Add `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `commitlint.config.mjs`, `vitest.config.ts`; extend `.gitignore` (`node_modules/`, `dist/`, VitePress cache and output); verify `pnpm check` passes on the empty workspace
- [x] 1.3 Make `docs/` the workspace package `@bdk/docs` with VitePress, `docs/index.md` and `docs/.vitepress/config.ts` excluding `v3-draft1/**`; verify `pnpm --filter @bdk/docs docs:build` succeeds and fails after adding a dead link
- [x] 1.4 Add a "Checks" section to `CONTRIBUTING.md` (`pnpm install`, `pnpm check`, plugin validation) and verify each documented command runs as written

## 2. Release components

- [x] 2.1 Write the failing workspace test `tests/release-components.test.ts`: plugin directories and `release-please-config.json` packages are the same set, components equal directory names, shared options (`release-type`, `tag-separator: "--"`, `extra-files` json updater on `.claude-plugin/plugin.json` `$.version`, `separate-pull-requests`) are set; verify it fails without the config
- [x] 2.2 Add `release-please-config.json` and `.release-please-manifest.json`; verify the test passes, and fails naming the plugin when a scratch `plugins/x/.claude-plugin/plugin.json` is added

## 3. Publish script

- [x] 3.1 Write the failing tests `scripts/publish-plugin.test.ts` against a temporary repository with fixture plugins `demo` (with `src/`, `tests/`, `evals/`, `version.txt`, a `build` script writing `dist/` and a `bin/demo` printing its version) and `other`, tags and a bare remote: first release creates an orphan `release`; a second plugin leaves the first byte-identical; a removed file disappears; snapshot holds no development paths; manifest name or version mismatch, `--version` mismatch and a strict validation failure each exit non-zero and leave `release` unchanged; an unchanged snapshot makes no commit; verify they fail
- [x] 3.2 Implement `scripts/publish-plugin.ts` (design D2-D4) and verify the tests pass under `pnpm test`

## 4. Workflows

- [x] 4.1 Extend `.github/workflows/pr.yml` with `check`, `plugins`, `commitlint` and `docs` (design D6); verify `actionlint` is clean
- [x] 4.2 Add `.github/workflows/release.yml` (push to `main`, `concurrency: release`, `release-please` with the App token and forwarded outputs, `publish` looping over released tags with the App identity); verify `actionlint` is clean

## 5. GitHub settings

- [x] 5.1 Create and install the release GitHub App, set `RELEASE_APP_ID` and `RELEASE_APP_PRIVATE_KEY` (design, Migration Plan steps 1-2); verify `gh variable list` and `gh secret list` show them
- [x] 5.2 Add the `release-branch` ruleset with the App as the only bypass actor; verify a push to `release` by the administrator is rejected
- [x] 5.3 Add the `required-checks` ruleset on `main` and `staging/v3`; verify it lists `check`, `plugins`, `commitlint`, `docs` and `openspec`

## 6. Acceptance and gates

- [x] 6.1 Open the PR and verify `check`, `plugins` and `commitlint` pass on Linux, each within 5 minutes
- [x] 6.2 Negative checks: a commit `update stuff` fails `commitlint`; a plugin manifest rejected by strict validation fails `plugins`; record the runs
- [x] 6.3 Run every check CI runs locally (`pnpm check`, plugin validation, commitlint over the branch, docs build, `actionlint`), `openspec validate v3-172-repo-skeleton --strict` and `openspec validate --specs --strict`
