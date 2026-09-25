# Design

## Context

See proposal.md, Why. The contract (`kernel-cli`, 61 records in `schema/cli/commands.json`) and the module layout (`kernel-architecture`: slices, `shared/`, dependency matrix, build order) are fixed; this design decides only what they leave to T11. The repository has no Node toolchain yet: CI runs pytest and the T10 contract test (`node --test tests/contract/*.test.mjs`, no dependencies) on Node 22.13 / 24 / 26. The plugin version lives in `.claude-plugin/plugin.json` and is bumped by release-please on `main` (`release-type: simple`, `extra-files`). The host runs no build and no install for plugins, and skips `pnpm-lock.yaml` (git-identity ADR 0001, "Dependencies in plugins").

User decisions taken while writing this Change (2026-09-25): Node 20 is not supported and not tested (the bundle targets the minimum line); follow the `kernel-architecture` build order in full (all eight shared modules, including the skeletons of `clock`, `ids` and `store`); `doctor` is exempt from the Node gate; tests run on Vitest, lint on ESLint, formatting on Prettier with husky and lint-staged, plus commitlint, coverage thresholds, knip, `.nvmrc`, `.editorconfig` and actionlint (D-2); new source files live under `kernel/src/` and nowhere else; `package.json` sits at the repository root.

## Goals / Non-Goals

**Goals:**

- Every later task adds files inside one slice plus its contract record, never build, test or CI infrastructure.
- The committed bundle is provably the build of the committed source, and imports nothing but `node:`.
- A user on the wrong Node or on a v2 layout gets a diagnosis and one repair command, never a loader stack trace.

**Non-Goals:**

- Final shapes of the index, ids or configuration (T14, T12); the skeletons expose the primitives the build order names and are allowed to change when their owner lands.
- Performance tuning beyond keeping `version` and `doctor` inside the design's 30-50 ms Node start budget (no measurement gate in T11).
- Windows support (an open design item).

## Decisions

### D-1 Repository layout: root `package.json`, sources in `kernel/`, bundle in `dist/`

`package.json`, `pnpm-lock.yaml` and the tool configurations of D-2 (`tsconfig.json`, `eslint.config.mjs`, `vitest.config.ts`, `.prettierrc.json`, `.prettierignore`, `commitlint.config.mjs`, `knip.json`, `.nvmrc`, `.editorconfig`, `.husky/`) at the root, each in its own file; sources in `kernel/src/` (slices and `shared/` as `kernel-architecture` names them, composition root `kernel/src/main.ts`); kernel-wide tests in `kernel/tests/` (E2E harness, contract, structure); slice tests in `kernel/src/<slice>/tests/`; the bundle in `dist/bdk.mjs`, the path the contract fixes. `.gitattributes` marks `dist/bdk.mjs` as `linguist-generated=true -diff` so reviews show the source, not the bundle.

Alternative `kernel/package.json` with a build writing to `../dist/`: isolates the Node tooling, but every CI step needs a working directory, the contract and structure tests read files outside the package (`openspec/`, `schema/`), and a second package root adds nothing while the repository holds one Node package. Lost (user decision).

### D-2 Toolchain: TypeScript strict, esbuild, Vitest, ESLint, Prettier, husky with lint-staged

This departs from D5, which named `node --test` and Biome (user decision, 2026-09-25; ADR 0002 records D5 as amended here). The runtime half of D5 (Node, TypeScript source, committed ESM bundle, `git diff --exit-code`) is unchanged; only the development tooling moves.

