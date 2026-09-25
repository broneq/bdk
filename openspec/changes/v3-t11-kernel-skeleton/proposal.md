# Proposal

## Why

Plan: docs/V3-IMPLEMENTATION-PLAN.md, T11. Tracks #49.

The kernel CLI contract (`kernel-cli`, 61 commands) and the kernel's module layout (`kernel-architecture`) exist only as specs and `schema/cli/`; there is no kernel. Every later task (T12 onwards) adds a slice to it, so the build, bundle, test harness, CI and the shared modules must exist first, or each task invents its own infrastructure. The first two real commands, `version` and `doctor`, are the ones the fail-closed story (Q3) and the wrapper's STOP line depend on: without them a user on the wrong Node or on a v2 layout gets no diagnosis.

## What Changes

- New TypeScript kernel under `kernel/src/` in the layout of `kernel-architecture` (vertical slices, `shared/`, dependency matrix). `package.json` and `pnpm-lock.yaml` at the repository root; pnpm is dev-only (D5, ADR 0001 rules 6-8 of git-identity). Claude Code skips `pnpm-lock.yaml`, so no install runs on the user's machine.
- esbuild bundles `kernel/src/main.ts` into one ESM file, `dist/bdk.mjs`, **committed** and guarded on CI by `git diff --exit-code dist/`. The command index `schema/cli/commands.json` is bundled into it.
- Shared modules in the order of the `kernel-architecture` build order: `shared/refusal`, `shared/output`, `shared/registry` (every one of the 61 records registered; unlanded ones answer `kernel/not-implemented` naming the owner task), `shared/clock`, `shared/ids`, `shared/config` (reading half), `shared/store` (Change directory IO and index skeleton), `shared/git`, then the `service` slice with `version` and `doctor`.
- `bdk version`: kernel, contract and Node version; runs on any Node that loads the bundle.
- `bdk doctor`: Node version against the minimum 22.13.0 (HOST-FACTS `node-sqlite-min`, `node-sqlite-local`) and detection of the v2 layout (`.bdk/settings.json`, `.bdk/runs/`, `.bdk/plans/`) with `bdk import` as the repair. `doctor` reports a too-old Node as a finding (exit 0), as its example in `kernel-cli/service` already shows; every other command except `version` refuses with exit 5.
- Tooling (departs from D5's `node --test` and Biome, user decision): `tsc --noEmit` (strict); Vitest for unit, E2E and contract tests with coverage thresholds; ESLint with type-aware `typescript-eslint` rules; Prettier over the whole repository (archive, generated and bundle paths excluded), applied once in its own commit; husky with lint-staged (pre-commit) and commitlint (commit-msg, Conventional Commits for release-please); knip for unused files, exports and dependencies; `.nvmrc`, `.editorconfig`; actionlint on CI. E2E tests run `dist/bdk.mjs` on a temporary git repository fixture. Source files live only under `kernel/src/`.
- Contract tests: every record has a handler or the explicit stub; `--help` output equals the index record; the `examples` in `schema/cli/output/*.json` and `schema/cli/common/*.json` validate against their schemas; the zod output schemas of `version`, `doctor`, the refusal and the list page agree with their JSON Schema files. `tests/contract/cli-contract.test.mjs` (T10) moves into the kernel harness.
- Structural tests from `kernel-architecture`: the import scan (matrix read from the spec table) and the `node:` boundary test.
- CI in GitHub Actions, in `.github/workflows/tests.yml` next to the existing pytest job; `release-please.yml` is untouched. Kernel job on the Node matrix 22.13 / 24 / 26 with identical steps: install (frozen lockfile), build, `git diff --exit-code dist/`, lint, format check, typecheck, knip, unit with coverage, E2E, contract; on pull requests commitlint over the PR commits and actionlint. Node 20 and older are unsupported and untested; the runtime floor is covered by registry unit tests with an injected Node version. `pnpm audit --prod` on every run. A `skill-check` step over `skills/` that is a passing stub until T15 lands.
- Formal ADRs in `docs/adr/` in the MADR format of `/bdk:create-adr`: D5 (kernel runtime), A-podejście (artifact graph as data with a typed spine), R-format (YAML plus Markdown files), R-store (Markdown truth plus a rebuildable SQLite index).
- Amendment of ADR 0001 in `broneq/git-identity` as a separate PR in that repository: the consequence "bdk stays in Python" is outdated (D5), and rule 9 ("the core functionality has no runtime") is reinterpreted for BDK, whose core is the bundled kernel.

Resolutions of the plan's "To resolve in the spec" (details and alternatives in design.md):

- **Minimum Node:** 22.13.0 (`engines.node: ">=22.13.0"`), the first 22.x with `node:sqlite` unflagged. No JSON index fallback (the escape hatch T20 names): `node:sqlite` is a release candidate (HOST-FACTS `node-sqlite-stability`) and present on every supported line. The bundle targets 22.13; Node 20 is not supported.
- **Pinning and cadence:** exact versions in `package.json` (no ranges), frozen `pnpm-lock.yaml`, pnpm pinned through `packageManager`; runtime dependencies limited to an allowlist, `zod` and the YAML parser `yaml` (both used in T11: output schemas and the reading half of `shared/config`), checked by a test; Dependabot opens one grouped update per month for npm and GitHub Actions; `pnpm audit --prod --audit-level high` fails CI on every run (V1-8).
- **CI host:** GitHub Actions, in the existing `tests.yml`, next to release-please.
- **`--help` mechanism** (left to T11 by `kernel-cli`, Invocation): generated at run time from the bundled index, so parity holds by construction; a contract test still asserts it.

Inputs carried by citation: decision register D5, Q3, V1-8; design "Constraints & NFRs" (rows Runtime, Security, Availability), "Risk Register" (SPOF: the kernel), "Testing Strategy", "Next Steps", "What We Did NOT Decide" (minimum Node version, bundled dependency policy, ADR 0001 amendment text); HOST-FACTS `node-sqlite-min`, `node-sqlite-stability`, `node-sqlite-local`; specs `kernel-cli`, `kernel-cli/service`, `kernel-architecture`; ADR-0001 (no bundled MCP, so `doctor` checks no `uv`).

Out of scope:

- The configuration layers, zod registry, JSON Schema export of all outputs and `config` commands (T12). T11's `shared/config` reads only what `version` and `doctor` need.
- `ctx` and the content hooks (T13); wiring any command into `hooks.json` (T13, T24).
- The state schema, the write map and the final id format (T14); T11's `shared/store` and `shared/ids` are skeletons whose shapes T14 fixes.
- `skill-check` itself (T15); T11 only reserves the CI step.
- `doctor` checks owned by later tasks: spec `bdk-merge-hash` and `policy/merge-hash-mismatch` (T30), index freshness (T14, T20), schema modeline and offline copy (T12). `doctor --fix` is accepted and has nothing to repair until those land.
- `bdk import` (T32) and `bdk rebuild` (T22); `doctor` names `bdk import` as content only.
- Removing the Python pytest job and `pyproject.toml` / `uv.lock` (T32).

## Capabilities

### New Capabilities

None. The kernel's behaviour belongs to the existing `kernel-cli` and `kernel-architecture` specs.

### Modified Capabilities

- `kernel-cli`: Invocation (the Node gate exempts `doctor`, the runtime floor scenario, `--help` generated from the bundled index); Exit codes and the error object (`runtime/node-version` is emitted by every command except `version` and `doctor`).
- `kernel-cli/service`: `bdk doctor` (the checks T11 ships, the v2 layout finding with `bdk import`, too-old Node as a finding with exit 0); `bdk version` (runs below the minimum).
- `kernel-architecture`: Tests per slice (the test runner, the contract tests in the harness); new requirements for the bundle, the runtime dependency allowlist and the CI pipeline.

## Impact

- New: `package.json`, `pnpm-lock.yaml`, `tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.prettierrc.json`, `.prettierignore`, `commitlint.config.mjs`, `knip.json`, `.nvmrc`, `.editorconfig`, `.husky/`, `kernel/`, `dist/bdk.mjs`, `.github/dependabot.yml`, `docs/adr/0002-*.md` to `0005-*.md`.
- Reformatted once by Prettier: Markdown, JSON and YAML across the repository except `docs/v3/`, `CHANGELOG.md`, `dist/` and `openspec/changes/archive/`.
- Changed: `.github/workflows/tests.yml` (kernel, audit, skill-check jobs; the T10 contract job folds into the kernel job), `.gitignore` (`node_modules/`, `coverage/`), `openspec/specs/kernel-cli/service/spec.md` Purpose paragraph (the `runtime/node-version` exemption).
- Moved: `tests/contract/cli-contract.test.mjs` into the kernel harness.
- External: one PR in `broneq/git-identity` (ADR 0001 amendment).
- Developers need Node >= 22.13 and pnpm; users need Node >= 22.13 and nothing else.
