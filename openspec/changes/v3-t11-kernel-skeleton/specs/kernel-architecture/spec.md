# Spec Delta

## MODIFIED Requirements

### Requirement: Tests per slice

Each slice SHALL carry unit tests of its use cases on an in-memory store and E2E tests enumerated from the index; CI SHALL run the suite on the Node matrix.

Each slice carries unit tests of its use cases on an in-memory `shared/store` (no file system, no git) and E2E tests through `dist/bdk.mjs` on a repository fixture. E2E cases are enumerated from the index: for every record with a handler, one case per value in `exits` and one per rule in `refusals`, asserting the exit code and, on `--json`, the schema; for every stubbed record, one case asserting the `kernel/not-implemented` answer of its mode (exit 2 with the error object in command mode, exit 0 with a STOP block in inject mode, exit 2 with the reason on stderr in guard mode) and one asserting its `--help`. A stub gains the full enumeration when its owner task registers the handler. Unit tests are TypeScript run by Vitest from source, with coverage thresholds that fail the build below 90% of lines, functions and statements and 85% of branches of `kernel/src/` (tests and `main.ts` excluded); E2E tests run the committed bundle, never the source. CI runs the whole suite on a Node matrix of three lines: the minimum the contract names (22.13, HOST-FACTS `node-sqlite-min`), the active LTS and the current release (24 and 26 at the time of writing), because `node:sqlite` and the test runner differ between lines and a kernel that only ever ran on one of them would learn about the others from users. The runtime floor (`runtime/node-version` on a Node below the minimum) is covered by unit tests of the registry with an injected Node version, because no supported line is below the minimum. Three suites run over the whole tree besides the slices' own tests. The **contract tests** (formerly `tests/contract/`, T10) keep `openspec/specs/kernel-cli/` and `schema/cli/` consistent, assert that every record has a handler or the stub and that `--help` equals the record, and validate every `examples` entry of `schema/cli/output/` and `schema/cli/common/` against its schema. Two structural tests:

1. **Import scan.** Parses every `import` in `kernel/src/`: a slice may import `shared/*` and the `index.ts` of the slices in its matrix row, nothing else (no deep imports, no reverse edges, no slice import from `shared/`); inside a slice, only the layer direction of the anatomy above (`commands/` never reaches `store/`, `render/` never reaches `use-cases/`, `domain/` reaches nothing). The matrix is read from this spec's table, so the document and the code cannot drift apart silently.
2. **`node:` boundary.** `node:fs`, `node:child_process` and `node:sqlite` appear only in the files the inventory above names.

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

## ADDED Requirements

### Requirement: Bundle

The kernel SHALL ship as one committed ESM file, `dist/bdk.mjs`, built from `kernel/src/main.ts` with the command index inside it; the committed file SHALL equal a fresh build of the committed sources.

The host runs no build or install step when a plugin is installed, so the file the user runs is the file in git. The bundle imports nothing at run time except `node:` modules: every third-party library is inlined. It is built for the minimum Node line (22.13) and loads `node:sqlite` only when a command first opens the index, never at module load, so a Node below the minimum that still loads the bundle reaches the kernel's own runtime check (`kernel-cli`, Invocation). The kernel version it reports is read at run time from the plugin manifest next to it (`.claude-plugin/plugin.json`), so a version bump never changes the bundle.

#### Scenario: stale bundle

- **WHEN** a commit changes a file under `kernel/src/` or `schema/cli/commands.json` without the matching `dist/bdk.mjs`
- **THEN** CI rebuilds the bundle and `git diff --exit-code dist/` fails the build

#### Scenario: bundle imports

- **WHEN** the committed `dist/bdk.mjs` is scanned for `import` statements and dynamic `import()` calls
- **THEN** every specifier starts with `node:`

### Requirement: Runtime dependencies

The kernel's runtime dependencies SHALL be limited to an allowlist of pinned, audited libraries that the bundle inlines.

The allowlist is `zod` and the YAML parser `yaml` (design, Constraints & NFRs, Security; V1-8); a library enters it only through a change to this requirement. Every dependency in `package.json`, runtime or development, carries an exact version, never a range, and the lockfile is installed frozen. CI runs the dependency audit of the package manager over the runtime dependencies on every run and fails on an advisory of severity high or above. Updates arrive as one grouped pull request per month for the package manifest and for the CI actions.

#### Scenario: dependency outside the allowlist

- **WHEN** `package.json` lists a runtime dependency other than `zod` or `yaml`
- **THEN** the dependency test fails the build

#### Scenario: version range

- **WHEN** any dependency in `package.json` carries a range (`^`, `~`, `>`, `*`, `x`) instead of an exact version
- **THEN** the dependency test fails the build

#### Scenario: vulnerable runtime dependency

- **WHEN** the audit reports an advisory of severity high or above for a runtime dependency
- **THEN** the CI audit step fails

### Requirement: CI pipeline

CI SHALL run, on every push to `main` and every pull request, the kernel steps in this order and fail on the first failing one: frozen install, build, `git diff --exit-code dist/`, lint, format check over the repository, typecheck, unused code and dependency check, unit tests with coverage thresholds, E2E tests, contract and structural tests.

The kernel job runs every step on each line of the Node matrix of `Tests per slice`. A skill content step runs `skill-check` with the BDK rule plugin over the `skills/` directories of the plugins (T15); until T15 lands it is a stub that passes and says so in its output. On pull requests CI also checks that every commit message follows Conventional Commits, which release-please parses, and lints the workflow files. The same format, lint and commit message checks run as local git hooks on staged files, but CI never relies on them. The CI jobs of the existing Python suite and the release workflow are unaffected.

#### Scenario: coverage below the threshold

- **WHEN** a change lowers unit test coverage of `kernel/src/` below a threshold
- **THEN** the unit step fails the build

#### Scenario: non-conventional commit

- **WHEN** a pull request contains a commit whose message is not a Conventional Commit
- **THEN** the commit message check fails the build

#### Scenario: acceptance run

- **WHEN** a pull request into `staging/v3` or `main` changes the kernel
- **THEN** CI runs build, `git diff --exit-code dist/`, lint, format check, typecheck, unused code check, unit with coverage, E2E and contract steps on Node 22.13, 24 and 26, the audit, the commit message check, the workflow lint and the skill content step, and the workflow run fails when any of them fails