- **Types:** `tsc --noEmit` with `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes` (the contract forbids `null` for absent fields; optional-but-present-as-undefined is the same bug), `verbatimModuleSyntax`, `module`/`moduleResolution: nodenext`.
- **Bundle:** esbuild (D-3).
- **Tests:** Vitest, which runs TypeScript without a loader. `vitest.config.ts` defines three projects: `unit` (`kernel/src/**/*.test.ts`), `e2e` (`kernel/**/*.e2e.ts`, spawns `dist/bdk.mjs`, never imports source) and `contract` (`kernel/tests/contract/**`, `kernel/tests/*.test.ts`: contract, structure, dependency tests). Coverage with `@vitest/coverage-v8` on the `unit` project over `kernel/src/**` excluding tests and `main.ts`, thresholds 90% lines, functions and statements and 85% branches; CI fails below them. E2E runs in child processes, which v8 coverage does not see, so it does not count toward the threshold.
- **Lint:** ESLint flat config (`eslint.config.mjs`) with `typescript-eslint` type-checked recommended rules over `kernel/`, plus `eslint-config-prettier` so no ESLint rule formats. The import scan of `kernel-architecture` stays a test, because the matrix is read from the spec table, which an ESLint rule configuration would duplicate.
- **Format:** Prettier over the whole repository (TypeScript, JSON, YAML, Markdown), `.prettierrc.json` with the defaults plus `printWidth: 100` and `proseWrap: preserve` (Markdown paragraphs in specs and skills are one line per paragraph today; re-wrapping them would rewrite every file for no gain). `.prettierignore`: `docs/v3/` (design-session archive, stays as written), `CHANGELOG.md` (generated by release-please), `dist/`, `coverage/`, `pnpm-lock.yaml`, `openspec/changes/archive/`. The first run is its own commit (`style: format the repository with Prettier`), separate from the kernel code, and must leave the contract tests and `pytest tests/unit/` green, because both read Markdown and JSON the formatter touches.
- **Git hooks:** husky installs through the `prepare` script. `pre-commit` runs lint-staged: `eslint --fix` then `prettier --write` on staged `*.ts`, `prettier --write` on staged JSON, YAML and Markdown. `commit-msg` runs commitlint with `@commitlint/config-conventional`, which is what release-please parses. Hooks are a convenience; CI runs every check again, so `--no-verify` cannot land an unformatted or unconventional commit.
- **Unused code and dependencies:** knip (`knip.json`) over `kernel/`; it fails on unused files, exports and dependencies. The skeleton modules of D-6 export primitives whose consumers arrive in later tasks; each such export carries a knip `@public` tag with the owner task, so the exception is visible at the code site and disappears when the consumer lands.
- **Repository hygiene:** `.nvmrc` pins the development Node to 24 (the active LTS); `.editorconfig` sets UTF-8, LF, final newline and two-space indentation for files Prettier does not own (Python keeps four); actionlint checks `.github/workflows/` on CI.

Alternatives: `node --test` with `tsx` and Biome as D5 wrote them (one test and one lint dependency instead of about ten; the user prefers the mainstream stack and its type-aware lint rules); simple-git-hooks or lefthook instead of husky (equivalent for two hooks; user choice); `eslint-plugin-boundaries` for the slice matrix (duplicates the spec table the test already reads). Lost.

### D-3 Bundle shape and the runtime floor

esbuild: `--bundle --platform=node --format=esm --target=node22.13 --outfile=dist/bdk.mjs`, with `schema/cli/commands.json` imported as JSON and inlined. Target `node22.13`, the minimum: no syntax is lowered for lines nobody may run. A Node below the minimum that still parses the file (22.0-22.12, 23.0-23.3) reaches the kernel's check; Node 20 and older are unsupported and may fail in the loader, which the `|| echo "BDK STOP ... Install Node >= 22.13"` and `|| exit 2` wrapper branches already turn into a visible stop (V1-5, Q3). A command-mode call from Bash on Node 20 shows a loader error; accepted (user decision), because the skills and hooks never call the kernel without a wrapper. `node:sqlite` is imported with a dynamic `import()` inside `shared/store` when the index is first opened, so the module graph of `version` and `doctor` never touches it. The first statement of `main()` after argv classification is the runtime check (D-5 order).

On Node 22.13 to 22.x `node:sqlite` prints an `ExperimentalWarning` on stderr. Inject-mode wrappers merge stderr into the content (`2>&1`), so `shared/store` suppresses exactly that warning when it opens the index; any other warning stays visible.

Alternatives: target `node20` plus a Node 20 CI line, so the oldest line users still have gets exit 5 instead of a loader error (a fourth matrix line and floor expectations in the harness for an end-of-life runtime the wrappers already cover; lost, user decision); a tiny launcher `bdk.mjs` that checks the version and then imports the real bundle (two files to keep in sync and one more module load per call; lost).

### D-4 Kernel version read from the plugin manifest at run time

`shared/config` reads `version` from `.claude-plugin/plugin.json`, located relative to the bundle (`import.meta.url`, one directory up). The contract version is the index's `contract` field (3). If the manifest is unreadable the kernel reports `0.0.0-unknown` rather than failing, because `version` must always answer.

Alternatives: inline the version at build time (esbuild `define` from `plugin.json` or `package.json`). The release-please PR bumps `plugin.json` on `main` without rebuilding, so `git diff --exit-code dist/` would fail on every release PR, or the release would ship a bundle reporting the previous version. Lost. Consequence: on `staging/v3` the kernel reports the current plugin version (2.6.0) until T50 releases 3.0.0.

### D-5 Registry: one pipeline for all 61 records

`shared/registry` loads the bundled index and processes every call in this order, so the E2E harness can predict every answer:

