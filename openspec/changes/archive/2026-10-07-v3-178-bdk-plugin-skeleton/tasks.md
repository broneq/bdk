# Tasks

## 1. Plugin package and release wiring

- [x] 1.1 Create `plugins/bdk/.claude-plugin/plugin.json` (`name`, `version` `2.7.0`, `description`, `author`, `repository`, `license`; `JSON.stringify(manifest, null, 2)` layout), `package.json` (private, `type: module`, no version, scripts `build` and `typecheck`) and `tsconfig.json` (extends the root); verify `pnpm install` registers the workspace package and `claude plugin validate plugins/bdk --strict` passes
- [x] 1.2 Add `plugins/bdk` to `release-please-config.json` (`component: bdk`) and `.release-please-manifest.json` (`2.7.0`); verify `tests/release-components.test.ts` passes
- [x] 1.3 Switch the `bdk` entry of `.claude-plugin/marketplace.json` to `git-subdir` `broneq/bdk`, `path: plugins/bdk`, `ref: release`, and update "Current state" in `CLAUDE.md` (design D11); verify `claude plugin validate .claude-plugin/marketplace.json --strict` passes

## 2. Architecture lint

- [x] 2.1 Add `eslint-plugin-boundaries` 7.2.0 as an exact root dev dependency and `plugins/bdk/src/slices.ts` (empty `SLICES`, `SHARED` with `cli` as `frame`); verify `pnpm install --frozen-lockfile` succeeds after the lockfile update
- [x] 2.2 Write `plugins/bdk/tests/architecture-lint.test.ts` with source trees generated in temporary directories that each break one check of design D5 (matrix edge, deep import, layer direction, `shared/` importing a slice, unknown file, OS module, `process`, unknown slice directory, matrix cycle, inline disable); verify it fails before the lint block exists
- [x] 2.3 Write `plugins/bdk/eslint.architecture.ts` (generated from `slices.ts`, load-time parity, file placement and cycle checks, `noInlineConfig`) and spread it into the root `eslint.config.mjs`; verify the architecture-lint test passes, `pnpm lint` passes on the real tree, and record whether a TypeScript resolver was needed
- [x] 2.4 Write `plugins/bdk/tests/shared-admission.test.ts` with a fixture where a `three-slices` module has two importers; verify it fails on the fixture and passes on the real tree

## 3. CLI frame

- [x] 3.1 Write unit tests in `plugins/bdk/src/shared/cli/tests/` with a fake slice: global, group and command help; `--version` with and without `--json`; unknown group with suggestion, unknown verb, unknown flag, missing and invalid argument; result in text and `--json`; exit 1 result; error in text (stderr) and `--json` (stdout); unexpected exception as `internal/unexpected` exit 4; Node older than 22.18 as `env/node-version` exit 3; byte-identical output; no stdin read; verify they fail
- [x] 3.2 Implement `plugins/bdk/src/shared/cli/` (command declaration type, router on `node:util` `parseArgs`, help rendering, `CliError` and exit codes, output writer) and `plugins/bdk/src/main.ts` (design D8); verify the unit tests pass and `pnpm lint` reports no architecture violation

## 4. Build and launcher

- [x] 4.1 Write `plugins/bdk/tests/cli.test.ts`: build into a temporary plugin directory, then run `bin/bdk` from another working directory and through a symlink (`--version` equals `plugin.json`, `--help` exits 0, unknown command exits 2 in text and `--json`, missing bundle exits 3 with a repair line, bundle runs without `node_modules`); verify it fails
- [x] 4.2 Add `esbuild` as an exact dev dependency of `plugins/bdk` and write `plugins/bdk/build.ts` (design D3) and `plugins/bdk/bin/bdk` (design D2, executable); verify `tests/cli.test.ts` passes, `pnpm build` writes `plugins/bdk/dist/bdk.mjs`, and `git status` lists nothing under `dist/`

## 5. Durable architecture rule

- [x] 5.1 Write `.claude/rules/bdk-cli.md` and add the pointer line to "Building skills (v3)" in `CLAUDE.md`, with the exact text of design D12; verify `pnpm format:check` passes and every path the rule names exists

## 6. Acceptance and gates

- [x] 6.1 Acceptance: `claude plugin validate plugins/bdk --strict` passes; after `pnpm build`, in a separate test project started with `claude --plugin-dir <repo>/plugins/bdk`, `bdk --version` through the Bash tool prints the `plugin.json` version
- [x] 6.2 Run every check of `.github/workflows/pr.yml` locally (`pnpm install --frozen-lockfile`, `pnpm lint`, `pnpm format:check`, `pnpm typecheck`, `pnpm test`, `pnpm build`, `claude plugin validate` on the marketplace and every plugin, commitlint on the commit), `openspec validate v3-178-bdk-plugin-skeleton --strict` and `openspec validate --specs --strict`; verify all pass
