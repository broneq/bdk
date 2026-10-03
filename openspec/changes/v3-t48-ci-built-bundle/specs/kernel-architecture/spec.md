## MODIFIED Requirements

### Requirement: Bundle

The kernel SHALL ship as one ESM file, `dist/bdk.mjs`, built from `kernel/src/main.ts` with the command index inside it; the file SHALL be a build output that git tracks on no branch except the distribution ref (`Distribution ref`).

The host runs no build or install step when a plugin is installed, so the file the user runs is the file on the distribution ref, which a CI job built from the released sources. A contributor's checkout has no bundle until `pnpm install` (its `prepare` script) or `pnpm build` creates it. The bundle imports nothing at run time except `node:` modules: every third-party library is inlined. It is built for the minimum Node line (22.13) and loads `node:sqlite` only when a command first opens the index, never at module load, so a Node below the minimum that still loads the bundle reaches the kernel's own runtime check (`kernel-cli`, Invocation). The kernel version it reports is read at run time from the plugin manifest next to it (`.claude-plugin/plugin.json`), so a version bump never changes the bundle.

#### Scenario: stale bundle

- **WHEN** a commit changes a file under `kernel/src/` or `schema/cli/commands.json` and a stale `dist/bdk.mjs` is left in the working directory
- **THEN** CI still tests the sources, because the kernel job rebuilds the bundle before the E2E and contract steps and never reads a copy from git

#### Scenario: bundle not tracked

- **WHEN** a pull request adds `dist/bdk.mjs` to the index of a branch other than the distribution ref
- **THEN** `.gitignore` keeps it out of a plain `git add`, and the contract test on tracked generated files fails the build if it was forced in

#### Scenario: fresh checkout

- **WHEN** `pnpm install` runs in a new worktree that has no `dist/`
- **THEN** its `prepare` script builds `dist/bdk.mjs`, the generated schemas and the generated adapters, and `node dist/bdk.mjs --version` exits 0

#### Scenario: bundle missing in a test run

- **WHEN** an E2E or contract test starts and `dist/bdk.mjs` does not exist
- **THEN** the run builds it first, because the `test:e2e` and `test:contract` scripts run `pnpm build` before the suite

#### Scenario: bundle imports

- **WHEN** the built `dist/bdk.mjs` is scanned for `import` statements and dynamic `import()` calls
- **THEN** every specifier starts with `node:`

### Requirement: CI pipeline

CI SHALL run, on every push to `main` and every pull request, the kernel steps in this order and fail on the first failing one: frozen install, build, lint, format check over the repository, typecheck, unused code and dependency check, unit tests with coverage thresholds, E2E tests, contract and structural tests.

The kernel job runs every step on each line of the Node matrix of `Tests per slice`. The bundle, the schemas and the adapters the E2E and contract steps use are the ones the build step produced in the same job; no step compares them with a copy from git, because git holds none (`Generated outputs`). A skill content job runs `skill-check` with BDK's configuration over the `skills/` and `agents/` directories of the plugins (capability `skill-content-checks`) on the Node version of `.nvmrc`, after an install whose `prepare` script has written the generated adapters, and fails the build on any error finding or stale baseline entry. On pull requests CI also checks that every commit message follows Conventional Commits, which release-please parses, and lints the workflow files. The same format, lint, commit message and skill content checks run as local git hooks on staged files, but CI never relies on them. The Python job runs ruff lint and ruff format check over the Python scripts before the pytest suite, until T32 removes the scripts. `pnpm lint:py` runs the same two checks locally. A docs workflow runs the strict site build on every pull request and every push to `main` or `staging/v3` (capability `docs-site`). The release workflow builds and publishes the generated outputs (`Distribution ref`).

#### Scenario: coverage below the threshold

- **WHEN** a change lowers unit test coverage of `kernel/src/` below a threshold
- **THEN** the unit step fails the build

#### Scenario: non-conventional commit

- **WHEN** a pull request contains a commit whose message is not a Conventional Commit
- **THEN** the commit message check fails the build

#### Scenario: skill content finding

- **WHEN** a pull request changes a skill so that `skill-check` reports an error finding
- **THEN** the skill content job fails the build

#### Scenario: acceptance run

- **WHEN** a pull request into `staging/v3` or `main` changes the kernel
- **THEN** CI runs build, lint, format check, typecheck, unused code check, unit with coverage, E2E and contract steps on Node 22.13, 24 and 26, the audit, the commit message check, the workflow lint and the skill content job, and the workflow run fails when any of them fails

#### Scenario: Python lint finding