1. **Resolve the command** from argv against `argv` of the records; no match is `input/unknown-command` with the closest id in `instead`.
2. **`--help`** prints the usage generated from the record (synopsis from `argv`, `args`, `flags`; availability, mode, exit codes, rules, owner) and exits 0, before any runtime or project check, so help works on any Node and outside a repository.
3. **Parse** positionals and flags against the record: `input/unknown-flag`, `input/missing-argument`, `input/invalid-argument` (a literal outside `values`). `--json` and `--help` are implicit.
4. **Runtime checks** unless the record is `standalone`: Node >= 22.13.0 (the running version comes from an injected function, so unit tests cover the floor without an old Node) (`runtime/node-version`, skipped for handlers registered with `nodeGate: false`, which only `doctor` uses), then the work tree (`runtime/not-a-repo`).
5. **Dispatch** to the registered handler, or to the stub: `kernel/not-implemented`, `why` naming the command and its owner task, `instead` naming the owner task and `bdk <group> --help`. Active-Change resolution for `changeScoped` records sits between 4 and 5 once T20 provides a Change store; no T11 handler is Change-scoped.

The mode wrapper turns every outcome into the contract shape of the record's `mode`: command mode prints the result or the error object on stdout and exits by the rule class; inject mode prints content or the two-line STOP block and always exits 0; guard mode exits 0 on pass and 2 with the reason on stderr on block, never 3-5. `main.ts` catches anything that escapes: inject mode renders it as a STOP block (exit 0), guard mode as a block (exit 2), command mode prints the stack on stderr and exits 1, which a test treats as a failure (`kernel-cli`, Exit codes).

The `doctor` exemption is a registration option of the handler, not an index field: the index describes the contract a caller sees, and the caller sees the same `exits` either way (`doctor` keeps 5 for `runtime/not-a-repo`).

Alternative: Change the index schema with a `nodeGate` field. It would put an implementation detail of one command into a file every task reads, and the contract test would need a new rule for one record. Lost.

### D-6 What each shared module holds in T11

Following the build order in full (user decision). Each module holds only primitives with a named caller in T11 or a test, and its owner task may change the shape.

| Module            | T11 content                                                                                                                                                                                                                                                                                                                                                                       | Later owner                         |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------- |
| `shared/refusal`  | `Refusal` type, the rule catalogue as a TypeScript union (a contract test checks it equals the spec catalogue), class-to-exit mapping, `refuse()` helper                                                                                                                                                                                                                          | -                                   |
| `shared/output`   | JSON writer, text writer with the 100-line cap, list page builder (`items`, `total`, `truncated`, `for`), four-line refusal text, STOP block renderer                                                                                                                                                                                                                             | -                                   |
| `shared/registry` | D-5                                                                                                                                                                                                                                                                                                                                                                               | T20 (active Change)                 |
| `shared/clock`    | `Clock` interface, system clock (ISO 8601 UTC, seconds), fixed clock for tests                                                                                                                                                                                                                                                                                                    | -                                   |
| `shared/ids`      | Prefix constants (`L-`, `A-`, `E-`), a provisional random base36 generator, the qualified reference parser `<changeId>/<id>`                                                                                                                                                                                                                                                      | T14 (format)                        |
| `shared/config`   | Plugin manifest read (D-4); the reading half of the four layers: locate and parse bundle defaults, `~/.config/bdk/settings.yaml`, `.bdk/settings.yaml`, `.bdk/settings.local.yaml` into raw objects with their layer names                                                                                                                                                        | T12 (merge, zod registry, snapshot) |
| `shared/store`    | `Store` interface with a file system and an in-memory implementation (the unit tests of `kernel-architecture` run on the latter); project root discovery (nearest `.bdk/`, else the work tree root); read, atomic write (temp file then rename), list, exists; frontmatter split; the index skeleton (lazy `node:sqlite`, busy timeout, one `meta` table with the schema version) | T14 (schemas), T20                  |
| `shared/git`      | Work tree detection by walking up for a `.git` entry (directory or file, so linked worktrees count) without spawning `git`; `run()` over `execFile` mapping a missing executable to `runtime/git-missing`; in-progress detection from the rebase, merge and cherry-pick markers (`policy/git-in-progress`)                                                                        | T20, T22                            |

Work tree detection reads the file system instead of running `git rev-parse` because `base.all` does not include `runtime/git-missing`: a command that never shells out to git must not start failing because git is absent, and a spawn per call eats into the latency budget.

The reading half of `shared/config` brings the YAML parser in now, so `yaml` joins `zod` in T11 (both in the allowlist of the `Runtime dependencies` requirement).

