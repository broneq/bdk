# Spec Delta

## ADDED Requirements

### Requirement: Pull requests run the required checks within five minutes
Every pull request SHALL run the jobs `check`, `plugins` and `commitlint` on Linux, in parallel, and all three SHALL finish within 5 minutes of wall-clock time on a pull request that does not change dependencies. `check`, `plugins` and `commitlint` SHALL be required status checks on `main` and `staging/v3`.

#### Scenario: Required checks on a pull request
- **WHEN** a contributor opens a pull request into `staging/v3`
- **THEN** the jobs `check`, `plugins` and `commitlint` run on `ubuntu-latest` and each finishes within 5 minutes

#### Scenario: A failed required check blocks the merge
- **WHEN** any of `check`, `plugins` or `commitlint` fails on a pull request
- **THEN** GitHub does not allow the pull request to merge

### Requirement: The check job lints, formats, typechecks, tests and builds the workspace
The `check` job SHALL install the pnpm workspace from its lockfile and run, over every workspace package, lint with zero warnings, a format check, a typecheck, the vitest suite and the build. A contributor SHALL be able to run the same sequence locally with one command, `pnpm check`.

#### Scenario: Type error
- **WHEN** a pull request adds a TypeScript file with a type error
- **THEN** the `check` job fails at the typecheck step

#### Scenario: Unformatted file
- **WHEN** a pull request adds a TypeScript, JSON or YAML file that prettier would rewrite
- **THEN** the `check` job fails at the format step

#### Scenario: Same checks locally
- **WHEN** a contributor runs `pnpm check` at the repository root
- **THEN** the lint, format, typecheck, test and build steps of the `check` job run in that order and the command exits non-zero on the first failure

### Requirement: The plugins job validates the marketplace and every plugin
The `plugins` job SHALL run `claude plugin validate --strict`, with the Claude Code version pinned in the lockfile, on `.claude-plugin/marketplace.json` and on every directory under `plugins/`, and SHALL fail when any of them fails.

#### Scenario: Invalid plugin manifest
- **WHEN** a pull request adds a `plugins/<name>/.claude-plugin/plugin.json` that strict validation rejects
- **THEN** the `plugins` job fails and its log names that plugin directory

#### Scenario: Valid repository
- **WHEN** a pull request leaves the marketplace and every plugin directory valid in strict mode
- **THEN** the `plugins` job passes

### Requirement: Commits follow Conventional Commits
The `commitlint` job SHALL check every commit of the pull request, from its base to its head, against the Conventional Commits rules of `@commitlint/config-conventional`, because release-please derives versions and changelogs from them.

#### Scenario: Non-conventional commit
- **WHEN** a pull request contains a commit with the subject `update stuff`
- **THEN** the `commitlint` job fails and names that commit

#### Scenario: Conventional commits
- **WHEN** every commit of a pull request has a subject such as `feat(skills): add design block`
- **THEN** the `commitlint` job passes

### Requirement: The docs site builds when its inputs change
The `docs` job SHALL build the VitePress site in `docs/` when a pull request changes a file under `docs/`, `pnpm-lock.yaml` or `.github/workflows/pr.yml`, and SHALL pass without building otherwise. A failed build SHALL fail the job.

#### Scenario: Docs change with a broken link
- **WHEN** a pull request adds a page under `docs/` that links to a page that does not exist
- **THEN** the `docs` job builds the site and fails

#### Scenario: No docs change
- **WHEN** a pull request changes no file under `docs/`, `pnpm-lock.yaml` or `.github/workflows/pr.yml`
- **THEN** the `docs` job passes without building the site

### Requirement: Every plugin directory is a release component
The workspace tests SHALL fail unless the directories under `plugins/` that hold `.claude-plugin/plugin.json` and the packages of `release-please-config.json` are the same set, and every package's `component` equals its directory name.

#### Scenario: Plugin without a release entry
- **WHEN** a pull request adds `plugins/<name>/.claude-plugin/plugin.json` without a `plugins/<name>` package in `release-please-config.json`
- **THEN** the `check` job fails at the test step and names `<name>`

#### Scenario: Release entry without a plugin
- **WHEN** `release-please-config.json` lists a package whose directory holds no `.claude-plugin/plugin.json`
- **THEN** the `check` job fails at the test step and names that package
