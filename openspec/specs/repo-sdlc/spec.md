# repo-sdlc Specification

## Purpose

Defines the development workflow of the BDK repository: how a task runs as an OpenSpec Change, and how CI keeps the living specs valid.

## Requirements

### Requirement: Main specs are validated on every pull request
CI SHALL run `openspec validate --specs --strict` with OpenSpec 1.13.2 on every pull request, and the run SHALL fail when any main spec under `openspec/specs/` fails strict validation.

#### Scenario: Valid main specs
- **WHEN** a pull request leaves every main spec under `openspec/specs/` valid in strict mode
- **THEN** the `openspec` CI job passes

#### Scenario: Invalid main spec
- **WHEN** a pull request adds a requirement without a scenario to a main spec
- **THEN** the `openspec` CI job fails and names the invalid spec

### Requirement: OpenSpec workflow commands are installed
The repository SHALL ship the OpenSpec 1.13.2 workflows `propose`, `explore`, `new`, `continue`, `apply`, `update`, `ff`, `sync`, `archive` and `verify` for Claude Code, as `/opsx:<workflow>` commands and `openspec-*` skills, so that a contributor who opens Claude Code in the repository can run a task as an OpenSpec Change without installing anything into the repository.

#### Scenario: Propose creates a Change
- **WHEN** a contributor runs `/opsx:propose` with a name of the form `v3-<N>-<slug>` in this repository
- **THEN** a Change with that name exists under `openspec/changes/` with its proposal, specs, design and tasks

#### Scenario: Fast-forward and verify are available
- **WHEN** a contributor lists the `/opsx:` commands in Claude Code in this repository
- **THEN** `/opsx:ff` and `/opsx:verify` are among them

### Requirement: Project context and artifact rules apply to every Change
`openspec/config.yaml` SHALL hold the v3 project context and per-artifact rules, so that `openspec instructions` returns them for every artifact of every Change.

#### Scenario: Rules reach the proposal
- **WHEN** a contributor runs `openspec instructions proposal --change <name> --json`
- **THEN** the output carries the project context and the proposal rules, including the `v3-<N>-<slug>` naming rule

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

### Requirement: A plugin's only version file is its manifest
The workspace tests SHALL fail when a directory under `plugins/` holds a `version.txt`. Release type `simple` bumps a `version.txt` that exists, which would give the plugin a second version next to `version` in `.claude-plugin/plugin.json`.

#### Scenario: Plugin with a version.txt
- **WHEN** a pull request adds `plugins/<name>/version.txt`
- **THEN** the `check` job fails at the test step and names `plugins/<name>/version.txt`

#### Scenario: Plugin without a version.txt
- **WHEN** no directory under `plugins/` holds a `version.txt`
- **THEN** the test passes

### Requirement: Plugin manifests keep the layout release-please writes
The workspace tests SHALL fail unless every `plugins/<name>/.claude-plugin/plugin.json` is byte-identical to its parsed content serialized as JSON with two-space indent and one trailing newline, the layout the release-please json updater writes. The formatter check SHALL skip plugin manifests, so a release pull request that bumps `version` changes only that line and passes the `check` job.

#### Scenario: Manifest in another layout
- **WHEN** a pull request adds a `plugin.json` whose layout differs from the serialized form, e.g. `"keywords": ["a", "b"]` on one line
- **THEN** the `check` job fails at the test step and names that `plugin.json`

#### Scenario: Release pull request of a manifest with an array
- **WHEN** release-please bumps `version` in a `plugin.json` in the serialized form that holds an array
- **THEN** the release pull request's diff is the `version` line only and `pnpm format:check` passes