### D-7 `service` slice

`kernel/src/service/` in the slice anatomy: `commands/{parse,version,doctor}.ts`, `use-cases/{version,doctor}.ts`, `domain/{node-version,layout}.ts` (pure: semver compare against 22.13.0, layout classification from a list of present paths), `render/`, `schema/` (zod for both outputs), `tests/` (unit tests on the in-memory store; `service.e2e.ts`). `doctor` asks `shared/store` which of the v2 and v3 marker paths exist and `domain/` turns that into `layout` and findings. The Node repair line is `nvm install 24 && nvm use 24` when `NVM_DIR` is set, and the Node download URL otherwise; the finding never installs anything.

### D-8 Test harness and schema validation

- **Fixture:** `kernel/tests/support/fixture.ts` creates a directory under the OS temp dir, runs `git init` in it, writes the requested files (`.bdk/settings.json`, `plans/`, ...) and removes it after the test.
- **Runner:** `kernel/tests/support/run.ts` spawns `dist/bdk.mjs` with `process.execPath` (the kernel always runs on the same Node as the harness), the fixture as working directory and `CLAUDE_PLUGIN_ROOT` set to the repository root; it returns exit code, stdout, stderr and the parsed JSON.
- **Enumeration:** `kernel/tests/contract.e2e.ts` walks the index and generates the cases of `kernel-architecture`, Tests per slice: full enumeration for records with a handler, the mode-specific stub answer and `--help` for the rest.
- **JSON Schema validation:** Ajv (draft 2020-12, development dependency only) validates E2E `--json` output and every `examples` entry against the committed files. The zod schemas of `version`, `doctor`, the refusal and the list page additionally parse the same examples, so the in-kernel types and the committed files cannot disagree on an example. Reproducing the files from zod is T12's export.
- **Contract tests:** `tests/contract/cli-contract.test.mjs` moves to `kernel/tests/contract/cli-contract.test.ts` unchanged in substance, plus: handler-or-stub for every record, `--help` parity, catalogue union equals the spec catalogue.
- **Structure tests:** the import scan uses `ts.preProcessFile` from the TypeScript compiler (already a development dependency) to list the imports of every file, reads the matrix from the `kernel-architecture` table, and checks slice edges and layer direction; the `node:` boundary test scans the same import lists. A seeded violation in a temporary file is the negative control of each test (git-identity ADR 0001, rule 16).
- **Dependency test:** reads `package.json`: runtime dependencies within the allowlist, no ranges anywhere.
- **Runtime floor:** registry unit tests inject Node versions (22.12.9, 22.13.0, 26.9.0) and assert exit 5 with `runtime/node-version` for an ordinary record, exit 0 for `version`, and the `node-version` finding for `doctor`. No CI line runs below the minimum.

### D-9 CI in the existing `tests.yml`

