## MODIFIED Requirements

### Requirement: Bundle

The kernel SHALL ship as one ESM file, `dist/bdk.mjs`, built from `kernel/src/main.ts` with the command index inside it; the file SHALL be a build output that git does not track on any branch except the distribution ref (`Distribution ref`).

The host runs no build or install step when a plugin is installed, so the file the user runs is the file on the distribution ref, which a CI job built from the released sources. A contributor's checkout has no bundle until `pnpm install` (its `prepare` script) or `pnpm build` creates it. The bundle imports nothing at run time except `node:` modules: every third-party library is inlined. It is built for the minimum Node line (22.13) and loads `node:sqlite` only when a command first opens the index, never at module load, so a Node below the minimum that still loads the bundle reaches the kernel's own runtime check (`kernel-cli`, Invocation). The kernel version it reports is read at run time from the plugin manifest next to it (`.claude-plugin/plugin.json`), so a version bump never changes the bundle.

#### Scenario: stale bundle

- **WHEN** a commit changes a file under `kernel/src/` or `schema/cli/commands.json` and a stale `dist/bdk.mjs` is left in the working directory
- **THEN** CI still tests the sources, because the kernel job rebuilds the bundle before the E2E and contract steps and never reads a copy from git

#### Scenario: bundle not tracked

- **WHEN** a pull request adds `dist/bdk.mjs` to the index of a branch other than the distribution ref
- **THEN** `.gitignore` keeps it out of a plain `git add`, and CI does not read the committed file because it builds its own

#### Scenario: fresh checkout

- **WHEN** `pnpm install` runs in a new worktree that has no `dist/`
- **THEN** its `prepare` script builds `dist/bdk.mjs` and `node dist/bdk.mjs --version` exits 0

#### Scenario: bundle missing in a test run

- **WHEN** an E2E test starts and `dist/bdk.mjs` does not exist
- **THEN** the run fails at once with a message telling the contributor to run `pnpm build`

#### Scenario: bundle imports

- **WHEN** the built `dist/bdk.mjs` is scanned for `import` statements and dynamic `import()` calls
- **THEN** every specifier starts with `node:`

### Requirement: CI pipeline

CI SHALL run, on every push to `main` and every pull request, the kernel steps in this order and fail on the first failing one: frozen install, build, `git diff --exit-code schema/`, the generated adapters check, lint, format check over the repository, typecheck, unused code and dependency check, unit tests with coverage thresholds, E2E tests, contract and structural tests.

The kernel job runs every step on each line of the Node matrix of `Tests per slice`. The bundle the E2E and contract steps run is the one the build step produced in the same job; no step compares it with a committed copy. A skill content job runs `skill-check` with BDK's configuration over the `skills/` and `agents/` directories of the plugins (capability `skill-content-checks`) on the Node version of `.nvmrc`, and fails the build on any error finding or stale baseline entry. On pull requests CI also checks that every commit message follows Conventional Commits, which release-please parses, and lints the workflow files. The same format, lint, commit message and skill content checks run as local git hooks on staged files, but CI never relies on them. The Python job runs ruff lint and ruff format check over the Python scripts before the pytest suite, until T32 removes the scripts. `pnpm lint:py` runs the same two checks locally. A docs workflow runs the strict site build on every pull request and every push to `main` or `staging/v3` (capability `docs-site`). The release workflow builds and publishes the bundle (`Distribution ref`).

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
- **THEN** CI runs build, `git diff --exit-code schema/`, the adapters check, lint, format check, typecheck, unused code check, unit with coverage, E2E and contract steps on Node 22.13, 24 and 26, the audit, the commit message check, the workflow lint and the skill content job, and the workflow run fails when any of them fails

#### Scenario: Python lint finding

- **WHEN** a pull request adds a Python file that ruff lint flags or that `ruff format --check` would reformat
- **THEN** the Python job fails before the pytest suite runs

#### Scenario: parallel kernel changes

- **WHEN** two pull requests change different files under `kernel/src/` and neither changes `schema/`
- **THEN** both merge into `staging/v3` with no conflict on a generated file

## ADDED Requirements

### Requirement: Distribution ref

The release workflow SHALL, when release-please creates a release, build the bundle from the tagged commit and publish the tagged tree plus `dist/bdk.mjs` to the `release` branch, and the `bdk` entry of the marketplace SHALL install the plugin from that branch.

The job checks out the release tag, runs the frozen install and `pnpm build`, adds `dist/bdk.mjs` with `git add -f`, commits it (`chore(release): bundle <tag>`) and force-pushes the result to `release`; the branch holds one commit per release, so it never merges with `main`. The `bdk` entry of `.claude-plugin/marketplace.json` is a `github` plugin source with `repo: broneq/bdk` and `ref: release` (plugins reference, Plugin sources). Installed copies update because release-please bumps `version` in `.claude-plugin/plugin.json` on every release. A push to `main` that creates no release publishes nothing. A job failure leaves `release` at the previous release, which stays installable.

#### Scenario: release publishes the bundle

- **WHEN** release-please creates release `v3.0.1`
- **THEN** `release` points to a commit whose tree is the tree of `v3.0.1` plus `dist/bdk.mjs`, and that file equals a fresh `pnpm build` of the tag

#### Scenario: no release, no publish

- **WHEN** a push to `main` leaves release-please with only an open release pull request
- **THEN** the publish job does not run and `release` is unchanged

#### Scenario: marketplace entry

- **WHEN** `claude plugin validate` runs on the repository root
- **THEN** it reports no error and the `bdk` entry names the `github` source with `ref: release`

#### Scenario: install from the distribution ref

- **WHEN** a clean project installs `bdk` from the marketplace after a release
- **THEN** the plugin directory contains `dist/bdk.mjs` and `hooks session-start` runs without the `kernel unavailable` message