- **WHEN** a pull request adds a Python file that ruff lint flags or that `ruff format --check` would reformat
- **THEN** the Python job fails before the pytest suite runs

#### Scenario: parallel kernel changes

- **WHEN** two pull requests each add a settings key or a command and neither edits a hand-written file the other edits
- **THEN** both merge into `staging/v3` with no conflict on a generated file

### Requirement: Tests per slice

Each slice SHALL carry unit tests of its use cases on an in-memory store and E2E tests enumerated from the index; CI SHALL run the suite on the Node matrix.

Each slice carries unit tests of its use cases on an in-memory `shared/store` (no file system, no git) and E2E tests through `dist/bdk.mjs` on a repository fixture. E2E cases are enumerated from the index: for every record with a handler, one case per value in `exits` and one per rule in `refusals`, asserting the exit code and, on `--json`, the schema; for every stubbed record, one case asserting the `kernel/not-implemented` answer of its mode (exit 2 with the error object in command mode, exit 0 with a STOP block in inject mode, exit 2 with the reason on stderr in guard mode) and one asserting its `--help`. A stub gains the full enumeration when its owner task registers the handler. Unit tests are TypeScript run by Vitest from source, with coverage thresholds that fail the build below 90% of lines, functions and statements and 85% of branches of `kernel/src/` (tests and `main.ts` excluded); E2E tests run the built bundle, never the source. CI runs the whole suite on a Node matrix of three lines: the minimum the contract names (22.13, HOST-FACTS `node-sqlite-min`), the active LTS and the current release (24 and 26 at the time of writing), because `node:sqlite` and the test runner differ between lines and a kernel that only ever ran on one of them would learn about the others from users. The runtime floor (`runtime/node-version` on a Node below the minimum) is covered by unit tests of the registry with an injected Node version, because no supported line is below the minimum. Three suites run over the whole tree besides the slices' own tests. The **contract tests** (formerly `tests/contract/`, T10) keep `openspec/specs/kernel-cli/` and `schema/cli/` consistent, assert that every record has a handler or the stub and that `--help` equals the record, and validate every `examples` entry of `schema/cli/output/` and `schema/cli/common/` against its schema. A JSON Schema file under `schema/` is either generated from a zod schema by `pnpm build` (the settings, and every CLI output whose slice has its zod schema) or hand-written until its owner slice adds the zod schema; a generated file is rewritten from its zod source by every `pnpm build` and never tracked (`Generated outputs`), so it cannot differ from it, a hand-written one by the contract test that parses its examples with the zod schema when one exists. Three structural tests:

1. **Import scan.** Parses every `import` in `kernel/src/`: a slice may import `shared/*` and the `index.ts` of the slices in its matrix row, nothing else (no deep imports, no reverse edges, no slice import from `shared/`); inside a slice, only the layer direction of the anatomy above (`commands/` never reaches `store/`, `render/` never reaches `use-cases/`, `domain/` reaches nothing). The matrix is read from this spec's table, so the document and the code cannot drift apart silently.
2. **`node:` boundary.** `node:fs`, `node:child_process` and `node:sqlite` appear only in the files the inventory above names.
3. **Config consumers (S6).** Every config module in the registry names a consumer slice from the module list, is declared in that slice's `config.ts` (or in `shared/config` for its own modules), and, when the consumer slice has a registered command handler, is read by a file of that slice.

#### Scenario: runtime floor in unit tests

- **WHEN** the registry unit tests run a record other than `version` and `doctor` with an injected Node version of 22.12.0
- **THEN** the answer is exit 5 with `rule: runtime/node-version` and an install line in `instead`, and `doctor` with the same version answers exit 0 with the `node-version` finding

#### Scenario: E2E enumeration

- **WHEN** a record in the index gains an exit code or a rule
- **THEN** the E2E harness has one new case for it, asserting the exit code and, under `--json`, the schema

#### Scenario: Node matrix

- **WHEN** the CI workflow runs the kernel suite
- **THEN** it runs on the contract's minimum (22.13), the active LTS and the current release, with the same steps on every line

#### Scenario: stubbed record in the E2E harness

- **WHEN** the E2E harness runs a record whose owner task has not landed
- **THEN** it asserts the `kernel/not-implemented` answer of the record's mode with an `instead` naming the owner task, and the `--help` text of the record

#### Scenario: schema example drifts

- **WHEN** an `examples` entry in `schema/cli/output/` or `schema/cli/common/` does not validate against its own schema
- **THEN** the contract tests fail

#### Scenario: generated schema drifts

- **WHEN** a commit changes a zod schema that `pnpm build` exports
- **THEN** the next `pnpm build` rewrites the file under `schema/` and the contract tests run against it, so no regenerated file is committed and none can be stale

