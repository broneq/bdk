# Proposal

## Why

Tracks #172.

ADR-0002 chose one directory per plugin, with built runtime files published to a `release` branch. The repository has no workspace, no toolchain, only one PR check (`openspec`) and no release flow, so no plugin can move in (#175, #178) and none can be released.

## What Changes

- Root pnpm workspace over `plugins/*` and `docs`, with the shared dev toolchain of the design section "Layout": TypeScript, eslint, prettier, vitest, commitlint. Claude Code itself is a pinned dev dependency, so `claude plugin validate` runs at the same version locally and in CI.
- A minimal VitePress site in `docs/` (home page, ADRs, designs), so the `docs` job has something to build.
- `.github/workflows/pr.yml` gains the jobs `check`, `plugins`, `commitlint` and `docs` of the design section "PR CI (`pr.yml`)", next to the existing `openspec` job. `docs` builds only when its inputs change.
- `.github/workflows/release.yml`: release-please in manifest mode on `main`, and a `publish` job that publishes the released plugins one after another under workflow `concurrency: release` (design section "Releases (`release.yml`)").
- `release-please-config.json` and `.release-please-manifest.json`: release type `simple`, `tag-separator: "--"`, `extra-files` json updater on `.claude-plugin/plugin.json` `$.version`. No plugin exists yet, so the package list starts empty; a test keeps it equal to the plugin directories.
- `scripts/publish-plugin.ts`: the publish step of one plugin (build from its tag, snapshot of runtime files, `claude plugin validate --strict`, `--version` check, fast-forward push of `plugins/<name>/` to `release`), tested against local git repositories.
- GitHub side: a GitHub App for release-please and the `release` pushes, its credentials as an Actions variable and secret, a ruleset on `release` that only the App bypasses, and `check`, `plugins`, `commitlint` as required checks.

### Resolved from "To resolve in the spec"

- **Bootstrap of `release`:** the first publish run creates it. When `origin/release` does not exist, `publish-plugin.ts` starts an orphan branch holding only `plugins/<name>/`. No manual first commit and no one-off App run; the ruleset restricts creation too, and the App bypasses it.
- **release-please and `staging/v3`:** `release.yml` runs only on pushes to `main`. `staging/v3` never releases; v3 releases start when `staging/v3` merges into `main`. Until then the `bdk` marketplace entry keeps pinning `v2.7.0` (#176), and no `<plugin>--v*` tag is created from unfinished v3 work.

### Out of scope

- Release-please dry run, the `extra-files` updater check and `version.txt` handling: #173. This Change only keeps `version.txt` out of the snapshot.
- The `bdk` plugin, its CLI, its esbuild build and its marketplace switch to `ref: release`: #178.
- Merging `git-identity` and `bdk-skill-kit`, their marketplace switch, and the skill-check step of the `plugins` job (it runs from the built `bdk-skill-kit`): #175.
- Deploying the docs site to GitHub Pages (`docs.yml`): no issue yet; proposed as a follow-up.
- Rewriting `README.md` and `CONTRIBUTING.md`: #170, #171. This Change adds only the commands a contributor needs to run the checks.

## Capabilities

### New Capabilities

- `plugin-release`: how a change to `plugins/<name>/` on `main` becomes a release PR, a `<name>--v<version>` tag and the built runtime files of that plugin on the `release` branch, and who may write that branch.

### Modified Capabilities

- `repo-sdlc`: adds the PR checks `check`, `plugins`, `commitlint` and `docs`, their time budget, and the rule that every plugin directory is a release component.

## Impact

- New root files: `package.json`, `pnpm-workspace.yaml`, `pnpm-lock.yaml`, `tsconfig.json`, `eslint.config.mjs`, `.prettierrc.json`, `.prettierignore`, `commitlint.config.mjs`, `vitest.config.ts`, `.nvmrc`, `.editorconfig`, `release-please-config.json`, `.release-please-manifest.json`.
- New: `scripts/publish-plugin.ts`, `tests/`, `docs/package.json`, `docs/.vitepress/config.ts`, `docs/index.md`, `.github/workflows/release.yml`.
- Changed: `.github/workflows/pr.yml`, `.gitignore`, `CONTRIBUTING.md`.
- GitHub settings: one GitHub App installed on `broneq/bdk`, Actions variable `RELEASE_APP_ID` and secret `RELEASE_APP_PRIVATE_KEY`, a ruleset on `refs/heads/release`, required status checks on `main` and `staging/v3`.
- Contributors need Node >= 22.18 and pnpm; `pnpm install` downloads Claude Code (~100 MB, cached).
