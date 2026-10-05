# Spec Delta

## MODIFIED Requirements

### Requirement: Continuous integration

CI SHALL run, on every push to `main` and every pull request, the kernel steps in two jobs, each failing on its first failing step. A static job runs, once on the Node version of `.nvmrc`: frozen install, build, build determinism check, lint, format check over the repository, typecheck, unused code and dependency check. A kernel job runs, on each line of the Node matrix of `Tests per slice`: frozen install, build, unit tests with coverage thresholds, contract and structural tests. An E2E job runs, on each line of the same matrix: frozen install, build, E2E tests, split into shards that together run every E2E file once per line. The three jobs run in parallel.

A step belongs to the kernel or the E2E job when it executes kernel code, because its result can differ between Node lines; a step whose result depends only on the source and the tool versions the lockfile pins belongs to the static job and SHALL NOT run on the matrix. The build determinism check builds a second time and fails when any file under `dist/`, `schema/` or `agents/` differs from the first build, because the release workflow publishes a build of the tag (`Distribution ref`). The bundle, the schemas and the adapters the E2E and contract steps use are the ones the build step produced in the same job; no step compares them with a copy from git, because git holds none (`Generated outputs`). A skill content job runs `skill-check` with BDK's configuration over the `skills/` and `agents/` directories of the plugins (capability `skill-content-checks`) on the Node version of `.nvmrc`, after an install whose `prepare` script has written the generated adapters, and fails the build on any error finding or stale baseline entry. On pull requests CI also checks that every commit message follows Conventional Commits, which release-please parses, and lints the workflow files. The same format, lint, commit message and skill content checks run as local git hooks on staged files, but CI never relies on them. CI SHALL run no Python step: no pytest, no ruff and no `uv`. A docs workflow runs the strict site build on every pull request and every push to `main` or `staging/v3` (capability `docs-site`). The release workflow builds and publishes the generated outputs (`Distribution ref`).

#### Scenario: coverage below the threshold

- **WHEN** a change lowers unit test coverage of `kernel/src/` below a threshold
- **THEN** the unit step fails the build

#### Scenario: non-conventional commit

- **WHEN** a pull request contains a commit whose message is not a Conventional Commit
- **THEN** the commit message check fails the build

#### Scenario: skill content finding

- **WHEN** a pull request changes a skill so that `skill-check` reports an error finding
- **THEN** the skill content job fails the build

#### Scenario: Node-independent checks run once

- **WHEN** the CI workflow for a pull request is read
- **THEN** lint, format check, typecheck, the unused code check and the build determinism check run in the static job on the Node version of `.nvmrc`, and no line of the Node matrix runs any of them

#### Scenario: E2E shards cover every file

- **WHEN** the CI workflow for a pull request runs on one Node line of the matrix
- **THEN** the E2E shards of that line together run every E2E file exactly once, and a failing E2E test in any shard fails the workflow run

#### Scenario: static check failure

- **WHEN** a pull request introduces a lint error or a type error
- **THEN** the static job fails and the workflow run fails

#### Scenario: acceptance run

- **WHEN** a pull request into `staging/v3` or `main` changes the kernel
- **THEN** CI runs build, build determinism check, lint, format check, typecheck and unused code check once in the static job, build, unit with coverage, E2E and contract steps on Node 22.13, 24 and 26, E2E split into shards, the audit, the commit message check, the workflow lint and the skill content job, and the workflow run fails when any of them fails

#### Scenario: no Python step

- **WHEN** the workflow files under `.github/workflows/` are read
- **THEN** no job or step runs `pytest`, `ruff`, `uv` or `uvx`, and no job sets up Python or uv

#### Scenario: parallel kernel changes

- **WHEN** two pull requests each add a settings key or a command and neither edits a hand-written file the other edits
- **THEN** both merge into `staging/v3` with no conflict on a generated file