## ADDED Requirements

### Requirement: Generated outputs

Every file that `pnpm build` generates SHALL be ignored and untracked on every branch except the distribution ref, and one contract test SHALL keep the ignore list and the generators in step.

Generated files: `dist/bdk.mjs`; under `schema/`, `settings.json`, `pipeline.json`, `state/`, `cli/output/` and the generated files of `cli/common/` (`version.json`, `refusal.json`); under `agents/`, the adapters of `bdk export agents --host claude` (`lead`, `reader`, `reviewer`, `runner`, `scout`, `worker`). Hand-written files stay tracked: `schema/cli/commands.json`, `schema/cli/commands.schema.json`, `schema/cli/common/list-page.json` and the v2 agents that live next to the adapters until T42. `.gitignore` names each generated path (a directory where the whole directory is generated); when T42 removes the v2 agents, the six adapter names become the one entry `/agents/`. `pnpm build` runs the bundler, the schema exporter and `export agents --host claude`, in that order, from one command, so `prepare`, CI and the release job all produce the same set. The contract test runs the exporters into a temporary directory, lists every file they write, and fails when one of those paths is tracked or is not covered by `.gitignore`, and when `git ls-files` on any generated path is non-empty (it skips this second check when HEAD is the distribution ref).

#### Scenario: new generated file without an ignore entry

- **WHEN** the schema exporter starts writing `schema/state/new-kind.json` into a directory that `.gitignore` does not cover, or writes a file into a new directory
- **THEN** the contract test fails naming the path

#### Scenario: generated file forced into git

- **WHEN** a branch other than the distribution ref tracks `schema/settings.json`
- **THEN** the contract test fails naming it

#### Scenario: hand-written schema stays tracked

- **WHEN** `schema/cli/commands.json` is edited
- **THEN** the change shows in the diff of the pull request and no generator overwrites it

#### Scenario: one build command

- **WHEN** `pnpm build` runs in a clean checkout
- **THEN** it writes `dist/bdk.mjs`, every generated file under `schema/` and the six adapters under `agents/`, and a second run changes none of them

### Requirement: Distribution ref

The release workflow SHALL, when release-please creates a release, build from the tagged commit and publish the tagged tree plus the generated outputs to the `release` branch, tag that commit `dist-v<version>`, and the `bdk` entry of the marketplace SHALL install the plugin from the `release` branch.

The job checks out the release tag, runs the frozen install and `pnpm build`, force-adds `dist/`, `schema/` and `agents/` (`git add -f`: whole generated directories, so no list of files exists to drift), commits them (`chore(release): bundle <tag>`), force-pushes the commit to `release` and tags it `dist-v<version>`. `release` holds one commit per release and never merges with `main`. The tag is what the settings modeline points at (`kernel-settings`, Settings JSON Schema), so a schema URL is pinned to the kernel version that wrote it; release-please's own tag `v<version>` stays on `main`. The `bdk` entry of `.claude-plugin/marketplace.json` is a `github` plugin source with `repo: broneq/bdk` and `ref: release` (plugins reference, Plugin sources). Installed copies update because release-please bumps `version` in `.claude-plugin/plugin.json` on every release. A push to `main` that creates no release publishes nothing; a job failure leaves `release` at the previous release, which stays installable. A `workflow_dispatch` input `tag` runs the same job for an existing tag.

#### Scenario: release publishes the generated outputs

- **WHEN** release-please creates release `v3.0.1`
- **THEN** `release` points to a commit whose tree is the tree of `v3.0.1` plus `dist/bdk.mjs`, `schema/` and the six adapters, each equal to a fresh `pnpm build` of the tag, and the tag `dist-v3.0.1` names that commit

#### Scenario: no release, no publish

- **WHEN** a push to `main` leaves release-please with only an open release pull request
- **THEN** the publish job does not run and `release` is unchanged

#### Scenario: manual publish

- **WHEN** the workflow is dispatched with `tag: v3.0.1` after a failed publish
- **THEN** the job produces the same `release` commit and the same `dist-v3.0.1` tag as the automatic run would have

#### Scenario: marketplace entry

- **WHEN** `claude plugin validate` runs on the repository root
- **THEN** it reports no error and the `bdk` entry names the `github` source with `ref: release`

#### Scenario: install from the distribution ref

- **WHEN** a clean project installs `bdk` from the marketplace after a release
- **THEN** the plugin directory contains `dist/bdk.mjs` and the six adapters, and `hooks session-start` runs without the `kernel unavailable` message