Jobs: `pytest` (unchanged), `kernel` (matrix 22.13 / 24 / 26, identical steps on every line; `pnpm install --frozen-lockfile`, `pnpm build`, `git diff --exit-code dist/`, `pnpm lint` (ESLint), `pnpm format:check` (`prettier --check .`), `pnpm typecheck`, `pnpm knip`, `pnpm test:unit` (with coverage thresholds), `pnpm test:e2e`, `pnpm test:contract`), `lint-repo` (once, on Node 24: actionlint over `.github/workflows/`, and on pull requests commitlint over the PR's commits, `--from` the base SHA `--to` the head SHA), `audit` (`pnpm audit --prod --audit-level high`), `skill-check` (stub step printing that T15 has not landed, exit 0). The T10 `contract` job is removed because the `kernel` job runs the same checks on the same matrix. pnpm comes from `pnpm/action-setup` reading `packageManager`. `release-please.yml` is untouched.

Alternatives: a separate `kernel.yml` workflow (two files with the same triggers and matrix; the plan's "CI green" is one status either way); another CI host (release-please already runs on Actions). Lost.

### D-10 Dependency policy (V1-8)

Exact versions for every dependency; `packageManager: pnpm@<exact>`; frozen install on CI; runtime allowlist `zod`, `yaml`; Dependabot (`.github/dependabot.yml`) for `npm` and `github-actions`, monthly, each ecosystem grouped into one PR, `target-branch` left at the default. The audit gates every CI run on runtime dependencies at severity high; development dependencies are not audited as a gate because none of them reaches the user (they are not in the bundle and the host skips the lockfile).

Alternatives: caret ranges plus the lockfile (the lockfile already pins, but ranges hide what the bundle contains and invite silent drift on a lockfile refresh); Renovate (needs an app installation for one repository with two runtime libraries); a scheduled weekly audit only (misses an advisory introduced by a PR). Lost.

### D-11 No JSON index fallback

The minimum Node is 22.13.0 and `node:sqlite` exists unflagged on every line from there (HOST-FACTS `node-sqlite-min`, `node-sqlite-local`), is a release candidate since 25.7 (`node-sqlite-stability`), and a Node without it is refused with exit 5 before any index access. A fallback JSON index would be a second store implementation that no supported configuration exercises. T20's "escape hatch" is closed here; the store stays swappable behind `shared/store` (R-store) if the API changes before stability 2.

### D-12 ADRs 0002-0005 and the git-identity amendment

Four ADRs in `docs/adr/` in the MADR format of `/bdk:create-adr`, status `accepted` (the decisions were taken in the design session): 0002 kernel runtime (D5), 0003 artifact graph as data with a typed spine (A-podejście), 0004 configuration as YAML plus Markdown files (R-format), 0005 Markdown truth with a rebuildable SQLite index (R-store). Each cites the register entry and the design section and records the alternatives the design session rejected; none reopens a decision. `/bdk:create-adr` is user-invoked (`disable-model-invocation: true`), so the apply session writes the four files in its template unless the user runs the skill.

The git-identity amendment is a separate PR in `broneq/git-identity` (another repository cannot be part of this PR): an amendment section in ADR 0001 dated at merge, stating that bdk moved to a Node / TypeScript kernel (D5), so the consequence "bdk stays in Python" no longer holds and "The helpers are to be consumed by bdk" in "What would invalidate this" becomes possible; and that rule 9 ("the core functionality has no runtime") is reinterpreted for plugins whose core is a state machine over committed files, whose core is a bundled kernel under rules 1, 7 and 8. Opening the PR is outward-facing, so the apply session shows the text and asks before pushing.

## Risks / Trade-offs

- [The committed bundle bloats diffs and merge conflicts on `dist/bdk.mjs` between parallel task branches] -> `.gitattributes` hides it from diffs; a conflict is resolved by rebuilding, never by hand, and the CI diff check catches a wrong resolution.
- [Unit tests run source through Vitest's transform, users run the esbuild bundle; a bundling difference slips past unit tests] -> E2E tests run only the bundle, on every matrix line.
- [`dependabot.yml` is read from the default branch, and `main` has no `package.json` until v3 merges] -> updates start after the 3.0 release (T50); until then the monthly cadence is manual and the per-PR audit still gates.
- [The skeletons of `ids`, `store` and `config` guess shapes T12 and T14 will fix] -> each module's table row in D-6 names its owner; the owner may change the shape without a compatibility layer because nothing outside tests consumes it yet.
- [`version` reports 2.6.0 on `staging/v3`] -> accepted; the value is correct for the manifest it ships with, and T50 bumps it.
- [The one-off Prettier run rewrites Markdown that tests and skills parse (spec tables, fenced `json refusal` blocks, SKILL.md frontmatter)] -> it is a separate commit verified by the contract tests and the pytest suite before any kernel commit; `proseWrap: preserve` keeps paragraphs as they are.
- [About ten development dependencies instead of three (the D5 toolchain)] -> none reaches the user (not in the bundle, lockfile skipped by the host); all are exact-pinned and updated by the monthly Dependabot group.
- [A user on Node 20 who calls `dist/bdk.mjs` directly from a terminal sees a loader error, not exit 5] -> unsupported configuration; every BDK call site uses a wrapper that prints the install line, and `engines.node` states the minimum.
- [Work tree detection by `.git` walk ignores `GIT_DIR` and `GIT_WORK_TREE`] -> accepted for T11; the hosts BDK supports run in ordinary checkouts and worktrees. Revisit if a user runs BDK with those variables.
- [A bug in the registry stops every stateful skill (design Risk Register, SPOF: the kernel)] -> the E2E enumeration covers every record from day one, and inject and guard modes never surface a crash as a non-contract exit.

## Migration Plan

Nothing is wired into `hooks.json` or any skill in T11, so users of the v2 plugin see no change; the kernel is reachable only by calling `dist/bdk.mjs` directly. Rollback is a revert of the PR. The T10 contract job disappears from CI in the same PR that adds the `kernel` job running the same checks.

## Open Questions

- Whether the git-identity amendment should also note that BDK's guard hooks fail closed, which departs from that ADR's rule 2 ("a missing runtime ends the hook in silent success"). Recommendation: yes, one sentence, because the next plugin copying the rules would otherwise copy a rule BDK breaks on purpose (Q3). It changes only the amendment text in the other repository, not this Change.
